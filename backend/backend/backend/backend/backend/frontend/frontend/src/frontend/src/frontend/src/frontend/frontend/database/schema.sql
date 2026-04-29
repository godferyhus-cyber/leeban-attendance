-- Complete database schema for Supabase

-- Staff members table
CREATE TABLE IF NOT EXISTS staff_members (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) UNIQUE NOT NULL,
    name VARCHAR(100),
    department VARCHAR(50),
    role VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Insert sample staff (add all your staff here)
INSERT INTO staff_members (phone_number, name, department) VALUES
('whatsapp:+94770248494', 'Staff 1', 'Operations'),
('whatsapp:+94778677893', 'Staff 2', 'Field'),
('whatsapp:+94759025349', 'Staff 3', 'Field')
ON CONFLICT (phone_number) DO NOTHING;

-- Attendance logs
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

-- Daily movements
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

-- Daily summary
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_attendance_staff_date ON attendance_logs(staff_id, DATE(timestamp));
CREATE INDEX IF NOT EXISTS idx_movements_staff_date ON daily_movements(staff_id, date);
CREATE INDEX IF NOT EXISTS idx_summary_staff_date ON session_daily_summary(staff_id, date);
