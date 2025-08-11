const mongoose = require('mongoose');

const AdminUserSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  role: {
    type: String,
    enum: ['super_admin', 'admin', 'manager', 'staff'],
    default: 'staff'
  },
  permissions: [{
    resource: String, // users, orders, menu, analytics, etc.
    actions: [String] // read, write, delete, manage
  }],
  profile: {
    firstName: String,
    lastName: String,
    phone: String,
    avatar: String,
    department: String
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active'
  },
  lastLogin: Date,
  loginHistory: [{
    timestamp: Date,
    ipAddress: String,
    userAgent: String
  }],
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AdminUser'
  }
}, {
  timestamps: true
});

// Index for performance
AdminUserSchema.index({ email: 1 });
AdminUserSchema.index({ username: 1 });
AdminUserSchema.index({ role: 1 });

module.exports = mongoose.model('AdminUser', AdminUserSchema);