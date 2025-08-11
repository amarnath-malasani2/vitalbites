require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const Order = require('./models/Order');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Order DB connected'));

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

// Place order
app.post('/api/orders', authenticateToken, async (req, res) => {
  try {
    const { items, deliveryAddress, phone, address, customerNotes, deliveryInstructions } = req.body;
    const userId = req.user.id;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'Order items are required' });
    }

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const deliveryFee = 50; // Fixed delivery fee
    const taxes = subtotal * 0.05; // 5% tax
    const total = subtotal + deliveryFee + taxes;

    // Create order
    const order = await Order.create({
      userId,
      items,
      deliveryAddress: deliveryAddress || {
        street: address,
        mobile: phone
      },
      phone,
      address,
      subtotal,
      deliveryFee,
      taxes,
      total,
      customerNotes,
      deliveryInstructions,
      estimatedDeliveryTime: new Date(Date.now() + 45 * 60 * 1000), // 45 minutes
      statusHistory: [{
        status: 'pending',
        timestamp: new Date(),
        note: 'Order placed successfully'
      }]
    });

    // Send notification about new order
    try {
      await axios.post('http://notification-service:5006/api/notifications/send', {
        userId,
        title: 'Order Placed Successfully!',
        message: `Your order #${order.orderNumber} has been placed and is being processed.`,
        type: 'order_status',
        relatedId: order._id,
        priority: 'medium',
        metadata: {
          actionUrl: `/orders/${order._id}`,
          iconType: 'order'
        }
      });
    } catch (notificationError) {
      console.error('Failed to send order notification:', notificationError.message);
    }

    res.status(201).json({
      success: true,
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        total: order.total,
        estimatedDeliveryTime: order.estimatedDeliveryTime,
        items: order.items
      }
    });

  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ message: 'Failed to create order', error: error.message });
  }
});

// Get user orders
app.get('/api/orders/:userId', async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    
    const query = { userId: req.params.userId };
    if (status) {
      query.status = status;
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalOrders: total
    });
  } catch (error) {
    console.error('Error fetching user orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
});

// Get specific order details
app.get('/api/orders/details/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({ 
      _id: orderId,
      ...(req.user.role === 'admin' || req.user.role === 'super_admin' ? {} : { userId })
    });

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json(order);
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({ message: 'Failed to fetch order details', error: error.message });
  }
});

// Track order status
app.get('/api/orders/track/:orderNumber', async (req, res) => {
  try {
    const { orderNumber } = req.params;

    const order = await Order.findOne({ orderNumber })
      .select('orderNumber status statusHistory estimatedDeliveryTime actualDeliveryTime total items');

    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    res.json({
      orderNumber: order.orderNumber,
      status: order.status,
      statusHistory: order.statusHistory,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      actualDeliveryTime: order.actualDeliveryTime,
      total: order.total,
      items: order.items
    });
  } catch (error) {
    console.error('Error tracking order:', error);
    res.status(500).json({ message: 'Failed to track order', error: error.message });
  }
});

// Admin: get all orders
app.get('/api/orders', requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, status, startDate, endDate, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { orderNumber: { $regex: search, $options: 'i' } },
        { 'deliveryAddress.fullName': { $regex: search, $options: 'i' } },
        { 'items.name': { $regex: search, $options: 'i' } }
      ];
    }

    const orders = await Order.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'username email mobile');

    const total = await Order.countDocuments(query);

    res.json({
      orders,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalOrders: total
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message });
  }
});

// Admin: update order status
app.put('/api/orders/:id', requireAdmin, async (req, res) => {
  try {
    const { status, note } = req.body;
    const orderId = req.params.id;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const oldStatus = order.status;
    order.status = status;

    // Add status history entry
    order.statusHistory.push({
      status,
      timestamp: new Date(),
      note: note || `Status updated to ${status}`,
      updatedBy: req.user.email
    });

    // Set actual delivery time if delivered
    if (status === 'delivered' && !order.actualDeliveryTime) {
      order.actualDeliveryTime = new Date();
    }

    await order.save();

    // Send notification to user about status update
    try {
      const statusMessages = {
        'confirmed': 'Your order has been confirmed and is being prepared.',
        'preparing': 'Your order is now being prepared by our chefs.',
        'ready': 'Your order is ready for pickup/delivery!',
        'out_for_delivery': 'Your order is out for delivery and will reach you soon.',
        'delivered': 'Your order has been delivered. Enjoy your meal!',
        'cancelled': 'Your order has been cancelled. If you have any questions, please contact support.'
      };

      if (statusMessages[status]) {
        await axios.post('http://notification-service:5006/api/notifications/send', {
          userId: order.userId,
          title: `Order Status Updated - ${order.orderNumber}`,
          message: statusMessages[status],
          type: 'order_status',
          relatedId: order._id,
          priority: status === 'delivered' ? 'high' : 'medium',
          metadata: {
            actionUrl: `/orders/${order._id}`,
            iconType: 'order'
          }
        });
      }
    } catch (notificationError) {
      console.error('Failed to send status notification:', notificationError.message);
    }

    res.json({ 
      message: 'Order status updated successfully',
      order: {
        id: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        previousStatus: oldStatus,
        statusHistory: order.statusHistory
      }
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({ message: 'Failed to update order status', error: error.message });
  }
});

// Update payment status
app.put('/api/orders/:orderId/payment-status', async (req, res) => {
  try {
    const { orderId } = req.params;
    const { paymentId, paymentStatus } = req.body;

    const order = await Order.findById(orderId);
    if (!order) {
      return res.status(404).json({ message: 'Order not found' });
    }

    order.paymentId = paymentId;
    order.paymentStatus = paymentStatus;

    // Update order status based on payment
    if (paymentStatus === 'paid' && order.status === 'pending') {
      order.status = 'confirmed';
      order.statusHistory.push({
        status: 'confirmed',
        timestamp: new Date(),
        note: 'Payment confirmed, order confirmed'
      });
    }

    await order.save();
    res.json({ message: 'Payment status updated', order });
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(500).json({ message: 'Failed to update payment status', error: error.message });
  }
});

// Analytics endpoints for admin
app.get('/api/orders/admin/stats', requireAdmin, async (req, res) => {
  try {
    const totalOrders = await Order.countDocuments();
    const totalRevenue = await Order.aggregate([
      { $match: { paymentStatus: 'paid' } },
      { $group: { _id: null, total: { $sum: '$total' } } }
    ]);

    const ordersByStatus = await Order.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    const averageOrderValue = totalRevenue[0] ? totalRevenue[0].total / totalOrders : 0;

    res.json({
      totalOrders,
      totalRevenue: totalRevenue[0]?.total || 0,
      averageOrderValue,
      ordersByStatus
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({ message: 'Failed to fetch order stats', error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Order Service is running' });
});

app.listen(5002, () => console.log('Order Service on 5002'));