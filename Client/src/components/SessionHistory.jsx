// src/components/SessionHistory.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getProfileImageSrc, handleImageError } from '../utils/profileImageHelper';
import { FiClock, FiUsers, FiStar, FiChevronDown, FiBookOpen, FiInbox, FiChevronUp } from 'react-icons/fi';
import { useTranslation } from 'react-i18next';
import '../CSS/SessionHistory.css';
import API_BASE_URL from '../config/api';

const formatDuration = (seconds, t) => {
    if (!seconds) return '0s';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return t('sessionHistory.durationHM', { h, m }) || `${h}h ${m}m`;
    if (m > 0) return t('sessionHistory.durationMS', { m, s }) || `${m}m ${s}s`;
    return t('sessionHistory.durationS', { s }) || `${s}s`;
};

const formatDate = (dateStr, t) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString(t('common.locale', { defaultValue: 'en-US' }), {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });
};

const formatTime = (dateStr, t) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString(t('common.locale', { defaultValue: 'en-US' }), {
        hour: '2-digit',
        minute: '2-digit'
    });
};

const getRankDisplay = (index) => {
    if (index === 0) return '🥇';
    if (index === 1) return '🥈';
    if (index === 2) return '🥉';
    return `#${index + 1}`;
};

const SessionHistory = ({ classId, user }) => {
    const { t } = useTranslation();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);
    const [total, setTotal] = useState(0);

    useEffect(() => {
        fetchSessions();
    }, [classId]);

    const fetchSessions = async () => {
        try {
            setLoading(true);
            const res = await axios.get(`${API_BASE_URL}/api/classrooms/${classId}/sessions`, {
                headers: { 'x-auth-token': user.token }
            });
            setSessions(res.data.sessions || []);
            setTotal(res.data.total || 0);
        } catch (err) {
            console.error('Error fetching sessions:', err);
        } finally {
            setLoading(false);
        }
    };

    // Group sessions by date
    const groupedSessions = sessions.reduce((groups, session) => {
        const dateKey = formatDate(session.startedAt, t);
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(session);
        return groups;
    }, {});

    if (loading) {
        return (
            <div className="session-history-loading">
                <div className="session-loading-spinner" />
                <p>{t('sessionHistory.loading') || 'Loading session history...'}</p>
            </div>
        );
    }

    return (
        <div className="sh-container">
            {/* Header matches monotone theme */}
            <div className="sh-header">
                <div className="sh-header-left">
                    <div className="sh-header-icon">
                        <FiBookOpen size={20} />
                    </div>
                    <div>
                        <h2>{t('sessionHistory.title') || 'Class Sessions'}</h2>
                        <p>{t('sessionHistory.totalSessions', { count: total, s: total !== 1 ? 's' : '' }) || `${total} session${total !== 1 ? 's' : ''} total`}</p>
                    </div>
                </div>
            </div>

            {sessions.length === 0 ? (
                <div className="session-history-empty">
                    <FiInbox className="empty-icon" />
                    <h3>{t('sessionHistory.emptyTitle') || 'No Teaching Sessions Yet'}</h3>
                    <p>{t('sessionHistory.emptyDesc') || 'Start a teaching session from your classroom to see summaries here.'}</p>
                </div>
            ) : (
                /* Event List */
                <div className="sh-section">

            {Object.entries(groupedSessions).map(([dateKey, dateSessions]) => (
                <div key={dateKey} className="session-date-group">
                    <div className="sh-date-label">{dateKey}</div>
                    <div className="sh-event-list">
                        {dateSessions.map(session => {
                            const isExpanded = expandedId === session._id;
                            const topStudents = session.summary?.topStudents || [];
                            const startedByName = session.startedBy?.displayName || t('sessionHistory.teacher') || 'Teacher';

                            return (
                                <div
                                    key={session._id}
                                    className={`sh-event-card ${isExpanded ? 'expanded' : ''}`}
                                >
                                    <div
                                        className="sh-event-main"
                                        onClick={() => setExpandedId(isExpanded ? null : session._id)}
                                    >
                                        <div className="sh-event-icon" style={{ background: '#3b82f6' }}>
                                            <FiBookOpen />
                                        </div>
                                        <div className="sh-event-info">
                                            <h4>{t('sessionHistory.sessionTitle') || 'Teaching Session'}</h4>
                                            <div className="sh-event-meta">
                                                <span><FiClock size={10} /> {formatTime(session.startedAt, t)} — {formatTime(session.endedAt, t)}</span>
                                                <span><FiUsers size={10} /> {t('sessionHistory.studentsScored', { count: session.summary?.studentsScored || 0 }) || `${session.summary?.studentsScored || 0} students`}</span>
                                                <span className="sh-scoring-tag"><FiStar size={10} /> {t('sessionHistory.totalChanges', { count: session.summary?.totalScoreChanges || 0 }) || `${session.summary?.totalScoreChanges || 0} changes`}</span>
                                            </div>
                                        </div>
                                        <span className="sh-status-badge active"><FiClock /> {formatDuration(session.durationSeconds, t)}</span>
                                        <div className="sh-expand-icon">
                                            {isExpanded ? <FiChevronUp /> : <FiChevronDown />}
                                        </div>
                                    </div>

                                    {isExpanded && (
                                        <div className="sh-event-detail">
                                            <div className="sh-detail-grid">
                                                <div className="sh-detail-item">
                                                    <label>{t('sessionHistory.startedBy') || 'Started By'}</label>
                                                    <span>{startedByName}</span>
                                                </div>
                                                <div className="sh-detail-item">
                                                    <label>{t('sessionHistory.duration') || 'Duration'}</label>
                                                    <span>{formatDuration(session.durationSeconds, t)}</span>
                                                </div>
                                            </div>
                                            
                                            {topStudents.length > 0 ? (
                                                <div className="sh-results-section">
                                                    <h5>{t('sessionHistory.resultsTitle', { count: topStudents.length }) || `Results (${topStudents.length} students)`}</h5>
                                                    <div className="sh-mini-leaderboard">
                                                        {topStudents.map((student, idx) => (
                                                            <div key={student.studentId} className={`sh-mini-rank ${idx < 3 ? `mini-rank-${idx + 1}` : ''}`}>
                                                                <span className="mini-rank-pos">{getRankDisplay(idx)}</span>
                                                                <img referrerPolicy="no-referrer"
                                                                    src={getProfileImageSrc(student.photoURL, false)}
                                                                    alt={student.studentName}
                                                                    className="mini-rank-avatar"
                                                                    onError={handleImageError}
                                                                />
                                                                <span className="mini-rank-name">{student.studentName}</span>
                                                                <span className={`mini-rank-pts ${student.totalPoints < 0 ? 'negative' : ''}`}>
                                                                    {student.totalPoints > 0 ? '+' : ''}{student.totalPoints} {t('sessionHistory.pts') || 'pts'}
                                                                </span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="sh-results-section">
                                                    <div className="session-no-data">{t('sessionHistory.noScores') || 'No scores recorded in this session.'}</div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
                </div>
            )}
        </div>
    );
};

export default SessionHistory;

