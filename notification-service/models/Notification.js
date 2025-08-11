const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['order_status', 'payment', 'delivery', 'promotion', 'system'],
    default: 'system'
  },
  relatedId: {
    type: mongoose.Schema.Types.ObjectId, // Could be orderId, paymentId, etc.
    sparse: true
  },
  status: {
    type: String,
    enum: ['unread', 'read', 'archived'],
    default: 'unread'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium'
  },
  metadata: {
    actionUrl: String, // URL to navigate when notification is clicked
    iconType: String, // Icon to show in notification
    category: String
  },
  deliveryStatus: {
    realTime: { type: Boolean, default: false },
    email: { type: Boolean, default: false },
    push: { type: Boolean, default: false }
  },
  expiresAt: Date,
  readAt: Date
}, {
  timestamps: true
});

// Indexes for performance
NotificationSchema.index({ userId: 1, status: 1, createdAt: -1 });
NotificationSchema.index({ type: 1 });
NotificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Notification', NotificationSchema);