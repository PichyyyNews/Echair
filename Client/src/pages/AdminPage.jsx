import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import { 
    FiUsers, FiBook, FiActivity, FiSettings, FiArrowLeft, FiShield, 
    FiDatabase, FiRefreshCw, FiSearch, FiCheck, FiX, FiEdit2, FiTrash2,
    FiLock, FiMail, FiServer, FiKey, FiChevronLeft, FiChevronRight,
    FiAlertCircle, FiUserCheck, FiUserX
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

    // Data states for views
    const [stats, setStats] = useState(null);
    const [usersList, setUsersList] = useState([]);
    const [classesList, setClassesList] = useState([]);
    const [systemSettings, setSystemSettings] = useState({
        maintenanceMode: false,
        allowRegistration: true,
        sessionTimeout: 1440,
        email: { user: '', service: 'gmail', enabled: false }
    });

    // Pagination & Filter States for Users
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0);
    const limit = 50;
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [searchQuery, setSearchQuery] = useState('');

    // Modal States
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editFormData, setEditFormData] = useState({
        id: '',
        displayName: '',
        email: '',
        password: '',
        role: 'user',
        isSuspended: false
    });
    const [isSavingUser, setIsSavingUser] = useState(false);

    // Classroom details modal
    const [isClassModalOpen, setIsClassModalOpen] = useState(false);
    const [viewingUser, setViewingUser] = useState(null);
    const [modalClassType, setModalClassType] = useState('created'); // 'created' | 'enrolled'

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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

    // 2. Fetch Users List with 50 per page & multi-filter
    const fetchUsers = useCallback(async (authToken, targetPage = 1, search = '', role = 'all', status = 'all') => {
        try {
            const queryParams = new URLSearchParams({
                page: targetPage,
                limit: 50,
                search: search.trim(),
                role,
                status
            });
            const res = await axios.get(`${API_BASE_URL}/api/admin/users?${queryParams.toString()}`, {
                headers: { 'x-auth-token': authToken }
            });
            setUsersList(res.data.users || []);
            if (res.data.pagination) {
                setPage(res.data.pagination.current);
                setTotalPages(res.data.pagination.total);
                setTotalUsers(res.data.pagination.totalItems);
            }
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
            await fetchUsers(token, page, searchQuery, roleFilter, statusFilter);
        } else if (activeTab === 'classes') {
            await fetchAllAdminClassrooms(token, searchQuery);
        } else if (activeTab === 'settings') {
            await fetchSystemSettings(token);
        }
        setLoading(false);
        setRefreshing(false);
    }, [token, activeTab, page, searchQuery, roleFilter, statusFilter, refreshProfile, fetchClassrooms, fetchAdminStats, fetchUsers, fetchAllAdminClassrooms, fetchSystemSettings]);

    useEffect(() => {
        setPage(1);
        setSearchQuery('');
        loadCurrentTabData();
    }, [activeTab]);

    // Open User Edit Modal
    const handleOpenEditModal = (targetUser) => {
        setEditFormData({
            id: targetUser._id,
            displayName: targetUser.displayName || '',
            email: targetUser.email || '',
            password: '', // Blank initially
            role: targetUser.role || 'user',
            isSuspended: Boolean(targetUser.isSuspended)
        });
        setIsEditModalOpen(true);
    };

    // Generate Random Password
    const handleGeneratePassword = () => {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
        let pass = '';
        for (let i = 0; i < 10; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        setEditFormData(prev => ({ ...prev, password: pass }));
    };

    // Save User Edits
    const handleSaveUserEdit = async (e) => {
        e.preventDefault();
        if (!editFormData.email) {
            Swal.fire('ข้อผิดพลาด', 'กรุณาระบุอีเมล', 'warning');
            return;
        }

        setIsSavingUser(true);
        try {
            const payload = {
                displayName: editFormData.displayName,
                email: editFormData.email,
                role: editFormData.role,
                isSuspended: editFormData.isSuspended
            };
            if (editFormData.password.trim() !== '') {
                payload.password = editFormData.password.trim();
            }

            await axios.put(`${API_BASE_URL}/api/admin/users/${editFormData.id}`, payload, {
                headers: { 'x-auth-token': token }
            });

            Swal.fire({
                title: 'สำเร็จ',
                text: 'อัปเดตข้อมูลผู้ใช้งานเรียบร้อยแล้ว',
                icon: 'success',
                timer: 1500,
                showConfirmButton: false
            });

            setIsEditModalOpen(false);
            fetchUsers(token, page, searchQuery, roleFilter, statusFilter);
        } catch (err) {
            Swal.fire('เกิดข้อผิดพลาด', err.response?.data?.msg || 'ไม่สามารถอัปเดตข้อมูลได้', 'error');
        } finally {
            setIsSavingUser(false);
        }
    };

    // Open Classrooms Detail Modal
    const handleOpenClassModal = (targetUser, type) => {
        setViewingUser(targetUser);
        setModalClassType(type);
        setIsClassModalOpen(true);
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
                        {/* 2. จัดการผู้ใช้ (Users) - 50 ต่อหน้า, กรอง, แก้ไขข้อมูล, ระงับบัญชี */}
                        {/* ============================================================ */}
                        {activeTab === 'users' && (
                            <div>
                                <div className="admin-header">
                                    <div className="admin-header-left">
                                        <div className="admin-title-row">
                                            <h1 className="admin-title">👥 จัดการผู้ใช้ (User Management)</h1>
                                            <span className="admin-badge">
                                                ทั้งหมด {totalUsers} บัญชี (แสดง 50 คน/หน้า)
                                            </span>
                                        </div>
                                        <p className="admin-subtitle">
                                            ค้นหา ปรับปรุงชื่อ อีเมล รหัสผ่าน ระงับบัญชี และตรวจสอบห้องเรียนที่เกี่ยวข้อง
                                        </p>
                                    </div>
                                    <div className="admin-header-actions">
                                        <button 
                                            className="admin-btn admin-btn-primary" 
                                            onClick={() => fetchUsers(token, page, searchQuery, roleFilter, statusFilter)} 
                                            disabled={refreshing}
                                        >
                                            <FiRefreshCw className={refreshing ? 'animate-spin' : ''} /> รีเฟรชรายชื่อ
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-content-section">
                                    {/* Search & Filter Toolbar */}
                                    <div className="admin-toolbar">
                                        <div className="admin-search-wrapper">
                                            <FiSearch className="admin-search-icon" />
                                            <input
                                                type="text"
                                                className="admin-search-input"
                                                placeholder="ค้นหาตามชื่อ หรือ อีเมล..."
                                                value={searchQuery}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setSearchQuery(val);
                                                    setPage(1);
                                                    fetchUsers(token, 1, val, roleFilter, statusFilter);
                                                }}
                                            />
                                        </div>

                                        <div className="admin-filter-group">
                                            {/* Role Filter */}
                                            <select
                                                className="admin-select-filter"
                                                value={roleFilter}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setRoleFilter(val);
                                                    setPage(1);
                                                    fetchUsers(token, 1, searchQuery, val, statusFilter);
                                                }}
                                            >
                                                <option value="all">บทบาท: ทั้งหมด</option>
                                                <option value="admin">เฉพาะ Admin</option>
                                                <option value="user">เฉพาะ User</option>
                                            </select>

                                            {/* Status Filter */}
                                            <select
                                                className="admin-select-filter"
                                                value={statusFilter}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setStatusFilter(val);
                                                    setPage(1);
                                                    fetchUsers(token, 1, searchQuery, roleFilter, val);
                                                }}
                                            >
                                                <option value="all">สถานะ: ทั้งหมด</option>
                                                <option value="active">ปกติ (Active)</option>
                                                <option value="suspended">ระงับการใช้งาน (Suspended)</option>
                                            </select>
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
                                                    <th>สถานะบัญชี</th>
                                                    <th>ห้องเรียน</th>
                                                    <th>เข้าสู่ระบบล่าสุด</th>
                                                    <th>การจัดการ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {usersList.length > 0 ? (
                                                    usersList.map((u) => {
                                                        const createdCount = Array.isArray(u.createdClasses) ? u.createdClasses.length : 0;
                                                        const enrolledCount = Array.isArray(u.enrolledClasses) ? u.enrolledClasses.length : 0;
                                                        const isUserSuspended = Boolean(u.isSuspended);

                                                        return (
                                                            <tr key={u._id} style={{ backgroundColor: isUserSuspended ? '#fff5f5' : 'transparent' }}>
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
                                                                    <span className={`status-badge ${isUserSuspended ? 'suspended' : 'active'}`}>
                                                                        {isUserSuspended ? <><FiUserX /> ถูกระงับ</> : <><FiUserCheck /> ปกติ</>}
                                                                    </span>
                                                                </td>
                                                                <td>
                                                                    <div className="class-chip-group">
                                                                        <button
                                                                            className="class-chip created"
                                                                            onClick={() => handleOpenClassModal(u, 'created')}
                                                                            title="คลิกเพื่อดูห้องเรียนที่สร้าง"
                                                                        >
                                                                            <FiBook size={12} /> สร้าง {createdCount} ห้อง
                                                                        </button>
                                                                        <button
                                                                            className="class-chip enrolled"
                                                                            onClick={() => handleOpenClassModal(u, 'enrolled')}
                                                                            title="คลิกเพื่อดูห้องเรียนที่เข้าร่วม"
                                                                        >
                                                                            เข้าร่วม {enrolledCount} ห้อง
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                                <td>
                                                                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString('th-TH') : 'ยังไม่มีประวัติ'}
                                                                </td>
                                                                <td>
                                                                    <button
                                                                        className="admin-action-btn-sm"
                                                                        onClick={() => handleOpenEditModal(u)}
                                                                        title="แก้ไขชื่อ อีเมล รหัสผ่าน หรือระงับบัญชี"
                                                                    >
                                                                        <FiEdit2 size={12} /> แก้ไข / จัดการ
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })
                                                ) : (
                                                    <tr>
                                                        <td colSpan="7" className="admin-empty-state">
                                                            {refreshing ? 'กำลังโหลดข้อมูล...' : 'ไม่พบข้อมูลผู้ใช้งานที่ตรงตามเงื่อนไข'}
                                                        </td>
                                                    </tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Pagination Controls */}
                                    <div className="admin-pagination">
                                        <div className="admin-pagination-info">
                                            แสดงหน้า {page} จาก {totalPages} หน้า (ทั้งหมด {totalUsers} บัญชี)
                                        </div>
                                        <div className="admin-pagination-actions">
                                            <button
                                                className="admin-page-btn"
                                                disabled={page <= 1 || refreshing}
                                                onClick={() => {
                                                    const newPage = page - 1;
                                                    setPage(newPage);
                                                    fetchUsers(token, newPage, searchQuery, roleFilter, statusFilter);
                                                }}
                                            >
                                                <FiChevronLeft /> ก่อนหน้า
                                            </button>
                                            <button
                                                className="admin-page-btn"
                                                disabled={page >= totalPages || refreshing}
                                                onClick={() => {
                                                    const newPage = page + 1;
                                                    setPage(newPage);
                                                    fetchUsers(token, newPage, searchQuery, roleFilter, statusFilter);
                                                }}
                                            >
                                                ถัดไป <FiChevronRight />
                                            </button>
                                        </div>
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

            {/* ============================================================ */}
            {/* Modal: แก้ไขข้อมูลผู้ใช้ และระงับบัญชี (User Edit Modal) */}
            {/* ============================================================ */}
            {isEditModalOpen && (
                <div className="admin-modal-overlay" onClick={() => setIsEditModalOpen(false)}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h3>แก้ไขข้อมูลและสิทธิ์ผู้ใช้งาน</h3>
                            <button className="admin-modal-close" onClick={() => setIsEditModalOpen(false)}>
                                <FiX />
                            </button>
                        </div>
                        <form onSubmit={handleSaveUserEdit}>
                            <div className="admin-modal-body">
                                
                                <div className="admin-form-group">
                                    <label className="admin-form-label">ชื่อที่แสดง (Display Name)</label>
                                    <input
                                        type="text"
                                        className="admin-form-input"
                                        value={editFormData.displayName}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, displayName: e.target.value }))}
                                        placeholder="ระบุชื่อผู้ใช้..."
                                    />
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">อีเมล (Email)</label>
                                    <input
                                        type="email"
                                        required
                                        className="admin-form-input"
                                        value={editFormData.email}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, email: e.target.value }))}
                                        placeholder="ระบุอีเมล..."
                                    />
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">กำหนดรหัสผ่านใหม่ (ปล่อยว่างถ้าไม่ต้องการเปลี่ยน)</label>
                                    <div className="admin-password-row">
                                        <input
                                            type="text"
                                            className="admin-form-input"
                                            value={editFormData.password}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, password: e.target.value }))}
                                            placeholder="กรอกรหัสผ่านใหม่อย่างน้อย 6 ตัวอักษร..."
                                        />
                                        <button
                                            type="button"
                                            className="admin-btn-random"
                                            onClick={handleGeneratePassword}
                                            title="สุ่มรหัสผ่านอัตโนมัติ"
                                        >
                                            <FiKey /> สุ่มรหัส
                                        </button>
                                    </div>
                                </div>

                                <div className="admin-form-group">
                                    <label className="admin-form-label">บทบาทผู้ใช้งาน (Role)</label>
                                    <select
                                        className="admin-form-select"
                                        value={editFormData.role}
                                        onChange={(e) => setEditFormData(prev => ({ ...prev, role: e.target.value }))}
                                    >
                                        <option value="user">ผู้ใช้งานทั่วไป (User)</option>
                                        <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                                    </select>
                                </div>

                                <hr style={{ border: 'none', borderTop: '1px solid #e5e7eb', margin: '8px 0' }} />

                                {/* Suspension Toggle */}
                                <div style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '12px 14px',
                                    backgroundColor: editFormData.isSuspended ? '#fef2f2' : '#f9fafb',
                                    borderRadius: '8px',
                                    border: `1px solid ${editFormData.isSuspended ? '#fecaca' : '#e5e7eb'}`
                                }}>
                                    <div>
                                        <strong style={{ color: editFormData.isSuspended ? '#dc2626' : '#1f2937', fontSize: '14px' }}>
                                            {editFormData.isSuspended ? '⚠️ ระงับการใช้งานบัญชีนี้' : 'สถานะบัญชีปกติ'}
                                        </strong>
                                        <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#6b7280' }}>
                                            {editFormData.isSuspended ? 'ผู้ใช้จะถูกตัดเซสชันและไม่สามารถเข้าสู่ระบบได้' : 'ผู้ใช้สามารถเข้าสู่ระบบและใช้งานได้ตามปกติ'}
                                        </p>
                                    </div>
                                    <label className="admin-toggle-switch">
                                        <input
                                            type="checkbox"
                                            checked={editFormData.isSuspended}
                                            onChange={(e) => setEditFormData(prev => ({ ...prev, isSuspended: e.target.checked }))}
                                        />
                                        <span className="admin-slider" style={{ backgroundColor: editFormData.isSuspended ? '#dc2626' : undefined }}></span>
                                    </label>
                                </div>

                            </div>
                            <div className="admin-modal-footer">
                                <button
                                    type="button"
                                    className="admin-btn admin-btn-secondary"
                                    onClick={() => setIsEditModalOpen(false)}
                                    disabled={isSavingUser}
                                >
                                    ยกเลิก
                                </button>
                                <button
                                    type="submit"
                                    className="admin-btn admin-btn-primary"
                                    disabled={isSavingUser}
                                >
                                    {isSavingUser ? 'กำลังบันทึก...' : 'บันทึกข้อมูล'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ============================================================ */}
            {/* Modal: รายละเอียดห้องเรียนของผู้ใช้ (Created / Enrolled) */}
            {/* ============================================================ */}
            {isClassModalOpen && viewingUser && (
                <div className="admin-modal-overlay" onClick={() => setIsClassModalOpen(false)}>
                    <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="admin-modal-header">
                            <h3>
                                {modalClassType === 'created' ? '📚 ห้องเรียนที่สร้างโดย' : '🎒 ห้องเรียนที่เข้าร่วมโดย'}{' '}
                                {viewingUser.displayName || viewingUser.email}
                            </h3>
                            <button className="admin-modal-close" onClick={() => setIsClassModalOpen(false)}>
                                <FiX />
                            </button>
                        </div>
                        <div className="admin-modal-body">
                            {(() => {
                                const list = modalClassType === 'created' 
                                    ? (viewingUser.createdClasses || []) 
                                    : (viewingUser.enrolledClasses || []);

                                if (!list || list.length === 0) {
                                    return (
                                        <div className="admin-empty-state">
                                            {modalClassType === 'created' 
                                                ? 'ผู้ใช้นี้ยังไม่ได้สร้างห้องเรียนใดๆ' 
                                                : 'ผู้ใช้นี้ยังไม่ได้เข้าร่วมห้องเรียนใดๆ'}
                                        </div>
                                    );
                                }

                                return (
                                    <div className="class-detail-list">
                                        {list.map((cls, idx) => (
                                            <div key={cls._id || idx} className="class-detail-item">
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <div style={{
                                                        width: '14px',
                                                        height: '14px',
                                                        borderRadius: '50%',
                                                        backgroundColor: cls.color || '#369D07'
                                                    }}></div>
                                                    <div>
                                                        <div className="class-detail-name">{cls.name || 'ไม่มีชื่อห้อง'}</div>
                                                        <div style={{ fontSize: '11px', color: '#6b7280' }}>
                                                            {cls.isPublic ? 'ห้องสาธารณะ' : 'ห้องส่วนตัว'}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <span className="class-detail-code">
                                                        รหัส: {cls.classCode || '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                        <div className="admin-modal-footer">
                            <button
                                className="admin-btn admin-btn-secondary"
                                onClick={() => setIsClassModalOpen(false)}
                            >
                                ปิด
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default AdminPage;
