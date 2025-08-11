const crypto = require('crypto');

// Generate correlation ID for request tracing
const generateCorrelationId = () => {
  return crypto.randomBytes(16).toString('hex');
};

// Request/Response logging middleware
const requestLogger = (req, res, next) => {
  const correlationId = req.headers['x-correlation-id'] || generateCorrelationId();
  req.correlationId = correlationId;
  
  const start = Date.now();
  
  // Add correlation ID to response headers
  res.setHeader('x-correlation-id', correlationId);
  
  // Log request
  console.log(`[REQUEST] [${correlationId}] ${req.method} ${req.originalUrl} - IP: ${req.ip} - User-Agent: ${req.headers['user-agent']}`);
  
  // Capture response details
  const originalSend = res.send;
  res.send = function(data) {
    const duration = Date.now() - start;
    console.log(`[RESPONSE] [${correlationId}] ${req.method} ${req.originalUrl} - ${res.statusCode} - ${duration}ms`);
    
    if (res.statusCode >= 400) {
      console.log(`[ERROR] [${correlationId}] ${req.method} ${req.originalUrl} - ${res.statusCode} - Response: ${data}`);
    }
    
    originalSend.call(this, data);
  };
  
  next();
};

// Error logging middleware
const errorLogger = (err, req, res, next) => {
  const correlationId = req.correlationId || 'unknown';
  console.error(`[ERROR] [${correlationId}] ${req.method} ${req.originalUrl} - ${err.message}`);
  console.error(`[ERROR_STACK] [${correlationId}]`, err.stack);
  
  res.status(500).json({
    error: 'Internal Server Error',
    correlationId,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  requestLogger,
  errorLogger,
  generateCorrelationId
};