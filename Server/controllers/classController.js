const Class = require('../models/Class');
const User = require('../models/User');
const TeachingSession = require('../models/TeachingSession');
const createLogger = require('../utils/logger');
const { getCache, setCache, delCache } = require('../utils/cache');
const logger = createLogger('ClassController');

exports.getClassrooms = async (req, res) => {
    try {
        const userId = req.user._id;
        const classrooms = await Class.find({
            $or: [
                { creator: userId },
                { participants: userId }
            ]
        }).populate('creator', 'displayName photoURL _id')
            .populate('participants', 'displayName photoURL _id');
        res.json(classrooms);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.createClassroom = async (req, res) => {
    const { name, subname, imageUrl, color, rows, cols, seatingPositions } = req.body;
    const userId = req.user._id;

    try {
        const classCode = Math.random().toString(36).substring(2, 8).toUpperCase();

        const newClass = new Class({
            name,
            subname,
            imageUrl,
            color,
            creator: [userId],
            participants: [userId],
            classCode,
            rows,
            cols,
            seatingPositions
        });

        await newClass.save();

        await User.findByIdAndUpdate(userId, { $push: { createdClasses: newClass._id, enrolledClasses: newClass._id } });
        await invalidateUserCache(userId);

        res.status(201).json({
            msg: 'Class created successfully!',
            class: newClass
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

exports.joinClassroom = async (req, res) => {
    const { classCode } = req.body;
    const userId = req.user._id;

    try {
        const classToJoin = await Class.findOne({ classCode });

        if (!classToJoin) {
            return res.status(404).json({ msg: 'Invalid class code. Class not found.' });
        }

        if (classToJoin.participants.includes(userId)) {
            return res.status(400).json({ msg: 'You are already a participant in this class.' });
        }

        classToJoin.participants.push(userId);
        await classToJoin.save();
        await User.findByIdAndUpdate(userId, { $push: { enrolledClasses: classToJoin._id } });

        // Invalidate classroom and user caches
        await invalidateClassroomCache(classToJoin._id);
        await invalidateUserCache(userId);

        // Notify creator(s) that a new user joined
        const { createAndSendNotification } = require('../utils/notificationHelper');
        const userJoining = await User.findById(userId);
        if (classToJoin.creator && classToJoin.creator.length > 0) {
            for (const creatorId of classToJoin.creator) {
                if (creatorId.toString() !== userId.toString()) {
                    await createAndSendNotification(
                        req.io,
                        creatorId,
                        'New Member',
                        `${userJoining.displayName} joined your class "${classToJoin.name}"`,
                        'class_join',
                        classToJoin._id
                    );
                }
            }
        }

        res.status(200).json({ msg: 'Joined class successfully!', class: classToJoin });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
};

const invalidateClassroomCache = async (classId) => {
    if (classId) {
        await delCache(`classroom:${classId}`);
    }
};

const invalidateUserCache = async (userId) => {
    if (userId) {
        await delCache(`user:${userId}`);
    }
};

exports.getClassroom = async (req, res) => {
    try {
        const userId = req.user._id;
        const cacheKey = `classroom:${req.params.id}`;

        // Check Redis cache first
        const cachedClassroom = await getCache(cacheKey);
        if (cachedClassroom) {
            const isCreator = cachedClassroom.creator?.some(creator => (creator._id || creator).toString() === userId.toString());
            const isParticipant = cachedClassroom.participants?.some(participant => (participant._id || participant).toString() === userId.toString());
            if (isCreator || isParticipant) {
                return res.json(cachedClassroom);
            }
        }

        const classroom = await Class.findById(req.params.id)
            .populate('creator', 'displayName photoURL _id')
            .populate('participants', 'displayName photoURL');

        if (!classroom) {
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        const isCreator = classroom.creator.some(creator => creator._id.toString() === userId.toString());
        const isParticipant = classroom.participants.some(participant => participant._id.toString() === userId.toString());
        const isMember = isCreator || isParticipant;

        if (classroom.isPublic && !isMember) {
            classroom.participants.push(userId);
            await classroom.save();

            await User.findByIdAndUpdate(userId, {
                $addToSet: { enrolledClasses: classroom._id }
            });

            const updatedClassroom = await Class.findById(req.params.id)
                .populate('creator', 'displayName photoURL _id')
                .populate('participants', 'displayName photoURL');

            await setCache(cacheKey, updatedClassroom, 30);
            return res.json(updatedClassroom);
        }

        if (!classroom.isPublic && !isMember) {
            return res.status(403).json({
                msg: 'Access denied. This classroom is private and requires an invitation.',
                requiresInvitation: true
            });
        }

        // Cache for 30 seconds
        await setCache(cacheKey, classroom, 30);
        res.json(classroom);
    } catch (err) {
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Classroom not found' });
        }
        res.status(500).send('Server Error');
    }
};

exports.updateSeating = async (req, res) => {
    const { classId } = req.params;
    const { seatingPositions, assignedUsers, studentScores, chairGroups } = req.body;
    try {
        const originalClassroom = await Class.findById(classId);

        const updateObj = {};
        if (seatingPositions) updateObj.seatingPositions = seatingPositions;
        if (assignedUsers) updateObj.assignedUsers = assignedUsers;
        if (studentScores) updateObj.studentScores = studentScores;
        if (chairGroups) updateObj.chairGroups = chairGroups;

        const classroom = await Class.findByIdAndUpdate(classId, updateObj, { new: true });
        if (!classroom) {
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        // Invalidate classroom cache on update
        await invalidateClassroomCache(classId);

        // Send Notification for score changes
        if (studentScores) {
            const { createAndSendNotification } = require('../utils/notificationHelper');
            for (const [studentId, categoriesObj] of Object.entries(studentScores)) {
                // Determine if score actually changed or simply got assigned
                for (const [category, newScore] of Object.entries(categoriesObj)) {
                    const oldScore = originalClassroom.studentScores?.[studentId]?.[category] || 0;
                    if (newScore !== oldScore) {
                        const scoreDiff = newScore - oldScore;
                        const actionText = scoreDiff > 0 ? 'awarded' : 'deducted';
                        await createAndSendNotification(
                            req.io,
                            studentId,
                            'Score Update',
                            `You were ${actionText} ${Math.abs(scoreDiff)} pts in "${category}"`,
                            'score',
                            classId
                        );
                    }
                }
            }
        }

        res.json({
            msg: 'Seating positions updated',
            seatingPositions: classroom.seatingPositions,
            assignedUsers: classroom.assignedUsers,
            studentScores: classroom.studentScores,
            chairGroups: classroom.chairGroups
        });
    } catch (err) {
        console.error('Error updating seating positions:', err);
        res.status(500).send('Server error');
    }
};

exports.leaveClassroom = async (req, res) => {
    const { classId } = req.params;
    const userId = req.user._id;

    try {
        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        const isCreator = classroom.creator.map(id => id.toString()).includes(userId.toString());

        if (isCreator) {
            if (classroom.creator.length > 1) {
                classroom.creator = classroom.creator.filter(id => id.toString() !== userId.toString());
                classroom.participants = classroom.participants.filter(id => id.toString() !== userId.toString());
                await classroom.save();
                await User.findByIdAndUpdate(userId, { $pull: { createdClasses: classId, enrolledClasses: classId, pinnedClasses: classId } });
                await invalidateClassroomCache(classId);
                await invalidateUserCache(userId);
                return res.json({ msg: 'You have left your creator role.' });
            } else {
                try {
                    await Class.findByIdAndDelete(classId);
                    await User.updateMany({}, { $pull: { createdClasses: classId, enrolledClasses: classId, pinnedClasses: classId } });
                    await invalidateClassroomCache(classId);
                    await invalidateUserCache(userId);
                    return res.json({ msg: 'Classroom deleted as you were the sole creator.' });
                } catch (deleteErr) {
                    return res.status(500).send('Server error during classroom deletion.');
                }
            }
        }

        await Class.findByIdAndUpdate(classId, {
            $pull: { participants: userId },
        });

        if (classroom.assignedUsers) {
            let changed = false;
            for (const seat in classroom.assignedUsers) {
                if (classroom.assignedUsers[seat]?.userId?.toString() === userId.toString()) {
                    delete classroom.assignedUsers[seat];
                    changed = true;
                }
            }
            if (changed) {
                classroom.markModified('assignedUsers');
                await classroom.save();
            }
        }

        await User.findByIdAndUpdate(userId, {
            $pull: {
                enrolledClasses: classId,
                pinnedClasses: classId
            }
        });

        await invalidateClassroomCache(classId);
        await invalidateUserCache(userId);

        res.json({ msg: 'Successfully left the classroom.' });
    } catch (err) {
        console.error('Error leaving classroom:', err);
        res.status(500).send('Server error');
    }
};

exports.kickUser = async (req, res) => {
    const { classId } = req.params;
    const { userId } = req.body;
    try {
        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        if (!classroom.creator.map(id => id.toString()).includes(req.user.id.toString())) {
            return res.status(403).json({ msg: 'Only creator can kick members' });
        }

        if (classroom.creator.map(id => id.toString()).includes(userId)) {
            return res.status(403).json({ msg: 'Cannot kick another creator. Only the original creator can demote creators.' });
        }

        classroom.participants = classroom.participants.filter(id => id.toString() !== userId);

        for (const key in classroom.assignedUsers) {
            if (classroom.assignedUsers[key]?.userId === userId) {
                delete classroom.assignedUsers[key];
            }
        }

        classroom.markModified('assignedUsers');
        await classroom.save();
        await User.findByIdAndUpdate(userId, { $pull: { enrolledClasses: classId, pinnedClasses: classId } });
        await invalidateClassroomCache(classId);
        await invalidateUserCache(userId);

        const { createAndSendNotification } = require('../utils/notificationHelper');
        await createAndSendNotification(
            req.io,
            userId,
            'Removed from Class',
            `You have been removed from the class "${classroom.name}" by the instructor.`,
            'class_leave',
            classId
        );

        res.json({ msg: 'Kicked successfully', classroom });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.promoteUser = async (req, res) => {
    const { classId } = req.params;
    const { userId } = req.body;
    try {
        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        if (!classroom.creator.map(id => id.toString()).includes(req.user.id.toString())) {
            return res.status(403).json({ msg: 'Only a creator can promote members' });
        }

        if (classroom.creator.map(id => id.toString()).includes(userId.toString())) {
            return res.status(400).json({ msg: 'User is already a creator' });
        }

        classroom.creator.push(userId);
        await classroom.save();
        await invalidateClassroomCache(classId);
        await User.findByIdAndUpdate(userId, { $addToSet: { createdClasses: classId } });
        await invalidateUserCache(userId);

        const { createAndSendNotification } = require('../utils/notificationHelper');
        await createAndSendNotification(
            req.io,
            userId,
            'Promoted to Creator',
            `You have been promoted to a Creator in the class "${classroom.name}".`,
            'system',
            classId
        );

        res.json({ msg: 'Promoted successfully', classroom });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.demoteUser = async (req, res) => {
    const { classId } = req.params;
    const { userId } = req.body;

    try {
        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        const originalCreatorId = classroom.creator[0]?.toString();
        if (req.user.id.toString() !== originalCreatorId) {
            return res.status(403).json({ msg: 'Only a creator can demote members' });
        }

        if (classroom.creator.length <= 1) {
            return res.status(400).json({ msg: 'Cannot demote the last creator of the classroom.' });
        }

        classroom.creator = classroom.creator.filter(id => id.toString() !== userId.toString());
        await classroom.save();
        await invalidateClassroomCache(classId);

        await User.findByIdAndUpdate(userId, { $pull: { createdClasses: classId } });
        await invalidateUserCache(userId);

        const { createAndSendNotification } = require('../utils/notificationHelper');
        await createAndSendNotification(
            req.io,
            userId,
            'Demoted from Creator',
            `Your Creator role in the class "${classroom.name}" has been removed.`,
            'system',
            classId
        );

        res.json({ msg: 'User demoted successfully', classroom });
    } catch (err) {
        res.status(500).json({ msg: 'Server error' });
    }
};

exports.updateTheme = async (req, res) => {
    const { classId } = req.params;
    const { name, subname, color, bannerUrl } = req.body;
    const userId = req.user.id;

    try {
        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        if (!classroom.creator.map(id => id.toString()).includes(userId.toString())) {
            return res.status(403).json({ msg: 'Authorization denied. Only creators can edit the theme.' });
        }

        classroom.name = name || classroom.name;
        classroom.subname = subname || classroom.subname;
        classroom.color = color || classroom.color;
        classroom.bannerUrl = bannerUrl;

        const updatedClassroom = await classroom.save();
        await invalidateClassroomCache(classId);
        res.json(updatedClassroom);
    } catch (err) {
        res.status(500).send('Server error');
    }
};

exports.updateSettings = async (req, res) => {
    const { classId } = req.params;
    const { isPublic, allowSelfJoin } = req.body;
    const userId = req.user.id;

    try {
        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        if (!classroom.creator.map(id => id.toString()).includes(userId.toString())) {
            return res.status(403).json({ msg: 'Authorization denied. Only creators can edit settings.' });
        }

        if (typeof isPublic === 'boolean') {
            classroom.isPublic = isPublic;
        }
        if (typeof allowSelfJoin === 'boolean') {
            classroom.allowSelfJoin = allowSelfJoin;
        }

        // Student Performance Status visibility toggle
        const { showStudentStatus, showScoreBar } = req.body;
        if (typeof showStudentStatus === 'boolean') {
            classroom.showStudentStatus = showStudentStatus;
        }

        if (typeof showScoreBar === 'boolean') {
            classroom.showScoreBar = showScoreBar;
        }

        const updatedClassroom = await classroom.save();
        await invalidateClassroomCache(classId);
        res.json({ msg: 'Settings updated successfully', classroom: updatedClassroom });
    } catch (err) {
        console.error('Error updating settings:', err);
        res.status(500).send('Server error');
    }
};

exports.getChatHistory = async (req, res) => {
    const { classId } = req.params;
    const limit = parseInt(req.query.limit) || 100; // Default to last 100 messages

    try {
        logger.info(`Fetching chat history for classroom: ${classId}`);

        const classroom = await Class.findById(classId);
        if (!classroom) {
            logger.error(`Classroom not found: ${classId}`);
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        // Verify user is a member of the classroom
        const userId = req.user._id.toString();
        const isCreator = classroom.creator.some(id => id.toString() === userId);
        const isParticipant = classroom.participants.some(id => id.toString() === userId);

        if (!isCreator && !isParticipant) {
            logger.warn(`Access denied for user: ${userId}`);
            return res.status(403).json({ msg: 'Access denied. You are not a member of this classroom.' });
        }

        // ✨ CRITICAL FIX: Initialize chatMessages if undefined (for existing classrooms)
        if (!classroom.chatMessages) {
            logger.warn('chatMessages undefined, initializing empty array');
            classroom.chatMessages = [];
            await classroom.save();
        }

        // Get the last N messages
        const chatMessages = classroom.chatMessages.slice(-limit);

        logger.success(`Returning ${chatMessages.length} chat messages for classroom: ${classId}`);
        res.json({ chatMessages });
    } catch (err) {
        logger.error('Error fetching chat history:', err);
        res.status(500).send('Server error');
    }
};

exports.updateAttendance = async (req, res) => {
    const { classId } = req.params;
    const { attendance, attendanceDays } = req.body;
    const userId = req.user.id;

    console.log(`[DEBUG] updateAttendance hit for class ${classId} by user ${userId}`);
    console.log(`[DEBUG] attendance data length: ${attendance ? Object.keys(attendance).length : 0}`);

    try {
        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        if (!classroom.creator.map(id => id.toString()).includes(userId.toString())) {
            return res.status(403).json({ msg: 'Authorization denied. Only creators can edit attendance.' });
        }

        if (attendance) {
            classroom.attendance = attendance;
            classroom.markModified('attendance');
        }
        if (typeof attendanceDays === 'number') {
            classroom.attendanceDays = attendanceDays;
        }

        const updatedClassroom = await classroom.save();
        await invalidateClassroomCache(classId);

        // Emit real-time update to all clients in the classroom room
        if (req.io) {
            req.io.to(classId).emit('classroom-updated', updatedClassroom);
        }

        res.json({ msg: 'Attendance updated successfully', classroom: updatedClassroom });
    } catch (err) {
        console.error('Error updating attendance:', err);
        res.status(500).send('Server error');
    }
};

// ── Teaching Session Controllers ──

exports.startSession = async (req, res) => {
    const { classId } = req.params;
    const userId = req.user._id;

    try {
        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        // Only creators can start sessions
        if (!classroom.creator.map(id => id.toString()).includes(userId.toString())) {
            return res.status(403).json({ msg: 'Only creators can start teaching sessions.' });
        }

        // Check if there's an active session already
        const existingSession = await TeachingSession.findOne({
            classroomId: classId,
            endedAt: null
        });
        if (existingSession) {
            return res.status(400).json({
                msg: 'A session is already active for this classroom.',
                session: existingSession
            });
        }

        const session = new TeachingSession({
            classroomId: classId,
            startedBy: userId,
            startedAt: new Date()
        });

        await session.save();
        res.status(201).json({ msg: 'Teaching session started', session });
    } catch (err) {
        console.error('Error starting session:', err);
        res.status(500).send('Server error');
    }
};

exports.endSession = async (req, res) => {
    const { classId } = req.params;
    const userId = req.user._id;
    const { sessionId, scoreChanges } = req.body;

    try {
        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        if (!classroom.creator.map(id => id.toString()).includes(userId.toString())) {
            return res.status(403).json({ msg: 'Only creators can end teaching sessions.' });
        }

        const session = await TeachingSession.findById(sessionId);
        if (!session) return res.status(404).json({ msg: 'Session not found' });
        if (session.endedAt) return res.status(400).json({ msg: 'Session already ended' });

        const now = new Date();
        const durationSeconds = Math.round((now - session.startedAt) / 1000);

        // Store score changes
        session.scoreChanges = scoreChanges || [];
        session.endedAt = now;
        session.durationSeconds = durationSeconds;

        // Calculate summary
        const studentTotals = {};
        (scoreChanges || []).forEach(change => {
            if (!studentTotals[change.studentId]) {
                studentTotals[change.studentId] = {
                    studentId: change.studentId,
                    studentName: change.studentName || 'Unknown',
                    photoURL: change.photoURL || null,
                    totalPoints: 0
                };
            }
            studentTotals[change.studentId].totalPoints += change.pointsChange;
            // Keep the latest name/photo
            if (change.studentName) studentTotals[change.studentId].studentName = change.studentName;
            if (change.photoURL) studentTotals[change.studentId].photoURL = change.photoURL;
        });

        const topStudents = Object.values(studentTotals)
            .sort((a, b) => b.totalPoints - a.totalPoints);

        session.summary = {
            totalScoreChanges: (scoreChanges || []).length,
            studentsScored: Object.keys(studentTotals).length,
            topStudents
        };

        await session.save();
        res.json({ msg: 'Teaching session ended', session });
    } catch (err) {
        console.error('Error ending session:', err);
        res.status(500).send('Server error');
    }
};

exports.getSessions = async (req, res) => {
    const { classId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const skip = parseInt(req.query.skip) || 0;

    try {
        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        // Must be a member
        const userId = req.user._id.toString();
        const isMember = classroom.creator.some(id => id.toString() === userId) ||
            classroom.participants.some(id => id.toString() === userId);
        if (!isMember) return res.status(403).json({ msg: 'Access denied' });

        const sessions = await TeachingSession.find({ classroomId: classId })
            .sort({ startedAt: -1 })
            .skip(skip)
            .limit(limit)
            .populate('startedBy', 'displayName photoURL');

        const total = await TeachingSession.countDocuments({ classroomId: classId });

        res.json({ sessions, total });
    } catch (err) {
        console.error('Error fetching sessions:', err);
        res.status(500).send('Server error');
    }
};
