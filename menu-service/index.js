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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Menu Service is running' });
});

app.listen(5001, () => console.log('Menu Service on 5001'));