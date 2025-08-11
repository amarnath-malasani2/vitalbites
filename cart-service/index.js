require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cartRoutes = require('./routes/cart');
const favoriteRoutes = require('./routes/favorites');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URL || 'mongodb://localhost:27017/cartdb', {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => console.log('Cart DB connected'));

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

// JWT Middleware
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ message: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// Routes
app.use('/api/cart', authenticateToken, cartRoutes);
app.use('/api/favorites', authenticateToken, favoriteRoutes);

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'Cart Service is running' });
});

const PORT = process.env.PORT || 5004;
app.listen(PORT, () => console.log(`Cart Service running on port ${PORT}`));
