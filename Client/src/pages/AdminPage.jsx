import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { 
    FiUsers, FiBook, FiActivity, FiSettings, FiArrowLeft, FiShield, 
    FiDatabase, FiRefreshCw, FiSearch, FiCheck, FiX, FiEdit2, FiTrash2,
    FiLock, FiMail, FiServer
} from 'react-icons/fi';
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
    const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'users' | 'classes' | 'settings'

    // Data states for each dedicated view
    const [stats, setStats] = useState(null);
    const [usersList, setUsersList] = useState([]);
    const [classesList, setClassesList] = useState([]);
    const [systemSettings, setSystemSettings] = useState({
        maintenanceMode: false,
        allowRegistration: true,
        sessionTimeout: 1440,
        email: { user: '', service: 'gmail', enabled: false }
    });

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [error, setError] = useState('');

    const token = user?.token || localStorage.getItem('authToken');

    // Sync user state from props or localStorage
    useEffect(() => {
        if (propUser) {
            setUser(propUser);
        } else {
            const authToken = localStorage.getItem('authToken');
            if (!authToken) {
                navigate('/login');
                return;
            }
            const userData = localStorage.getItem('userProfile');
            if (userData) {
                try {
                    const parsed = JSON.parse(userData);
                    setUser({ ...parsed, token: authToken });
                } catch {
                    navigate('/login');
                }
            }
        }
    }, [propUser, navigate]);

    // Refresh user profile to get latest role
    const refreshProfile = useCallback(async (authToken) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/auth/me`, {
                headers: { 'x-auth-token': authToken }
            });
            if (res.data) {
                setUser(prev => ({ ...prev, ...res.data, token: authToken }));
                if (updateUserProfile) {
                    updateUserProfile(res.data);
                }
            }
        } catch (err) {
            console.warn('Could not refresh profile:', err.message);
        }
    }, [updateUserProfile]);

    // Fetch user's classrooms for Sidebar
    const fetchClassrooms = useCallback(async (authToken) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/classrooms`, {
                headers: { 'x-auth-token': authToken }
            });
            setClassrooms(res.data || []);
        } catch (err) {
            console.warn('Could not load classrooms for sidebar:', err.message);
        }
    }, []);

    // 1. Fetch Overview Stats
    const fetchAdminStats = useCallback(async (authToken) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/admin/stats`, {
                headers: { 'x-auth-token': authToken }
            });
            setStats(res.data);
            setError('');
        } catch (err) {
            if (err.response?.status === 403) {
                setError('คุณยังไม่มีสิทธิ์ระดับผู้ดูแลระบบ (Admin Role)');
            } else {
                setError('ไม่สามารถเชื่อมต่อข้อมูลสถิติ Admin ได้ชั่วคราว');
            }
        }
    }, []);

    // 2. Fetch Users List
    const fetchUsers = useCallback(async (authToken, search = '') => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/admin/users?limit=50&search=${encodeURIComponent(search)}`, {
                headers: { 'x-auth-token': authToken }
            });
            setUsersList(res.data.users || []);
        } catch (err) {
            console.warn('Error fetching users:', err.message);
        }
    }, []);

    // 3. Fetch All Classrooms
    const fetchAllAdminClassrooms = useCallback(async (authToken, search = '') => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/admin/classrooms?limit=50&search=${encodeURIComponent(search)}`, {
                headers: { 'x-auth-token': authToken }
            });
            setClassesList(res.data.classrooms || []);
        } catch (err) {
            console.warn('Error fetching classrooms:', err.message);
        }
    }, []);

    // 4. Fetch System Settings
    const fetchSystemSettings = useCallback(async (authToken) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/admin/system-settings`, {
                headers: { 'x-auth-token': authToken }
            });
            if (res.data.settings) {
                setSystemSettings(res.data.settings);
            }
        } catch (err) {
            console.warn('Error fetching system settings:', err.message);
        }
    }, []);

    // Load data based on active tab
    const loadCurrentTabData = useCallback(async () => {
        if (!token) return;
        setRefreshing(true);
        refreshProfile(token);
        fetchClassrooms(token);

        if (activeTab === 'overview') {
            await fetchAdminStats(token);
        } else if (activeTab === 'users') {
            await fetchUsers(token, searchQuery);
        } else if (activeTab === 'classes') {
            await fetchAllAdminClassrooms(token, searchQuery);
        } else if (activeTab === 'settings') {
            await fetchSystemSettings(token);
        }
        setLoading(false);
        setRefreshing(false);
    }, [token, activeTab, searchQuery, refreshProfile, fetchClassrooms, fetchAdminStats, fetchUsers, fetchAllAdminClassrooms, fetchSystemSettings]);

    useEffect(() => {
        setSearchQuery('');
        loadCurrentTabData();
    }, [activeTab]);

    // Handle User Role Change
    const handleToggleRole = async (targetUser) => {
        const newRole = targetUser.role === 'admin' ? 'user' : 'admin';
        const result = await Swal.fire({
            title: `เปลี่ยนสิทธิ์ผู้ใช้งาน?`,
            text: `ต้องการเปลี่ยนสิทธิ์ของ ${targetUser.displayName || targetUser.email} เป็น "${newRole}" หรือไม่?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#369D07',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'ยืนยัน',
            cancelButtonText: 'ยกเลิก'
        });

        if (result.isConfirmed) {
            try {
                await axios.put(`${API_BASE_URL}/api/admin/users/${targetUser._id}`, {
                    role: newRole
                }, {
                    headers: { 'x-auth-token': token }
                });
                Swal.fire({
                    title: 'สำเร็จ',
                    text: `เปลี่ยนสิทธิ์เป็น ${newRole} เรียบร้อยแล้ว`,
                    icon: 'success',
                    timer: 1500,
                    showConfirmButton: false
                });
                fetchUsers(token, searchQuery);
            } catch (err) {
                Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.msg || 'ไม่สามารถเปลี่ยนสิทธิ์ได้', 'error');
            }
        }
    };

    // Handle System Settings Save
    const handleSaveSettings = async () => {
        try {
            await axios.put(`${API_BASE_URL}/api/admin/system-settings`, systemSettings, {
                headers: { 'x-auth-token': token }
            });
            Swal.fire({
                title: 'บันทึกสำเร็จ',
                text: 'อัปเดตการตั้งค่าระบบเรียบร้อยแล้ว',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });
        } catch (err) {
            Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.msg || 'ไม่สามารถบันทึกการตั้งค่าได้', 'error');
        }
    };

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

                        {error && (
                            <div style={{
                                padding: '12px 16px',
                                borderRadius: '8px',
                                backgroundColor: '#fffbeb',
                                border: '1px solid #fde68a',
                                color: '#92400e',
                                fontSize: '14px',
                                marginBottom: '20px'
                            }}>
                                ℹ️ {error}
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* 1. ภาพรวมระบบ (Overview) - แสดงผลของตัวเองเฉพาะทาง */}
                        {/* ============================================================ */}
                        {activeTab === 'overview' && (
                            <div>
                                <div className="admin-header">
                                    <div className="admin-header-left">
                                        <div className="admin-title-row">
                                            <h1 className="admin-title">📊 ภาพรวมระบบ (System Overview)</h1>
                                            <span className={`admin-badge ${!isAdmin ? 'non-admin' : ''}`}>
                                                <FiShield /> {isAdmin ? 'Administrator' : `Role: ${user?.role || 'User'}`}
                                            </span>
                                        </div>
                                        <p className="admin-subtitle">
                                            สรุปสถานะการทำงาน สถิติผู้ใช้งาน ห้องเรียน และการเชื่อมต่อภาพรวม
                                        </p>
                                    </div>
                                    <div className="admin-header-actions">
                                        <button className="admin-btn admin-btn-secondary" onClick={() => navigate('/')}>
                                            <FiArrowLeft /> กลับหน้าหลัก
                                        </button>
                                        <button className="admin-btn admin-btn-primary" onClick={loadCurrentTabData} disabled={refreshing}>
                                            <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> รีเฟรช
                                        </button>
                                    </div>
                                </div>

                                {/* Overview Metrics Grid */}
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

                                <div className="admin-content-section">
                                    <div className="admin-section-header">
                                        <h3>ข้อมูลสิ่งแวดล้อมและเซิร์ฟเวอร์</h3>
                                        <p>สถานะของระบบและการตั้งค่าเซิร์ฟเวอร์ปัจจุบัน</p>
                                    </div>
                                    <div className="admin-info-grid">
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">เส้นทาง URL ปัจจุบัน</div>
                                            <div className="admin-info-box-value"><code>/admin</code> (โหมดซ่อน)</div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">ผู้เข้าใช้งานปัจจุบัน</div>
                                            <div className="admin-info-box-value">{user?.displayName || user?.email || 'N/A'}</div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">WAU (ผู้ใช้รายสัปดาห์)</div>
                                            <div className="admin-info-box-value">{stats?.wau || 0} คน (Retention {stats?.retentionRate || 0}%)</div>
                                        </div>
                                        <div className="admin-info-box">
                                            <div className="admin-info-box-title">สถาปัตยกรรม UI</div>
                                            <div className="admin-info-box-value">React 19 + Vite 8 (Shared Navbar & Sidebar)</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* 2. จัดการผู้ใช้ (Users) - แสดงผลของตัวเองเฉพาะทาง */}
                        {/* ============================================================ */}
                        {activeTab === 'users' && (
                            <div>
                                <div className="admin-header">
                                    <div className="admin-header-left">
                                        <div className="admin-title-row">
                                            <h1 className="admin-title">👥 จัดการผู้ใช้ (User Management)</h1>
                                            <span className="admin-badge">
                                                ทั้งหมด {usersList.length} รายการ
                                            </span>
                                        </div>
                                        <p className="admin-subtitle">
                                            ค้นหา ตรวจสอบบทบาท และปรับเปลี่ยนสิทธิ์ผู้ใช้งานในระบบ
                                        </p>
                                    </div>
                                    <div className="admin-header-actions">
                                        <button className="admin-btn admin-btn-primary" onClick={() => fetchUsers(token, searchQuery)} disabled={refreshing}>
                                            <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> รีเฟรชรายชื่อ
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-content-section">
                                    {/* Search Toolbar */}
                                    <div className="admin-toolbar">
                                        <div className="admin-search-wrapper">
                                            <FiSearch className="admin-search-icon" />
                                            <input
                                                type="text"
                                                className="admin-search-input"
                                                placeholder="ค้นหาตามชื่อ หรือ อีเมล..."
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    fetchUsers(token, e.target.value);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Users Table */}
                                    <div className="admin-table-container">
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>ผู้ใช้งาน</th>
                                                    <th>อีเมล</th>
                                                    <th>บทบาท (Role)</th>
                                                    <th>เข้าใช้งานล่าสุด</th>
                                                    <th>การจัดการสิทธิ์</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {usersList.length > 0 ? (
                                                    usersList.map((u) => (
                                                        <tr key={u._id}>
                                                            <td>
                                                                <div className="admin-table-user-cell">
                                                                    {u.photoURL ? (
                                                                        <img referrerPolicy="no-referrer" src={u.photoURL} alt="" className="admin-avatar" />
                                                                    ) : (
                                                                        <div className="admin-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                                                                            {(u.displayName || u.email || '?')[0].toUpperCase()}
                                                                        </div>
                                                                    )}
                                                                    <div>
                                                                        <strong>{u.displayName || 'No Name'}</strong>
                                                                        {u._id === user?.id && <span style={{ fontSize: '11px', color: '#10b981', marginLeft: '6px' }}>(คุณ)</span>}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>{u.email}</td>
                                                            <td>
                                                                <span className={`role-badge ${u.role === 'admin' ? 'admin' : 'user'}`}>
                                                                    {u.role || 'user'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {u.lastLogin ? new Date(u.lastLogin).toLocaleString('th-TH') : 'ยังไม่มีประวัติ'}
                                                            </td>
                                                            <td>
                                                                <button
                                                                    className="admin-action-btn-sm"
                                                                    onClick={() => handleToggleRole(u)}
                                                                    title="สลับสิทธิ์ระหว่าง admin และ user"
                                                                >
                                                                    <FiEdit2 size={12} /> {u.role === 'admin' ? 'ลดเป็น User' : 'ตั้งเป็น Admin'}
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="5" className="admin-empty-state">
                                                            ไม่พบข้อมูลผู้ใช้งาน
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* 3. จัดการห้องเรียน (Classrooms) - แสดงผลของตัวเองเฉพาะทาง */}
                        {/* ============================================================ */}
                        {activeTab === 'classes' && (
                            <div>
                                <div className="admin-header">
                                    <div className="admin-header-left">
                                        <div className="admin-title-row">
                                            <h1 className="admin-title">📚 จัดการห้องเรียน (Classroom Management)</h1>
                                            <span className="admin-badge">
                                                ทั้งหมด {classesList.length} ห้อง
                                            </span>
                                        </div>
                                        <p className="admin-subtitle">
                                            ตรวจสอบห้องเรียนทั้งหมด รหัสห้องเรียน เจ้าของห้อง และจำนวนผู้เข้าร่วม
                                        </p>
                                    </div>
                                    <div className="admin-header-actions">
                                        <button className="admin-btn admin-btn-primary" onClick={() => fetchAllAdminClassrooms(token, searchQuery)} disabled={refreshing}>
                                            <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> รีเฟรชห้องเรียน
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-content-section">
                                    {/* Search Toolbar */}
                                    <div className="admin-toolbar">
                                        <div className="admin-search-wrapper">
                                            <FiSearch className="admin-search-icon" />
                                            <input
                                                type="text"
                                                className="admin-search-input"
                                                placeholder="ค้นหาชื่อห้องเรียน หรือ รหัสห้อง (Class Code)..."
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    setSearchQuery(e.target.value);
                                                    fetchAllAdminClassrooms(token, e.target.value);
                                                }}
                                            />
                                        </div>
                                    </div>

                                    {/* Classrooms Table */}
                                    <div className="admin-table-container">
                                        <table className="admin-table">
                                            <thead>
                                                <tr>
                                                    <th>ชื่อห้องเรียน</th>
                                                    <th>รหัสห้อง (Code)</th>
                                                    <th>ผู้สร้าง (Creator)</th>
                                                    <th>จำนวนนักเรียน</th>
                                                    <th>สถานะ</th>
                                                    <th>วันที่สร้าง</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {classesList.length > 0 ? (
                                                    classesList.map((c) => (
                                                        <tr key={c._id}>
                                                            <td>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                    <div style={{
                                                                        width: '12px',
                                                                        height: '12px',
                                                                        borderRadius: '50%',
                                                                        backgroundColor: c.color || '#369D07'
                                                                    }}></div>
                                                                    <div>
                                                                        <strong>{c.name}</strong>
                                                                        {c.subname && <span style={{ color: '#6b7280', fontSize: '12px', marginLeft: '6px' }}>({c.subname})</span>}
                                                                    </div>
                                                                </div>
                                                            </td>
                                                            <td>
                                                                <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>
                                                                    {c.classCode}
                                                                </code>
                                                            </td>
                                                            <td>
                                                                {c.owner ? (c.owner.displayName || c.owner.email) : 'ไม่มีข้อมูล'}
                                                            </td>
                                                            <td>
                                                                {c.participantCount || 0} คน
                                                            </td>
                                                            <td>
                                                                <span className={`role-badge ${c.isPublic ? 'admin' : 'user'}`}>
                                                                    {c.isPublic ? 'สาธารณะ' : 'ส่วนตัว'}
                                                                </span>
                                                            </td>
                                                            <td>
                                                                {c.createdAt ? new Date(c.createdAt).toLocaleDateString('th-TH') : '-'}
                                                            </td>
                                                        </tr>
                                                    ))
                                                ) : (
                                                    <tr>
                                                        <td colSpan="6" className="admin-empty-state">
                                                            ไม่พบห้องเรียนที่ค้นหา
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ============================================================ */}
                        {/* 4. ตั้งค่าระบบ (System Settings) - แสดงผลของตัวเองเฉพาะทาง */}
                        {/* ============================================================ */}
                        {activeTab === 'settings' && (
                            <div>
                                <div className="admin-header">
                                    <div className="admin-header-left">
                                        <div className="admin-title-row">
                                            <h1 className="admin-title">⚙️ ตั้งค่าระบบ (System Settings)</h1>
                                            <span className="admin-badge">
                                                นโยบายและการทำงานส่วนกลาง
                                            </span>
                                        </div>
                                        <p className="admin-subtitle">
                                            กำหนดค่าความปลอดภัย นโยบายการเข้าใช้งาน และการเชื่อมต่อบริการ
                                        </p>
                                    </div>
                                    <div className="admin-header-actions">
                                        <button className="admin-btn admin-btn-primary" onClick={handleSaveSettings}>
                                            <FiCheck /> บันทึกการตั้งค่า
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-content-section">
                                    <div className="admin-settings-group">
                                        
                                        {/* Maintenance Mode */}
                                        <div className="admin-setting-item">
                                            <div className="admin-setting-label">
                                                <h4>โหมดปิดปรับปรุงระบบ (Maintenance Mode)</h4>
                                                <p>เมื่อเปิดใช้งาน เฉพาะ Admin เท่านั้นที่สามารถเข้าถึงระบบได้</p>
                                            </div>
                                            <label className="admin-toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={!!systemSettings.maintenanceMode}
                                                    onChange={(e) => setSystemSettings(prev => ({
                                                        ...prev,
                                                        maintenanceMode: e.target.checked
                                                    }))}
                                                />
                                                <span className="admin-slider"></span>
                                            </label>
                                        </div>

                                        {/* Allow Registration */}
                                        <div className="admin-setting-item">
                                            <div className="admin-setting-label">
                                                <h4>เปิดรับการสมัครสมาชิกใหม่ (Allow Registration)</h4>
                                                <p>อนุญาตให้ผู้ใช้ทั่วไปสามารถลงทะเบียนสร้างบัญชีใหม่ได้</p>
                                            </div>
                                            <label className="admin-toggle-switch">
                                                <input
                                                    type="checkbox"
                                                    checked={systemSettings.allowRegistration !== false}
                                                    onChange={(e) => setSystemSettings(prev => ({
                                                        ...prev,
                                                        allowRegistration: e.target.checked
                                                    }))}
                                                />
                                                <span className="admin-slider"></span>
                                            </label>
                                        </div>

                                        {/* Session Timeout */}
                                        <div className="admin-setting-item">
                                            <div className="admin-setting-label">
                                                <h4>ระยะเวลาหมดอายุเซสชัน (นาที)</h4>
                                                <p>กำหนดระยะเวลาที่ระบบจะตัดการเชื่อมต่อหากไม่มีการเคลื่อนไหว</p>
                                            </div>
                                            <input
                                                type="number"
                                                className="admin-search-input"
                                                style={{ width: '120px', textAlign: 'center' }}
                                                value={systemSettings.sessionTimeout || 1440}
                                                onChange={(e) => setSystemSettings(prev => ({
                                                    ...prev,
                                                    sessionTimeout: parseInt(e.target.value) || 1440
                                                }))}
                                            />
                                        </div>

                                        {/* Email Service Status */}
                                        <div className="admin-setting-item">
                                            <div className="admin-setting-label">
                                                <h4>ระบบอีเมล (Email Notifications Service)</h4>
                                                <p>บริการส่งอีเมล OTP และรหัสยืนยันผ่าน Nodemailer / Gmail SMTP</p>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span className="role-badge admin">Active (Dynamic)</span>
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </main>
        </>
    );
};

export default AdminPage;
