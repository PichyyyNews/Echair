const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Assignment = require('../models/Assignment');
const AssignmentSubmission = require('../models/AssignmentSubmission');
const StreamPost = require('../models/StreamPost');
const Class = require('../models/Class');

// @route   POST /api/classwork/:classId
// @desc    Create a new assignment
// @access  Private (Teacher only)
router.post('/:classId', auth, async (req, res) => {
    try {
        const { title, description, dueDate, points, allowLateSubmission, showScoreToStudents, attachments } = req.body;
        const classId = req.params.classId;

        // Verify class exists and user is creator
        const classroom = await Class.findById(classId);
        if (!classroom) {
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        // Check if user is the creator (teacher)
        const isCreator = classroom.creator.some(c => c.toString() === req.user.id);
        if (!isCreator) {
            return res.status(403).json({ msg: 'Not authorized to create assignments in this class' });
        }

        const newAssignment = new Assignment({
            classId,
            title,
            description,
            dueDate: dueDate ? new Date(dueDate) : null,
            points: points || 100,
            allowLateSubmission: allowLateSubmission || false,
            showScoreToStudents: showScoreToStudents !== undefined ? showScoreToStudents : true,
            attachments: attachments || [],
            creator: req.user.id
        });

        const assignment = await newAssignment.save();

        // Auto-create a Stream post for this assignment
        try {
            const autoPost = new StreamPost({
                classId,
                author: req.user.id,
                title: `📋 New Assignment: ${title}`,
                content: description || '',
                type: 'assignment',
                assignmentId: assignment._id,
                assignmentMeta: {
                    points: points || 100,
                    dueDate: dueDate ? new Date(dueDate) : null
                }
            });
            await autoPost.save();
        } catch (streamErr) {
            console.error('Failed to create stream post for assignment:', streamErr);
            // Non-fatal: still return the assignment
        }

        res.json(assignment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/classwork/:classId
// @desc    Get all assignments for a class
// @access  Private
router.get('/:classId', auth, async (req, res) => {
    try {
        const classId = req.params.classId;

        // Ensure user is part of the class
        const classroom = await Class.findById(classId);
        if (!classroom) {
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        const isCreator = classroom.creator.some(c => c.toString() === req.user.id);
        const isStudent = classroom.participants.some(p => p.toString() === req.user.id);

        if (!isCreator && !isStudent) {
            return res.status(403).json({ msg: 'Not authorized to view assignments' });
        }

        const assignments = await Assignment.find({ classId }).sort({ createdAt: -1 });

        // If user is a student, we also want to attach their submission status
        if (isStudent && !isCreator) {
            const studentAssignments = await Promise.all(assignments.map(async (assignment) => {
                const submission = await AssignmentSubmission.findOne({
                    assignmentId: assignment._id,
                    studentId: req.user.id
                });

                return {
                    ...assignment.toObject(),
                    submission: submission || null
                };
            }));
            return res.json(studentAssignments);
        }

        // If user is a creator (teacher), attach submission statistics (graded count & total students)
        if (isCreator) {
            const creatorIds = (classroom.creator || []).map(c => (c._id || c).toString());
            const studentParticipants = (classroom.participants || []).filter(
                p => !creatorIds.includes((p._id || p).toString())
            );
            const totalStudents = studentParticipants.length;
            const creatorAssignments = await Promise.all(assignments.map(async (assignment) => {
                const gradedCount = await AssignmentSubmission.countDocuments({
                    assignmentId: assignment._id,
                    studentId: { $nin: creatorIds },
                    status: 'graded'
                });

                return {
                    ...assignment.toObject(),
                    submissionStats: {
                        graded: gradedCount,
                        total: totalStudents
                    }
                };
            }));
            return res.json(creatorAssignments);
        }

        res.json(assignments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/classwork/:classId/:assignmentId
// @desc    Get single assignment details
// @access  Private
router.get('/:classId/:assignmentId', auth, async (req, res) => {
    try {
        const { classId, assignmentId } = req.params;

        const classroom = await Class.findById(classId);
        if (!classroom) {
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        const isCreator = classroom.creator.some(c => c.toString() === req.user.id);
        const isStudent = classroom.participants.some(p => p.toString() === req.user.id);

        if (!isCreator && !isStudent) {
            return res.status(403).json({ msg: 'Not authorized to view this assignment' });
        }

        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return res.status(404).json({ msg: 'Assignment not found' });
        }

        let responseAssignment = assignment.toObject();

        if (isStudent && !isCreator) {
            const submission = await AssignmentSubmission.findOne({
                assignmentId: assignment._id,
                studentId: req.user.id
            });
            responseAssignment.submission = submission || null;
        }

        res.json(responseAssignment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/classwork/:classId/:assignmentId/submit
// @desc    Submit an assignment (Student)
// @access  Private
router.post('/:classId/:assignmentId/submit', auth, async (req, res) => {
    try {
        const { assignmentId } = req.params;
        const { attachments } = req.body;

        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) {
            return res.status(404).json({ msg: 'Assignment not found' });
        }

        const classroom = await Class.findById(assignment.classId);
        if (classroom) {
            const isCreator = classroom.creator.some(c => c.toString() === req.user.id);
            if (isCreator && req.user.role !== 'student') {
                return res.status(400).json({ msg: 'ครูผู้สอนไม่สามารถส่งงานในห้องเรียนตนเองได้' });
            }
        }

        let isLate = false;
        if (assignment.dueDate && new Date() > assignment.dueDate) {
            if (!assignment.allowLateSubmission) {
                return res.status(400).json({ msg: 'Late submissions are not allowed' });
            }
            isLate = true;
        }

        let submission = await AssignmentSubmission.findOne({
            assignmentId,
            studentId: req.user.id
        });

        if (submission) {
            // Update existing submission
            submission.attachments = attachments || submission.attachments;
            submission.status = isLate ? 'late' : 'submitted';
            submission.submittedAt = Date.now();
            await submission.save();
        } else {
            // Create new submission
            submission = new AssignmentSubmission({
                assignmentId,
                studentId: req.user.id,
                attachments: attachments || [],
                status: isLate ? 'late' : 'submitted'
            });
            await submission.save();
        }

        res.json(submission);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   GET /api/classwork/:classId/:assignmentId/submissions
// @desc    Get all submissions for an assignment (Teacher only)
// @access  Private
router.get('/:classId/:assignmentId/submissions', auth, async (req, res) => {
    try {
        const { classId, assignmentId } = req.params;

        const classroom = await Class.findById(classId);
        if (!classroom) {
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        const isCreator = classroom.creator.some(c => c.toString() === req.user.id);
        if (!isCreator && req.user.role !== 'admin') {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        const creatorIds = (classroom.creator || []).map(c => c.toString());

        const submissions = await AssignmentSubmission.find({
            assignmentId,
            studentId: { $nin: creatorIds }
        }).populate('studentId', 'displayName email photoURL role');

        const validSubmissions = submissions.filter(s => {
            if (!s.studentId) return false;
            const sid = (s.studentId._id || s.studentId).toString();
            if (creatorIds.includes(sid)) return false;
            if (s.studentId.role === 'admin' || s.studentId.role === 'teacher') return false;
            return true;
        });

        res.json(validSubmissions);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/classwork/:classId/:assignmentId/grade/:submissionId
// @desc    Grade a submission (Teacher only)
// @access  Private
router.put('/:classId/:assignmentId/grade/:submissionId', auth, async (req, res) => {
    try {
        const { classId, submissionId } = req.params;
        const { pointsAwarded } = req.body;

        const classroom = await Class.findById(classId);
        if (!classroom) {
            return res.status(404).json({ msg: 'Classroom not found' });
        }

        const isCreator = classroom.creator.some(c => c.toString() === req.user.id);
        if (!isCreator) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        const submission = await AssignmentSubmission.findById(submissionId)
            .populate('studentId', 'displayName email photoURL');
        if (!submission) {
            return res.status(404).json({ msg: 'Submission not found' });
        }

        submission.pointsAwarded = pointsAwarded;
        submission.status = 'graded';
        await submission.save();
        await submission.populate('studentId', 'displayName email photoURL');

        res.json(submission);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   PUT /api/classwork/:classId/:assignmentId
// @desc    Update an assignment (Teacher only)
// @access  Private
router.put('/:classId/:assignmentId', auth, async (req, res) => {
    try {
        const { classId, assignmentId } = req.params;
        const { title, description, dueDate, points, allowLateSubmission, showScoreToStudents, attachments } = req.body;

        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        const isCreator = classroom.creator.some(c => c.toString() === req.user.id);
        if (!isCreator) return res.status(403).json({ msg: 'Not authorized' });

        let assignment = await Assignment.findById(assignmentId);
        if (!assignment) return res.status(404).json({ msg: 'Assignment not found' });

        // Update assignment
        assignment.title = title || assignment.title;
        assignment.description = description !== undefined ? description : assignment.description;
        assignment.dueDate = dueDate ? new Date(dueDate) : assignment.dueDate;
        assignment.points = points !== undefined ? points : assignment.points;
        assignment.allowLateSubmission = allowLateSubmission !== undefined ? allowLateSubmission : assignment.allowLateSubmission;
        assignment.showScoreToStudents = showScoreToStudents !== undefined ? showScoreToStudents : assignment.showScoreToStudents;
        if (attachments !== undefined) assignment.attachments = attachments;

        await assignment.save();

        // Update associated stream post
        try {
            const streamPost = await StreamPost.findOne({ assignmentId, classId });
            if (streamPost) {
                streamPost.title = `📋 New Assignment: ${assignment.title}`;
                streamPost.content = assignment.description || '';
                streamPost.assignmentMeta = {
                    points: assignment.points,
                    dueDate: assignment.dueDate
                };
                await streamPost.save();
            }
        } catch (streamErr) {
            console.error('Failed to update stream post:', streamErr);
        }

        res.json(assignment);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/classwork/:classId/:assignmentId
// @desc    Delete an assignment (Teacher only)
// @access  Private
router.delete('/:classId/:assignmentId', auth, async (req, res) => {
    try {
        const { classId, assignmentId } = req.params;

        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        const isCreator = classroom.creator.some(c => c.toString() === req.user.id);
        if (!isCreator) return res.status(403).json({ msg: 'Not authorized' });

        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) return res.status(404).json({ msg: 'Assignment not found' });

        // Delete assignment
        await Assignment.findByIdAndDelete(assignmentId);

        // Delete associated submissions
        await AssignmentSubmission.deleteMany({ assignmentId });

        // Delete associated stream post
        await StreamPost.findOneAndDelete({ assignmentId, classId });

        res.json({ msg: 'Assignment removed' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

module.exports = router; // NOTE: placeholder — moved to end below

// NOTE: Comment endpoints for assignment posts are appended below

// @route   GET /api/classwork/:classId/:assignmentId/comments
// @desc    Get comments for an assignment (fetched from linked StreamPost)
// @access  Private
router.get('/:classId/:assignmentId/comments', auth, async (req, res) => {
    try {
        const { classId, assignmentId } = req.params;

        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        const isCreator = classroom.creator.some(c => c.toString() === req.user.id);
        const isStudent = classroom.participants.some(p => p.toString() === req.user.id);
        if (!isCreator && !isStudent) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        const streamPost = await StreamPost.findOne({ assignmentId, classId }).populate('comments.author', 'displayName photoURL email');
        if (!streamPost) return res.json([]); // No stream post yet, return empty

        res.json(streamPost.comments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   POST /api/classwork/:classId/:assignmentId/comment
// @desc    Add a comment to an assignment post
// @access  Private
router.post('/:classId/:assignmentId/comment', auth, async (req, res) => {
    try {
        const { classId, assignmentId } = req.params;
        const { text } = req.body;

        if (!text || !text.trim()) {
            return res.status(400).json({ msg: 'Comment text is required' });
        }

        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        const isCreator = classroom.creator.some(c => c.toString() === req.user.id);
        const isStudent = classroom.participants.some(p => p.toString() === req.user.id);
        if (!isCreator && !isStudent) {
            return res.status(403).json({ msg: 'Not authorized' });
        }

        const assignment = await Assignment.findById(assignmentId);
        if (!assignment) return res.status(404).json({ msg: 'Assignment not found' });

        // Find the stream post associated with this assignment
        const streamPost = await StreamPost.findOne({ assignmentId, classId });
        if (!streamPost) return res.status(404).json({ msg: 'Assignment stream post not found' });

        streamPost.comments.push({ author: req.user.id, text: text.trim(), createdAt: new Date() });
        await streamPost.save();
        await streamPost.populate('comments.author', 'displayName photoURL email');

        res.json(streamPost.comments);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});

// @route   DELETE /api/classwork/:classId/:assignmentId/comment/:commentId
// @desc    Delete a comment from an assignment (self or teacher)
// @access  Private
router.delete('/:classId/:assignmentId/comment/:commentId', auth, async (req, res) => {
    try {
        const { classId, assignmentId, commentId } = req.params;

        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ msg: 'Classroom not found' });

        const isCreator = classroom.creator.some(c => c.toString() === req.user.id);

        const streamPost = await StreamPost.findOne({ assignmentId, classId });
        if (!streamPost) return res.status(404).json({ msg: 'Assignment stream post not found' });

        const comment = streamPost.comments.id(commentId);
        if (!comment) return res.status(404).json({ msg: 'Comment not found' });

        if (comment.author.toString() !== req.user.id && !isCreator) {
            return res.status(403).json({ msg: 'Not authorized to delete this comment' });
        }

        streamPost.comments = streamPost.comments.filter(c => c._id.toString() !== commentId);
        await streamPost.save();

        res.json({ msg: 'Comment deleted', commentId });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
});
