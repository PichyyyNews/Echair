import React from 'react';
import { getProfileImageSrc, isGoogleUser } from '../utils/profileImageHelper';
import { useTranslation } from 'react-i18next';

const SummaryPrintLayout = ({
    classroom,
    summaryData,
    scoreStats,
    scoresTable,
    selectedStudent,
    studentRank,
    scoreCategories
}) => {
    const { t } = useTranslation();
    // Helper to format date
    const currentDate = new Date().toLocaleDateString(t('common.locale', { defaultValue: 'en-US' }), {
        year: 'numeric', month: 'long', day: 'numeric'
    });

    if (!summaryData) return null;

    return (
        <div className="print-container">
            {selectedStudent ? (
                /* --- Individual Student Print Layout --- */
                <div className="print-page student-report">
                    <div className="print-header">
                        <div className="print-school-info">
                            <h1>{t('summaryPrint.studentReportTitle') || 'STUDENT PERFORMANCE REPORT'}</h1>
                            <h2>{classroom?.name} - {classroom?.subname}</h2>
                        </div>
                        <div className="print-date">{t('summaryPrint.date', { date: currentDate }) || `Date: ${currentDate}`}</div>
                    </div>

                    <div className="print-student-header">
                        <img referrerPolicy="no-referrer" 
                            src={getProfileImageSrc(selectedStudent.photoURL, isGoogleUser(selectedStudent.user))} 
                            alt={selectedStudent.name} 
                            className="print-avatar"
                        />
                        <div className="print-student-details">
                            <h3>{selectedStudent.name}</h3>
                            <p><strong>{t('summaryPrint.groupId') || 'Group:'}</strong> {selectedStudent.group}</p>
                            <p><strong>{t('summaryPrint.studentId') || 'Student ID:'}</strong> {selectedStudent.id}</p>
                        </div>
                    </div>

                    <div className="print-section">
                        <h4>{t('summaryPrint.academicOverview') || 'Academic Overview'}</h4>
                        <table className="print-metrics-table">
                            <tbody>
                                <tr>
                                    <th>{t('summary.totalScore') || 'Total Score'}</th>
                                    <td>{(selectedStudent.combinedScore ?? 0).toFixed(1)}</td>
                                    <th>{t('summaryPrint.classRank') || 'Class Rank'}</th>
                                    <td>{t('summaryPrint.rankOf', { rank: studentRank || 1, total: summaryData?.totalStudents ?? 0 }) || `#${studentRank || 1} of ${summaryData?.totalStudents ?? 0}`}</td>
                                </tr>
                                <tr>
                                    <th>{t('summaryPrint.finalGrade') || 'Final Grade'}</th>
                                    <td><strong>{selectedStudent.grade || '-'}</strong></td>
                                    <th>{t('summary.percentile') || 'Percentile'}</th>
                                    <td>{(selectedStudent.percentile ?? 0).toFixed(1)}%</td>
                                </tr>
                                <tr>
                                    <th>{t('summaryPrint.attendanceRate') || 'Attendance Rate'}</th>
                                    <td>{((selectedStudent.attendanceRate ?? 0) * 100).toFixed(0)}% {t('summaryPrint.eventsAttended', { attended: selectedStudent.attendedEvents ?? 0, total: selectedStudent.totalEvents ?? 0 }) || `(${selectedStudent.attendedEvents ?? 0}/${selectedStudent.totalEvents ?? 0} events)`}</td>
                                    <th>{t('summary.zScore') || 'Z-Score'}</th>
                                    <td>{(selectedStudent.zScore ?? 0) > 0 ? '+' : ''}{(selectedStudent.zScore ?? 0).toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="print-section">
                        <h4>{t('summaryPrint.performanceAnalysis') || 'Performance Analysis'}</h4>
                        <p className="print-analysis-text">
                            {t('summaryPrint.analysisP1', { name: selectedStudent.name, score: (selectedStudent.combinedScore ?? 0).toFixed(1), percent: Math.max(1, 100 - Math.round(selectedStudent.percentile ?? 0)) }) || `${selectedStudent.name} has achieved a total score of ${(selectedStudent.combinedScore ?? 0).toFixed(1)}, placing them in the top ${Math.max(1, 100 - Math.round(selectedStudent.percentile ?? 0))}% of the class.`}
                            <br/>
                            {t('summaryPrint.analysisP2') || 'Their performance is categorized as '}
                            <strong>{t(`summaryPrint.levels.${selectedStudent.performanceLevel}`) || selectedStudent.performanceLevel || '-'}</strong>.
                            <br/>
                            {t('summaryPrint.analysisP3', { sd: Math.abs(selectedStudent.zScore ?? 0).toFixed(2), direction: (selectedStudent.zScore ?? 0) >= 0 ? t('summary.above') : t('summary.below'), mean: (summaryData?.statistics?.mean ?? 0).toFixed(1) }) || `The student is ${Math.abs(selectedStudent.zScore ?? 0).toFixed(2)} standard deviations ${(selectedStudent.zScore ?? 0) >= 0 ? 'above' : 'below'} the class average of ${(summaryData?.statistics?.mean ?? 0).toFixed(1)}.`}
                        </p>
                    </div>

                    {/* Show detailed category scores for this student if available */}
                    {scoreCategories && scoreCategories.length > 0 && (
                        <div className="print-section">
                            <h4>{t('summary.categoryBreakdown') || 'Category Breakdown'}</h4>
                            <table className="print-data-table">
                                <thead>
                                    <tr>
                                        <th>{t('summary.categoryBreakdown') || 'Category'}</th>
                                        <th>{t('summaryPrint.scoreEarned') || 'Score Earned'}</th>
                                        <th>{t('summaryPrint.classAverageCol') || 'Class Average'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scoreCategories.map(category => {
                                        // Find student's score for this category
                                        const studentDataRow = scoresTable.find(s => s.student._id === selectedStudent.id || s.student.id === selectedStudent.id);
                                        const scoreEarned = studentDataRow?.categorizedScores[category] || 0;
                                        const classAvg = scoreStats?.categoryAverages[category] || 0;
                                        return (
                                            <tr key={category}>
                                                <td>{category}</td>
                                                <td>{scoreEarned}</td>
                                                <td>{classAvg.toFixed(1)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    <div className="print-footer">
                        <div className="print-signature-line">
                            <p>{t('summaryPrint.instructorSignature') || 'Instructor Signature'}</p>
                            <div className="line"></div>
                        </div>
                    </div>
                </div>
            ) : (
                /* --- Whole Class Print Layout --- */
                <div className="print-page class-report">
                    <div className="print-header">
                        <div className="print-school-info">
                            <h1>{t('summaryPrint.classReportTitle') || 'CLASS SUMMARY REPORT'}</h1>
                            <h2>{classroom?.name} - {classroom?.subname}</h2>
                        </div>
                        <div className="print-date">{t('summaryPrint.date', { date: currentDate }) || `Date: ${currentDate}`}</div>
                    </div>

                    <div className="print-section">
                        <h4>{t('summaryPrint.classStatsOverview') || 'Class Statistics Overview'}</h4>
                        <table className="print-metrics-table">
                            <tbody>
                                <tr>
                                    <th>{t('summary.totalStudents') || 'Total Students'}</th>
                                    <td>{summaryData?.totalStudents ?? 0}</td>
                                    <th>{t('summary.classAverage') || 'Class Average (μ)'}</th>
                                    <td>{(summaryData?.statistics?.mean ?? 0).toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <th>{t('summary.highestScore') || 'Highest Score'}</th>
                                    <td>{(summaryData?.statistics?.max ?? 0).toFixed(2)}</td>
                                    <th>{t('summary.lowestScore') || 'Lowest Score'}</th>
                                    <td>{(summaryData?.statistics?.min ?? 0).toFixed(2)}</td>
                                </tr>
                                <tr>
                                    <th>{t('summary.median') || 'Median'}</th>
                                    <td>{(summaryData?.statistics?.median ?? 0).toFixed(2)}</td>
                                    <th>{t('summary.stdDev') || 'Standard Deviation (σ)'}</th>
                                    <td>{(summaryData?.statistics?.stdDev ?? 0).toFixed(2)}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    <div className="print-section">
                        <h4>{t('summary.classRankings') || 'Class Rankings'}</h4>
                        <table className="print-data-table">
                            <thead>
                                <tr>
                                    <th>{t('summary.rankHeader') || 'Rank'}</th>
                                    <th>{t('summary.studentHeader') || 'Student Name'}</th>
                                    <th>{t('summary.groupHeader') || 'Group'}</th>
                                    <th>{t('summary.totalScore') || 'Total Score'}</th>
                                    <th>{t('summary.zScoreHeader') || 'Z-Score'}</th>
                                    <th>{t('summary.gradeHeader') || 'Grade'}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(summaryData?.studentData || []).map((student, idx) => (
                                    <tr key={student.id || idx}>
                                        <td>{idx + 1}</td>
                                        <td>{student.name}</td>
                                        <td>{student.group || '-'}</td>
                                        <td><strong>{(student.combinedScore ?? 0).toFixed(1)}</strong></td>
                                        <td>{(student.zScore ?? 0) > 0 ? '+' : ''}{(student.zScore ?? 0).toFixed(2)}</td>
                                        <td>{student.grade || '-'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {scoreCategories && scoreCategories.length > 0 && (
                        <div className="print-section avoid-break">
                            <h4>{t('summaryPrint.categoryPerformanceAvg') || 'Category Performance Average'}</h4>
                            <table className="print-data-table">
                                <thead>
                                    <tr>
                                        <th>{t('summary.categoryBreakdown') || 'Category'}</th>
                                        <th>{t('summaryPrint.classAverageScore') || 'Class Average Score'}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {scoreCategories.map(category => (
                                        <tr key={category}>
                                            <td>{category}</td>
                                            <td>{scoreStats?.categoryAverages[category]?.toFixed(2) || '0.00'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default SummaryPrintLayout;

