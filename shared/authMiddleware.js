const jwt = require('jsonwebtoken');

// JWT authentication middleware
const authenticateToken = (secret = process.env.JWT_SECRET || 'supersecret') => {
  return (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Access token required',
        correlationId: req.correlationId || 'unknown',
        timestamp: new Date().toISOString()
      });
    }

    jwt.verify(token, secret, (err, user) => {
      if (err) {
        console.log(`[AUTH_ERROR] Token verification failed: ${err.message}`);
        return res.status(403).json({ 
          error: 'Invalid or expired token',
          correlationId: req.correlationId || 'unknown',
          timestamp: new Date().toISOString()
        });
      }
      req.user = user;
      next();
    });
  };
};

// Admin role check middleware
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Admin access required',
      correlationId: req.correlationId || 'unknown',
      timestamp: new Date().toISOString()
    });
  }
  next();
};

// User ownership check middleware
const requireOwnership = (userIdField = 'userId') => {
  return (req, res, next) => {
    const resourceUserId = req.params[userIdField] || req.body[userIdField];
    const currentUserId = req.user?.id;

    if (!currentUserId || (resourceUserId && resourceUserId !== currentUserId)) {
      return res.status(403).json({
        error: 'Access denied - resource ownership required',
        correlationId: req.correlationId || 'unknown',
        timestamp: new Date().toISOString()
      });
    }
    next();
  };
};

module.exports = {
  authenticateToken,
  requireAdmin,
  requireOwnership
};