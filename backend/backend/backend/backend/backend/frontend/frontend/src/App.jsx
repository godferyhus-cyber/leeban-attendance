import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { format } from 'date-fns';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

function App() {
    const [attendance, setAttendance] = useState([]);
    const [movements, setMovements] = useState([]);
    const [staff, setStaff] = useState([]);
    const [statistics, setStatistics] = useState(null);
    const [loading, setLoading] = useState(false);
    const [selectedStaff, setSelectedStaff] = useState('');
    const [view, setView] = useState('dashboard');
    const [filters, setFilters] = useState({
        startDate: '2026-03-01',
        endDate: '2026-04-30',
        department: '',
        month: '',
        week: ''
    });

    useEffect(() => {
        fetchStaff();
        fetchStatistics();
    }, []);

    useEffect(() => {
        fetchAttendance();
    }, [filters]);

    const fetchStaff = async () => {
        try {
            const res = await axios.get(`${API_URL}/staff`);
            setStaff(res.data);
        } catch (err) {
            console.error('Error fetching staff:', err);
        }
    };

    const fetchStatistics = async () => {
        try {
            const res = await axios.get(`${API_URL}/statistics`);
            setStatistics(res.data);
        } catch (err) {
            console.error('Error fetching stats:', err);
        }
    };

    const fetchAttendance = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams(filters);
            const res = await axios.get(`${API_URL}/attendance?${params}`);
            setAttendance(res.data);
        } catch (err) {
            console.error('Error fetching attendance:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMovements = async (staffId) => {
        try {
            const res = await axios.get(`${API_URL}/movements?staffId=${staffId}&startDate=${filters.startDate}&endDate=${filters.endDate}`);
            setMovements(res.data);
            setSelectedStaff(staffId);
            setView('movements');
        } catch (err) {
            console.error('Error fetching movements:', err);
        }
    };

    const handleFilterChange = (e) => {
        setFilters({ ...filters, [e.target.name]: e.target.value });
    };

    const getLateBadge = (lateMins) => {
        if (!lateMins || lateMins === 0) return <span className="badge badge-green">On Time</span>;
        if (lateMins <= 15) return <span className="badge badge-yellow">{lateMins} min late</span>;
        return <span className="badge badge-red">{lateMins} min late</span>;
    };

    // Prepare chart data
    const lateTrendData = attendance.reduce((acc, curr) => {
        const existing = acc.find(a => a.date === curr.date);
        if (existing) {
            existing.lateCount++;
            existing.totalLate += curr.late_minutes;
        } else {
            acc.push({ date: curr.date, lateCount: 1, totalLate: curr.late_minutes || 0 });
        }
        return acc;
    }, []).slice(0, 20).reverse();

    const departmentData = attendance.reduce((acc, curr) => {
        const dept = curr.department || 'Unknown';
        const existing = acc.find(a => a.department === dept);
        if (existing) {
            existing.lateDays += curr.late_minutes > 0 ? 1 : 0;
            existing.totalStaff++;
        } else {
            acc.push({ department: dept, lateDays: curr.late_minutes > 0 ? 1 : 0, totalStaff: 1 });
        }
        return acc;
    }, []);

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

    return (
        <div className="app">
            <header className="header">
                <h1>📊 LEEBAN - Attendance Dashboard</h1>
                <p>Real-time WhatsApp-integrated attendance system</p>
            </header>

            {/* Stats Cards */}
            {statistics && (
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-value">{statistics.total_staff || 0}</div>
                        <div className="stat-label">Total Staff</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{Math.round(statistics.avg_late || 0)} min</div>
                        <div className="stat-label">Avg Late</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{Math.round(statistics.total_overtime || 0)} hrs</div>
                        <div className="stat-label">Total OT</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-value">{Math.round(statistics.total_standard || 0)} hrs</div>
                        <div className="stat-label">Total Std Hrs</div>
                    </div>
                </div>
            )}

            {/* Filters */}
            <div className="filters-card">
                <div className="filters-grid">
                    <div>
                        <label>Start Date</label>
                        <input type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} />
                    </div>
                    <div>
                        <label>End Date</label>
                        <input type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} />
                    </div>
                    <div>
                        <label>Department</label>
                        <select name="department" value={filters.department} onChange={handleFilterChange}>
                            <option value="">All</option>
                            <option value="Management">Management</option>
                            <option value="Design">Design</option>
                            <option value="Production">Production</option>
                            <option value="Accounts">Accounts</option>
                            <option value="Admin">Admin</option>
                            <option value="Field">Field</option>
                        </select>
                    </div>
                    <div>
                        <label>Month</label>
                        <select name="month" value={filters.month} onChange={handleFilterChange}>
                            <option value="">All</option>
                            <option value="3">March</option>
                            <option value="4">April</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="tabs">
                <button className={view === 'dashboard' ? 'tab-active' : 'tab'} onClick={() => setView('dashboard')}>📈 Dashboard</button>
                <button className={view === 'attendance' ? 'tab-active' : 'tab'} onClick={() => setView('attendance')}>📋 Attendance</button>
                <button className={view === 'analytics' ? 'tab-active' : 'tab'} onClick={() => setView('analytics')}>📊 Analytics</button>
            </div>

            {/* Dashboard View */}
            {view === 'dashboard' && (
                <div className="dashboard-grid">
                    <div className="chart-card">
                        <h3>Late Trend (Last 20 days)</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={lateTrendData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="date" angle={-45} textAnchor="end" height={60} fontSize={10} />
                                <YAxis />
                                <Tooltip />
                                <Legend />
                                <Line type="monotone" dataKey="totalLate" stroke="#ff6b6b" name="Late Minutes" />
                                <Line type="monotone" dataKey="lateCount" stroke="#4ecdc4" name="Late Count" />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="chart-card">
                        <h3>Late by Department</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <PieChart>
                                <Pie data={departmentData} dataKey="lateDays" nameKey="department" cx="50%" cy="50%" outerRadius={100} label>
                                    {departmentData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="table-card full-width">
                        <h3>Recent Attendance</h3>
                        <div className="table-responsive">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Staff</th><th>Dept</th><th>Date</th><th>In</th><th>Out</th><th>Std Hrs</th><th>OT Hrs</th><th>Status</th><th></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {attendance.slice(0, 10).map((row, idx) => (
                                        <tr key={idx}>
                                            <td>{row.name}</td>
                                            <td>{row.department || '-'}</td>
                                            <td>{format(new Date(row.date), 'dd/MM')}</td>
                                            <td>{row.first_in ? format(new Date(row.first_in), 'hh:mm a') : '-'}</td>
                                            <td>{row.last_out ? format(new Date(row.last_out), 'hh:mm a') : '-'}</td>
                                            <td>{row.total_standard_hours?.toFixed(1) || 0}</td>
                                            <td>{row.total_overtime_hours?.toFixed(1) || 0}</td>
                                            <td>{getLateBadge(row.late_minutes)}</td>
                                            <td><button className="btn-small" onClick={() => fetchMovements(row.staff_id)}>📋</button></td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Attendance Table View */}
            {view === 'attendance' && (
                <div className="table-card">
                    <div className="table-responsive">
                        <table>
                            <thead>
                                <tr><th>Staff</th><th>Dept</th><th>Date</th><th>In</th><th>Out</th><th>Std Hrs</th><th>OT Hrs</th><th>Late</th><th>Early Out</th><th></th></tr>
                            </thead>
                            <tbody>
                                {attendance.map((row, idx) => (
                                    <tr key={idx}>
                                        <td>{row.name}</td><td>{row.department || '-'}</td>
                                        <td>{format(new Date(row.date), 'dd/MM/yyyy')}</td>
                                        <td>{row.first_in ? format(new Date(row.first_in), 'hh:mm a') : '-'}</td>
                                        <td>{row.last_out ? format(new Date(row.last_out), 'hh:mm a') : '-'}</td>
                                        <td>{row.total_standard_hours?.toFixed(1) || 0}</td>
                                        <td>{row.total_overtime_hours?.toFixed(1) || 0}</td>
                                        <td>{row.late_minutes || 0} min</td>
                                        <td>{row.early_out_minutes || 0} min</td>
                                        <td><button className="btn-small" onClick={() => fetchMovements(row.staff_id)}>Movements</button></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Analytics View */}
            {view === 'analytics' && (
                <div className="dashboard-grid">
                    <div className="chart-card">
                        <h3>Department Performance</h3>
                        <ResponsiveContainer width="100%" height={300}>
                            <BarChart data={departmentData}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="department" />
                                <YAxis />
                                <Tooltip />
                                <Bar dataKey="lateDays" fill="#ff6b6b" name="Late Days" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="stats-summary">
                        <h3>Key Insights</h3>
                        <ul>
                            <li>🔴 {attendance.filter(a => a.late_minutes > 30).length} very late entries</li>
                            <li>🟡 {attendance.filter(a => a.late_minutes > 0 && a.late_minutes <= 30).length} slightly late entries</li>
                            <li>🟢 {attendance.filter(a => !a.late_minutes || a.late_minutes === 0).length} on-time entries</li>
                            <li>⏰ Total overtime: {statistics?.total_overtime?.toFixed(1)} hours</li>
                        </ul>
                    </div>
                </div>
            )}

            {/* Movements Modal */}
            {selectedStaff && view === 'movements' && (
                <div className="modal-overlay">
                    <div className="modal">
                        <div className="modal-header">
                            <h3>Daily Movements</h3>
                            <button className="modal-close" onClick={() => { setSelectedStaff(''); setView('dashboard'); }}>&times;</button>
                        </div>
                        <div className="modal-body">
                            <table className="compact-table">
                                <thead><tr><th>Date</th><th>Time</th><th>Type</th><th>Location</th><th>Purpose</th></tr></thead>
                                <tbody>
                                    {movements.map((mov, idx) => (
                                        <tr key={idx}>
                                            <td>{format(new Date(mov.date), 'dd/MM')}</td>
                                            <td>{mov.movement_time?.slice(0, 5)}</td>
                                            <td><span className={`movement-badge ${mov.movement_type === 'IN' ? 'in' : 'out'}`}>{mov.movement_type}</span></td>
                                            <td>{mov.location || '-'}</td>
                                            <td className="purpose-cell">{mov.purpose || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            <style jsx>{`
                .app { font-family: system-ui, -apple-system, sans-serif; max-width: 1400px; margin: 0 auto; padding: 20px; background: #f5f7fb; min-height: 100vh; }
                .header { background: linear-gradient(135deg, #1a56db 0%, #1e3a8a 100%); color: white; padding: 30px; border-radius: 16px; margin-bottom: 24px; }
                .header h1 { margin: 0 0 8px 0; font-size: 28px; }
                .header p { margin: 0; opacity: 0.9; }
                .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 24px; }
                .stat-card { background: white; padding: 20px; border-radius: 12px; text-align: center; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .stat-value { font-size: 32px; font-weight: bold; color: #1a56db; }
                .stat-label { color: #6b7280; margin-top: 8px; }
                .filters-card { background: white; padding: 20px; border-radius: 12px; margin-bottom: 24px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .filters-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; }
                .filters-grid label { display: block; font-size: 12px; color: #6b7280; margin-bottom: 4px; }
                .filters-grid input, .filters-grid select { width: 100%; padding: 8px 12px; border: 1px solid #d1d5db; border-radius: 8px; font-size: 14px; }
                .tabs { display: flex; gap: 8px; margin-bottom: 24px; background: white; padding: 8px; border-radius: 12px; }
                .tab, .tab-active { padding: 10px 20px; border: none; background: none; cursor: pointer; font-size: 14px; border-radius: 8px; transition: all 0.2s; }
                .tab-active { background: #1a56db; color: white; }
                .tab:hover { background: #e5e7eb; }
                .dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(500px, 1fr)); gap: 24px; }
                .chart-card { background: white; padding: 20px; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
                .chart-card h3 { margin: 0 0 16px 0; font-size: 18px; }
                .table-card { background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1); margin-bottom: 24px; }
                .table-card h3 { padding: 20px; margin: 0; border-bottom: 1px solid #e5e7eb; }
                .full-width { grid-column: 1 / -1; }
                .table-responsive { overflow-x: auto; }
                table { width: 100%; border-collapse: collapse; font-size: 14px; }
                th, td { padding: 12px 16px; text-align: left; border-bottom: 1px solid #e5e7eb; }
                th { background: #f9fafb; font-weight: 600; color: #374151; }
                tr:hover { background: #f9fafb; }
                .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 12px; font-weight: 500; }
                .badge-green { background: #d1fae5; color: #065f46; }
                .badge-yellow { background: #fed7aa; color: #92400e; }
                .badge-red { background: #fee2e2; color: #991b1b; }
                .btn-small { background: none; border: 1px solid #d1d5db; padding: 4px 12px; border-radius: 6px; cursor: pointer; font-size: 12px; }
                .btn-small:hover { background: #f3f4f6; }
                .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 1000; }
                .modal { background: white; border-radius: 16px; width: 90%; max-width: 800px; max-height: 80vh; overflow: hidden; }
                .modal-header { padding: 16px 20px; border-bottom: 1px solid #e5e7eb; display: flex; justify-content: space-between; align-items: center; }
                .modal-close { background: none; border: none; font-size: 28px; cursor: pointer; }
                .modal-body { padding: 20px; overflow-y: auto; max-height: calc(80vh - 60px); }
                .compact-table td, .compact-table th { padding: 8px 12px; font-size: 13px; }
                .movement-badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 11px; font-weight: 600; }
                .movement-badge.in { background: #d1fae5; color: #065f46; }
                .movement-badge.out { background: #fee2e2; color: #991b1b; }
                .purpose-cell { max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
                .stats-summary { background: white; padding: 20px; border-radius: 12px; }
                .stats-summary ul { list-style: none; padding: 0; }
                .stats-summary li { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
                @media (max-width: 768px) { .dashboard-grid { grid-template-columns: 1fr; } .stats-grid { grid-template-columns: repeat(2, 1fr); } }
            `}</style>
        </div>
    );
}

export default App;
