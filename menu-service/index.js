require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const MenuItem = require('./models/MenuItem');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Menu DB connected'));

// Get all menu items
app.get('/api/menu', async (req, res) => {
  const items = await MenuItem.find();
  res.json(items);
});

// Add menu item (admin)
app.post('/api/menu', async (req, res) => {
  const item = await MenuItem.create(req.body);
  res.status(201).json(item);
});

// Update menu item (admin)
app.put('/api/menu/:id', async (req, res) => {
  const item = await MenuItem.findByIdAndUpdate(req.params.id, req.body, { new: true });
  res.json(item);
});

// Delete menu item (admin)
app.delete('/api/menu/:id', async (req, res) => {
  await MenuItem.findByIdAndDelete(req.params.id);
  res.json({ message: 'Deleted' });
});

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    // Check database connectivity
    await mongoose.connection.db.admin().ping();
    res.json({
      status: 'healthy',
      service: 'menu-service',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      database: 'connected',
      version: '1.0.0'
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      service: 'menu-service',
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

app.listen(5001, () => console.log('Menu Service on 5001'));