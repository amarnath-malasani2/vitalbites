const mongoose = require('mongoose');

const PaymentTransactionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true
  },
  razorpayPaymentId: {
    type: String,
    sparse: true // Allow null but enforce uniqueness when present
  },
  razorpaySignature: String,
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'attempted', 'paid', 'failed', 'refunded'],
    default: 'created'
  },
  paymentMethod: {
    type: {
      type: String // card, upi, netbanking, wallet
    },
    details: mongoose.Schema.Types.Mixed
  },
  failureReason: String,
  refundDetails: {
    amount: Number,
    refundId: String,
    status: String,
    processedAt: Date
  },
  metadata: {
    userAgent: String,
    ipAddress: String,
    customerDetails: {
      name: String,
      email: String,
      contact: String
    }
  }
}, {
  timestamps: true
});

// Indexes for performance
PaymentTransactionSchema.index({ userId: 1, createdAt: -1 });
PaymentTransactionSchema.index({ status: 1 });
PaymentTransactionSchema.index({ razorpayOrderId: 1 });

module.exports = mongoose.model('PaymentTransaction', PaymentTransactionSchema);