// src/components/Summary.jsx — Unified Summary + Scoreboard with Bento Grid

import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { FiPrinter, FiUser, FiActivity } from 'react-icons/fi';
import '../CSS/Summary.css';
import '../CSS/Print.css';
import { getProfileImageSrc, isGoogleUser, handleImageError } from '../utils/profileImageHelper';
import SummaryPrintLayout from './SummaryPrintLayout';
import { useTranslation } from 'react-i18next';
import API_BASE_URL from '../config/api';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    Filler
);

/* ───────── SVG Icon Components ───────── */
const SvgTrophy = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>
);
const SvgCrown = () => (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm0 2v2h14v-2H5z"/></svg>
);
const SvgMedal = () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7.21 15 2.66 7.14a2 2 0 0 1 .13-2.2L4.4 2.8A2 2 0 0 1 6 2h12a2 2 0 0 1 1.6.8l1.6 2.14a2 2 0 0 1 .14 2.2L16.79 15"/><path d="M11 12 5.12 2.2"/><path d="m13 12 5.88-9.8"/><path d="M8 7h8"/><circle cx="12" cy="17" r="5"/><path d="M12 18v-2h-.5"/></svg>
);
const SvgUsers = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
);
const SvgTrendUp = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>
);
const SvgStar = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
);
const SvgBarChart = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/></svg>
);
const SvgBellCurve = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 20c1-6 4-14 10-14s9 8 10 14"/></svg>
);
const SvgTarget = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>
);
const SvgEdit = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/><path d="m15 5 4 4"/></svg>
);
const SvgAward = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11"/></svg>
);


const Summary = ({ classId, user, classroom, onUpdateScores }) => {
    const { t } = useTranslation();
    const [summaryData, setSummaryData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedStudentId, setSelectedStudentId] = useState('overview');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    // ─── Student Status & Score Bar Toggle ───
    const [showStudentStatus, setShowStudentStatus] = useState(classroom?.showStudentStatus || false);
    const [showScoreBar, setShowScoreBar] = useState(classroom?.showScoreBar || false);
    const isCreator = classroom?.creator?.some(c => {
        const cId = c._id || c.id || c.toString();
        return cId === (user?.id || user?._id);
    });

    // ─── Scoreboard State ───
    const [scoreCategories, setScoreCategories] = useState([]);
    const [scoresTable, setScoresTable] = useState([]);
    const [editingCell, setEditingCell] = useState({ studentId: null, category: null });
    const [tempScore, setTempScore] = useState('');
    const [scoreStats, setScoreStats] = useState(null);

    // ─── Click-outside to close dropdown ───
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (isDropdownOpen && !event.target.closest('.bento-select-container')) {
                setIsDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isDropdownOpen]);

    // ─── Fetch & Process Summary Data ───
    const fetchSummaryData = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/classrooms/${classId}`, {
                headers: { 'x-auth-token': user.token }
            });
            const classroomData = response.data;
            const processedData = processClassroomData(classroomData);
            setSummaryData(processedData);
            processScoreboardData(classroomData);
            setLoading(false);
        } catch (err) {
            setError('Failed to load summary data');
            setLoading(false);
        }
    };

    // ─── Process Scoreboard Data from classroom prop or fetched data ───
    const processScoreboardData = (classroomData) => {
        const data = classroomData || classroom;
        if (!data || !data.participants) return;

        const creatorIds = (data.creator || []).map(c => c._id || c);
        const studentScores = data.studentScores || {};
        const students = data.participants.filter(p => !creatorIds.includes(p._id));

        const allCategories = new Set();
        Object.values(studentScores).forEach(scoreRecord => {
            Object.keys(scoreRecord).forEach(category => allCategories.add(category));
        });
        const categories = Array.from(allCategories).sort();
        setScoreCategories(categories);

        const scoresData = students.map(student => {
            const studentScoreRecord = studentScores[student._id] || {};
            let totalScore = 0;
            const categorizedScores = {};
            categories.forEach(category => {
                const score = studentScoreRecord[category] || 0;
                categorizedScores[category] = score;
                totalScore += score;
            });
            return { student, totalScore, categorizedScores };
        });
        setScoresTable(scoresData);
    };

    // ─── Compute score stats ───
    useEffect(() => {
        if (scoresTable.length > 0) {
            const totalStudents = scoresTable.length;
            const overallTotalScores = scoresTable.map(s => s.totalScore);
            const overallAverage = overallTotalScores.reduce((sum, score) => sum + score, 0) / totalStudents;
            const highestScore = Math.max(...overallTotalScores);
            const lowestScore = Math.min(...overallTotalScores);

            const categoryAverages = {};
            scoreCategories.forEach(category => {
                const categoryScores = scoresTable.map(s => s.categorizedScores[category] || 0);
                const sum = categoryScores.reduce((s, score) => s + score, 0);
                categoryAverages[category] = sum / totalStudents;
            });

            setScoreStats({ totalStudents, overallAverage: overallAverage.toFixed(2), highestScore, lowestScore, categoryAverages });
        } else {
            setScoreStats(null);
        }
    }, [scoresTable, scoreCategories]);

    // ─── Re-process scoreboard when classroom prop changes ───
    useEffect(() => {
        if (classroom) {
            processScoreboardData(classroom);
        }
    }, [classroom]);

    const processClassroomData = (classroomData) => {
        if (!classroomData) {
            return {
                totalStudents: 0,
                totalEvents: 0,
                studentData: [],
                statistics: { mean: 0, stdDev: 0, median: 0, min: 0, max: 0, topQuartile: 0, bottomQuartile: 0 },
                classMetrics: { avgAttendance: 0 }
            };
        }

        const creatorIds = (classroomData.creator || []).map(c => c._id || c.id || c);
        const allParticipants = classroomData.participants || [];
        const students = allParticipants.filter(p => !creatorIds.includes(p._id || p.id));
        const studentScores = classroomData.studentScores || {};
        const attendanceMap = classroomData.attendance || {};
        const attendanceDaysCount = classroomData.attendanceDays || 20;

        const studentData = students.map(student => {
            const studentId = student._id || student.id;
            const scores = studentScores[studentId] || {};
            const scoreValues = Object.values(scores).filter(score => score !== null && score !== undefined && typeof score === 'number' && !isNaN(score));
            const totalScore = scoreValues.reduce((sum, score) => sum + score, 0);
            const avgScore = scoreValues.length > 0 ? totalScore / scoreValues.length : 0;
            const highestScore = scoreValues.length > 0 ? Math.max(...scoreValues) : 0;
            const lowestScore = scoreValues.length > 0 ? Math.min(...scoreValues) : 0;
            const scoreVariance = scoreValues.length > 1 ? scoreValues.reduce((sum, score) => sum + Math.pow(score - avgScore, 2), 0) / (scoreValues.length - 1) : 0;
            const consistency = scoreValues.length > 1 ? Math.sqrt(scoreVariance) : 0;

            const studentRecord = attendanceMap[studentId] || {};
            let presentCount = 0;
            let trackedCount = 0;

            for (let i = 1; i <= attendanceDaysCount; i++) {
                const state = studentRecord[i] || 'none';
                if (state !== 'none') {
                    trackedCount++;
                    if (state === 'present' || state === 'late') {
                        presentCount++;
                    }
                }
            }

            const attendanceRate = trackedCount > 0 ? presentCount / trackedCount : 0;
            const attendedEvents = presentCount;
            const totalEvents = trackedCount;

            return {
                id: student._id || student.id,
                name: student.displayName || 'Unknown',
                photoURL: student.photoURL,
                user: student,
                avgScore, totalScore, highestScore, lowestScore, consistency,
                attendanceRate, attendedEvents, totalEvents,
                combinedScore: totalScore,
                group: student.group || 'A',
                grade: calculateGrade(totalScore),
                performanceLevel: getPerformanceLevel(totalScore)
            };
        });

        const scores = studentData.map(s => s.combinedScore);
        const mean = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
        const stdDev = scores.length > 1 ? Math.sqrt(scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / scores.length) : 0;

        studentData.forEach(student => {
            const zScore = stdDev > 0 ? (student.combinedScore - mean) / stdDev : 0;
            student.zScore = isNaN(zScore) ? 0 : zScore;
            if (zScore >= 1.5) student.grade = 'A+';
            else if (zScore >= 1) student.grade = 'A';
            else if (zScore >= 0.5) student.grade = 'B+';
            else if (zScore >= 0) student.grade = 'B';
            else if (zScore >= -0.5) student.grade = 'C+';
            else if (zScore >= -1) student.grade = 'C';
            else if (zScore >= -1.5) student.grade = 'D';
            else student.grade = 'F';
            const pct = calculatePercentile(student.combinedScore, scores);
            student.percentile = isNaN(pct) ? 0 : pct;
        });

        studentData.sort((a, b) => b.combinedScore - a.combinedScore);

        return {
            totalStudents: students.length,
            totalEvents: attendanceDaysCount,
            studentData,
            statistics: {
                mean: isNaN(mean) ? 0 : mean,
                stdDev: isNaN(stdDev) ? 0 : stdDev,
                median: calculateMedian(scores),
                min: scores.length > 0 ? Math.min(...scores) : 0,
                max: scores.length > 0 ? Math.max(...scores) : 0,
                topQuartile: calculateQuartile(scores, 0.75),
                bottomQuartile: calculateQuartile(scores, 0.25)
            },
            classMetrics: {
                avgAttendance: studentData.length > 0 ? studentData.reduce((sum, s) => sum + s.attendanceRate, 0) / studentData.length : 0,
            }
        };
    };

    const calculatePercentile = (score, allScores) => {
        if (allScores.length === 0) return 0;
        const below = allScores.filter(s => s < score).length;
        const equal = allScores.filter(s => s === score).length;
        return ((below + (0.5 * equal)) / allScores.length) * 100;
    };
    const calculateGrade = (score) => { if (score >= 85) return 'A'; if (score >= 75) return 'B'; if (score >= 65) return 'C'; if (score >= 55) return 'D'; return 'F'; };
    const getPerformanceLevel = (score) => { if (score >= 85) return 'Excellent'; if (score >= 70) return 'Good'; if (score >= 55) return 'Average'; if (score >= 40) return 'Below Average'; return 'Needs Improvement'; };
    const calculateMedian = (scores) => { if (scores.length === 0) return 0; const sorted = [...scores].sort((a, b) => a - b); const mid = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2; };
    const calculateQuartile = (scores, quartile) => { if (scores.length === 0) return 0; const sorted = [...scores].sort((a, b) => a - b); const pos = (sorted.length - 1) * quartile; const base = Math.floor(pos); const rest = pos - base; if (sorted[base + 1] !== undefined) return sorted[base] + rest * (sorted[base + 1] - sorted[base]); return sorted[base]; };

    useEffect(() => {
        if (user && user.token && classId) fetchSummaryData();
    }, [classId, user]);

    // ─── Sync showStudentStatus and showScoreBar from classroom prop ───
    useEffect(() => {
        if (classroom) {
            setShowStudentStatus(classroom.showStudentStatus || false);
            setShowScoreBar(classroom.showScoreBar || false);
        }
    }, [classroom]);

    // ─── Toggle Student Status Handler ───
    const handleToggleStudentStatus = async () => {
        const newValue = !showStudentStatus;
        setShowStudentStatus(newValue);
        try {
            await axios.put(`${API_BASE_URL}/api/classrooms/${classId}/settings`, {
                showStudentStatus: newValue
            }, {
                headers: { 'x-auth-token': user.token }
            });
        } catch (err) {
            console.error('Failed to update student status setting:', err);
            setShowStudentStatus(!newValue); // Revert on error
        }
    };

    // ─── Toggle Score Bar Handler ───
    const handleToggleScoreBar = async () => {
        const newValue = !showScoreBar;
        setShowScoreBar(newValue);
        try {
            await axios.put(`${API_BASE_URL}/api/classrooms/${classId}/settings`, {
                showScoreBar: newValue
            }, {
                headers: { 'x-auth-token': user.token }
            });
        } catch (err) {
            console.error('Failed to update score bar setting:', err);
            setShowScoreBar(!newValue); // Revert on error
        }
    };

    // ─── Score Editing Handlers ───
    const handleCellClick = (studentId, category, currentScore) => {
        setEditingCell({ studentId, category });
        setTempScore(currentScore.toString());
    };
    const handleScoreChange = (e) => setTempScore(e.target.value);
    const handleSaveScore = () => {
        const { studentId, category } = editingCell;
        if (!studentId || !category) return;
        const newScoreValue = parseFloat(tempScore);
        if (isNaN(newScoreValue)) { setEditingCell({ studentId: null, category: null }); setTempScore(''); return; }
        setScoresTable(prev => prev.map(s => {
            if (s.student._id === studentId) {
                const updatedCategorizedScores = { ...s.categorizedScores, [category]: newScoreValue };
                const updatedTotalScore = Object.values(updatedCategorizedScores).reduce((sum, score) => sum + score, 0);
                return { ...s, categorizedScores: updatedCategorizedScores, totalScore: updatedTotalScore };
            }
            return s;
        }));
        if (onUpdateScores) onUpdateScores(studentId, category, newScoreValue);
        setEditingCell({ studentId: null, category: null });
        setTempScore('');
    };
    const handleKeyDown = (e) => { if (e.key === 'Enter') e.target.blur(); };

    // ─── Bell Curve Chart Data ───
    const chartData = useMemo(() => {
        if (!summaryData || summaryData.studentData.length === 0) return null;
        const mean = summaryData.statistics.mean;
        const stdDev = summaryData.statistics.stdDev > 0 ? summaryData.statistics.stdDev : 1;
        let minScore = Math.floor(mean - 3 * stdDev);
        let maxScore = Math.ceil(mean + 3 * stdDev);
        if (minScore < 0) minScore = 0;
        const actualMax = summaryData.statistics.max;
        if (actualMax > maxScore) maxScore = Math.ceil(actualMax + stdDev);
        const labels = [];
        const dataPDF = [];
        const step = Math.max(0.1, (maxScore - minScore) / 50);
        for (let x = minScore; x <= maxScore; x += step) {
            labels.push(x.toFixed(1));
            const exponent = Math.exp(-Math.pow(x - mean, 2) / (2 * Math.pow(stdDev, 2)));
            const pdf = (1 / (stdDev * Math.sqrt(2 * Math.PI))) * exponent;
            dataPDF.push(pdf);
        }
        const datasets = [{
            label: 'Class Distribution',
            data: dataPDF,
            borderColor: 'rgba(99, 102, 241, 1)',
            backgroundColor: 'rgba(99, 102, 241, 0.15)',
            borderWidth: 2.5, fill: true, pointRadius: 0, tension: 0.4,
        }];
        if (selectedStudentId !== 'overview') {
            const student = summaryData.studentData.find(s => s.id === selectedStudentId);
            if (student) {
                let closestIndex = 0; let minDiff = Infinity;
                labels.forEach((label, idx) => { const diff = Math.abs(parseFloat(label) - student.combinedScore); if (diff < minDiff) { minDiff = diff; closestIndex = idx; } });
                const studentDataPoints = Array(labels.length).fill(null);
                studentDataPoints[closestIndex] = dataPDF[closestIndex];
                datasets.push({
                    label: `${student.name} (${student.combinedScore.toFixed(1)} pts)`,
                    data: studentDataPoints,
                    borderColor: '#f43f5e', backgroundColor: '#f43f5e',
                    pointBackgroundColor: '#f43f5e', pointBorderColor: '#ffffff',
                    pointBorderWidth: 3, pointRadius: 7, pointHoverRadius: 9, showLine: false,
                });
            }
        }
        return { labels, datasets };
    }, [summaryData, selectedStudentId]);

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', labels: { font: { family: "'Inter', sans-serif", size: 12 }, usePointStyle: true, padding: 16 } },
            tooltip: { callbacks: { label: (ctx) => ctx.dataset.label.includes('Distribution') ? 'Probability Density' : ctx.dataset.label } }
        },
        scales: {
            x: { title: { display: true, text: 'Total Score', font: { size: 13, family: "'Inter', sans-serif", weight: '600' } }, grid: { display: false } },
            y: { display: false, beginAtZero: true }
        }
    };

    // ─── Loading / Error States ───
    if (loading) {
        return (
            <div className="bento-summary-container">
                <div className="bento-loading">
                    <div className="bento-loading-spinner"></div>
                    <p>{t('summary.loading') || 'Loading comprehensive analysis...'}</p>
                </div>
            </div>
        );
    }
    if (error) {
        return (
            <div className="bento-summary-container">
                <div className="bento-error">{error}</div>
            </div>
        );
    }

    const selectedStudent = selectedStudentId !== 'overview' ? summaryData?.studentData.find(s => s.id === selectedStudentId) : null;
    const studentRank = selectedStudent ? summaryData.studentData.findIndex(s => s.id === selectedStudent.id) + 1 : null;
    const topStudents = scoresTable.length > 0 ? [...scoresTable].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3) : [];

    // ─── RENDER ───
    return (
        <div className="bento-summary-container">
            {/* Hidden Formal Print Document */}
            {summaryData && (
                <SummaryPrintLayout 
                    classroom={classroom}
                    summaryData={summaryData}
                    scoreStats={scoreStats}
                    scoreCategories={scoreCategories}
                    scoresTable={scoresTable}
                    selectedStudent={selectedStudent}
                    studentRank={studentRank}
                />
            )}

            {/* ═══ Header ═══ */}
            <div className="bento-header">
                <div className="bento-header-left">
                    <div className="bento-header-icon"><SvgAward /></div>
                    <div>
                        <h1>{t('summary.title') || 'Class Summary'}</h1>
                        <p>{t('summary.subtitle') || 'Comprehensive performance analytics & scoreboard'}</p>
                    </div>
                </div>
                <div className="bento-header-right">
                    <div className="bento-select-container">
                        <div className={`bento-select-display ${isDropdownOpen ? 'open' : ''}`} onClick={() => setIsDropdownOpen(!isDropdownOpen)}>
                            {selectedStudentId === 'overview' ? (
                                <span className="bento-select-text">{t('summary.classOverview') || '📊 Class Overview'}</span>
                            ) : (() => {
                                const s = summaryData?.studentData.find(st => st.id === selectedStudentId);
                                return s ? (
                                    <div className="bento-select-student">
                                        <img referrerPolicy="no-referrer" src={getProfileImageSrc(s.photoURL, isGoogleUser(s.user))} alt={s.name} onError={handleImageError} />
                                        <span>{s.name}</span>
                                    </div>
                                ) : <span className="bento-select-text">{t('summary.select') || 'Select...'}</span>;
                            })()}
                            <svg className="bento-select-arrow" width="12" height="12" viewBox="0 0 12 12"><path d="M3 5l3 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
                        </div>
                        {isDropdownOpen && (
                            <div className="bento-select-dropdown">
                                <div className={`bento-select-option ${selectedStudentId === 'overview' ? 'active' : ''}`} onClick={() => { setSelectedStudentId('overview'); setIsDropdownOpen(false); }}>
                                    <span>{t('summary.classOverview') || '📊 Class Overview'}</span>
                                </div>
                                {summaryData?.studentData.map(student => (
                                    <div key={student.id} className={`bento-select-option ${selectedStudentId === student.id ? 'active' : ''}`} onClick={() => { setSelectedStudentId(student.id); setIsDropdownOpen(false); }}>
                                        <img referrerPolicy="no-referrer" src={getProfileImageSrc(student.photoURL, isGoogleUser(student.user))} alt={student.name} onError={handleImageError} />
                                        <span>{student.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="bento-header-divider"></div>

                    {isCreator && (
                        <div className="bento-status-toggle">
                            <label className="status-toggle-label">
                                <span className="status-toggle-text">
                                    <FiUser className="show-on-mobile icon-only" size={18} title={t('summary.showStudentStatus') || 'Show Student Status'} />
                                    <span className="hide-on-mobile">{t('summary.showStudentStatus') || 'Show Student Status'}</span>
                                </span>
                                <div className={`status-toggle-switch ${showStudentStatus ? 'active' : ''}`} onClick={handleToggleStudentStatus}>
                                    <div className="status-toggle-knob"></div>
                                </div>
                            </label>
                            
                            <label className="status-toggle-label">
                                <span className="status-toggle-text">
                                    <FiActivity className="show-on-mobile icon-only" size={18} title={t('summary.showScoreBar') || 'Show Score Bar'} />
                                    <span className="hide-on-mobile">{t('summary.showScoreBar') || 'Show Score Bar'}</span>
                                </span>
                                <div className={`status-toggle-switch ${showScoreBar ? 'active' : ''}`} onClick={handleToggleScoreBar}>
                                    <div className="status-toggle-knob"></div>
                                </div>
                            </label>
                        </div>
                    )}
                    
                    {/* Print PDF Button */}
                    <div className="bento-print-action">
                        <button 
                            className="bento-print-btn" 
                            onClick={() => window.print()}
                            title={t('summary.printPdf') || 'Export as PDF'}
                        >
                            <FiPrinter size={18} />
                            <span className="hide-on-mobile">{t('summary.printPdf') || 'Print PDF'}</span>
                        </button>
                    </div>
                </div>
            </div>

            {summaryData && (
                <div className={`bento-grid ${selectedStudentId !== 'overview' ? 'student-view' : ''}`}>

                    {/* ═══ Tile 1: Top Performers Podium ═══ */}
                    {selectedStudentId === 'overview' && topStudents.length > 0 && (
                        <div className="bento-tile bento-podium" style={{ '--delay': '0' }}>
                            <div className="bento-tile-header">
                                <SvgTrophy />
                                <h3>{t('summary.topPerformers') || 'Top Performers'}</h3>
                            </div>
                            <div className="podium-wrap">
                                {/* 2nd */}
                                {topStudents[1] && (
                                    <div className="podium-col second">
                                        <div className="podium-medal silver"><SvgMedal /></div>
                                        <img referrerPolicy="no-referrer" src={getProfileImageSrc(topStudents[1].student.photoURL, isGoogleUser(topStudents[1].student))} alt={topStudents[1].student.displayName} className="podium-img" />
                                        <div className="podium-bar">
                                            <span className="podium-rank-num">{t('summary.rank2nd') || '2nd'}</span>
                                        </div>
                                        <p className="podium-name">{topStudents[1].student.displayName}</p>
                                        <span className="podium-pts">{topStudents[1].totalScore} {t('summary.pts') || 'pts'}</span>
                                    </div>
                                )}
                                {/* 1st */}
                                {topStudents[0] && (
                                    <div className="podium-col first">
                                        <div className="podium-medal gold"><SvgCrown /></div>
                                        <img referrerPolicy="no-referrer" src={getProfileImageSrc(topStudents[0].student.photoURL, isGoogleUser(topStudents[0].student))} alt={topStudents[0].student.displayName} className="podium-img first-img" />
                                        <div className="podium-bar first-bar">
                                            <span className="podium-rank-num">{t('summary.rank1st') || '1st'}</span>
                                        </div>
                                        <p className="podium-name">{topStudents[0].student.displayName}</p>
                                        <span className="podium-pts">{topStudents[0].totalScore} {t('summary.pts') || 'pts'}</span>
                                    </div>
                                )}
                                {/* 3rd */}
                                {topStudents[2] && (
                                    <div className="podium-col third">
                                        <div className="podium-medal bronze"><SvgMedal /></div>
                                        <img referrerPolicy="no-referrer" src={getProfileImageSrc(topStudents[2].student.photoURL, isGoogleUser(topStudents[2].student))} alt={topStudents[2].student.displayName} className="podium-img" />
                                        <div className="podium-bar">
                                            <span className="podium-rank-num">{t('summary.rank3rd') || '3rd'}</span>
                                        </div>
                                        <p className="podium-name">{topStudents[2].student.displayName}</p>
                                        <span className="podium-pts">{topStudents[2].totalScore} {t('summary.pts') || 'pts'}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ═══ Tile: Student Profile (when selected) ═══ */}
                    {selectedStudent && (
                        <div className="bento-tile bento-profile" style={{ '--delay': '0' }}>
                            <div className="bento-tile-header">
                                <SvgTarget />
                                <h3>{t('summary.studentProfile') || 'Student Profile'}</h3>
                            </div>
                            <div className="profile-top">
                                <img referrerPolicy="no-referrer" src={getProfileImageSrc(selectedStudent.photoURL, isGoogleUser(selectedStudent.user))} alt={selectedStudent.name} onError={handleImageError} className="profile-avatar" />
                                <div className="profile-info">
                                    <h4>{selectedStudent.name}</h4>
                                    <span className="profile-group-badge">{t('summary.group', { group: selectedStudent.group || '-' }) || `Group ${selectedStudent.group || '-'}`}</span>
                                </div>
                            </div>
                            <div className="profile-metrics">
                                <div className="pm-item accent">
                                    <label>{t('summary.rank') || 'Rank'}</label>
                                    <span className="pm-val">#{studentRank || '-'} <small>/ {summaryData.totalStudents || 0}</small></span>
                                </div>
                                <div className="pm-item">
                                    <label>{t('summary.totalScore') || 'Total Score'}</label>
                                    <span className="pm-val">{(selectedStudent.combinedScore ?? 0).toFixed(1)}</span>
                                </div>
                                <div className="pm-item">
                                    <label>{t('summary.percentile') || 'Percentile'}</label>
                                    <span className="pm-val">{(selectedStudent.percentile ?? 0).toFixed(1)}%</span>
                                </div>
                                <div className="pm-item">
                                    <label>{t('summary.grade') || 'Grade'}</label>
                                    <span className={`pm-val pm-grade pm-grade-${(selectedStudent.grade || 'F').substring(0, 1).toLowerCase()}`}>{selectedStudent.grade || '-'}</span>
                                </div>
                                <div className="pm-item">
                                    <label>{t('summary.zScore') || 'Z-Score'}</label>
                                    <span className="pm-val">{(selectedStudent.zScore ?? 0) > 0 ? '+' : ''}{(selectedStudent.zScore ?? 0).toFixed(2)}</span>
                                </div>
                                <div className="pm-item">
                                    <label>{t('summary.attendance') || 'Attendance'}</label>
                                    <span className="pm-val">{((selectedStudent.attendanceRate ?? 0) * 100).toFixed(0)}%</span>
                                </div>
                            </div>
                            <div className="profile-analysis">
                                <h5>{t('summary.performanceAnalysis') || '📝 Performance Analysis'}</h5>
                                <p>
                                    {t('summary.analysisP1', { name: selectedStudent.name, percent: Math.max(1, 100 - Math.round(selectedStudent.percentile ?? 0)) }) || `${selectedStudent.name} is performing in the Top ${Math.max(1, 100 - Math.round(selectedStudent.percentile ?? 0))}% of the class.`}
                                    {' '}
                                    {t('summary.analysisP2', { score: (selectedStudent.combinedScore ?? 0).toFixed(1), sd: Math.abs(selectedStudent.zScore ?? 0).toFixed(2), direction: (selectedStudent.zScore ?? 0) >= 0 ? t('summary.above') : t('summary.below') }) || `With a total score of ${(selectedStudent.combinedScore ?? 0).toFixed(1)}, they are ${Math.abs(selectedStudent.zScore ?? 0).toFixed(2)} standard deviations ${(selectedStudent.zScore ?? 0) >= 0 ? 'above' : 'below'} the class average.`}
                                    {' '}
                                    {t('summary.analysisP3', { rate: ((selectedStudent.attendanceRate ?? 0) * 100).toFixed(0) }) || `Their attendance rate is ${((selectedStudent.attendanceRate ?? 0) * 100).toFixed(0)}%.`}
                                </p>
                            </div>
                        </div>
                    )}

                    {/* ═══ Tile 2: Stats Cards ═══ */}
                    {selectedStudentId === 'overview' && (
                        <div className="bento-tile bento-stats-grid" style={{ '--delay': '1' }}>
                            <div className="bento-tile-header">
                                <SvgBarChart />
                                <h3>{t('summary.classStats') || 'Class Statistics'}</h3>
                            </div>
                            <div className="stats-mini-grid">
                                <div className="stat-mini students">
                                    <div className="stat-mini-icon"><SvgUsers /></div>
                                    <div><h4>{t('summary.totalStudents') || 'Total Students'}</h4><p>{summaryData?.totalStudents ?? 0}</p></div>
                                </div>
                                <div className="stat-mini average">
                                    <div className="stat-mini-icon"><SvgTrendUp /></div>
                                    <div><h4>{t('summary.classAverage') || 'Class Average (μ)'}</h4><p>{(summaryData?.statistics?.mean ?? 0).toFixed(2)}</p></div>
                                </div>
                                <div className="stat-mini highest">
                                    <div className="stat-mini-icon"><SvgStar /></div>
                                    <div><h4>{t('summary.highestScore') || 'Highest Score'}</h4><p>{(summaryData?.statistics?.max ?? 0).toFixed(2)}</p></div>
                                </div>
                                <div className="stat-mini lowest">
                                    <div className="stat-mini-icon"><SvgBarChart /></div>
                                    <div><h4>{t('summary.lowestScore') || 'Lowest Score'}</h4><p>{(summaryData?.statistics?.min ?? 0).toFixed(2)}</p></div>
                                </div>
                                <div className="stat-mini median">
                                    <div className="stat-mini-icon"><SvgTarget /></div>
                                    <div><h4>{t('summary.median') || 'Median'}</h4><p>{(summaryData?.statistics?.median ?? 0).toFixed(2)}</p></div>
                                </div>
                                <div className="stat-mini stddev">
                                    <div className="stat-mini-icon"><SvgBellCurve /></div>
                                    <div><h4>{t('summary.stdDev') || 'Std Dev (σ)'}</h4><p>{(summaryData?.statistics?.stdDev ?? 0).toFixed(2)}</p></div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ═══ Tile 3: Bell Curve ═══ */}
                    <div className={`bento-tile bento-chart ${(!scoreStats || Object.keys(scoreStats.categoryAverages || {}).length === 0) ? 'full-width' : ''}`} style={{ '--delay': '2' }}>
                        <div className="bento-tile-header">
                            <SvgBellCurve />
                            <h3>{t('summary.bellCurve') || 'Normal Distribution (Bell Curve)'}</h3>
                        </div>
                        <div className="bento-chart-wrap">
                            {chartData ? (
                                <Line data={chartData} options={chartOptions} />
                            ) : (
                                <div className="bento-no-data">{t('summary.insufficientData') || 'Insufficient data to generate curve'}</div>
                            )}
                        </div>
                        <div className="bento-chart-note">
                            <p>
                                {t('summary.distributionPeak', { mean: (summaryData?.statistics?.mean ?? 0).toFixed(1) }) || `Distribution peaks at the class average (${(summaryData?.statistics?.mean ?? 0).toFixed(1)}).`}
                                {selectedStudent && <span className="bento-highlight-dot"> {t('summary.redDotIndicates', { name: selectedStudent.name }) || `The red dot indicates ${selectedStudent.name}'s position.`}</span>}
                            </p>
                        </div>
                    </div>

                    {/* ═══ Tile 4: Category Breakdown ═══ */}
                    {scoreStats && Object.keys(scoreStats.categoryAverages).length > 0 && (
                        <div className="bento-tile bento-categories" style={{ '--delay': '3' }}>
                            <div className="bento-tile-header">
                                <SvgBarChart />
                                <h3>{t('summary.categoryBreakdown') || 'Category Breakdown'}</h3>
                            </div>
                            <div className="category-bars">
                                {Object.entries(scoreStats.categoryAverages).map(([category, average]) => {
                                    const absAverage = Math.abs(average);
                                    const maxAbsAverage = Math.max(...Object.values(scoreStats.categoryAverages).map(Math.abs), 1);
                                    const widthPercentage = (absAverage / maxAbsAverage) * 100;
                                    const isNegative = average < 0;
                                    return (
                                        <div className="cat-bar-item" key={category}>
                                            <div className="cat-bar-label">
                                                <span>{category}</span>
                                                <span className={`cat-bar-val ${isNegative ? 'neg' : 'pos'}`}>{average.toFixed(1)}</span>
                                            </div>
                                            <div className="cat-bar-track">
                                                <div className={`cat-bar-fill ${isNegative ? 'neg' : 'pos'}`} style={{ width: `${widthPercentage}%` }}></div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* ═══ Tile 5: Editable Score Table ═══ */}
                    {scoresTable.length > 0 && (
                        <div className="bento-tile bento-score-table" style={{ '--delay': '4' }}>
                            <div className="bento-tile-header">
                                <SvgEdit />
                                <h3>{t('summary.tableTitle') || 'Detailed Scores'}</h3>
                                <span className="bento-tile-badge">{t('summary.clickToEdit') || 'Click to edit'}</span>
                            </div>
                            <div className="bento-table-scroll">
                                <table className="bento-table">
                                    <thead>
                                        <tr>
                                            <th>{t('summary.rankHeader') || 'Rank'}</th>
                                            <th>{t('summary.studentHeader') || 'Student'}</th>
                                            {scoreCategories.map(cat => <th key={cat}>{cat}</th>)}
                                            <th>{t('summary.totalHeader') || 'Total'}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...scoresTable].sort((a, b) => b.totalScore - a.totalScore).map((score, index) => (
                                            <tr key={score.student._id} className={index < 3 ? `top-rank-row rank-${index + 1}` : ''}>
                                                <td>
                                                    <span className={`bento-rank-badge ${index < 3 ? `rank-${index + 1}` : ''}`}>{index + 1}</span>
                                                </td>
                                                <td>
                                                    <div className="bento-student-cell">
                                                        <img referrerPolicy="no-referrer" src={getProfileImageSrc(score.student.photoURL, isGoogleUser(score.student))} alt={score.student.displayName} />
                                                        <span>{score.student.displayName}</span>
                                                        {index === 0 && <span className="bento-crown-inline"><SvgCrown /></span>}
                                                    </div>
                                                </td>
                                                {scoreCategories.map(category => (
                                                    <td key={category} onClick={() => handleCellClick(score.student._id, category, score.categorizedScores[category] || 0)} className="bento-score-cell">
                                                        {editingCell.studentId === score.student._id && editingCell.category === category ? (
                                                            <input type="number" value={tempScore} onChange={handleScoreChange} onBlur={handleSaveScore} onKeyDown={handleKeyDown} autoFocus className="bento-score-input" />
                                                        ) : (
                                                            <span className={`bento-score-val ${(score.categorizedScores[category] || 0) > 0 ? 'positive' : (score.categorizedScores[category] || 0) < 0 ? 'negative' : 'zero'}`}>
                                                                {score.categorizedScores[category] || 0}
                                                            </span>
                                                        )}
                                                    </td>
                                                ))}
                                                <td className="bento-total-cell">{score.totalScore}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* ═══ Tile 6: Full Class Rankings ═══ */}
                    {selectedStudentId === 'overview' && (
                        <div className="bento-tile bento-rankings" style={{ '--delay': '5' }}>
                            <div className="bento-tile-header">
                                <SvgAward />
                                <h3>{t('summary.classRankings') || 'Class Rankings'}</h3>
                            </div>
                            {(!summaryData?.studentData || summaryData.studentData.length === 0) ? (
                                <div className="bento-no-data" style={{ padding: '40px 20px' }}>
                                    {t('summary.noStudentsYet') || 'No students enrolled in this classroom yet.'}
                                </div>
                            ) : (
                                <div className="bento-table-scroll">
                                    <table className="bento-table bento-ranking-table">
                                        <thead>
                                            <tr>
                                                <th>{t('summary.rankHeader') || 'Rank'}</th>
                                                <th>{t('summary.studentHeader') || 'Student'}</th>
                                                <th>{t('summary.groupHeader') || 'Group'}</th>
                                                <th>{t('summary.totalScore') || 'Total Score'}</th>
                                                <th>{t('summary.zScoreHeader') || 'Z-Score'}</th>
                                                <th>{t('summary.percentileHeader') || 'Percentile'}</th>
                                                <th>{t('summary.gradeHeader') || 'Grade'}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summaryData.studentData.map((student, idx) => (
                                                <tr key={student.id || idx}>
                                                    <td><span className={`bento-rank-badge ${idx < 3 ? `rank-${idx + 1}` : ''}`}>{idx + 1}</span></td>
                                                    <td>
                                                        <div className="bento-student-cell">
                                                            <img referrerPolicy="no-referrer" src={getProfileImageSrc(student.photoURL, isGoogleUser(student.user))} alt={student.name} onError={handleImageError} />
                                                            <span>{student.name}</span>
                                                        </div>
                                                    </td>
                                                    <td>{student.group || '-'}</td>
                                                    <td><strong>{(student.combinedScore ?? 0).toFixed(1)}</strong></td>
                                                    <td>{(student.zScore ?? 0) > 0 ? '+' : ''}{(student.zScore ?? 0).toFixed(2)}</td>
                                                    <td>{(student.percentile ?? 0).toFixed(1)}%</td>
                                                    <td><span className={`bento-grade bento-grade-${(student.grade || 'F').substring(0, 1).toLowerCase()}`}>{student.grade || '-'}</span></td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default Summary;

