const mongoose = require('mongoose');

const MenuItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    index: true
  },
  description: {
    type: String,
    required: true
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  image: {
    type: String,
    required: true
  },
  restaurant: {
    type: String,
    required: true,
    index: true
  },
  category: {
    type: String,
    required: true,
    index: true,
    enum: ['Appetizers', 'Main Course', 'Desserts', 'Beverages', 'Salads', 'Pizza', 'Burgers', 'Chinese', 'Indian', 'Italian', 'Continental']
  },
  subcategory: String,
  available: { 
    type: Boolean, 
    default: true 
  },
  featured: {
    type: Boolean,
    default: false
  },
  spicyLevel: {
    type: String,
    enum: ['mild', 'medium', 'spicy', 'extra_spicy', 'none'],
    default: 'none'
  },
  dietaryInfo: [{
    type: String,
    enum: ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'low-carb', 'high-protein']
  }],
  ingredients: [String],
  allergens: [String],
  nutritionalInfo: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fat: Number,
    fiber: Number,
    sodium: Number
  },
  preparationTime: Number, // in minutes
  servingSize: String,
  tags: [String],
  rating: {
    average: { type: Number, default: 0 },
    count: { type: Number, default: 0 }
  },
  popularity: {
    type: Number,
    default: 0
  },
  createdBy: String,
  lastModifiedBy: String
}, {
  timestamps: true
});

// Indexes for performance
MenuItemSchema.index({ category: 1, available: 1 });
MenuItemSchema.index({ restaurant: 1, available: 1 });
MenuItemSchema.index({ featured: 1, available: 1 });
MenuItemSchema.index({ name: 'text', description: 'text' });
MenuItemSchema.index({ 'rating.average': -1 });
MenuItemSchema.index({ popularity: -1 });

module.exports = mongoose.model('MenuItem', MenuItemSchema);