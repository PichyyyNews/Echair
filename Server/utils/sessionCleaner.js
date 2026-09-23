const TeachingSession = require('../models/TeachingSession');
const createLogger = require('./logger');
const logger = createLogger('SessionCleaner');

const MAX_SESSION_DURATION_MS = 5 * 60 * 60 * 1000; // 5 hours

/**
 * Automatically ends sessions that have been running for more than 5 hours.
 */
const autoEndStaleSessions = async () => {
    try {
        const cutoffTime = new Date(Date.now() - MAX_SESSION_DURATION_MS);
        
        // Find sessions that are active (endedAt is null) and started before the cutoff
        const staleSessions = await TeachingSession.find({
            endedAt: null,
            startedAt: { $lt: cutoffTime }
        });

        if (staleSessions.length === 0) {
            return;
        }

        logger.info(`Found ${staleSessions.length} stale sessions. Ending them...`);

        for (const session of staleSessions) {
            const endedAt = new Date(session.startedAt.getTime() + MAX_SESSION_DURATION_MS);
            session.endedAt = endedAt;
            session.durationSeconds = Math.round((endedAt - session.startedAt) / 1000);
            
            // Calculate a basic summary based on whatever scoreChanges are present
            const scoreChanges = session.scoreChanges || [];
            const studentTotals = {};
            
            scoreChanges.forEach(change => {
                if (!studentTotals[change.studentId]) {
                    studentTotals[change.studentId] = {
                        studentId: change.studentId,
                        studentName: change.studentName || 'Unknown',
                        photoURL: change.photoURL || null,
                        totalPoints: 0
                    };
                }
                studentTotals[change.studentId].totalPoints += change.pointsChange;
            });

            const topStudents = Object.values(studentTotals)
                .sort((a, b) => b.totalPoints - a.totalPoints);

            session.summary = {
                totalScoreChanges: scoreChanges.length,
                studentsScored: Object.keys(studentTotals).length,
                topStudents
            };

            await session.save();
            logger.success(`Auto-ended session: ${session._id} (Classroom: ${session.classroomId})`);
        }
    } catch (err) {
        logger.error('Error auto-ending stale sessions:', err);
    }
};

/**
 * Starts the cleaner interval.
 * @param {number} intervalMs How often to check for stale sessions (default 15 mins).
 */
const startSessionCleaner = (intervalMs = 15 * 60 * 1000) => {
    logger.info(`Starting session cleaner (Interval: ${intervalMs / 60000} mins)`);
    
    const runCleanup = () => {
        try {
            const { enqueueCleanup } = require('../jobs/queue');
            enqueueCleanup();
        } catch (e) {
            autoEndStaleSessions();
        }
    };

    // Run once on startup
    runCleanup();
    
    // Set interval
    setInterval(runCleanup, intervalMs);
};

module.exports = { startSessionCleaner, autoEndStaleSessions };
