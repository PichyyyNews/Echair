import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { FaClipboardCheck, FaTrophy, FaStar, FaChartBar, FaBullseye, FaArrowUp, FaArrowDown } from 'react-icons/fa';
import '../CSS/StudentStatusBanner.css';

const StudentStatusBanner = ({ classroom, user }) => {
    const { i18n } = useTranslation();
    const isThai = (i18n?.language || '').startsWith('th');

    const performanceData = useMemo(() => {
        if (!classroom || !user) return null;

        const creatorIds = (classroom.creator || []).map(c => c._id || c.id || c.toString());
        const participants = (classroom.participants || []).filter(p => {
            const pId = p._id || p.id || p.toString();
            return !creatorIds.includes(pId);
        });

        const currentUserId = user.id || user._id;

        // ─── 1. Attendance Calculation ───
        const attendance = classroom.attendance || {};
        const attendanceDays = classroom.attendanceDays || 20;
        const userRecord = attendance[currentUserId] || {};

        let present = 0, absent = 0, late = 0, leave = 0, totalTracked = 0;
        for (let i = 1; i <= attendanceDays; i++) {
            const state = userRecord[i] || 'none';
            if (state === 'present') present++;
            else if (state === 'absent') absent++;
            else if (state === 'late') late++;
            else if (state === 'leave') leave++;
            if (state !== 'none') totalTracked++;
        }
        const attendedDays = present + late;
        const attendancePercent = totalTracked > 0
            ? Math.round((attendedDays / totalTracked) * 100)
            : null;

        // ─── 2. Score & Rank Calculation ───
        const studentScores = classroom.studentScores || {};

        const allScores = participants.map(p => {
            const pId = p._id || p.id;
            const scoreRecord = studentScores[pId] || {};
            return {
                id: pId,
                total: Object.values(scoreRecord).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0)
            };
        }).sort((a, b) => b.total - a.total);

        const myScoreObj = allScores.find(s => s.id === currentUserId);
        const myTotal = myScoreObj ? myScoreObj.total : 0;
        const myRank = myScoreObj ? allScores.indexOf(myScoreObj) + 1 : null;
        const totalStudents = allScores.length;

        // ─── 3. Class Average Calculation ───
        const avgScore = totalStudents > 0
            ? allScores.reduce((sum, s) => sum + s.total, 0) / totalStudents
            : 0;
        const roundedAvg = Math.round(avgScore * 10) / 10;
        const diffFromAvg = Math.round((myTotal - avgScore) * 10) / 10;

        // ─── 4. Top Percentile (only shown when meaningful, totalStudents >= 3) ───
        const topPercent = (totalStudents >= 3 && myRank)
            ? Math.max(1, Math.round((myRank / totalStudents) * 100))
            : null;

        const hasScoreData = allScores.some(s => s.total > 0);

        return {
            attendancePercent,
            myRank,
            totalStudents,
            myTotal,
            avgScore: roundedAvg,
            diffFromAvg,
            topPercent,
            hasScoreData,
            hasAttendanceData: totalTracked > 0
        };
    }, [classroom, user]);

    if (!performanceData) return null;

    const {
        attendancePercent,
        myRank,
        totalStudents,
        myTotal,
        avgScore,
        diffFromAvg,
        topPercent,
        hasScoreData,
        hasAttendanceData
    } = performanceData;

    // Attendance badge color
    const getAttendanceColor = (pct) => {
        if (pct >= 80) return '#16a34a';
        if (pct >= 60) return '#d97706';
        return '#dc2626';
    };

    return (
        <div className="student-status-banner">
            <div className="status-banner-inner">
                {/* 1. Attendance Chip */}
                {hasAttendanceData && attendancePercent !== null && (
                    <div className="status-chip chip-attendance">
                        <span className="chip-icon"><FaClipboardCheck color="#8b5cf6" /></span>
                        <span className="chip-label">{isThai ? 'เข้าเรียน' : 'Attendance'}</span>
                        <span
                            className="chip-value"
                            style={{ color: getAttendanceColor(attendancePercent) }}
                        >
                            {attendancePercent}%
                        </span>
                    </div>
                )}

                {/* 2. Total Score Chip */}
                {hasScoreData && (
                    <div className="status-chip chip-score">
                        <span className="chip-icon"><FaStar color="#f59e0b" /></span>
                        <span className="chip-label">{isThai ? 'คะแนน' : 'Score'}</span>
                        <span className="chip-value">{myTotal}</span>
                    </div>
                )}

                {/* 3. Rank Chip */}
                {hasScoreData && myRank && (
                    <div className="status-chip chip-rank">
                        <span className="chip-icon"><FaTrophy color="#eab308" /></span>
                        <span className="chip-label">{isThai ? 'อันดับ' : 'Rank'}</span>
                        <span className="chip-value">
                            #{myRank}{totalStudents > 1 ? `/${totalStudents}` : ''}
                        </span>
                    </div>
                )}

                {/* 4. Class Average Chip (Only shown when there are multiple students) */}
                {hasScoreData && totalStudents > 1 && (
                    <div className="status-chip chip-average">
                        <span className="chip-icon"><FaChartBar color="#0284c7" /></span>
                        <span className="chip-label">{isThai ? 'เฉลี่ยห้อง' : 'Class Avg'}</span>
                        <span className="chip-value">{avgScore}</span>
                        {diffFromAvg > 0 && (
                            <span className="chip-diff diff-positive" title={`+${diffFromAvg} ${isThai ? 'สูงกว่าค่าเฉลี่ย' : 'above average'}`}>
                                <FaArrowUp size={9} />+{diffFromAvg}
                            </span>
                        )}
                        {diffFromAvg < 0 && (
                            <span className="chip-diff diff-negative" title={`${diffFromAvg} ${isThai ? 'ต่ำกว่าค่าเฉลี่ย' : 'below average'}`}>
                                <FaArrowDown size={9} />{Math.abs(diffFromAvg)}
                            </span>
                        )}
                    </div>
                )}

                {/* 5. Top Percentile Chip (Only shown if top 50% in a class of 3+ students) */}
                {hasScoreData && topPercent !== null && topPercent <= 50 && (
                    <div className="status-chip chip-top">
                        <span className="chip-icon"><FaBullseye color="#ec4899" /></span>
                        <span className="chip-value">Top {topPercent}%</span>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentStatusBanner;
