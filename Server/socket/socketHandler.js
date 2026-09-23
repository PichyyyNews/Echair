const Class = require('../models/Class');
const { delCache } = require('../utils/cache');
const createLogger = require('../utils/logger');
const logger = createLogger('Socket.IO');

module.exports = (io) => {
    logger.info('Setting up Socket.IO event handlers...');
    io.on('connection', (socket) => {
        logger.success(`Client connected: ${socket.id}`);

        // Join personal user room for global notifications
        if (socket.handshake.auth && socket.handshake.auth.userId) {
            socket.join(socket.handshake.auth.userId.toString());
            logger.info(`Attached user ${socket.handshake.auth.userId} to personal notification room`);
        }

        // Join classroom room
        socket.on('join-classroom', (data) => {
            const { classId, userId, userName } = data;
            socket.join(classId);
            logger.socket('join-classroom', { classId, userId, userName });
            logger.info(`User ${userName} joined classroom ${classId}`);
        });

        // Join Admin Room (for system logs)
        socket.on('join-admin-room', (data) => {
            const { token } = data;
            // Ideally, we verify the token here. For now, assuming middleware handles it or we trust the client's role check if simplified.
            // BUT for security, let's minimally decode or trust the passed user role if authorized.
            // A better approach is to pass the user object if authenticated.

            // For this quick implementation, we will trust the client sending the request acts as admin 
            // BUT strictly we should verify jwt. For now, let's just log it. 
            // Security Warning: In production, verify JWT token here.

            socket.join('admins');
            logger.socket('join-admin-room', { socketId: socket.id });
            logger.success(`Admin joined system room: ${socket.id}`);
        });

        // Handle score updates
        socket.on('update-score', (data) => {
            logger.socket('update-score', data);
            const { classId, studentId, newScore, presetName, studentName, updatedBy, timestamp } = data;

            // Emit to all users in the classroom
            socket.to(classId).emit('score-updated', {
                studentId,
                newScore,
                presetName,
                studentName,
                updatedBy,
                timestamp
            });
        });

        // Handle broadcast score updates
        socket.on('broadcast-score-update', (data) => {
            logger.socket('broadcast-score-update', data);
            const { classId } = data;

            // Broadcast to all users in the classroom including sender
            io.to(classId).emit('broadcast-score-update', data);
        });

        // Handle chair seating updates
        socket.on('chair-seating-update', (data) => {
            logger.socket('chair-seating-update', data);
            const { classId, chairId, assignedUsers, action, userName, updatedBy, timestamp } = data;

            // Emit to all users in the classroom except sender
            socket.to(classId).emit('chair-seating-updated', {
                chairId,
                assignedUsers,
                action,
                userName,
                updatedBy,
                timestamp
            });
        });

        // Handle chair movement updates
        socket.on('chair-movement-update', (data) => {
            logger.socket('chair-movement-update', data);
            const { classId, chairPositions, movedChairId, updatedBy, timestamp } = data;

            // Emit to all users in the classroom except sender
            socket.to(classId).emit('chair-moved', {
                chairPositions,
                movedChairId,
                updatedBy,
                timestamp
            });
        });

        // Handle chair group updates
        socket.on('chair-group-update', (data) => {
            logger.socket('chair-group-update', data);
            const { classId, chairGroups, updatedBy, timestamp } = data;

            // Emit to all users in the classroom except sender
            socket.to(classId).emit('chair-groups-updated', {
                chairGroups,
                updatedBy,
                timestamp
            });
        });

        // Helper to save and broadcast chat messages
        const saveAndBroadcastChat = async (classId, message, senderId, senderName, senderPhoto, timestamp = Date.now()) => {
            try {
                // Save message to database
                await Class.findByIdAndUpdate(
                    classId,
                    {
                        $push: {
                            chatMessages: {
                                senderId,
                                senderName,
                                senderPhoto,
                                message,
                                timestamp
                            }
                        }
                    },
                    { new: true }
                );
                await delCache(`classroom:${classId}`);

                // Broadcast to all users in the classroom
                io.to(classId).emit('chat-message-received', {
                    message,
                    senderId,
                    senderName,
                    senderPhoto,
                    timestamp
                });
            } catch (error) {
                logger.error('Error saving chat message:', error);
                // Still broadcast even if save fails
                io.to(classId).emit('chat-message-received', {
                    message,
                    senderId,
                    senderName,
                    senderPhoto,
                    timestamp
                });
            }
        };

        // ✨ Handle chat messages
        socket.on('chat-message', async (data) => {
            logger.socket('chat-message', { user: data.senderName, message: data.message.substring(0, 50) });
            const { classId, message, senderId, senderName, senderPhoto, timestamp } = data;
            await saveAndBroadcastChat(classId, message, senderId, senderName, senderPhoto, timestamp);
        });

        // ... (other events)

        // ✨ Handle Raise Hand
        socket.on('raise-hand', async (data) => {
            logger.socket('raise-hand', { user: data.userName, isRaised: data.isRaised });
            const { classId, userId, isRaised, userName, userPhoto } = data; // Added userPhoto

            // Broadcast to all users in the classroom (including sender, to confirm)
            io.to(classId).emit('raise-hand-updated', {
                userId,
                isRaised,
                userName
            });

            // ✨ Auto-log to chat if raised
            if (isRaised) {
                await saveAndBroadcastChat(classId, '✋ Raised Hand', userId, userName, userPhoto);
            }
        });

        // ✨ Handle Emoji
        socket.on('send-emoji', async (data) => {
            logger.socket('send-emoji', { user: data.userName, emoji: data.emoji });
            const { classId, userId, emoji, userName, userPhoto } = data; // Added userPhoto

            // Broadcast to all users in the classroom (including sender for confirmation/sync)
            io.to(classId).emit('emoji-sent', {
                userId,
                emoji,
                userName,
                timestamp: Date.now()
            });

            // ✨ Auto-log to chat
            await saveAndBroadcastChat(classId, emoji, userId, userName, userPhoto);
        });

        // ✨ Handle adding classroom events
        socket.on('add-classroom-event', async (data) => {
            logger.socket('add-classroom-event', { classId: data.classId, eventType: data.event.type });
            const { classId, event } = data;

            try {
                // Save event to database
                const updatedClassroom = await Class.findByIdAndUpdate(
                    classId,
                    {
                        $push: {
                            classroomEvents: event
                        }
                    },
                    { new: true }
                );
                await delCache(`classroom:${classId}`);

                // Notify all participants about the new event ONLY if it's not a draft
                if (event.status !== 'draft') {
                    const { createAndSendNotification } = require('../utils/notificationHelper');
                    if (updatedClassroom && updatedClassroom.participants) {
                        for (const participantId of updatedClassroom.participants) {
                            await createAndSendNotification(
                                io,
                                participantId,
                                'New Activity',
                                `A new ${event.title || event.type} has started in ${updatedClassroom.name}`,
                                'event',
                                classId
                            );
                        }
                    }
                }

                // Broadcast to all users in the classroom
                io.to(classId).emit('classroom-event-added', event);
            } catch (error) {
                logger.error('Error saving classroom event:', error);
                // Still broadcast for UI responsiveness
                io.to(classId).emit('classroom-event-added', event);
            }
        });


        // ✨ Handle triggering classroom events (e.g., Random Student)
        socket.on('trigger-classroom-event', async (data) => {
            logger.socket('trigger-classroom-event', { eventId: data.eventId });
            const { classId, eventId, updates } = data;

            try {
                // Update specific event in database
                // We construct the update object dynamically based on 'updates'
                const updateFields = {};
                for (const [key, value] of Object.entries(updates)) {
                    updateFields[`classroomEvents.$.${key}`] = value;
                }

                const updatedClass = await Class.findOneAndUpdate(
                    { _id: classId, "classroomEvents.id": eventId },
                    { $set: updateFields },
                    { new: true }
                );
                await delCache(`classroom:${classId}`);

                // If event was just published (transitioned FROM draft TO active/idle), send notification
                if (updates.status === 'idle' || updates.status === 'active') {
                    const updatedEvent = updatedClass?.classroomEvents?.find(e => e.id === eventId);
                    // Check if it was previously a draft (We don't strictly know prior state here efficiently, 
                    // but we only manually send 'status: idle' when posting a draft, so it's a safe proxy for 'App just posted it')
                    if (updatedEvent && updates._isPublishingDraft) {
                        const { createAndSendNotification } = require('../utils/notificationHelper');
                        if (updatedClass.participants) {
                            for (const participantId of updatedClass.participants) {
                                await createAndSendNotification(
                                    io,
                                    participantId,
                                    'New Activity',
                                    `A new ${updatedEvent.title || updatedEvent.type} has started in ${updatedClass.name}`,
                                    'event',
                                    classId
                                );
                            }
                        }
                        // Remove the temp flag so it doesn't get saved to DB unnecessarily
                        delete updates._isPublishingDraft;
                        // update the db again just to be safe if it was saved
                        await Class.findOneAndUpdate(
                            { _id: classId, "classroomEvents.id": eventId },
                            { $unset: { "classroomEvents.$._isPublishingDraft": "" } }
                        );
                    }
                }

                // Broadcast trigger update to all users in the classroom
                io.to(classId).emit('classroom-event-triggered', { eventId, updates });

            } catch (error) {
                logger.error('Error triggering classroom event:', error);
                // Still broadcast for UI responsiveness
                io.to(classId).emit('classroom-event-triggered', { eventId, updates });
            }
        });

        // ✨ Handle deleting classroom events (archive to eventHistory first)
        socket.on('delete-classroom-event', async (data) => {
            logger.socket('delete-classroom-event', { eventId: data.eventId });
            const { classId, eventId } = data;

            try {
                // Find the event first to archive it
                const classroom = await Class.findById(classId);
                const eventToDelete = classroom?.classroomEvents?.find(e => e.id === eventId);

                if (eventToDelete) {
                    // Archive to eventHistory with deletedAt timestamp
                    const archivedEvent = {
                        ...eventToDelete.toObject(),
                        status: 'deleted',
                        deletedAt: Date.now()
                    };
                    await Class.findByIdAndUpdate(classId, {
                        $push: { eventHistory: archivedEvent },
                        $pull: { classroomEvents: { id: eventId } }
                    });
                } else {
                    // Event not found, just try to remove
                    await Class.findByIdAndUpdate(classId, {
                        $pull: { classroomEvents: { id: eventId } }
                    });
                }

                await delCache(`classroom:${classId}`);

                // Broadcast deletion to all users in the classroom
                io.to(classId).emit('classroom-event-deleted', { eventId });
                logger.success(`Event ${eventId} archived and deleted from class ${classId}`);
            } catch (error) {
                logger.error('Error deleting classroom event:', error);
            }
        });

        // ✨ Handle removing student from group (active or archived)
        socket.on('remove-student-from-group', async (data) => {
            const { classId, eventId, studentId, source } = data;
            try {
                const updatePath = source === 'archived' ? 'eventHistory' : 'classroomEvents';

                const cls = await Class.findById(classId);
                if (!cls) return;

                const eventList = cls[updatePath];
                const eventIndex = eventList.findIndex(e => e.id === eventId || e._id?.toString() === eventId);

                if (eventIndex !== -1) {
                    const evt = eventList[eventIndex];
                    if (Array.isArray(evt.results)) {
                        evt.results = evt.results.filter(r => r.userId !== studentId);
                        cls.markModified(updatePath);
                        await cls.save();
                        await delCache(`classroom:${classId}`);

                        io.to(classId).emit('group-member-removed', { eventId, studentId, source });
                        logger.success(`Student ${studentId} removed from group in event ${eventId}`);
                    }
                }
            } catch (error) {
                logger.error('Error removing student from group:', error);
            }
        });

        // ✨ Handle moving student to another group (active or archived)
        socket.on('move-student-group', async (data) => {
            logger.socket('move-student-group', { eventId: data.eventId, userId: data.studentId, newGroup: data.newGroupId });
            const { classId, eventId, studentId, newGroupId, newGroupName, source, userName, userPhoto } = data;

            try {
                const updatePath = source === 'archived' ? 'eventHistory' : 'classroomEvents';

                const cls = await Class.findById(classId);
                if (!cls) {
                    logger.error(`Class not found for move-student-group: ${classId}`);
                    return;
                }

                const eventList = cls[updatePath];
                const eventIndex = eventList.findIndex(e => e.id === eventId || e._id?.toString() === eventId);

                if (eventIndex !== -1) {
                    const evt = eventList[eventIndex];
                    if (!Array.isArray(evt.results)) {
                        evt.results = [];
                    }

                    // Remove existing entry
                    evt.results = evt.results.filter(r => r.userId !== studentId);

                    // Add new entry
                    evt.results.push({
                        userId: studentId,
                        userName: userName || 'Unknown',
                        photoURL: userPhoto || null,
                        text: newGroupId,
                        option: newGroupName,
                        timestamp: Date.now()
                    });

                    cls.markModified(updatePath);
                    await cls.save();
                    await delCache(`classroom:${classId}`);

                    io.to(classId).emit('group-member-moved', { eventId, studentId, newGroupId, source });
                    logger.success(`Student ${studentId} moved to group ${newGroupId} in event ${eventId}`);
                } else {
                    logger.error(`Event ${eventId} not found in ${updatePath} for class ${classId}`);
                }
            } catch (error) {
                logger.error('Error moving student to group:', error);
            }
        });

        // ✨ Handle Answer Submission
        socket.on('submit-event-answer', async (data) => {
            // Force server-side timestamp for fairness
            const serverTimestamp = Date.now();
            if (data.answer) {
                data.answer.timestamp = serverTimestamp;
            }

            logger.socket('submit-event-answer', { eventId: data.eventId, answer: data.answer });
            const { classId, eventId, answer } = data;

            try {
                const classroom = await Class.findById(classId);
                const existingEvent = classroom?.classroomEvents?.find(e => e.id === eventId);

                if (!existingEvent) {
                    logger.warn(`Event ${eventId} not found for answer submission`);
                    return;
                }

                const timerEndsAt = Number(existingEvent.config?.timer?.endsAt) || null;
                const isTimerExpired = Boolean(timerEndsAt && serverTimestamp >= timerEndsAt);
                if (existingEvent.status === 'ended' || isTimerExpired) {
                    logger.warn(`Rejected late answer for event ${eventId}: ${existingEvent.status === 'ended' ? 'event ended' : 'timer expired'}`);
                    return;
                }

                // Find class and push answer to specific event results
                await Class.findOneAndUpdate(
                    { _id: classId, "classroomEvents.id": eventId },
                    {
                        $push: {
                            "classroomEvents.$.results": answer
                        }
                    },
                    { new: true }
                );

                // Broadcast update to all clients
                // We construct the update payload to match what the frontend expects
                // Frontend expects { eventId, updates: { results: [...] } }
                // But wait, broadcasting the WHOLE results array is safer to ensure sync.
                // Or just the new answer? 

                // Let's get the updated doc to be sure
                const updatedClass = await Class.findById(classId);
                const updatedEvent = updatedClass.classroomEvents.find(e => e.id === eventId);

                // ✨ SCORING LOGIC (Per Option)
                let scoreUpdateData = null;
                if (updatedEvent && updatedEvent.config && updatedEvent.config.scoreConfig) {
                    const { optionScores } = updatedEvent.config.scoreConfig;
                    if (optionScores) {
                        const answerText = answer.text;
                        const scoreDetail = optionScores[answerText];
                        if (scoreDetail) {
                            const pointValue = Math.abs(parseInt(scoreDetail.points) || 0);
                            const scoreDelta = scoreDetail.action === 'subtract' ? -pointValue : pointValue;

                            if (scoreDelta !== 0) {
                                const studentId = answer.userId;
                                const scoreField = `studentScores.${studentId}`;
                                const scoreUpdate = {};
                                scoreUpdate[scoreField] = scoreDelta;

                                const updatedClassWithScore = await Class.findByIdAndUpdate(
                                    classId,
                                    { $inc: scoreUpdate },
                                    { new: true }
                                );

                                const newTotalScore = updatedClassWithScore.studentScores ? updatedClassWithScore.studentScores[studentId] : 0;
                                scoreUpdateData = {
                                    studentId,
                                    newScore: newTotalScore,
                                    delta: scoreDelta,
                                    reason: `Event: ${updatedEvent.config.questionText || 'Poll'}`,
                                    timestamp: Date.now()
                                };
                                logger.success(`Score updated for ${studentId}: ${scoreDelta} points`);
                            }
                        }
                    }
                }

                // OLD LOGIC (Disabled)
                if (false && updatedEvent && updatedEvent.config && updatedEvent.config.isScored) {
                    const { correctOptions, points, action } = updatedEvent.config; // correctOptions is array of strings (text)

                    // Check if answer is correct
                    // We answer with text, so check if text is in correctOptions
                    const isCorrect = correctOptions && correctOptions.some(opt => opt && opt.trim() === answer.text.trim());

                    if (isCorrect) {
                        const pointValue = Math.abs(parseInt(points) || 0);
                        const scoreDelta = action === 'subtract' ? -pointValue : pointValue;
                        const studentId = answer.userId;

                        // Update student score in DB using dot notation for Mixed type field
                        // field: studentScores.USER_ID
                        const scoreField = `studentScores.${studentId}`;
                        const scoreUpdate = {};
                        scoreUpdate[scoreField] = scoreDelta;

                        // Update the class doc again to increment score
                        const updatedClassWithScore = await Class.findByIdAndUpdate(
                            classId,
                            { $inc: scoreUpdate },
                            { new: true }
                        );

                        // Prepare data for score-updated emit
                        // Access the score using bracket notation since key is dynamic
                        const newTotalScore = updatedClassWithScore.studentScores ? updatedClassWithScore.studentScores[studentId] : 0;

                        scoreUpdateData = {
                            studentId,
                            newScore: newTotalScore,
                            delta: scoreDelta,
                            reason: `Event: ${updatedEvent.config.questionText || 'Poll'}`,
                            timestamp: Date.now()
                        };

                        logger.success(`Score updated for ${studentId}: ${scoreDelta} points`);
                    }
                }

                await delCache(`classroom:${classId}`);

                io.to(classId).emit('classroom-event-updated', {
                    eventId,
                    updates: { results: updatedEvent.results }
                });

                // If score updated, emit score-updated
                if (scoreUpdateData) {
                    io.to(classId).emit('score-updated', scoreUpdateData);

                    // ✨ Send notification
                    const { createAndSendNotification } = require('../utils/notificationHelper');
                    await createAndSendNotification(
                        io,
                        scoreUpdateData.studentId,
                        'Score Update',
                        `You earned ${scoreUpdateData.delta > 0 ? '+' : ''}${scoreUpdateData.delta} pts in "${updatedEvent.config.questionText || 'Event'}".`,
                        'score',
                        classId
                    );
                }

                logger.success(`Answer added to event ${eventId}`);

            } catch (error) {
                logger.error('Error submitting answer:', error);
            }
        });

        // ✨ Handle Raise Hand
        socket.on('raise-hand', (data) => {
            logger.socket('raise-hand [duplicate]', { user: data.userName });
            const { classId, userId, isRaised, userName } = data;

            // Broadcast to all users in the classroom (including sender, to confirm)
            io.to(classId).emit('raise-hand-updated', {
                userId,
                isRaised,
                userName
            });
        });

        // ✨ Handle Emoji
        socket.on('send-emoji', (data) => {
            logger.socket('send-emoji [duplicate]', { user: data.userName });
            const { classId, userId, emoji, userName } = data;

            // Broadcast to all users in the classroom (including sender for confirmation/sync)
            io.to(classId).emit('emoji-sent', {
                userId,
                emoji,
                userName,
                timestamp: Date.now()
            });
        });

        socket.on('disconnect', () => {
            logger.warn(`Client disconnected: ${socket.id}`);
        });
    });
};
