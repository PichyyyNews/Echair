const express = require('express');
const router = express.Router();
const StreamPost = require('../models/StreamPost');
const Class = require('../models/Class');
const auth = require('../middleware/auth');

// @route   POST /api/stream/:classId
// @desc    Create a new stream post
// @access  Private
router.post('/:classId', auth, async (req, res) => {
    try {
        const { classId } = req.params;
        const { title, content, attachments } = req.body;

        // Verify class exists and user is a creator
        const classroom = await Class.findById(classId);
        if (!classroom) {
            return res.status(404).json({ message: 'Classroom not found' });
        }

        const isCreator = classroom.creator.includes(req.user.id);
        if (!isCreator) {
            return res.status(403).json({ message: 'Only creators can post to the stream' });
        }

        const newPost = new StreamPost({
            classId,
            author: req.user.id,
            title,
            content,
            attachments: attachments || []
        });

        await newPost.save();

        // Populate author before returning
        await newPost.populate('author', 'username displayName photoURL email');

        res.status(201).json(newPost);
    } catch (err) {
        console.error('Error creating stream post:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   GET /api/stream/:classId
// @desc    Get all stream posts for a classroom
// @access  Private
router.get('/:classId', auth, async (req, res) => {
    try {
        const { classId } = req.params;

        // Verify class exists and user is part of it
        const classroom = await Class.findById(classId);
        if (!classroom) {
            return res.status(404).json({ message: 'Classroom not found' });
        }

        const isCreator = classroom.creator.includes(req.user.id);
        const isParticipant = classroom.participants.includes(req.user.id);

        if (!isCreator && !isParticipant) {
            return res.status(403).json({ message: 'Not authorized logic to view stream' });
        }

        const posts = await StreamPost.find({ classId })
            .sort({ createdAt: -1 })
            .populate('author', 'username displayName photoURL email')
            .populate('comments.author', 'username displayName photoURL email');

        res.json(posts);
    } catch (err) {
        console.error('Error fetching stream posts:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   PUT /api/stream/:classId/:postId
// @desc    Update a stream post
// @access  Private
router.put('/:classId/:postId', auth, async (req, res) => {
    try {
        const { classId, postId } = req.params;
        const { title, content, attachments } = req.body;

        const classroom = await Class.findById(classId);
        if (!classroom) {
            return res.status(404).json({ message: 'Classroom not found' });
        }

        const isCreator = classroom.creator.includes(req.user.id);
        const post = await StreamPost.findOne({ _id: postId, classId });
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (!isCreator && post.author.toString() !== req.user.id) {
            return res.status(403).json({ message: 'Not authorized to edit this post' });
        }

        if (title !== undefined) post.title = title;
        if (content !== undefined) post.content = content;
        if (attachments !== undefined) post.attachments = attachments;
        post.updatedAt = new Date();

        await post.save();
        await post.populate('author', 'username displayName photoURL email');
        await post.populate('comments.author', 'username displayName photoURL email');

        res.json(post);
    } catch (err) {
        console.error('Error updating stream post:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/stream/:classId/:postId
// @desc    Delete a stream post
// @access  Private
router.delete('/:classId/:postId', auth, async (req, res) => {
    try {
        const { classId, postId } = req.params;

        const classroom = await Class.findById(classId);
        if (!classroom) {
            return res.status(404).json({ message: 'Classroom not found' });
        }

        const isCreator = classroom.creator.includes(req.user.id);
        if (!isCreator) {
            return res.status(403).json({ message: 'Only creators can delete posts' });
        }

        const post = await StreamPost.findOneAndDelete({ _id: postId, classId });
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        res.json({ message: 'Post deleted' });
    } catch (err) {
        console.error('Error deleting stream post:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   POST /api/stream/:classId/:postId/comment
// @desc    Add a comment to a stream post
// @access  Private
router.post('/:classId/:postId/comment', auth, async (req, res) => {
    try {
        const { classId, postId } = req.params;
        const { text } = req.body;

        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ message: 'Classroom not found' });

        const isCreator = classroom.creator.includes(req.user.id);
        const isParticipant = classroom.participants.includes(req.user.id);

        if (!isCreator && !isParticipant) {
            return res.status(403).json({ message: 'Not authorized to comment' });
        }

        const post = await StreamPost.findOne({ _id: postId, classId });
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const newComment = {
            author: req.user.id,
            text,
            createdAt: new Date()
        };

        post.comments.push(newComment);
        await post.save();

        await post.populate('author', 'username displayName photoURL email');
        await post.populate('comments.author', 'username displayName photoURL email');

        res.json(post);
    } catch (err) {
        console.error('Error adding comment:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// @route   DELETE /api/stream/:classId/:postId/comment/:commentId
// @desc    Delete a comment from a stream post
// @access  Private
router.delete('/:classId/:postId/comment/:commentId', auth, async (req, res) => {
    try {
        const { classId, postId, commentId } = req.params;

        const classroom = await Class.findById(classId);
        if (!classroom) return res.status(404).json({ message: 'Classroom not found' });

        const isCreator = classroom.creator.includes(req.user.id);

        const post = await StreamPost.findOne({ _id: postId, classId });
        if (!post) return res.status(404).json({ message: 'Post not found' });

        const comment = post.comments.find(c => c.id === commentId);
        if (!comment) return res.status(404).json({ message: 'Comment not found' });

        // User can delete their own comment, or creator can delete any comment
        if (comment.author.toString() !== req.user.id && !isCreator) {
            return res.status(403).json({ message: 'Not authorized to delete this comment' });
        }

        post.comments = post.comments.filter(c => c.id !== commentId);
        await post.save();

        res.json({ message: 'Comment deleted', commentId });
    } catch (err) {
        console.error('Error deleting comment:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
