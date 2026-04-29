const express = require('express');
const { Pool } = require('pg');
const twilio = require('twilio');
const moment = require('moment-timezone');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(cors());

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize database tables
async function initDatabase() {
    const client = await pool.connect();
    try {
        await client.query(`
            CREATE TABLE IF NOT EXISTS staff_members (
                id SERIAL PRIMARY KEY,
                phone_number VARCHAR(20) UNIQUE NOT NULL,
                name VARCHAR(100),
                department VARCHAR(50),
                role VARCHAR(50),
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS attendance_logs (
                id SERIAL PRIMARY KEY,
                staff_id INTEGER REFERENCES staff_members(id),
                log_type VARCHAR(10) CHECK (log_type IN ('IN', 'OUT')),
                timestamp TIMESTAMP NOT NULL,
                raw_message TEXT,
                location VARCHAR(100),
                notes TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS daily_movements (
                id SERIAL PRIMARY KEY,
                staff_id INTEGER REFERENCES staff_members(id),
                date DATE NOT NULL,
                movement_time TIME NOT NULL,
                movement_type VARCHAR(10) CHECK (movement_type IN ('IN', 'OUT', 'TRANSIT')),
                location VARCHAR(100),
                purpose TEXT,
                created_at TIMESTAMP DEFAULT NOW()
            );
            
            CREATE TABLE IF NOT EXISTS session_daily_summary (
                id SERIAL PRIMARY KEY,
                staff_id INTEGER REFERENCES staff_members(id),
                date DATE NOT NULL,
                first_in TIMESTAMP,
                last_out TIMESTAMP,
                total_standard_hours DECIMAL(5,2),
                total_overtime_hours DECIMAL(5,2),
                late_minutes INT DEFAULT 0,
                early_out_minutes INT DEFAULT 0,
                UNIQUE(staff_id, date)
            );
        `);
        console.log('✅ Database initialized');
    } catch (err) {
        console.error('Database init error:', err);
    } finally {
        client.release();
    }
}

// Helper: Get or create staff
async function getStaffId(phoneNumber) {
    let result = await pool.query(
        'SELECT id FROM staff_members WHERE phone_number = $1',
        [phoneNumber]
    );
    
    if (result.rows.length === 0) {
        const insert = await pool.query(
            'INSERT INTO staff_members (phone_number, name) VALUES ($1, $2) RETURNING id',
            [phoneNumber, phoneNumber.replace('whatsapp:', '')]
        );
        return insert.rows[0].id;
    }
    return result.rows[0].id;
}

// Helper: Parse message
function parseMessage(msg) {
    const lowerMsg = msg.toLowerCase();
    let type = null;
    let location = null;
    let notes = null;

    if (lowerMsg.includes('in')) {
        type = 'IN';
        const atMatch = msg.match(/@\s*(\w+(?:\s+\w+)?)/i) || msg.match(/at\s+(\w+(?:\s+\w+)?)/i);
        if (atMatch) location = atMatch[1].substring(0, 50);
    } else if (lowerMsg.includes('out')) {
        type = 'OUT';
        const forMatch = msg.match(/out for\s+(.+)/i);
        if (forMatch) notes = forMatch[1].substring(0, 200);
    }

    return { type, location, notes };
}

// Helper: Calculate daily summary
async function calculateDailySummary(staffId, date) {
    const logs = await pool.query(
        `SELECT * FROM attendance_logs 
         WHERE staff_id = $1 AND DATE(timestamp) = $2 
         ORDER BY timestamp`,
        [staffId, date]
    );

    let firstIn = null;
    let lastOut = null;

    for (const log of logs.rows) {
        if (log.log_type === 'IN' && !firstIn) firstIn = log.timestamp;
        if (log.log_type === 'OUT') lastOut = log.timestamp;
    }

    if (!firstIn) return;

    const nineAM = moment.tz(`${date}T09:00:00`, 'Asia/Colombo');
    const sixPM = moment.tz(`${date}T18:00:00`, 'Asia/Colombo');
    const inTime = moment(firstIn).tz('Asia/Colombo');
    const outTime = lastOut ? moment(lastOut).tz('Asia/Colombo') : sixPM;

    let lateMinutes = Math.max(0, inTime.diff(nineAM, 'minutes'));
    let earlyOutMinutes = 0;
    
    if (lastOut && outTime.isBefore(sixPM)) {
        earlyOutMinutes = sixPM.diff(outTime, 'minutes');
    }

    let totalStandard = 0;
    let totalOvertime = 0;

    if (lastOut) {
        const workEnd = outTime.isAfter(sixPM) ? sixPM : outTime;
        const standardDuration = workEnd.diff(inTime, 'hours', true);
        totalStandard = Math.max(0, Math.min(standardDuration, 9));

        if (outTime.isAfter(sixPM)) {
            totalOvertime = outTime.diff(sixPM, 'hours', true);
        }
    }

    await pool.query(
        `INSERT INTO session_daily_summary 
         (staff_id, date, first_in, last_out, total_standard_hours, total_overtime_hours, late_minutes, early_out_minutes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (staff_id, date) 
         DO UPDATE SET 
            first_in = EXCLUDED.first_in,
            last_out = EXCLUDED.last_out,
            total_standard_hours = EXCLUDED.total_standard_hours,
            total_overtime_hours = EXCLUDED.total_overtime_hours,
            late_minutes = EXCLUDED.late_minutes,
            early_out_minutes = EXCLUDED.early_out_minutes`,
        [staffId, date, firstIn, lastOut, totalStandard, totalOvertime, lateMinutes, earlyOutMinutes]
    );
}

// Webhook endpoint
app.post('/api/webhook/whatsapp', async (req, res) => {
    const fromNumber = req.body.From || req.body.FromNumber || req.body.Author;
    const messageBody = req.body.Body || req.body.Text || '';
    const timestamp = req.body.Timestamp ? new Date(req.body.Timestamp * 1000) : new Date();

    if (!fromNumber || !messageBody) {
        return res.status(400).json({ error: 'Missing data' });
    }

    try {
        const staffId = await getStaffId(fromNumber);
        const { type, location, notes } = parseMessage(messageBody);

        if (type) {
            await pool.query(
                `INSERT INTO attendance_logs (staff_id, log_type, timestamp, raw_message, location, notes)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [staffId, type, timestamp, messageBody, location, notes]
            );

            await pool.query(
                `INSERT INTO daily_movements (staff_id, date, movement_time, movement_type, location, purpose)
                 VALUES ($1, $2, $3, $4, $5, $6)`,
                [staffId, moment(timestamp).format('YYYY-MM-DD'), timestamp, type, location, notes]
            );

            await calculateDailySummary(staffId, moment(timestamp).format('YYYY-MM-DD'));
        }

        // Auto-reply if Twilio configured
        if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
            const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
            await twilioClient.messages.create({
                body: `✅ Logged: ${type || 'Received'} at ${moment(timestamp).format('hh:mm A')}`,
                from: process.env.TWILIO_WHATSAPP_NUMBER,
                to: fromNumber,
            });
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({ error: error.message });
    }
});

// API endpoints
app.get('/api/attendance', async (req, res) => {
    const { startDate, endDate, staffId, department, month, week, limit = 1000 } = req.query;
    
    let query = `
        SELECT 
            s.id as staff_id, s.name, s.department, s.phone_number,
            sd.date, sd.first_in, sd.last_out,
            sd.total_standard_hours, sd.total_overtime_hours,
            sd.late_minutes, sd.early_out_minutes
        FROM session_daily_summary sd
        JOIN staff_members s ON sd.staff_id = s.id
        WHERE 1=1
    `;
    const params = [];

    if (startDate) { params.push(startDate); query += ` AND sd.date >= $${params.length}`; }
    if (endDate) { params.push(endDate); query += ` AND sd.date <= $${params.length}`; }
    if (staffId) { params.push(staffId); query += ` AND sd.staff_id = $${params.length}`; }
    if (department) { params.push(department); query += ` AND s.department = $${params.length}`; }
    if (month) { params.push(month); query += ` AND EXTRACT(MONTH FROM sd.date) = $${params.length}`; }
    if (week) { params.push(week); query += ` AND EXTRACT(WEEK FROM sd.date) = $${params.length}`; }

    query += ` ORDER BY sd.date DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);
    res.json(result.rows);
});

app.get('/api/movements', async (req, res) => {
    const { staffId, startDate, endDate } = req.query;
    
    let query = `
        SELECT dm.date, dm.movement_time, dm.movement_type, dm.location, dm.purpose, s.name
        FROM daily_movements dm
        JOIN staff_members s ON dm.staff_id = s.id
        WHERE 1=1
    `;
    const params = [];

    if (staffId) { params.push(staffId); query += ` AND dm.staff_id = $${params.length}`; }
    if (startDate) { params.push(startDate); query += ` AND dm.date >= $${params.length}`; }
    if (endDate) { params.push(endDate); query += ` AND dm.date <= $${params.length}`; }

    query += ` ORDER BY dm.date DESC, dm.movement_time LIMIT 500`;
    
    const result = await pool.query(query, params);
    res.json(result.rows);
});

app.get('/api/staff', async (req, res) => {
    const result = await pool.query('SELECT id, name, department, phone_number FROM staff_members ORDER BY name');
    res.json(result.rows);
});

app.get('/api/statistics', async (req, res) => {
    const stats = await pool.query(`
        SELECT 
            COUNT(DISTINCT staff_id) as total_staff,
            COUNT(*) as total_records,
            AVG(late_minutes) as avg_late,
            SUM(total_overtime_hours) as total_overtime,
            SUM(total_standard_hours) as total_standard
        FROM session_daily_summary
    `);
    res.json(stats.rows[0]);
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date() });
});

// Start server
const PORT = process.env.PORT || 3000;
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on port ${PORT}`);
        console.log(`📊 Dashboard URL: http://localhost:${PORT}/dashboard`);
        console.log(`📞 Webhook URL: http://localhost:${PORT}/api/webhook/whatsapp`);
    });
});
