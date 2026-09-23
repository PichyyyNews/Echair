const User = require('../models/User');
const { delCache } = require('../utils/cache');

exports.pinClass = async (req, res) => {
    const { classId } = req.body;
    const userId = req.user._id;

    try {
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ msg: 'User not found.' });

        const classIndex = user.pinnedClasses.indexOf(classId);
        if (classIndex > -1) {
            user.pinnedClasses.splice(classIndex, 1);
        } else {
            user.pinnedClasses.push(classId);
        }

        const updatedUser = await user.save();
        await delCache(`user:${userId}`);
        res.json({
            msg: `Class ${classIndex > -1 ? 'unpinned' : 'pinned'} successfully!`,
            user: updatedUser
        });
    } catch (err) {
        res.status(500).send('Server error');
    }
};

exports.togglePinClass = async (req, res) => {
    try {
        const userId = req.user._id;
        const { classId } = req.params;
        const user = await User.findById(userId);

        if (!user) return res.status(404).json({ msg: 'User not found' });

        const isPinned = user.pinnedClasses.includes(classId);

        if (isPinned) {
            user.pinnedClasses.pull(classId);
        } else {
            user.pinnedClasses.push(classId);
        }

        await user.save();
        await delCache(`user:${userId}`);

        const updatedUser = {
            id: user._id,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            uid: user.uid,
            pinnedClasses: user.pinnedClasses,
        };

        res.status(200).json({ msg: 'Pinned status updated successfully!', user: updatedUser });
    } catch (err) {
        res.status(500).send('Server error');
    }
};
