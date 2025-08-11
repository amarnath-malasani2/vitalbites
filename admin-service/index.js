require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const axios = require('axios');
const AdminUser = require('./models/AdminUser');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Admin DB connected'));

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

// Admin role middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || (req.user.role !== 'admin' && req.user.role !== 'super_admin')) {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};

// Permission checking middleware
const requirePermission = (resource, action) => {
  return (req, res, next) => {
    if (req.user.role === 'super_admin') {
      return next(); // Super admin has all permissions
    }
    
    const permission = req.user.permissions?.find(p => p.resource === resource);
    if (!permission || !permission.actions.includes(action)) {
      return res.status(403).json({ message: `Permission denied: ${action} on ${resource}` });
    }
    
    next();
  };
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Admin Service is running' });
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const admin = await AdminUser.findOne({ email, status: 'active' });
    if (!admin) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, admin.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    // Update last login
    admin.lastLogin = new Date();
    admin.loginHistory.push({
      timestamp: new Date(),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
    await admin.save();

    const token = jwt.sign({
      id: admin._id,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions
    }, JWT_SECRET, { expiresIn: '8h' });

    res.json({
      token,
      admin: {
        id: admin._id,
        username: admin.username,
        email: admin.email,
        role: admin.role,
        permissions: admin.permissions,
        profile: admin.profile
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
});

// Get dashboard statistics
app.get('/api/admin/dashboard/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // Fetch stats from various services
    const stats = {};

    // Users stats
    try {
      const userResponse = await axios.get('http://auth-service:5000/api/auth/admin/users/count');
      stats.users = userResponse.data;
    } catch (error) {
      stats.users = { total: 0, error: 'Service unavailable' };
    }

    // Orders stats
    try {
      const orderResponse = await axios.get('http://order-service:5002/api/orders/admin/stats');
      stats.orders = orderResponse.data;
    } catch (error) {
      stats.orders = { total: 0, error: 'Service unavailable' };
    }

    // Menu items stats
    try {
      const menuResponse = await axios.get('http://menu-service:5001/api/menu/admin/stats');
      stats.menu = menuResponse.data;
    } catch (error) {
      stats.menu = { total: 0, error: 'Service unavailable' };
    }

    // Payment stats
    try {
      const paymentResponse = await axios.get('http://payment-service:5005/api/payments/admin/stats');
      stats.payments = paymentResponse.data;
    } catch (error) {
      stats.payments = { total: 0, error: 'Service unavailable' };
    }

    res.json(stats);

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ message: 'Failed to fetch dashboard stats', error: error.message });
  }
});

// User management endpoints
app.get('/api/admin/users', authenticateToken, requireAdmin, requirePermission('users', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, status } = req.query;

    // Forward request to auth service
    const response = await axios.get('http://auth-service:5000/api/auth/admin/users', {
      params: { page, limit, search, status }
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ message: 'Failed to fetch users', error: error.message });
  }
});

// Order management endpoints
app.get('/api/admin/orders', authenticateToken, requireAdmin, requirePermission('orders', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate } = req.query;

    // Forward request to order service
    const response = await axios.get('http://order-service:5002/api/orders/admin', {
      params: { page, limit, status, startDate, endDate }
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
});

app.put('/api/admin/orders/:orderId/status', authenticateToken, requireAdmin, requirePermission('orders', 'write'), async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;

    // Forward request to order service
    const response = await axios.put(`http://order-service:5002/api/orders/${orderId}/status`, {
      status
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Failed to update order status', error: error.message });
  }
});

// Menu management endpoints
app.get('/api/admin/menu', authenticateToken, requireAdmin, requirePermission('menu', 'read'), async (req, res) => {
  try {
    const { page = 1, limit = 20, search, category } = req.query;

    // Forward request to menu service
    const response = await axios.get('http://menu-service:5001/api/menu/admin', {
      params: { page, limit, search, category }
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ message: 'Failed to fetch menu items', error: error.message });
  }
});

app.post('/api/admin/menu', authenticateToken, requireAdmin, requirePermission('menu', 'write'), async (req, res) => {
  try {
    // Forward request to menu service
    const response = await axios.post('http://menu-service:5001/api/menu/admin', req.body);
    res.json(response.data);

  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ message: 'Failed to create menu item', error: error.message });
  }
});

app.put('/api/admin/menu/:itemId', authenticateToken, requireAdmin, requirePermission('menu', 'write'), async (req, res) => {
  try {
    const { itemId } = req.params;

    // Forward request to menu service
    const response = await axios.put(`http://menu-service:5001/api/menu/admin/${itemId}`, req.body);
    res.json(response.data);

  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ message: 'Failed to update menu item', error: error.message });
  }
});

app.delete('/api/admin/menu/:itemId', authenticateToken, requireAdmin, requirePermission('menu', 'delete'), async (req, res) => {
  try {
    const { itemId } = req.params;

    // Forward request to menu service
    const response = await axios.delete(`http://menu-service:5001/api/menu/admin/${itemId}`);
    res.json(response.data);

  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ message: 'Failed to delete menu item', error: error.message });
  }
});

// Bulk notification sending
app.post('/api/admin/notifications/bulk', authenticateToken, requireAdmin, requirePermission('notifications', 'write'), async (req, res) => {
  try {
    const { userIds, title, message, type, priority } = req.body;

    // Forward request to notification service
    const response = await axios.post('http://notification-service:5006/api/notifications/bulk-send', {
      userIds,
      title,
      message,
      type,
      priority
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    res.status(500).json({ message: 'Failed to send bulk notifications', error: error.message });
  }
});

// Analytics endpoints
app.get('/api/admin/analytics/sales', authenticateToken, requireAdmin, requirePermission('analytics', 'read'), async (req, res) => {
  try {
    const { period = '7d', startDate, endDate } = req.query;

    // Forward request to analytics service
    const response = await axios.get('http://analytics-service:5008/api/analytics/sales', {
      params: { period, startDate, endDate }
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({ message: 'Failed to fetch sales analytics', error: error.message });
  }
});

app.get('/api/admin/analytics/users', authenticateToken, requireAdmin, requirePermission('analytics', 'read'), async (req, res) => {
  try {
    const { period = '30d' } = req.query;

    // Forward request to analytics service
    const response = await axios.get('http://analytics-service:5008/api/analytics/users', {
      params: { period }
    });

    res.json(response.data);

  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({ message: 'Failed to fetch user analytics', error: error.message });
  }
});

// Admin user management
app.get('/api/admin/admins', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Super admin access required' });
    }

    const admins = await AdminUser.find()
      .select('-password')
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 });

    res.json(admins);

  } catch (error) {
    console.error('Error fetching admin users:', error);
    res.status(500).json({ message: 'Failed to fetch admin users', error: error.message });
  }
});

app.post('/api/admin/admins', authenticateToken, requireAdmin, async (req, res) => {
  try {
    if (req.user.role !== 'super_admin') {
      return res.status(403).json({ message: 'Super admin access required' });
    }

    const { username, email, password, role, permissions, profile } = req.body;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newAdmin = new AdminUser({
      username,
      email,
      password: hashedPassword,
      role,
      permissions,
      profile,
      createdBy: req.user.id
    });

    await newAdmin.save();

    res.status(201).json({
      message: 'Admin user created successfully',
      admin: {
        id: newAdmin._id,
        username: newAdmin.username,
        email: newAdmin.email,
        role: newAdmin.role
      }
    });

  } catch (error) {
    console.error('Error creating admin user:', error);
    res.status(500).json({ message: 'Failed to create admin user', error: error.message });
  }
});

const PORT = process.env.ADMIN_SERVICE_PORT || 5007;
app.listen(PORT, () => {
  console.log(`Admin Service running on port ${PORT}`);
});