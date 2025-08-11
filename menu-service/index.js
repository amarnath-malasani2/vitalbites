require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const MenuItem = require('./models/MenuItem');

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Menu DB connected'));

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

// Get all menu items (public)
app.get('/api/menu', async (req, res) => {
  try {
    const { 
      category, 
      restaurant, 
      search, 
      featured, 
      available = true,
      sortBy = 'name',
      sortOrder = 'asc',
      page = 1,
      limit = 50
    } = req.query;

    const query = {};
    
    if (available) {
      query.available = true;
    }
    
    if (category) {
      query.category = category;
    }
    
    if (restaurant) {
      query.restaurant = restaurant;
    }
    
    if (featured === 'true') {
      query.featured = true;
    }
    
    if (search) {
      query.$text = { $search: search };
    }

    // Build sort object
    const sort = {};
    if (search) {
      sort.score = { $meta: 'textScore' };
    }
    
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const items = await MenuItem.find(query)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await MenuItem.countDocuments(query);
    
    // Get categories and restaurants for filtering
    const categories = await MenuItem.distinct('category', { available: true });
    const restaurants = await MenuItem.distinct('restaurant', { available: true });

    res.json({
      items,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      },
      filters: {
        categories,
        restaurants
      }
    });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ message: 'Failed to fetch menu items', error: error.message });
  }
});

// Get menu item by ID
app.get('/api/menu/:id', async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    res.json(item);
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ message: 'Failed to fetch menu item', error: error.message });
  }
});

// Get featured items
app.get('/api/menu/featured/items', async (req, res) => {
  try {
    const items = await MenuItem.find({ featured: true, available: true })
      .sort({ 'rating.average': -1, popularity: -1 })
      .limit(10);
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching featured items:', error);
    res.status(500).json({ message: 'Failed to fetch featured items', error: error.message });
  }
});

// Get popular items
app.get('/api/menu/popular/items', async (req, res) => {
  try {
    const items = await MenuItem.find({ available: true })
      .sort({ popularity: -1 })
      .limit(10);
    
    res.json(items);
  } catch (error) {
    console.error('Error fetching popular items:', error);
    res.status(500).json({ message: 'Failed to fetch popular items', error: error.message });
  }
});

// Get items by category
app.get('/api/menu/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { restaurant, sortBy = 'name', sortOrder = 'asc' } = req.query;
    
    const query = { category, available: true };
    if (restaurant) {
      query.restaurant = restaurant;
    }
    
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const items = await MenuItem.find(query).sort(sort);
    res.json(items);
  } catch (error) {
    console.error('Error fetching items by category:', error);
    res.status(500).json({ message: 'Failed to fetch items by category', error: error.message });
  }
});

// Admin: Get all menu items (with filters)
app.get('/api/menu/admin/items', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { 
      category, 
      restaurant, 
      search, 
      available,
      page = 1,
      limit = 20
    } = req.query;

    const query = {};
    
    if (category) query.category = category;
    if (restaurant) query.restaurant = restaurant;
    if (available !== undefined) query.available = available === 'true';
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const items = await MenuItem.find(query)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await MenuItem.countDocuments(query);

    res.json({
      items,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total
      }
    });
  } catch (error) {
    console.error('Error fetching menu items for admin:', error);
    res.status(500).json({ message: 'Failed to fetch menu items', error: error.message });
  }
});

// Add menu item (admin)
app.post('/api/menu', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const itemData = {
      ...req.body,
      createdBy: req.user.email,
      lastModifiedBy: req.user.email
    };
    
    const item = await MenuItem.create(itemData);
    res.status(201).json({ message: 'Menu item created successfully', item });
  } catch (error) {
    console.error('Error creating menu item:', error);
    res.status(500).json({ message: 'Failed to create menu item', error: error.message });
  }
});

// Update menu item (admin)
app.put('/api/menu/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const updateData = {
      ...req.body,
      lastModifiedBy: req.user.email
    };
    
    const item = await MenuItem.findByIdAndUpdate(
      req.params.id, 
      updateData, 
      { new: true, runValidators: true }
    );
    
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    
    res.json({ message: 'Menu item updated successfully', item });
  } catch (error) {
    console.error('Error updating menu item:', error);
    res.status(500).json({ message: 'Failed to update menu item', error: error.message });
  }
});

// Delete menu item (admin)
app.delete('/api/menu/:id', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const item = await MenuItem.findByIdAndDelete(req.params.id);
    
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    
    res.json({ message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ message: 'Failed to delete menu item', error: error.message });
  }
});

// Toggle item availability
app.patch('/api/menu/:id/availability', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { available } = req.body;
    
    const item = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { available, lastModifiedBy: req.user.email },
      { new: true }
    );
    
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    
    res.json({ 
      message: `Menu item ${available ? 'enabled' : 'disabled'} successfully`, 
      item: { id: item._id, name: item.name, available: item.available }
    });
  } catch (error) {
    console.error('Error updating item availability:', error);
    res.status(500).json({ message: 'Failed to update item availability', error: error.message });
  }
});

// Toggle featured status
app.patch('/api/menu/:id/featured', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { featured } = req.body;
    
    const item = await MenuItem.findByIdAndUpdate(
      req.params.id,
      { featured, lastModifiedBy: req.user.email },
      { new: true }
    );
    
    if (!item) {
      return res.status(404).json({ message: 'Menu item not found' });
    }
    
    res.json({ 
      message: `Menu item ${featured ? 'featured' : 'unfeatured'} successfully`, 
      item: { id: item._id, name: item.name, featured: item.featured }
    });
  } catch (error) {
    console.error('Error updating featured status:', error);
    res.status(500).json({ message: 'Failed to update featured status', error: error.message });
  }
});

// Get menu statistics
app.get('/api/menu/admin/stats', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const totalItems = await MenuItem.countDocuments();
    const availableItems = await MenuItem.countDocuments({ available: true });
    const featuredItems = await MenuItem.countDocuments({ featured: true });
    
    const categoryStats = await MenuItem.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    const restaurantStats = await MenuItem.aggregate([
      { $group: { _id: '$restaurant', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);
    
    res.json({
      totalItems,
      availableItems,
      featuredItems,
      unavailableItems: totalItems - availableItems,
      categoryStats,
      restaurantStats
    });
  } catch (error) {
    console.error('Error fetching menu stats:', error);
    res.status(500).json({ message: 'Failed to fetch menu stats', error: error.message });
  }
});

// Bulk operations
app.post('/api/menu/admin/bulk-update', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { itemIds, updates } = req.body;
    
    if (!itemIds || !Array.isArray(itemIds) || !updates) {
      return res.status(400).json({ message: 'Item IDs and updates are required' });
    }
    
    const result = await MenuItem.updateMany(
      { _id: { $in: itemIds } },
      { ...updates, lastModifiedBy: req.user.email }
    );
    
    res.json({ 
      message: 'Bulk update completed successfully',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    console.error('Error performing bulk update:', error);
    res.status(500).json({ message: 'Failed to perform bulk update', error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'Menu Service is running' });
});

app.listen(5001, () => console.log('Menu Service on 5001'));