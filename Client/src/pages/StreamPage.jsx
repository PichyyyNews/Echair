// src/pages/StreamPage.jsx

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import Lottie from 'lottie-react';
import {
    FaBullhorn,
    FaCalendarCheck,
    FaCheckCircle,
    FaClipboardList,
    FaClock,
    FaCommentDots,
    FaChevronDown,
    FaChevronUp,
    FaCopy,
    FaLayerGroup,
    FaRegFileAlt,
    FaTimes,
    FaUsers
} from 'react-icons/fa';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';
import CreatePostBox from '../components/CreatePostBox';
import StreamPost from '../components/StreamPost';
import ClassChat from '../components/ClassChat';
import ClassworkSection from '../components/ClassworkSection';
import CalendarSection from '../components/CalendarSection';
import { useSocket } from '../hooks/useSocket';
import API_BASE_URL from '../config/api';
import businessGroupMeetingAnimation from '../assets/business-group-meeting.json';
import '../CSS/ClassDetailPage.css';
import '../CSS/ClassroomPage.css';
import '../CSS/Navbar.css';
import '../CSS/Main.css';
import '../CSS/StreamPage.css';
import { useTranslation } from 'react-i18next';


const normalizeUserIds = (items) => {
    if (!items) return [];

    const list = Array.isArray(items) ? items : [items];
    return list
        .map((item) => {
            if (!item) return null;
            if (typeof item === 'string') return item;
            return item._id || item.id || null;
        })
        .filter(Boolean)
        .map((value) => String(value));
};

const formatStatValue = (value) => new Intl.NumberFormat().format(value || 0);
const STREAM_SMALL_MOBILE_BREAKPOINT = 480;
const STREAM_MOBILE_BREAKPOINT = 900;
const STREAM_TABLET_BREAKPOINT = 1180;

const getStreamLayoutMode = () => {
    if (typeof window === 'undefined') return 'desktop';
    if (window.innerWidth <= STREAM_SMALL_MOBILE_BREAKPOINT) return 'small-mobile';
    if (window.innerWidth <= STREAM_MOBILE_BREAKPOINT) return 'mobile';
    if (window.innerWidth <= STREAM_TABLET_BREAKPOINT) return 'tablet';
    return 'desktop';
};

const StreamStatBlobBg = () => (
    <svg className="stream-stat-bg-svg stream-stat-bg-svg--blob" fill="currentColor" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.3,-46.1C90.8,-33.1,96.8,-16.6,95.5,-0.7C94.2,15.1,85.6,30.3,74.6,42.4C63.6,54.5,50.2,63.5,35.6,71.1C21,78.7,5.2,84.9,-9.8,83.9C-24.8,82.9,-39.1,74.7,-51.9,64.4C-64.7,54.1,-76.1,41.7,-82.2,26.9C-88.3,12.1,-89.1,-5,-83.9,-19.6C-78.7,-34.2,-67.5,-46.3,-54.6,-54.3C-41.7,-62.3,-27.1,-66.2,-13.2,-70.6C0.7,-75,14.6,-79.9,30.6,-83.4C44.7,-76.4,44.7,-76.4,44.7,-76.4Z" transform="translate(100 100)" />
    </svg>
);

const StreamStatGridBg = ({ patternId }) => (
    <svg className="stream-stat-bg-svg stream-stat-bg-svg--grid" viewBox="0 0 96 96" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
            <pattern id={patternId} width="12" height="12" patternUnits="userSpaceOnUse">
                <circle cx="1.5" cy="1.5" r="1.5" fill="currentColor" />
            </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
);

const StreamStatCirclesBg = () => (
    <svg className="stream-stat-bg-svg stream-stat-bg-svg--circles" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="140" cy="60" r="60" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="60" cy="140" r="40" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
);

const StreamStatTopographyBg = () => (
    <svg className="stream-stat-bg-svg stream-stat-bg-svg--topography" viewBox="0 0 400 100" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path fill="none" stroke="currentColor" strokeWidth="1" d="M-50 20 Q 100 -20 200 50 T 450 20" />
        <path fill="none" stroke="currentColor" strokeWidth="1" d="M-50 40 Q 100 0 200 70 T 450 40" />
        <path fill="none" stroke="currentColor" strokeWidth="1" d="M-50 60 Q 100 20 200 90 T 450 60" />
    </svg>
);

const renderStreamStatBackground = () => null;

const StreamStatIcon = ({ type }) => {
    switch (type) {
        case 'posts':
        case 'announcements':
            return <FaBullhorn className="stream-stat-icon-svg" aria-hidden="true" />;
        case 'assignments':
            return <FaClipboardList className="stream-stat-icon-svg" aria-hidden="true" />;
        case 'submitted':
            return <FaCheckCircle className="stream-stat-icon-svg" aria-hidden="true" />;
        case 'pending':
            return <FaClock className="stream-stat-icon-svg" aria-hidden="true" />;
        case 'comments':
            return <FaCommentDots className="stream-stat-icon-svg" aria-hidden="true" />;
        case 'participants':
        case 'classmates':
            return <FaUsers className="stream-stat-icon-svg" aria-hidden="true" />;
        case 'materials':
            return <FaRegFileAlt className="stream-stat-icon-svg" aria-hidden="true" />;
        default:
            return null;
    }
};

const StreamPage = ({ user, isSidebarOpen, toggleSidebar, handleSignOut }) => {
    const { classId } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useTranslation();
    const tr = useCallback((key, defaultValue, options = {}) => t(key, { defaultValue, ...options }), [t]);

    const [classroom, setClassroom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [postsLoading, setPostsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeSection, setActiveSection] = useState(location.state?.activeTab || 'stream');
    const [posts, setPosts] = useState([]);
    const [classworkAssignments, setClassworkAssignments] = useState([]);
    const [streamLayoutMode, setStreamLayoutMode] = useState(getStreamLayoutMode);
    const [isBannerCollapsed, setIsBannerCollapsed] = useState(() => getStreamLayoutMode() === 'mobile');
    const [isCodeCopied, setIsCodeCopied] = useState(false);
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);

    const [chatMessages, setChatMessages] = useState([]);
    const [classroomEvents, setClassroomEvents] = useState([]);
    const previousLayoutModeRef = useRef(streamLayoutMode);

    const isCompactStreamLayout = streamLayoutMode === 'mobile' || streamLayoutMode === 'small-mobile';
    const isTabletStreamLayout = streamLayoutMode === 'tablet';
    const isSmallMobile = streamLayoutMode === 'small-mobile';

    const creatorIds = useMemo(() => normalizeUserIds(classroom?.creator), [classroom]);
    const isCreator = creatorIds.includes(String(user?.id));

    const streamStats = useMemo(() => {
        const studentParticipants = Array.isArray(classroom?.participants)
            ? classroom.participants.filter(p => !creatorIds.includes(String(p?._id || p?.id || p)))
            : [];
        const studentCount = studentParticipants.length;

        // For Students: only show stats that are necessary and actionable for them
        if (!isCreator) {
            const announcementsCount = posts.filter(p => p.type !== 'assignment').length;
            const totalAssignments = classworkAssignments.length > 0
                ? classworkAssignments.length
                : posts.filter(p => p.type === 'assignment').length;
            const submittedCount = classworkAssignments.filter(a => Boolean(a.submission)).length;
            const pendingCount = Math.max(0, totalAssignments - submittedCount);

            return [
                {
                    key: 'announcements',
                    label: tr('streamPage.stats.announcements', 'Announcements'),
                    value: announcementsCount,
                    variant: 1
                },
                {
                    key: 'assignments',
                    label: tr('streamPage.stats.assignments', 'Assignments'),
                    value: totalAssignments,
                    variant: 2
                },
                {
                    key: 'submitted',
                    label: tr('streamPage.stats.submitted', 'Turned In'),
                    value: submittedCount,
                    variant: 3
                },
                {
                    key: 'pending',
                    label: tr('streamPage.stats.pending', 'Pending'),
                    value: pendingCount,
                    variant: 4
                }
            ];
        }

        // For Teachers: show overall classroom metrics
        const totalComments = posts.reduce((sum, post) => sum + (post.comments?.length || 0), 0);
        const totalAttachments = posts.reduce((sum, post) => sum + (post.attachments?.length || 0), 0);

        return [
            {
                key: 'posts',
                label: tr('streamPage.stats.posts', 'Posts'),
                value: posts.length,
                variant: 1
            },
            {
                key: 'comments',
                label: tr('streamPage.stats.comments', 'Comments'),
                value: totalComments,
                variant: 2
            },
            {
                key: 'participants',
                label: tr('streamPage.stats.participants', 'Students'),
                value: studentCount,
                variant: 3
            },
            {
                key: 'materials',
                label: tr('streamPage.stats.materials', 'Attachments'),
                value: totalAttachments,
                variant: 4
            }
        ];
    }, [classroom, creatorIds, isCreator, posts, classworkAssignments, tr]);

    const handleChatMessage = useCallback((data) => {
        setChatMessages((prev) => [...prev, data]);
    }, []);

    const handleClassroomEventAdded = useCallback((data) => {
        setClassroomEvents((prev) => {
            if (prev.some((eventItem) => eventItem.id === data.id)) return prev;
            return [...prev, data];
        });
    }, []);

    const noop = () => {};

    const { emitChatMessage, emitSubmitEventAnswer } = useSocket(
        classId,
        user,
        noop,
        noop,
        noop,
        noop,
        handleChatMessage,
        handleClassroomEventAdded,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop,
        noop
    );

    useEffect(() => {
        if (location.state?.activeTab) {
            setActiveSection(location.state.activeTab);
        }
    }, [location.state]);

    useEffect(() => {
        const handleResize = () => {
            setStreamLayoutMode(getStreamLayoutMode());
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        const previousLayoutMode = previousLayoutModeRef.current;

        if ((streamLayoutMode === 'mobile' || streamLayoutMode === 'small-mobile') && previousLayoutMode !== 'mobile' && previousLayoutMode !== 'small-mobile') {
            setIsBannerCollapsed(true);
        }

        if ((previousLayoutMode === 'mobile' || previousLayoutMode === 'small-mobile') && streamLayoutMode !== 'mobile' && streamLayoutMode !== 'small-mobile') {
            setIsBannerCollapsed(false);
        }

        previousLayoutModeRef.current = streamLayoutMode;
    }, [streamLayoutMode]);

    useEffect(() => {
        if (!isCodeCopied) return undefined;

        const timeoutId = window.setTimeout(() => {
            setIsCodeCopied(false);
        }, 1600);

        return () => window.clearTimeout(timeoutId);
    }, [isCodeCopied]);

    const fetchClassroomDetails = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/classrooms/${classId}`, {
                headers: { 'x-auth-token': user.token }
            });

            setClassroom(response.data);

            if (response.data.chatMessages) {
                setChatMessages(response.data.chatMessages);
            }

            if (response.data.classroomEvents) {
                setClassroomEvents(response.data.classroomEvents);
            }

            setLoading(false);
        } catch (err) {
            if (err.response?.status === 403 && err.response?.data?.requiresInvitation) {
                setError(tr('streamPage.privateClassError', 'This classroom is private and requires an invitation to access.'));
            } else {
                setError(tr('streamPage.loadError', 'Failed to load classroom details.'));
            }
            setLoading(false);
            console.error('Error fetching classroom details:', err);
        }
    }, [classId, user.token, tr]);

    useEffect(() => {
        if (!user || !user.token || !classId) return;
        fetchClassroomDetails();
    }, [classId, user, fetchClassroomDetails]);

    const fetchClassworkData = useCallback(async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/classwork/${classId}`, {
                headers: { 'x-auth-token': user.token }
            });
            setClassworkAssignments(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching classwork data for stream stats:', err);
        }
    }, [classId, user.token]);

    useEffect(() => {
        if (classroom) {
            fetchClassworkData();
        }
    }, [classroom, fetchClassworkData]);

    const fetchStreamPosts = useCallback(async () => {
        setPostsLoading(true);

        try {
            const res = await axios.get(`${API_BASE_URL}/api/stream/${classId}`, {
                headers: { 'x-auth-token': user.token }
            });
            setPosts(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            console.error('Error fetching stream posts:', err);
            setPosts([]);
        } finally {
            setPostsLoading(false);
        }
    }, [classId, user.token]);

    useEffect(() => {
        if (classroom) {
            fetchStreamPosts();
        }
    }, [classroom, fetchStreamPosts]);

    const handlePostCreated = (newPost) => {
        setPosts((prev) => [newPost, ...prev]);
    };

    const handlePostDeleted = (deletedPostId) => {
        setPosts((prev) => prev.filter((post) => post._id !== deletedPostId));
    };

    const handleAddComment = async (postId, text) => {
        try {
            const res = await axios.post(
                `${API_BASE_URL}/api/stream/${classId}/${postId}/comment`,
                { text },
                { headers: { 'x-auth-token': user.token } }
            );

            setPosts((prev) => prev.map((post) => (post._id === postId ? res.data : post)));
        } catch (err) {
            console.error('Error adding comment:', err);
            throw err;
        }
    };

    const handleDeleteComment = async (postId, commentId) => {
        try {
            await axios.delete(`${API_BASE_URL}/api/stream/${classId}/${postId}/comment/${commentId}`, {
                headers: { 'x-auth-token': user.token }
            });

            setPosts((prev) => prev.map((post) => {
                if (post._id === postId) {
                    return { ...post, comments: post.comments.filter((comment) => comment._id !== commentId) };
                }
                return post;
            }));
        } catch (err) {
            console.error('Error deleting comment:', err);
            throw err;
        }
    };

    const handleSectionChange = (section) => {
        setActiveSection(section);
    };

    const handleCopyClassCode = async () => {
        if (!classroom?.classCode) return;

        try {
            await navigator.clipboard.writeText(classroom.classCode);
            setIsCodeCopied(true);
        } catch (err) {
            console.error('Failed to copy class code:', err);
        }
    };

    const renderFeedState = () => {
        if (postsLoading) {
            return (
                <div className="stream-feed-loading">
                    {[0, 1, 2].map((item) => (
                        <div key={item} className="stream-loading-card">
                            <div className="stream-loading-head">
                                <div className="stream-loading-avatar" />
                                <div className="stream-loading-copy">
                                    <span className="stream-loading-line short" />
                                    <span className="stream-loading-line tiny" />
                                </div>
                            </div>
                            <span className="stream-loading-line full" />
                            <span className="stream-loading-line medium" />
                            <div className="stream-loading-block" />
                            <span className="stream-loading-line full" />
                        </div>
                    ))}
                </div>
            );
        }

        if (posts.length === 0) {
            return (
                <div className="stream-feed-state">
                    <div className="stream-feed-state-icon">
                        <FaBullhorn />
                    </div>
                    <h3>{tr('streamPage.noPostsTitle', 'No posts yet')}</h3>
                    <p>
                        {isCreator
                            ? tr('streamPage.emptyTeacherText', 'Start the class stream by sharing an announcement, lesson note, or attachment for your students.')
                            : tr('streamPage.noPostsText', 'Announcements, assignments, and class materials posted by your teacher will appear here.')}
                    </p>
                </div>
            );
        }

        return posts.map((post) => (
            <StreamPost
                key={post._id}
                post={post}
                user={user}
                isCreator={isCreator}
                creatorIds={creatorIds}
                classId={classId}
                onDelete={handlePostDeleted}
                onAddComment={handleAddComment}
                onDeleteComment={handleDeleteComment}
            />
        ));
    };

    const renderDesktopHero = () => {
        if (isBannerCollapsed) {
            return (
                <button
                    type="button"
                    className="stream-hero-compact"
                    onClick={() => setIsBannerCollapsed(false)}
                    style={{ '--stream-hero-theme': classroom?.color || '#7ec282' }}
                >
                    <div className="stream-hero-compact-copy">
                        <span className="stream-hero-kicker">
                            {tr('streamPage.streamLabel', 'Class Stream')}
                        </span>
                        <span className="stream-hero-compact-title">{classroom?.name}</span>
                        <small className="stream-hero-compact-subtitle">
                            {tr('streamPage.showBannerBtn', 'Show class overview')}
                        </small>
                    </div>
                    <div className="stream-hero-compact-meta">
                        {classroom?.classCode && (
                            <span className="stream-code-pill">
                                <FaCopy />
                                <span>{classroom.classCode}</span>
                            </span>
                        )}
                        <span className="stream-hero-compact-toggle">
                            {tr('streamPage.showBannerBtn', 'Show class overview')}
                            <FaChevronDown />
                        </span>
                    </div>
                </button>
            );
        }

        return (
            <section
                className="stream-hero-card has-animation"
                style={{ '--stream-hero-theme': classroom?.color || '#10b981' }}
            >
                
                <div className="stream-hero-main">
                    <div className="stream-hero-top">
                        <span className="stream-hero-kicker">
                            {tr('streamPage.streamLabel', 'Class Stream')}
                        </span>
                        <button
                            type="button"
                            className="stream-hero-collapse-btn"
                            onClick={() => setIsBannerCollapsed(true)}
                            title={tr('streamPage.collapseBannerTitle', 'Collapse banner')}
                        >
                            <FaChevronUp />
                        </button>
                    </div>

                    <div className="stream-hero-copy">
                        <h1 className="stream-hero-title">{classroom?.name}</h1>
                        <p className="stream-hero-subtitle">
                            {classroom?.subname || tr('streamPage.heroSubtitle', 'Announcements, discussion, and classroom updates all in one place.')}
                        </p>
                        {classroom?.classCode && (
                            <button
                                type="button"
                                className={`stream-code-pill stream-code-pill--title ${isCodeCopied ? 'is-copied' : ''}`}
                                onClick={handleCopyClassCode}
                                title={tr('streamPage.copyCodeTitle', 'Click to copy class code')}
                            >
                                {isCodeCopied ? <FaCheckCircle /> : <FaCopy />}
                                <span>{isCodeCopied ? tr('streamPage.codeCopied', 'Copied') : classroom.classCode}</span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="stream-stat-grid">
                    {streamStats.map((stat) => (
                        <div key={stat.key} className="stream-stat-card">
                            <div className="stream-stat-card-shell">
                                <div className="stream-stat-copy">
                                    <span className="stream-stat-label">{stat.label}</span>
                                    <strong className="stream-stat-value">{formatStatValue(stat.value)}</strong>
                                </div>
                                <div className="stream-stat-icon-box">
                                    <StreamStatIcon type={stat.key} />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="stream-hero-art stream-hero-art--animation">
                    <div className="stream-hero-art-stack">
                        <div className="stream-hero-animation" aria-hidden="true">
                            <Lottie
                                animationData={businessGroupMeetingAnimation}
                                loop={true}
                                autoplay={true}
                                className="stream-hero-lottie"
                            />
                        </div>
                    </div>
                </div>
            </section>
        );
    };

    const renderMobileHero = () => (
        <section
            className={`stream-hero-compact is-mobile ${isSmallMobile ? 'is-small-mobile' : ''}`}
            style={{ '--stream-hero-theme': classroom?.color || '#10b981' }}
        >
            <div className="stream-hero-compact-copy">
                <span className="stream-hero-kicker">
                    {tr('streamPage.streamLabel', 'Class Stream')}
                </span>
                <div className="stream-hero-compact-heading-row">
                    <h1 className="stream-hero-compact-title">{classroom?.name}</h1>
                    {classroom?.classCode && (
                        <button
                            type="button"
                            className={`stream-code-pill stream-code-pill--title ${isCodeCopied ? 'is-copied' : ''}`}
                            onClick={handleCopyClassCode}
                            title={tr('streamPage.copyCodeTitle', 'Click to copy class code')}
                        >
                            {isCodeCopied ? <FaCheckCircle /> : <FaCopy />}
                            <span>{isCodeCopied ? tr('streamPage.codeCopied', 'Copied') : classroom.classCode}</span>
                        </button>
                    )}
                </div>
                {!isSmallMobile && (
                    <p className="stream-hero-compact-subtitle">
                        {classroom?.subname || tr('streamPage.heroSubtitle', 'Announcements, discussion, and classroom updates all in one place.')}
                    </p>
                )}
                <div className="stream-mobile-stat-strip">
                    {streamStats.map((stat) => (
                        <div key={stat.key} className="stream-mobile-stat-pill">
                            <div className="stream-mobile-stat-pill-icon">
                                <StreamStatIcon type={stat.key} />
                            </div>
                            <strong className="stream-mobile-stat-val">{formatStatValue(stat.value)}</strong>
                            <span className="stream-mobile-stat-lbl">{stat.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );

    const renderFeedColumn = () => (
        <div className="stream-main-stack">
            {isCreator && (
                <CreatePostBox
                    classId={classId}
                    user={user}
                    classroomName={classroom?.name}
                    accentColor={classroom?.color}
                    onPostCreated={handlePostCreated}
                />
            )}

            <div className="stream-feed">{renderFeedState()}</div>
        </div>
    );

    const renderDesktopChatSidebar = () => (
        <aside className="stream-sidebar">
            <div className="stream-side-card stream-side-card--chat">
                <div className="stream-chat-classic-shell is-pinned">
                    <ClassChat
                        user={user}
                        isCreator={isCreator}
                        chatMessages={chatMessages}
                        classroomEvents={classroomEvents}
                        emitChatMessage={emitChatMessage}
                        onSubmitAnswer={(eventItem, answer) => emitSubmitEventAnswer(eventItem.id, answer)}
                        isSidebarMode={true}
                    />
                </div>
            </div>
        </aside>
    );

    const renderInlineChatPanel = (extraClassName = '') => (
        <section className={`stream-inline-chat ${extraClassName}`.trim()}>
            <div className="stream-side-card stream-side-card--chat stream-side-card--inline">
                <div className="stream-chat-classic-shell stream-chat-classic-shell--inline">
                    <ClassChat
                        user={user}
                        isCreator={isCreator}
                        chatMessages={chatMessages}
                        classroomEvents={classroomEvents}
                        emitChatMessage={emitChatMessage}
                        onSubmitAnswer={(eventItem, answer) => emitSubmitEventAnswer(eventItem.id, answer)}
                        isSidebarMode={true}
                    />
                </div>
            </div>
        </section>
    );

    const renderStreamSection = () => (
        <div className={`stream-page-container stream-layout-${streamLayoutMode}`}>
            <div className="stream-shell">
                {isCompactStreamLayout ? (
                    <>
                        {renderMobileHero()}
                        {renderFeedColumn()}
                        <button
                            type="button"
                            className="stream-mobile-chat-fab"
                            onClick={() => setIsMobileChatOpen(true)}
                            aria-label={tr('streamPage.openChat', 'Open Class Chat')}
                        >
                            <FaCommentDots />
                            <span>{tr('streamPage.chatBtn', 'Chat')}</span>
                            {chatMessages.length > 0 && <span className="stream-chat-fab-badge">{chatMessages.length}</span>}
                        </button>
                        {isMobileChatOpen && (
                            <div className="stream-mobile-chat-sheet-backdrop" onClick={() => setIsMobileChatOpen(false)}>
                                <div className="stream-mobile-chat-sheet" onClick={(e) => e.stopPropagation()}>
                                    <div className="stream-mobile-chat-sheet-header">
                                        <div className="stream-mobile-chat-sheet-title">
                                            <FaCommentDots />
                                            <span>{tr('streamPage.classChatTitle', 'Class Chat')}</span>
                                        </div>
                                        <button
                                            type="button"
                                            className="stream-mobile-chat-close-btn"
                                            onClick={() => setIsMobileChatOpen(false)}
                                            aria-label="Close Chat"
                                        >
                                            <FaTimes />
                                        </button>
                                    </div>
                                    <div className="stream-mobile-chat-sheet-body">
                                        <ClassChat
                                            user={user}
                                            isCreator={isCreator}
                                            chatMessages={chatMessages}
                                            classroomEvents={classroomEvents}
                                            emitChatMessage={emitChatMessage}
                                            onSubmitAnswer={(eventItem, answer) => emitSubmitEventAnswer(eventItem.id, answer)}
                                            isSidebarMode={true}
                                            onClose={() => setIsMobileChatOpen(false)}
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : isTabletStreamLayout ? (
                    <div className="stream-tablet-layout">
                        {renderDesktopHero()}
                        {renderInlineChatPanel('stream-inline-chat--tablet')}
                        {renderFeedColumn()}
                    </div>
                ) : (
                    <div className="stream-desktop-layout">
                        <div className="stream-primary-column">
                            {renderDesktopHero()}
                            {renderFeedColumn()}
                        </div>
                        {renderDesktopChatSidebar()}
                    </div>
                )}
            </div>
        </div>
    );

    const renderContent = () => {
        switch (activeSection) {
            case 'stream':
                return renderStreamSection();
            case 'classwork':
                return (
                    <ClassworkSection
                        classId={classId}
                        user={user}
                        isCreator={isCreator}
                    />
                );
            case 'calendar':
                return (
                    <CalendarSection
                        classId={classId}
                        user={user}
                        isCreator={isCreator}
                        classroom={classroom}
                    />
                );
            default:
                return null;
        }
    };

    if (loading) {
        return <Loader />;
    }

    if (error) {
        return <div className="error">{error}</div>;
    }

    if (!classroom) {
        return <div className="error">{tr('streamPage.notFoundError', 'Classroom not found.')}</div>;
    }

    return (
        <>
            <Navbar
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={toggleSidebar}
                user={user}
                handleSignOut={handleSignOut}
                isStreamPage={true}
                streamActiveSection={activeSection}
                onStreamSectionChange={handleSectionChange}
                onClassroomBackClick={() => navigate(`/classroom/${classId}`)}
                classroom={classroom}
            />
            <main className={`main__content ${isSidebarOpen ? 'shift' : ''}`}>
                <div className="classroom-subnav-bar">
                    <div className="classroom-subnav-inner">
                        <button
                            type="button"
                            className={`classroom-nav-pill ${activeSection === 'stream' ? 'active' : ''}`}
                            onClick={() => handleSectionChange('stream')}
                        >
                            <FaBullhorn className="classroom-nav-pill-icon" />
                            <span>{tr('navbar.stream.stream', 'Stream')}</span>
                            {posts.length > 0 && <span className="classroom-nav-pill-count">{posts.length}</span>}
                        </button>
                        <button
                            type="button"
                            className={`classroom-nav-pill ${activeSection === 'classwork' ? 'active' : ''}`}
                            onClick={() => handleSectionChange('classwork')}
                        >
                            <FaLayerGroup className="classroom-nav-pill-icon" />
                            <span>{tr('navbar.stream.classwork', 'Classwork')}</span>
                        </button>
                        <button
                            type="button"
                            className={`classroom-nav-pill ${activeSection === 'calendar' ? 'active' : ''}`}
                            onClick={() => handleSectionChange('calendar')}
                        >
                            <FaCalendarCheck className="classroom-nav-pill-icon" />
                            <span>{tr('navbar.stream.calendar', 'Calendar')}</span>
                        </button>
                    </div>
                </div>
                <div className={`class-detail-container ${activeSection === 'stream' ? 'class-detail-container--stream' : ''}`}>
                    {renderContent()}
                </div>
            </main>
        </>
    );
};

export default StreamPage;
