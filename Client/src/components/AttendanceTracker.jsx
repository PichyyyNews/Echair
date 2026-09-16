import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { getProfileImageSrc, isGoogleUser, handleImageError } from '../utils/profileImageHelper';
import Swal from 'sweetalert2';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { FaCalendarCheck } from 'react-icons/fa';
import { useTranslation } from 'react-i18next';
import '../CSS/AttendanceTracker.css';
import API_BASE_URL from '../config/api';

ChartJS.register(ArcElement, Tooltip, Legend);

const AttendanceTracker = ({ classroom, user }) => {
    const { t } = useTranslation();
    const isCreator = classroom?.creator?.some(c => c === user.id || c._id === user.id || c.toString() === user.id);
    const [attendance, setAttendance] = useState(classroom?.attendance || {});
    const [attendanceDays, setAttendanceDays] = useState(classroom?.attendanceDays || 20);
    const [isSaving, setIsSaving] = useState(false);
    const [activeTab, setActiveTab] = useState('tracking'); // 'tracking' or 'summary'

    useEffect(() => {
        if (classroom) {
            setAttendance(classroom.attendance || {});
            setAttendanceDays(classroom.attendanceDays || 20);
        }
    }, [classroom]);

    const handleAddDay = () => {
        if (!isCreator) return;
        setAttendanceDays(prev => prev + 1);
        saveAttendanceToDb(attendance, attendanceDays + 1);
    };

    const handleRemoveDay = () => {
        if (!isCreator) return;
        if (attendanceDays > 1) {
            setAttendanceDays(prev => prev - 1);
            saveAttendanceToDb(attendance, attendanceDays - 1);
        }
    };

    const cycleAttendanceState = (studentId, dayIndex) => {
        if (!isCreator) return;

        const currentState = attendance[studentId]?.[dayIndex] || 'none';
        let nextState;
        
        switch (currentState) {
            case 'none': nextState = 'present'; break;
            case 'present': nextState = 'absent'; break;
            case 'absent': nextState = 'late'; break;
            case 'late': nextState = 'leave'; break;
            case 'leave': nextState = 'none'; break;
            default: nextState = 'none';
        }

        const newAttendance = {
            ...attendance,
            [studentId]: {
                ...(attendance[studentId] || {}),
                [dayIndex]: nextState
            }
        };

        setAttendance(newAttendance);
        saveAttendanceToDb(newAttendance, attendanceDays);
    };

    const markAllPresent = (dayIndex) => {
        if (!isCreator) return;

        const newAttendance = { ...attendance };
        participants.forEach(student => {
            if (!newAttendance[student._id]) {
                newAttendance[student._id] = {};
            }
            newAttendance[student._id][dayIndex] = 'present';
        });

        setAttendance(newAttendance);
        saveAttendanceToDb(newAttendance, attendanceDays);
    };

    const saveAttendanceToDb = async (newAttendance, newDays) => {
        if (!isCreator) return;
        setIsSaving(true);
        console.log(`[DEBUG] saving attendance to: ${API_BASE_URL}/api/classrooms/${classroom._id}/attendance`);
        try {
            const response = await axios.put(`${API_BASE_URL}/api/classrooms/${classroom._id}/attendance`, {
                attendance: newAttendance,
                attendanceDays: newDays
            }, {
                headers: { 'x-auth-token': user.token }
            });
            console.log('[DEBUG] save attendance response:', response.data);
        } catch (error) {
            console.error('Error saving attendance:', error);
            if (error.response) {
                console.error('[DEBUG] Save error response data:', error.response.data);
                console.error('[DEBUG] Save error status:', error.response.status);
            }
            Swal.fire({
                icon: 'error',
                title: t('common.error') || 'Error',
                text: t('attendanceTracker.errorSave') || 'Failed to save attendance.',
                toast: true,
                position: 'top-end',
                showConfirmButton: false,
                timer: 3000
            });
        } finally {
            setIsSaving(false);
        }
    };

    const renderCellContent = (state) => {
        switch (state) {
            case 'present': return <span className="att-present" title={t('attendanceTracker.present') || "Present"}>/</span>;
            case 'absent': return <span className="att-absent" title={t('attendanceTracker.absent') || "Absent"}>X</span>;
            case 'late': return <span className="att-late" title={t('attendanceTracker.late') || "Late"}>L</span>;
            case 'leave': return <span className="att-leave" title={t('attendanceTracker.leave') || "Leave"}>V</span>;
            default: return null;
        }
    };

    if (!classroom) return <div>{t('attendanceTracker.loading') || 'Loading...'}</div>;

    const participants = (classroom.participants || []).filter(p => {
        const pId = p._id || p.id || p.toString();
        return !classroom.creator?.some(c => {
            const cId = c._id || c.id || c.toString();
            return cId === pId;
        });
    });
    const daysArray = Array.from({ length: attendanceDays }, (_, i) => i + 1);

    // --- Summary Calculations ---
    const studentStats = participants.map(student => {
        const studentRecord = attendance[student._id] || {};
        const stats = { present: 0, absent: 0, late: 0, leave: 0, none: 0, totalTracked: 0 };
        
        for (let i = 1; i <= attendanceDays; i++) {
            const state = studentRecord[i] || 'none';
            stats[state]++;
            if (state !== 'none') stats.totalTracked++;
        }
        
        // Calculate percentage of positive attendance (Present + Late / Total Tracked)
        // Adjust formula as per specific school rules if Late counts differently
        const attendedDays = stats.present + stats.late;
        const percentage = stats.totalTracked > 0 
            ? Math.round((attendedDays / stats.totalTracked) * 100) 
            : 0;

        return { ...student, stats, percentage };
    });

    // Global Stats for Chart
    const globalStats = { present: 0, absent: 0, late: 0, leave: 0 };
    studentStats.forEach(s => {
        globalStats.present += s.stats.present;
        globalStats.absent += s.stats.absent;
        globalStats.late += s.stats.late;
        globalStats.leave += s.stats.leave;
    });

    const chartData = {
        labels: [t('attendanceTracker.present') || 'Present', t('attendanceTracker.absent') || 'Absent', t('attendanceTracker.late') || 'Late', t('attendanceTracker.leave') || 'Leave'],
        datasets: [
            {
                data: [globalStats.present, globalStats.absent, globalStats.late, globalStats.leave],
                backgroundColor: [
                    '#16a34a', // green
                    '#dc2626', // red
                    '#ca8a04', // yellow
                    '#2563eb', // blue
                ],
                hoverBackgroundColor: [
                    '#15803d',
                    '#b91c1c',
                    '#a16207',
                    '#1d4ed8',
                ],
                borderWidth: 1,
            },
        ],
    };

    return (
        <div className="attendance-tracker-container">
            <div className="attendance-header">
                <div className="attendance-header-left">
                    <div className="attendance-header-icon">
                        <FaCalendarCheck size={20} />
                    </div>
                    <div>
                        <h2>{t('attendanceTracker.title') || 'Attendance'}</h2>
                        <p>{t('attendanceTracker.studentsEnrolled', { count: participants.length, s: participants.length !== 1 ? 's' : '' }) || `${participants.length} student${participants.length !== 1 ? 's' : ''} enrolled`}</p>
                    </div>
                </div>
                
                <div className="attendance-tabs">
                    <button 
                        className={`tab-btn ${activeTab === 'tracking' ? 'active' : ''}`}
                        onClick={() => setActiveTab('tracking')}
                    >
                        {t('attendanceTracker.tabTracking') || 'Tracking'}
                    </button>
                    <button 
                        className={`tab-btn ${activeTab === 'summary' ? 'active' : ''}`}
                        onClick={() => setActiveTab('summary')}
                    >
                        {t('attendanceTracker.tabSummary') || 'Summary'}
                    </button>
                </div>

                {isCreator && activeTab === 'tracking' && (
                    <div className="attendance-controls">
                        <button className="btn outline" onClick={handleRemoveDay} disabled={attendanceDays <= 1 || isSaving}>
                            {t('attendanceTracker.btnReduceDay') || '- Reduce Day'}
                        </button>
                        <span className="days-label">{t('attendanceTracker.lblDays', { days: attendanceDays }) || `Days: ${attendanceDays}`}</span>
                        <button className="btn outline" onClick={handleAddDay} disabled={isSaving}>
                            {t('attendanceTracker.btnAddDay') || '+ Add Day'}
                        </button>
                        {isSaving && <span className="saving-indicator">{t('attendanceTracker.saving') || 'Saving...'}</span>}
                    </div>
                )}
            </div>

            {activeTab === 'tracking' ? (
                <>
                    <div className="attendance-table-wrapper">
                        <table className="attendance-table">
                            <thead>
                                <tr>
                                    <th className="sticky-col name-col">{t('attendanceTracker.colStudent') || 'Student'}</th>
                                    {daysArray.map(day => (
                                        <th 
                                            key={`header-day-${day}`} 
                                            className={`day-col ${isCreator ? 'clickable-header' : ''}`}
                                            onClick={() => isCreator && markAllPresent(day)}
                                            title={isCreator ? (t('attendanceTracker.markAllPresent') || "Mark all as present") : ""}
                                        >
                                            D{day}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {participants.length === 0 ? (
                                    <tr>
                                        <td colSpan={attendanceDays + 1} className="no-data">{t('attendanceTracker.noStudentsTable') || 'No students in this classroom yet.'}</td>
                                    </tr>
                                ) : (
                                    participants.map(student => (
                                        <tr key={student._id}>
                                            <td className="sticky-col name-col">
                                                <div className="student-info">
                                                    <img referrerPolicy="no-referrer" 
                                                        src={getProfileImageSrc(student.photoURL, isGoogleUser(student))} 
                                                        alt={student.displayName}
                                                        onError={handleImageError}
                                                        className="student-avatar"
                                                    />
                                                    <span className="student-name">{student.displayName}</span>
                                                </div>
                                            </td>
                                            {daysArray.map(day => (
                                                <td 
                                                    key={`cell-${student._id}-${day}`}
                                                    className={`day-cell ${isCreator ? 'clickable' : ''} ${attendance[student._id]?.[day] || 'none'}`}
                                                    onClick={() => cycleAttendanceState(student._id, day)}
                                                >
                                                    {renderCellContent(attendance[student._id]?.[day])}
                                                </td>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    
                    <div className="attendance-legend">
                        <div className="legend-item"><span className="legend-icon present">/</span> {t('attendanceTracker.present') || 'Present'}</div>
                        <div className="legend-item"><span className="legend-icon absent">X</span> {t('attendanceTracker.absent') || 'Absent'}</div>
                        <div className="legend-item"><span className="legend-icon late">L</span> {t('attendanceTracker.late') || 'Late'}</div>
                        <div className="legend-item"><span className="legend-icon leave">V</span> {t('attendanceTracker.leave') || 'Leave'}</div>
                        <div className="legend-item"><span className="legend-icon empty"></span> {t('attendanceTracker.none') || 'None'}</div>
                    </div>
                </>
            ) : (
                <div className="attendance-summary-view">
                    <div className="summary-layout">
                        <div className="summary-table-container">
                            <h3>{t('attendanceTracker.individualSummary') || 'Individual Summary'}</h3>
                            <div className="summary-table-wrapper">
                                <table className="summary-table">
                                    <thead>
                                        <tr>
                                            <th>{t('attendanceTracker.colStudent') || 'Student'}</th>
                                            <th className="att-present">{t('attendanceTracker.present') || 'Present'}</th>
                                            <th className="att-absent">{t('attendanceTracker.absent') || 'Absent'}</th>
                                            <th className="att-late">{t('attendanceTracker.late') || 'Late'}</th>
                                            <th className="att-leave">{t('attendanceTracker.leave') || 'Leave'}</th>
                                            <th>%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {studentStats.map(student => (
                                            <tr key={student._id}>
                                                <td className="student-info">
                                                    <img referrerPolicy="no-referrer" 
                                                        src={getProfileImageSrc(student.photoURL, isGoogleUser(student))} 
                                                        alt={student.displayName}
                                                        onError={handleImageError}
                                                        className="student-avatar"
                                                    />
                                                    <span className="student-name">{student.displayName}</span>
                                                </td>
                                                <td className="stat-num">{student.stats.present}</td>
                                                <td className="stat-num">{student.stats.absent}</td>
                                                <td className="stat-num">{student.stats.late}</td>
                                                <td className="stat-num">{student.stats.leave}</td>
                                                <td className="stat-num bold">
                                                    <span className={student.percentage >= 80 ? 'high-score' : student.percentage >= 50 ? 'mid-score' : 'low-score'}>
                                                        {student.percentage}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                        {studentStats.length === 0 && (
                                            <tr>
                                                <td colSpan="6" className="no-data">{t('attendanceTracker.noStudentsSummary') || 'No students to summarize.'}</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="summary-chart-container">
                            <h3>{t('attendanceTracker.classStats') || 'Class Statistics'}</h3>
                            {globalStats.present === 0 && globalStats.absent === 0 && globalStats.late === 0 && globalStats.leave === 0 ? (
                                <div className="no-chart-data">{t('attendanceTracker.noChartData') || 'No attendance data recorded yet.'}</div>
                            ) : (
                                <div className="chart-wrapper">
                                    <Doughnut 
                                        data={chartData} 
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: {
                                                    position: 'bottom',
                                                }
                                            }
                                        }} 
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AttendanceTracker;

