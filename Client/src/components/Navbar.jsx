// src/component/Navbar.jsx

import React, { useState, useEffect, useRef } from "react";
import "../CSS/Navbar.css";
import icon from "../image/icon.ico";
import { FiPlus, FiLogOut, FiArrowLeft, FiShare2, FiEdit2, FiSave, FiX, FiChevronDown, FiChevronRight, FiBell, FiMenu, FiBook, FiUsers, FiActivity, FiSettings } from "react-icons/fi"; // ✨ เพิ่ม icon ใหม่
import { FaCog, FaCrown, FaLayerGroup, FaStar, FaTrophy, FaHistory, FaInfoCircle, FaCalendarCheck, FaPlay, FaClock, FaStop } from 'react-icons/fa'; // ✨ เพิ่ม icons สำหรับ sidebar
import { useNavigate, Link } from 'react-router-dom';
import { getProfileImageSrc, getCurrentUserProfileImageSrc, isGoogleUser, handleImageError } from '../utils/profileImageHelper';
import axios from 'axios';
import Swal from 'sweetalert2';
import io from 'socket.io-client';
import API_BASE_URL, { createSocketClient } from '../config/api';
import { useTranslation } from 'react-i18next'; // ✨ Add useTranslation hook


const Navbar = ({
    isSidebarOpen, toggleSidebar, user, handleSignOut, onClassActionClick, classrooms = [],
    isClassroomPage, onShareClick, classroomMembers, isAccountSettingPage,
    onPromoteMember,
    onKickMember,
    onDemoteMember,
    isCreator, isEditing, onToggleEditMode, onSavePositions, onCancelEdit, userSeatId, onLeaveSeat, classroom,
    onBackClick, // Back navigation prop
    accountActiveSection, onAccountSectionChange, // เพิ่ม props สำหรับ AccountSetting navigation
    onClassroomBackClick, // เพิ่ม props สำหรับ ClassroomPage back navigation
    isLoginPage = false, // เพิ่ม props สำหรับ Login page
    isAppSettingPage, appActiveSection, onAppSectionChange, // เพิ่ม props สำหรับ AppSettings page
    isAdminPage, adminActiveSection, onAdminSectionChange, // 🛡️ เพิ่ม props สำหรับ Admin page
    isClassDetailPage, classDetailActiveSection, onClassDetailSectionChange, // เพิ่ม props สำหรับ ClassDetail page
    isStreamPage, streamActiveSection, onStreamSectionChange, // ✨ เพิ่ม props สำหรับ Stream page
    isAssignmentDetailPage, classId, // ✨ สำหรับหน้า Assignment Detail Page

    // ✨ Teaching Session Props
    isSessionActive, sessionElapsed, onStartSession, onEndSession, formatSessionTime,

    onAddNotification, // ✨ Prop สำหรับรับฟังก์ชันเพิ่มการแจ้งเตือน
    children // ✨ Allow custom children content
}) => {
    const { t } = useTranslation(); // ✨ Apply hook
    const navigate = useNavigate();
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [hasUnread, setHasUnread] = useState(false);
    const [unreadCount, setUnreadCount] = useState(0);
    const notificationsEnabled = localStorage.getItem('notificationsEnabled') !== 'false';
    const [isCreatedByMeExpanded, setIsCreatedByMeExpanded] = useState(true);
    const [isJoinedExpanded, setIsJoinedExpanded] = useState(true);
    const [isCreatorsExpanded, setIsCreatorsExpanded] = useState(true);
    const [isParticipantsExpanded, setIsParticipantsExpanded] = useState(true);

    // Fetch Notifications
    const fetchNotifications = async () => {
        if (!user || !notificationsEnabled) return;
        try {
            const token = localStorage.getItem('authToken');
            const res = await axios.get(`${API_BASE_URL}/api/notifications`, {
                headers: { 'x-auth-token': token }
            });
            setNotifications(res.data);
            const unread = res.data.filter(n => !n.isRead).length;
            setUnreadCount(unread);
            setHasUnread(unread > 0);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    useEffect(() => {
        if (user && notificationsEnabled) {
            fetchNotifications();
        } else {
            setNotifications([]);
            setUnreadCount(0);
            setHasUnread(false);
        }
    }, [user, notificationsEnabled]);

    // Handle Mark as Read
    const markAsRead = async (id) => {
        try {
            const token = localStorage.getItem('authToken');
            await axios.put(`${API_BASE_URL}/api/notifications/${id}/read`, {}, {
                headers: { 'x-auth-token': token }
            });
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
            setHasUnread(unreadCount - 1 > 0);
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    const markAllAsRead = async () => {
        try {
            const token = localStorage.getItem('authToken');
            await axios.put(`${API_BASE_URL}/api/notifications/read-all`, {}, {
                headers: { 'x-auth-token': token }
            });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            setUnreadCount(0);
            setHasUnread(false);
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    const handleSignInClick = () => {
        navigate('/login');
    };

    const toggleDropdown = () => {
        setIsDropdownOpen(!isDropdownOpen);
        setIsNotificationOpen(false); // ปิด dropdown แจ้งเตือนเมื่อเปิดโปรไฟล์
    };

    const toggleNotificationDropdown = () => {
        setIsNotificationOpen(!isNotificationOpen);
        setIsDropdownOpen(false); // ปิด dropdown โปรไฟล์เมื่อเปิดแจ้งเตือน
    };

    // ✨ Hook สำหรับตรวจจับการเปลี่ยนแปลงของ props
    function usePrevious(value) {
        const ref = useRef();
        useEffect(() => {
            ref.current = value;
        });
        return ref.current;
    }

    const addNotification = (notification) => {
        // Here `notification` can be a string (legacy) or an object (new from socket)
        if (typeof notification === 'string') {
            // Internal legacy fallback (thou we should avoid)
            const newNotification = {
                _id: Date.now().toString(),
                message: notification,
                title: 'System',
                createdAt: new Date(),
                isRead: false
            };
            setNotifications(prev => [newNotification, ...prev]);
            setUnreadCount(prev => prev + 1);
            setHasUnread(true);
        } else {
            // It's a real notification object from DB via Socket
            setNotifications(prev => {
                // Prevent duplicate processing
                if (prev.some(n => n._id === notification._id)) return prev;
                return [notification, ...prev];
            });
            setUnreadCount(prev => prev + 1);
            setHasUnread(true);
        }
    };

    // ✨ ส่งฟังก์ชัน addNotification กลับไปให้ parent component
    useEffect(() => {
        if (onAddNotification) {
            onAddNotification(() => addNotification);
        }
    }, [onAddNotification]);

    // ✨ Global Socket Connection for Real-time Notifications
    useEffect(() => {
        if (user && user.id && notificationsEnabled) {
            const socket = createSocketClient(io, {
                auth: { userId: user.id }
            });

            socket.on('connect', () => {
                console.log('Global notification socket connected');
            });

            socket.on('new-notification', (notification) => {
                console.log('Received global notification:', notification);
                addNotification(notification);
            });

            return () => {
                socket.disconnect();
            };
        }
    }, [user, notificationsEnabled]);

    const prevUser = usePrevious(user);

    useEffect(() => {
        // ✨ ตรวจสอบถ้าผู้ใช้เพิ่งล็อกอินเข้ามา
        if (!prevUser && user) {
            // We removed local manual addNotification for login because the backend will now emit a socket event for it.
            // But if sockets aren't hooked up at App level right away, we could just re-fetch to be safe.
            fetchNotifications();
        }
    }, [user, prevUser]);

    const handleAccountSettingClick = () => {
        navigate('/account-setting');
        setIsDropdownOpen(false);
    };

    const handleAppSettingClick = () => {
        navigate('/app-settings');
        setIsDropdownOpen(false);
    };

    const handleSignOutClick = async () => {
        await handleSignOut();
        setIsDropdownOpen(false);
        window.location.reload();
    };

    const handleClassroomClick = (classId) => {
        navigate(`/classroom/${classId}`);
        toggleSidebar();
    };

    const handleBackClick = () => {
        navigate(-1);
    };

    const listItemStyle = {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flex: 1, // ✨ Change to flex: 1 to fill available space
        minWidth: 0,
        display: 'block'
    };

    const memberContainerStyle = {
        display: 'flex',
        alignItems: 'center',
        flex: 1, // ✨ Change to flex: 1
        minWidth: 0
    };

    const memberNameStyle = {
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        flex: 1,
        minWidth: 0
    };

    const crownStyle = {
        marginLeft: '8px',
        color: '#f1c40f',
        flexShrink: 0
    };

    const handleMemberMenu = (member) => {
        // ✨ แก้ไข: ตรวจสอบ isTargetCreator ให้รองรับทั้ง Object และ Array
        const creators = Array.isArray(classroomMembers.creator)
            ? classroomMembers.creator
            : [classroomMembers.creator].filter(Boolean);
        const isTargetCreator = creators.some(c => c && c._id === member._id);

        // ป้องกันไม่ให้ creator จัดการตัวเอง
        if (user.id === member._id) return;

        if (isTargetCreator) {
            // Menu for Co-Creators - เฉพาะ Original Creator เท่านั้นที่สามารถจัดการได้
            if (isOriginalCreator) {
                Swal.fire({
                    title: member.displayName,
                    showDenyButton: false,
                    showCancelButton: true,
                    confirmButtonText: t('common.save') === 'Save' ? 'Demote to Participant' : 'ลดระดับเป็นผู้เข้าร่วม', // Simplified translation mapping
                    cancelButtonText: t('common.cancel'),
                    icon: 'info',
                    confirmButtonColor: '#e74c3c',
                }).then(async (result) => {
                    if (result.isConfirmed) {
                        await onDemoteMember(member._id, member.displayName);
                    }
                });
            } else {
                // ถ้าไม่ใช่ Original Creator ให้แสดงข้อมูลเท่านั้น
                Swal.fire({
                    title: member.displayName,
                    text: t('common.save') === 'Save' ? 'This is a Co-Creator. Only the Original Creator can manage this member.' : 'นี่คือผู้สร้างร่วม เฉพาะผู้สร้างคนแรกเท่านั้นที่สามารถจัดการสมาชิกนี้ได้',
                    icon: 'info',
                    showConfirmButton: true,
                    confirmButtonText: t('common.close') === 'Close' ? 'OK' : 'ตกลง'
                });
            }
        } else {
            // Menu for Participants
            Swal.fire({
                title: member.displayName,
                showDenyButton: true,
                showCancelButton: true,
                confirmButtonText: t('common.save') === 'Save' ? 'Promote to Creator' : 'เลื่อนระดับเป็นผู้สร้าง',
                denyButtonText: t('common.save') === 'Save' ? 'Kick from Classroom' : 'เตะออกจากชั้นเรียน',
                cancelButtonText: t('common.cancel'),
                icon: 'info'
            }).then(async (result) => {
                if (result.isConfirmed) {
                    await onPromoteMember(member._id, member.displayName);
                } else if (result.isDenied && isCreator) { // Creator ทุกคนสามารถเตะได้
                    await onKickMember(member._id, member.displayName);
                }
            });
        }
    };

    // ตรวจสอบว่าผู้ใช้ปัจจุบันเป็น "ผู้สร้างห้องคนแรก" หรือไม่
    const isOriginalCreator = classroomMembers?.creator && user && classroomMembers.creator[0]?._id === user.id;

    return (
        <>
            <nav className="navbar">
                <div className="navbar__logo">
                    <button className="navbar__burger" onClick={toggleSidebar}>
                        <FiMenu size={24} />
                    </button>
                    <img referrerPolicy="no-referrer" src={icon} alt="Logo" className="navbar__logo-image" />
                    <h1 style={{ color: "#414141ff", fontSize: "24px" }}>EChair <span style={{ color: "#0aa158" , fontSize: "13px" }}> </span></h1>
                </div>

                {/* ✨ ย้ายปุ่มมาไว้ตรงกลาง Navbar เพื่อให้แสดงผลถูกต้อง */}
                <div className="navbar-center">
                    {children}
                </div>


                <div className="navbar__right">
                    {user && notificationsEnabled && (
                        <div className="navbar__notification" onClick={toggleNotificationDropdown}>
                            <FiBell size={22} />
                            {hasUnread && <span className="notification-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
                            {isNotificationOpen && (
                                <div className="notification-dropdown">
                                    <div className="notification-header">
                                        <h3>{t('navbar.notifications.header')}</h3>
                                        {hasUnread && (
                                            <button className="mark-all-read-btn" onClick={(e) => {
                                                e.stopPropagation();
                                                markAllAsRead();
                                            }}>{t('navbar.notifications.markAllRead')}</button>
                                        )}
                                    </div>
                                    <ul className="notification-list">
                                        {notifications.length > 0 ? (
                                            notifications.map(notif => (
                                                <li 
                                                    key={notif._id || notif.id} 
                                                    className={`notification-item ${notif.isRead ? '' : 'unread'}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        if (!notif.isRead) markAsRead(notif._id || notif.id);
                                                    }}
                                                >
                                                    <div className="notification-content">
                                                        <h4 className="notification-title">{notif.title}</h4>
                                                        <p>{notif.message}</p>
                                                    </div>
                                                    <span className="notification-time">
                                                        {new Date(notif.createdAt || notif.time).toLocaleString([], {
                                                            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                </li>
                                            ))
                                        ) : (
                                            <li className="notification-item empty">
                                                <p>{t('navbar.notifications.noNew')}</p>
                                            </li>
                                        )}
                                    </ul>
                                </div>
                            )}
                        </div>
                    )}
                    <div className="navbar__profile" onClick={toggleDropdown}>
                        {user ? (
                            <img referrerPolicy="no-referrer"
                                src={getCurrentUserProfileImageSrc(user.photoURL, isGoogleUser(user))}
                                alt="User Profile"
                                className="navbar-profile-image"
                                onError={handleImageError}
                            />
                        ) : !isLoginPage ? (
                            <button onClick={handleSignInClick} className="navbar__signin-button">
                                Sign In
                            </button>
                        ) : null}
                        {isDropdownOpen && user && (
                            <div className="dropdown-menu">
                                <div className="dropdown-user-info">
                                    <img referrerPolicy="no-referrer"
                                        src={getCurrentUserProfileImageSrc(user.photoURL, isGoogleUser(user))}
                                        alt="User Profile"
                                        className="dropdown-profile-image"
                                        onError={handleImageError}
                                    />
                                    <div className="user-details">
                                        <span className="user-name">{user.displayName}</span>
                                        <br />
                                        <span className="user-email">{user.email}</span>
                                    </div>
                                </div>
                                <hr style={{ border: "none", height: "1px", backgroundColor: "#dadce0", margin: "8px 0" }} />
                                <div className="dropdown-list">
                                    <span className="dropdown-item" onClick={handleAccountSettingClick}>
                                        {t('navbar.profileMenu.accountSetting')}
                                    </span>
                                    <span className="dropdown-item" onClick={handleAppSettingClick}>
                                        {t('navbar.profileMenu.appSettings')}
                                    </span>
                                    <span className="dropdown-item" onClick={handleSignOutClick}>
                                        <FiLogOut />
                                        {t('navbar.profileMenu.signOut')}
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </nav>
            <aside className={`sidebar ${isSidebarOpen ? "open" : ""}`}>
                <ul
                    className="sidebar-list"
                    style={{
                        listStyleType: 'none',
                        padding: '10px',
                        margin: '10px 0',
                        overflowY: 'auto',
                        flexGrow: 1
                    }}
                >
                    {/* ✨ เพิ่มโค้ดนี้: เพิ่มเงื่อนไขสำหรับหน้า Account Setting และ Edit Classroom */}
                    {isLoginPage ? (
                        <li className="sidebar-list-item" style={{ textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                            {t('navbar.title')}
                        </li>
                    ) : isAccountSettingPage ? (
                        <>
                            <li className="sidebar-list-item sidebar-back-button" onClick={handleBackClick}>
                                <FiArrowLeft size={18} />
                                <span>{t('navbar.sidebar.back')}</span>
                            </li>
                            <hr className="divider" style={{
                                margin: "8px 0",
                                border: "none",
                                height: "1px",
                                backgroundColor: "#e2e8f0",
                                width: "100%",
                                display: "block"
                            }} />
                            <li
                                className={`sidebar-list-item ${accountActiveSection === 'account' ? 'active' : ''}`}
                                onClick={() => onAccountSectionChange && onAccountSectionChange('account')}
                            >
                                <span>{t('navbar.accountSettings.account')}</span>
                            </li>
                            <li
                                className={`sidebar-list-item ${accountActiveSection === 'security' ? 'active' : ''}`}
                                onClick={() => onAccountSectionChange && onAccountSectionChange('security')}
                            >
                                <span>{t('navbar.accountSettings.security')}</span>
                            </li>
                        </>
                    ) : isAppSettingPage ? (
                        <>
                            <li className="sidebar-list-item sidebar-back-button" onClick={handleBackClick}>
                                <FiArrowLeft size={18} />
                                <span>{t('navbar.sidebar.back')}</span>
                            </li>
                            <hr className="divider" style={{
                                margin: "8px 0",
                                border: "none",
                                height: "1px",
                                backgroundColor: "#e2e8f0",
                                width: "100%",
                                display: "block"
                            }} />
                            <li
                                className={`sidebar-list-item ${appActiveSection === 'general' ? 'active' : ''}`}
                                onClick={() => onAppSectionChange && onAppSectionChange('general')}
                            >
                                <span>{t('navbar.appSettings.general')}</span>
                            </li>
                            <li
                                className={`sidebar-list-item ${appActiveSection === 'about' ? 'active' : ''}`}
                                onClick={() => onAppSectionChange && onAppSectionChange('about')}
                            >
                                <span>{t('navbar.appSettings.helpSupport')}</span>
                            </li>
                        </>
                    ) : isAdminPage ? (
                        <>
                            <li className="sidebar-list-item sidebar-back-button" onClick={onBackClick || handleBackClick}>
                                <FiArrowLeft size={18} />
                                <span>{t('navbar.sidebar.back') || 'กลับหน้าหลัก'}</span>
                            </li>
                            <hr className="divider" style={{
                                margin: "8px 0",
                                border: "none",
                                height: "1px",
                                backgroundColor: "#e2e8f0",
                                width: "100%",
                                display: "block"
                            }} />
                            <li
                                className={`sidebar-list-item ${adminActiveSection === 'overview' ? 'active' : ''}`}
                                onClick={() => onAdminSectionChange && onAdminSectionChange('overview')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FiActivity size={16} />
                                    <span>ภาพรวมระบบ (Overview)</span>
                                </div>
                            </li>
                            <li
                                className={`sidebar-list-item ${adminActiveSection === 'users' ? 'active' : ''}`}
                                onClick={() => onAdminSectionChange && onAdminSectionChange('users')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FiUsers size={16} />
                                    <span>จัดการผู้ใช้ (Users)</span>
                                </div>
                            </li>
                            <li
                                className={`sidebar-list-item ${adminActiveSection === 'classes' ? 'active' : ''}`}
                                onClick={() => onAdminSectionChange && onAdminSectionChange('classes')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FiBook size={16} />
                                    <span>จัดการห้องเรียน (Classrooms)</span>
                                </div>
                            </li>
                            <li
                                className={`sidebar-list-item ${adminActiveSection === 'settings' ? 'active' : ''}`}
                                onClick={() => onAdminSectionChange && onAdminSectionChange('settings')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FiSettings size={16} />
                                    <span>ตั้งค่าระบบ (System Settings)</span>
                                </div>
                            </li>
                        </>
                    ) : isClassDetailPage ? (
                        <>
                            <li className="sidebar-list-item sidebar-back-button" onClick={onClassroomBackClick || handleBackClick}>
                                <FiArrowLeft size={18} />
                                <span>{t('navbar.sidebar.backToClassroom')}</span>
                            </li>
                            <hr className="divider" style={{
                                margin: "8px 0",
                                border: "none",
                                height: "1px",
                                backgroundColor: "#e2e8f0",
                                width: "100%",
                                display: "block"
                            }} />
                            <li
                                className={`sidebar-list-item ${classDetailActiveSection === 'summary' ? 'active' : ''}`}
                                onClick={() => onClassDetailSectionChange && onClassDetailSectionChange('summary')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaInfoCircle size={16} />
                                    <span>{t('navbar.classDetail.summary')}</span>
                                </div>
                            </li>
                            <li
                                className={`sidebar-list-item ${classDetailActiveSection === '1' ? 'active' : ''}`}
                                onClick={() => onClassDetailSectionChange && onClassDetailSectionChange('1')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaStar size={16} />
                                    <span>{t('navbar.classDetail.assignRate')}</span>
                                </div>
                            </li>
                            <li
                                className={`sidebar-list-item ${classDetailActiveSection === 'history' ? 'active' : ''}`}
                                onClick={() => onClassDetailSectionChange && onClassDetailSectionChange('history')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaHistory size={16} />
                                    <span>{t('navbar.classDetail.eventHistory')}</span>
                                </div>
                            </li>
                            <li
                                className={`sidebar-list-item ${classDetailActiveSection === 'group-history' ? 'active' : ''}`}
                                onClick={() => onClassDetailSectionChange && onClassDetailSectionChange('group-history')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaLayerGroup size={16} />
                                    <span>{t('navbar.classDetail.groupHistory')}</span>
                                </div>
                            </li>
                            <li
                                className={`sidebar-list-item ${classDetailActiveSection === '5' ? 'active' : ''}`}
                                onClick={() => onClassDetailSectionChange && onClassDetailSectionChange('5')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaCalendarCheck size={16} />
                                    <span>{t('navbar.classDetail.attendance')}</span>
                                </div>
                            </li>
                            <li
                                className={`sidebar-list-item ${classDetailActiveSection === 'sessions' ? 'active' : ''}`}
                                onClick={() => onClassDetailSectionChange && onClassDetailSectionChange('sessions')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaTrophy size={16} />
                                    <span>{t('navbar.classDetail.classSessions')}</span>
                                </div>
                            </li>
                            <li
                                className={`sidebar-list-item ${classDetailActiveSection === '6' ? 'active' : ''}`}
                                onClick={() => onClassDetailSectionChange && onClassDetailSectionChange('6')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaCog size={16} />
                                    <span>{t('navbar.classDetail.settings')}</span>
                                </div>
                            </li>
                        </>
                    ) : isStreamPage ? (
                        <>
                            <li className="sidebar-list-item sidebar-back-button" onClick={onClassroomBackClick || handleBackClick}>
                                <FiArrowLeft size={18} />
                                <span>{t('navbar.sidebar.backToClassroom')}</span>
                            </li>
                            <hr className="divider" style={{
                                margin: "8px 0",
                                border: "none",
                                height: "1px",
                                backgroundColor: "#e2e8f0",
                                width: "100%",
                                display: "block"
                            }} />
                            <li
                                className={`sidebar-list-item ${streamActiveSection === 'stream' ? 'active' : ''}`}
                                onClick={() => onStreamSectionChange && onStreamSectionChange('stream')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FiBook size={16} />
                                    <span>{t('navbar.stream.stream')}</span>
                                </div>
                            </li>
                            <li
                                className={`sidebar-list-item ${streamActiveSection === 'classwork' ? 'active' : ''}`}
                                onClick={() => onStreamSectionChange && onStreamSectionChange('classwork')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaLayerGroup size={16} />
                                    <span>{t('navbar.stream.classwork')}</span>
                                </div>
                            </li>
                            <li
                                className={`sidebar-list-item ${streamActiveSection === 'calendar' ? 'active' : ''}`}
                                onClick={() => onStreamSectionChange && onStreamSectionChange('calendar')}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaCalendarCheck size={16} />
                                    <span>{t('navbar.stream.calendar')}</span>
                                </div>
                            </li>
                        </>
                    ) : isAssignmentDetailPage ? (
                        <>
                            <li className="sidebar-list-item sidebar-back-button" onClick={onClassroomBackClick || handleBackClick}>
                                <FiArrowLeft size={18} />
                                <span>{t('navbar.sidebar.backToClasswork')}</span>
                            </li>
                            <hr className="divider" style={{
                                margin: "8px 0",
                                border: "none",
                                height: "1px",
                                backgroundColor: "#e2e8f0",
                                width: "100%",
                                display: "block"
                            }} />
                            <li
                                className={`sidebar-list-item`}
                                onClick={() => navigate(`/classroom/${classroom?._id || classId}/stream`, { state: { activeTab: 'stream' } })}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FiBook size={16} />
                                    <span>{t('navbar.stream.stream')}</span>
                                </div>
                            </li>
                            <li
                                className="sidebar-list-item active"
                                onClick={() => navigate(`/classroom/${classroom?._id || classId}/stream`, { state: { activeTab: 'classwork' } })}
                            >
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <FaLayerGroup size={16} />
                                    <span>{t('navbar.stream.classwork')}</span>
                                </div>
                            </li>
                        </>
                    ) : isClassroomPage ? (
                        <>
                            <li className="sidebar-list-item sidebar-back-button" onClick={onClassroomBackClick || handleBackClick}>
                                <FiArrowLeft size={18} />
                                <span>{t('navbar.sidebar.back')}</span>
                            </li>
                            {/* ✨ การแก้ไข: เพิ่มการตรวจสอบ user ก่อนแสดงส่วนนี้เพื่อป้องกัน error */}
                            {user && (
                                <li className="sidebar-list-item sidebar-share-class" onClick={onShareClick}>
                                    <FiShare2 size={18} />
                                    <span>{t('navbar.sidebar.shareClass')}</span>
                                </li>
                            )}
                            {/* ✨ เพิ่ม Stream button */}
                            <li className="sidebar-list-item sidebar-stream" onClick={() => navigate(`/classroom/${classroom?._id}/stream`)}>
                                <FiBook size={18} />
                                <span>{t('navbar.sidebar.stream')}</span>
                            </li>
                            {/* ✨ เพิ่ม Class Detail button สำหรับ creator เท่านั้น */}
                            {isCreator && (
                                <li className="sidebar-list-item sidebar-class-detail" onClick={() => navigate(`/classroom/${classroom?._id}/detail`)}>
                                    <FiEdit2 size={18} />
                                    <span>{t('navbar.sidebar.classDetail')}</span>
                                </li>
                            )}

                            {/* ✨ Teaching Session Widget */}
                            {isCreator && (
                                <>
                                    <hr className="divider" style={{
                                        margin: "8px 0",
                                        border: "none",
                                        height: "1px",
                                        backgroundColor: "#e2e8f0",
                                        width: "100%",
                                        display: "block"
                                    }} />
                                    {isSessionActive ? (
                                        <div className="sidebar-session-widget active">
                                            <div className="sidebar-session-header">
                                                <div className="sidebar-session-dot"></div>
                                                <span className="sidebar-session-title">{t('navbar.sidebar.sessionActive')}</span>
                                            </div>
                                            <div className="sidebar-session-timer">
                                                ⏱ {formatSessionTime ? formatSessionTime(sessionElapsed || 0) : '00:00'}
                                            </div>
                                            <button className="sidebar-session-end-btn" onClick={onEndSession}>
                                                <FaStop size={12} /> {t('navbar.sidebar.endClass')}
                                            </button>
                                        </div>
                                    ) : (
                                        <li className="sidebar-list-item sidebar-start-session" onClick={onStartSession}>
                                            <FaPlay size={14} />
                                            <span>{t('navbar.sidebar.startSession')}</span>
                                        </li>
                                    )}
                                </>
                            )}

                            {/* ส่วนแสดงสมาชิก */}
                            {classroomMembers?.creator && (Array.isArray(classroomMembers.creator) ? classroomMembers.creator.length > 0 : classroomMembers.creator) && (
                                <>
                                    <hr className="divider" style={{
                                        margin: "8px 0",
                                        border: "none",
                                        height: "1px",
                                        backgroundColor: "#e2e8f0",
                                        width: "100%",
                                        display: "block"
                                    }} />
                                    <li
                                        className="sidebar-category-header"
                                        onClick={() => setIsCreatorsExpanded(!isCreatorsExpanded)}
                                    >
                                        {isCreatorsExpanded ?
                                            <FiChevronDown size={16} /> :
                                            <FiChevronRight size={16} />
                                        }
                                        <span>{t('navbar.sidebar.creators')} ({Array.isArray(classroomMembers.creator) ? classroomMembers.creator.length : 1})</span>
                                    </li>
                                    {/* ✨ แก้ไข: แสดงผล creator ให้รองรับทั้ง Object และ Array */}
                                    {isCreatorsExpanded && (Array.isArray(classroomMembers.creator) ? classroomMembers.creator : [classroomMembers.creator]).map(c => (
                                        c && <li key={c._id} className="sidebar-list-item sidebar-member-item sidebar-member-nested" onClick={() => isCreator && handleMemberMenu(c)}>
                                            <img referrerPolicy="no-referrer"
                                                src={getProfileImageSrc(c.photoURL, isGoogleUser(c))}
                                                alt={c.displayName}
                                                onError={handleImageError}
                                                className="sidebar-profile-image"
                                            />
                                            <div style={memberContainerStyle}>
                                                <span style={memberNameStyle}>{c.displayName}</span>
                                                {/* ✨ เพิ่ม: แสดงไอคอนมงกุฎสำหรับผู้สร้างห้องคนแรก */}
                                                {classroomMembers.creator[0]?._id === c._id && <FaCrown style={crownStyle} title="Original Creator" />}
                                            </div>
                                            {/* ✨ แก้ไข: แสดงปุ่มเมนูเฉพาะสำหรับ Original Creator เท่านั้น */}
                                            {isOriginalCreator && user.id !== c._id && (
                                                <button
                                                    className="menu-btn"
                                                    onClick={(e) => { e.stopPropagation(); handleMemberMenu(c); }}
                                                    title="Member options"
                                                >
                                                    <FaCog />
                                                </button>
                                            )}
                                        </li>
                                    ))}
                                </>
                            )}

                            {classroomMembers?.participants?.length > 0 && (
                                <>
                                    {/* ✨ แก้ไข: การนับจำนวน Participants ให้ถูกต้อง */}
                                    {(() => {
                                        const creatorIds = Array.isArray(classroomMembers.creator)
                                            ? classroomMembers.creator.map(c => c._id)
                                            : [classroomMembers.creator?._id].filter(Boolean);
                                        const participantsOnly = classroomMembers.participants.filter(p => !creatorIds.includes(p._id));
                                        return participantsOnly.length > 0 ? (
                                            <>
                                                <li
                                                    className="sidebar-category-header"
                                                    onClick={() => setIsParticipantsExpanded(!isParticipantsExpanded)}
                                                >
                                                    {isParticipantsExpanded ?
                                                        <FiChevronDown size={16} /> :
                                                        <FiChevronRight size={16} />
                                                    }
                                                    <span>{t('navbar.sidebar.participants')} ({participantsOnly.length})</span>
                                                </li>
                                                {isParticipantsExpanded && classroomMembers.participants
                                                    .filter(p => !creatorIds.includes(p._id))
                                                    .map(participant => (
                                                        <li key={participant._id} className="sidebar-list-item sidebar-member-item sidebar-member-nested" onClick={() => isCreator && handleMemberMenu(participant)}>
                                                            <img referrerPolicy="no-referrer"
                                                                src={getProfileImageSrc(participant.photoURL, isGoogleUser(participant))}
                                                                alt={participant.displayName}
                                                                className="sidebar-profile-image"
                                                                onError={handleImageError}
                                                            />
                                                            <span style={listItemStyle}>{participant.displayName}</span>
                                                            {/* ✨ แก้ไข: ตรวจสอบ user.id ก่อนแสดงปุ่ม */}
                                                            {isCreator && user.id !== participant._id && (
                                                                <button
                                                                    className="menu-btn"
                                                                    onClick={(e) => { e.stopPropagation(); handleMemberMenu(participant); }}
                                                                    title="Member options"
                                                                >
                                                                    <FaCog />
                                                                </button>
                                                            )}
                                                        </li>
                                                    ))}
                                            </>
                                        ) : null;
                                    })()}
                                </>
                            )}
                            {isClassroomPage && userSeatId && (
                                <button
                                    className="leave-seat-btn"
                                    style={{
                                        width: '90%',
                                        margin: '20px auto 10px auto',
                                        display: 'block',
                                        background: '#f44336',
                                        color: '#fff',
                                        border: 'none',
                                        borderRadius: '6px',
                                        padding: '10px 0',
                                        fontWeight: 'bold',
                                        cursor: 'pointer'
                                    }}
                                    onClick={onLeaveSeat}
                                >
                                    {t('navbar.sidebar.leaveSeat')}
                                </button>
                            )}
                        </>
                    ) : (
                        <>
                            {user && (
                                <li className="sidebar-list-item sidebar-create-class" onClick={onClassActionClick}>
                                    <FiPlus size={18} />
                                    <span>{t('navbar.sidebar.class')}</span>
                                </li>
                            )}
                            <hr style={{ border: "none", height: "1px", backgroundColor: "#dadce0", margin: "8px 0" }} />
                            {(() => {
                                // แยกห้องเรียนตามประเภท
                                const createdByMe = classrooms.filter(room =>
                                    room.creator && Array.isArray(room.creator) &&
                                    room.creator.some(creator => creator._id === user?.id)
                                );
                                const joinedRooms = classrooms.filter(room =>
                                    !room.creator || !Array.isArray(room.creator) ||
                                    !room.creator.some(creator => creator._id === user?.id)
                                );

                                return (
                                    <>
                                        {/* ห้องที่สร้างเอง */}
                                        {createdByMe.length > 0 && (
                                            <>
                                                <li
                                                    className="sidebar-category-header"
                                                    onClick={() => setIsCreatedByMeExpanded(!isCreatedByMeExpanded)}
                                                >
                                                    {isCreatedByMeExpanded ?
                                                        <FiChevronDown size={16} /> :
                                                        <FiChevronRight size={16} />
                                                    }
                                                    <span>{t('navbar.sidebar.createdByMe')} ({createdByMe.length})</span>
                                                </li>
                                                {isCreatedByMeExpanded && createdByMe.map((room) => (
                                                    <li
                                                        key={room._id}
                                                        className="sidebar-list-item sidebar-classroom-item sidebar-classroom-nested"
                                                        onClick={() => handleClassroomClick(room._id)}
                                                    >
                                                        <img referrerPolicy="no-referrer"
                                                            src={getProfileImageSrc(room.creator?.[0]?.photoURL, isGoogleUser(room.creator?.[0]))}
                                                            alt="Creator Profile"
                                                            className="sidebar-profile-image"
                                                            onError={handleImageError}
                                                        />
                                                        <span className="sidebar-classroom-name">{room.name}</span>
                                                    </li>
                                                ))}
                                            </>
                                        )}

                                        {/* ห้องที่เข้าร่วม */}
                                        {joinedRooms.length > 0 && (
                                            <>
                                                <li
                                                    className="sidebar-category-header"
                                                    onClick={() => setIsJoinedExpanded(!isJoinedExpanded)}
                                                >
                                                    {isJoinedExpanded ?
                                                        <FiChevronDown size={16} /> :
                                                        <FiChevronRight size={16} />
                                                    }
                                                    <span>{t('navbar.sidebar.joined')} ({joinedRooms.length})</span>
                                                </li>
                                                {isJoinedExpanded && joinedRooms.map((room) => (
                                                    <li
                                                        key={room._id}
                                                        className="sidebar-list-item sidebar-classroom-item sidebar-classroom-nested"
                                                        onClick={() => handleClassroomClick(room._id)}
                                                    >
                                                        <img referrerPolicy="no-referrer"
                                                            src={getProfileImageSrc(room.creator?.[0]?.photoURL, isGoogleUser(room.creator?.[0]))}
                                                            alt="Creator Profile"
                                                            className="sidebar-profile-image"
                                                            onError={handleImageError}
                                                        />
                                                        <span className="sidebar-classroom-name">{room.name}</span>
                                                    </li>
                                                ))}
                                            </>
                                        )}

                                        {/* แสดงข้อความเมื่อไม่มีห้องเรียน */}
                                        {classrooms.length === 0 && (
                                            <li className="sidebar-no-class-text">
                                                {t('navbar.sidebar.noClassesJoined')}
                                            </li>
                                        )}
                                    </>
                                );
                            })()}
                        </>
                    )}
                </ul>
            </aside>
        </>
    );
};

export default Navbar;

