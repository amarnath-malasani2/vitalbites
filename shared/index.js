// Export all shared utilities
const { errorHandler, asyncHandler, notFoundHandler } = require('./errorHandler');
const { authenticateToken, requireAdmin, requireOwnership } = require('./authMiddleware');
const { connectDB, gracefulShutdown } = require('./database');

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
  authenticateToken,
  requireAdmin,
  requireOwnership,
  connectDB,
  gracefulShutdown
};