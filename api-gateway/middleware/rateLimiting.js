const rateLimit = require('express-rate-limit');

// Rate limiting configuration
const createRateLimiter = (windowMs = 15 * 60 * 1000, max = 100, message = 'Too many requests') => {
  return rateLimit({
    windowMs,
    max,
    message: {
      error: message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
      console.log(`[RATE_LIMIT] ${req.ip} exceeded limit - ${req.method} ${req.originalUrl}`);
      res.status(429).json({
        error: message,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
  });
};

// Different rate limits for different endpoints
const authLimiter = createRateLimiter(15 * 60 * 1000, 10, 'Too many authentication attempts');
const generalLimiter = createRateLimiter(15 * 60 * 1000, 100, 'Too many requests from this IP');
const strictLimiter = createRateLimiter(15 * 60 * 1000, 50, 'Rate limit exceeded');

module.exports = {
  authLimiter,
  generalLimiter,
  strictLimiter
};