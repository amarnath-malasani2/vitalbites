require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { Server } = require('socket.io');
const http = require('http');
const Redis = require('ioredis');
const Notification = require('./models/Notification');

const app = express();
const server = http.createServer(app);

// CORS configuration for Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost",
    methods: ["GET", "POST"]
  }
});

app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Notification DB connected'));

// Connect to Redis
const redis = new Redis(process.env.REDIS_URL);

const JWT_SECRET = process.env.JWT_SECRET;

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

// Socket.IO authentication middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication error'));
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error'));
    }
    socket.userId = decoded.id;
    next();
  });
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`User ${socket.userId} connected`);
  
  // Join user to their personal room
  socket.join(`user_${socket.userId}`);
  
  // Store connection in Redis for scaling
  redis.sadd(`connected_users`, socket.userId);
  redis.hset(`user_sockets`, socket.userId, socket.id);
  
  socket.on('disconnect', () => {
    console.log(`User ${socket.userId} disconnected`);
    redis.srem(`connected_users`, socket.userId);
    redis.hdel(`user_sockets`, socket.userId);
  });
  
  // Handle notification read status
  socket.on('mark_read', async (notificationId) => {
    try {
      await Notification.findByIdAndUpdate(
        notificationId,
        { status: 'read', readAt: new Date() },
        { new: true }
      );
      socket.emit('notification_updated', { id: notificationId, status: 'read' });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Notification Service is running' });
});

// Get user notifications
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 20, status = 'all', type } = req.query;

    const query = { userId };
    if (status !== 'all') {
      query.status = status;
    }
    if (type) {
      query.type = type;
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ userId, status: 'unread' });

    res.json({
      notifications,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalNotifications: total,
      unreadCount
    });

  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ message: 'Failed to fetch notifications', error: error.message });
  }
});

// Mark notification as read
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { status: 'read', readAt: new Date() },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification marked as read', notification });

  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ message: 'Failed to mark notification as read', error: error.message });
  }
});

// Mark all notifications as read
app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    await Notification.updateMany(
      { userId, status: 'unread' },
      { status: 'read', readAt: new Date() }
    );

    res.json({ message: 'All notifications marked as read' });

  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ message: 'Failed to mark all notifications as read', error: error.message });
  }
});

// Delete notification
app.delete('/api/notifications/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const notification = await Notification.findOneAndDelete({ _id: id, userId });

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ message: 'Notification deleted successfully' });

  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ message: 'Failed to delete notification', error: error.message });
  }
});

// Send notification (internal API)
app.post('/api/notifications/send', async (req, res) => {
  try {
    const { userId, title, message, type, relatedId, priority, metadata, deliveryOptions } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ message: 'UserId, title, and message are required' });
    }

    // Create notification in database
    const notification = new Notification({
      userId,
      title,
      message,
      type: type || 'system',
      relatedId,
      priority: priority || 'medium',
      metadata,
      deliveryStatus: {
        realTime: deliveryOptions?.realTime !== false,
        email: deliveryOptions?.email || false,
        push: deliveryOptions?.push || false
      }
    });

    await notification.save();

    // Send real-time notification via Socket.IO
    if (notification.deliveryStatus.realTime) {
      io.to(`user_${userId}`).emit('new_notification', {
        id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        metadata: notification.metadata,
        createdAt: notification.createdAt
      });
    }

    res.json({ message: 'Notification sent successfully', notification });

  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ message: 'Failed to send notification', error: error.message });
  }
});

// Bulk send notifications
app.post('/api/notifications/bulk-send', async (req, res) => {
  try {
    const { userIds, title, message, type, priority, metadata } = req.body;

    if (!userIds || !Array.isArray(userIds) || !title || !message) {
      return res.status(400).json({ message: 'UserIds array, title, and message are required' });
    }

    const notifications = userIds.map(userId => ({
      userId,
      title,
      message,
      type: type || 'system',
      priority: priority || 'medium',
      metadata,
      deliveryStatus: { realTime: true, email: false, push: false }
    }));

    const savedNotifications = await Notification.insertMany(notifications);

    // Send real-time notifications
    userIds.forEach((userId, index) => {
      io.to(`user_${userId}`).emit('new_notification', {
        id: savedNotifications[index]._id,
        title,
        message,
        type: type || 'system',
        priority: priority || 'medium',
        metadata,
        createdAt: savedNotifications[index].createdAt
      });
    });

    res.json({ 
      message: 'Bulk notifications sent successfully', 
      count: savedNotifications.length 
    });

  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    res.status(500).json({ message: 'Failed to send bulk notifications', error: error.message });
  }
});

// Get notification statistics
app.get('/api/notifications/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;

    const stats = await Notification.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const typeStats = await Notification.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 }
        }
      }
    ]);

    res.json({ statusStats: stats, typeStats });

  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ message: 'Failed to fetch notification stats', error: error.message });
  }
});

const PORT = process.env.NOTIFICATION_SERVICE_PORT || 5006;
server.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);
});