const express = require('express');
const router = express.Router();
const { authenticateToken } = require('./auth');
const Teacher = require('../../models/Teacher');

// Get all links for a teacher
router.get('/', authenticateToken, async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.teacher._id);
        res.json(teacher.links);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Create new link
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { subject, prompt } = req.body;
        const teacher = await Teacher.findById(req.teacher._id);
        
        const newLink = {
            id: 'tt-' + Date.now().toString(36) + Math.random().toString(36).substr(2),
            subject,
            prompt,
            created: new Date()
        };

        teacher.links.push(newLink);
        await teacher.save();
        
        res.status(201).json(newLink);
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Delete link
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const teacher = await Teacher.findById(req.teacher._id);
        teacher.links = teacher.links.filter(link => link.id !== req.params.id);
        await teacher.save();
        res.json({ message: 'Link deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router; 