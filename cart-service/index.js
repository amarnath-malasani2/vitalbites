require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cartRoutes = require('./routes/cart');

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

// Health check
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    await mongoose.connection.db.admin().ping();
    res.json({
      status: 'healthy',
      service: 'cart-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'cart-service',
      timestamp: new Date().toISOString(),
      error: error.message,
      database: 'disconnected'
    });
  }
});

// Readiness probe
app.get('/ready', async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.json({ ready: true, timestamp: new Date().toISOString() });
  } catch (error) {
    res.status(503).json({ 
      ready: false, 
      error: error.message,
      timestamp: new Date().toISOString() 
    });
  }
});

// Liveness probe
app.get('/live', (req, res) => {
  res.json({ 
    alive: true, 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

const PORT = process.env.PORT || 5004;
app.listen(PORT, () => console.log(`Cart Service running on port ${PORT}`));
