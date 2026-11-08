import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import Lottie from 'lottie-react';
import CreateAssignmentModal from './CreateAssignmentModal';
import classworkHeroDesignerAnimation from '../assets/classwork-hero-designer.json';
import '../CSS/ClassworkSection.css';
import API_BASE_URL from '../config/api';

const formatStatValue = (value) => new Intl.NumberFormat().format(value || 0);

const CLASSWORK_ANIMATION_COLORS = {
    'color1': [0.4941, 0.7608, 0.5098, 1], // Light green token #7ec282
    'color2': [1, 1, 1, 1],
    'color3': [0.12, 0.16, 0.22, 1],
    'color4': [0.08, 0.11, 0.15, 1],
    'color5': [0.45, 0.52, 0.60, 1]
};

const createThemedClassworkAnimation = (animationData) => {
    if (!animationData) return null;
    const themedAnimation = JSON.parse(JSON.stringify(animationData));

    const applyThemeToLayers = (layers = []) => {
        layers.forEach((layer) => {
            if (Array.isArray(layer?.ef)) {
                layer.ef.forEach((effect) => {
                    const normalizedKey = (effect?.nm || '').replace(/\s+/g, '').toLowerCase();
                    const nextColor = CLASSWORK_ANIMATION_COLORS[normalizedKey] || CLASSWORK_ANIMATION_COLORS[effect?.nm];
                    const control = effect?.ef?.[0];
                    if (nextColor && control?.v) {
                        control.v.k = nextColor;
                    }
                });
            }

            if (Array.isArray(layer?.shapes)) {
                const scanShapes = (shapes = []) => {
                    shapes.forEach(shape => {
                        if (shape.it && Array.isArray(shape.it)) {
                            scanShapes(shape.it);
                        } else if (shape.ty === 'fl' && shape.c?.k) {
                            const c = shape.c.k;
                            if (Array.isArray(c) && c.length >= 3 && Math.abs(c[0] - 1) < 0.05 && Math.abs(c[1] - 0.505) < 0.05) {
                                shape.c.k = [0.4941, 0.7608, 0.5098, 1];
                            }
                        }
                    });
                };
                scanShapes(layer.shapes);
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

const PlusIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const SearchIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const AssignmentIcon = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
        <rect x="9" y="3" width="6" height="4" rx="2" />
        <line x1="9" y1="12" x2="15" y2="12" />
        <line x1="9" y1="16" x2="13" y2="16" />
    </svg>
);

const ClockIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
    </svg>
);

const ChevronIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

const CalendarIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);

const MoreVerticalIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="1" />
        <circle cx="12" cy="5" r="1" />
        <circle cx="12" cy="19" r="1" />
    </svg>
);

const EditIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

const TrashIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
        <line x1="10" y1="11" x2="10" y2="17" />
        <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
);

const ClearIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const AssignmentCardBlobBg = () => (
    <svg className="cw-card-bg-svg cw-card-bg-svg--blob" fill="currentColor" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <path d="M44.7,-76.4C58.8,-69.2,71.8,-59.1,81.3,-46.1C90.8,-33.1,96.8,-16.6,95.5,-0.7C94.2,15.1,85.6,30.3,74.6,42.4C63.6,54.5,50.2,63.5,35.6,71.1C21,78.7,5.2,84.9,-9.8,83.9C-24.8,82.9,-39.1,74.7,-51.9,64.4C-64.7,54.1,-76.1,41.7,-82.2,26.9C-88.3,12.1,-89.1,-5,-83.9,-19.6C-78.7,-34.2,-67.5,-46.3,-54.6,-54.3C-41.7,-62.3,-27.1,-66.2,-13.2,-70.6C0.7,-75,14.6,-79.9,30.6,-83.4C44.7,-76.4,44.7,-76.4,44.7,-76.4Z" transform="translate(100 100)" />
    </svg>
);

const AssignmentCardGridBg = ({ patternId }) => (
    <svg className="cw-card-bg-svg cw-card-bg-svg--grid" viewBox="0 0 132 132" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <pattern id={patternId} width="16" height="16" patternUnits="userSpaceOnUse">
                <circle cx="2" cy="2" r="2" fill="currentColor" />
            </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
);

const AssignmentCardCirclesBg = () => (
    <svg className="cw-card-bg-svg cw-card-bg-svg--circles" viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <circle cx="100" cy="100" r="80" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="140" cy="60" r="60" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="60" cy="140" r="40" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
);

const AssignmentCardWavesBg = () => (
    <svg className="cw-card-bg-svg cw-card-bg-svg--waves" viewBox="0 0 1440 320" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="currentColor" d="M0,224L48,213.3C96,203,192,181,288,181.3C384,181,480,203,576,192C672,181,768,139,864,133.3C960,128,1056,160,1152,176C1248,192,1344,192,1392,192L1440,192L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z" />
    </svg>
);

const AssignmentCardStripesBg = ({ patternId }) => (
    <svg className="cw-card-bg-svg cw-card-bg-svg--stripes" viewBox="0 0 128 256" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <pattern id={patternId} width="20" height="20" patternTransform="rotate(45)" patternUnits="userSpaceOnUse">
                <line x1="0" y1="0" x2="0" y2="20" stroke="currentColor" strokeWidth="4" />
            </pattern>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
);

const AssignmentCardTopographyBg = () => (
    <svg className="cw-card-bg-svg cw-card-bg-svg--topography" viewBox="0 0 400 200" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
        <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M-50 50 Q 100 0 200 100 T 450 50" />
        <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M-50 80 Q 100 30 200 130 T 450 80" />
        <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M-50 110 Q 100 60 200 160 T 450 110" />
        <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M-50 140 Q 100 90 200 190 T 450 140" />
    </svg>
);

const hashAssignmentSeed = (value = '') => {
    let hash = 7;
    const input = String(value);

    for (let index = 0; index < input.length; index += 1) {
        hash = ((hash * 31) + input.charCodeAt(index)) % 2147483647;
    }

    return hash;
};

const getAssignmentCardVariant = (assignment) => {
    const seed = assignment?.cardVariant
        ?? assignment?._id
        ?? `${assignment?.createdAt || ''}-${assignment?.title || ''}`;
    return (hashAssignmentSeed(seed) % 6) + 1;
};

const getAssignmentCardPatternId = (assignment, suffix) => {
    const rawId = assignment?._id || `${assignment?.createdAt || ''}-${assignment?.title || 'assignment'}`;
    const safeId = String(rawId).replace(/[^a-zA-Z0-9_-]/g, '');
    return `cw-${suffix}-${safeId || 'card'}`;
};

const renderAssignmentCardBackground = () => null;

const SvgBookOpen = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
);

const SvgAlertTriangle = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
        <line x1="12" y1="9" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
);

const SvgCheckCircle = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
        <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
);

const SvgTrendUp = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17" />
        <polyline points="16 7 22 7 22 13" />
    </svg>
);

const ClassworkStatIcon = ({ statKey }) => {
    switch (statKey) {
        case 'total':
        case 'assigned':
            return <SvgBookOpen />;
        case 'upcoming':
            return <SvgTrendUp />;
        case 'past-due':
        case 'missing':
            return <SvgAlertTriangle />;
        case 'avg':
        case 'submitted':
            return <SvgCheckCircle />;
        default:
            return <AssignmentIcon />;
    }
};

const ClassworkSection = ({ classId, user, isCreator }) => {
    const { t } = useTranslation('translation', { keyPrefix: 'classworkSection' });
    const navigate = useNavigate();

    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingAssignment, setEditingAssignment] = useState(null);
    const [menuOpenId, setMenuOpenId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all');

    const themedClassworkAnimation = useMemo(
        () => createThemedClassworkAnimation(classworkHeroDesignerAnimation),
        []
    );

    const FILTER_TABS = useMemo(() => [
        { key: 'all', label: t('filters.all') },
        { key: 'upcoming', label: t('filters.upcoming') },
        { key: 'past', label: t('filters.past') },
        { key: 'no-date', label: t('filters.noDate') }
    ], [t]);

    const fetchAssignments = useCallback(async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/api/classwork/${classId}`, {
                headers: { 'x-auth-token': (user?.token || localStorage.getItem('authToken') || '') }
            });
            setAssignments(Array.isArray(res.data) ? res.data : []);
            setLoading(false);
        } catch (err) {
            console.error('Error fetching assignments:', err);
            setError(t('errorLoad'));
            setLoading(false);
        }
    }, [classId, t, user.token]);

    useEffect(() => {
        fetchAssignments();
    }, [fetchAssignments]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuOpenId && !e.target.closest('.cw-card-actions')) {
                setMenuOpenId(null);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [menuOpenId]);

    const handleAssignmentClick = (assignment) => {
        navigate(`/classroom/${classId}/classwork/${assignment._id}`);
    };

    const handleEditClick = (e, assignment) => {
        e.stopPropagation();
        setEditingAssignment(assignment);
        setMenuOpenId(null);
        setIsCreateModalOpen(true);
    };

    const handleDeleteClick = async (e, assignmentId) => {
        e.stopPropagation();
        setMenuOpenId(null);

        if (!window.confirm(t('card.confirmDelete'))) return;

        try {
            await axios.delete(`${API_BASE_URL}/api/classwork/${classId}/${assignmentId}`, {
                headers: { 'x-auth-token': (user?.token || localStorage.getItem('authToken') || '') }
            });
            setAssignments((prev) => prev.filter((assignment) => assignment._id !== assignmentId));
        } catch (err) {
            console.error('Error deleting assignment:', err);
            alert(t('card.errorDelete'));
        }
    };

    const handleAssignmentUpdate = (updatedAssignment) => {
        if (editingAssignment) {
            setAssignments((prev) => prev.map((assignment) => (
                assignment._id === updatedAssignment._id ? updatedAssignment : assignment
            )));
        } else {
            setAssignments((prev) => [updatedAssignment, ...prev]);
        }

        setEditingAssignment(null);
    };

    const handleModalClose = () => {
        setIsCreateModalOpen(false);
        setEditingAssignment(null);
    };

    const quickStats = useMemo(() => {
        const now = new Date();
        const total = assignments.length;
        const upcoming = assignments.filter((assignment) => (
            assignment.dueDate && new Date(assignment.dueDate) > now
        )).length;
        const pastDue = assignments.filter((assignment) => (
            assignment.dueDate && new Date(assignment.dueDate) <= now
        )).length;
        const avgPoints = total > 0
            ? Math.round(assignments.reduce((sum, assignment) => sum + (assignment.points || 0), 0) / total)
            : 0;

        return { total, upcoming, pastDue, avgPoints };
    }, [assignments]);

    const studentProgress = useMemo(() => {
        const now = new Date();
        const submitted = assignments.filter((assignment) => Boolean(assignment.submission)).length;
        const missing = assignments.filter((assignment) => (
            !assignment.submission && assignment.dueDate && new Date(assignment.dueDate) <= now
        )).length;

        return { submitted, missing };
    }, [assignments]);

    const classworkStats = useMemo(() => {
        if (isCreator) {
            return [
                { key: 'total', label: t('stats.total'), value: quickStats.total },
                { key: 'upcoming', label: t('stats.upcoming'), value: quickStats.upcoming },
                { key: 'past-due', label: t('stats.pastDue'), value: quickStats.pastDue },
                { key: 'avg', label: t('stats.avgPoints'), value: quickStats.avgPoints, suffix: t('card.pts') }
            ];
        }

        return [
            { key: 'assigned', label: t('stats.total'), value: quickStats.total },
            { key: 'upcoming', label: t('stats.upcoming'), value: quickStats.upcoming },
            {
                key: 'missing',
                label: t('hero.studentStatsMissing', { defaultValue: 'Missing' }),
                value: studentProgress.missing
            },
            {
                key: 'submitted',
                label: t('hero.studentStatsSubmitted', { defaultValue: 'Turned in' }),
                value: studentProgress.submitted
            }
        ];
    }, [isCreator, quickStats, studentProgress, t]);

    const heroDescription = isCreator
        ? t(
            'hero.teacherDescription',
            { defaultValue: 'Create assignments, set deadlines, and keep track of submissions from one organized workspace.' }
        )
        : t(
            'hero.studentDescription',
            { defaultValue: 'Check assigned work, due dates, and submission status from one organized workspace.' }
        );

    const filteredAssignments = useMemo(() => {
        let filtered = assignments;

        if (activeFilter === 'upcoming') {
            filtered = filtered.filter((assignment) => assignment.dueDate && new Date(assignment.dueDate) > new Date());
        } else if (activeFilter === 'past') {
            filtered = filtered.filter((assignment) => assignment.dueDate && new Date(assignment.dueDate) <= new Date());
        } else if (activeFilter === 'no-date') {
            filtered = filtered.filter((assignment) => !assignment.dueDate);
        }

        if (searchQuery.trim()) {
            const normalizedQuery = searchQuery.toLowerCase();
            filtered = filtered.filter((assignment) => (
                assignment.title?.toLowerCase().includes(normalizedQuery)
                || assignment.description?.toLowerCase().includes(normalizedQuery)
            ));
        }

        return filtered;
    }, [assignments, activeFilter, searchQuery]);

    const hasActiveRefinement = Boolean(searchQuery.trim()) || activeFilter !== 'all';

    if (loading) {
        return (
            <div className="cw-loader">
                <div className="cw-loader-spinner" />
                <span>{t('loading')}</span>
            </div>
        );
    }

    if (error) {
        return <div className="cw-error">{error}</div>;
    }

    return (
        <div className={`cw-section ${isCreator ? 'is-creator' : 'is-student'}`}>
            <section className={`cw-hero ${isCreator ? 'is-creator' : 'is-student'}`}>
                <div className="cw-hero-accent" />

                <div className="cw-hero-feature">
                    <div className="cw-hero-main">
                        <div className="cw-hero-copy">
                            <h2 className="cw-hero-title">{t('title')}</h2>
                            <p className="cw-hero-description">{heroDescription}</p>
                        </div>

                        <div className="cw-hero-actions">
                            {isCreator ? (
                                <button
                                    type="button"
                                    className="cw-create-btn"
                                    onClick={() => setIsCreateModalOpen(true)}
                                >
                                    <PlusIcon />
                                    <span>{t('createBtnReal')}</span>
                                </button>
                            ) : (
                                <div className="cw-student-action">
                                    <SvgCheckCircle />
                                    <span>
                                        {t('hero.studentAction', { defaultValue: 'Open any card below to review the task and submit your work.' })}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="cw-hero-art" aria-hidden="true">
                        <div className="cw-hero-art-frame">
                            <Lottie
                                animationData={themedClassworkAnimation}
                                loop={true}
                                autoplay={true}
                                className="cw-hero-lottie"
                            />
                        </div>
                    </div>
                </div>

                <div className="cw-stats-grid">
                    {classworkStats.map((stat) => (
                        <div key={stat.key} className={`cw-stat-tile cw-stat-tile--${stat.key}`}>
                            <div className="cw-stat-icon">
                                <ClassworkStatIcon statKey={stat.key} />
                            </div>
                            <div className="cw-stat-info">
                                <span className="cw-stat-num">
                                    {formatStatValue(stat.value)}
                                    {stat.suffix ? ` ${stat.suffix}` : ''}
                                </span>
                                <span className="cw-stat-label">{stat.label}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </section>

            {assignments.length > 0 && (
                <section className="cw-toolbar-panel">
                    <div className="cw-toolbar">
                        <div className="cw-search-wrap">
                            <SearchIcon />
                            <input
                                className="cw-search-input"
                                type="text"
                                placeholder={t('searchHint')}
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button type="button" className="cw-search-clear" onClick={() => setSearchQuery('')}>
                                    <ClearIcon />
                                </button>
                            )}
                        </div>

                        <div className="cw-filters">
                            {FILTER_TABS.map((tab) => (
                                <button
                                    key={tab.key}
                                    type="button"
                                    className={`cw-filter-tab ${activeFilter === tab.key ? 'cw-filter-tab--active' : ''}`}
                                    onClick={() => setActiveFilter(tab.key)}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </section>
            )}

            <div className={`cw-grid ${filteredAssignments.length === 1 ? 'cw-grid--single' : ''}`}>
                {filteredAssignments.length === 0 ? (
                    assignments.length === 0 ? (
                        <div className="cw-empty-minimal" role="status">
                            {t('empty.noAssignments')}
                        </div>
                    ) : (
                        <div className="cw-empty is-filtered">
                            <div className="cw-empty-copy">
                                <span className="cw-empty-kicker">
                                    {t('empty.noMatching')}
                                </span>
                                <h3>{t('empty.noMatching')}</h3>
                                <p>{t('empty.adjustFilter')}</p>

                                <div className="cw-empty-actions">
                                    {hasActiveRefinement && (
                                        <button
                                            type="button"
                                            className="cw-secondary-btn"
                                            onClick={() => {
                                                setSearchQuery('');
                                                setActiveFilter('all');
                                            }}
                                        >
                                            <ClearIcon />
                                            <span>{t('empty.resetFilters', { defaultValue: 'Reset filters' })}</span>
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )
                ) : (
                    filteredAssignments.map((assignment, index) => {
                        const isStudent = !isCreator;
                        let statusText = '';
                        let statusClass = '';
                        const cardVariant = getAssignmentCardVariant(assignment);

                        if (isStudent && assignment.submission) {
                            if (assignment.submission.status === 'graded') {
                                statusText = t('status.graded', {
                                    passed: assignment.submission.pointsAwarded,
                                    total: assignment.points
                                });
                                statusClass = 'cw-status--graded';
                            } else if (assignment.submission.status === 'late') {
                                statusText = t('status.late');
                                statusClass = 'cw-status--late';
                            } else {
                                statusText = t('status.turnedIn');
                                statusClass = 'cw-status--submitted';
                            }
                        } else if (isStudent) {
                            const isLate = assignment.dueDate && new Date() > new Date(assignment.dueDate);
                            statusText = isLate ? t('status.missing') : t('status.assigned');
                            statusClass = isLate ? 'cw-status--missing' : 'cw-status--assigned';
                        }

                        const isOverdue = assignment.dueDate && new Date() > new Date(assignment.dueDate);
                        const dueDateStr = assignment.dueDate
                            ? new Date(assignment.dueDate).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            })
                            : null;

                        const postedDateStr = assignment.createdAt
                            ? new Date(assignment.createdAt).toLocaleDateString(undefined, {
                                month: 'short',
                                day: 'numeric'
                            })
                            : null;

                        const submissionCount = assignment.submissionStats?.graded ?? assignment.submissionCount ?? 0;
                        const totalStudents = assignment.submissionStats?.total ?? assignment.totalStudents ?? 0;
                        const progressPct = totalStudents > 0
                            ? Math.round((submissionCount / totalStudents) * 100)
                            : 0;

                        return (
                            <article
                                key={assignment._id}
                                className={`cw-card cw-card--variant-${cardVariant} ${menuOpenId === assignment._id ? 'cw-card--menu-open' : ''}`}
                                onClick={() => handleAssignmentClick(assignment)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => e.key === 'Enter' && handleAssignmentClick(assignment)}
                                style={{ animationDelay: `${index * 0.05}s` }}
                            >
                                <div className="cw-card-accent" aria-hidden="true" />
                                <div className="cw-card-bg" aria-hidden="true">
                                    {renderAssignmentCardBackground(assignment, cardVariant)}
                                </div>

                                <div className="cw-card-shell">
                                    <div className="cw-card-top">
                                        <div className="cw-card-icon-wrap">
                                            <AssignmentIcon />
                                        </div>

                                        {isCreator && (
                                            <div className="cw-card-actions" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    type="button"
                                                    className={`cw-menu-btn ${menuOpenId === assignment._id ? 'cw-menu-btn--active' : ''}`}
                                                    onClick={() => setMenuOpenId(menuOpenId === assignment._id ? null : assignment._id)}
                                                >
                                                    <MoreVerticalIcon />
                                                </button>

                                                {menuOpenId === assignment._id && (
                                                    <div className="cw-card-menu">
                                                        <button
                                                            type="button"
                                                            className="cw-menu-item"
                                                            onClick={(e) => handleEditClick(e, assignment)}
                                                        >
                                                            <EditIcon />
                                                            {t('card.edit')}
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="cw-menu-item cw-menu-item--danger"
                                                            onClick={(e) => handleDeleteClick(e, assignment._id)}
                                                        >
                                                            <TrashIcon />
                                                            {t('card.delete')}
                                                        </button>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div className="cw-card-body">
                                        <h4 className="cw-card-title">{assignment.title}</h4>
                                        {assignment.description && (
                                            <p className="cw-card-desc">
                                                {assignment.description.substring(0, 108)}
                                                {assignment.description.length > 108 ? '...' : ''}
                                            </p>
                                        )}
                                    </div>

                                    <div className="cw-card-footer">
                                        <div className="cw-card-meta">
                                            <span className="cw-points-badge">
                                                {assignment.points} {t('card.pts')}
                                            </span>

                                            {dueDateStr && (
                                                <span className={`cw-due-date ${isOverdue ? 'cw-due-date--overdue' : ''}`}>
                                                    <ClockIcon />
                                                    {dueDateStr}
                                                </span>
                                            )}

                                            {!dueDateStr && postedDateStr && (
                                                <span className="cw-posted-date">
                                                    <CalendarIcon />
                                                    {postedDateStr}
                                                </span>
                                            )}
                                        </div>

                                        <div className="cw-card-bottom-row">
                                            <div className="cw-card-support">
                                                {isStudent && statusText && (
                                                    <div className={`cw-status ${statusClass}`}>
                                                        {statusText}
                                                    </div>
                                                )}

                                                {isCreator && totalStudents > 0 && (
                                                    <div className="cw-progress-wrap">
                                                        <div className="cw-progress-bar">
                                                            <div className="cw-progress-fill" style={{ width: `${progressPct}%` }} />
                                                        </div>
                                                        <span className="cw-progress-text">
                                                            {submissionCount}/{totalStudents}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="cw-card-chevron">
                                                <ChevronIcon />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </article>
                        );
                    })
                )}
            </div>

            <CreateAssignmentModal
                isOpen={isCreateModalOpen}
                onClose={handleModalClose}
                classId={classId}
                user={user}
                onAssignmentCreated={handleAssignmentUpdate}
                assignment={editingAssignment}
            />
        </div>
    );
};

export default ClassworkSection;
