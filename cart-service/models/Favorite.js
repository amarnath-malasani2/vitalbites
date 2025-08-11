const mongoose = require('mongoose');

const FavoriteSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true
  },
  items: [{
    itemId: { 
      type: String, 
      required: true 
    },
    name: { 
      type: String, 
      required: true 
    },
    description: String,
    price: { 
      type: Number, 
      required: true 
    },
    image: String,
    restaurant: String,
    category: String,
    addedAt: { 
      type: Date, 
      default: Date.now 
    }
  }],
  lastUpdated: { 
    type: Date, 
    default: Date.now 
  }
}, {
  timestamps: true
});

// Create compound index to prevent duplicate favorites
FavoriteSchema.index({ userId: 1, 'items.itemId': 1 });

// Update lastUpdated before saving
FavoriteSchema.pre('save', function (next) {
  this.lastUpdated = new Date();
  next();
});

module.exports = mongoose.model('Favorite', FavoriteSchema);