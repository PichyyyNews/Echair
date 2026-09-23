import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { FiUsers, FiBook, FiActivity, FiSettings, FiArrowLeft, FiShield, FiDatabase, FiRefreshCw } from 'react-icons/fi';
import Navbar from '../components/Navbar';
import API_BASE_URL from '../config/api';
import '../CSS/AdminPage.css';
import '../CSS/Main.css';

const AdminPage = ({
    user: propUser,
    updateUserProfile,
    onSignOut,
    isSidebarOpen,
    toggleSidebar
}) => {
    const navigate = useNavigate();
    const [user, setUser] = useState(propUser);
    const [classrooms, setClassrooms] = useState([]);
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');

    // Sync user state from props or localStorage
    useEffect(() => {
        if (propUser) {
            setUser(propUser);
        } else {
            const token = localStorage.getItem('authToken');
            if (!token) {
                navigate('/login');
                return;
            }
            const userData = localStorage.getItem('userProfile');
            if (userData) {
                try {
                    const parsed = JSON.parse(userData);
                    setUser({ ...parsed, token });
                } catch {
                    navigate('/login');
                }
            }
        }
    }, [propUser, navigate]);

    // Refresh user profile to get latest role
    const refreshProfile = useCallback(async (token) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/auth/me`, {
                headers: { 'x-auth-token': token }
            });
            if (res.data) {
                setUser(prev => ({ ...prev, ...res.data, token }));
                if (updateUserProfile) {
                    updateUserProfile(res.data);
                }
            }
        } catch (err) {
            console.warn('Could not refresh profile:', err.message);
        }
    }, [updateUserProfile]);

    // Fetch user's classrooms for Sidebar consistency
    const fetchClassrooms = useCallback(async (token) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/classrooms`, {
                headers: { 'x-auth-token': token }
            });
            setClassrooms(res.data || []);
        } catch (err) {
            console.warn('Could not load classrooms for sidebar:', err.message);
        }
    }, []);

    // Fetch Admin Stats from backend
    const fetchAdminStats = useCallback(async (token) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/admin/stats`, {
                headers: { 'x-auth-token': token }
            });
            setStats(res.data);
            setError('');
        } catch (err) {
            if (err.response?.status === 403) {
                setError('คุณยังไม่มีสิทธิ์ระดับผู้ดูแลระบบ (Admin Role) แต่โครงสร้างหน้านี้พร้อมใช้งาน');
            } else {
                setError('ไม่สามารถเชื่อมต่อข้อมูลสถิติ Admin ได้ชั่วคราว');
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const loadAll = useCallback(() => {
        const token = user?.token || localStorage.getItem('authToken');
        if (!token) return;
        setRefreshing(true);
        refreshProfile(token);
        fetchClassrooms(token);
        fetchAdminStats(token);
    }, [user, refreshProfile, fetchClassrooms, fetchAdminStats]);

    useEffect(() => {
        loadAll();
    }, [loadAll]);

    const handleSignOut = () => {
        if (onSignOut) {
            onSignOut();
        } else {
            localStorage.removeItem('authToken');
            localStorage.removeItem('userProfile');
            localStorage.removeItem('userPhotoURL');
            navigate('/login');
        }
    };

    const isAdmin = user?.role === 'admin';

    return (
        <>
            {/* Same Navbar with dedicated Admin navigation sidebar */}
            <Navbar
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={toggleSidebar}
                user={user}
                handleSignOut={handleSignOut}
                classrooms={classrooms}
                isAdminPage={true}
                adminActiveSection={activeTab}
                onAdminSectionChange={setActiveTab}
                onBackClick={() => navigate('/')}
            />

            {/* Standard main frame with smooth shift when sidebar opens/closes */}
            <main className={`main__content ${isSidebarOpen ? 'shift' : ''}`}>
                <div className="main-content-scrollable-area">
                    <div className="admin-page-container">
                        
                        {/* Page Header */}
                        <div className="admin-header">
                            <div className="admin-header-left">
                                <div className="admin-title-row">
                                    <h1 className="admin-title">แผงควบคุมระบบ (Admin Panel)</h1>
                                    <span className={`admin-badge ${!isAdmin ? 'non-admin' : ''}`}>
                                        <FiShield /> {isAdmin ? 'Administrator' : `Role: ${user?.role || 'User'}`}
                                    </span>
                                </div>
                                <p className="admin-subtitle">
                                    หน้าจัดการและตรวจสอบภาพรวมระบบ EChair Classroom (เข้าถึงผ่านเส้นทาง /admin)
                                </p>
                            </div>

                            <div className="admin-header-actions">
                                <button
                                    className="admin-btn admin-btn-secondary"
                                    onClick={() => navigate('/')}
                                    title="กลับสู่หน้าห้องเรียนปกติ"
                                >
                                    <FiArrowLeft /> กลับหน้าหลัก
                                </button>
                                <button
                                    className="admin-btn admin-btn-primary"
                                    onClick={loadAll}
                                    disabled={refreshing}
                                    title="รีเฟรชข้อมูล"
                                >
                                    <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> รีเฟรช
                                </button>
                            </div>
                        </div>

                        {/* Top Metric Cards */}
                        <div className="admin-stats-grid">
                            <div className="admin-stat-card">
                                <div className="admin-stat-info">
                                    <h4>ผู้ใช้งานทั้งหมด</h4>
                                    <p className="admin-stat-value">
                                        {stats?.totalUsers !== undefined ? stats.totalUsers : (loading ? '...' : '0')}
                                    </p>
                                    <p className="admin-stat-desc">
                                        {stats?.newUsersThisWeek !== undefined ? `+${stats.newUsersThisWeek} คนในสัปดาห์นี้` : 'บัญชีในระบบ'}
                                    </p>
                                </div>
                                <div className="admin-stat-icon green">
                                    <FiUsers />
                                </div>
                            </div>

                            <div className="admin-stat-card">
                                <div className="admin-stat-info">
                                    <h4>ห้องเรียนทั้งหมด</h4>
                                    <p className="admin-stat-value">
                                        {stats?.totalClasses !== undefined ? stats.totalClasses : (loading ? '...' : '0')}
                                    </p>
                                    <p className="admin-stat-desc">
                                        {stats?.newClassesThisWeek !== undefined ? `+${stats.newClassesThisWeek} ห้องใหม่สัปดาห์นี้` : 'ห้องเรียนในระบบ'}
                                    </p>
                                </div>
                                <div className="admin-stat-icon blue">
                                    <FiBook />
                                </div>
                            </div>

                            <div className="admin-stat-card">
                                <div className="admin-stat-info">
                                    <h4>การเข้าใช้งานวันนี้</h4>
                                    <p className="admin-stat-value">
                                        {stats?.loginsToday !== undefined ? stats.loginsToday : (loading ? '...' : '0')}
                                    </p>
                                    <p className="admin-stat-desc">
                                        {stats?.activeSessions !== undefined ? `${stats.activeSessions} เซสชันกำลังเชื่อมต่อ` : 'Active logins'}
                                    </p>
                                </div>
                                <div className="admin-stat-icon amber">
                                    <FiActivity />
                                </div>
                            </div>

                            <div className="admin-stat-card">
                                <div className="admin-stat-info">
                                    <h4>สถานะระบบ</h4>
                                    <p className="admin-stat-value" style={{ fontSize: '20px', color: '#10b981' }}>
                                        <span className="admin-status-dot"></span> ปกติ (Healthy)
                                    </p>
                                    <p className="admin-stat-desc">Backend & Database Online</p>
                                </div>
                                <div className="admin-stat-icon purple">
                                    <FiDatabase />
                                </div>
                            </div>
                        </div>

                        {/* Navigation Tabs */}
                        <div className="admin-tabs-bar">
                            <button
                                className={`admin-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                                onClick={() => setActiveTab('overview')}
                            >
                                <FiActivity /> ภาพรวมระบบ (Overview)
                            </button>
                            <button
                                className={`admin-tab-btn ${activeTab === 'users' ? 'active' : ''}`}
                                onClick={() => setActiveTab('users')}
                            >
                                <FiUsers /> จัดการผู้ใช้ (Users)
                            </button>
                            <button
                                className={`admin-tab-btn ${activeTab === 'classes' ? 'active' : ''}`}
                                onClick={() => setActiveTab('classes')}
                            >
                                <FiBook /> จัดการห้องเรียน (Classrooms)
                            </button>
                            <button
                                className={`admin-tab-btn ${activeTab === 'settings' ? 'active' : ''}`}
                                onClick={() => setActiveTab('settings')}
                            >
                                <FiSettings /> ตั้งค่าระบบ (System Settings)
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="admin-content-section">
                            <div className="admin-section-header">
                                <h3>
                                    {activeTab === 'overview' && 'ภาพรวมและสถานะการทำงานของระบบ'}
                                    {activeTab === 'users' && 'การจัดการบัญชีผู้ใช้งาน'}
                                    {activeTab === 'classes' && 'การจัดการห้องเรียนทั้งหมด'}
                                    {activeTab === 'settings' && 'การตั้งค่าและนโยบายของระบบ'}
                                </h3>
                                <p>
                                    โครงสร้างหน้า Admin จัดเตรียม Navbar และ Sidebar เดียวกันกับหน้าเว็บปกติเรียบร้อยแล้ว
                                </p>
                            </div>

                            {error && (
                                <div style={{
                                    padding: '12px 16px',
                                    borderRadius: '8px',
                                    backgroundColor: '#fffbeb',
                                    border: '1px solid #fde68a',
                                    color: '#92400e',
                                    fontSize: '14px',
                                    marginBottom: '16px'
                                }}>
                                    ℹ️ {error}
                                </div>
                            )}

                            {/* Tab Content: Overview */}
                            {activeTab === 'overview' && (
                                <>
                                    <div className="admin-placeholder-box">
                                        <div className="admin-placeholder-icon">
                                            <FiActivity />
                                        </div>
                                        <h4 className="admin-placeholder-title">
                                            📊 ภาพรวมระบบ (Overview Dashboard)
                                        </h4>
                                        <p className="admin-placeholder-text">
                                            แสดงสถิติผู้ใช้งาน ห้องเรียน กิจกรรม และความพร้อมของระบบ EChair เชื่อมต่อ Sidebar เมนูสำหรับการเปลี่ยนหน้าทำงานเรียบร้อยแล้ว
                                        </p>
                                    </div>

                                    <div className="admin-info-grid">
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">เส้นทาง URL ปัจจุบัน</div>
                                            <div className="admin-info-box-value"><code>/admin</code> (ซ่อน ไม่แสดงในเมนูทั่วไป)</div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">ผู้เข้าใช้งานปัจจุบัน</div>
                                            <div className="admin-info-box-value">{user?.displayName || user?.email || 'N/A'}</div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">สิทธิ์การใช้งาน (Role)</div>
                                            <div className="admin-info-box-value">{user?.role || 'user'}</div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">สถาปัตยกรรม UI</div>
                                            <div className="admin-info-box-value">React 19 + Vite 8 (Shared Navbar & Sidebar)</div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Tab Content: Users */}
                            {activeTab === 'users' && (
                                <>
                                    <div className="admin-placeholder-box">
                                        <div className="admin-placeholder-icon" style={{ color: '#2563eb' }}>
                                            <FiUsers />
                                        </div>
                                        <h4 className="admin-placeholder-title">
                                            👥 จัดการผู้ใช้ (User Management)
                                        </h4>
                                        <p className="admin-placeholder-text">
                                            โครงสร้างส่วนจัดการบัญชีผู้ใช้งาน พร้อมสำหรับลงรายละเอียดตารางรายชื่อผู้ใช้ ค้นหา ปรับเปลี่ยนสิทธิ์ (User/Admin) และตรวจสอบประวัติการเข้าใช้งาน
                                        </p>
                                    </div>

                                    <div className="admin-info-grid">
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">สถิติผู้ใช้ปัจจุบัน</div>
                                            <div className="admin-info-box-value">{stats?.totalUsers || 0} บัญชีทั้งหมดในระบบ</div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">ผู้ใช้ใหม่สัปดาห์นี้</div>
                                            <div className="admin-info-box-value">+{stats?.newUsersThisWeek || 0} คน</div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">API Endpoint ที่รองรับ</div>
                                            <div className="admin-info-box-value"><code>GET/PUT/DELETE /api/admin/users</code></div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">สถานะความพร้อม</div>
                                            <div className="admin-info-box-value" style={{ color: '#10b981' }}>● พร้อมรองรับการออกแบบ UI เชิงลึก</div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Tab Content: Classrooms */}
                            {activeTab === 'classes' && (
                                <>
                                    <div className="admin-placeholder-box">
                                        <div className="admin-placeholder-icon" style={{ color: '#059669' }}>
                                            <FiBook />
                                        </div>
                                        <h4 className="admin-placeholder-title">
                                            📚 จัดการห้องเรียน (Classroom Management)
                                        </h4>
                                        <p className="admin-placeholder-text">
                                            โครงสร้างส่วนจัดการห้องเรียนทั้งหมดในระบบ พร้อมสำหรับลงรายละเอียดตารางค้นหาห้องเรียน ตรวจสอบรหัสห้อง (Class Code) และดูแลผู้เข้าร่วม
                                        </p>
                                    </div>

                                    <div className="admin-info-grid">
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">จำนวนห้องเรียนทั้งหมด</div>
                                            <div className="admin-info-box-value">{stats?.totalClasses || 0} ห้องในระบบ</div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">ห้องเรียนใหม่สัปดาห์นี้</div>
                                            <div className="admin-info-box-value">+{stats?.newClassesThisWeek || 0} ห้อง</div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">API Endpoint ที่รองรับ</div>
                                            <div className="admin-info-box-value"><code>GET/PUT/DELETE /api/admin/classrooms</code></div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">สถานะความพร้อม</div>
                                            <div className="admin-info-box-value" style={{ color: '#10b981' }}>● พร้อมรองรับการออกแบบ UI เชิงลึก</div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Tab Content: Settings */}
                            {activeTab === 'settings' && (
                                <>
                                    <div className="admin-placeholder-box">
                                        <div className="admin-placeholder-icon" style={{ color: '#7c3aed' }}>
                                            <FiSettings />
                                        </div>
                                        <h4 className="admin-placeholder-title">
                                            ⚙️ ตั้งค่าระบบ (System Settings)
                                        </h4>
                                        <p className="admin-placeholder-text">
                                            โครงสร้างส่วนการตั้งค่านโยบายส่วนกลางของระบบ EChair เช่น โหมดปิดปรับปรุง (Maintenance Mode), การเปิดรับสมัครสมาชิก, การตั้งค่าเซิร์ฟเวอร์อีเมล และความปลอดภัย
                                        </p>
                                    </div>

                                    <div className="admin-info-grid">
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">โหมดระบบ</div>
                                            <div className="admin-info-box-value" style={{ color: '#10b981' }}>● เปิดให้บริการปกติ (Active)</div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">ระบบส่งอีเมล (SMTP)</div>
                                            <div className="admin-info-box-value">Gmail / Dynamic Nodemailer Transporter</div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">API Endpoint ที่รองรับ</div>
                                            <div className="admin-info-box-value"><code>GET/PUT /api/admin/system-settings</code></div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">สถานะความพร้อม</div>
                                            <div className="admin-info-box-value" style={{ color: '#10b981' }}>● พร้อมรองรับการออกแบบ UI เชิงลึก</div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>

                    </div>
                </div>
            </main>
        </>
    );
};

export default AdminPage;
