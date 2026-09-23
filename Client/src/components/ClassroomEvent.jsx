import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import axios from 'axios';
import Lottie from 'lottie-react';
import { useParams } from 'react-router-dom';
import '../CSS/ClassroomEvent.css';
import WordCloudViz from './events/WordCloudViz';
import { FaPlus, FaTrash, FaImage, FaTimes, FaHandPaper, FaExternalLinkAlt, FaDice, FaQuestionCircle, FaBullhorn, FaCloud, FaPoll, FaClipboardList, FaTrophy, FaUser, FaUndo, FaMagic, FaUsers, FaChevronRight, FaFlagCheckered, FaStar, FaCrown, FaClock } from 'react-icons/fa';
import { getProfileImageSrc, isGoogleUser } from '../utils/profileImageHelper';
import { useTranslation } from 'react-i18next';
import classroomEventEmptyAnimation from '../assets/classroom-event-empty.json';
import API_BASE_URL, { buildAppUrl as buildClientAppUrl, buildServerUrl } from '../config/api';

const CLASSROOM_EVENT_ANIMATION_COLORS = {
    accent: [0.1294117647, 0.7215686275, 0.431372549, 1],
    dark: [0.0901960784, 0.137254902, 0.2274509804, 1],
    ink: [0.0588235294, 0.0901960784, 0.1647058824, 1],
    soft: [0.9137254902, 0.9647058824, 0.9490196078, 1]
};

const CLASSROOM_EVENT_ANIMATION_COLOR_MAP = new Map([
    ['0.4902,0.8235,0.7098,1', CLASSROOM_EVENT_ANIMATION_COLORS.accent],
    ['0.148,0.252,0.2173,1', CLASSROOM_EVENT_ANIMATION_COLORS.dark],
    ['0.1,0.1,0.1,1', CLASSROOM_EVENT_ANIMATION_COLORS.ink],
    ['0.818,0.902,0.874,1', CLASSROOM_EVENT_ANIMATION_COLORS.soft]
]);

const isColorKeyframe = (value) => Array.isArray(value) && value.length === 4 && value.every((channel) => typeof channel === 'number');

const normalizeAnimationColor = (value) => value.map((channel) => Number(channel.toFixed(4))).join(',');

const createThemedClassroomEventAnimation = (animationData) => {
    const themedAnimation = JSON.parse(JSON.stringify(animationData));

    const applyThemeToShapes = (shapes = []) => {
        shapes.forEach((shape) => {
            if (isColorKeyframe(shape?.c?.k)) {
                const replacement = CLASSROOM_EVENT_ANIMATION_COLOR_MAP.get(normalizeAnimationColor(shape.c.k));
                if (replacement) {
                    shape.c.k = replacement;
                }
            }

            if (Array.isArray(shape?.it)) {
                applyThemeToShapes(shape.it);
            }
        });
    };

    const applyThemeToLayers = (layers = []) => {
        layers.forEach((layer) => {
            if (Array.isArray(layer?.shapes)) {
                applyThemeToShapes(layer.shapes);
            }

            if (Array.isArray(layer?.layers)) {
                applyThemeToLayers(layer.layers);
            }
        });
    };

    applyThemeToLayers(themedAnimation.layers);
    themedAnimation.assets?.forEach((asset) => {
        if (Array.isArray(asset?.layers)) {
            applyThemeToLayers(asset.layers);
        }
    });

    return themedAnimation;
};

const getEventImageSrc = (event) => {
    const imageUrl = event?.config?.imageUrl || event?.imageUrl;
    if (!imageUrl) return null;
    return buildServerUrl(imageUrl);
};

const buildPresentationUrl = (classId, eventId) => buildClientAppUrl(`/presentation/${encodeURIComponent(classId)}/${encodeURIComponent(eventId)}`);

const EVENT_TYPES_WITH_TIMER = ['question', 'poll'];

const formatTimerClock = (milliseconds = 0) => {
    const safeMs = Math.max(0, milliseconds);
    const totalSeconds = Math.ceil(safeMs / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

const getEventTimerMeta = (event, now = Date.now()) => {
    const timer = event?.config?.timer;
    if (!EVENT_TYPES_WITH_TIMER.includes(event?.type) || !timer?.enabled) return null;

    const durationSeconds = Math.max(0, Number(timer.durationSeconds) || 0);
    if (!durationSeconds) return null;

    const totalMs = durationSeconds * 1000;
    const startedAt = Number(timer.startedAt) || null;
    const endsAt = Number(timer.endsAt) || null;
    const remainingMs = endsAt ? Math.max(0, endsAt - now) : totalMs;
    const isExpired = Boolean(endsAt && remainingMs <= 0);
    const hasStarted = Boolean(startedAt && endsAt);
    const progress = totalMs > 0 ? Math.max(0, Math.min(100, (remainingMs / totalMs) * 100)) : 0;

    return {
        durationSeconds,
        totalMs,
        startedAt,
        endsAt,
        remainingMs,
        isExpired,
        hasStarted,
        progress
    };
};

const EventTimerBanner = ({ timerMeta, isCreator, eventStatus, labels }) => {
    if (!timerMeta) return null;

    const isDraftPending = !timerMeta.hasStarted && eventStatus === 'draft';
    const isClosed = eventStatus === 'ended';
    const statusText = isClosed
        ? labels.closed
        : isDraftPending
            ? labels.startsWhenPosted
            : timerMeta.isExpired
                ? labels.expired
                : labels.remaining;
    const helperText = isClosed
        ? labels.closedHelp
        : isDraftPending
            ? labels.draftHelp
            : timerMeta.isExpired
                ? (isCreator ? labels.expiredTeacherHelp : labels.expiredStudentHelp)
                : (isCreator ? labels.liveTeacherHelp : labels.liveStudentHelp);
    const clockText = isClosed
        ? labels.closed
        : isDraftPending
            ? formatTimerClock(timerMeta.totalMs)
            : formatTimerClock(timerMeta.remainingMs);
    const progressWidth = isClosed ? 0 : (timerMeta.isExpired ? 0 : timerMeta.progress);

    return (
        <div className={`ev-timer-banner ${timerMeta.isExpired ? 'expired' : ''} ${isDraftPending ? 'pending' : ''} ${isClosed ? 'closed' : ''}`}>
            <div className="ev-timer-top">
                <div className="ev-timer-copy">
                    <span className="ev-timer-pill">
                        <FaClock />
                        {statusText}
                    </span>
                    <span className="ev-timer-helper">{helperText}</span>
                </div>
                <div className="ev-timer-clock">{clockText}</div>
            </div>
            <div className="ev-timer-track">
                <div className="ev-timer-fill" style={{ width: `${progressWidth}%` }} />
            </div>
        </div>
    );
};

const ClassroomEvent = ({ isCreator, events = [], onAddEvent, onTriggerEvent, onDeleteEvent, onSubmitAnswer, onEndEvent, onPublishDraftEvent, candidates = [], currentUser, zoomScale = 1 }) => {
    const { t } = useTranslation();
    const tr = (key, defaultValue, options = {}) => t(key, { defaultValue, ...options });
    const themedClassroomEventEmptyAnimation = useMemo(
        () => createThemedClassroomEventAnimation(classroomEventEmptyAnimation),
        []
    );
    const [isAddEventModalOpen, setIsAddEventModalOpen] = useState(false);
    const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
    const [selectedConfigType, setSelectedConfigType] = useState(null);
    const [studentCountInput, setStudentCountInput] = useState(1);
    const [configError, setConfigError] = useState('');
    const [questionTextInput, setQuestionTextInput] = useState('');
    const [pollOptions, setPollOptions] = useState(['', '']);
    // ✨ Scoring Config State
    const [isScored, setIsScored] = useState(false);
    // Remove global scorePoints/scoreAction
    // Add per-option score state: parallel array of objects { points: 10, action: 'add' }
    const [optionScores, setOptionScores] = useState([{ points: 10, action: 'add' }, { points: 10, action: 'add' }]);

    // ✨ Image Upload State
    const [selectedImage, setSelectedImage] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [timerEnabled, setTimerEnabled] = useState(false);
    const [timerMinutes, setTimerMinutes] = useState(1);
    const [timerSeconds, setTimerSeconds] = useState(0);

    // ✨ Word Cloud Config
    const [cloudTopic, setCloudTopic] = useState('');

    // ✨ Event-level Scoring Config (applies to all event types)
    const [eventScoreEnabled, setEventScoreEnabled] = useState(false);
    const [eventScorePoints, setEventScorePoints] = useState(5);

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setIsUploading(true);
        const formData = new FormData();
        formData.append('image', file);

        try {
            const token = localStorage.getItem('authToken') || currentUser?.token;
            const res = await axios.post(`${API_BASE_URL}/api/upload`, formData, {
                headers: token ? { 'x-auth-token': token } : {}
            });
            setSelectedImage(res.data.url);
        } catch (err) {
            console.error('Upload failed:', err);
            setConfigError(t('classroomEvent.errorUploadImage') || 'Failed to upload image.');
        } finally {
            setIsUploading(false);
            // Reset file input value?
            e.target.value = null;
        }
    };

    const getPreviewImageSrc = () => {
        if (!selectedImage) return null;
        return buildServerUrl(selectedImage);
    };

    const handleTimerToggle = (enabled) => {
        setTimerEnabled(enabled);
        if (enabled && timerMinutes === 0 && timerSeconds === 0) {
            setTimerMinutes(1);
            setTimerSeconds(0);
        }
    };

    const updateTimerMinutes = (value) => {
        const nextValue = Math.max(0, parseInt(value, 10) || 0);
        setTimerMinutes(nextValue);
    };

    const updateTimerSeconds = (value) => {
        const nextValue = Math.min(59, Math.max(0, parseInt(value, 10) || 0));
        setTimerSeconds(nextValue);
    };

    const buildTimerConfig = (startImmediately = false) => {
        if (!EVENT_TYPES_WITH_TIMER.includes(selectedConfigType)) {
            return null;
        }

        if (!timerEnabled) {
            return {
                enabled: false,
                durationSeconds: 0,
                startedAt: null,
                endsAt: null
            };
        }

        const durationSeconds = (timerMinutes * 60) + timerSeconds;
        if (durationSeconds <= 0) {
            return null;
        }

        const startedAt = startImmediately ? Date.now() : null;
        return {
            enabled: true,
            durationSeconds,
            startedAt,
            endsAt: startedAt ? startedAt + (durationSeconds * 1000) : null
        };
    };

    const renderTimerConfigurator = () => {
        if (!EVENT_TYPES_WITH_TIMER.includes(selectedConfigType)) return null;

        const durationPreviewSeconds = (timerMinutes * 60) + timerSeconds;

        return (
            <div className="cfg-group cfg-timer-section">
                <div className="cfg-timer-header">
                    <div className="cfg-timer-copy">
                        <div className="cfg-timer-title-row">
                            <label className="cfg-label cfg-timer-heading">
                                <FaClock />
                                <span>{tr('classroomEvent.configAnswerTimer', 'Answer Timer')}</span>
                            </label>
                            <span className={`cfg-timer-status ${timerEnabled ? 'enabled' : 'disabled'}`}>
                                {timerEnabled ? tr('classroomEvent.timerEnabled', 'Enabled') : tr('classroomEvent.timerOff', 'Off')}
                            </span>
                        </div>
                        <p className="cfg-helper cfg-timer-help">
                            {tr('classroomEvent.configAnswerTimerHelp', 'Countdown starts immediately when the event is created or when a draft is posted.')}
                        </p>
                    </div>
                    <label className="cfg-toggle cfg-timer-toggle">
                        <input type="checkbox" checked={timerEnabled} onChange={(e) => handleTimerToggle(e.target.checked)} />
                        <span>{tr('classroomEvent.timerToggleLabel', 'Use timer')}</span>
                    </label>
                </div>

                {timerEnabled && (
                    <div className="cfg-timer-card">
                        <div className="cfg-timer-grid">
                            <div className="cfg-timer-box">
                                <span className="cfg-timer-label">{tr('classroomEvent.timerMinutes', 'Minutes')}</span>
                                <div className="cfg-timer-controls">
                                    <button type="button" className="cfg-num-btn" onClick={() => updateTimerMinutes(timerMinutes - 1)}>-</button>
                                    <input
                                        type="number"
                                        min="0"
                                        className="cfg-timer-input"
                                        value={timerMinutes}
                                        onChange={(e) => updateTimerMinutes(e.target.value)}
                                    />
                                    <button type="button" className="cfg-num-btn" onClick={() => updateTimerMinutes(timerMinutes + 1)}>+</button>
                                </div>
                            </div>
                            <div className="cfg-timer-box">
                                <span className="cfg-timer-label">{tr('classroomEvent.timerSeconds', 'Seconds')}</span>
                                <div className="cfg-timer-controls">
                                    <button type="button" className="cfg-num-btn" onClick={() => updateTimerSeconds(timerSeconds - 5)}>-</button>
                                    <input
                                        type="number"
                                        min="0"
                                        max="59"
                                        className="cfg-timer-input"
                                        value={timerSeconds}
                                        onChange={(e) => updateTimerSeconds(e.target.value)}
                                    />
                                    <button type="button" className="cfg-num-btn" onClick={() => updateTimerSeconds(timerSeconds + 5)}>+</button>
                                </div>
                            </div>
                        </div>
                        <div className="cfg-timer-preview">
                            <span>{tr('classroomEvent.timerPreview', 'Countdown preview')}</span>
                            <strong>{formatTimerClock(durationPreviewSeconds * 1000)}</strong>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // ✨ Column count (screen-based only — zoom wrapper handles visual scaling)
    const [numCols, setNumCols] = useState(3);
    useEffect(() => {
        const handleResize = () => {
            const width = window.innerWidth;
            if (width <= 768) setNumCols(1);
            else if (width <= 1200) setNumCols(2);
            else setNumCols(3);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const getEventSortTimestamp = (event) => {
        const createdAt = Number(event?.createdAt);
        if (Number.isFinite(createdAt) && createdAt > 0) {
            return createdAt;
        }

        const updatedAt = Number(event?.updatedAt);
        if (Number.isFinite(updatedAt) && updatedAt > 0) {
            return updatedAt;
        }

        const eventId = String(event?.id || '');
        const timestampMatch = eventId.match(/(\d{10,})$/);
        if (timestampMatch) {
            return Number(timestampMatch[1]);
        }

        return 0;
    };

    const getEventStatusPriority = (event) => {
        switch (event?.status) {
            case 'draft':
                return 0;
            case 'active':
                return 1;
            case 'ended':
                return 3;
            case 'idle':
            default:
                return 2;
        }
    };

    const orderedEvents = [...events].sort((a, b) => {
        const priorityDiff = getEventStatusPriority(a) - getEventStatusPriority(b);
        if (priorityDiff !== 0) {
            return priorityDiff;
        }

        return getEventSortTimestamp(b) - getEventSortTimestamp(a);
    });

    // ✨ Prepare data for grid
    const allItems = [];
    if (isCreator) {
        allItems.push({ type: 'add-card', id: 'add-event-btn' });
    }
    orderedEvents.forEach(e => allItems.push({ type: 'event', ...e }));

    const distributedColumns = Array.from({ length: numCols }, () => []);
    allItems.forEach((item, index) => {
        distributedColumns[index % numCols].push(item);
    });

    const handleAddEventClick = () => {
        setIsAddEventModalOpen(true);
    };

    const handleSelectEvent = (config) => {
        setIsAddEventModalOpen(false);
        onAddEvent(config);
    };

    const openConfigModal = (type) => {
        setSelectedConfigType(type);
        setStudentCountInput(1);
        setQuestionTextInput('');
        setPollOptions(['', '']);
        // Reset Scoring State
        setIsScored(false);
        setOptionScores([{ points: 10, action: 'add' }, { points: 10, action: 'add' }]);
        setConfigError('');
        setSelectedImage(null); // ✨ Reset Image
        setCloudTopic(''); // ✨ Reset Word Cloud Topic
        setEventScoreEnabled(false); // ✨ Reset Event Scoring
        setEventScorePoints(5);
        setTimerEnabled(false);
        setTimerMinutes(1);
        setTimerSeconds(0);
        setIsConfigModalOpen(true);
        setIsAddEventModalOpen(false);
    };

    const handleConfigSubmit = (isDraft = false) => {
        const timerConfig = EVENT_TYPES_WITH_TIMER.includes(selectedConfigType)
            ? buildTimerConfig(!isDraft)
            : null;

        if (EVENT_TYPES_WITH_TIMER.includes(selectedConfigType) && timerEnabled && !timerConfig) {
            setConfigError(tr('classroomEvent.errorInvalidTimer', 'Please set a timer greater than 0 seconds.'));
            return;
        }

        if (selectedConfigType === 'random') {
            const count = parseInt(studentCountInput);
            const max = candidates.length > 0 ? candidates.length : 1;

            if (isNaN(count) || count < 1) {
                setConfigError(t('classroomEvent.errorInvalidNumber') || 'Please enter a valid number (minimum 1).');
                return;
            }
            if (count > max) {
                setConfigError(t('classroomEvent.errorMaxStudents', { max }) || `Cannot select more than ${max} student(s).`);
                return;
            }

            handleSelectEvent({ type: 'random', count: count, status: isDraft ? 'draft' : 'idle', scoring: eventScoreEnabled ? { enabled: true, points: eventScorePoints } : undefined });
            setIsConfigModalOpen(false);
        } else if (selectedConfigType === 'question') {
            if (!questionTextInput.trim()) {
                setConfigError(t('classroomEvent.errorEmptyQuestion') || 'Please enter a question.');
                return;
            }

            handleSelectEvent({
                type: 'question',
                questionText: questionTextInput,
                imageUrl: selectedImage,
                timer: timerConfig,
                status: isDraft ? 'draft' : 'idle',
                scoring: eventScoreEnabled ? { enabled: true, points: eventScorePoints } : undefined
            });
            setIsConfigModalOpen(false);
        } else if (selectedConfigType === 'poll') {
            const validOptions = pollOptions.filter(opt => opt.trim() !== '');
            if (!questionTextInput.trim()) {
                setConfigError(t('classroomEvent.errorEmptyQuestion') || 'Please enter a question.');
                return;
            }
            if (validOptions.length < 2) {
                setConfigError(t('classroomEvent.errorMinOptions') || 'Please provide at least 2 options.');
                return;
            }
            // ✨ Prevent duplicate option text
            const uniqueOptions = new Set(validOptions.map(o => o.trim().toLowerCase()));
            if (uniqueOptions.size !== validOptions.length) {
                setConfigError(t('classroomEvent.errorDuplicateOptions') || 'Each option must have unique text. Please remove duplicates.');
                return;
            }

            // If scored, we don't strictly require "correct options" anymore since points define value,
            // BUT maybe user wants to mark "correct" for visual feedback? 
            // The user request emphasizes "points per option". Let's assume points > 0 implies value.
            // Or maybe just use points.
            
            // Construct options with points
            // We need to map valid options to their scores.
            // Since we filter out empty options, we need to be careful with indices.
            // Let's filter both arrays together.
            
            const validOptionsWithScores = pollOptions
                .map((text, idx) => ({ text, ...optionScores[idx] }))
                .filter(opt => opt.text.trim() !== '');

            if (validOptionsWithScores.length < 2) {
                setConfigError(t('classroomEvent.errorMinOptions') || 'Please provide at least 2 options.');
                return;
            }

            handleSelectEvent({
                type: 'poll',
                questionText: questionTextInput,
                status: isDraft ? 'draft' : 'idle',
                imageUrl: selectedImage,
                timer: timerConfig,
                // For polls, scoring is driven by per-option scores only
                scoring: isScored ? { enabled: true, points: 0 } : undefined,
                options: validOptionsWithScores.map(o => o.text),
                scoreConfig: isScored ? {
                    optionScores: validOptionsWithScores.reduce((acc, curr) => {
                        acc[curr.text] = { 
                            points: parseInt(curr.points) || 0, 
                            action: curr.action 
                        };
                        return acc;
                    }, {})
                } : null
            });
            setIsConfigModalOpen(false);
        } else if (selectedConfigType === 'wordcloud') {
            if (!cloudTopic.trim()) {
                setConfigError(t('classroomEvent.errorEmptyQuestion') || 'Please enter a topic.');
                return;
            }
            handleSelectEvent({
                scoring: eventScoreEnabled ? { enabled: true, points: eventScorePoints } : undefined,
                type: 'wordcloud',
                status: isDraft ? 'draft' : 'idle',
                config: { topic: cloudTopic, scoring: eventScoreEnabled ? { enabled: true, points: eventScorePoints } : undefined }
            });
            setIsConfigModalOpen(false);
        } else if (selectedConfigType === 'buzz') {
            handleSelectEvent({ type: 'buzz', status: isDraft ? 'draft' : 'idle', scoring: eventScoreEnabled ? { enabled: true, points: eventScorePoints } : undefined });
            setIsConfigModalOpen(false);
        }
    };

    const handleAddOption = () => {
        setPollOptions([...pollOptions, '']);
        setOptionScores([...optionScores, { points: 10, action: 'add' }]);
    };

    const handleRemoveOption = (index) => {
        if (pollOptions.length > 2) {
            const newOptions = [...pollOptions];
            newOptions.splice(index, 1);
            setPollOptions(newOptions);
            
            const newScores = [...optionScores];
            newScores.splice(index, 1);
            setOptionScores(newScores);
        }
    };

    const handleOptionChange = (index, value) => {
        const newOptions = [...pollOptions];
        newOptions[index] = value;
        setPollOptions(newOptions);
    };

    const handleScoreChange = (index, field, value) => {
        const newScores = [...optionScores];
        newScores[index] = { ...newScores[index], [field]: value };
        setOptionScores(newScores);
    };

    const getEventIcon = (type) => {
        const style = { color: '#0aa158', fontSize: '1.2em', verticalAlign: 'middle', marginRight: '8px' };
        switch (type) {
            case 'random': return <FaDice style={style} />;
            case 'question': return <FaQuestionCircle style={style} />;
            case 'buzz': return <FaBullhorn style={style} />;
            case 'wordcloud': return <FaCloud style={style} />;
            case 'poll': return <FaPoll style={style} />;
            case 'grouping': return <FaUsers style={style} />;
            default: return <FaClipboardList style={style} />;
        }
    };

    const isEmptyState = events.length === 0;
    const emptyStateDescription = isCreator
        ? tr(
            'classroomEvent.noEventsTeacherDesc',
            'Start the room with a quick poll, question, or random picker to make this space feel active right away.'
        )
        : tr(
            'classroomEvent.noEventsStudentDesc',
            'Your teacher has not launched a classroom activity yet. Polls, questions, and live interactions will appear here when they begin.'
        );
    const emptyStateHint = isCreator
        ? tr(
            'classroomEvent.noEventsTeacherHint',
            'A short icebreaker is often enough to get the class moving.'
        )
        : tr(
            'classroomEvent.noEventsStudentHint',
            'Stay tuned. This panel updates automatically when a new activity starts.'
        );

    return (
        <div className={`classroom-event-container ${isEmptyState ? 'classroom-event-container--empty' : ''}`}>
            {isEmptyState ? (
                <div className="empty-event-state">
                    <div className="empty-event-shell">
                        <div className="empty-event-copy">
                            <h3 className="empty-event-title">
                                <span className="empty-event-title-full">
                                    {t('classroomEvent.noEventsTitle') || 'No events yet'}
                                </span>
                                <span className="empty-event-title-short">
                                    {tr('classroomEvent.noEventsTitleCompact', 'No events')}
                                </span>
                            </h3>
                            <p className="empty-event-lead">{emptyStateDescription}</p>
                            <p className="empty-event-note">{emptyStateHint}</p>
                            <div className="empty-event-actions">
                                {isCreator ? (
                                    <button type="button" className="empty-event-primary" onClick={handleAddEventClick}>
                                        <FaPlus />
                                        <span>{t('classroomEvent.addEvent') || 'Add Event'}</span>
                                    </button>
                                ) : (
                                    <div className="empty-event-status">
                                        <FaStar />
                                        <span>{tr('classroomEvent.noEventsStudentStatus', 'Waiting for the next classroom activity')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="empty-event-visual" aria-hidden="true">
                            <span className="empty-event-glow empty-event-glow--one" />
                            <span className="empty-event-glow empty-event-glow--two" />
                            <div className="empty-event-visual-frame">
                                <Lottie
                                    animationData={themedClassroomEventEmptyAnimation}
                                    loop={true}
                                    autoplay={true}
                                    className="empty-event-lottie"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="event-masonry-grid" style={{ 
                    columnWidth: `${Math.round(350 * zoomScale)}px`,
                    columnGap: '16px',
                    width: '100%',
                }}>
                    {allItems.map((item) => {
                        if (item.type === 'add-card') {
                            return (
                                <div key="add-event" style={{ 
                                    display: 'inline-block',
                                    width: '100%',
                                    breakInside: 'avoid',
                                    WebkitColumnBreakInside: 'avoid',
                                    marginBottom: '24px',
                                    overflow: 'hidden',
                                }}>
                                    <div className="add-event-card" onClick={handleAddEventClick} style={{ 
                                        width: '100%',
                                        zoom: zoomScale,
                                    }}>
                                        <div className="add-event-card-icon">
                                            <FaPlus />
                                        </div>
                                        <span>{t('classroomEvent.addEvent') || 'Add Event'}</span>
                                    </div>
                                </div>
                            );
                        }
                        const event = item;

                        // ✨ Hide draft events from non-creators
                        if (event.status === 'draft' && !isCreator) {
                            return null;
                        }

                        const isDraft = event.status === 'draft';

                        return (
                            <div key={event.id} style={{ 
                                display: 'inline-block',
                                width: '100%',
                                breakInside: 'avoid',
                                WebkitColumnBreakInside: 'avoid',
                                marginBottom: '24px',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                <div className={`event-card ${isDraft ? 'draft-card-wrapper' : ''}`} style={{ 
                                    width: '100%',
                                    zoom: zoomScale,
                                    marginBottom: 0,
                                }}>
                                    {!['random', 'wordcloud', 'question', 'poll', 'buzz', 'grouping'].includes(event.type) && (
                                        <div className="event-card-header">
                                            <h3>{getEventIcon(event.type)} {event.title}</h3>
                                            {isCreator && onDeleteEvent && (
                                                <button
                                                    className="delete-event-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onDeleteEvent(event);
                                                    }}
                                                    title="Delete Event"
                                                >
                                                    <FaTrash />
                                                </button>
                                            )}
                                        </div>
                                    )}
                                    <div className="event-card-body">
                                        <EventCardContent
                                            event={event}
                                            isCreator={isCreator}
                                            onTrigger={onTriggerEvent}
                                            onSubmitAnswer={onSubmitAnswer}
                                            onEndEvent={onEndEvent}
                                            currentUser={currentUser}
                                            candidates={candidates}
                                            onDeleteEvent={onDeleteEvent}
                                        />
                                    </div>
                                    
                                    {/* ✨ Draft Overlay for Creator */}
                                    {isDraft && isCreator && (
                                        <div className="draft-overlay">
                                            <div className="draft-badge">{t('classroomEvent.draftBadge') || 'Draft'}</div>
                                            <button className="draft-post-btn" onClick={() => onPublishDraftEvent && onPublishDraftEvent(event)}>
                                                {t('classroomEvent.postEvent') || 'Post Event'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Event Type Selection Modal */}
            {isAddEventModalOpen && ReactDOM.createPortal(
                <div className="modal-overlay-new" onClick={() => setIsAddEventModalOpen(false)}>
                    <div className="modal-card-new" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-new" style={{ background: 'linear-gradient(to right, #10b981, #059669)' }}>
                            <h3><FaMagic style={{ marginRight: '8px' }} /> {t('classroomEvent.createNewEvent') || 'Create New Event'}</h3>
                            <p>{t('classroomEvent.chooseActivityDesc') || 'Choose an activity for your classroom'}</p>
                            <button className="modal-close-x" onClick={() => setIsAddEventModalOpen(false)}><FaTimes /></button>
                        </div>
                        <div className="modal-body-new">
                            <div className="event-type-grid">
                                <div className="event-type-card" onClick={() => openConfigModal('random')} style={{ '--card-accent': '#10b981' }}>
                                    <div className="etc-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}><FaDice /></div>
                                    <div className="etc-info">
                                        <span className="etc-name">{t('classroomEvent.typeRandomTitle') || 'Random Student'}</span>
                                        <span className="etc-desc">{t('classroomEvent.typeRandomDesc') || 'Randomly select students'}</span>
                                    </div>
                                    <FaChevronRight className="etc-arrow" />
                                </div>
                                <div className="event-type-card" onClick={() => openConfigModal('question')} style={{ '--card-accent': '#3b82f6' }}>
                                    <div className="etc-icon" style={{ background: 'linear-gradient(135deg, #3b82f6, #2563eb)' }}><FaQuestionCircle /></div>
                                    <div className="etc-info">
                                        <span className="etc-name">{t('classroomEvent.typeQuestionTitle') || 'Ask Question'}</span>
                                        <span className="etc-desc">{t('classroomEvent.typeQuestionDesc') || 'Get open-ended answers'}</span>
                                    </div>
                                    <FaChevronRight className="etc-arrow" />
                                </div>
                                <div className="event-type-card" onClick={() => openConfigModal('poll')} style={{ '--card-accent': '#f59e0b' }}>
                                    <div className="etc-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}><FaPoll /></div>
                                    <div className="etc-info">
                                        <span className="etc-name">{t('classroomEvent.typePollTitle') || 'Multiple Choice'}</span>
                                        <span className="etc-desc">{t('classroomEvent.typePollDesc') || 'Create a poll with options'}</span>
                                    </div>
                                    <FaChevronRight className="etc-arrow" />
                                </div>
                                <div className="event-type-card" onClick={() => openConfigModal('wordcloud')} style={{ '--card-accent': '#10b981' }}>
                                    <div className="etc-icon" style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}><FaCloud /></div>
                                    <div className="etc-info">
                                        <span className="etc-name">{t('classroomEvent.typeWordCloudTitle') || 'Word Cloud'}</span>
                                        <span className="etc-desc">{t('classroomEvent.typeWordCloudDesc') || 'Collect words visually'}</span>
                                    </div>
                                    <FaChevronRight className="etc-arrow" />
                                </div>
                                <div className="event-type-card" onClick={() => openConfigModal('buzz')} style={{ '--card-accent': '#ef4444' }}>
                                    <div className="etc-icon" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}><FaBullhorn /></div>
                                    <div className="etc-info">
                                        <span className="etc-name">{t('classroomEvent.typeBuzzTitle') || 'Buzz Button'}</span>
                                        <span className="etc-desc">{t('classroomEvent.typeBuzzDesc') || 'First to buzz wins!'}</span>
                                    </div>
                                    <FaChevronRight className="etc-arrow" />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Configuration Modal */}
            {isConfigModalOpen && ReactDOM.createPortal(
                <div className="modal-overlay-new" onClick={() => setIsConfigModalOpen(false)}>
                    <div className="modal-card-new config-modal-new" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-new" style={{
                            background: selectedConfigType === 'random' ? 'linear-gradient(to right, #10b981, #059669)'
                                : selectedConfigType === 'question' ? 'linear-gradient(to right, #3b82f6, #2563eb)'
                                : selectedConfigType === 'poll' ? 'linear-gradient(to right, #f59e0b, #d97706)'
                                : selectedConfigType === 'buzz' ? 'linear-gradient(to right, #ef4444, #dc2626)'
                                : 'linear-gradient(to right, #10b981, #059669)'
                        }}>
                            <h3>
                                {selectedConfigType === 'random' && <><FaDice style={{ marginRight: '10px' }} /> {t('classroomEvent.configRandomTitle') || 'Random Students'}</>}
                                {selectedConfigType === 'question' && <><FaQuestionCircle style={{ marginRight: '10px' }} /> {t('classroomEvent.configQuestionTitle') || 'Ask Question'}</>}
                                {selectedConfigType === 'poll' && <><FaPoll style={{ marginRight: '10px' }} /> {t('classroomEvent.configPollTitle') || 'Multiple Choice'}</>}
                                {selectedConfigType === 'wordcloud' && <><FaCloud style={{ marginRight: '10px' }} /> {t('classroomEvent.configWordCloudTitle') || 'Word Cloud'}</>}
                                {selectedConfigType === 'buzz' && <><FaBullhorn style={{ marginRight: '10px' }} /> {t('classroomEvent.configBuzzTitle') || 'Buzz Button'}</>}
                            </h3>
                            <p>{t('classroomEvent.configDesc') || 'Configure your event settings'}</p>
                            <button className="modal-close-x" onClick={() => setIsConfigModalOpen(false)}><FaTimes /></button>
                        </div>

                        <div className="modal-body-new">
                            {selectedConfigType === 'random' && (
                                <div className="cfg-group">
                                    <label className="cfg-label">{t('classroomEvent.configNumStudents') || 'Number of students to select'}</label>
                                    <div className="cfg-number-wrapper">
                                        <button className="cfg-num-btn" onClick={() => setStudentCountInput(prev => Math.max(1, prev - 1))}>−</button>
                                        <input
                                            type="number"
                                            className="cfg-num-input"
                                            value={studentCountInput}
                                            onChange={(e) => setStudentCountInput(parseInt(e.target.value) || '')}
                                            min="1"
                                            max={candidates.length}
                                        />
                                        <button className="cfg-num-btn" onClick={() => setStudentCountInput(prev => Math.min(candidates.length, prev + 1))}>+</button>
                                    </div>
                                    <p className="cfg-helper">{t('classroomEvent.configMaxAvailable', { max: candidates.length }) || `Max available: ${candidates.length}`}</p>
                                </div>
                            )}

                            {selectedConfigType === 'question' && (
                                <>
                                    <div className="cfg-group">
                                        <label className="cfg-label">{t('classroomEvent.configYourQuestion') || 'Your Question'}</label>
                                        <textarea
                                            className="cfg-textarea"
                                            value={questionTextInput}
                                            onChange={(e) => setQuestionTextInput(e.target.value)}
                                            placeholder={t('classroomEvent.configQuestionPlaceholder') || 'Type your question here...'}
                                            rows="3"
                                        />
                                    </div>
                                    <div className="cfg-group">
                                        <label className="cfg-label">{t('classroomEvent.configAttachment') || 'Attachment (Optional)'}</label>
                                        <div className="cfg-upload-area">
                                            <input type="file" accept="image/*" onChange={handleImageUpload} id="question-image-upload" style={{ display: 'none' }} />
                                            <label htmlFor="question-image-upload" className="cfg-upload-btn">
                                                {isUploading ? (t('classroomEvent.uploading') || 'Uploading...') : <><FaImage style={{ marginRight: '6px' }} /> {t('classroomEvent.addImage') || 'Add Image'}</>}
                                            </label>
                                            {selectedImage && (
                                                <div className="cfg-image-preview">
                                                    <img referrerPolicy="no-referrer" src={getPreviewImageSrc()} alt="Preview" />
                                                    <button className="cfg-remove-img" onClick={() => setSelectedImage(null)}><FaTimes /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {renderTimerConfigurator()}
                                </>
                            )}

                            {selectedConfigType === 'wordcloud' && (
                                <div className="cfg-group">
                                    <label className="cfg-label">{t('classroomEvent.configTopic') || 'Topic / Question'}</label>
                                    <input
                                        type="text"
                                        className="cfg-input"
                                        value={cloudTopic}
                                        onChange={(e) => setCloudTopic(e.target.value)}
                                        placeholder={t('classroomEvent.configTopicPlaceholder') || 'e.g. Describe your feeling in one word...'}
                                    />
                                </div>
                            )}

                            {selectedConfigType === 'poll' && (
                                <>
                                    <div className="cfg-group">
                                        <label className="cfg-label">{t('classroomEvent.configQuestion') || 'Question'}</label>
                                        <textarea
                                            className="cfg-textarea"
                                            value={questionTextInput}
                                            onChange={(e) => setQuestionTextInput(e.target.value)}
                                            placeholder={t('classroomEvent.configPollPlaceholder') || 'e.g., Which topic should we review?'}
                                            rows="2"
                                        />
                                    </div>
                                    <div className="cfg-group">
                                        <label className="cfg-label">{t('classroomEvent.configAttachment') || 'Attachment (Optional)'}</label>
                                        <div className="cfg-upload-area">
                                            <input type="file" accept="image/*" onChange={handleImageUpload} id="poll-image-upload" style={{ display: 'none' }} />
                                            <label htmlFor="poll-image-upload" className="cfg-upload-btn">
                                                {isUploading ? (t('classroomEvent.uploading') || 'Uploading...') : <><FaImage style={{ marginRight: '6px' }} /> {t('classroomEvent.addImage') || 'Add Image'}</>}
                                            </label>
                                            {selectedImage && (
                                                <div className="cfg-image-preview">
                                                    <img referrerPolicy="no-referrer" src={getPreviewImageSrc()} alt="Preview" />
                                                    <button className="cfg-remove-img" onClick={() => setSelectedImage(null)}><FaTimes /></button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className="cfg-group">
                                        <label className="cfg-label">{t('classroomEvent.configOptions') || 'Options'}</label>
                                        <div className="cfg-options-list">
                                            {pollOptions.map((opt, idx) => (
                                                <div key={idx} className="cfg-option-row">
                                                    <span className="cfg-opt-num">{idx + 1}</span>
                                                    <input
                                                        type="text"
                                                        className="cfg-opt-input"
                                                        value={opt}
                                                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                                                        placeholder={t('classroomEvent.configOptionPlaceholder', { num: idx + 1 }) || `Option ${idx + 1}`}
                                                    />
                                                    {isScored && (
                                                        <div className="cfg-score-mini">
                                                            <input
                                                                type="number"
                                                                className="cfg-score-pts"
                                                                value={optionScores[idx]?.points || 0}
                                                                onChange={(e) => handleScoreChange(idx, 'points', e.target.value)}
                                                                placeholder={t('classroomEvent.configPts') || 'Pts'}
                                                                min="0"
                                                            />
                                                            <select
                                                                className={`cfg-score-action ${optionScores[idx]?.action === 'subtract' ? 'action-sub' : 'action-add'}`}
                                                                value={optionScores[idx]?.action || 'add'}
                                                                onChange={(e) => handleScoreChange(idx, 'action', e.target.value)}
                                                            >
                                                                <option value="add">+</option>
                                                                <option value="subtract">−</option>
                                                            </select>
                                                        </div>
                                                    )}
                                                    {pollOptions.length > 2 && (
                                                        <button className="cfg-opt-remove" onClick={() => handleRemoveOption(idx)}>✕</button>
                                                    )}
                                                </div>
                                            ))}
                                            <button className="cfg-add-opt" onClick={handleAddOption}>{t('classroomEvent.addOption') || '+ Add Option'}</button>
                                        </div>
                                    </div>
                                    <div className="cfg-group">
                                        <label className="cfg-toggle">
                                            <input type="checkbox" checked={isScored} onChange={(e) => setIsScored(e.target.checked)} />
                                            <span>{t('classroomEvent.enableScoringPerOption') || 'Enable Scoring (Per Option)'}</span>
                                        </label>
                                    </div>
                                    {renderTimerConfigurator()}
                                </>
                            )}

                            {/* ✨ Event Scoring Section (hide for polls — polls use per-option scoring) */}
                            {selectedConfigType !== 'poll' && (
                            <div className="cfg-group cfg-scoring-section">
                                <label className="cfg-toggle">
                                    <input type="checkbox" checked={eventScoreEnabled} onChange={(e) => setEventScoreEnabled(e.target.checked)} />
                                    <span><FaStar style={{ color: '#f59e0b', marginRight: '4px' }} /> {t('classroomEvent.enableEventScoring') || 'Enable Event Scoring'}</span>
                                </label>
                                {eventScoreEnabled && (
                                    <div className="cfg-score-config" style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', background: '#fffbeb', borderRadius: '10px', border: '1px solid #fde68a' }}>
                                        <span style={{ fontWeight: 600, color: '#92400e', fontSize: '0.9rem' }}>{t('classroomEvent.pointsPerParticipant') || 'Points per participant:'}</span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <button className="cfg-num-btn" onClick={() => setEventScorePoints(prev => Math.max(1, prev - 1))}>−</button>
                                            <input
                                                type="number"
                                                className="cfg-num-input"
                                                value={eventScorePoints}
                                                onChange={(e) => setEventScorePoints(Math.max(1, parseInt(e.target.value) || 1))}
                                                min="1"
                                                style={{ width: '60px' }}
                                            />
                                            <button className="cfg-num-btn" onClick={() => setEventScorePoints(prev => prev + 1)}>+</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                            )}

                            {configError && <p className="cfg-error">{configError}</p>}
                        </div>

                        <div className="modal-footer-new">
                            <button className="cfg-cancel-btn" onClick={() => setIsConfigModalOpen(false)}>{t('classroomEvent.btnBack') || 'Back'}</button>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <button className="cfg-draft-btn" onClick={() => handleConfigSubmit(true)} style={{
                                    backgroundColor: '#e2e8f0', color: '#475569', padding: '10px 16px', borderRadius: '8px',
                                    border: '1px solid #cbd5e1', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', transition: 'all 0.2s'
                                }} onMouseOver={(e) => { e.currentTarget.style.backgroundColor = '#cbd5e1'; e.currentTarget.style.color = '#334155'; }} onMouseOut={(e) => { e.currentTarget.style.backgroundColor = '#e2e8f0'; e.currentTarget.style.color = '#475569'; }}>
                                    {t('classroomEvent.btnSaveDraft') || 'Save as Draft'}
                                </button>
                                <button className="cfg-create-btn" onClick={() => handleConfigSubmit(false)}>
                                    <FaPlus style={{ marginRight: '6px' }} /> {t('classroomEvent.btnCreateEvent') || 'Create Event'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

/* Helper Component for Event Card Content */
const EventCardContent = ({ event, isCreator, onTrigger, onSubmitAnswer, onEndEvent, candidates = [], currentUser, onDeleteEvent }) => {
    const { t } = useTranslation();
    const { classId: routeClassId } = useParams();
    const tr = (key, defaultValue, options = {}) => t(key, { defaultValue, ...options });
    const resolvedClassId = routeClassId || (typeof window !== 'undefined'
        ? window.location.pathname.match(/\/classroom\/([^/]+)/)?.[1]
        : '');
    const [displayNames, setDisplayNames] = useState([]);
    const [isAnimating, setIsAnimating] = useState(false);
    const [animationPhase, setAnimationPhase] = useState('idle'); // idle | spinning | slowing | reveal
    const [showResults, setShowResults] = useState(false);
    const [answerInput, setAnswerInput] = useState('');
    const [isSubmitted, setIsSubmitted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [selectedAnswer, setSelectedAnswer] = useState(null);
    const [selectedEventImage, setSelectedEventImage] = useState(null);
    const [timerNow, setTimerNow] = useState(Date.now());
    const timerMeta = getEventTimerMeta(event, timerNow);
    const isTimerExpired = Boolean(timerMeta?.isExpired);
    const isEventEnded = event.status === 'ended';
    const isAnswerLocked = isEventEnded || isTimerExpired;
    const timerLabels = {
        remaining: tr('classroomEvent.timerRemaining', 'Time remaining'),
        startsWhenPosted: tr('classroomEvent.timerStartsWhenPosted', 'Starts when posted'),
        expired: tr('classroomEvent.timerExpired', "Time's up"),
        closed: tr('classroomEvent.timerClosed', 'Closed'),
        liveTeacherHelp: tr('classroomEvent.timerLiveTeacherHelp', 'Students can keep answering until the countdown finishes.'),
        liveStudentHelp: tr('classroomEvent.timerLiveStudentHelp', 'Submit your answer before the countdown reaches zero.'),
        expiredTeacherHelp: tr('classroomEvent.timerExpiredTeacherHelp', 'Time is up. Students can no longer answer, but you can still review or end the event.'),
        expiredStudentHelp: tr('classroomEvent.timerExpiredStudentHelp', 'The answer window has closed for this event.'),
        closedHelp: tr('classroomEvent.timerClosedHelp', 'This event has already been closed.'),
        draftHelp: tr('classroomEvent.timerDraftHelp', 'The countdown will begin when this draft is posted.')
    };

    useEffect(() => {
        setTimerNow(Date.now());

        const liveTimer = getEventTimerMeta(event, Date.now());
        if (!liveTimer?.endsAt || liveTimer.isExpired || event.status === 'ended') {
            return undefined;
        }

        const interval = setInterval(() => {
            setTimerNow(Date.now());
        }, 250);

        return () => clearInterval(interval);
    }, [event.type, event.status, event.config?.timer?.enabled, event.config?.timer?.endsAt, event.config?.timer?.durationSeconds]);

    // Check if user has already answered on mount/update
    useEffect(() => {
        if (currentUser && event.results) {
            const hasAnswered = event.results.some(r => r.userId === currentUser.id);
            setIsSubmitted(hasAnswered);
            if (hasAnswered) {
                setIsSubmitting(false);
            } else if (isAnswerLocked) {
                setIsSubmitting(false);
            }
        } else {
            setIsSubmitted(false);
            if (isAnswerLocked) {
                setIsSubmitting(false);
            }
        }
    }, [currentUser, event.results, isAnswerLocked]);

    useEffect(() => {
        if (!selectedEventImage) {
            return undefined;
        }

        const handleEscape = (keyboardEvent) => {
            if (keyboardEvent.key === 'Escape') {
                setSelectedEventImage(null);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [selectedEventImage]);

    const handleAnswerSubmit = () => {
        console.log('Answer submit clicked. Input:', answerInput, 'Event:', event);
        if (isAnswerLocked || isSubmitting) {
            return;
        }

        if (onSubmitAnswer && answerInput.trim()) {
            console.log('Calling onSubmitAnswer prop...');
            onSubmitAnswer(event, answerInput.trim());
            setIsSubmitting(true);
            setAnswerInput('');
        } else {
            console.warn('onSubmitAnswer not defined or input empty');
        }
    };

    const renderStudentEndedState = (accent = { bg: '#eff6ff', border: '#bfdbfe', title: '#1d4ed8', desc: '#1e40af' }) => (
        <div className="ev-submitted-msg ev-timeup-msg" style={{ background: accent.bg, borderColor: accent.border }}>
            <span style={{ color: accent.title }}>{tr('classroomEvent.eventEnded', 'Event Ended')}</span>
            <p style={{ color: accent.desc }}>{tr('classroomEvent.studentEventClosedDesc', 'The teacher has ended this activity. You can no longer participate.')}</p>
        </div>
    );

    const renderEventImagePreview = (src, altText) => {
        if (!src) {
            return null;
        }

        return (
            <button
                type="button"
                className="ev-image-container ev-image-button"
                onClick={() => setSelectedEventImage({ src, altText })}
                title={tr('classroomEvent.openImagePreview', 'Open image preview')}
            >
                <img
                    referrerPolicy="no-referrer"
                    src={src}
                    alt={altText}
                    className="ev-image"
                />
                <span className="ev-image-hint">{tr('classroomEvent.tapImageToZoom', 'Click image to enlarge')}</span>
            </button>
        );
    };

    const renderTeacherEventFooter = () => {
        if (!isCreator || !['poll', 'wordcloud', 'question'].includes(event.type)) {
            return null;
        }

        if (event.config?.scoring?.enabled) {
            if (event.status !== 'ended') {
                return (
                    <div className="ev-end-score-footer">
                        <div className="ev-scoring-info">
                            <div className="ev-scoring-badge">
                                <FaStar style={{ color: '#f59e0b', marginRight: '4px' }} />
                                <span>{t('classroomEvent.scoringEnabled') || 'Scoring Enabled'}</span>
                            </div>
                            <span className="ev-scoring-points">
                                {event.type === 'poll' && event.config?.scoreConfig
                                    ? (t('classroomEvent.perOptionScoring') || 'Per-option scoring')
                                    : (t('classroomEvent.ptsPerParticipant', { points: event.config.scoring.points }) || `+${event.config.scoring.points} pts/participant`)}
                            </span>
                        </div>
                        <button
                            className="ev-end-score-btn"
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onEndEvent) onEndEvent(event);
                            }}
                        >
                            <FaFlagCheckered style={{ marginRight: '6px' }} />
                            {t('classroomEvent.endAndScore') || 'End & Score'}
                        </button>
                    </div>
                );
            }

            return (
                <div className="ev-scored-badge">
                    <FaTrophy style={{ color: '#f59e0b', marginRight: '6px' }} />
                    {event.type === 'poll' && event.config?.scoreConfig
                        ? (t('classroomEvent.scoredPerOptionBadge') || 'Scored - Per-option')
                        : (t('classroomEvent.scoredPtsBadge', { points: event.config.scoring.points }) || `Scored - +${event.config.scoring.points} pts`)}
                </div>
            );
        }

        if (event.status !== 'ended') {
            return (
                <div className="ev-end-score-footer ev-end-score-footer-centered">
                    <button
                        className="ev-end-score-btn ev-end-score-btn-neutral"
                        onClick={(e) => {
                            e.stopPropagation();
                            if (onEndEvent) {
                                onEndEvent({ ...event, config: { ...event.config, scoring: { enabled: false } } });
                            }
                        }}
                    >
                        <FaFlagCheckered style={{ marginRight: '6px' }} />
                        {t('classroomEvent.endEvent') || 'End Event'}
                    </button>
                </div>
            );
        }

        return (
            <div className="ev-scored-badge ev-scored-badge-neutral">
                <FaFlagCheckered style={{ color: '#6b7280', marginRight: '6px' }} />
                {t('classroomEvent.eventEnded') || 'Event Ended'}
            </div>
        );
    };

    const renderQuestionAnswerCard = (ans, idx) => {
        const imgSrc = getProfileImageSrc(ans.photoURL, isGoogleUser(ans));
        const answerName = ans.userName || t('classroomEvent.anonymous') || 'Anonymous';
        return (
            <button
                type="button"
                key={ans.userId || idx}
                className="ev-answer-card ev-answer-card-clickable"
                onClick={() => setSelectedAnswer(ans)}
                title={tr('classroomEvent.answerPopupOpen', 'Open this answer in a popup')}
            >
                <div className="ev-answer-header">
                    <img referrerPolicy="no-referrer"
                        src={imgSrc}
                        alt={answerName}
                        className="ev-answer-avatar"
                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(answerName || 'U') + '&background=random'; }}
                    />
                    <div className="ev-answer-user-info">
                        <span className="ev-answer-username">{answerName}</span>
                        <span className="ev-answer-time">{t('classroomEvent.justNow') || 'Just now'}</span>
                    </div>
                </div>
                <div className="ev-answer-body ev-answer-body-preview">{ans.text}</div>
            </button>
        );
    };

    // Effect to handle result arrival and animation
    useEffect(() => {
        if (event.results && event.results.length > 0) {
            if (event.type === 'random') {
                // Don't animate if event is already ended
                if (event.status === 'ended') {
                    setIsAnimating(false);
                    setAnimationPhase('idle');
                    setShowResults(true);
                    return;
                }
                // Only animate if the update is recent (e.g., within last 10 seconds)
                const isRecent = (Date.now() - new Date(event.updatedAt).getTime()) < 10000;
                if (isRecent) {
                    startAnimation();
                } else {
                    setIsAnimating(false);
                    setAnimationPhase('idle');
                    setShowResults(true);
                }
            } else {
                setIsAnimating(false);
                setShowResults(true);
            }
        }
    }, [event.results, event.updatedAt, event.type, event.status]);

    // ✨ Buzz Button Logic: Countdown & Reset
    const [countdown, setCountdown] = useState(null);

    useEffect(() => {
        if (event.type === 'buzz') {
            if (event.status === 'idle') {
                setIsSubmitted(false);
                setCountdown(null);
            } else if (event.status === 'active') { // Let countdown be 0 even if results exist so late joiners can buzz
                if (event.startTime) {
                    const now = Date.now();
                    // 3 seconds delay from startTime
                    const endTime = event.startTime + 3000;
                    const remaining = Math.ceil((endTime - now) / 1000);

                    if (remaining > 0) {
                        setCountdown(remaining);
                        // Sync countdown
                        const interval = setInterval(() => {
                            const newNow = Date.now();
                            const newRemaining = Math.ceil((endTime - newNow) / 1000);
                            
                            if (newRemaining <= 0) {
                                clearInterval(interval);
                                setCountdown(0);
                            } else {
                                setCountdown(newRemaining);
                            }
                        }, 200); // Check more frequently for smoothness
                        return () => clearInterval(interval);
                    } else {
                        // Already started
                        setCountdown(0);
                    }
                } else {
                    // Fallback if no startTime (shouldn't happen with fix)
                    setCountdown(0);
                }
            }
        }
    }, [event.status, event.type, event.startTime, event.results]); // depend on startTime

    const startAnimation = () => {
        if (candidates.length === 0) {
            setShowResults(true);
            return;
        }

        setIsAnimating(true);
        setShowResults(false);
        setAnimationPhase('spinning');
        const count = event.config?.count || 1;

        // Calculate remaining animation time based on when the event was updated globally
        const animationDuration = event.animationDuration || 3500;
        const timeElapsed = Date.now() - new Date(event.updatedAt).getTime();
        const timeRemaining = Math.max(0, animationDuration - timeElapsed);

        if (timeRemaining <= 0) {
            setIsAnimating(false);
            setAnimationPhase('idle');
            setShowResults(true);
            return;
        }

        // Slot-machine style decelerating animation
        const startTime = Date.now();
        let currentInterval = null;

        const pickRandom = () => {
            const randomPicks = [];
            for (let i = 0; i < count; i++) {
                const randomCandidate = candidates[Math.floor(Math.random() * candidates.length)] || { name: '...' };
                randomPicks.push(randomCandidate);
            }
            setDisplayNames(randomPicks);
        };

        const scheduleNext = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / timeRemaining, 1);

            if (progress >= 1) {
                // Animation done — show reveal
                setAnimationPhase('reveal');
                setTimeout(() => {
                    setIsAnimating(false);
                    setAnimationPhase('idle');
                    setShowResults(true);
                }, 600); // Brief reveal phase
                return;
            }

            // Switch to slowing phase at 60%
            if (progress > 0.6) {
                setAnimationPhase('slowing');
            }

            pickRandom();

            // Decelerate: start at 60ms, end at ~300ms
            const delay = 60 + (progress * progress * 240);
            currentInterval = setTimeout(scheduleNext, delay);
        };

        pickRandom(); // Initial pick
        currentInterval = setTimeout(scheduleNext, 60);
    };

    return (
        <div className="event-card-content">
            {event.type === 'random' && (
                <div className="random-event-content-new">
                    {/* Header */}
                    <div className="random-header-new">
                        <div className="random-header-bg-icon">
                            <FaTrophy size={120} />
                        </div>
                        {isCreator && onDeleteEvent && (
                            <button
                                className="delete-event-btn"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteEvent(event);
                                }}
                                title="Delete Event"
                                style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20, color: 'white', background: 'rgba(0,0,0,0.1)' }}
                            >
                                <FaTrash />
                            </button>
                        )}
                        <h2 className="random-header-title">
                            <FaMagic style={{ color: '#d1fae5' }} /> {t('classroomEvent.typeRandomTitle') || 'Random Student'} <FaMagic style={{ color: '#d1fae5' }} />
                        </h2>
                        <p className="random-header-subtitle">{t('classroomEvent.randomStudentSubtitle', { count: event.config?.count || 1 }) || `Random student x${event.config?.count || 1}`}</p>
                    </div>

                    <div className="random-body-new">
                        {/* Display Area for Spinning/Winner */}
                        <div className={`random-display-area ${isAnimating ? 'spinning' : ''} ${(showResults && event.results?.length > 0) ? 'winner' : ''} ${(!isAnimating && !showResults) ? 'idle' : ''} ${animationPhase}`}>
                            
                            {!isAnimating && !showResults && (
                                <h3 className="random-idle-text">{t('classroomEvent.clickToStart') || 'Click to start!'}</h3>
                            )}

                            {isAnimating && !showResults && (
                                (event.config?.count || 1) === 1 ? (
                                    /* Single random — big avatar only, no name */
                                    <div className={`random-animating-container ${animationPhase}`}>
                                        {displayNames.map((candidate, i) => (
                                            <div key={i} className={`random-animating-item slot-swap ${animationPhase}`}>
                                                {candidate.photoSrc ? (
                                                    <img referrerPolicy="no-referrer" src={candidate.photoSrc} alt="avatar" className={`random-avatar animating ${animationPhase}`} />
                                                ) : (
                                                    <div className={`random-avatar-placeholder animating ${animationPhase}`}>
                                                        <FaUser />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    /* Multi random — circular avatar cluster, no names */
                                    <div className={`random-multi-spin-cluster ${animationPhase}`}>
                                        {displayNames.map((candidate, i) => (
                                            <div key={i} className={`spin-bubble ${animationPhase}`}>
                                                {candidate.photoSrc ? (
                                                    <img referrerPolicy="no-referrer" src={candidate.photoSrc} alt="avatar" className="spin-bubble-img" />
                                                ) : (
                                                    <div className="spin-bubble-placeholder">
                                                        <FaUser />
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}

                            {showResults && event.results && event.results.length > 0 && (
                                <div className="random-winners-container">
                                    <span className="winner-label" style={{color: '#16a34a'}}><FaTrophy size={14} /> {event.results.length > 1 ? (t('classroomEvent.winnersLabel') || 'Winners') : (t('classroomEvent.winnerLabel') || 'Winner')}</span>
                                    <div className="random-winners-cluster">
                                        {event.results.map((r, i) => (
                                            <div key={i} className="random-winner-bubble" title={r.userName || t('classroomEvent.unknown') || 'Unknown'}>
                                                {r.photoSrc ? (
                                                    <img referrerPolicy="no-referrer" src={r.photoSrc} alt={r.userName} className="winner-bubble-img" />
                                                ) : (
                                                    <div className="winner-bubble-placeholder">
                                                        <FaUser />
                                                    </div>
                                                )}
                                                <span className="winner-bubble-tooltip">{r.userName || t('classroomEvent.unknown') || 'Unknown'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Participant Count Display */}
                        <div className="random-participant-count">
                            <div className="rpc-left">
                                <FaUsers />
                                <span>{t('classroomEvent.totalParticipants') || 'Total Participants'}</span>
                            </div>
                            <span className="rpc-right">{t('classroomEvent.studentsCountLabel', { count: candidates.length }) || `${candidates.length} students`}</span>
                        </div>

                        {/* Creator Action Button */}
                        {isCreator && (
                            <button
                                onClick={() => { if(!isAnimating && event.status !== 'ended') onTrigger(event); }}
                                disabled={isAnimating || candidates.length === 0 || event.status === 'ended'}
                                className={`random-action-btn ${isAnimating ? 'spinning' : ''}`}
                            >
                                {isAnimating ? (
                                    <>
                                        <FaDice className="spin-icon" /> {t('classroomEvent.rolling') || 'Rolling...'}
                                    </>
                                ) : (
                                    <>
                                        <FaDice /> {event.status === 'ended' ? (t('classroomEvent.ended') || '✅ Ended') : event.results ? (t('classroomEvent.rollAgain') || 'Roll Again!') : (t('classroomEvent.rollNow') || 'Roll Now!')}
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* ✨ Question Event Content */}
            {event.type === 'question' && (
                <div className="ev-card-new question-card-new">
                    {/* Header */}
                    <div className="ev-header-new" style={{ background: 'linear-gradient(to right, #3b82f6, #2563eb)' }}>
                        <div className="ev-header-bg-icon">
                            <FaQuestionCircle size={120} />
                        </div>
                        {isCreator && onDeleteEvent && (
                            <button
                                className="delete-event-btn"
                                onClick={(e) => { e.stopPropagation(); onDeleteEvent(event); }}
                                title="Delete Event"
                                style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20, color: 'white', background: 'rgba(0,0,0,0.1)' }}
                            >
                                <FaTrash />
                            </button>
                        )}
                        <h2 className="ev-header-title">
                            <FaQuestionCircle style={{ color: '#bfdbfe' }} /> {t('classroomEvent.openQuestion') || 'Open Question'}
                        </h2>
                        <p className="ev-header-subtitle">{t('classroomEvent.typeQuestionSubtitle') || 'Open-ended question'}</p>
                    </div>

                    <div className="ev-body-new">
                        {/* Featured Question Text */}
                        <div className="ev-featured-question">
                            <span className="ev-fq-icon">Q</span>
                            <p className="ev-fq-text">{event.config?.questionText || t('classroomEvent.openQuestion') || 'Open Question'}</p>
                        </div>
                        <EventTimerBanner timerMeta={timerMeta} isCreator={isCreator} eventStatus={event.status} labels={timerLabels} />
                        {/* Image if present */}
                        {renderEventImagePreview(getEventImageSrc(event), tr('classroomEvent.questionImageAlt', 'Question attachment'))}

                        {/* Creator View: Answers */}
                        {isCreator ? (
                            <div className="ev-answers-section">
                                <div className="ev-answers-header">
                                    <div className="ev-answers-header-main">
                                        <span>{t('classroomEvent.answers') || 'Answers'}</span>
                                        <span className="ev-answers-count">{event.results ? event.results.length : 0}</span>
                                    </div>
                                </div>
                                {event.results?.length > 0 && (
                                    <p className="ev-answers-hint">
                                        {tr('classroomEvent.answerPopupHint', 'Click a student answer card to open that answer in a popup.')}
                                    </p>
                                )}
                                <div className="ev-answers-list">
                                    {event.results && event.results.map((ans, idx) => renderQuestionAnswerCard(ans, idx))}
                                    {(!event.results || event.results.length === 0) && (
                                        <div className="ev-empty-state">
                                            <FaQuestionCircle style={{ fontSize: '2rem', opacity: 0.2, marginBottom: '8px' }} />
                                            <p>{t('classroomEvent.waitingForAnswers') || 'Waiting for students to answer...'}</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            /* Student View */
                            <div className="ev-input-section">
                                {!isSubmitted && !isAnswerLocked ? (
                                    <>
                                        {isSubmitting ? (
                                            <div className="ev-submitted-msg" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                                                <span style={{ color: '#1d4ed8' }}>{tr('classroomEvent.submittingAnswer', 'Submitting your answer...')}</span>
                                                <p style={{ color: '#1e40af' }}>{tr('classroomEvent.waitingServerConfirm', 'Waiting for live confirmation from the classroom.')}</p>
                                            </div>
                                        ) : (
                                            <>
                                                <textarea
                                                    className="ev-textarea"
                                                    placeholder={t('classroomEvent.typeYourAnswer') || 'Type your answer...'}
                                                    value={answerInput}
                                                    onChange={(e) => setAnswerInput(e.target.value)}
                                                    rows="3"
                                                />
                                                <button
                                                    className="ev-submit-btn"
                                                    style={{ background: 'linear-gradient(to right, #3b82f6, #2563eb)' }}
                                                    onClick={handleAnswerSubmit}
                                                    disabled={!answerInput.trim() || isSubmitting}
                                                >
                                                    {t('classroomEvent.submitAnswer') || 'Submit Answer'}
                                                </button>
                                            </>
                                        )}
                                    </>
                                ) : isSubmitted ? (
                                    <div className="ev-submitted-msg" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                                        <span style={{ color: '#1d4ed8' }}>{t('classroomEvent.answerSubmitted') || 'Answer Submitted! ✅'}</span>
                                        <p style={{ color: '#1e40af' }}>{t('classroomEvent.waitingForOthers') || 'Waiting for other students...'}</p>
                                    </div>
                                ) : isEventEnded ? (
                                    renderStudentEndedState()
                                ) : (
                                    <div className="ev-submitted-msg ev-timeup-msg" style={{ background: '#eff6ff', borderColor: '#bfdbfe' }}>
                                        <span style={{ color: '#1d4ed8' }}>{tr('classroomEvent.answerTimeUp', 'Answer time is over.')}</span>
                                        <p style={{ color: '#1e40af' }}>{tr('classroomEvent.answerTimeUpDesc', 'You can still read the activity, but new answers are closed.')}</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {renderTeacherEventFooter()}
                    </div>
                </div>
            )}

            {event.type === 'question' && isCreator && selectedAnswer && ReactDOM.createPortal(
                <div className="modal-overlay-new" onClick={() => setSelectedAnswer(null)}>
                    <div className="modal-card-new answer-modal-new" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-new answer-modal-header" style={{ background: 'linear-gradient(to right, #3b82f6, #2563eb)' }}>
                            <h3>
                                <FaClipboardList style={{ marginRight: '8px' }} />
                                {tr('classroomEvent.answerPopupTitle', 'Student Answer')}
                            </h3>
                            <p>{tr('classroomEvent.answerPopupSubtitle', 'Answer from {{name}}', { name: selectedAnswer.userName || tr('classroomEvent.anonymous', 'Anonymous') })}</p>
                            <button className="modal-close-x" onClick={() => setSelectedAnswer(null)}><FaTimes /></button>
                        </div>

                        <div className="modal-body-new answer-modal-body">
                            <div className="answer-modal-question">
                                <span className="answer-modal-question-label">{tr('classroomEvent.openQuestion', 'Open Question')}</span>
                                <p>{event.config?.questionText || tr('classroomEvent.openQuestion', 'Open Question')}</p>
                            </div>

                            <div className="answer-modal-student">
                                <span className="answer-modal-student-label">{tr('classroomEvent.answerPopupStudentLabel', 'Student')}</span>
                                <div className="answer-modal-student-card">
                                    <img
                                        referrerPolicy="no-referrer"
                                        src={getProfileImageSrc(selectedAnswer.photoURL, isGoogleUser(selectedAnswer))}
                                        alt={selectedAnswer.userName || tr('classroomEvent.anonymous', 'Anonymous')}
                                        className="ev-answer-avatar answer-modal-avatar"
                                        onError={(e) => { e.target.onerror = null; e.target.src = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedAnswer.userName || 'U') + '&background=random'; }}
                                    />
                                    <div className="answer-modal-student-copy">
                                        <strong className="answer-modal-student-name">{selectedAnswer.userName || tr('classroomEvent.anonymous', 'Anonymous')}</strong>
                                        <span className="answer-modal-student-meta">{t('classroomEvent.justNow') || 'Just now'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="answer-modal-answer">
                                <span className="answer-modal-answer-label">{tr('classroomEvent.answerPopupAnswerLabel', 'Answer')}</span>
                                <p>{selectedAnswer.text}</p>
                            </div>
                        </div>

                        <div className="modal-footer-new">
                            <button className="cfg-cancel-btn" onClick={() => setSelectedAnswer(null)}>
                                {tr('classroomEvent.answersPopupClose', 'Close')}
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {selectedEventImage && ReactDOM.createPortal(
                <div className="modal-overlay-new" onClick={() => setSelectedEventImage(null)}>
                    <div className="modal-card-new event-image-modal-new" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header-new event-image-modal-header" style={{ background: 'linear-gradient(to right, #f8fbff, #eef6ff)' }}>
                            <h3>
                                <FaImage style={{ marginRight: '8px' }} />
                                {tr('classroomEvent.imagePreviewTitle', 'Image Preview')}
                            </h3>
                            <p>{tr('classroomEvent.imagePreviewSubtitle', 'View the attached image in full size.')}</p>
                            <button className="modal-close-x" onClick={() => setSelectedEventImage(null)}><FaTimes /></button>
                        </div>

                        <div className="event-image-modal-body">
                            <img
                                referrerPolicy="no-referrer"
                                src={selectedEventImage.src}
                                alt={selectedEventImage.altText || tr('classroomEvent.imagePreviewTitle', 'Image Preview')}
                                className="event-image-modal-preview"
                            />
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* ✨ Poll Event Content */}
            {event.type === 'poll' && (
                <div className="ev-card-new poll-card-new">
                    {/* Header */}
                    <div className="ev-header-new" style={{ background: 'linear-gradient(to right, #f59e0b, #d97706)' }}>
                        <div className="ev-header-bg-icon">
                            <FaPoll size={120} />
                        </div>
                        {isCreator && onDeleteEvent && (
                            <button
                                className="delete-event-btn"
                                onClick={(e) => { e.stopPropagation(); onDeleteEvent(event); }}
                                title="Delete Event"
                                style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20, color: 'white', background: 'rgba(0,0,0,0.1)' }}
                            >
                                <FaTrash />
                            </button>
                        )}
                        <h2 className="ev-header-title">
                            <FaPoll style={{ color: '#fef3c7' }} /> {t('classroomEvent.typePollTitle') || 'Poll'}
                        </h2>
                        <p className="ev-header-subtitle">{t('classroomEvent.typePollSubtitle') || 'Vote for your choice'}</p>
                    </div>

                    <div className="ev-body-new">
                        {/* Featured Question Text */}
                        <div className="ev-featured-question">
                            <span className="ev-fq-icon" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>Q</span>
                            <p className="ev-fq-text">{event.config?.questionText || t('classroomEvent.voteNow') || 'Vote now!'}</p>
                        </div>
                        <EventTimerBanner timerMeta={timerMeta} isCreator={isCreator} eventStatus={event.status} labels={timerLabels} />
                        {/* Image if present */}
                        {renderEventImagePreview(getEventImageSrc(event), tr('classroomEvent.pollImageAlt', 'Poll attachment'))}

                        {isCreator ? (
                            /* Creator View: Results */
                            <div className="ev-poll-results">
                                {event.config?.options?.map((opt, idx) => {
                                    const count = event.results?.filter(r => r.text === opt).length || 0;
                                    const total = event.results?.length || 0;
                                    const percentage = total > 0 ? ((count / total) * 100).toFixed(1) : '0.0';

                                    return (
                                        <div key={idx} className="ev-poll-result-item">
                                            <div className="ev-poll-result-label">
                                                <span>{opt}</span>
                                                <span className="ev-poll-result-count">{count} ({percentage}%)</span>
                                            </div>
                                            <div className="ev-poll-bar-bg">
                                                <div
                                                    className="ev-poll-bar-fill"
                                                    style={{ width: `${percentage}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="ev-poll-total">
                                    {t('classroomEvent.totalVotes', { count: event.results?.length || 0 }) || `Total: ${event.results?.length || 0} votes`} {event.results?.length > 0 && <span className="ev-poll-live-badge">{t('classroomEvent.liveBadge') || '● LIVE'}</span>}
                                </div>
                            </div>
                        ) : (
                            /* Student View: Voting */
                            <div className="ev-poll-voting">
                                {!isSubmitted && !isAnswerLocked ? (
                                    isSubmitting ? (
                                        <div className="ev-submitted-msg" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                                            <span style={{ color: '#b45309' }}>{tr('classroomEvent.submittingVote', 'Submitting your vote...')}</span>
                                            <p style={{ color: '#92400e' }}>{tr('classroomEvent.waitingServerConfirm', 'Waiting for live confirmation from the classroom.')}</p>
                                        </div>
                                    ) : (
                                        <div className="ev-poll-options">
                                            {event.config?.options?.map((opt, idx) => (
                                                <button
                                                    key={idx}
                                                    className="ev-poll-vote-btn"
                                                    disabled={isSubmitting}
                                                    onClick={() => {
                                                        if (onSubmitAnswer && !isSubmitting && !isAnswerLocked) {
                                                            onSubmitAnswer(event, opt);
                                                            setIsSubmitting(true);
                                                        }
                                                    }}
                                                >
                                                    {opt}
                                                </button>
                                            ))}
                                        </div>
                                    )
                                ) : isSubmitted ? (
                                    <div className="ev-submitted-msg" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                                        <span style={{ color: '#b45309' }}>{t('classroomEvent.voteSubmitted') || 'Vote Submitted! 📊'}</span>
                                        <p style={{ color: '#92400e' }}>{t('classroomEvent.waitingForResults') || 'Waiting for results...'}</p>
                                    </div>
                                ) : isEventEnded ? (
                                    renderStudentEndedState({ bg: '#fffbeb', border: '#fde68a', title: '#b45309', desc: '#92400e' })
                                ) : (
                                    <div className="ev-submitted-msg ev-timeup-msg" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
                                        <span style={{ color: '#b45309' }}>{tr('classroomEvent.voteTimeUp', 'Voting time is over.')}</span>
                                        <p style={{ color: '#92400e' }}>{tr('classroomEvent.voteTimeUpDesc', 'You can now wait for the teacher to review the results.')}</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {renderTeacherEventFooter()}
                    </div>
                </div>
            )}

            {/* ✨ Grouping Event Content */}
            {event.type === 'grouping' && (
                <div className="ev-card-new grouping-card-new">
                    {/* Header */}
                    <div className="ev-header-new" style={{ background: 'linear-gradient(to right, #10b981, #059669)' }}>
                        <div className="ev-header-bg-icon">
                            <FaUsers size={120} />
                        </div>
                        {isCreator && onDeleteEvent && (
                            <button
                                className="delete-event-btn"
                                onClick={(e) => { e.stopPropagation(); onDeleteEvent(event); }}
                                title="Delete Event"
                                style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20, color: 'white', background: 'rgba(0,0,0,0.1)' }}
                            >
                                <FaTrash />
                            </button>
                        )}
                        <h2 className="ev-header-title">
                            <FaUsers style={{ color: '#d1fae5' }} /> {t('classroomEvent.typeGroupingTitle') || 'Student Groups'}
                        </h2>
                        <p className="ev-header-subtitle">{t('classroomEvent.typeGroupingSubtitle') || 'Choose your group'}</p>
                    </div>

                    <div className="ev-body-new">
                        {isCreator ? (
                            /* Creator View: Group Results with avatars + progress */
                            <div className="grouping-results">
                                {event.config?.groups?.map((group, idx) => {
                                    const members = event.results?.filter(r => r.text === (group.id || group.name)) || [];
                                    const maxMembers = group.maxMembers || 99;
                                    const percentage = Math.min(100, Math.round((members.length / maxMembers) * 100));
                                    const isFull = members.length >= maxMembers;
                                    return (
                                        <div key={idx} className="grouping-result-item">
                                            <div className="grouping-result-header">
                                                <div className="grouping-color-dot" style={{ backgroundColor: group.color }} />
                                                <span className="grouping-result-name">{group.name}</span>
                                                <span className="grouping-result-count">
                                                    {members.length}/{maxMembers}
                                                    {isFull && <span className="grouping-full-badge">{t('classroomEvent.fullBadge') || 'FULL'}</span>}
                                                </span>
                                            </div>
                                            {/* Avatar stack */}
                                            {members.length > 0 && (
                                                <div className="grouping-avatar-stack">
                                                    {members.slice(0, 8).map((m, mIdx) => (
                                                        <img referrerPolicy="no-referrer"
                                                            key={mIdx}
                                                            src={getProfileImageSrc(m.photoURL)}
                                                            alt={m.userName}
                                                            className="grouping-avatar"
                                                            title={m.userName}
                                                            onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(m.userName || '?')}&background=random&size=32`; }}
                                                        />
                                                    ))}
                                                    {members.length > 8 && (
                                                        <span className="grouping-avatar-more">+{members.length - 8}</span>
                                                    )}
                                                </div>
                                            )}
                                            {/* Progress bar */}
                                            <div className="grouping-progress-bar">
                                                <div
                                                    className="grouping-progress-fill"
                                                    style={{
                                                        width: `${percentage}%`,
                                                        backgroundColor: isFull ? '#ef4444' : group.color,
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                                <div className="ev-poll-total">
                                    Total: {event.results?.length || 0} joined {event.results?.length > 0 && <span className="ev-poll-live-badge">● LIVE</span>}
                                </div>
                            </div>
                        ) : (
                            /* Student View: Join Group with avatars + progress */
                            <div className="grouping-voting">
                                {!isSubmitted && !isAnswerLocked ? (
                                    <div className="grouping-options">
                                        {event.config?.groups?.map((group, idx) => {
                                            const members = event.results?.filter(r => r.text === (group.id || group.name)) || [];
                                            const maxMembers = group.maxMembers || 99;
                                            const percentage = Math.min(100, Math.round((members.length / maxMembers) * 100));
                                            const isFull = members.length >= maxMembers;
                                            return (
                                                <button
                                                    key={idx}
                                                    className={`grouping-vote-btn ${isFull ? 'grouping-btn-full' : ''}`}
                                                    style={{
                                                        borderLeft: `4px solid ${group.color}`,
                                                        '--group-color': group.color,
                                                    }}
                                                    disabled={isFull || isAnswerLocked}
                                                    onClick={() => {
                                                        if (onSubmitAnswer && !isFull && !isAnswerLocked) {
                                                            onSubmitAnswer(event, group.id || group.name);
                                                            setIsSubmitted(true);
                                                        }
                                                    }}
                                                >
                                                    <div className="grouping-btn-top">
                                                        <div className="grouping-btn-color" style={{ backgroundColor: group.color }} />
                                                        <span className="grouping-btn-name">{group.name}</span>
                                                        <span className="grouping-btn-count">{members.length}/{maxMembers}</span>
                                                    </div>
                                                    {members.length > 0 && (
                                                        <div className="grouping-avatar-stack" style={{ marginTop: '6px' }}>
                                                            {members.slice(0, 5).map((m, mIdx) => (
                                                                <img referrerPolicy="no-referrer"
                                                                    key={mIdx}
                                                                    src={getProfileImageSrc(m.photoURL)}
                                                                    alt={m.userName}
                                                                    className="grouping-avatar grouping-avatar-sm"
                                                                    onError={(e) => { e.target.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(m.userName || '?')}&background=random&size=28`; }}
                                                                />
                                                            ))}
                                                            {members.length > 5 && (
                                                                <span className="grouping-avatar-more">+{members.length - 5}</span>
                                                            )}
                                                        </div>
                                                    )}
                                                    <div className="grouping-progress-bar" style={{ marginTop: '8px' }}>
                                                        <div
                                                            className="grouping-progress-fill"
                                                            style={{
                                                                width: `${percentage}%`,
                                                                backgroundColor: isFull ? '#ef4444' : group.color,
                                                            }}
                                                        />
                                                    </div>
                                                    {isFull && <span className="grouping-full-text">Group Full</span>}
                                                </button>
                                            );
                                        })}
                                    </div>
                                ) : isSubmitted ? (
                                    <div className="ev-submitted-msg" style={{ background: '#ecfdf5', borderColor: '#a7f3d0' }}>
                                        <span style={{ color: '#065f46' }}>{t('classroomEvent.groupJoined') || 'Group Joined! ✅'}</span>
                                        <p style={{ color: '#047857' }}>{t('classroomEvent.waitingForTeacher') || "You're in the group. Wait for the teacher to proceed."}</p>
                                    </div>
                                ) : (
                                    renderStudentEndedState({ bg: '#ecfdf5', border: '#a7f3d0', title: '#065f46', desc: '#047857' })
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ✨ Buzz Button Content */}
            {event.type === 'buzz' && (
                <div className="ev-card-new buzz-card-new">
                    {/* Header */}
                    <div className="ev-header-new" style={{ background: 'linear-gradient(to right, #ef4444, #dc2626)' }}>
                        <div className="ev-header-bg-icon">
                            <FaBullhorn size={120} />
                        </div>
                        {isCreator && onDeleteEvent && (
                            <button
                                className="delete-event-btn"
                                onClick={(e) => { e.stopPropagation(); onDeleteEvent(event); }}
                                title="Delete Event"
                                style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20, color: 'white', background: 'rgba(0,0,0,0.1)' }}
                            >
                                <FaTrash />
                            </button>
                        )}
                        <h2 className="ev-header-title">
                            <FaBullhorn style={{ color: '#fecaca' }} /> {t('classroomEvent.typeBuzzTitle') || 'Buzz Button'}
                        </h2>
                        <p className="ev-header-subtitle">{t('classroomEvent.typeBuzzSubtitle') || 'First to buzz wins!'}</p>
                    </div>

                    <div className="ev-body-new">
                        {/* Status */}
                        <div className={`ev-buzz-status ${event.status === 'active' && countdown === 0 ? 'go' : ''} ${event.status === 'active' && countdown > 0 ? 'ready' : ''}`}>
                            {isEventEnded
                                ? (t('classroomEvent.eventEnded') || 'Event Ended')
                                : event.status === 'active'
                                    ? (countdown > 0 ? (t('classroomEvent.readyCount', { count: countdown }) || `Ready... ${countdown}`) : (t('classroomEvent.goBuzz') || '🖐️ GO!'))
                                    : (t('classroomEvent.waitingBuzz') || '🔴 Waiting...')}
                        </div>

                        {isCreator ? (
                            <div className="ev-buzz-controls">
                                <div className="ev-buzz-actions">
                                    <button 
                                        className="ev-buzz-start-btn"
                                        onClick={() => onTrigger(event, { status: 'active', startTime: Date.now(), results: [] })}
                                        disabled={event.status === 'active'}
                                    >
                                        {t('classroomEvent.startCountdown') || 'Start Countdown'}
                                    </button>
                                    <button 
                                        className="ev-buzz-reset-btn"
                                        onClick={() => onTrigger(event, { status: 'idle', results: [] })}
                                    >
                                        <FaUndo style={{ marginRight: '6px' }} /> {t('classroomEvent.reset') || 'Reset'}
                                    </button>
                                </div>
                                
                                {/* Winners Display */}
                                {event.results && event.results.length > 0 && (
                                    <div className="ev-buzz-winners-list">
                                        <h4 style={{ color: '#475569', fontSize: '1rem', fontWeight: 'bold', marginBottom: '12px', textAlign: 'left', display: 'flex', alignItems: 'center' }}>
                                            <FaTrophy style={{ color: '#f59e0b', marginRight: '8px', fontSize: '1.2rem' }} /> 
                                            {t('classroomEvent.buzzResults') || 'Buzz Results'}
                                        </h4>
                                        <div className="ev-buzz-results-container" style={{ maxHeight: '220px', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                            {event.results.map((result, idx) => {
                                                const rank = idx + 1;
                                                let badgeStyle = {};
                                                let cardStyle = {
                                                    display: 'flex', alignItems: 'center', padding: '10px 14px', borderRadius: '12px', border: '1px solid #e2e8f0', background: '#f8fafc', transition: 'all 0.2s', gap: '12px'
                                                };
                                                let rankIcon = null;

                                                if (rank === 1) {
                                                    badgeStyle = { background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', color: 'white', boxShadow: '0 2px 4px rgba(245, 158, 11, 0.2)' };
                                                    cardStyle = { ...cardStyle, background: 'linear-gradient(to right, #fffbeb, #ffffff)', border: '2px solid #fde68a', boxShadow: '0 4px 6px -1px rgba(245, 158, 11, 0.1)' };
                                                    rankIcon = <FaCrown style={{ marginRight: '4px' }} />;
                                                } else if (rank === 2) {
                                                    badgeStyle = { background: 'linear-gradient(135deg, #cbd5e1, #94a3b8)', color: 'white', boxShadow: '0 2px 4px rgba(148, 163, 184, 0.2)' };
                                                    cardStyle = { ...cardStyle, background: 'linear-gradient(to right, #f8fafc, #ffffff)', border: '1px solid #cbd5e1' };
                                                } else if (rank === 3) {
                                                    badgeStyle = { background: 'linear-gradient(135deg, #d97706, #b45309)', color: 'white', boxShadow: '0 2px 4px rgba(180, 83, 9, 0.2)' };
                                                    cardStyle = { ...cardStyle, background: 'linear-gradient(to right, #fff7ed, #ffffff)', border: '1px solid #fed7aa' };
                                                } else {
                                                    badgeStyle = { background: '#e2e8f0', color: '#64748b' };
                                                }

                                                return (
                                                    <div key={idx} style={cardStyle}>
                                                        <div style={{ ...badgeStyle, padding: '4px 8px', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 'bold', minWidth: '48px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                                                            {rankIcon}{rank === 1 ? '1st' : (rank === 2 ? '2nd' : (rank === 3 ? '3rd' : `${rank}th`))}
                                                        </div>
                                                        <img referrerPolicy="no-referrer" 
                                                            src={getProfileImageSrc(result.photoURL, isGoogleUser(result))} 
                                                            alt={result.userName} 
                                                            style={{ width: rank === 1 ? '40px' : '36px', height: rank === 1 ? '40px' : '36px', borderRadius: '50%', objectFit: 'cover', border: rank === 1 ? '2px solid #f59e0b' : (rank === 2 ? '2px solid #94a3b8' : (rank === 3 ? '2px solid #d97706' : '1px solid #e2e8f0')) }}
                                                        />
                                                        <span style={{ fontWeight: rank <= 3 ? '700' : '600', color: rank === 1 ? '#92400e' : '#334155', flex: 1, textAlign: 'left', fontSize: rank === 1 ? '1.05rem' : '0.95rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {result.userName}
                                                        </span>
                                                        <span style={{ fontSize: '0.9rem', color: rank === 1 ? '#10b981' : '#64748b', fontFamily: 'monospace', background: rank === 1 ? '#ecfdf5' : '#f1f5f9', padding: '4px 8px', borderRadius: '6px', fontWeight: 'bold' }}>
                                                            {((result.timestamp - (event.startTime || result.timestamp)) / 1000).toFixed(2)}s
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="ev-buzz-student">
                                {isEventEnded ? (
                                    renderStudentEndedState({ bg: '#fef2f2', border: '#fecaca', title: '#dc2626', desc: '#991b1b' })
                                ) : (
                                    <>
                                        <button
                                            className={`ev-buzz-hand-btn ${event.status === 'active' && countdown === 0 && !isSubmitted ? 'active' : ''}`}
                                            onClick={() => {
                                                if (event.status === 'active' && countdown === 0 && !isSubmitted) {
                                                    onSubmitAnswer(event, 'BUZZ!');
                                                    setIsSubmitted(true);
                                                }
                                            }}
                                            disabled={event.status !== 'active' || countdown > 0 || isSubmitted}
                                        >
                                            <FaHandPaper size={48} />
                                        </button>
                                        {isSubmitted && (
                                            <div className="ev-submitted-msg" style={{ background: '#fef2f2', borderColor: '#fecaca', marginTop: '16px' }}>
                                                <span style={{ color: '#dc2626' }}>Buzz Sent! 🚀</span>
                                                <p style={{ color: '#991b1b' }}>Waiting for results...</p>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}



            {/* ✨ Word Cloud Content */}
            {event.type === 'wordcloud' && (
                <div className="wc-card-new">
                    {/* Header */}
                    <div className="wc-header-new">
                        <div className="wc-header-bg-icon">
                            <FaCloud size={120} />
                        </div>
                        {isCreator && onDeleteEvent && (
                            <button
                                className="delete-event-btn"
                                onClick={(e) => { e.stopPropagation(); onDeleteEvent(event); }}
                                title="Delete Event"
                                style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 20, color: 'white', background: 'rgba(0,0,0,0.1)' }}
                            >
                                <FaTrash />
                            </button>
                        )}
                        <h2 className="wc-header-title">
                            <FaMagic style={{ color: '#fef08a' }} /> {t('classroomEvent.typeWordCloudTitle') || 'Word Cloud'} <FaMagic style={{ color: '#fef08a' }} />
                        </h2>
                        <p className="wc-header-subtitle">{event.config?.topic || t('classroomEvent.shareYourWords') || 'Share your words!'}</p>
                        {isCreator && (
                            <button
                                className="wc-present-btn"
                                title={t('classroomEvent.openPresentation') || 'Open Presentation Mode'}
                                onClick={() => {
                                    const presentationUrl = buildPresentationUrl(resolvedClassId, event.id);
                                    window.open(presentationUrl, '_blank', 'noopener,noreferrer');
                                }}
                            >
                                <FaExternalLinkAlt style={{ marginRight: '6px' }} /> {t('classroomEvent.present') || 'Present'}
                            </button>
                        )}
                    </div>

                    <div className="wc-body-new">
                        {/* Word Cloud Preview */}
                        <div className="wc-preview-area">
                            {(!event.results || event.results.length === 0) ? (
                                <div className="wc-empty-state">
                                    <FaCloud style={{ fontSize: '3rem', opacity: 0.2, marginBottom: '12px' }} />
                                    <p>{t('classroomEvent.noWordsYet') || 'No words yet. Start typing!'}</p>
                                </div>
                            ) : (
                                <WordCloudViz results={event.results || []} variant="card" />
                            )}
                        </div>

                        {/* Input Area (students only, or creator can also submit) */}
                        {!isCreator && (
                            <div className="wc-input-section">
                                {!isSubmitted && !isAnswerLocked ? (
                                    <div className="wc-input-row">
                                        <input
                                            type="text"
                                            className="wc-text-input"
                                            placeholder={t('classroomEvent.typeYourWord') || 'Type your word here...'}
                                            value={answerInput}
                                            onChange={(e) => setAnswerInput(e.target.value)}
                                            maxLength={25}
                                            onKeyPress={(e) => { if (e.key === 'Enter') handleAnswerSubmit(); }}
                                        />
                                        <button
                                            className="wc-send-btn"
                                            onClick={handleAnswerSubmit}
                                            disabled={!answerInput.trim() || isSubmitting}
                                        >
                                            {t('classroomEvent.send') || 'Send'}
                                        </button>
                                    </div>
                                ) : isSubmitted ? (
                                    <div className="wc-submitted-msg">
                                        <span>{t('classroomEvent.sentCloud') || 'Sent! ☁️'}</span>
                                        <p>{t('classroomEvent.lookAtBoard') || 'Look at the board!'}</p>
                                    </div>
                                ) : (
                                    renderStudentEndedState({ bg: '#ecfdf5', border: '#a7f3d0', title: '#047857', desc: '#065f46' })
                                )}
                                <div className="wc-char-count">
                                    {t('classroomEvent.charCountLimit', { count: answerInput.length }) || `${answerInput.length}/25 characters`}
                                </div>
                            </div>
                        )}

                        {/* Word Count */}
                        <div className="random-participant-count">
                            <div className="rpc-left">
                                <FaCloud />
                                <span>{t('classroomEvent.totalWords') || 'Total Words'}</span>
                            </div>
                            <span className="rpc-right">{t('classroomEvent.submittedCount', { count: event.results?.length || 0 }) || `${event.results?.length || 0} submitted`}</span>
                        </div>
                        {renderTeacherEventFooter()}
                    </div>
                </div>
            )}

            {/* Fallback for basic events */}
            {event.type === 'default' && <p>{event.description}</p>}
        </div>
    );
};

export default ClassroomEvent;

