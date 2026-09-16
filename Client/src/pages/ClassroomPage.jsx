// src/pages/ClassroomPage.jsx

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import Swal from 'sweetalert2';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';
import '../CSS/ClassroomPage.css';
import '../CSS/Navbar.css';
import '../CSS/Main.css';
import { getProfileImageSrc, isGoogleUser } from '../utils/profileImageHelper';
import Chair from '../components/Chair';
import ChairAssignModal from '../components/ChairAssignModal';
import ChairPresets from '../components/ChairPresets';
import ChairDropdown from '../components/ChairDropdown';
import StudentRatingModal from '../components/StudentRatingModal';
import { useSocket } from '../hooks/useSocket';
import API_BASE_URL from '../config/api';


import { FaSearch, FaChalkboardTeacher, FaEdit, FaCheck, FaTimes, FaUndo, FaTrash, FaObjectGroup, FaUsers, FaTh, FaThLarge, FaSave, FaUserPlus, FaEllipsisV, FaHandPaper, FaDownload, FaCrown, FaUserCog, FaRobot, FaMicrophone, FaRegLightbulb, FaSmile, FaImages, FaPlay, FaMedal, FaExternalLinkAlt, FaClock, FaComment, FaLink, FaUsersSlash, FaChevronDown, FaChevronUp, FaUserCheck } from 'react-icons/fa';
import ActionBar from '../components/ActionBar';
import { motion, AnimatePresence } from 'framer-motion';
import GroupOverlay from '../components/GroupOverlay';
import ClassroomEvent from '../components/ClassroomEvent';
import GroupingModal from '../components/GroupingModal';
import ViewToggle from '../components/ViewToggle'; // ✨ Import ViewToggle
import ClassChat from '../components/ClassChat'; // ✨ Import ClassChat
import StudentStatusBanner from '../components/StudentStatusBanner'; // ✨ Import Performance Banner
import SessionSummaryModal from '../components/SessionSummaryModal'; // ✨ Import Session Summary Modal
import { useTranslation } from 'react-i18next';


const getTeacherViewStorageKey = (classId, userId) => {
    if (!classId) return null;
    return `teacher-front-view-${userId || 'anonymous'}-${classId}`;
};

const getSavedTeacherView = (classId, userId) => {
    if (typeof window === 'undefined') return false;

    const storageKey = getTeacherViewStorageKey(classId, userId);
    if (!storageKey) return false;

    try {
        const saved = window.localStorage.getItem(storageKey);
        return saved ? JSON.parse(saved) : false;
    } catch (error) {
        console.warn('Failed to read saved teacher view state:', error);
        return false;
    }
};

const saveTeacherViewPreference = (classId, userId, value) => {
    if (typeof window === 'undefined') return;

    const storageKey = getTeacherViewStorageKey(classId, userId);
    if (!storageKey) return;

    try {
        window.localStorage.setItem(storageKey, JSON.stringify(Boolean(value)));
    } catch (error) {
        console.warn('Failed to save teacher view state:', error);
    }
};


const ClassroomPage = ({ user, isSidebarOpen, toggleSidebar, handleSignOut }) => {
    const { classId } = useParams();
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [classroom, setClassroom] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [seatingPositions, setSeatingPositions] = useState({});
    const [isEditing, setIsEditing] = useState(false);
    const isEditingRef = useRef(isEditing);
    useEffect(() => {
        isEditingRef.current = isEditing;
    }, [isEditing]);
    const editModeBaseSizeRef = useRef(null);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false); // ✨ State for grouping modal
    const [isChatSidebarOpen, setIsChatSidebarOpen] = useState(() => {
        // ✨ Read from localStorage, default to true (open) on desktop, false on mobile
        const saved = localStorage.getItem(`chat-sidebar-open-${classId}`);
        if (saved !== null) {
            return JSON.parse(saved);
        }
        // Default: closed on mobile, open on desktop
        const isMobile = window.innerWidth <= 768;
        return !isMobile;
    }); // ✨ Chat Sidebar State
    const [currentChairPositions, setCurrentChairPositions] = useState({});
    const [assignedUsers, setAssignedUsers] = useState({});
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedChairId, setSelectedChairId] = useState(null);
    const [isBannerCollapsed, setIsBannerCollapsed] = useState(true);
    const containerRef = useRef(null);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [dropdownPosition, setDropdownPosition] = useState({ x: 0, y: 0 });
    const [dropdownAnchorEl, setDropdownAnchorEl] = useState(null);
    const [selectedStudentChair, setSelectedStudentChair] = useState(null);
    const [ratingModalOpen, setRatingModalOpen] = useState(false);
    const [ratePresets, setRatePresets] = useState([]);
    const [studentScores, setStudentScores] = useState({});
    const [viewMode, setViewMode] = useState('seating'); // ✨ 'seating' or 'event'
    const [classroomEvents, setClassroomEvents] = useState([]); // ✨ State for classroom events
    const [attendance, setAttendance] = useState({}); // ✨ State for attendance
    const [attendanceDays, setAttendanceDays] = useState(0); // ✨ State for attendance days

    // Pan functionality state
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [scrollStart, setScrollStart] = useState({ x: 0, y: 0 });
    const seatingWrapperRef = useRef(null);
    const [isTeacherView, setIsTeacherView] = useState(() => getSavedTeacherView(classId, user?.id)); // ✨ State for toggling teacher view
    const [isViewChanging, setIsViewChanging] = useState(false); // ✨ State for loader animation

    const [chairGroups, setChairGroups] = useState([]); // ✨ State for chair groups
    const [isGroupingMode, setIsGroupingMode] = useState(false); // ✨ State for grouping mode
    const [groupSizeInput, setGroupSizeInput] = useState(2); // ✨ State for group size input
    const [selectedChairsForGroup, setSelectedChairsForGroup] = useState([]); // ✨ Selected chairs for creating a group

    // ✨ Raise Hand State
    const [raisedHands, setRaisedHands] = useState(new Set());

    // ✨ Emoji State
    const [activeEmojis, setActiveEmojis] = useState({}); // { userId: { emoji, timestamp } }
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);


    // ✨ Chat State
    const [chatMessages, setChatMessages] = useState([]);

    // ✨ Teaching Session State
    const [isSessionActive, setIsSessionActive] = useState(false);
    const [sessionStartTime, setSessionStartTime] = useState(null);
    const [sessionId, setSessionId] = useState(null);
    const [sessionScoreChanges, setSessionScoreChanges] = useState([]);
    const [sessionElapsed, setSessionElapsed] = useState(0);
    const [showSessionSummary, setShowSessionSummary] = useState(false);
    const [sessionSummaryData, setSessionSummaryData] = useState(null);
    const sessionTimerRef = useRef(null);

    const chatContainerRef = useRef(null);

    // Zoom functionality state (seating)
    const [zoomLevel, setZoomLevel] = useState(1);
    const minZoom = 0.5;
    const maxZoom = 3;

    // ✨ Separate zoom state for event view
    const [eventZoomLevel, setEventZoomLevel] = useState(1);
    const eventMinZoom = 0.3;
    const eventMaxZoom = 2;

    const getBoundsAndDimensions = useCallback((positions) => {
        const chairList = Object.values(positions || {}).filter(pos => pos && typeof pos.x === 'number');
        const chairCount = chairList.length;

        if (chairCount === 0) {
            const sidebarWidth = isSidebarOpen ? 250 : 0;
            return {
                width: Math.round((window.innerWidth - sidebarWidth - 40) * 0.8),
                height: Math.round((window.innerHeight - 200) * 0.8),
                minX: 0,
                minY: 0,
                padding: 100
            };
        }

        const chairWidth = 80;
        const chairHeight = 100;

        const bounds = chairList.reduce((acc, pos) => ({
            minX: Math.min(acc.minX, pos.x),
            maxX: Math.max(acc.maxX, pos.x),
            minY: Math.min(acc.minY, pos.y),
            maxY: Math.max(acc.maxY, pos.y)
        }), {
            minX: Infinity,
            maxX: -Infinity,
            minY: Infinity,
            maxY: -Infinity
        });

        const contentWidth = bounds.maxX + chairWidth - bounds.minX;
        const contentHeight = bounds.maxY + chairHeight - bounds.minY;
        const padding = 100;

        return {
            width: Math.round(contentWidth + (padding * 2)),
            height: Math.round(contentHeight + (padding * 2)),
            minX: bounds.minX === Infinity ? 0 : bounds.minX,
            minY: bounds.minY === Infinity ? 0 : bounds.minY,
            padding: padding
        };
    }, [isSidebarOpen]);

    // Auto-collapse banner on mobile
    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth <= 768) {
                setIsBannerCollapsed(true);
            }
        };

        // Check on initial load
        handleResize();

        // Add event listener
        window.addEventListener('resize', handleResize);

        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ✨ Persist chat sidebar state to localStorage
    useEffect(() => {
        localStorage.setItem(`chat-sidebar-open-${classId}`, JSON.stringify(isChatSidebarOpen));
    }, [isChatSidebarOpen, classId]);

    // ✨ Restore saved teacher/front view per classroom
    useEffect(() => {
        setIsTeacherView(getSavedTeacherView(classId, user?.id));
    }, [classId, user?.id]);

    // ✨ Cleanup session timer on unmount
    useEffect(() => {
        return () => {
            if (sessionTimerRef.current) {
                clearInterval(sessionTimerRef.current);
                sessionTimerRef.current = null;
            }
        };
    }, []);

    // Calculate isCreator early to avoid reference errors
    const isCreator = user && classroom?.creator && (
        (Array.isArray(classroom.creator) ? classroom.creator.some(c => c._id === user.id) : classroom.creator._id === user.id)
    );

    const handleScoreUpdate = useCallback((data) => {
        console.log('Received score update:', data);

        setStudentScores(prev => ({
            ...prev,
            [data.studentId]: data.newScore // data.newScore is now the full score object for the student
        }));

        if (data.updatedBy !== user.id) {
            const studentName = data.studentName || 'a student';
            Swal.fire({
                icon: 'info',
                title: t('classroomPage.swal.scoreUpdatedTitle') || 'Score Updated',
                text: t('classroomPage.swal.scoreUpdatedText', { presetName: data.presetName, studentName: studentName }) || `${data.presetName} applied to ${studentName}`,
                timer: 3000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true,
            });
        }
    }, [user.id]);

    // Placeholder handlers for new interaction actions
    // Placeholder handlers for new interaction actions
    const handleRaiseHand = () => {
        const isRaised = raisedHands.has(user.id);
        const newRaisedState = !isRaised;

        // Optimistic update
        setRaisedHands(prev => {
            const next = new Set(prev);
            if (newRaisedState) {
                next.add(user.id);
            } else {
                next.delete(user.id);
            }
            return next;
        });

        emitRaiseHand(newRaisedState);

        // Show feedback
        if (newRaisedState) {
            Swal.fire({
                icon: 'info',
                title: 'Hand Raised',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 1500
            });
        }
    };

    const handleEmoji = () => {
        setIsEmojiPickerOpen(prev => !prev);
    };

    const handleSendEmoji = (emoji) => {
        // ✨ Check if hand is raised
        if (raisedHands.has(user.id)) {
            // Lower hand locally
            setRaisedHands(prev => {
                const next = new Set(prev);
                next.delete(user.id);
                return next;
            });
            // Emit raise hand false
            emitRaiseHand(false);
        }

        emitEmoji(emoji);
        setIsEmojiPickerOpen(false);
        // Optimistic local update
        setActiveEmojis(prev => ({
            ...prev,
            [user.id]: { emoji, timestamp: Date.now() }
        }));
        // Auto-remove local optimistic update
        setTimeout(() => {
            setActiveEmojis(prev => {
                const newState = { ...prev };
                if (newState[user.id] && newState[user.id].emoji === emoji) {
                    delete newState[user.id];
                }
                return newState;
            });
        }, 3000);
    };

    const handleChat = () => {
        setIsChatSidebarOpen(prev => !prev);
    };

    const handleChairUpdate = useCallback((data) => {
        console.log('Received chair seating update:', data);

        if (data.updatedBy !== user.id) {
            setAssignedUsers(data.assignedUsers);

            let message = '';
            switch (data.action) {
                case 'sit':
                    message = `${data.userName} sat down`;
                    break;
                case 'leave':
                    message = `${data.userName} left their seat`;
                    break;
                case 'move':
                    message = `${data.userName} moved to a different seat`;
                    break;
                default:
                    message = `${data.userName} updated their seating`;
            }

            Swal.fire({
                icon: 'info',
                title: 'Seating Update',
                text: message,
                timer: 2000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true,
                background: '#f0fdf4',
                color: '#166534'
            });

            // ✨ Fallback: Ensure user is added to participants list when they sit
            if (data.action === 'sit' && data.userName) {
                 setClassroom(prev => {
                     const userId = data.userId; // Assuming data has userId
                     // Check if user exists in participants (by _id or id)
                     const exists = prev.participants.some(p => p._id === userId || p.id === userId);
                     
                     if (!exists) {
                         // Construct minimal user object
                         const newParticipant = {
                             _id: userId,
                             displayName: data.userName,
                             photoURL: data.userPhoto || null, // data might not have photo, acceptable
                             ...data
                         };
                         return {
                             ...prev,
                             participants: [...prev.participants, newParticipant]
                         };
                     }
                     return prev;
                 });
            }
        }
    }, [user.id]);

    const handleChairMovement = useCallback((data) => {
        console.log('Received chair movement update:', data);

        if (data.updatedBy !== user.id) {
            // Do not overwrite local changes if creator is actively editing layout
            if (!isEditingRef.current) {
                setCurrentChairPositions(data.chairPositions);
                setSeatingPositions(data.chairPositions);
            }

            Swal.fire({
                icon: 'info',
                title: 'Chair Moved',
                text: 'A chair has been repositioned',
                timer: 1500,
                showConfirmButton: false,
                position: 'top-end',
                toast: true,
                background: '#fef3c7',
                color: '#92400e'
            });
        }
    }, [user.id]);

    const handleChairGroupUpdate = useCallback((data) => {
        console.log('Received chair group update:', data);

        if (data.updatedBy !== user.id) {
            if (!isEditingRef.current) {
                setChairGroups(data.chairGroups);
            }
        }
    }, [user.id]);

    const handleChatMessage = useCallback((data) => {
        setChatMessages(prev => [...prev, data]);
        setTimeout(() => {
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
        }, 100);
    }, []);

    // ✨ Handle incoming classroom events
    const handleClassroomEventAdded = useCallback((data) => {
        console.log('Classroom event added:', data);
        setClassroomEvents(prev => {
            // ✨ Prevent duplicates: Check if event ID already exists
            if (prev.some(e => e.id === data.id)) {
                return prev;
            }
            return [...prev, data];
        });

        Swal.fire({
            icon: 'success',
            title: 'New Event',
            text: `Event "${data.title}" added!`,
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
            toast: true
        });
    }, []);

    // ✨ Handle incoming event triggers (updates)
    const handleClassroomEventTriggered = useCallback((data) => {
        console.log('Classroom event triggered:', data);
        const { eventId, updates } = data;

        setClassroomEvents(prev => prev.map(event => {
            if (event.id === eventId) {
                // ✨ Update updatedAt locally so animation triggers
                return { ...event, ...updates, updatedAt: Date.now() };
            }
            return event;
        }));

        // If results exist, show animation or notification
        // ✨ Removed the Swal here because the card now has animation
        // But maybe keep a toast?
        // if (updates.results && updates.results.length > 0) { ... }
    }, []);



    // ✨ Handle event deletion
    const handleClassroomEventDeleted = useCallback((data) => {
        console.log('Classroom event deleted:', data);
        setClassroomEvents(prev => prev.filter(e => e.id !== data.eventId));
    }, []);

    // ✨ Handle Raise Hand Update
    const handleRaiseHandUpdate = useCallback((data) => {
        const { userId, isRaised, userName } = data;
        setRaisedHands(prev => {
            const next = new Set(prev);
            if (isRaised) {
                next.add(userId);
                // Optional: Play sound or show toast for host
                if (isCreator && userId !== user.id) {
                    Swal.fire({
                        icon: 'info',
                        title: `${userName} raised hand`,
                        toast: true,
                        position: 'top-end',
                        showConfirmButton: false,
                        timer: 2000
                    });
                }
            } else {
                next.delete(userId);
            }
            return next;
        });
    }, [isCreator, user.id]);

    // ✨ Handle Incoming Emoji
    const handleEmojiSent = useCallback((data) => {
        const { userId, emoji } = data;
        setActiveEmojis(prev => ({
            ...prev,
            [userId]: { emoji, timestamp: Date.now() }
        }));

        // Auto-remove after 3 seconds
        setTimeout(() => {
            setActiveEmojis(prev => {
                const newState = { ...prev };
                if (newState[userId] && newState[userId].emoji === emoji) {
                    delete newState[userId];
                }
                return newState;
            });
        }, 3000);
    }, []);

    // ✨ Handle User Joined with Normalization
    const handleUserJoined = useCallback((data) => {
        console.log('User joined Raw:', data);
        let newUser = data.user || data; 
        
        // ✨ Normalize User Data
        if (!newUser._id && newUser.userId) {
            newUser = {
                _id: newUser.userId,
                displayName: newUser.userName || newUser.username || 'Unknown',
                photoURL: newUser.userPhoto || newUser.photoURL,
                email: newUser.email,
                ...newUser
            };
        }

        // Update classroom participants
        setClassroom(prev => {
            if (!prev) return prev;
            // Avoid duplicates check with both _id and id
            if (prev.participants.some(p => (p._id && newUser._id && p._id === newUser._id) || (p.id && newUser.id && p.id === newUser.id))) return prev;
            
            return {
                ...prev,
                participants: [...prev.participants, newUser]
            };
        });

        // Optional: Show toast
        Swal.fire({
            icon: 'info',
            text: `${newUser.displayName || newUser.username} joined the class`,
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 2000
        });

        // ✨ Force refresh classroom details to be sure (Fallback)
        // fetchClassroomDetails(); // If available
    }, []);

    // ✨ Handle User Left with Normalization
    const handleUserLeft = useCallback((data) => {
        console.log('User left Raw:', data);
        const userId = data.userId || data._id || data.id;

        setClassroom(prev => {
            if (!prev) return prev;
            return {
                ...prev,
                participants: prev.participants.filter(p => (p._id !== userId && p.id !== userId))
            };
        });
    }, []);

    // ✨ Handle Full Classroom Update
    const handleClassroomUpdated = useCallback((data) => {
        console.log('Classroom updated:', data);
        const updatedClassroom = data.classroom || data;
        setClassroom(prev => ({
            ...prev,
            ...updatedClassroom
        }));
    }, []);

    const handleDeleteEvent = (event) => {
        Swal.fire({
            title: 'Delete Event?',
            text: "Are you sure you want to delete this event?",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'Yes, delete it!'
        }).then((result) => {
            if (result.isConfirmed) {
                emitDeleteClassroomEvent(event.id);
            }
        });
    };

    const {
        emitScoreUpdate,
        emitChairSeatingUpdate,
        emitChairMovement,
        emitChairGroupUpdate,
        emitChatMessage,
        emitSystemMessage, // ✨ Destructure system message emitter
        emitAddClassroomEvent,
        emitTriggerClassroomEvent, // ✨ Destructure new emitter
        emitDeleteClassroomEvent, // ✨ Destructure delete emitter
        emitSubmitEventAnswer, // ✨ Destructure submit answer emitter
        emitRaiseHand, // ✨ Destructure raise hand emitter
        emitEmoji // ✨ Destructure emoji emitter
    } = useSocket(
        classId,
        user,
        handleScoreUpdate,
        handleChairUpdate,
        handleChairMovement,
        handleChairGroupUpdate,
        handleChatMessage,
        handleClassroomEventAdded,
        handleClassroomEventTriggered, // ✨ Pass new listener
        handleClassroomEventDeleted, // ✨ Pass delete listener
        handleRaiseHandUpdate, // ✨ Pass raise hand listener
        handleEmojiSent, // ✨ Pass emoji listener
        handleUserJoined, // ✨ Pass user joined listener
        handleUserLeft, // ✨ Pass user left listener
        handleClassroomUpdated // ✨ Pass full update listener
    );

    // ✨ Handler for adding new events via ClassroomEvent component
    const handleAddEvent = (eventConfig) => {
        // support string (old way) or object (new way)
        let newEvent = {
            id: `event-${Date.now()}`,
            description: 'New classroom event started',
            type: 'default',
            status: eventConfig.status || 'idle', // ✨ Set status from config or default to idle
            createdAt: Date.now(),
            createdBy: user.id
        };

        if (typeof eventConfig === 'string') {
            newEvent.title = eventConfig;
        } else {
            // Config object
            if (eventConfig.type === 'random') {
                newEvent.title = 'Random Student';
            } else if (eventConfig.type === 'question') {
                newEvent.title = 'Question';
            } else if (eventConfig.type === 'buzz') {
                newEvent.title = 'Buzz Button';
            } else if (eventConfig.type === 'wordcloud') {
                newEvent.title = 'Word Cloud';
            } else if (eventConfig.type === 'poll') {
                newEvent.title = 'Poll';
            }
            newEvent.type = eventConfig.type;
            newEvent.config = eventConfig.config 
                ? { ...eventConfig, ...eventConfig.config }
                : eventConfig; // Flatten nested config
        }

        // Emit via socket
        emitAddClassroomEvent(newEvent);
        // socket.to(classId).emit('classroom-event-added', event); -> EXCLUDES SENDER.
        // So we MUST add it locally for the sender.
        setClassroomEvents(prev => [...prev, { ...newEvent, createdBy: user.id, createdAt: Date.now() }]);
    };

    // ✨ Handler for creating student groups
    const handleCreateGroups = (groups) => {
        const newEvent = {
            id: `event-${Date.now()}`,
            title: 'Student Groups',
            description: 'Join your group!',
            type: 'grouping',
            config: {
                type: 'grouping',
                groups: groups
            },
            results: [],
            status: 'active',
            createdAt: Date.now(),
            createdBy: user.id
        };

        emitAddClassroomEvent(newEvent);
        setClassroomEvents(prev => [...prev, { ...newEvent }]);

        // ✨ Send grouping card to chat as special JSON message
        const chatPayload = JSON.stringify({
            type: 'grouping',
            eventId: newEvent.id,
            groups: groups
        });
        emitChatMessage(chatPayload);
    };

    // ✨ Handler for publishing a draft event to active
    const handlePublishDraftEvent = (event) => {
        const now = Date.now();
        const timerConfig = event?.config?.timer;
        const shouldStartTimer = ['question', 'poll'].includes(event?.type)
            && timerConfig?.enabled
            && Number(timerConfig.durationSeconds) > 0;
        const publishedConfig = shouldStartTimer
            ? {
                ...event.config,
                timer: {
                    ...timerConfig,
                    startedAt: now,
                    endsAt: now + (Number(timerConfig.durationSeconds) * 1000)
                }
            }
            : event.config;

        emitTriggerClassroomEvent(event.id, {
            status: 'idle',
            config: publishedConfig,
            updatedAt: now,
            _isPublishingDraft: true // Flag for backend to send notification
        });
    };

    // ✨ Handler for triggering an event (Creator only)
    const handleTriggerEvent = (event, updates) => {
        // ✨ Generic trigger support (Buzz Button, etc.)
        if (updates) {
            emitTriggerClassroomEvent(event.id, updates);
            return;
        }

        // ✨ Existing Random Student Logic
        if (event.type === 'random') {
            const count = event.config?.count || event.count || 1;

            // Get all seated users (excluding creator if they are seated?)
            // Usually creator is teacher, students are in assignedUsers.
            // assignedUsers is object: { chairId: { userId, userName, ... } }
            const students = Object.values(assignedUsers);

            if (students.length === 0) {
                Swal.fire('No Students', 'No students are currently seated to select from.', 'warning');
                return;
            }

            // Shuffle and pick N
            const shuffled = [...students].sort(() => 0.5 - Math.random());
            const selected = shuffled.slice(0, count);

            // Format results
            const results = selected.map(s => ({
                userId: s.userId,
                userName: s.userName,
                photoSrc: getProfileImageSrc(s.photoURL, isGoogleUser(s))
            }));

            // Emit trigger with explicitly defined updatedAt so animation runs
            emitTriggerClassroomEvent(event.id, { results, animationDuration: 3500, updatedAt: Date.now() });

            // ✨ Send result to chat after animation (approx 3.5s)
            setTimeout(() => {
                const winnerNames = results.map(r => r.userName).join(', ');
                emitSystemMessage(`Random Selection Result: ${winnerNames}`);
            }, 3500);
        }
    };

    // ✨ Handle Answer Submission
    const handleSubmitAnswer = (event, answerText) => {
        console.log('handleSubmitAnswer called in Page. EventID:', event?.id, 'Text:', answerText);
        if (!event || !event.id) {
            console.error('Invalid event object:', event);
            return;
        }
        emitSubmitEventAnswer(event.id, answerText);
    };

    // ✨ Handle End & Score Event — awards points to participants
    const handleEndAndScoreEvent = async (event) => {
        if (!event) return;
        
        // Non-scoring events: just end them
        if (!event.config?.scoring?.enabled) {
            emitTriggerClassroomEvent(event.id, { status: 'ended' });
            return;
        }
        
        const basePoints = event.config.scoring.points;
        const category = `${event.title || event.type} (Event)`;
        const hasPerOptionScoring = event.type === 'poll' && event.config?.scoreConfig?.optionScores;
        
        // Determine who gets scored and how many points
        let scoredEntries = []; // { userId, userName, points }
        
        if (event.type === 'buzz') {
            // Only the winner (first result)
            if (event.results?.length > 0) {
                scoredEntries = [{ userId: event.results[0].userId, userName: event.results[0].userName, points: basePoints }];
            }
        } else if (event.type === 'poll') {
            if (event.results?.length > 0) {
                const seen = new Set();
                scoredEntries = event.results.filter(r => {
                    if (seen.has(r.userId)) return false;
                    seen.add(r.userId);
                    return true;
                }).map(r => {
                    let pts = basePoints;
                    if (hasPerOptionScoring && r.text) {
                        const optScore = event.config.scoreConfig.optionScores[r.text];
                        if (optScore) {
                            pts = optScore.action === 'subtract' ? -(optScore.points || 0) : (optScore.points || 0);
                        }
                    }
                    return { userId: r.userId, userName: r.userName, points: pts };
                });
            }
        } else if (event.type === 'wordcloud' || event.type === 'question') {
            if (event.results?.length > 0) {
                const seen = new Set();
                scoredEntries = event.results.filter(r => {
                    if (seen.has(r.userId)) return false;
                    seen.add(r.userId);
                    return true;
                }).map(r => ({ userId: r.userId, userName: r.userName, points: basePoints }));
            }
        } else if (event.type === 'random') {
            if (event.results?.length > 0) {
                scoredEntries = event.results.map(r => ({ userId: r.userId, userName: r.userName, points: basePoints }));
            }
        }

        if (scoredEntries.length === 0) {
            Swal.fire('No Participants', 'No students participated in this event to score.', 'info');
            return;
        }

        // Confirmation dialog
        const totalAwarded = scoredEntries.reduce((sum, e) => sum + e.points, 0);
        const confirm = await Swal.fire({
            title: '🏁 End & Score',
            html: `
                <div style="text-align:left;max-height:200px;overflow-y:auto;margin:10px 0;">
                    ${scoredEntries.map(s => `<div style="display:flex;justify-content:space-between;padding:4px 0;border-bottom:1px solid #f1f5f9;">
                        <span>${s.userName}</span>
                        <b style="color:${s.points >= 0 ? '#16a34a' : '#dc2626'}">${s.points >= 0 ? '+' : ''}${s.points} pts</b>
                    </div>`).join('')}
                </div>
                <p style="margin-top:8px;font-weight:600;">Total: ${totalAwarded >= 0 ? '+' : ''}${totalAwarded} pts to ${scoredEntries.length} student(s)</p>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '🏆 Award Scores',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#f59e0b'
        });

        if (!confirm.isConfirmed) return;

        try {
            let updatedStudentScores = { ...studentScores };
            
            scoredEntries.forEach(entry => {
                const currentScores = updatedStudentScores[entry.userId] || {};
                const currentCategoryScore = currentScores[category] || 0;
                updatedStudentScores[entry.userId] = {
                    ...currentScores,
                    [category]: currentCategoryScore + entry.points
                };
            });

            // Save to database
            await axios.put(`${API_BASE_URL}/api/classrooms/${classId}/seating`, {
                studentScores: updatedStudentScores
            }, {
                headers: { 'x-auth-token': user.token }
            });

            setStudentScores(updatedStudentScores);

            // ✨ Track score changes in active session
            if (isSessionActive) {
                const newChanges = scoredEntries.map(entry => ({
                    studentId: entry.userId,
                    studentName: entry.userName || 'Unknown',
                    photoURL: null,
                    category: category,
                    pointsChange: entry.points,
                    timestamp: new Date()
                }));
                setSessionScoreChanges(prev => [...prev, ...newChanges]);
            }

            // Emit real-time score updates
            scoredEntries.forEach(entry => {
                emitScoreUpdate(entry.userId, updatedStudentScores[entry.userId], category, entry.userName);
            });

            // ✨ Set event status to 'ended' — use direct trigger (NOT handleTriggerEvent which re-runs random)
            emitTriggerClassroomEvent(event.id, { status: 'ended' });

            Swal.fire({
                icon: 'success',
                title: '🏆 Scores Awarded!',
                html: `<b>${scoredEntries.length}</b> student(s) scored<br><small>Category: ${category}</small>`,
                timer: 2500,
                showConfirmButton: false
            });
        } catch (error) {
            console.error('Error scoring event:', error);
            Swal.fire('Error', 'Failed to award scores.', 'error');
        }
    };

    const handleShareClick = () => {
        if (!classroom) return;
        Swal.fire({
            title: 'Class Code',
            html: `
                <div style="background-color: #eaf6ea; border: 1px solid #d4ecd4; border-radius: 4px; padding: 12px 15px; text-align: center;">
                    <p style="font-size: 1.2em; font-weight: bold; margin: 0;">${classroom.classCode}</p>
                </div>
                <p style="margin-top: 15px; font-size: 0.9em; color: #555;">Give this code to your students so they can join this class.</p>
            `,
            showCancelButton: false,
            showConfirmButton: true,
            confirmButtonText: 'Copy Code',
            preConfirm: () => {
                navigator.clipboard.writeText(classroom.classCode);
                Swal.showValidationMessage('Copied!');
            }
        });
    };

    // Pan functionality handlers
    const handleMouseDown = useCallback((e) => {
        // Find if we clicked inside the seating wrapper
        const isInsideWrapper = e.target.closest('.seating-container-wrapper');
        // Do not pan if clicking on a chair or the front board or interactive UI elements
        const isClickingInteractiveElement = 
            e.target.closest('.chair-item') || 
            e.target.closest('.chair') || 
            e.target.closest('.front-classroom-board') || 
            e.target.closest('button') ||
            e.target.closest('.action-bar-container') ||
            e.target.closest('.group-overlay') ||
            e.target.closest('.hp-bar-container');

        if (isInsideWrapper && !isClickingInteractiveElement) {
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });

            if (seatingWrapperRef.current) {
                setScrollStart({
                    x: seatingWrapperRef.current.scrollLeft,
                    y: seatingWrapperRef.current.scrollTop
                });
            }

            // Prevent text selection while dragging
        }
    }, []);

    const handleMouseMove = useCallback((e) => {
        if (!isPanning || !seatingWrapperRef.current) return;

        const deltaX = e.clientX - panStart.x;
        const deltaY = e.clientY - panStart.y;

        seatingWrapperRef.current.scrollLeft = scrollStart.x - deltaX;
        seatingWrapperRef.current.scrollTop = scrollStart.y - deltaY;

        e.preventDefault();
    }, [isPanning, panStart, scrollStart]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
    }, []);

    // Add global mouse event listeners for panning
    useEffect(() => {
        if (isPanning) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            document.body.style.cursor = 'grabbing';

            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
                document.body.style.cursor = 'default';
            };
        }
    }, [isPanning, handleMouseMove, handleMouseUp]);

    // Zoom functionality handlers (seating)
    const handleZoomIn = useCallback(() => {
        setZoomLevel(prev => Math.min(prev + 0.2, maxZoom));
    }, [maxZoom]);

    const handleZoomOut = useCallback(() => {
        setZoomLevel(prev => Math.max(prev - 0.2, minZoom));
    }, [minZoom]);

    const handleZoomReset = useCallback(() => {
        setZoomLevel(1);
    }, []);

    // ✨ Zoom functionality handlers (event view - scales individual cards)
    const handleEventZoomIn = useCallback(() => {
        setEventZoomLevel(prev => Math.min(prev + 0.1, eventMaxZoom));
    }, [eventMaxZoom]);

    const handleEventZoomOut = useCallback(() => {
        setEventZoomLevel(prev => Math.max(prev - 0.1, eventMinZoom));
    }, [eventMinZoom]);

    const handleEventZoomReset = useCallback(() => {
        setEventZoomLevel(1);
    }, []);

    const handleToggleView = useCallback(() => {
        setIsViewChanging(true);
        setTimeout(() => {
            setIsTeacherView(prev => {
                const nextValue = !prev;
                saveTeacherViewPreference(classId, user?.id, nextValue);
                return nextValue;
            });
            setTimeout(() => {
                setIsViewChanging(false);
                // ✨ Manually calculate scroll to focus board WITHIN the wrapper
                const boardElement = document.getElementById('front-classroom-board');
                if (boardElement && seatingWrapperRef.current) {
                    const wrapper = seatingWrapperRef.current;
                    const boardRect = boardElement.getBoundingClientRect();
                    const wrapperRect = wrapper.getBoundingClientRect();

                    // Calculate position relative to the wrapper's current scroll
                    // Target: Board center in Wrapper center
                    const relativeTop = boardRect.top - wrapperRect.top;
                    const currentScroll = wrapper.scrollTop;
                    const targetScroll = currentScroll + relativeTop - (wrapper.clientHeight / 2) + (boardRect.height / 2);

                    wrapper.scrollTo({
                        top: targetScroll,
                        behavior: 'smooth'
                    });
                }
            }, 500); // Keep loader briefly after switch for smooth transition
        }, 1500); // Show loader for 1.5 seconds
    }, [classId, user?.id]);

    // ✨ Lock body scroll when loader is active
    useEffect(() => {
        if (isViewChanging) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'unset';
        }
        return () => {
            document.body.style.overflow = 'unset';
        };
    }, [isViewChanging]);

    const handleChairMove = useCallback((id, newX, newY) => {
        let updatedPositions = {
            ...currentChairPositions,
            [id]: { x: newX, y: newY }
        };

        const baseSize = editModeBaseSizeRef.current || getBoundsAndDimensions(currentChairPositions);
        if (!editModeBaseSizeRef.current) {
            editModeBaseSizeRef.current = { ...baseSize };
        }

        const baseMinX = baseSize.minX;
        const baseMinY = baseSize.minY;

        let deficitX = 0;
        let deficitY = 0;

        if (newX < baseMinX) {
            deficitX = Math.ceil(baseMinX - newX);
        }
        if (newY < baseMinY) {
            deficitY = Math.ceil(baseMinY - newY);
        }

        if (deficitX > 0 || deficitY > 0) {
            const shifted = {};
            Object.entries(updatedPositions).forEach(([chairId, pos]) => {
                shifted[chairId] = {
                    x: pos.x + deficitX,
                    y: pos.y + deficitY
                };
            });
            updatedPositions = shifted;

            if (editModeBaseSizeRef.current) {
                editModeBaseSizeRef.current.width += deficitX;
                editModeBaseSizeRef.current.height += deficitY;
            }

            // Compensate scroll position so elements do not jump on screen
            if (seatingWrapperRef.current) {
                seatingWrapperRef.current.scrollLeft += Math.round(deficitX * zoomLevel);
                seatingWrapperRef.current.scrollTop += Math.round(deficitY * zoomLevel);
            }
        }

        setCurrentChairPositions(updatedPositions);

        // Emit real-time chair movement update
        if (isEditing && isCreator) {
            emitChairMovement(updatedPositions, id);
        }
    }, [currentChairPositions, isEditing, isCreator, emitChairMovement, getBoundsAndDimensions, zoomLevel]);

    // ✨ Clear all groups
    const handleClearGroups = () => {
        if (window.confirm('Are you sure you want to clear all connections?')) {
            setChairGroups([]);
        }
    };

    // ✨ Undo last group
    const handleUndoGroup = () => {
        if (chairGroups.length > 0) {
            setChairGroups(prev => prev.slice(0, -1));
        }
    };

    const handleChairClick = async (chairId, event) => {
        const chairUser = assignedUsers[chairId];

        // ✨ Grouping Mode Logic
        if (isGroupingMode && isEditing) {
            // Toggle selection
            let newSelection = [...selectedChairsForGroup];
            if (newSelection.includes(chairId)) {
                newSelection = newSelection.filter(id => id !== chairId);
            } else {
                newSelection.push(chairId);
            }
            setSelectedChairsForGroup(newSelection);

            // Check if group is full
            if (newSelection.length >= groupSizeInput) {
                // Create Group
                const newGroup = {
                    id: `group-${Date.now()}`,
                    chairIds: newSelection,
                    label: `G${chairGroups.length + 1}`,
                    color: '#4CAF50' // Green as requested
                };

                setChairGroups([...chairGroups, newGroup]);
                setSelectedChairsForGroup([]);

                // Optional: Notify
                Swal.fire({
                    icon: 'success',
                    title: 'Group Created',
                    text: `Created group with ${newSelection.length} chairs`,
                    toast: true,
            position: 'top-end',
                    showConfirmButton: false,
                    timer: 1500
                });
            }
            return;
        }

        // If creator clicks on a chair with a student (not in edit mode)
        if (isCreator && !isEditing) {
            if (!chairUser) {
                setDropdownOpen(false);
                setDropdownAnchorEl(null);
                setSelectedStudentChair(null);
                return;
            }

            const anchorElement =
                event?.currentTarget && typeof event.currentTarget.getBoundingClientRect === 'function'
                    ? event.currentTarget
                    : event?.target && typeof event.target.getBoundingClientRect === 'function'
                        ? event.target
                        : null;

            const rect = anchorElement
                ? anchorElement.getBoundingClientRect()
                : { left: window.innerWidth / 2, width: 0, bottom: window.innerHeight / 2 };

            setDropdownPosition({
                x: rect.left + rect.width / 2,
                y: rect.bottom + 10
            });
            setDropdownAnchorEl(anchorElement);
            setSelectedStudentChair(chairId);
            setDropdownOpen(true);
            return;
        }

        // Original chair assignment logic for students
        if (isEditing || isCreator) return;

        const currentSeatId = Object.keys(assignedUsers).find(
            key => assignedUsers[key]?.userId === user.id
        );

        if (!currentSeatId && chairUser) {
            Swal.fire({
                title: t('classroomPage.swal.seatTakenTitle') || 'Seat Taken',
                text: t('classroomPage.swal.seatTakenText') || 'This seat is already taken by another student.',
                icon: 'warning',
                confirmButtonColor: '#ffc107',
                confirmButtonText: t('common.save') ? 'OK' : 'OK' // using common, wait I will just leave it OK for now, wait "OK" in common?
            });
            return;
        }
        if (!currentSeatId && !chairUser) {
            setSelectedChairId(chairId);
            setModalOpen(true);
            return;
        }
        if (currentSeatId) {
            if (currentSeatId === chairId) return;
            if (!chairUser) {
                const result = await Swal.fire({
                    title: t('classroomPage.swal.moveSeatTitle') || 'Move Seat?',
                    text: t('classroomPage.swal.moveSeatText') || 'Do you want to move to this new seat?',
                    icon: 'question',
                    showCancelButton: true,
                    confirmButtonColor: '#7ec282',
                    cancelButtonColor: '#d33',
                    confirmButtonText: t('classroomPage.swal.yesMoveBtn') || 'Yes, move!',
                    cancelButtonText: t('common.cancel') || 'Cancel'
                });
                if (result.isConfirmed) {
                    setSelectedChairId(chairId);
                    setModalOpen(true);
                }
                return;
            }
            if (chairUser) {
                Swal.fire({
                    title: t('classroomPage.swal.cannotMoveTitle') || 'Cannot Move',
                    text: t('classroomPage.swal.cannotMoveText') || 'This seat is already taken. Please choose an empty seat.',
                    icon: 'error',
                    confirmButtonColor: '#d33',
                    confirmButtonText: 'OK'
                });
                return;
            }
        }
    };

    // Get default rate presets
    const getDefaultRatePresets = useCallback(() => {
        return [
            {
                _id: 'default-1',
                name: 'Good Participation',
                emoji: '👍',
                type: 'positive',
                scoreType: 'add',
                scoreValue: 5
            },
            {
                _id: 'default-2',
                name: 'Excellent Work',
                emoji: '⭐',
                type: 'positive',
                scoreType: 'add',
                scoreValue: 10
            },
            {
                _id: 'default-3',
                name: 'Late Arrival',
                emoji: '⏰',
                type: 'negative',
                scoreType: 'subtract',
                scoreValue: 2
            }
        ];
    }, []);

    // Fetch rate presets
    const fetchRatePresets = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/presets?classroomId=${classId}`, {
                headers: { 'x-auth-token': user.token }
            });

            // Handle both response structures (wrapped in data or direct array)
            const rawPresets = response.data.data || response.data;
            const presetsArray = Array.isArray(rawPresets) ? rawPresets : [];

            // Transform the new API response to match expected format
            const transformedPresets = presetsArray.map(preset => {
                // Determine type based on tags or preset name
                const isNegative = preset.tags?.includes('negative') ||
                    preset.name.toLowerCase().includes('late') ||
                    preset.name.toLowerCase().includes('absent') ||
                    preset.name.toLowerCase().includes('disrupt') ||
                    preset.type === 'negative';

                return {
                    _id: preset._id,
                    name: preset.name,
                    emoji: preset.emoji || (isNegative ? '⚠️' : '⭐'),
                    type: preset.type || (isNegative ? 'negative' : 'positive'),
                    notifyStudent: preset.notifyStudent !== undefined ? preset.notifyStudent : true,
                    scoreType: preset.scoreType || (isNegative ? 'subtract' : 'add'),
                    scoreValue: preset.scoreValue || 5,
                    criteria: preset.criteria
                };
            });

            // Merge with default presets instead of replacing them
            const defaultPresets = getDefaultRatePresets();
            const allPresets = [...defaultPresets, ...transformedPresets];

            // Remove duplicates based on name to avoid conflicts
            const uniquePresets = allPresets.filter((preset, index, self) =>
                index === self.findIndex(p => p.name === preset.name)
            );

            setRatePresets(uniquePresets);
        } catch (error) {
            console.error('Error fetching rate presets:', error);
            // If API fails, only use default presets
            const defaultPresets = getDefaultRatePresets();
            setRatePresets(defaultPresets);
        }
    }, [classId, getDefaultRatePresets, user.token]);

    // Handle dropdown actions
    const handleRateStudent = () => {
        setDropdownOpen(false);
        setRatingModalOpen(true);
    };

    const handleCheckAttendance = async (studentIdFromDropdown = null) => {
        setDropdownOpen(false);
        
        // Define default states to support Global/Everyone selection
        let isGlobalCheck = !studentIdFromDropdown;
        let selectedUserId = studentIdFromDropdown || 'ALL';
        
        // Fetch matching student to display in the modal (if specific selection)
        let studentUser = null;
        let photoSrc = 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
        let displayUserName = 'Everyone';
        
        if (!isGlobalCheck) {
            studentUser = assignedUsers[Object.keys(assignedUsers).find(k => assignedUsers[k]?.userId === selectedUserId)] || Object.values(assignedUsers).find(u => u?.userId === selectedUserId);
            if (studentUser) {
                photoSrc = getProfileImageSrc(studentUser.photoURL);
                displayUserName = studentUser.userName;
            }
        }

        const currentDays = attendanceDays || 20;

        let defaultDay = 1;
        if (!isGlobalCheck && studentUser) {
            const pId = studentUser.userId; 
            const matchedParticipant = classroom?.participants?.find(p => (p._id || p.id)?.toString() === pId?.toString());
            const studentIdToSearch = matchedParticipant ? (matchedParticipant._id || matchedParticipant.id) : pId;
            const studentAtt = attendance[studentIdToSearch];
            if (studentAtt) {
                 const markedDays = Object.keys(studentAtt).map(Number).filter(d => !isNaN(d)).sort((a,b)=>b-a);
                 if (markedDays.length > 0) defaultDay = markedDays[0];
            }
        }

        const usersSvg = `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`;

        const initialAvatarHtml = isGlobalCheck 
            ? `<div style="width: 50px; height: 50px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 1.5rem;">${usersSvg}</div>`
            : `<img referrerPolicy="no-referrer" src="${photoSrc}" class="attendance-student-photo" onerror="this.src='https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'"/>`;

        // Create structured options for the custom dropdown
        // Exclude creator(s) from the list
        let creatorIds = [];
        if (classroom?.creator) {
            if (Array.isArray(classroom.creator)) {
                creatorIds = classroom.creator.map(c => (c._id || c.id || '').toString());
            } else {
                creatorIds = [(classroom.creator._id || classroom.creator.id || '').toString()];
            }
        }
        const filteredParticipants = (classroom?.participants || []).filter(p => !creatorIds.includes((p._id || p.id || '').toString()));

        const customOptions = [
            {
                value: 'ALL',
                label: 'Everyone',
                photo: `<div style="width: 24px; height: 24px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 0.8rem; margin-right: 10px;">${usersSvg}</div>`
            },
            ...filteredParticipants.map(p => {
                const pIdStr = (p._id || p.id || '').toString();
                const matchedUser = Object.values(assignedUsers).find(u => u?.userId?.toString() === pIdStr);
                const displayName = matchedUser ? matchedUser.userName : (p.displayName || p.name || p.username || `User ${pIdStr}`);
                const rawPhoto = matchedUser ? matchedUser.photoURL : (p.photoURL || p.userPhoto);
                const photoSrc = rawPhoto ? getProfileImageSrc(rawPhoto) : 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                return {
                    value: pIdStr,
                    label: displayName,
                    photo: `<img referrerPolicy="no-referrer" src="${photoSrc}" style="width: 24px; height: 24px; border-radius: 50%; object-fit: cover; margin-right: 10px;" onerror="this.src='https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y'" />`
                };
            })
        ];

        // Ensure the selected default option is first or explicitly styled
        const selectedOptionObj = customOptions.find(o => o.value === selectedUserId) || customOptions[0];

        const customDropdownHtml = `
            <div id="custom-attendance-select" style="position: relative; width: 100%; text-align: left; font-family: inherit;">
                <div id="custom-select-trigger" style="display: flex; align-items: center; justify-content: space-between; padding: 10px; border-radius: 8px; border: 1px solid #ccc; background: #fff; cursor: pointer;">
                    <div style="display: flex; align-items: center;" id="custom-select-selected-content">
                        ${selectedOptionObj.photo}
                        <span style="font-size: 1rem; font-weight: 600; color: #333; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 150px;">${selectedOptionObj.label}</span>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                <div id="custom-select-options" style="display: none; position: absolute; z-index: 9999; top: 100%; left: 0; right: 0; margin-top: 4px; background: #fff; border: 1px solid #eef0f2; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-height: 200px; overflow-y: auto;">
                    ${customOptions.map(opt => `
                        <div class="custom-select-option" data-value="${opt.value}" style="display: flex; align-items: center; padding: 10px; cursor: pointer; border-bottom: 1px solid #f1f5f9;">
                            ${opt.photo}
                            <span style="font-size: 0.95rem; font-weight: 500; color: #333;">${opt.label}</span>
                        </div>
                    `).join('')}
                </div>
                <input type="hidden" id="swal-student-select-hidden" value="${selectedOptionObj.value}" />
            </div>
            <style>
                .custom-select-option:hover { background-color: #f8fafc; }
                .custom-select-option:last-child { border-bottom: none !important; }
            </style>
        `;

        const { value: formValues } = await Swal.fire({
            title: 'Attendance Check',
            html: `
                <div class="attendance-modal-content" style="overflow: visible;">
                    <div class="attendance-student-info" style="align-items: center;">
                        <div id="swal-student-avatar-container" style="flex-shrink: 0;">
                            ${initialAvatarHtml}
                        </div>
                        <div class="attendance-student-details" style="width: 100%; min-width: 0; margin-left: 15px;">
                            ${customDropdownHtml}
                        </div>
                    </div>
                <!-- Rest of form remains same -->
                    <div class="attendance-form-group">
                        <label class="attendance-form-label">
                            <i class="fas fa-calendar-day"></i> Select Day
                        </label>
                        <div style="display: flex; align-items: center; justify-content: center; gap: 20px; background: #fff; border: 2px solid #eef0f2; border-radius: 12px; padding: 10px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);">
                            <button type="button" onclick="document.getElementById('swal-day').stepDown()" style="width: 40px; height: 40px; border-radius: 8px; border: 1px solid #eef0f2; background: #f8f9fa; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #555; transition: all 0.2s;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                            <div style="display: flex; flex-direction: column; align-items: center;">
                                <span style="font-size: 0.75rem; color: #888; font-weight: 700; text-transform: uppercase;">Day</span>
                                <input type="number" id="swal-day" value="${defaultDay}" min="1" max="${currentDays}" class="attendance-day-input" style="width: 60px; border: none; background: transparent; font-size: 1.5rem; font-weight: 800; color: #333; text-align: center; outline: none; margin-top: -2px; padding: 0;" />
                            </div>
                            <button type="button" onclick="document.getElementById('swal-day').stepUp()" style="width: 40px; height: 40px; border-radius: 8px; border: 1px solid #eef0f2; background: #f8f9fa; cursor: pointer; display: flex; align-items: center; justify-content: center; color: #555; transition: all 0.2s;">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                            </button>
                        </div>
                    </div>

                    <div class="attendance-form-group">
                        <label class="attendance-form-label">
                            <i class="fas fa-check-circle"></i> Status
                        </label>
                        <div class="attendance-status-grid">
                            <div class="attendance-status-btn present" data-status="present">
                                <span class="attendance-status-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                </span>
                                <span class="attendance-status-label">Present</span>
                            </div>
                            <div class="attendance-status-btn absent" data-status="absent">
                                <span class="attendance-status-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                </span>
                                <span class="attendance-status-label">Absent</span>
                            </div>
                            <div class="attendance-status-btn late" data-status="late">
                                <span class="attendance-status-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                                </span>
                                <span class="attendance-status-label">Late</span>
                            </div>
                            <div class="attendance-status-btn leave" data-status="leave">
                                <span class="attendance-status-icon">
                                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                </span>
                                <span class="attendance-status-label">Leave</span>
                            </div>
                        </div>
                    </div>
                </div>
            `,
            focusConfirm: false,
            showConfirmButton: false,
            showCancelButton: true,
            cancelButtonText: 'Cancel',
            cancelButtonColor: '#6c757d',
            customClass: {
                popup: 'attendance-swal-popup',
                cancelButton: 'attendance-swal-cancel'
            },
            preConfirm: () => {
                const popup = Swal.getPopup();
                const status = popup.getAttribute('data-selected-status');
                const day = document.getElementById('swal-day').value;
                const targetStudentId = document.getElementById('swal-student-select-hidden').value;
                
                if (!status) {
                    Swal.showValidationMessage('Please select a status');
                    return false;
                }
                return { status, day, targetStudentId };
            },
            didOpen: () => {
                const popup = Swal.getPopup();
                const buttons = popup.querySelectorAll('.attendance-status-btn');
                const trigger = popup.querySelector('#custom-select-trigger');
                const optionsList = popup.querySelector('#custom-select-options');
                const hiddenInput = popup.querySelector('#swal-student-select-hidden');
                const selectedContent = popup.querySelector('#custom-select-selected-content');
                const avatarContainer = popup.querySelector('#swal-student-avatar-container');
                const optionElements = popup.querySelectorAll('.custom-select-option');
                
                // Toggle dropdown menu
                trigger.addEventListener('click', () => {
                    const isVisible = optionsList.style.display === 'block';
                    optionsList.style.display = isVisible ? 'none' : 'block';
                });

                // Close dropdown on click outside
                document.addEventListener('click', (e) => {
                    const customSelect = popup.querySelector('#custom-attendance-select');
                    if (customSelect && !customSelect.contains(e.target)) {
                        optionsList.style.display = 'none';
                    }
                });
                
                // Handle option selection
                optionElements.forEach(option => {
                    option.addEventListener('click', () => {
                        const val = option.getAttribute('data-value');
                        hiddenInput.value = val;
                        selectedContent.innerHTML = option.innerHTML; // Copy HTML content
                        optionsList.style.display = 'none';
                        
                        // Update the large left avatar just like before
                        if (val === 'ALL') {
                            avatarContainer.innerHTML = '<div style="width: 50px; height: 50px; border-radius: 50%; background: #e2e8f0; display: flex; align-items: center; justify-content: center; color: #64748b; font-size: 1.5rem;">' + usersSvg + '</div>';
                        } else {
                            const matchedUser = Object.values(assignedUsers).find(u => u?.userId?.toString() === val);
                            const participant = classroom?.participants?.find(p => (p._id || p.id || '').toString() === val);
                            const rawPhoto = matchedUser ? matchedUser.photoURL : (participant?.photoURL || participant?.userPhoto);
                            const newPhotoSrc = rawPhoto ? getProfileImageSrc(rawPhoto) : 'https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y';
                            avatarContainer.innerHTML = "<img referrerPolicy='no-referrer' src='" + newPhotoSrc + "' class='attendance-student-photo' onerror='this.src=\"https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y\"' />";
                        }
                    });
                });

                buttons.forEach(btn => {
                    btn.addEventListener('click', () => {
                        const status = btn.getAttribute('data-status');
                        popup.setAttribute('data-selected-status', status);
                        Swal.clickConfirm();
                    });
                });
            }
        });

        if (formValues && formValues.status) {
            try {
                const dayKey = String(formValues.day);
                const newAttendance = { ...attendance };
                
                let targetMessage = '';

                if (formValues.targetStudentId === 'ALL') {
                    // Update everyone
                    const participantsList = classroom?.participants || [];
                    participantsList.forEach(p => {
                        const pIdStr = (p._id || p.id || '').toString();
                        if (pIdStr) {
                            if (!newAttendance[pIdStr]) newAttendance[pIdStr] = {};
                            newAttendance[pIdStr][dayKey] = formValues.status;
                        }
                    });
                    targetMessage = `Everyone`;
                } else {
                    // Update single user
                    const studentId = formValues.targetStudentId;
                    if (!newAttendance[studentId]) newAttendance[studentId] = {};
                    newAttendance[studentId][dayKey] = formValues.status;
                    
                    const matchedUser = Object.values(assignedUsers).find(u => u?.userId?.toString() === studentId);
                    targetMessage = matchedUser ? matchedUser.userName : 'Student';
                }

                setAttendance(newAttendance);

                await axios.put(`${API_BASE_URL}/api/classrooms/${classId}/attendance`, {
                    attendance: newAttendance
                }, {
                    headers: { 'x-auth-token': user.token }
                });

                Swal.fire({
                    icon: 'success',
                    title: 'Attendance Saved',
                    text: `${targetMessage} marked as ${formValues.status} for ${formValues.day}`,
                    timer: 2000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });

            } catch (error) {
                console.error('Error saving attendance:', error);
                Swal.fire('Error', 'Failed to save attendance.', 'error');
                fetchClassroomDetails();
            }
        }
    };

    const handleFunction3 = async () => {
        setDropdownOpen(false);
        
        if (!selectedStudentChair || !isCreator) {
            return;
        }

        const studentInChair = assignedUsers[selectedStudentChair];
        if (!studentInChair) {
            Swal.fire({
                icon: 'info',
                title: 'No Student',
                text: 'There is no student in this chair.',
                timer: 2000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
            return;
        }

        // Confirm removal
        const result = await Swal.fire({
            title: 'Remove Student?',
            html: `Are you sure you want to remove <b>${studentInChair.userName}</b> from this chair?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#ef4444',
            cancelButtonColor: '#6b7280',
            confirmButtonText: 'Yes, remove',
            cancelButtonText: 'Cancel'
        });

        if (!result.isConfirmed) {
            return;
        }

        // Remove student from chair
        const newAssignedUsers = { ...assignedUsers };
        delete newAssignedUsers[selectedStudentChair];
        setAssignedUsers(newAssignedUsers);

        // Emit real-time chair seating update
        emitChairSeatingUpdate(selectedStudentChair, newAssignedUsers, 'leave', studentInChair.userName);

        // Show success message
        Swal.fire({
            icon: 'success',
            title: 'Student Removed',
            text: `${studentInChair.userName} has been removed from the chair.`,
            timer: 2000,
            showConfirmButton: false,
            position: 'top-end',
            toast: true,
            background: '#f0fdf4',
            color: '#166534'
        });

        // Save to database
        try {
            await axios.put(`${API_BASE_URL}/api/classrooms/${classId}/seating`, {
                assignedUsers: newAssignedUsers
            }, {
                headers: { 'x-auth-token': user.token }
            });
        } catch (error) {
            console.error('Error removing student from chair:', error);
            Swal.fire({
                icon: 'error',
                title: 'Error',
                text: 'Failed to remove student. Please try again.',
                timer: 2000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
        }
    };

    // Function to check if a student is in an active group
    const isStudentInGroup = (studentUserId) => {
        const activeGroupingEvent = classroomEvents?.find(e => e.type === 'grouping' && e.status === 'active');
        if (!activeGroupingEvent) return false;
        
        return activeGroupingEvent.results?.some(r => r.userId === studentUserId);
    };

    // Function to get all students in the same group as a specific student
    const getGroupMembers = (studentUserId) => {
        const activeGroupingEvent = classroomEvents?.find(e => e.type === 'grouping' && e.status === 'active');
        if (!activeGroupingEvent) return [];
        
        const studentResult = activeGroupingEvent.results?.find(r => r.userId === studentUserId);
        if (!studentResult) return [];
        
        const groupName = studentResult.text;
        return activeGroupingEvent.results?.filter(r => r.text === groupName) || [];
    };

    const handleFunction4 = () => {
        setDropdownOpen(false);
        
        if (!selectedStudentChair || !isCreator) {
            return;
        }

        const studentUser = assignedUsers[selectedStudentChair];
        if (!studentUser) {
            Swal.fire({
                icon: 'info',
                title: 'No Student',
                text: 'There is no student in this chair.',
                timer: 2000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
            return;
        }

        // Check if student is in a group
        if (!isStudentInGroup(studentUser.userId)) {
            Swal.fire({
                icon: 'info',
                title: t('classroomPage.swal.notInGroupTitle') || 'Not in Group',
                text: t('classroomPage.swal.notInGroupText') || 'This student is not currently in any group.',
                timer: 2000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
            return;
        }

        // Get group members
        const groupMembers = getGroupMembers(studentUser.userId);
        if (groupMembers.length === 0) {
            Swal.fire({
                icon: 'info',
                title: t('classroomPage.swal.groupNotFoundTitle') || 'Group Not Found',
                text: t('classroomPage.swal.groupNotFoundText') || 'Could not find group information for this student.',
                timer: 2000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
            return;
        }

        // Show rating modal with group context
        Swal.fire({
            title: t('classroomPage.swal.rateGroupTitle') || 'Rate Group',
            html: `
                <div style="text-align: left; margin: 20px 0;">
                    <p><strong>Student:</strong> ${studentUser.userName}</p>
                    <p><strong>Group Members:</strong> ${groupMembers.length} student(s)</p>
                    <div style="margin-top: 15px; padding: 10px; background: #f8f9fa; border-radius: 5px;">
                        <p style="margin: 0; font-size: 0.9em; color: #666;">
                            ${t('classroomPage.swal.rateGroupDescText', { count: groupMembers.length }) || `This rating will be applied to all ${groupMembers.length} members of this group.`}
                        </p>
                    </div>
                </div>
            `,
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#10b981',
            cancelButtonColor: '#6b7280',
            confirmButtonText: t('common.save') || 'Continue',
            cancelButtonText: t('common.cancel') || 'Cancel'
        }).then((result) => {
            if (result.isConfirmed) {
                // Show rating presets modal
                showGroupRatingModal(groupMembers);
            }
        });
    };

    const showGroupRatingModal = (groupMembers) => {
        // Create a custom modal for group rating
        const modalContainer = document.createElement('div');
        modalContainer.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 24px;
            max-width: 500px;
            width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `;

        const positivePresets = ratePresets.filter(preset =>
            preset.type === 'positive' || preset.scoreType === 'add'
        );
        const negativePresets = ratePresets.filter(preset =>
            preset.type === 'negative' || preset.scoreType === 'subtract'
        );

        modalContent.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
                <div>
                    <h2 style="margin: 0; color: #1f2937;">Rate Group</h2>
                    <p style="margin: 5px 0 0 0; color: #6b7280; font-size: 0.9em;">
                        ${groupMembers.length} student(s) in this group
                    </p>
                </div>
                <button id="close-modal" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #6b7280;">×</button>
            </div>
            
            ${ratePresets.length === 0 ? `
                <div style="text-align: center; padding: 40px 20px;">
                    <div style="font-size: 48px; margin-bottom: 16px;">📝</div>
                    <p style="color: #6b7280; margin: 0;">No rating presets found</p>
                    <p style="color: #9ca3af; font-size: 0.9em; margin: 8px 0 0 0;">Create presets in the settings first</p>
                </div>
            ` : `
                <div style="display: flex; flex-direction: column; gap: 20px;">
                    ${positivePresets.length > 0 ? `
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                                <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%;"></span>
                                <span style="font-weight: 600; color: #1f2937;">Positive</span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                                ${positivePresets.map(preset => `
                                    <button class="rating-btn positive" data-preset='${JSON.stringify(preset)}' style="
                                        background: #f0fdf4;
                                        border: 2px solid #10b981;
                                        border-radius: 8px;
                                        padding: 12px;
                                        cursor: pointer;
                                        display: flex;
                                        align-items: center;
                                        gap: 10px;
                                        transition: all 0.2s;
                                    ">
                                        <span style="font-size: 20px;">${preset.emoji}</span>
                                        <div style="flex: 1; text-align: left;">
                                            <div style="font-weight: 600; color: #1f2937; font-size: 0.9em;">${preset.name}</div>
                                            <div style="color: #10b981; font-size: 0.8em;">+${preset.scoreValue}</div>
                                        </div>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                    
                    ${negativePresets.length > 0 ? `
                        <div>
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 12px;">
                                <span style="width: 8px; height: 8px; background: #ef4444; border-radius: 50%;"></span>
                                <span style="font-weight: 600; color: #1f2937;">Needs Improvement</span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px;">
                                ${negativePresets.map(preset => `
                                    <button class="rating-btn negative" data-preset='${JSON.stringify(preset)}' style="
                                        background: #fef2f2;
                                        border: 2px solid #ef4444;
                                        border-radius: 8px;
                                        padding: 12px;
                                        cursor: pointer;
                                        display: flex;
                                        align-items: center;
                                        gap: 10px;
                                        transition: all 0.2s;
                                    ">
                                        <span style="font-size: 20px;">${preset.emoji}</span>
                                        <div style="flex: 1; text-align: left;">
                                            <div style="font-weight: 600; color: #1f2937; font-size: 0.9em;">${preset.name}</div>
                                            <div style="color: #ef4444; font-size: 0.8em;">-${preset.scoreValue}</div>
                                        </div>
                                    </button>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
            `}
        `;

        modalContainer.appendChild(modalContent);
        document.body.appendChild(modalContainer);

        // Add event listeners
        document.getElementById('close-modal').addEventListener('click', () => {
            document.body.removeChild(modalContainer);
        });

        modalContainer.addEventListener('click', (e) => {
            if (e.target === modalContainer) {
                document.body.removeChild(modalContainer);
            }
        });

        // Add hover effects
        modalContent.querySelectorAll('.rating-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                if (btn.classList.contains('positive')) {
                    btn.style.background = '#dcfce7';
                } else {
                    btn.style.background = '#fee2e2';
                }
            });
            btn.addEventListener('mouseleave', () => {
                if (btn.classList.contains('positive')) {
                    btn.style.background = '#f0fdf4';
                } else {
                    btn.style.background = '#fef2f2';
                }
            });
            btn.addEventListener('click', () => {
                const preset = JSON.parse(btn.getAttribute('data-preset'));
                document.body.removeChild(modalContainer);
                applyGroupRating(preset, groupMembers);
            });
        });
    };

    const applyGroupRating = async (preset, groupMembers) => {
        try {
            const category = `${preset.name} (Group)`;
            let updatedStudentScores = { ...studentScores };

            // Apply rating to all group members
            for (const member of groupMembers) {
                const currentScores = updatedStudentScores[member.userId] || {};
                const currentCategoryScore = currentScores[category] || 0;
                const scoreChange = preset.scoreType === 'subtract' ? -preset.scoreValue : preset.scoreValue;
                
                updatedStudentScores[member.userId] = {
                    ...currentScores,
                    [category]: currentCategoryScore + scoreChange
                };
            }

            // Save to database
            await axios.put(`${API_BASE_URL}/api/classrooms/${classId}/seating`, {
                studentScores: updatedStudentScores
            }, {
                headers: { 'x-auth-token': user.token }
            });

            setStudentScores(updatedStudentScores);

            // ✨ Track score changes in active session
            if (isSessionActive) {
                const scoreChange = preset.scoreType === 'subtract' ? -preset.scoreValue : preset.scoreValue;
                const newChanges = groupMembers.map(member => ({
                    studentId: member.userId,
                    studentName: assignedUsers[Object.keys(assignedUsers).find(
                        key => assignedUsers[key].userId === member.userId
                    )]?.userName || member.userName || 'Unknown',
                    photoURL: member.photoURL || null,
                    category: category,
                    pointsChange: scoreChange,
                    timestamp: new Date()
                }));
                setSessionScoreChanges(prev => [...prev, ...newChanges]);
            }

            // Emit real-time score updates for each member
            groupMembers.forEach(member => {
                const memberName = assignedUsers[Object.keys(assignedUsers).find(
                    key => assignedUsers[key].userId === member.userId
                )]?.userName || member.userName;
                
                emitScoreUpdate(member.userId, updatedStudentScores[member.userId], category, memberName);
            });

            // Show success message
            Swal.fire({
                icon: 'success',
                title: t('classroomPage.swal.groupRatedTitle') || '🏆 Group Rated!',
                html: `
                    <div style="text-align: left;">
                        <p><strong>${preset.name}</strong> applied to <strong>${groupMembers.length}</strong> student(s)</p>
                        <p style="margin: 8px 0 0 0; font-size: 0.9em; color: #666;">
                            Each ${preset.scoreType === 'subtract' ? 'lost' : 'gained'} <strong>${preset.scoreValue}</strong> points
                        </p>
                    </div>
                `,
                timer: 3000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true,
                background: '#f0fdf4',
                color: '#166534'
            });

        } catch (error) {
            console.error('Error applying group rating:', error);
            Swal.fire({
                icon: 'error',
                title: t('common.error') || 'Error',
                text: t('classroomPage.swal.groupRatedErrorText') || 'Failed to apply group rating. Please try again.',
                timer: 2000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
        }
    };

    const handleApplyRating = async (preset) => {
        try {
            const studentUser = assignedUsers[selectedStudentChair];
            if (!studentUser) return;

            const studentId = studentUser.userId;
            const currentScores = studentScores[studentId] || {};
            const category = preset.name;
            const currentCategoryScore = currentScores[category] || 0;
            const scoreChange = preset.scoreType === 'subtract' ? -preset.scoreValue : preset.scoreValue;

            // Update the score for the specific category
            const updatedCategoryScore = currentCategoryScore + scoreChange;

            const updatedStudentScores = {
                ...studentScores,
                [studentId]: {
                    ...currentScores,
                    [category]: updatedCategoryScore
                }
            };

            // Save the entire updated scores object to the database
            await axios.put(`${API_BASE_URL}/api/classrooms/${classId}/seating`, {
                studentScores: updatedStudentScores
            }, {
                headers: { 'x-auth-token': user.token }
            });

            // Update local state
            setStudentScores(updatedStudentScores);

            // ✨ Track score change in active session
            if (isSessionActive) {
                setSessionScoreChanges(prev => [...prev, {
                    studentId: studentId,
                    studentName: studentUser?.userName || 'Unknown',
                    photoURL: studentUser?.photoURL || null,
                    category: category,
                    pointsChange: scoreChange,
                    timestamp: new Date()
                }]);
            }

            // Emit real-time update
            emitScoreUpdate(studentId, updatedStudentScores[studentId], preset.name, studentUser.userName);

            Swal.fire({
                icon: 'success',
                title: t('classroomPage.swal.scoreUpdatedTitle') || 'Score Updated',
                text: t('classroomPage.swal.scoreUpdatedText', { presetName: preset.name, studentName: studentUser.userName }) || `${preset.name} applied to ${studentUser.userName}`,
                timer: 2000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });

        } catch (error) {
            console.error('Error applying rating:', error);
            Swal.fire({
                icon: 'error',
                title: t('common.error') || 'Error',
                text: t('classroomPage.swal.ratingErrorText') || 'Failed to apply rating. Please try again.'
            });
        }
    };

    const fetchClassroomDetails = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/classrooms/${classId}`, {
                headers: { 'x-auth-token': user.token }
            });
            setClassroom(response.data);
            const fetchedPositions = response.data.seatingPositions || {};
            const fetchedAssignedUsers = response.data.assignedUsers || {};
            const fetchedScores = response.data.studentScores || {};
            const fetchedGroups = response.data.chairGroups || []; // Load groups

            console.log('Fetched scores from server:', fetchedScores);

            // ✨ Preserve working seating draft if currently in edit mode
            if (!isEditingRef.current) {
                setSeatingPositions(fetchedPositions);
                setCurrentChairPositions(fetchedPositions);
                setChairGroups(fetchedGroups);
            } else {
                // In edit mode, update baseline seating positions without wiping draft
                setSeatingPositions(fetchedPositions);
            }
            setAssignedUsers(fetchedAssignedUsers);
            setStudentScores(fetchedScores);
            setAttendance(response.data.attendance || {}); // ✨ Load attendance
            setAttendanceDays(response.data.attendanceDays || 20); // ✨ Load attendance days (default to 20)

            // ✨ Initialize classroom events
            const fetchedEvents = response.data.classroomEvents || [];
            setClassroomEvents(fetchedEvents);

            setLoading(false);
        } catch (err) {
            if (err.response?.status === 403 && err.response?.data?.requiresInvitation) {
                // Redirect to private classroom page
                navigate(`/classroom/${classId}/private`);
                return;
            } else {
                // Redirect to error page
                navigate(`/classroom/${classId}/error`);
                return;
            }

        }
    }, [classId, user, navigate]);

    // ✨ Fetch chat history on mount
    const fetchChatHistory = useCallback(async () => {
        try {
            console.log('🔄 Fetching chat history for classroom:', classId);
            const response = await axios.get(`${API_BASE_URL}/api/classrooms/${classId}/chat`, {
                headers: { 'x-auth-token': user.token }
            });

            console.log('📦 Chat API Response:', response.data);

            const { chatMessages } = response.data;

            // Ensure chatMessages is always an array
            const messages = Array.isArray(chatMessages) ? chatMessages : [];
            setChatMessages(messages);
            console.log('✅ Loaded chat history:', messages.length, 'messages');

            // Auto-scroll to bottom after loading chat history
            setTimeout(() => {
                if (chatContainerRef.current) {
                    chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
                    console.log('📜 Auto-scrolled chat to bottom');
                }
            }, 200);
        } catch (err) {
            console.error('❌ Error fetching chat history:', err);
            console.error('❌ Error details:', err.response?.data || err.message);
            // Don't show error to user, just start with empty chat
            setChatMessages([]);
        }
    }, [classId, user]);

    // ✨ Fetch active session on mount
    const fetchActiveSession = useCallback(async () => {
        if (!isCreator) return;
        try {
            const response = await axios.get(`${API_BASE_URL}/api/classrooms/${classId}/sessions?limit=1`, {
                headers: { 'x-auth-token': user.token }
            });
            const { sessions } = response.data;
            if (sessions && sessions.length > 0) {
                const latestSession = sessions[0];
                if (!latestSession.endedAt) {
                    // Session is still active, restore state
                    setIsSessionActive(true);
                    setSessionId(latestSession._id);
                    const startTime = new Date(latestSession.startedAt);
                    setSessionStartTime(startTime);
                    setSessionScoreChanges(latestSession.scoreChanges || []);
                    
                    const elapsed = Math.floor((Date.now() - startTime.getTime()) / 1000);
                    setSessionElapsed(elapsed > 0 ? elapsed : 0);

                    // Re-start timer
                    if (sessionTimerRef.current) clearInterval(sessionTimerRef.current);
                    sessionTimerRef.current = setInterval(() => {
                        setSessionElapsed(prev => {
                            const next = prev + 1;
                            if (next >= 18000) { // 5 hours limit
                                handleEndSession();
                            }
                            return next;
                        });
                    }, 1000);
                    
                    console.log('✅ Restored active session:', latestSession._id);
                }
            }
        } catch (err) {
            console.error('❌ Error fetching active session:', err);
        }
    }, [classId, user, isCreator]);

    useEffect(() => {
        if (!user || !user.token || !classId) return;

        setLoading(true);
        fetchClassroomDetails();
        fetchChatHistory(); // ✨ Load chat history whenever classId changes
        fetchActiveSession(); // ✨ Restore session state if active

        if (isCreator) {
            fetchRatePresets();
        }
    }, [classId, user, fetchClassroomDetails, fetchChatHistory, fetchRatePresets, isCreator, fetchActiveSession]);

    // ✨ Polling Fallback: Fetch classroom details every 5 seconds to ensure member list is up-to-date
    // (Since server join events are not reliably broadcasting)
    useEffect(() => {
        if (!classId || !user?.token) return;

        const interval = setInterval(() => {
            // Silently fetch updates (don't set loading state)
            fetchClassroomDetails();
        }, 5000);

        return () => clearInterval(interval);
    }, [classId, user, fetchClassroomDetails]);

    const handleAssign = async (name) => {
        if (!selectedChairId || !user) return;

        // ลบที่เดิมถ้ามี
        const prevSeatId = Object.keys(assignedUsers).find(
            key => assignedUsers[key]?.userId === user.id
        );
        const newAssignedUsers = { ...assignedUsers };
        let action = 'sit';

        if (prevSeatId) {
            delete newAssignedUsers[prevSeatId];
            action = 'move';
        }

        // จองที่ใหม่
        newAssignedUsers[selectedChairId] = {
            userName: name,
            userId: user.id,
            photoURL: user.photoURL,
        };

        setAssignedUsers(newAssignedUsers);
        setModalOpen(false);

        // Emit real-time chair seating update
        emitChairSeatingUpdate(selectedChairId, newAssignedUsers, action, name);

        try {
            await axios.put(
                `${API_BASE_URL}/api/classrooms/${classId}/seating`,
                {
                    seatingPositions,
                    assignedUsers: newAssignedUsers
                },
                { headers: { 'x-auth-token': user.token } }
            );
            fetchClassroomDetails();
        } catch (e) {
            alert('Save failed.');
        }
    };

    const handleSavePositions = async () => {
        try {
            await axios.put(`${API_BASE_URL}/api/classrooms/${classId}/seating`, {
                seatingPositions: currentChairPositions,
                chairGroups: chairGroups // ✨ Save groups
            }, {
                headers: { 'x-auth-token': user.token }
            });

            setSeatingPositions(currentChairPositions);
            setIsEditing(false);
            editModeBaseSizeRef.current = null;
            setIsGroupingMode(false); // Exit grouping mode on save
            setSelectedChairsForGroup([]); // Clear selected chairs

            // Emit final chair positions to all users
            emitChairMovement(currentChairPositions, null);
            // ✨ Emit chair groups
            emitChairGroupUpdate(chairGroups);

            Swal.fire(t('classroomPage.swal.savedTitle') || 'Saved!', t('classroomPage.swal.savedText') || 'Seating arrangement updated successfully.', 'success');
        } catch (error) {
            console.error('Failed to save seating positions:', error);
            Swal.fire(t('common.error') || 'Error', t('classroomPage.swal.saveErrorText') || 'Failed to save seating arrangement.', 'error');
        }
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
        editModeBaseSizeRef.current = null;
        setCurrentChairPositions(seatingPositions);
        setIsGroupingMode(false); // Exit grouping mode on cancel
        setSelectedChairsForGroup([]); // Clear selected chairs
    };

    const handleToggleEditMode = () => {
        if (!isCreator) return;
        setIsEditing(prev => {
            const next = !prev;
            if (next) {
                editModeBaseSizeRef.current = getBoundsAndDimensions(currentChairPositions && Object.keys(currentChairPositions).length > 0 ? currentChairPositions : seatingPositions);
            } else {
                editModeBaseSizeRef.current = null;
            }
            return next;
        });
        setIsGroupingMode(false); // Exit grouping mode when toggling edit mode
        setSelectedChairsForGroup([]); // Clear selected chairs
    };

    const handleLeaveSeat = async () => {
        if (!user) return;
        const seatId = Object.keys(assignedUsers).find(
            key => assignedUsers[key]?.userId === user.id
        );
        if (!seatId) return;

        const currentUser = assignedUsers[seatId];
        const newAssignedUsers = { ...assignedUsers };
        delete newAssignedUsers[seatId];
        setAssignedUsers(newAssignedUsers);

        // Emit real-time chair seating update
        emitChairSeatingUpdate(seatId, newAssignedUsers, 'leave', currentUser?.userName || user.displayName);

        try {
            await axios.put(
                `${API_BASE_URL}/api/classrooms/${classId}/seating`,
                {
                    seatingPositions,
                    assignedUsers: newAssignedUsers
                },
                { headers: { 'x-auth-token': user.token } }
            );
            fetchClassroomDetails();
        } catch (e) {
            alert('Failed to leave the seat.');
        }
    };

    const handleResetAllChairs = async () => {
        if (!isCreator) return;

        const result = await Swal.fire({
            title: t('classroomPage.swal.resetChairsTitle') || 'Reset All Chairs?',
            text: t('classroomPage.swal.resetChairsText') || "Are you sure you want to make all students leave their chairs? This cannot be undone.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: t('classroomPage.swal.yesResetBtn') || 'Yes, Reset All',
            cancelButtonText: t('common.cancel') || 'Cancel'
        });

        if (result.isConfirmed) {
            try {
                // Optimistic update
                const emptyAssignedUsers = {};
                setAssignedUsers(emptyAssignedUsers);

                // Save to DB
                await axios.put(`${API_BASE_URL}/api/classrooms/${classId}/seating`, {
                    assignedUsers: emptyAssignedUsers
                }, {
                    headers: { 'x-auth-token': user.token }
                });

                // Emit socket update
                emitChairSeatingUpdate(null, emptyAssignedUsers, 'leave_all', 'Instructor');

                Swal.fire({
                    icon: 'success',
                    title: t('classroomPage.swal.chairsResetTitle') || 'Chairs Reset',
                    text: t('classroomPage.swal.chairsResetText') || 'All students have been moved out of their chairs.',
                    timer: 2000,
                    showConfirmButton: false,
                    toast: true,
                    position: 'top-end'
                });
            } catch (error) {
                console.error('Error resetting chairs:', error);
                Swal.fire(t('common.error') || 'Error', t('classroomPage.swal.resetErrorText') || 'Failed to reset chairs.', 'error');
                fetchClassroomDetails(); // Rollback if error
            }
        }
    };

    const onPromoteMember = async (memberId, memberName) => {
        try {
            const result = await Swal.fire({
                title: t('classroomPage.swal.promoteTitle', { memberName }) || `Promote ${memberName} to Creator?`,
                text: t('classroomPage.swal.promoteText') || "This user will gain the same permissions as the classroom owner.",
                icon: 'question',
                showCancelButton: true,
                confirmButtonColor: '#3085d6',
                cancelButtonColor: '#d33',
                confirmButtonText: t('classroomPage.swal.promoteBtn') || 'Promote',
                cancelButtonText: t('common.cancel') || 'Cancel'
            });
            if (result.isConfirmed) {
                await axios.put(
                    `${API_BASE_URL}/api/classrooms/${classId}/promote`,
                    { userId: memberId },
                    { headers: { 'x-auth-token': user.token } }
                );
                Swal.fire(t('common.success') || 'Success', t('classroomPage.swal.promoteSuccess', { memberName }) || `${memberName} has been promoted to Creator.`, 'success');
                fetchClassroomDetails();
            }
        } catch (err) {
            Swal.fire(t('common.error') || 'Error', t('classroomPage.swal.promoteError') || 'Could not promote the member.', 'error');
        }
    };

    const onDemoteMember = async (memberId, memberName) => {
        try {
            const result = await Swal.fire({
                title: t('classroomPage.swal.demoteTitle', { memberName }) || `Demote ${memberName}?`,
                text: t('classroomPage.swal.demoteText') || "This user will lose their Creator permissions.",
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#e74c3c',
                cancelButtonColor: '#3085d6',
                confirmButtonText: t('classroomPage.swal.demoteBtn') || 'Demote',
                cancelButtonText: t('common.cancel') || 'Cancel'
            });
            if (result.isConfirmed) {
                await axios.put(
                    `${API_BASE_URL}/api/classrooms/${classId}/demote`,
                    { userId: memberId },
                    { headers: { 'x-auth-token': user.token } }
                );
                Swal.fire(t('common.success') || 'Success', t('classroomPage.swal.demoteSuccess', { memberName }) || `${memberName} has been demoted to a participant.`, 'success');
                fetchClassroomDetails();
            }
        } catch (err) {
            Swal.fire(t('common.error') || 'Error', err.response?.data?.msg || t('classroomPage.swal.demoteError') || 'Could not demote the member.', 'error');
        }
    };

    const handleKickMember = async (memberId, memberName) => {
        const result = await Swal.fire({
            title: t('classroomPage.swal.kickTitle', { memberName }) || `Kick ${memberName} from the classroom?`,
            text: t('classroomPage.swal.kickText') || "This user will be removed from the classroom.",
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: t('classroomPage.swal.kickBtn') || 'Kick',
            cancelButtonText: t('common.cancel') || 'Cancel',
            confirmButtonColor: '#e74c3c'
        });
        if (result.isConfirmed) {
            try {
                await axios.put(
                    `${API_BASE_URL}/api/classrooms/${classId}/kick`,
                    { userId: memberId },
                    { headers: { 'x-auth-token': user.token } }
                );
                Swal.fire(t('common.success') || 'Success', t('classroomPage.swal.kickSuccess', { memberName }) || `${memberName} has been kicked from the classroom.`, 'success');
                fetchClassroomDetails();
            } catch (err) {
                Swal.fire(t('common.error') || 'Error', t('classroomPage.swal.kickError') || 'Could not kick the member.', 'error');
            }
        }
    };



    const handleApplyPreset = async (presetType) => {
        if (!containerRef.current) return;

        const containerRect = containerRef.current.getBoundingClientRect();
        const chairCount = Object.keys(currentChairPositions).length;

        if (chairCount === 0) {
            Swal.fire(t('classroomPage.swal.noChairsTitle') || 'No Chairs', t('classroomPage.swal.noChairsText') || 'Please add some chairs first before applying presets.', 'info');
            return;
        }

        const presetLabel = presetType.charAt(0).toUpperCase() + presetType.slice(1);
        const result = await Swal.fire({
            title: t('classroomPage.swal.applyLayoutTitle', { presetType: presetLabel }) || `Apply ${presetLabel} Layout?`,
            text: t('classroomPage.swal.applyLayoutText') || "This will rearrange all chairs according to the selected preset.",
            icon: 'question',
            showCancelButton: true,
            confirmButtonColor: '#3085d6',
            cancelButtonColor: '#d33',
            confirmButtonText: t('classroomPage.swal.applyLayoutBtn') || 'Apply Layout',
            cancelButtonText: t('common.cancel') || 'Cancel'
        });

        if (result.isConfirmed) {
            const newPositions = ChairPresets.generatePreset(
                presetType,
                chairCount,
                containerRect.width || 800,
                containerRect.height || 600
            );

            // Map existing chair IDs to new positions
            const chairIds = Object.keys(currentChairPositions);
            const updatedPositions = {};

            chairIds.forEach((chairId, index) => {
                const presetKey = `chair-${index + 1}`;
                if (newPositions[presetKey]) {
                    updatedPositions[chairId] = newPositions[presetKey];
                } else {
                    updatedPositions[chairId] = currentChairPositions[chairId];
                }
            });

            setCurrentChairPositions(updatedPositions);
            editModeBaseSizeRef.current = getBoundsAndDimensions(updatedPositions);
            Swal.fire(t('common.success') || 'Success', t('classroomPage.swal.layoutAppliedText', { presetType: presetLabel }) || `${presetLabel} layout applied!`, 'success');
        }
    };

    const calculateContainerSize = () => {
        if (!isEditing) {
            return getBoundsAndDimensions(seatingPositions);
        }

        // When editing, lock minX and minY using editModeBaseSizeRef so translate origin NEVER jumps while dragging
        const baseSize = editModeBaseSizeRef.current || getBoundsAndDimensions(seatingPositions);
        const chairList = Object.values(currentChairPositions || {}).filter(pos => pos && typeof pos.x === 'number');
        const chairWidth = 80;
        const chairHeight = 100;

        let maxX = baseSize.minX + baseSize.width - baseSize.padding * 2 - chairWidth;
        let maxY = baseSize.minY + baseSize.height - baseSize.padding * 2 - chairHeight;

        chairList.forEach(pos => {
            if (pos.x > maxX) maxX = pos.x;
            if (pos.y > maxY) maxY = pos.y;
        });

        const expandedWidth = Math.max(baseSize.width, Math.round(maxX + chairWidth - baseSize.minX + baseSize.padding * 2));
        const expandedHeight = Math.max(baseSize.height, Math.round(maxY + chairHeight - baseSize.minY + baseSize.padding * 2));

        return {
            width: expandedWidth,
            height: expandedHeight,
            minX: baseSize.minX,
            minY: baseSize.minY,
            padding: baseSize.padding
        };
    };

    const renderSeatingChart = () => {
        if (!seatingPositions || Object.keys(seatingPositions).length === 0) {
            return <div className="no-seating-chart">No seating chart available.</div>;
        }

        const positions = isEditing ? currentChairPositions : seatingPositions;
        // ✨ Filter valid chairs for rendering logic to match bounds
        const chairList = Object.entries(positions).filter(([_, pos]) => pos && typeof pos.x === 'number');
        const containerSize = calculateContainerSize();

        return (
            <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <AnimatePresence>
                    {isViewChanging && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            style={{
                                position: 'absolute',
                                top: 0,
                                left: 0,
                                width: '100%',
                                height: '100%',
                                zIndex: 9999,
                                pointerEvents: 'all'
                            }}
                        >
                            <Loader contained={true} />
                        </motion.div>
                    )}
                </AnimatePresence>
                <div
                    className="seating-container-wrapper"
                    ref={seatingWrapperRef}
                    onMouseDown={handleMouseDown}
                    style={{
                        width: '100%',
                        flex: 1,
                        height: '100%',
                        overflowX: 'auto',
                        overflowY: 'auto',
                        borderRadius: '12px',
                        backgroundColor: '#f8fafc',
                        padding: '8px',
                        cursor: isPanning ? 'grabbing' : 'grab',
                        display: 'flex', // Enable Flexbox for margin: auto centering
                        // Remove alignItems/justifyContent to let margin: auto handle safe centering
                    }}>

                    <div className="seating-grid-wrapper" style={{
                        position: 'relative',
                        width: `${containerSize.width * zoomLevel}px`,
                        height: `${containerSize.height * zoomLevel}px`,
                        // ✨ Increase padding to 120px to provide generous buffer for board and edges
                        padding: `${120 * zoomLevel}px`,
                        margin: 'auto',
                        boxSizing: 'content-box', // ✨ FORCE content-box so padding doesn't eat width
                    }}>
                        <div className="seating-grid" ref={containerRef} style={{
                            position: 'relative',
                            width: `${containerSize.width}px`,
                            height: `${containerSize.height}px`,
                            border: '1px solid #ccc',
                            borderRadius: '8px',
                            backgroundColor: '#f9f9f9',
                            // ✨ Grid background only in Edit Mode
                            backgroundImage: isEditing ? 'radial-gradient(circle, #e0e0e0 1px, transparent 1px)' : 'none',
                            backgroundSize: '20px 20px',
                            cursor: isPanning ? 'grabbing' : 'grab',
                            transform: `scale(${zoomLevel})`,
                            transformOrigin: 'top left',
                            transition: 'transform 0.5s ease',
                        }}>
                            <div className="rotation-wrapper" style={{
                                width: '100%',
                                height: '100%',
                                // Remove padding here, use transform instead for precise positioning
                                position: 'relative',
                                transform: `rotate(${isTeacherView ? 180 : 0}deg)`,
                                transformOrigin: 'center center',
                                transition: 'transform 0.5s ease'
                            }}>
                                <div
                                    id="front-classroom-board"
                                    className="front-classroom-board"
                                    style={{
                                        transform: `translateX(-50%) rotate(${isTeacherView ? 180 : 0}deg)`, // ✨ Rotate text
                                        transition: 'transform 0.5s ease'
                                    }}>
                                    <span className="board-label">{t('classroomPage.frontOfClass') || 'FRONT OF CLASSROOM'}</span>
                                </div>

                                {/* ✨ Centering Group for Chairs */}
                                <div style={{
                                    position: 'absolute',
                                    top: 0,
                                    left: 0,
                                    width: '100%',
                                    height: '100%',
                                    // ✨ Shift chairs: -minX + Padding
                                    // This moves the cluster to start exactly at 'Padding' px from top/left
                                    transform: `translate(${-containerSize.minX + containerSize.padding}px, ${-containerSize.minY + containerSize.padding}px)`,
                                    pointerEvents: 'none' // Let clicks pass through to chairs
                                }}>

                                    {/* ✨ Render Group Overlay */}
                                    <GroupOverlay
                                        groups={[
                                            ...chairGroups,
                                            // Render current selection as a temporary group
                                            ...(selectedChairsForGroup.length > 0 ? [{
                                                id: 'temp-group',
                                                chairIds: selectedChairsForGroup,
                                                label: `${selectedChairsForGroup.length}/${groupSizeInput}`,
                                                color: '#90cdf4'
                                            }] : [])
                                        ]}
                                        chairPositions={isEditing ? currentChairPositions : seatingPositions}
                                        rotation={isTeacherView ? -180 : 0} // ✨ Counter-rotate labels
                                    />

                                    {chairList.map(([id, pos]) => {
                                        const assignedUser = assignedUsers[id];
                                        const photoURL = getProfileImageSrc(assignedUser?.photoURL, isGoogleUser(assignedUser));
                                        const userName = assignedUser?.userName || null;

                                        const userScoreRecord = assignedUser ? studentScores[assignedUser.userId] || {} : {};
                                        const userScore = Object.values(userScoreRecord).reduce((sum, score) => sum + score, 0);

                                        // Calculate min and max scores for relative scaling
                                        const allScores = Object.values(studentScores).map(record => Object.values(record).reduce((sum, score) => sum + score, 0));
                                        const hasAnyScores = allScores.some(score => score > 0);
                                        const minScore = hasAnyScores ? Math.min(...allScores.filter(score => score >= 0)) : 0;
                                        const maxScore = hasAnyScores ? Math.max(...allScores) : 0;

                                        console.log(`Rendering Chair ${id}: userScore=${userScore}, maxScore=${maxScore}`);

                                        // ✨ Determine group color for this chair
                                        let groupColor = null;
                                        if (assignedUser) {
                                            const activeGroupingEvent = classroomEvents?.find(e => e.type === 'grouping' && e.status === 'active');
                                            if (activeGroupingEvent) {
                                                const userResult = activeGroupingEvent.results?.find(r => r.userId === assignedUser.userId);
                                                if (userResult) {
                                                    const group = activeGroupingEvent.config?.groups?.find(g => (g.id || g.name) === userResult.text);
                                                    if (group) {
                                                        groupColor = group.color;
                                                    }
                                                }
                                            }
                                        }

                                        return (
                                            <Chair
                                                key={`${id}-${userScore}`} // ✨ Removed Date.now() to prevent remounting on drag
                                                id={id}
                                                initialPosition={pos}
                                                onChairMove={handleChairMove}
                                                containerRef={containerRef}
                                                isDraggable={isEditing && !isGroupingMode} // ✨ Disable drag when grouping
                                                userPhotoURL={photoURL}
                                                userName={userName}
                                                onChairClick={handleChairClick}
                                                userScore={userScore}
                                                minScore={minScore}
                                                maxScore={maxScore}
                                                hasAnyScores={hasAnyScores}
                                                isCreator={isCreator}
                                                rotation={isTeacherView ? -180 : 0} // ✨ Counter-rotate chairs
                                                isSelectedForGroup={selectedChairsForGroup.includes(id)} // Highlight selected chairs
                                                selectionIndex={selectedChairsForGroup.indexOf(id) !== -1 ? selectedChairsForGroup.indexOf(id) + 1 : 0} // ✨ Pass selection index
                                                zoomScale={zoomLevel} // ✨ Pass zoom level for drag correction
                                                isHandRaised={assignedUser && raisedHands.has(assignedUser.userId)} // ✨ Pass raised hand state
                                                currentEmoji={assignedUser && activeEmojis[assignedUser.userId]?.emoji} // ✨ Pass current emoji
                                                groupColor={groupColor}
                                                showScoreBar={classroom?.showScoreBar}
                                            />
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    if (loading) {
        return <Loader />;
    }

    if (error) {
        return <div className="error">{error}</div>;
    }

    if (!classroom) {
        return <div>Classroom not found.</div>;
    }



    const userSeatId = Object.keys(assignedUsers).find(
        key => assignedUsers[key]?.userId === user.id
    );

    // ✨ Teaching Session Handlers
    const formatSessionTime = (totalSeconds) => {
        const h = Math.floor(totalSeconds / 3600);
        const m = Math.floor((totalSeconds % 3600) / 60);
        const s = totalSeconds % 60;
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const handleStartSession = async () => {
        try {
            const res = await axios.post(
                `${API_BASE_URL}/api/classrooms/${classId}/session/start`,
                {},
                { headers: { 'x-auth-token': user.token } }
            );
            setIsSessionActive(true);
            setSessionStartTime(new Date());
            setSessionId(res.data.session._id);
            setSessionScoreChanges([]);
            setSessionElapsed(0);

            // Start timer
            sessionTimerRef.current = setInterval(() => {
                setSessionElapsed(prev => {
                    const next = prev + 1;
                    if (next >= 18000) { // 5 hours in seconds
                        handleEndSession();
                    }
                    return next;
                });
            }, 1000);

            Swal.fire({
                icon: 'success',
                title: '🎓 Session Started!',
                text: 'Teaching session is now active. Scores will be tracked.',
                timer: 2000,
                showConfirmButton: false,
                position: 'top-end',
                toast: true
            });
        } catch (err) {
            console.error('Error starting session:', err);
            Swal.fire('Error', err.response?.data?.msg || 'Failed to start session.', 'error');
        }
    };

    const handleEndSession = async () => {
        const result = await Swal.fire({
            title: '🏁 End Teaching Session?',
            text: `Session has been running for ${formatSessionTime(sessionElapsed)}. End now?`,
            icon: 'question',
            showCancelButton: true,
            confirmButtonText: 'End Session',
            cancelButtonText: 'Continue',
            confirmButtonColor: '#e74c3c'
        });

        if (!result.isConfirmed) return;

        try {
            // Stop timer
            if (sessionTimerRef.current) {
                clearInterval(sessionTimerRef.current);
                sessionTimerRef.current = null;
            }

            const res = await axios.post(
                `${API_BASE_URL}/api/classrooms/${classId}/session/end`,
                {
                    sessionId: sessionId,
                    scoreChanges: sessionScoreChanges
                },
                { headers: { 'x-auth-token': user.token } }
            );

            // Show summary modal
            setSessionSummaryData(res.data.session);
            setShowSessionSummary(true);

            // Reset session state
            setIsSessionActive(false);
            setSessionStartTime(null);
            setSessionId(null);
            setSessionScoreChanges([]);
            setSessionElapsed(0);
        } catch (err) {
            console.error('Error ending session:', err);
            Swal.fire('Error', err.response?.data?.msg || 'Failed to end session.', 'error');
        }
    };

    const actionBarActions = [
        ...(!isCreator ? [{
            id: 'raise-hand',
            icon: <FaHandPaper />,
            label: t('classroomPage.actions.raiseHand') || 'Raise Hand',
            onClick: handleRaiseHand,
            isActive: raisedHands.has(user.id) // ✨ Show active state
        }] : []),
        ...(!isCreator ? [{
            id: 'emoji',
            icon: <FaSmile />,
            label: t('classroomPage.actions.emoji') || 'Emoji',
            onClick: handleEmoji,
            isActive: isEmojiPickerOpen,
            isPopover: true,
            popoverContent: (
                <div className="emoji-picker-popover">
                    {['👍', '👎', '😂', '😮', '❤️', '🎉', '👋', '🤔'].map(emoji => (
                        <button key={emoji} onClick={() => handleSendEmoji(emoji)} className="emoji-btn">
                            {emoji}
                        </button>
                    ))}
                </div>
            )
        }] : []),
        {
            id: 'chat',
            icon: <FaComment />,
            label: t('classroomPage.actions.chat') || 'Chat',
            onClick: handleChat,
            isActive: isChatSidebarOpen
        },
        ...(isCreator ? [{
            id: 'grouping',
            icon: <FaUsers />,
            label: t('classroomPage.actions.createGroups') || 'Create Groups',
            onClick: () => setIsGroupModalOpen(true),
            isActive: isGroupModalOpen
        }] : []),
        ...(isCreator && isSessionActive ? [{
            id: 'session',
            icon: <FaClock />,
            label: t('classroomPage.actions.sessionActive') || 'Session Active',
            onClick: () => {},
            isActive: true
        }] : []),
        ...(isCreator ? [{
            id: 'attendance',
            icon: <FaUserCheck />,
            label: t('classroomPage.actions.attendance') || 'Attendance',
            onClick: () => handleCheckAttendance(), // Call with no arguments for Everyone
            isActive: false
        }] : [])
    ];

    const handleConnectClick = async () => {
        if (isGroupingMode) {
            setIsGroupingMode(false);
            setSelectedChairsForGroup([]);
        } else {
            const { value: size } = await Swal.fire({
                title: 'Group Size',
                text: 'Enter number of chairs to connect (max 5)',
                input: 'number',
                inputValue: groupSizeInput,
                showCancelButton: true,
                inputValidator: (value) => {
                    if (!value || value < 2 || value > 5) {
                        return 'Please enter a number between 2 and 5';
                    }
                }
            });

            if (size) {
                setGroupSizeInput(parseInt(size));
                setIsGroupingMode(true);
            }
        }
    };

    if (isCreator) {
        // ✨ Remove Start: Remove Raise Hand for Creator
        const raiseHandIndex = actionBarActions.findIndex(a => a.id === 'raise-hand');
        if (raiseHandIndex !== -1) {
            actionBarActions.splice(raiseHandIndex, 1);
        }
        // ✨ Remove End

        if (isEditing) {
            // Edit Mode Tools
            actionBarActions.push(
                {
                    id: 'layout-rows',
                    icon: <FaTh />,
                    label: t('classroomPage.actions.rowsLayout') || 'Rows Layout',
                    onClick: () => handleApplyPreset('rows'),
                    isActive: false
                },
                {
                    id: 'layout-grid',
                    icon: <FaThLarge />,
                    label: t('classroomPage.actions.gridLayout') || 'Grid Layout',
                    onClick: () => handleApplyPreset('grid'),
                    isActive: false
                },
                {
                    id: 'layout-groups',
                    icon: <FaObjectGroup />,
                    label: t('classroomPage.actions.groupsLayout') || 'Groups Layout',
                    onClick: () => handleApplyPreset('groups'),
                    isActive: false
                },
                {
                    id: 'connect',
                    icon: <FaLink />,
                    label: isGroupingMode ? (t('classroomPage.actions.finishConnecting') || 'Finish Connecting') : (t('classroomPage.actions.connectChairs') || 'Connect Chairs'),
                    onClick: handleConnectClick,
                    isActive: isGroupingMode
                }
            );

            if (chairGroups.length > 0 || isGroupingMode) {
                actionBarActions.push({
                    id: 'undo',
                    icon: <FaUndo />,
                    label: t('classroomPage.actions.undoConnection') || 'Undo Connection',
                    onClick: handleUndoGroup,
                    isActive: false
                });
                actionBarActions.push({
                    id: 'reset',
                    icon: <FaTrash />,
                    label: t('classroomPage.actions.resetConnections') || 'Reset Connections',
                    onClick: handleClearGroups,
                    isActive: false
                });
            }

            // Save/Finish Button
            actionBarActions.push({
                id: 'save',
                icon: <FaCheck />,
                label: t('classroomPage.actions.saveExit') || 'Save & Exit',
                onClick: handleSavePositions,
                isActive: true
            });
        } else {
            // Enter Edit Mode Button
            actionBarActions.push({
                id: 'edit',
                icon: <FaEdit />,
                label: t('classroomPage.actions.editLayout') || 'Edit Layout',
                onClick: handleToggleEditMode,
                isActive: false
            });

            actionBarActions.push({
                id: 'reset-all',
                icon: <FaUsersSlash />, // Assuming FaUsersSlash is imported from 'react-icons/fa'
                label: t('classroomPage.actions.resetAllChairs') || 'Reset All Chairs',
                onClick: handleResetAllChairs,
                isActive: false
            });
        }
    }

    return (
        <>
            <Navbar
                isSidebarOpen={isSidebarOpen}
                toggleSidebar={toggleSidebar}
                user={user}
                onClassActionClick={() => { }}
                classrooms={[]}
                handleSignOut={handleSignOut}
                isClassroomPage={true}
                onShareClick={handleShareClick}
                classroomMembers={{ creator: classroom.creator, participants: classroom.participants }}
                isCreator={isCreator}
                isEditing={isEditing}
                onToggleEditMode={handleToggleEditMode}
                onSavePositions={handleSavePositions}
                onCancelEdit={handleCancelEdit}
                userSeatId={userSeatId}
                onLeaveSeat={handleLeaveSeat}
                onPromoteMember={onPromoteMember}
                onDemoteMember={onDemoteMember}
                onKickMember={handleKickMember}
                classroom={classroom}
                onClassroomBackClick={() => navigate('/')}
                isSessionActive={isSessionActive}
                sessionElapsed={sessionElapsed}
                onStartSession={handleStartSession}
                onEndSession={handleEndSession}
                formatSessionTime={formatSessionTime}
            >
                {/* ✨ Navbar Children removed - Tools moved to ActionBar */}
            </Navbar>



            <main className={`main__content ${isSidebarOpen ? 'shift' : ''}`}>
                <div
                    className={`classroom-header ${isBannerCollapsed ? 'collapsed' : ''}`}
                    style={{
                        borderLeftColor: classroom.color,
                        backgroundImage: classroom.bannerUrl ? `url(${API_BASE_URL}${classroom.bannerUrl})` : 'none'
                    }}
                >
                    <div className="classroom-header-overlay"></div>
                    <div className="classroom-header-content">
                        <div className="classroom-header-title-row">
                            <div className="classroom-header-titles">
                                <h1>{classroom.name}</h1>
                                <p>{classroom.subname}</p>
                            </div>
                            {/* ✨ Student Performance Banner (Visible if enabled & user is student) */}
                            {classroom.showStudentStatus && !isCreator && (
                                <div className="header-student-banner-container">
                                    <StudentStatusBanner classroom={classroom} user={user} />
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Banner toggle button */}
                    <button
                        className="banner-collapse-btn"
                        onClick={() => setIsBannerCollapsed(!isBannerCollapsed)}
                        title={isBannerCollapsed ? "Expand banner" : "Collapse banner"}
                    >
                        {isBannerCollapsed ? <FaChevronDown /> : <FaChevronUp />}
                    </button>
                </div>
                <div className="classroom-layout-container">
                    <div className="seating-chart-section">
                        {/* ✨ Inner Card for White Background */}
                        <div className="seating-area-card">
                            <div className="seating-header">
                                {/* ✨ Styled View Toggle Switch */}
                                <ViewToggle activeView={viewMode} onViewChange={setViewMode} />

                                <div className="seating-controls">
                                    {/* Zoom Controls - use separate handlers per view */}
                                    <div className="zoom-controls">
                                        <button
                                            className="zoom-btn zoom-out"
                                            onClick={viewMode === 'seating' ? handleZoomOut : handleEventZoomOut}
                                            disabled={viewMode === 'seating' ? zoomLevel <= minZoom : eventZoomLevel <= eventMinZoom}
                                            title="Zoom Out"
                                        >
                                            -
                                        </button>
                                        <span className="zoom-level">{Math.round((viewMode === 'seating' ? zoomLevel : eventZoomLevel) * 100)}%</span>
                                        <button
                                            className="zoom-btn zoom-in"
                                            onClick={viewMode === 'seating' ? handleZoomIn : handleEventZoomIn}
                                            disabled={viewMode === 'seating' ? zoomLevel >= maxZoom : eventZoomLevel >= eventMaxZoom}
                                            title="Zoom In"
                                        >
                                            +
                                        </button>
                                        <button
                                            className="zoom-btn zoom-reset"
                                            onClick={viewMode === 'seating' ? handleZoomReset : handleEventZoomReset}
                                            title="Reset Zoom"
                                        >
                                            Reset
                                        </button>

                                        {/* View Toggle Button (seating only) */}
                                        {viewMode === 'seating' && isCreator && (
                                            <button
                                                className={`zoom-btn ${isTeacherView ? 'active' : ''}`}
                                                onClick={handleToggleView}
                                                title={isTeacherView ? "Switch to Back View" : "Switch to Teacher (Front) View"}
                                                style={{ marginLeft: '10px' }}
                                            >
                                                <FaChalkboardTeacher size={16} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Render Content Based on View Mode */}
                            {viewMode === 'seating' ? (
                                <>
                                    {renderSeatingChart()}
                                </>
                            ) : (
                                <ClassroomEvent
                                    isCreator={isCreator}
                                    events={classroomEvents}
                                    onAddEvent={handleAddEvent}
                                    onTriggerEvent={handleTriggerEvent}
                                    onDeleteEvent={handleDeleteEvent}
                                    onSubmitAnswer={handleSubmitAnswer}
                                    onEndEvent={handleEndAndScoreEvent}
                                    onPublishDraftEvent={handlePublishDraftEvent} // ✨ Pass publish handler
                                    candidates={Object.values(assignedUsers).filter(user => user?.userName).map(user => ({
                                        id: user.userId,
                                        name: user.userName,
                                        photoSrc: getProfileImageSrc(user.photoURL, isGoogleUser(user))
                                    }))}
                                    currentUser={user}
                                    zoomScale={eventZoomLevel}
                                />
                            )}
                        </div>

                        {/* ✨ Action Bar outside the white card */}
                        <ActionBar actions={actionBarActions} />
                    </div>

                    {/* ✨ Chat Split Card (Side-by-Side) */}
                    <div className={`chat-split-card ${isChatSidebarOpen ? 'open' : ''}`} style={{ padding: 0 }}>
                        <div className="edit-sidebar-content" style={{ padding: '0', display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                            <ClassChat 
                                classId={classId} 
                                user={user} 
                                isCreator={isCreator} 
                                chatMessages={chatMessages}
                                classroomEvents={classroomEvents}
                                emitChatMessage={emitChatMessage}
                                onSubmitAnswer={handleSubmitAnswer}
                                isSidebarMode={true}
                                onClose={() => setIsChatSidebarOpen(false)}
                            />
                        </div>
                    </div>
                </div>
            </main>
            <ChairAssignModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                onConfirm={handleAssign}
                defaultName={user?.displayName}
            />
            <ChairDropdown
                isOpen={dropdownOpen}
                    onClose={() => setDropdownOpen(false)}
                    position={dropdownPosition}
                    anchorEl={dropdownAnchorEl}
                    onRateStudent={handleRateStudent}
                    onCheckAttendance={() => handleCheckAttendance(
                        selectedStudentChair ? assignedUsers[selectedStudentChair]?.userId : null
                    )}
                    onFunction3={handleFunction3}
                onFunction4={handleFunction4}
                showGroupRating={selectedStudentChair && assignedUsers[selectedStudentChair] && isStudentInGroup(assignedUsers[selectedStudentChair].userId)}
            />
            <StudentRatingModal
                isOpen={ratingModalOpen}
                onClose={() => setRatingModalOpen(false)}
                onRate={handleApplyRating}
                studentName={selectedStudentChair ? assignedUsers[selectedStudentChair]?.userName : ''}
                ratePresets={ratePresets}
            />
            {/* ✨ Grouping Modal */}
            <GroupingModal
                isOpen={isGroupModalOpen}
                onClose={() => setIsGroupModalOpen(false)}
                onCreateGroups={handleCreateGroups}
                activeGroupingEvent={classroomEvents?.find(e => e.type === 'grouping' && e.status === 'active')}
                onCancelGrouping={(event) => handleEndAndScoreEvent(event)}
            />
            {/* ✨ Session Summary Modal */}
            {showSessionSummary && sessionSummaryData && (
                <SessionSummaryModal
                    sessionData={sessionSummaryData}
                    onClose={() => {
                        setShowSessionSummary(false);
                        setSessionSummaryData(null);
                    }}
                />
            )}
        </>
    );
};

export default ClassroomPage;


