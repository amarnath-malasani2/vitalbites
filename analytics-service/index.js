require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Analytics DB connected'));

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

// Helper function to get date range
const getDateRange = (period) => {
  const endDate = new Date();
  let startDate = new Date();

  switch (period) {
    case '1d':
      startDate.setDate(endDate.getDate() - 1);
      break;
    case '7d':
      startDate.setDate(endDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(endDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(endDate.getDate() - 90);
      break;
    case '1y':
      startDate.setFullYear(endDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(endDate.getDate() - 7);
  }

  return { startDate, endDate };
};

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Analytics Service is running' });
});

// Sales analytics
app.get('/api/analytics/sales', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '7d', startDate: customStart, endDate: customEnd } = req.query;
    
    let dateRange;
    if (customStart && customEnd) {
      dateRange = { startDate: new Date(customStart), endDate: new Date(customEnd) };
    } else {
      dateRange = getDateRange(period);
    }

    // Fetch orders data from order service
    const orderResponse = await axios.get('http://order-service:5002/api/orders/admin/analytics', {
      params: { 
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString()
      }
    });

    // Fetch payment data from payment service
    const paymentResponse = await axios.get('http://payment-service:5005/api/payments/admin/analytics', {
      params: { 
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString()
      }
    });

    const salesData = {
      period,
      dateRange,
      orders: orderResponse.data || {},
      payments: paymentResponse.data || {},
      summary: {
        totalRevenue: paymentResponse.data?.totalRevenue || 0,
        totalOrders: orderResponse.data?.totalOrders || 0,
        averageOrderValue: orderResponse.data?.averageOrderValue || 0,
        successfulPayments: paymentResponse.data?.successfulPayments || 0,
        failedPayments: paymentResponse.data?.failedPayments || 0
      }
    };

    res.json(salesData);

  } catch (error) {
    console.error('Error fetching sales analytics:', error);
    res.status(500).json({ message: 'Failed to fetch sales analytics', error: error.message });
  }
});

// User analytics
app.get('/api/analytics/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const dateRange = getDateRange(period);

    // Fetch user data from auth service
    const userResponse = await axios.get('http://auth-service:5000/api/auth/admin/analytics/users', {
      params: { 
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString()
      }
    });

    const userData = {
      period,
      dateRange,
      ...userResponse.data
    };

    res.json(userData);

  } catch (error) {
    console.error('Error fetching user analytics:', error);
    res.status(500).json({ message: 'Failed to fetch user analytics', error: error.message });
  }
});

// Menu item analytics
app.get('/api/analytics/menu', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const dateRange = getDateRange(period);

    // Fetch order data to analyze popular items
    const orderResponse = await axios.get('http://order-service:5002/api/orders/admin/analytics/items', {
      params: { 
        startDate: dateRange.startDate.toISOString(),
        endDate: dateRange.endDate.toISOString()
      }
    });

    const menuData = {
      period,
      dateRange,
      popularItems: orderResponse.data?.popularItems || [],
      categoryStats: orderResponse.data?.categoryStats || [],
      revenueByItem: orderResponse.data?.revenueByItem || []
    };

    res.json(menuData);

  } catch (error) {
    console.error('Error fetching menu analytics:', error);
    res.status(500).json({ message: 'Failed to fetch menu analytics', error: error.message });
  }
});

// Customer behavior analytics
app.get('/api/analytics/customers', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '30d' } = req.query;
    const dateRange = getDateRange(period);

    // Fetch data from multiple services
    const [orderResponse, userResponse] = await Promise.all([
      axios.get('http://order-service:5002/api/orders/admin/analytics/customers', {
        params: { 
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString()
        }
      }),
      axios.get('http://auth-service:5000/api/auth/admin/analytics/customers', {
        params: { 
          startDate: dateRange.startDate.toISOString(),
          endDate: dateRange.endDate.toISOString()
        }
      })
    ]);

    const customerData = {
      period,
      dateRange,
      repeatCustomers: orderResponse.data?.repeatCustomers || 0,
      newCustomers: userResponse.data?.newCustomers || 0,
      customerLifetimeValue: orderResponse.data?.customerLifetimeValue || 0,
      averageOrderFrequency: orderResponse.data?.averageOrderFrequency || 0,
      topCustomers: orderResponse.data?.topCustomers || []
    };

    res.json(customerData);

  } catch (error) {
    console.error('Error fetching customer analytics:', error);
    res.status(500).json({ message: 'Failed to fetch customer analytics', error: error.message });
  }
});

// Real-time dashboard metrics
app.get('/api/analytics/dashboard/realtime', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    // Fetch real-time data from various services
    const [
      ordersToday,
      paymentsToday,
      activeUsers
    ] = await Promise.all([
      axios.get('http://order-service:5002/api/orders/admin/analytics/today'),
      axios.get('http://payment-service:5005/api/payments/admin/analytics/today'),
      axios.get('http://auth-service:5000/api/auth/admin/analytics/active-users')
    ]);

    const realtimeData = {
      timestamp: new Date(),
      todayStats: {
        orders: ordersToday.data || { count: 0, revenue: 0 },
        payments: paymentsToday.data || { successful: 0, failed: 0, total: 0 },
        activeUsers: activeUsers.data || { count: 0 }
      },
      trends: {
        ordersGrowth: ordersToday.data?.growth || 0,
        revenueGrowth: paymentsToday.data?.revenueGrowth || 0,
        userGrowth: activeUsers.data?.growth || 0
      }
    };

    res.json(realtimeData);

  } catch (error) {
    console.error('Error fetching realtime analytics:', error);
    res.status(500).json({ message: 'Failed to fetch realtime analytics', error: error.message });
  }
});

// Generate comprehensive report
app.get('/api/analytics/reports/comprehensive', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { period = '30d', startDate: customStart, endDate: customEnd } = req.query;
    
    let dateRange;
    if (customStart && customEnd) {
      dateRange = { startDate: new Date(customStart), endDate: new Date(customEnd) };
    } else {
      dateRange = getDateRange(period);
    }

    // Fetch data from all analytics endpoints
    const [salesData, userData, menuData, customerData] = await Promise.all([
      axios.get(`http://localhost:${process.env.ANALYTICS_SERVICE_PORT || 5008}/api/analytics/sales`, {
        params: { period, startDate: customStart, endDate: customEnd },
        headers: req.headers
      }),
      axios.get(`http://localhost:${process.env.ANALYTICS_SERVICE_PORT || 5008}/api/analytics/users`, {
        params: { period },
        headers: req.headers
      }),
      axios.get(`http://localhost:${process.env.ANALYTICS_SERVICE_PORT || 5008}/api/analytics/menu`, {
        params: { period },
        headers: req.headers
      }),
      axios.get(`http://localhost:${process.env.ANALYTICS_SERVICE_PORT || 5008}/api/analytics/customers`, {
        params: { period },
        headers: req.headers
      })
    ]);

    const comprehensiveReport = {
      period,
      dateRange,
      generatedAt: new Date(),
      sales: salesData.data,
      users: userData.data,
      menu: menuData.data,
      customers: customerData.data,
      summary: {
        totalRevenue: salesData.data?.summary?.totalRevenue || 0,
        totalOrders: salesData.data?.summary?.totalOrders || 0,
        newUsers: userData.data?.newUsers || 0,
        repeatCustomers: customerData.data?.repeatCustomers || 0
      }
    };

    res.json(comprehensiveReport);

  } catch (error) {
    console.error('Error generating comprehensive report:', error);
    res.status(500).json({ message: 'Failed to generate comprehensive report', error: error.message });
  }
});

const PORT = process.env.ANALYTICS_SERVICE_PORT || 5008;
app.listen(PORT, () => {
  console.log(`Analytics Service running on port ${PORT}`);
});