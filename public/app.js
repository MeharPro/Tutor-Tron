const express = require('express');
const cors = require('cors');
const path = require('path');
const { connect: connectDB } = require('./config/database');
const { router: authRouter } = require('./routes/auth');
const linksRouter = require('./routes/links');

const app = express();

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Connect to MongoDB using the configuration
connectDB()
    .then(() => console.log('Database connection ready'))
    .catch(err => {
        console.error('Database connection failed:', err);
        process.exit(1);
    });

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/api/auth', authRouter);
app.use('/api/links', linksRouter);

// Handle SPA routing - send all requests to index.html
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
}); 