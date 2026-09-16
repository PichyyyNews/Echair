import React, { useState, useMemo } from 'react';
import {
    FaChartBar, FaQuestionCircle, FaCloud, FaClock, FaCheckCircle,
    FaDice, FaBullhorn, FaTrash, FaTrophy, FaStar, FaUsers,
    FaChevronDown, FaChevronUp, FaFilter, FaSearch, FaTable,
    FaChartLine, FaEdit, FaSave, FaTimes, FaHistory, FaPoll
} from 'react-icons/fa';
import '../../CSS/EventHistory.css';

const EventHistoryView = ({ classroom, user, onUpdateScores, onRefresh }) => {
    const [activeTab, setActiveTab] = useState('events'); // events | scores | stats
    const [filterType, setFilterType] = useState('all');
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchText, setSearchText] = useState('');
    const [expandedEvent, setExpandedEvent] = useState(null);
    const [editingScore, setEditingScore] = useState(null); // { studentId, category }
    const [editValue, setEditValue] = useState(0);

    // Merge active + archived events
    const allEvents = useMemo(() => {
        const active = (classroom?.classroomEvents || []).map(e => ({ ...e, _source: 'active' }));
        const archived = (classroom?.eventHistory || []).map(e => ({ ...e, _source: 'archived' }));
        return [...active, ...archived].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    }, [classroom]);

    // Filter events
    const filteredEvents = useMemo(() => {
        return allEvents.filter(e => {
            if (filterType !== 'all' && e.type !== filterType) return false;
            if (filterStatus === 'active' && e.status === 'ended') return false;
            if (filterStatus === 'active' && e.status === 'deleted') return false;
            if (filterStatus === 'ended' && e.status !== 'ended') return false;
            if (filterStatus === 'deleted' && e.status !== 'deleted') return false;
            if (searchText && !(e.title || '').toLowerCase().includes(searchText.toLowerCase()) &&
                !(e.type || '').toLowerCase().includes(searchText.toLowerCase())) return false;
            return true;
        });
    }, [allEvents, filterType, filterStatus, searchText]);

    // Student scores from classroom
    const studentScores = classroom?.studentScores || {};
    const assignedUsers = classroom?.assignedUsers || {};

    // Build student list
    const students = useMemo(() => {
        const userMap = {};
        // From assignedUsers
        Object.values(assignedUsers).forEach(u => {
            if (u.userId) userMap[u.userId] = { id: u.userId, name: u.userName || 'Unknown' };
        });
        // From scores
        Object.keys(studentScores).forEach(uid => {
            if (!userMap[uid]) userMap[uid] = { id: uid, name: uid };
        });
        return Object.values(userMap);
    }, [assignedUsers, studentScores]);

    // Event score categories (from studentScores)
    const eventCategories = useMemo(() => {
        const cats = new Set();
        Object.values(studentScores).forEach(scores => {
            Object.keys(scores).forEach(cat => {
                if (cat.includes('(Event)')) cats.add(cat);
            });
        });
        return Array.from(cats).sort();
    }, [studentScores]);

    // Stats computation
    const stats = useMemo(() => {
        if (students.length === 0 || eventCategories.length === 0) return null;

        const studentTotals = students.map(s => {
            const scores = studentScores[s.id] || {};
            return eventCategories.reduce((sum, cat) => sum + (scores[cat] || 0), 0);
        });

        const n = studentTotals.length;
        const total = studentTotals.reduce((s, v) => s + v, 0);
        const mean = n > 0 ? total / n : 0;
        const variance = n > 0 ? studentTotals.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / n : 0;
        const std = Math.sqrt(variance);
        const max = Math.max(...studentTotals, 0);
        const min = Math.min(...studentTotals, 0);

        return { total, mean, std, max, min, count: n };
    }, [students, studentScores, eventCategories]);

    // Helper functions
    const getEventIcon = (type) => {
        const icons = {
            poll: <FaPoll />, question: <FaQuestionCircle />,
            wordcloud: <FaCloud />, random: <FaDice />,
            buzz: <FaBullhorn />
        };
        return icons[type] || <FaQuestionCircle />;
    };

    const getEventColor = (type) => {
        const colors = {
            poll: '#f59e0b', question: '#3b82f6',
            wordcloud: '#10b981', random: '#10b981',
            buzz: '#ef4444'
        };
        return colors[type] || '#6b7280';
    };

    const getStatusBadge = (status) => {
        if (status === 'ended') return <span className="eh-status-badge ended"><FaCheckCircle /> Ended</span>;
        if (status === 'deleted') return <span className="eh-status-badge deleted"><FaTrash /> Deleted</span>;
        if (status === 'active') return <span className="eh-status-badge active"><FaClock /> Active</span>;
        return <span className="eh-status-badge idle"><FaClock /> Idle</span>;
    };

    const getParticipantCount = (event) => {
        if (!event.results) return 0;
        if (Array.isArray(event.results)) {
            const unique = new Set(event.results.map(r => r.userId).filter(Boolean));
            return unique.size;
        }
        return 0;
    };

    const formatDate = (ts) => {
        if (!ts) return '—';
        const d = new Date(ts);
        return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }) +
            ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    };

    const handleSaveScore = (studentId, category) => {
        if (onUpdateScores) {
            onUpdateScores(studentId, category, editValue);
        }
        setEditingScore(null);
    };

    // Simple bar chart renderer
    const renderBarChart = (data, maxVal) => {
        if (!data || data.length === 0) return null;
        const safeMax = maxVal || Math.max(...data.map(d => Math.abs(d.value)), 1);
        return (
            <div className="eh-bar-chart">
                {data.map((d, i) => (
                    <div key={i} className="eh-bar-row">
                        <span className="eh-bar-label" title={d.label}>{d.label}</span>
                        <div className="eh-bar-track">
                            <div
                                className="eh-bar-fill"
                                style={{
                                    width: `${Math.max(2, (Math.abs(d.value) / safeMax) * 100)}%`,
                                    background: d.value >= 0 ? '#10b981' : '#ef4444'
                                }}
                            />
                        </div>
                        <span className="eh-bar-value">{d.value}</span>
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="eh-container">
            {/* Header */}
            <div className="eh-header">
                <div className="eh-header-left">
                    <div className="eh-header-icon">
                        <FaHistory size={20} />
                    </div>
                    <div>
                        <h2>Event History</h2>
                        <p>{allEvents.length} events total • {eventCategories.length} scoring categories</p>
                    </div>
                </div>
                <button className="eh-refresh-btn" onClick={onRefresh}>
                    <FaHistory /> Refresh
                </button>
            </div>

            {/* Tab Bar */}
            <div className="eh-tabs">
                <button className={`eh-tab ${activeTab === 'events' ? 'active' : ''}`} onClick={() => setActiveTab('events')}>
                    <FaTable /> Events Log
                </button>
                <button className={`eh-tab ${activeTab === 'scores' ? 'active' : ''}`} onClick={() => setActiveTab('scores')}>
                    <FaStar /> Score Table
                </button>
                <button className={`eh-tab ${activeTab === 'stats' ? 'active' : ''}`} onClick={() => setActiveTab('stats')}>
                    <FaChartLine /> Statistics
                </button>
            </div>

            {/* ========== EVENTS LOG TAB ========== */}
            {activeTab === 'events' && (
                <div className="eh-section">
                    {/* Filters */}
                    <div className="eh-filters">
                        <div className="eh-search">
                            <FaSearch />
                            <input
                                type="text"
                                placeholder="Search events..."
                                value={searchText}
                                onChange={(e) => setSearchText(e.target.value)}
                            />
                        </div>
                        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="eh-select">
                            <option value="all">All Types</option>
                            <option value="poll">Poll</option>
                            <option value="question">Question</option>
                            <option value="wordcloud">Word Cloud</option>
                            <option value="random">Random</option>
                            <option value="buzz">Buzz</option>
                        </select>
                        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="eh-select">
                            <option value="all">All Status</option>
                            <option value="active">Active / Idle</option>
                            <option value="ended">Ended</option>
                            <option value="deleted">Deleted</option>
                        </select>
                    </div>

                    {/* Event List */}
                    {filteredEvents.length === 0 ? (
                        <div className="eh-empty">No events found.</div>
                    ) : (
                        <div className="eh-event-list">
                            {filteredEvents.map(event => (
                                <div key={event.id} className={`eh-event-card ${event.status === 'deleted' ? 'deleted' : ''}`}>
                                    <div className="eh-event-main" onClick={() => setExpandedEvent(expandedEvent === event.id ? null : event.id)}>
                                        <div className="eh-event-icon" style={{ background: getEventColor(event.type) }}>
                                            {getEventIcon(event.type)}
                                        </div>
                                        <div className="eh-event-info">
                                            <h4>{event.title || event.config?.questionText || event.config?.topic || event.type}</h4>
                                            <div className="eh-event-meta">
                                                <span><FaClock size={10} /> {formatDate(event.createdAt)}</span>
                                                <span><FaUsers size={10} /> {getParticipantCount(event)} participants</span>
                                                {event.config?.scoring?.enabled && (
                                                    <span className="eh-scoring-tag"><FaStar size={10} /> Scored</span>
                                                )}
                                            </div>
                                        </div>
                                        {getStatusBadge(event.status)}
                                        <div className="eh-expand-icon">
                                            {expandedEvent === event.id ? <FaChevronUp /> : <FaChevronDown />}
                                        </div>
                                    </div>

                                    {/* Expanded Detail */}
                                    {expandedEvent === event.id && (
                                        <div className="eh-event-detail">
                                            <div className="eh-detail-grid">
                                                <div className="eh-detail-item">
                                                    <label>Type</label>
                                                    <span>{event.type}</span>
                                                </div>
                                                <div className="eh-detail-item">
                                                    <label>Created</label>
                                                    <span>{formatDate(event.createdAt)}</span>
                                                </div>
                                                <div className="eh-detail-item">
                                                    <label>Updated</label>
                                                    <span>{formatDate(event.updatedAt)}</span>
                                                </div>
                                                {event.deletedAt && (
                                                    <div className="eh-detail-item">
                                                        <label>Deleted</label>
                                                        <span style={{ color: '#ef4444' }}>{formatDate(event.deletedAt)}</span>
                                                    </div>
                                                )}
                                                <div className="eh-detail-item">
                                                    <label>Participants</label>
                                                    <span>{getParticipantCount(event)}</span>
                                                </div>
                                                {event.config?.scoring?.enabled && (
                                                    <div className="eh-detail-item">
                                                        <label>Scoring</label>
                                                        <span>
                                                            {event.config.scoreConfig ? 'Per-option' : `+${event.config.scoring.points} pts`}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Results Summary */}
                                            {event.results && Array.isArray(event.results) && event.results.length > 0 && (
                                                <div className="eh-results-section">
                                                    <h5>Results ({event.results.length} responses)</h5>
                                                    {event.type === 'poll' && (
                                                        <div className="eh-poll-results">
                                                            {(() => {
                                                                const optCounts = {};
                                                                event.results.forEach(r => {
                                                                    const opt = r.text || r.option || 'Unknown';
                                                                    optCounts[opt] = (optCounts[opt] || 0) + 1;
                                                                });
                                                                const data = Object.entries(optCounts).map(([label, value]) => ({ label, value }));
                                                                return renderBarChart(data);
                                                            })()}
                                                        </div>
                                                    )}
                                                    {event.type === 'random' && (
                                                        <div className="eh-random-results">
                                                            <span className="eh-mini-label">Selected:</span>
                                                            {event.results.map((r, i) => (
                                                                <span key={i} className="eh-result-chip">{r.userName || 'Unknown'}</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    {event.type === 'buzz' && event.results.length > 0 && (
                                                        <div className="eh-buzz-results">
                                                            <span className="eh-mini-label">Winner:</span>
                                                            <span className="eh-result-chip winner">{event.results[0].userName || 'Unknown'}</span>
                                                        </div>
                                                    )}
                                                    {(event.type === 'question' || event.type === 'wordcloud') && (
                                                        <div className="eh-text-results">
                                                            {event.results.slice(0, 10).map((r, i) => (
                                                                <div key={i} className="eh-text-result-row">
                                                                    <span className="eh-text-user">{r.userName || 'Unknown'}</span>
                                                                    <span className="eh-text-answer">{r.text || r.answer || '—'}</span>
                                                                </div>
                                                            ))}
                                                            {event.results.length > 10 && (
                                                                <span className="eh-more">+{event.results.length - 10} more</span>
                                                            )}
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ========== SCORE TABLE TAB ========== */}
            {activeTab === 'scores' && (
                <div className="eh-section">
                    {eventCategories.length === 0 ? (
                        <div className="eh-empty">No event scores recorded yet.</div>
                    ) : (
                        <div className="eh-table-wrapper">
                            <table className="eh-score-table">
                                <thead>
                                    <tr>
                                        <th className="eh-th-fixed">Student</th>
                                        {eventCategories.map(cat => (
                                            <th key={cat} title={cat}>
                                                {cat.replace(' (Event)', '')}
                                            </th>
                                        ))}
                                        <th className="eh-th-total">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {students.map(student => {
                                        const scores = studentScores[student.id] || {};
                                        const total = eventCategories.reduce((sum, cat) => sum + (scores[cat] || 0), 0);
                                        return (
                                            <tr key={student.id}>
                                                <td className="eh-td-name">{student.name}</td>
                                                {eventCategories.map(cat => {
                                                    const val = scores[cat] || 0;
                                                    const isEditing = editingScore?.studentId === student.id && editingScore?.category === cat;
                                                    return (
                                                        <td key={cat} className={`eh-td-score ${val > 0 ? 'positive' : val < 0 ? 'negative' : ''}`}>
                                                            {isEditing ? (
                                                                <div className="eh-edit-inline">
                                                                    <input
                                                                        type="number"
                                                                        value={editValue}
                                                                        onChange={(e) => setEditValue(parseInt(e.target.value) || 0)}
                                                                        className="eh-edit-input"
                                                                        autoFocus
                                                                    />
                                                                    <button className="eh-edit-save" onClick={() => handleSaveScore(student.id, cat)}><FaSave /></button>
                                                                    <button className="eh-edit-cancel" onClick={() => setEditingScore(null)}><FaTimes /></button>
                                                                </div>
                                                            ) : (
                                                                <span
                                                                    className="eh-score-cell"
                                                                    onClick={() => {
                                                                        setEditingScore({ studentId: student.id, category: cat });
                                                                        setEditValue(val);
                                                                    }}
                                                                    title="Click to edit"
                                                                >
                                                                    {val} <FaEdit className="eh-edit-icon" />
                                                                </span>
                                                            )}
                                                        </td>
                                                    );
                                                })}
                                                <td className="eh-td-total">{total}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {/* ========== STATISTICS TAB ========== */}
            {activeTab === 'stats' && (
                <div className="eh-section">
                    {!stats ? (
                        <div className="eh-empty">No data available for statistics.</div>
                    ) : (
                        <>
                            {/* Summary Cards */}
                            <div className="eh-stats-cards">
                                <div className="eh-stat-card">
                                    <div className="eh-stat-icon" style={{ background: '#3b82f6' }}><FaUsers /></div>
                                    <div className="eh-stat-data">
                                        <span className="eh-stat-value">{stats.count}</span>
                                        <span className="eh-stat-label">Students</span>
                                    </div>
                                </div>
                                <div className="eh-stat-card">
                                    <div className="eh-stat-icon" style={{ background: '#10b981' }}><FaChartBar /></div>
                                    <div className="eh-stat-data">
                                        <span className="eh-stat-value">{stats.mean.toFixed(2)}</span>
                                        <span className="eh-stat-label">Mean (x̄)</span>
                                    </div>
                                </div>
                                <div className="eh-stat-card">
                                    <div className="eh-stat-icon" style={{ background: '#f59e0b' }}><FaChartLine /></div>
                                    <div className="eh-stat-data">
                                        <span className="eh-stat-value">{stats.std.toFixed(2)}</span>
                                        <span className="eh-stat-label">Std Dev (σ)</span>
                                    </div>
                                </div>
                                <div className="eh-stat-card">
                                    <div className="eh-stat-icon" style={{ background: '#8b5cf6' }}><FaTrophy /></div>
                                    <div className="eh-stat-data">
                                        <span className="eh-stat-value">{stats.max}</span>
                                        <span className="eh-stat-label">Max Score</span>
                                    </div>
                                </div>
                            </div>

                            {/* Event Type Breakdown */}
                            <div className="eh-stats-section">
                                <h3><FaChartBar /> Event Type Breakdown</h3>
                                {renderBarChart(
                                    ['poll', 'question', 'wordcloud', 'random', 'buzz'].map(type => ({
                                        label: type.charAt(0).toUpperCase() + type.slice(1),
                                        value: allEvents.filter(e => e.type === type).length
                                    })).filter(d => d.value > 0)
                                )}
                            </div>

                            {/* Student Score Distribution */}
                            <div className="eh-stats-section">
                                <h3><FaTrophy /> Student Score Ranking</h3>
                                {renderBarChart(
                                    students.map(s => {
                                        const scores = studentScores[s.id] || {};
                                        const total = eventCategories.reduce((sum, cat) => sum + (scores[cat] || 0), 0);
                                        return { label: s.name, value: total };
                                    }).sort((a, b) => b.value - a.value).slice(0, 15)
                                )}
                            </div>

                            {/* Status Breakdown */}
                            <div className="eh-stats-section">
                                <h3><FaHistory /> Event Status Summary</h3>
                                <div className="eh-status-summary">
                                    <div className="eh-status-item">
                                        <span className="eh-status-dot active" />
                                        <span>Active/Idle</span>
                                        <strong>{allEvents.filter(e => e.status !== 'ended' && e.status !== 'deleted').length}</strong>
                                    </div>
                                    <div className="eh-status-item">
                                        <span className="eh-status-dot ended" />
                                        <span>Ended</span>
                                        <strong>{allEvents.filter(e => e.status === 'ended').length}</strong>
                                    </div>
                                    <div className="eh-status-item">
                                        <span className="eh-status-dot deleted" />
                                        <span>Deleted</span>
                                        <strong>{allEvents.filter(e => e.status === 'deleted').length}</strong>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
};

export default EventHistoryView;
