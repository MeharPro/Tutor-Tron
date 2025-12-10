const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Teacher = require('../../models/Teacher');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const REGISTRATION_ACCESS_CODE = process.env.REGISTRATION_ACCESS_CODE || 'your-access-code';

// Middleware to verify JWT token
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access denied' });
    }

    try {
        const verified = jwt.verify(token, JWT_SECRET);
        req.teacher = await Teacher.findById(verified.id);
        next();
    } catch (error) {
        res.status(401).json({ message: 'Invalid token' });
    }
};

// Login route
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const teacher = await Teacher.findOne({ email });

        if (!teacher) {
            return res.status(400).json({ message: 'Teacher not found' });
        }

        const validPassword = await teacher.comparePassword(password);
        if (!validPassword) {
            return res.status(400).json({ message: 'Invalid password' });
        }

        const token = jwt.sign({ id: teacher._id }, JWT_SECRET);
        res.json({ token, name: teacher.name });

    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Register route
router.post('/register', async (req, res) => {
    try {
        const { name, email, password, school, accessCode } = req.body;

        if (accessCode !== REGISTRATION_ACCESS_CODE) {
            return res.status(400).json({ message: 'Invalid access code' });
        }

        const existingTeacher = await Teacher.findOne({ email });
        if (existingTeacher) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        const teacher = new Teacher({
            name,
            email,
            password,
            school
        });

        await teacher.save();
        res.status(201).json({ message: 'Registration successful' });

    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
});

// Verify token route
router.get('/verify', authenticateToken, (req, res) => {
    res.json({ valid: true, teacher: { name: req.teacher.name, email: req.teacher.email } });
});

module.exports = { router, authenticateToken }; 