// src/pages/NotificationsPage.jsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import io from 'socket.io-client';
import { useTranslation } from 'react-i18next';
import {
    FiMail, FiSend, FiBell, FiCheckCircle, FiAlertCircle, FiTrash2,
    FiArrowLeft, FiSearch, FiUser, FiCheck, FiPlus, FiLifeBuoy,
    FiTag, FiClock, FiMessageSquare, FiHelpCircle, FiInbox, FiShield,
    FiLayers, FiAward, FiLogIn, FiUserCheck, FiUserX
} from 'react-icons/fi';
import { FaTicketAlt, FaShieldAlt, FaTrophy, FaUserGraduate } from 'react-icons/fa';

import Navbar from '../components/Navbar';
import { API_BASE_URL, createSocketClient } from '../config/api';
import '../CSS/NotificationsPage.css';
import '../CSS/Main.css';

const NotificationsPage = ({
    user,
    isSidebarOpen,
    toggleSidebar,
    handleSignOut
}) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Data State
    const [notifications, setNotifications] = useState([]);
    const [selectedNotification, setSelectedNotification] = useState(null);
    const [activeTab, setActiveTab] = useState(() => searchParams.get('tab') || 'all');
    const [unreadOnly, setUnreadOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [classrooms, setClassrooms] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [ticketCount, setTicketCount] = useState(0);

    // Modals & Action State
    const [isComposeOpen, setIsComposeOpen] = useState(false);
    const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [statusUpdating, setStatusUpdating] = useState(false);

    // Compose State
    const [recipientQuery, setRecipientQuery] = useState('');
    const [recipientResults, setRecipientResults] = useState([]);
    const [selectedRecipient, setSelectedRecipient] = useState(null);
    const [composeSubject, setComposeSubject] = useState('');
    const [composeBody, setComposeBody] = useState('');
    const [composePriority, setComposePriority] = useState('normal');
    const [isSearchingRecipients, setIsSearchingRecipients] = useState(false);
    const [isSendingMessage, setIsSendingMessage] = useState(false);

    // Ticket State
    const [ticketCategory, setTicketCategory] = useState('general');
    const [ticketPriority, setTicketPriority] = useState('normal');
    const [ticketSubject, setTicketSubject] = useState('');
    const [ticketBody, setTicketBody] = useState('');
    const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);

    const token = localStorage.getItem('authToken');
    const repliesEndRef = useRef(null);

    // Fetch user's classrooms for Navbar sidebar
    const fetchClassrooms = useCallback(async () => {
        try {
            if (!token) return;
            const res = await axios.get(`${API_BASE_URL}/api/classrooms`, {
                headers: { 'x-auth-token': token }
            });
            if (res.data) setClassrooms(res.data);
        } catch (err) {
            console.error('Failed to load classrooms for sidebar:', err);
        }
    }, [token]);

    // Fetch Notifications list
    const fetchNotifications = useCallback(async (tabToFetch = activeTab) => {
        if (!token) return;
        try {
            setIsLoading(true);
            const res = await axios.get(`${API_BASE_URL}/api/notifications`, {
                headers: { 'x-auth-token': token },
                params: {
                    tab: tabToFetch,
                    unreadOnly: unreadOnly ? 'true' : 'false',
                    search: searchQuery.trim() || undefined,
                    summary: 'true'
                }
            });

            const data = Array.isArray(res.data) ? res.data : (res.data?.notifications || []);
            setNotifications(data);
            setUnreadCount(res.data?.unreadCount !== undefined ? res.data.unreadCount : data.filter(n => !n.isRead).length);
            setTicketCount(res.data?.ticketCount !== undefined ? res.data.ticketCount : data.filter(n => n.type === 'ticket').length);

            // Handle URL auto-select
            const targetId = searchParams.get('id');
            if (targetId) {
                const match = data.find(n => n._id === targetId);
                if (match) {
                    setSelectedNotification(match);
                    if (!match.isRead) markAsRead(match._id);
                }
            }
        } catch (err) {
            console.error('Error fetching notifications:', err);
        } finally {
            setIsLoading(false);
        }
    }, [token, activeTab, unreadOnly, searchQuery, searchParams]);

    useEffect(() => {
        fetchClassrooms();
    }, [fetchClassrooms]);

    useEffect(() => {
        fetchNotifications(activeTab);
    }, [fetchNotifications, activeTab, unreadOnly]);

    // Global Socket Setup
    useEffect(() => {
        if (!user || !user.id) return;

        const socket = createSocketClient(io, {
            auth: { userId: user.id }
        });

        socket.on('connect', () => {
            socket.emit('join-user-room', user.id);
            if (user.role === 'admin') {
                socket.emit('join-admin-room', { token });
            }
        });

        socket.on('new-notification', (notif) => {
            setNotifications(prev => {
                const exists = prev.find(n => n._id === notif._id);
                if (exists) {
                    return prev.map(n => n._id === notif._id ? notif : n);
                }
                return [notif, ...prev];
            });

            setSelectedNotification(prev => {
                if (prev && prev._id === notif._id) {
                    return notif;
                }
                return prev;
            });

            setUnreadCount(c => c + 1);
        });

        socket.on('notification-reply', ({ notificationId, reply }) => {
            setSelectedNotification(prev => {
                if (prev && prev._id === notificationId) {
                    return {
                        ...prev,
                        replies: [...(prev.replies || []), reply]
                    };
                }
                return prev;
            });

            setNotifications(prev => prev.map(n => {
                if (n._id === notificationId) {
                    return {
                        ...n,
                        replies: [...(n.replies || []), reply]
                    };
                }
                return n;
            }));
        });

        socket.on('ticket-updated', (updatedTicket) => {
            setSelectedNotification(prev => {
                if (prev && prev._id === updatedTicket._id) {
                    return updatedTicket;
                }
                return prev;
            });
            setNotifications(prev => prev.map(n => n._id === updatedTicket._id ? updatedTicket : n));
        });

        return () => {
            socket.disconnect();
        };
    }, [user, token]);

    // Scroll reply to bottom
    useEffect(() => {
        repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [selectedNotification?.replies]);

    // Recipient search debouncer
    useEffect(() => {
        if (!recipientQuery.trim()) {
            setRecipientResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            try {
                setIsSearchingRecipients(true);
                const res = await axios.get(`${API_BASE_URL}/api/notifications/recipients`, {
                    headers: { 'x-auth-token': token },
                    params: { q: recipientQuery.trim() }
                });
                setRecipientResults(res.data || []);
            } catch (err) {
                console.error('Failed to search recipients:', err);
            } finally {
                setIsSearchingRecipients(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [recipientQuery, token]);

    // Grouping Logic: Collapse ALL system notifications into ONE sender entry
    const groupedList = useMemo(() => {
        const systemNotifs = [];
        const individualItems = [];

        notifications.forEach(item => {
            const isSystem = !item.type ||
                ['system', 'class_join', 'class_leave', 'score', 'event', 'login', 'class_update'].includes(item.type) ||
                item.sender?.id === 'system' ||
                (!item.sender?.id && item.type !== 'message' && item.type !== 'ticket');

            if (isSystem) {
                systemNotifs.push(item);
            } else {
                individualItems.push(item);
            }
        });

        const list = [];

        // 1. Direct Messages & Support Tickets
        individualItems.forEach(item => {
            if (activeTab === 'all' ||
                (activeTab === 'messages' && item.type === 'message') ||
                (activeTab === 'tickets' && item.type === 'ticket')) {
                list.push(item);
            }
        });

        // 2. Grouped System Notification Entry (Single sender for all system notices)
        if (systemNotifs.length > 0 && activeTab !== 'messages' && activeTab !== 'tickets') {
            systemNotifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const latest = systemNotifs[0];
            const unreadCountInSystem = systemNotifs.filter(n => !n.isRead).length;

            const systemGroupCard = {
                _id: 'group_system',
                isSystemGroup: true,
                title: t('notificationsPage.systemSender', 'ระบบ (System Notifications)'),
                message: `${latest.title}: ${latest.message}`,
                type: 'system',
                createdAt: latest.createdAt,
                isRead: unreadCountInSystem === 0,
                unreadCount: unreadCountInSystem,
                totalCount: systemNotifs.length,
                items: systemNotifs
            };

            list.push(systemGroupCard);
        }

        // Sort items by createdAt descending
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        // Filter unread only if toggled
        if (unreadOnly) {
            return list.filter(item => !item.isRead || (item.isSystemGroup && item.unreadCount > 0));
        }

        return list;
    }, [notifications, activeTab, unreadOnly, t]);

    // Keep selected notification synchronized with grouped system card or auto-select on desktop
    useEffect(() => {
        if (!selectedNotification && groupedList.length > 0 && window.innerWidth > 768) {
            setSelectedNotification(groupedList[0]);
        } else if (selectedNotification?.isSystemGroup) {
            // Keep system group items up-to-date
            const freshGroup = groupedList.find(i => i.isSystemGroup);
            if (freshGroup) {
                setSelectedNotification(freshGroup);
            }
        }
    }, [groupedList]);

    // Mark single as read
    const markAsRead = async (id) => {
        try {
            await axios.put(`${API_BASE_URL}/api/notifications/${id}/read`, {}, {
                headers: { 'x-auth-token': token }
            });
            setNotifications(prev => prev.map(n => n._id === id ? { ...n, isRead: true } : n));
            setSelectedNotification(prev => prev && prev._id === id ? { ...prev, isRead: true } : prev);
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            console.error('Failed to mark read:', err);
        }
    };

    // Mark all as read
    const handleMarkAllRead = async () => {
        try {
            await axios.put(`${API_BASE_URL}/api/notifications/read-all`, {}, {
                headers: { 'x-auth-token': token }
            });
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
            if (selectedNotification?.isSystemGroup) {
                setSelectedNotification(prev => ({
                    ...prev,
                    isRead: true,
                    unreadCount: 0,
                    items: prev.items.map(i => ({ ...i, isRead: true }))
                }));
            } else if (selectedNotification) {
                setSelectedNotification(prev => ({ ...prev, isRead: true }));
            }
            setUnreadCount(0);
        } catch (err) {
            console.error('Failed to mark all read:', err);
        }
    };

    // Delete single notification
    const handleDeleteNotification = async (id, e) => {
        if (e) e.stopPropagation();
        if (!window.confirm(t('notificationsPage.deleteConfirm', 'คุณต้องการลบรายการนี้ใช่หรือไม่?'))) {
            return;
        }

        try {
            await axios.delete(`${API_BASE_URL}/api/notifications/${id}`, {
                headers: { 'x-auth-token': token }
            });
            setNotifications(prev => prev.filter(n => n._id !== id));
            if (selectedNotification && selectedNotification._id === id) {
                const remaining = groupedList.filter(n => n._id !== id);
                setSelectedNotification(remaining.length > 0 && window.innerWidth > 768 ? remaining[0] : null);
            }
        } catch (err) {
            console.error('Failed to delete notification:', err);
        }
    };

    // Update ticket status
    const handleUpdateTicketStatus = async (status) => {
        if (!selectedNotification) return;
        try {
            setStatusUpdating(true);
            const res = await axios.put(`${API_BASE_URL}/api/notifications/${selectedNotification._id}/ticket-status`, {
                status
            }, {
                headers: { 'x-auth-token': token }
            });

            if (res.data?.notification) {
                setSelectedNotification(res.data.notification);
                setNotifications(prev => prev.map(n => n._id === selectedNotification._id ? res.data.notification : n));
            }
        } catch (err) {
            console.error('Failed to update ticket status:', err);
        } finally {
            setStatusUpdating(false);
        }
    };

    // Send reply
    const handleSendReply = async (e) => {
        e.preventDefault();
        if (!replyText.trim() || !selectedNotification || selectedNotification.isSystemGroup) return;

        try {
            setIsSubmittingReply(true);
            const res = await axios.post(`${API_BASE_URL}/api/notifications/${selectedNotification._id}/reply`, {
                message: replyText.trim()
            }, {
                headers: { 'x-auth-token': token }
            });

            if (res.data?.notification) {
                setSelectedNotification(res.data.notification);
                setNotifications(prev => prev.map(n => n._id === selectedNotification._id ? res.data.notification : n));
                setReplyText('');
            }
        } catch (err) {
            console.error('Failed to send reply:', err);
            alert(err.response?.data?.msg || 'Failed to send reply');
        } finally {
            setIsSubmittingReply(false);
        }
    };

    // Handle Send Direct Message
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!selectedRecipient || !composeSubject.trim() || !composeBody.trim()) {
            alert('กรุณากรอกข้อมูลให้ครบถ้วน');
            return;
        }

        try {
            setIsSendingMessage(true);
            const res = await axios.post(`${API_BASE_URL}/api/notifications/send-message`, {
                recipientId: selectedRecipient.id,
                title: composeSubject.trim(),
                message: composeBody.trim(),
                priority: composePriority
            }, {
                headers: { 'x-auth-token': token }
            });

            if (res.data?.success) {
                alert(t('notificationsPage.composeModal.success'));
                setIsComposeOpen(false);
                setSelectedRecipient(null);
                setRecipientQuery('');
                setComposeSubject('');
                setComposeBody('');
                setComposePriority('normal');
                fetchNotifications('messages');
                setActiveTab('messages');
            }
        } catch (err) {
            console.error('Failed to send message:', err);
            alert(err.response?.data?.msg || 'Error sending message');
        } finally {
            setIsSendingMessage(false);
        }
    };

    // Handle Submit Support Ticket
    const handleSubmitTicket = async (e) => {
        e.preventDefault();
        if (!ticketSubject.trim() || !ticketBody.trim()) {
            alert('กรุณากรอกหัวข้อและรายละเอียดปัญหา');
            return;
        }

        try {
            setIsSubmittingTicket(true);
            const res = await axios.post(`${API_BASE_URL}/api/notifications/create-ticket`, {
                title: ticketSubject.trim(),
                message: ticketBody.trim(),
                category: ticketCategory,
                priority: ticketPriority
            }, {
                headers: { 'x-auth-token': token }
            });

            if (res.data?.success) {
                alert(t('notificationsPage.ticketModal.success'));
                setIsTicketModalOpen(false);
                setTicketSubject('');
                setTicketBody('');
                setTicketCategory('general');
                setTicketPriority('normal');
                fetchNotifications('tickets');
                setActiveTab('tickets');
            }
        } catch (err) {
            console.error('Failed to create ticket:', err);
            alert(err.response?.data?.msg || 'Error creating ticket');
        } finally {
            setIsSubmittingTicket(false);
        }
    };

    // Status label & color
    const getTicketStatusBadge = (status) => {
        const map = {
            open: { label: t('notificationsPage.status.open'), class: 'status-open' },
            in_progress: { label: t('notificationsPage.status.in_progress'), class: 'status-progress' },
            resolved: { label: t('notificationsPage.status.resolved'), class: 'status-resolved' },
            closed: { label: t('notificationsPage.status.closed'), class: 'status-closed' }
        };
        const s = map[status] || map.open;
        return <span className={`ticket-status-pill ${s.class}`}><span className="status-dot"></span>{s.label}</span>;
    };

    // Sub-icon helper for system activities
    const getSystemActivityIcon = (type) => {
        switch (type) {
            case 'score':
                return <FaTrophy className="sub-type-icon icon-score" />;
            case 'class_join':
                return <FiUserCheck className="sub-type-icon icon-join" />;
            case 'class_leave':
                return <FiUserX className="sub-type-icon icon-leave" />;
            case 'login':
                return <FiLogIn className="sub-type-icon icon-login" />;
            case 'event':
                return <FiLayers className="sub-type-icon icon-event" />;
            default:
                return <FiBell className="sub-type-icon icon-bell" />;
        }
    };

    return (
        <>
            <Navbar
                user={user}
                handleSignOut={handleSignOut}
                toggleSidebar={toggleSidebar}
                isSidebarOpen={isSidebarOpen}
                classrooms={classrooms}
                isNotificationsPage={true}
                notificationsActiveTab={activeTab}
                onNotificationsTabChange={(tab) => {
                    setActiveTab(tab);
                    setSearchParams(tab === 'all' ? {} : { tab });
                }}
                notificationsTotalCount={notifications.length}
                notificationsTicketCount={ticketCount}
                onOpenCompose={() => setIsComposeOpen(true)}
                onOpenTicket={() => setIsTicketModalOpen(true)}
                onBackClick={() => navigate('/')}
            />

            <main className={`main__content notif-main ${isSidebarOpen ? 'shift' : ''}`}>
                {/* Unified Single Workspace Enclosure */}
                <div className="notif-shell-unified">
                    {/* Header Strip */}
                    <header className="notif-header-unified">
                        <div className="notif-header-title-box">
                            <h1 className="notif-page-title">{t('notificationsPage.pageTitle')}</h1>
                            <span className="notif-page-subtitle">{t('notificationsPage.pageSubtitle')}</span>
                        </div>

                        <div className="notif-header-actions-row">
                            <button
                                className="btn-clean btn-clean-primary"
                                onClick={() => setIsComposeOpen(true)}
                            >
                                <FiMail size={15} />
                                <span>{t('notificationsPage.compose')}</span>
                            </button>
                            <button
                                className="btn-clean btn-clean-secondary"
                                onClick={() => setIsTicketModalOpen(true)}
                            >
                                <FaTicketAlt size={13} />
                                <span>{t('notificationsPage.openTicket')}</span>
                            </button>
                            {unreadCount > 0 && (
                                <button
                                    className="btn-clean btn-clean-ghost"
                                    onClick={handleMarkAllRead}
                                >
                                    <FiCheck size={15} />
                                    <span>{t('notificationsPage.markAllRead')}</span>
                                </button>
                            )}
                        </div>
                    </header>

                    {/* Integrated Toolbar */}
                    <div className="notif-toolbar-unified">
                        <div className="notif-tabs-segment">
                            <button
                                className={`notif-tab-pill ${activeTab === 'all' ? 'active' : ''}`}
                                onClick={() => { setActiveTab('all'); setSearchParams({}); }}
                            >
                                <FiInbox size={14} />
                                <span>{t('notificationsPage.tabs.all')}</span>
                            </button>
                            <button
                                className={`notif-tab-pill ${activeTab === 'messages' ? 'active' : ''}`}
                                onClick={() => { setActiveTab('messages'); setSearchParams({ tab: 'messages' }); }}
                            >
                                <FiMail size={14} />
                                <span>{t('notificationsPage.tabs.messages')}</span>
                            </button>
                            <button
                                className={`notif-tab-pill ${activeTab === 'tickets' ? 'active' : ''}`}
                                onClick={() => { setActiveTab('tickets'); setSearchParams({ tab: 'tickets' }); }}
                            >
                                <FaTicketAlt size={13} />
                                <span>{t('notificationsPage.tabs.tickets')}</span>
                                {ticketCount > 0 && (
                                    <span className="pill-badge-alert">{ticketCount}</span>
                                )}
                            </button>
                            <button
                                className={`notif-tab-pill ${activeTab === 'system' ? 'active' : ''}`}
                                onClick={() => { setActiveTab('system'); setSearchParams({ tab: 'system' }); }}
                            >
                                <FiBell size={14} />
                                <span>{t('notificationsPage.tabs.system')}</span>
                            </button>
                        </div>

                        <div className="notif-toolbar-right">
                            <div className="notif-search-input-wrap">
                                <FiSearch size={14} className="search-icon" />
                                <input
                                    type="text"
                                    placeholder={t('notificationsPage.searchPlaceholder')}
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && fetchNotifications(activeTab)}
                                />
                                {searchQuery && (
                                    <button className="clear-btn" onClick={() => { setSearchQuery(''); fetchNotifications(activeTab); }}>×</button>
                                )}
                            </div>

                            <button
                                className={`notif-unread-switch ${unreadOnly ? 'active' : ''}`}
                                onClick={() => setUnreadOnly(!unreadOnly)}
                            >
                                <span className="switch-dot"></span>
                                <span>{t('notificationsPage.unreadOnly')}</span>
                            </button>
                        </div>
                    </div>

                    {/* Split Workbench Body */}
                    <div className={`notif-workbench-split ${selectedNotification ? 'has-selected' : ''}`}>
                        {/* Left Master List */}
                        <aside className="notif-list-pane">
                            {isLoading ? (
                                <div className="notif-list-loading">
                                    <div className="clean-spinner"></div>
                                    <p>กำลังโหลดรายการ...</p>
                                </div>
                            ) : groupedList.length === 0 ? (
                                <div className="notif-list-empty">
                                    <FiInbox size={32} className="empty-icon" />
                                    <h4>{t('notificationsPage.empty.title')}</h4>
                                    <p>{t('notificationsPage.empty.desc')}</p>
                                </div>
                            ) : (
                                <div className="notif-cards-scroll">
                                    {groupedList.map((item) => {
                                        const isSelected = selectedNotification?._id === item._id;

                                        // Special render for grouped system notifications
                                        if (item.isSystemGroup) {
                                            return (
                                                <div
                                                    key="system_group"
                                                    className={`notif-card notif-card-system-group ${isSelected ? 'selected' : ''} ${!item.isRead ? 'unread' : ''}`}
                                                    onClick={() => setSelectedNotification(item)}
                                                >
                                                    <div className="sender-avatar-placeholder system-avatar-box">
                                                        <FiShield size={18} />
                                                    </div>

                                                    <div className="notif-card-main">
                                                        <div className="notif-card-header">
                                                            <span className="sender-name system-name">{item.title}</span>
                                                            <span className="notif-time">
                                                                {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                            </span>
                                                        </div>

                                                        <p className="notif-preview system-preview">{item.message}</p>

                                                        <div className="notif-card-tags">
                                                            <span className="system-count-tag">
                                                                <FiBell size={11} /> {item.totalCount} {t('notificationsPage.systemItemsCount', 'รายการ')}
                                                            </span>
                                                            {item.unreadCount > 0 && (
                                                                <span className="system-unread-tag">
                                                                    {item.unreadCount} ใหม่
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="notif-card-actions">
                                                        {item.unreadCount > 0 && <span className="unread-dot"></span>}
                                                    </div>
                                                </div>
                                            );
                                        }

                                        // Regular Direct Message or Ticket
                                        const isTicket = item.type === 'ticket';
                                        const senderDisplay = item.sender?.displayName || item.sender?.email || 'User';

                                        return (
                                            <div
                                                key={item._id}
                                                className={`notif-card ${isSelected ? 'selected' : ''} ${!item.isRead ? 'unread' : ''}`}
                                                onClick={() => {
                                                    setSelectedNotification(item);
                                                    if (!item.isRead) markAsRead(item._id);
                                                }}
                                            >
                                                <div className="notif-card-side">
                                                    {item.sender?.photoURL ? (
                                                        <img
                                                            src={item.sender.photoURL}
                                                            alt={senderDisplay}
                                                            className="sender-avatar"
                                                            onError={(e) => { e.target.style.display = 'none'; }}
                                                        />
                                                    ) : (
                                                        <div className={`sender-avatar-placeholder ${isTicket ? 'ticket-avatar' : ''}`}>
                                                            {isTicket ? <FaTicketAlt size={14} /> : <FiMail size={16} />}
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="notif-card-main">
                                                    <div className="notif-card-header">
                                                        <span className="sender-name">{senderDisplay}</span>
                                                        <span className="notif-time">
                                                            {new Date(item.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                                                        </span>
                                                    </div>

                                                    <h4 className="notif-subject">{item.title}</h4>
                                                    <p className="notif-preview">{item.message}</p>

                                                    <div className="notif-card-tags">
                                                        {isTicket && getTicketStatusBadge(item.ticketStatus || 'open')}
                                                        {item.category && item.category !== 'general' && (
                                                            <span className="category-pill">{t(`notificationsPage.categories.${item.category}`, item.category)}</span>
                                                        )}
                                                        {item.priority === 'urgent' && (
                                                            <span className="priority-pill urgent">ด่วน</span>
                                                        )}
                                                        {item.replies?.length > 0 && (
                                                            <span className="replies-count-pill">
                                                                <FiMessageSquare size={11} /> {item.replies.length}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>

                                                <div className="notif-card-actions">
                                                    {!item.isRead && <span className="unread-dot"></span>}
                                                    <button
                                                        className="card-delete-btn"
                                                        title={t('notificationsPage.delete')}
                                                        onClick={(e) => handleDeleteNotification(item._id, e)}
                                                    >
                                                        <FiTrash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </aside>

                        {/* Right Detail Pane */}
                        <section className="notif-detail-pane">
                            {!selectedNotification ? (
                                <div className="detail-empty-state">
                                    <div className="detail-empty-graphic">
                                        <FiInbox size={38} />
                                    </div>
                                    <h3>{t('notificationsPage.empty.selectToRead')}</h3>
                                    <p>เลือกรายการจากทางซ้าย เพื่อดูข้อความหรือการแจ้งเตือน</p>
                                </div>
                            ) : selectedNotification.isSystemGroup ? (
                                /* Grouped System Notifications Stream View */
                                <div className="system-stream-view">
                                    <div className="detail-mobile-back">
                                        <button className="mobile-back-btn" onClick={() => setSelectedNotification(null)}>
                                            <FiArrowLeft size={16} />
                                            <span>{t('notificationsPage.backToList')}</span>
                                        </button>
                                    </div>

                                    <div className="system-stream-header">
                                        <div className="system-stream-title-box">
                                            <div className="system-big-badge">
                                                <FiShield size={22} />
                                            </div>
                                            <div>
                                                <h2>{t('notificationsPage.systemSender', 'ระบบ (System Notifications)')}</h2>
                                                <p className="system-subtitle">
                                                    {t('notificationsPage.systemDesc', 'บันทึกกิจกรรมและแจ้งเตือนอัตโนมัติจากระบบ')} • รวม {selectedNotification.totalCount} {t('notificationsPage.systemItemsCount', 'รายการ')}
                                                </p>
                                            </div>
                                        </div>

                                        {selectedNotification.unreadCount > 0 && (
                                            <button
                                                className="btn-clean btn-clean-ghost"
                                                onClick={handleMarkAllRead}
                                            >
                                                <FiCheck size={14} />
                                                <span>{t('notificationsPage.markSystemAllRead', 'ทำเครื่องหมายอ่านแล้วทั้งหมด')}</span>
                                            </button>
                                        )}
                                    </div>

                                    {/* System Notifications Timeline Entries */}
                                    <div className="system-activities-list">
                                        {selectedNotification.items.map((sysItem) => (
                                            <div
                                                key={sysItem._id}
                                                className={`system-activity-row ${!sysItem.isRead ? 'unread' : ''}`}
                                                onClick={() => {
                                                    if (!sysItem.isRead) markAsRead(sysItem._id);
                                                }}
                                            >
                                                <div className="activity-icon-col">
                                                    {getSystemActivityIcon(sysItem.type)}
                                                </div>

                                                <div className="activity-content-col">
                                                    <div className="activity-row-header">
                                                        <h4 className="activity-title">{sysItem.title}</h4>
                                                        <span className="activity-time">
                                                            <FiClock size={11} />
                                                            {new Date(sysItem.createdAt).toLocaleString([], {
                                                                month: 'short', day: 'numeric',
                                                                hour: '2-digit', minute: '2-digit'
                                                            })}
                                                        </span>
                                                    </div>
                                                    <p className="activity-message">{sysItem.message}</p>
                                                </div>

                                                <div className="activity-action-col">
                                                    {!sysItem.isRead && <span className="unread-dot"></span>}
                                                    <button
                                                        className="activity-delete-btn"
                                                        title={t('notificationsPage.delete')}
                                                        onClick={(e) => handleDeleteNotification(sysItem._id, e)}
                                                    >
                                                        <FiTrash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                /* Direct Message / Support Ticket Thread View */
                                <div className="detail-view">
                                    <div className="detail-mobile-back">
                                        <button className="mobile-back-btn" onClick={() => setSelectedNotification(null)}>
                                            <FiArrowLeft size={16} />
                                            <span>{t('notificationsPage.backToList')}</span>
                                        </button>
                                    </div>

                                    {/* Top Info Bar */}
                                    <div className="detail-top-bar">
                                        <div className="detail-subject-line">
                                            <div className="subject-icon-box">
                                                {selectedNotification.type === 'ticket' ? <FaTicketAlt size={16} /> : <FiMail size={16} />}
                                            </div>
                                            <div className="subject-info">
                                                <h2 className="detail-title">{selectedNotification.title}</h2>
                                                <div className="detail-meta-pills">
                                                    {selectedNotification.type === 'ticket' && (
                                                        <>
                                                            {getTicketStatusBadge(selectedNotification.ticketStatus || 'open')}
                                                            <span className="category-pill">
                                                                {t(`notificationsPage.categories.${selectedNotification.category}`, selectedNotification.category || 'ทั่วไป')}
                                                            </span>
                                                        </>
                                                    )}
                                                    {selectedNotification.priority === 'urgent' && (
                                                        <span className="priority-pill urgent">🚨 ด่วนมาก</span>
                                                    )}
                                                    <span className="date-pill">
                                                        <FiClock size={12} />
                                                        {new Date(selectedNotification.createdAt).toLocaleString([], {
                                                            year: 'numeric', month: 'short', day: 'numeric',
                                                            hour: '2-digit', minute: '2-digit'
                                                        })}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="detail-top-actions">
                                            {selectedNotification.type === 'ticket' && (user?.role === 'admin' || selectedNotification.userId === user?.id) && (
                                                <div className="status-changer-wrap">
                                                    <label>{t('notificationsPage.status.updateStatus')}:</label>
                                                    <select
                                                        className="status-select"
                                                        value={selectedNotification.ticketStatus || 'open'}
                                                        disabled={statusUpdating}
                                                        onChange={(e) => handleUpdateTicketStatus(e.target.value)}
                                                    >
                                                        <option value="open">{t('notificationsPage.status.open')}</option>
                                                        <option value="in_progress">{t('notificationsPage.status.in_progress')}</option>
                                                        <option value="resolved">{t('notificationsPage.status.resolved')}</option>
                                                        <option value="closed">{t('notificationsPage.status.closed')}</option>
                                                    </select>
                                                </div>
                                            )}

                                            <button
                                                className="btn-icon-trash"
                                                title={t('notificationsPage.delete')}
                                                onClick={(e) => handleDeleteNotification(selectedNotification._id, e)}
                                            >
                                                <FiTrash2 size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Sender & Recipient Bar */}
                                    <div className="detail-participants-strip">
                                        <div className="participant-chip">
                                            <span className="participant-label">{t('notificationsPage.thread.from')}:</span>
                                            <span className="participant-value">
                                                {selectedNotification.sender?.displayName || selectedNotification.sender?.email || 'User'}
                                            </span>
                                            {selectedNotification.sender?.role === 'admin' && (
                                                <span className="role-tag admin"><FaShieldAlt size={10} /> แอดมิน</span>
                                            )}
                                        </div>

                                        {selectedNotification.recipient && (
                                            <div className="participant-chip">
                                                <span className="participant-label">{t('notificationsPage.thread.to')}:</span>
                                                <span className="participant-value">
                                                    {selectedNotification.recipient.displayName || selectedNotification.recipient.email}
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    {/* Message Body */}
                                    <div className="detail-body-card">
                                        <div className="detail-body-text">
                                            {selectedNotification.message}
                                        </div>
                                    </div>

                                    {/* Conversation & Replies Thread */}
                                    <div className="detail-conversation-section">
                                        <div className="conversation-header">
                                            <FiMessageSquare size={16} />
                                            <h3>{t('notificationsPage.thread.replies')} ({selectedNotification.replies?.length || 0})</h3>
                                        </div>

                                        <div className="conversation-messages">
                                            {(!selectedNotification.replies || selectedNotification.replies.length === 0) ? (
                                                <p className="no-replies-text">{t('notificationsPage.thread.noReplies')}</p>
                                            ) : (
                                                selectedNotification.replies.map((reply, idx) => {
                                                    const isMe = reply.sender?.id === user?.id;
                                                    return (
                                                        <div key={idx} className={`reply-bubble-row ${isMe ? 'my-reply' : 'counterpart-reply'}`}>
                                                            <div className="reply-avatar-col">
                                                                {reply.sender?.photoURL ? (
                                                                    <img src={reply.sender.photoURL} alt="" className="reply-avatar" />
                                                                ) : (
                                                                    <div className="reply-avatar-placeholder">
                                                                        {reply.sender?.displayName?.charAt(0) || 'U'}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="reply-bubble-card">
                                                                <div className="reply-bubble-header">
                                                                    <span className="reply-author-name">
                                                                        {reply.sender?.displayName || reply.sender?.email || 'User'}
                                                                    </span>
                                                                    {reply.sender?.role === 'admin' && (
                                                                        <span className="role-tag admin"><FaShieldAlt size={9} /> แอดมิน</span>
                                                                    )}
                                                                    <span className="reply-time">
                                                                        {new Date(reply.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                                    </span>
                                                                </div>
                                                                <div className="reply-bubble-body">
                                                                    {reply.message}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    );
                                                })
                                            )}
                                            <div ref={repliesEndRef} />
                                        </div>

                                        {/* Reply Composer Form */}
                                        <form className="reply-composer-form" onSubmit={handleSendReply}>
                                            <textarea
                                                className="reply-composer-input"
                                                rows={2}
                                                placeholder={t('notificationsPage.thread.replyPlaceholder')}
                                                value={replyText}
                                                onChange={(e) => setReplyText(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSendReply(e);
                                                    }
                                                }}
                                            />
                                            <button
                                                type="submit"
                                                className="reply-submit-btn"
                                                disabled={!replyText.trim() || isSubmittingReply}
                                            >
                                                <FiSend size={15} />
                                                <span>{isSubmittingReply ? '...' : t('notificationsPage.thread.reply')}</span>
                                            </button>
                                        </form>
                                    </div>
                                </div>
                            )}
                        </section>
                    </div>
                </div>

                {/* Compose Modal */}
                {isComposeOpen && (
                    <div className="notif-modal-overlay" onClick={() => setIsComposeOpen(false)}>
                        <div className="notif-modal-card" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header">
                                <div className="modal-header-icon">
                                    <FiMail size={20} />
                                </div>
                                <div className="modal-header-text">
                                    <h3>{t('notificationsPage.composeModal.title')}</h3>
                                    <p>ส่งข้อความหรือจดหมายถึงเพื่อนร่วมชั้นหรือคุณครู</p>
                                </div>
                                <button className="modal-close-btn" onClick={() => setIsComposeOpen(false)}>×</button>
                            </div>

                            <form onSubmit={handleSendMessage} className="modal-form">
                                <div className="form-group">
                                    <label>{t('notificationsPage.composeModal.recipient')} *</label>
                                    {selectedRecipient ? (
                                        <div className="selected-recipient-pill">
                                            <div className="recipient-info">
                                                <span className="name">{selectedRecipient.displayName}</span>
                                                <span className="email">({selectedRecipient.email})</span>
                                            </div>
                                            <button
                                                type="button"
                                                className="remove-recipient-btn"
                                                onClick={() => setSelectedRecipient(null)}
                                            >×</button>
                                        </div>
                                    ) : (
                                        <div className="recipient-search-wrap">
                                            <input
                                                type="text"
                                                className="form-input"
                                                placeholder={t('notificationsPage.composeModal.recipientPlaceholder')}
                                                value={recipientQuery}
                                                onChange={(e) => setRecipientQuery(e.target.value)}
                                                autoFocus
                                            />
                                            {isSearchingRecipients && <div className="searching-spinner"></div>}

                                            {recipientResults.length > 0 && (
                                                <div className="recipients-dropdown-list">
                                                    {recipientResults.map((r) => (
                                                        <div
                                                            key={r.id}
                                                            className="recipient-dropdown-item"
                                                            onClick={() => {
                                                                setSelectedRecipient(r);
                                                                setRecipientQuery('');
                                                                setRecipientResults([]);
                                                            }}
                                                        >
                                                            <div className="item-avatar">
                                                                {r.photoURL ? (
                                                                    <img src={r.photoURL} alt="" />
                                                                ) : (
                                                                    <span>{r.displayName.charAt(0)}</span>
                                                                )}
                                                            </div>
                                                            <div className="item-text">
                                                                <span className="item-name">{r.displayName}</span>
                                                                <span className="item-email">{r.email}</span>
                                                            </div>
                                                            {r.role === 'admin' && <span className="item-badge admin">แอดมิน</span>}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <div className="form-row-2">
                                    <div className="form-group flex-1">
                                        <label>{t('notificationsPage.composeModal.subject')} *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            placeholder={t('notificationsPage.composeModal.subjectPlaceholder')}
                                            value={composeSubject}
                                            onChange={(e) => setComposeSubject(e.target.value)}
                                            required
                                        />
                                    </div>
                                    <div className="form-group priority-col">
                                        <label>{t('notificationsPage.composeModal.priority')}</label>
                                        <select
                                            className="form-select"
                                            value={composePriority}
                                            onChange={(e) => setComposePriority(e.target.value)}
                                        >
                                            <option value="normal">{t('notificationsPage.status.priority.normal')}</option>
                                            <option value="urgent">{t('notificationsPage.status.priority.urgent')}</option>
                                            <option value="low">{t('notificationsPage.status.priority.low')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>{t('notificationsPage.composeModal.body')} *</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={5}
                                        placeholder={t('notificationsPage.composeModal.bodyPlaceholder')}
                                        value={composeBody}
                                        onChange={(e) => setComposeBody(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="modal-actions">
                                    <button
                                        type="button"
                                        className="btn-clean btn-clean-ghost"
                                        onClick={() => setIsComposeOpen(false)}
                                    >
                                        {t('notificationsPage.composeModal.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-clean btn-clean-primary"
                                        disabled={isSendingMessage || !selectedRecipient}
                                    >
                                        <FiSend size={15} />
                                        <span>{isSendingMessage ? 'กำลังส่ง...' : t('notificationsPage.composeModal.send')}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}

                {/* Support Ticket Modal */}
                {isTicketModalOpen && (
                    <div className="notif-modal-overlay" onClick={() => setIsTicketModalOpen(false)}>
                        <div className="notif-modal-card" onClick={(e) => e.stopPropagation()}>
                            <div className="modal-header ticket-header">
                                <div className="modal-header-icon ticket-icon">
                                    <FaTicketAlt size={20} />
                                </div>
                                <div className="modal-header-text">
                                    <h3>{t('notificationsPage.ticketModal.title')}</h3>
                                    <p>ส่งคำร้องหรือรายงานปัญหาตรงถึงทีมงานผู้ดูแลระบบ</p>
                                </div>
                                <button className="modal-close-btn" onClick={() => setIsTicketModalOpen(false)}>×</button>
                            </div>

                            <div className="modal-notice-banner">
                                <FiHelpCircle size={18} className="notice-icon" />
                                <span>{t('notificationsPage.ticketModal.notice')}</span>
                            </div>

                            <form onSubmit={handleSubmitTicket} className="modal-form">
                                <div className="form-row-2">
                                    <div className="form-group flex-1">
                                        <label>{t('notificationsPage.ticketModal.category')} *</label>
                                        <select
                                            className="form-select"
                                            value={ticketCategory}
                                            onChange={(e) => setTicketCategory(e.target.value)}
                                        >
                                            <option value="general">{t('notificationsPage.categories.general')}</option>
                                            <option value="bug">{t('notificationsPage.categories.bug')}</option>
                                            <option value="classroom">{t('notificationsPage.categories.classroom')}</option>
                                            <option value="account">{t('notificationsPage.categories.account')}</option>
                                            <option value="feedback">{t('notificationsPage.categories.feedback')}</option>
                                        </select>
                                    </div>
                                    <div className="form-group priority-col">
                                        <label>{t('notificationsPage.ticketModal.priority')}</label>
                                        <select
                                            className="form-select"
                                            value={ticketPriority}
                                            onChange={(e) => setTicketPriority(e.target.value)}
                                        >
                                            <option value="normal">{t('notificationsPage.status.priority.normal')}</option>
                                            <option value="urgent">{t('notificationsPage.status.priority.urgent')}</option>
                                            <option value="low">{t('notificationsPage.status.priority.low')}</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>{t('notificationsPage.ticketModal.subject')} *</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        placeholder={t('notificationsPage.ticketModal.subjectPlaceholder')}
                                        value={ticketSubject}
                                        onChange={(e) => setTicketSubject(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>{t('notificationsPage.ticketModal.body')} *</label>
                                    <textarea
                                        className="form-textarea"
                                        rows={5}
                                        placeholder={t('notificationsPage.ticketModal.bodyPlaceholder')}
                                        value={ticketBody}
                                        onChange={(e) => setTicketBody(e.target.value)}
                                        required
                                    />
                                </div>

                                <div className="modal-actions">
                                    <button
                                        type="button"
                                        className="btn-clean btn-clean-ghost"
                                        onClick={() => setIsTicketModalOpen(false)}
                                    >
                                        {t('notificationsPage.ticketModal.cancel')}
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-clean btn-clean-primary"
                                        disabled={isSubmittingTicket}
                                    >
                                        <FaTicketAlt size={14} />
                                        <span>{isSubmittingTicket ? 'กำลังส่งตั๋ว...' : t('notificationsPage.ticketModal.submit')}</span>
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </>
    );
};

export default NotificationsPage;
