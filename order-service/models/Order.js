const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  items: [{
    menuItemId: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    },
    price: {
      type: Number,
      required: true
    },
    quantity: {
      type: Number,
      required: true,
      min: 1
    },
    image: String,
    restaurant: String,
    category: String
  }],
  orderNumber: {
    type: String,
    unique: true,
    required: true
  },
  deliveryAddress: {
    fullName: String,
    mobile: String,
    street: String,
    city: String,
    state: String,
    pincode: String,
    deliveryInstructions: String
  },
  phone: String, // Deprecated, use deliveryAddress.mobile
  address: String, // Deprecated, use deliveryAddress
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  statusHistory: [{
    status: String,
    timestamp: Date,
    note: String,
    updatedBy: String
  }],
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    sparse: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending'
  },
  total: {
    type: Number,
    required: true
  },
  subtotal: Number,
  deliveryFee: Number,
  taxes: Number,
  discountAmount: Number,
  discountCode: String,
  estimatedDeliveryTime: Date,
  actualDeliveryTime: Date,
  preparationTime: Number, // in minutes
  deliveryInstructions: String,
  customerNotes: String,
  created: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Indexes for performance
OrderSchema.index({ userId: 1, createdAt: -1 });
OrderSchema.index({ status: 1 });
OrderSchema.index({ orderNumber: 1 });
OrderSchema.index({ paymentId: 1 });

// Pre-save middleware to generate order number
OrderSchema.pre('save', async function (next) {
  if (this.isNew && !this.orderNumber) {
    const count = await this.constructor.countDocuments();
    this.orderNumber = `VB${String(count + 1).padStart(6, '0')}`;
  }
  
  // Add status history entry when status changes
  if (this.isModified('status') && !this.isNew) {
    this.statusHistory.push({
      status: this.status,
      timestamp: new Date(),
      note: `Status changed to ${this.status}`
    });
  }
  
  next();
});

module.exports = mongoose.model('Order', OrderSchema);