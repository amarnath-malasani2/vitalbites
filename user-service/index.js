require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const UserProfile = require('./models/UserProfile');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('User DB connected'));

// Get user profile
app.get('/api/user/:userId', async (req, res) => {
  const user = await UserProfile.findOne({ userId: req.params.userId });
  res.json(user);
});

// Update user profile
app.put('/api/user/:userId', async (req, res) => {
  const user = await UserProfile.findOneAndUpdate({ userId: req.params.userId }, req.body, { new: true, upsert: true });
  res.json(user);
});

// Get user profile by email (for profile page)
app.get('/api/user/profile/:email', async (req, res) => {
  try {
    // First try to find user in auth service database
    const user = await mongoose.connection.db.collection('users')
      .findOne({ email: req.params.email });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    // Format user data for frontend
    const userData = {
      name: user.username || 'User',
      email: user.email,
      mobile: user.mobile || 'Not provided',
      joinDate: user.createdAt || new Date(),
      addresses: user.addresses || []
    };
    
    res.json(userData);
  } catch (error) {
    console.error('Error fetching user profile:', error);
    res.status(500).json({ error: "Server error" });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'User Service is running' });
});

app.listen(5003, () => console.log('User Service on 5003'));