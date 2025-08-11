// Export all shared utilities
const { errorHandler, asyncHandler, notFoundHandler } = require('./errorHandler');
const { authenticateToken, requireAdmin, requireOwnership } = require('./authMiddleware');
const { connectDB, gracefulShutdown } = require('./database');
const { 
  validateEmail, validateOTP, validateRegistration, validateMenuItem, 
  validateOrder, validateUserProfile, validateAddress, sanitizeInput 
} = require('./validation');
const cacheService = require('./cache');
const metricsCollector = require('./metrics');

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  authenticateToken,
  requireAdmin,
  requireOwnership,
  connectDB,
  gracefulShutdown,
  validateEmail,
  validateOTP,
  validateRegistration,
  validateMenuItem,
  validateOrder,
  validateUserProfile,
  validateAddress,
  sanitizeInput,
  cacheService,
  metricsCollector
};