require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

// Import middleware
const { requestLogger, errorLogger } = require('./middleware/logging');
const { authLimiter, generalLimiter } = require('./middleware/rateLimiting');
const { circuitBreakerMiddleware, getCircuitBreakerStatus } = require('./middleware/circuitBreaker');
const { healthEndpoint, readinessEndpoint, livenessEndpoint } = require('./middleware/health');
const metricsService = require('./middleware/metrics');

const app = express();

// Initialize metrics service
metricsService.connect().catch(err => console.error('[GATEWAY] Metrics service connection failed:', err));

// Security headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// CORS configuration
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:80', 'http://localhost:3000'],
  credentials: true,
  optionsSuccessStatus: 200
}));

// Request logging
app.use(requestLogger);

// Metrics collection
app.use(metricsService.middleware());

// Rate limiting - apply to all routes with general limit
app.use(generalLimiter);

// Health check endpoints (no rate limiting)
app.get('/health', healthEndpoint);
app.get('/ready', readinessEndpoint);
app.get('/live', livenessEndpoint);

// Metrics endpoint
app.get('/metrics', (req, res) => {
  res.json(metricsService.getMetrics());
});

// Circuit breaker status endpoint
app.get('/circuit-breaker-status', (req, res) => {
  res.json(getCircuitBreakerStatus());
});

// Apply stricter rate limiting to auth endpoints
app.use('/api/auth', authLimiter);

// Proxy rules with circuit breaker middleware
app.use('/api/auth', 
  circuitBreakerMiddleware('auth-service'),
  createProxyMiddleware({ 
    target: 'http://auth-service:5000', 
    changeOrigin: true, 
    pathRewrite: { '^/api/auth': '/api/auth' },
    timeout: 10000,
    proxyTimeout: 10000,
    onError: (err, req, res) => {
      console.error(`[PROXY_ERROR] Auth service: ${err.message}`);
      res.status(503).json({ 
        error: 'Auth service temporarily unavailable',
        correlationId: req.correlationId 
      });
    }
  })
);

app.use('/api/menu',
  circuitBreakerMiddleware('menu-service'),
  createProxyMiddleware({ 
    target: 'http://menu-service:5001', 
    changeOrigin: true, 
    pathRewrite: { '^/api/menu': '/api/menu' },
    timeout: 10000,
    proxyTimeout: 10000,
    onError: (err, req, res) => {
      console.error(`[PROXY_ERROR] Menu service: ${err.message}`);
      res.status(503).json({ 
        error: 'Menu service temporarily unavailable',
        correlationId: req.correlationId 
      });
    }
  })
);

app.use('/api/orders',
  circuitBreakerMiddleware('order-service'),
  createProxyMiddleware({ 
    target: 'http://order-service:5002', 
    changeOrigin: true, 
    pathRewrite: { '^/api/orders': '/api/orders' },
    timeout: 15000,
    proxyTimeout: 15000,
    onError: (err, req, res) => {
      console.error(`[PROXY_ERROR] Order service: ${err.message}`);
      res.status(503).json({ 
        error: 'Order service temporarily unavailable',
        correlationId: req.correlationId 
      });
    }
  })
);

app.use('/api/user',
  circuitBreakerMiddleware('user-service'),
  createProxyMiddleware({ 
    target: 'http://user-service:5003', 
    changeOrigin: true, 
    pathRewrite: { '^/api/user': '/api/user' },
    timeout: 10000,
    proxyTimeout: 10000,
    onError: (err, req, res) => {
      console.error(`[PROXY_ERROR] User service: ${err.message}`);
      res.status(503).json({ 
        error: 'User service temporarily unavailable',
        correlationId: req.correlationId 
      });
    }
  })
);

app.use('/api/cart',
  circuitBreakerMiddleware('cart-service'),
  createProxyMiddleware({ 
    target: 'http://cart-service:5004', 
    changeOrigin: true, 
    pathRewrite: { '^/api/cart': '/api/cart' },
    timeout: 10000,
    proxyTimeout: 10000,
    onError: (err, req, res) => {
      console.error(`[PROXY_ERROR] Cart service: ${err.message}`);
      res.status(503).json({ 
        error: 'Cart service temporarily unavailable',
        correlationId: req.correlationId 
      });
    }
  })
);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.originalUrl,
    correlationId: req.correlationId,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use(errorLogger);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[GATEWAY] Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('[GATEWAY] Received SIGINT, shutting down gracefully');
  process.exit(0);
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`[GATEWAY] API Gateway listening on port ${PORT}`);
  console.log(`[GATEWAY] Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[GATEWAY] Health check: http://localhost:${PORT}/health`);
  console.log(`[GATEWAY] Metrics: http://localhost:${PORT}/metrics`);
});