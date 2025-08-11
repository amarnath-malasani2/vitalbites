require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const Order = require('./models/Order');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Order DB connected'));

// Place order
app.post('/api/orders', async (req, res) => {
  const { userId, items, address, phone, total } = req.body;
  const order = await Order.create({ userId, items, address, phone, total });
  res.status(201).json(order);
});

// Get user orders
app.get('/api/orders/:userId', async (req, res) => {
  const orders = await Order.find({ userId: req.params.userId });
  res.json(orders);
});

// Admin: get all orders
app.get('/api/orders', async (req, res) => {
  const orders = await Order.find();
  res.json(orders);
});

// Admin: update order status
app.put('/api/orders/:id', async (req, res) => {
  const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(order);
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    await mongoose.connection.db.admin().ping();
    res.json({
      status: 'healthy',
      service: 'order-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'order-service',
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

app.listen(5002, () => console.log('Order Service on 5002'));