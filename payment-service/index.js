require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const PaymentTransaction = require('./models/PaymentTransaction');

const app = express();
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URL, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log('Payment DB connected'));

// Initialize Razorpay
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET
});

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

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Payment Service is running' });
});

// Create Razorpay Order
app.post('/api/payments/create-order', authenticateToken, async (req, res) => {
  try {
    const { amount, orderId, customerDetails } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!amount || !orderId) {
      return res.status(400).json({ message: 'Amount and Order ID are required' });
    }

    // Create Razorpay order
    const razorpayOrder = await razorpay.orders.create({
      amount: Math.round(amount * 100), // Convert to paise
      currency: 'INR',
      receipt: `order_${orderId}_${Date.now()}`,
      payment_capture: 1
    });

    // Save transaction to database
    const transaction = new PaymentTransaction({
      userId,
      orderId,
      razorpayOrderId: razorpayOrder.id,
      amount,
      status: 'created',
      metadata: {
        userAgent: req.headers['user-agent'],
        ipAddress: req.ip,
        customerDetails
      }
    });

    await transaction.save();

    res.json({
      success: true,
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      key: process.env.RAZORPAY_KEY_ID
    });

  } catch (error) {
    console.error('Error creating payment order:', error);
    res.status(500).json({ message: 'Failed to create payment order', error: error.message });
  }
});

// Verify Payment
app.post('/api/payments/verify', authenticateToken, async (req, res) => {
  try {
    const { razorpayOrderId, razorpayPaymentId, razorpaySignature } = req.body;
    const userId = req.user.id;

    // Find transaction
    const transaction = await PaymentTransaction.findOne({ 
      razorpayOrderId, 
      userId 
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    // Verify signature
    const body = razorpayOrderId + '|' + razorpayPaymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest('hex');

    if (expectedSignature === razorpaySignature) {
      // Payment successful
      transaction.razorpayPaymentId = razorpayPaymentId;
      transaction.razorpaySignature = razorpaySignature;
      transaction.status = 'paid';
      await transaction.save();

      res.json({
        success: true,
        message: 'Payment verified successfully',
        transactionId: transaction._id
      });
    } else {
      // Payment verification failed
      transaction.status = 'failed';
      transaction.failureReason = 'Signature verification failed';
      await transaction.save();

      res.status(400).json({
        success: false,
        message: 'Payment verification failed'
      });
    }

  } catch (error) {
    console.error('Error verifying payment:', error);
    res.status(500).json({ message: 'Payment verification failed', error: error.message });
  }
});

// Get payment status
app.get('/api/payments/status/:orderId', authenticateToken, async (req, res) => {
  try {
    const { orderId } = req.params;
    const userId = req.user.id;

    const transaction = await PaymentTransaction.findOne({ 
      orderId, 
      userId 
    });

    if (!transaction) {
      return res.status(404).json({ message: 'Transaction not found' });
    }

    res.json({
      status: transaction.status,
      amount: transaction.amount,
      currency: transaction.currency,
      razorpayOrderId: transaction.razorpayOrderId,
      razorpayPaymentId: transaction.razorpayPaymentId,
      createdAt: transaction.createdAt,
      updatedAt: transaction.updatedAt
    });

  } catch (error) {
    console.error('Error fetching payment status:', error);
    res.status(500).json({ message: 'Failed to fetch payment status', error: error.message });
  }
});

// Get payment history for user
app.get('/api/payments/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    const query = { userId };
    if (status) {
      query.status = status;
    }

    const transactions = await PaymentTransaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('orderId');

    const total = await PaymentTransaction.countDocuments(query);

    res.json({
      transactions,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalTransactions: total
    });

  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ message: 'Failed to fetch payment history', error: error.message });
  }
});

// Handle payment failure
app.post('/api/payments/failure', authenticateToken, async (req, res) => {
  try {
    const { razorpayOrderId, error } = req.body;
    const userId = req.user.id;

    const transaction = await PaymentTransaction.findOne({ 
      razorpayOrderId, 
      userId 
    });

    if (transaction) {
      transaction.status = 'failed';
      transaction.failureReason = error?.description || 'Payment failed';
      await transaction.save();
    }

    res.json({ message: 'Payment failure recorded' });

  } catch (error) {
    console.error('Error handling payment failure:', error);
    res.status(500).json({ message: 'Failed to handle payment failure', error: error.message });
  }
});

// Admin: Get all transactions
app.get('/api/payments/admin/transactions', authenticateToken, async (req, res) => {
  try {
    // Check if user is admin (you might want to implement proper role checking)
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required' });
    }

    const { page = 1, limit = 20, status, startDate, endDate } = req.query;

    const query = {};
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const transactions = await PaymentTransaction.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('userId', 'username email')
      .populate('orderId');

    const total = await PaymentTransaction.countDocuments(query);

    // Calculate statistics
    const stats = await PaymentTransaction.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);

    res.json({
      transactions,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      totalTransactions: total,
      statistics: stats
    });

  } catch (error) {
    console.error('Error fetching admin transactions:', error);
    res.status(500).json({ message: 'Failed to fetch transactions', error: error.message });
  }
});

const PORT = process.env.PAYMENT_SERVICE_PORT || 5005;
app.listen(PORT, () => {
  console.log(`Payment Service running on port ${PORT}`);
});