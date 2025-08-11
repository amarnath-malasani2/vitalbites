const express = require('express');
const router = express.Router();
const Favorite = require('../models/Favorite');

// Get user's favorites
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id; // From JWT middleware
    let favorites = await Favorite.findOne({ userId });

    if (!favorites) {
      favorites = new Favorite({ userId, items: [] });
      await favorites.save();
    }

    res.json({
      favorites: favorites.items,
      count: favorites.items.length,
      lastUpdated: favorites.lastUpdated
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Add item to favorites
router.post('/add', async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId, name, description, price, image, restaurant, category } = req.body;

    if (!itemId || !name || !price) {
      return res.status(400).json({ message: 'Item ID, name, and price are required' });
    }

    let favorites = await Favorite.findOne({ userId });
    if (!favorites) {
      favorites = new Favorite({ userId, items: [] });
    }

    // Check if item already exists in favorites
    const existingItem = favorites.items.find(item => item.itemId === itemId);
    if (existingItem) {
      return res.status(400).json({ message: 'Item already in favorites' });
    }

    // Add new item to favorites
    favorites.items.push({
      itemId,
      name,
      description,
      price,
      image,
      restaurant,
      category,
      addedAt: new Date()
    });

    await favorites.save();
    res.json({ 
      message: 'Item added to favorites', 
      favorites: favorites.items,
      count: favorites.items.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Remove item from favorites
router.delete('/remove/:itemId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    const favorites = await Favorite.findOne({ userId });
    if (!favorites) {
      return res.status(404).json({ message: 'Favorites not found' });
    }

    const initialLength = favorites.items.length;
    favorites.items = favorites.items.filter(item => item.itemId !== itemId);
    
    if (favorites.items.length === initialLength) {
      return res.status(404).json({ message: 'Item not found in favorites' });
    }

    await favorites.save();
    res.json({ 
      message: 'Item removed from favorites', 
      favorites: favorites.items,
      count: favorites.items.length
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Check if item is in favorites
router.get('/check/:itemId', async (req, res) => {
  try {
    const userId = req.user.id;
    const { itemId } = req.params;

    const favorites = await Favorite.findOne({ userId });
    const isFavorite = favorites ? favorites.items.some(item => item.itemId === itemId) : false;

    res.json({ isFavorite });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Clear all favorites
router.delete('/clear', async (req, res) => {
  try {
    const userId = req.user.id;

    await Favorite.findOneAndUpdate(
      { userId },
      { items: [], lastUpdated: new Date() },
      { upsert: true }
    );

    res.json({ message: 'Favorites cleared successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// Get favorites statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    const favorites = await Favorite.findOne({ userId });
    if (!favorites) {
      return res.json({ 
        totalItems: 0, 
        categories: {}, 
        restaurants: {},
        totalValue: 0
      });
    }

    const stats = {
      totalItems: favorites.items.length,
      categories: {},
      restaurants: {},
      totalValue: 0,
      recentlyAdded: favorites.items
        .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
        .slice(0, 5)
    };

    // Calculate stats
    favorites.items.forEach(item => {
      // Category stats
      if (item.category) {
        stats.categories[item.category] = (stats.categories[item.category] || 0) + 1;
      }

      // Restaurant stats
      if (item.restaurant) {
        stats.restaurants[item.restaurant] = (stats.restaurants[item.restaurant] || 0) + 1;
      }

      // Total value
      stats.totalValue += item.price;
    });

    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;