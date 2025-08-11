require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

const app = express();
app.use(cors());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'API Gateway is running' });
});

// Proxy rules for existing services
app.use('/api/auth', createProxyMiddleware({ 
  target: 'http://auth-service:5000', 
  changeOrigin: true, 
  pathRewrite: { '^/api/auth': '/api/auth' } 
}));

app.use('/api/menu', createProxyMiddleware({ 
  target: 'http://menu-service:5001', 
  changeOrigin: true, 
  pathRewrite: { '^/api/menu': '/api/menu' } 
}));

app.use('/api/orders', createProxyMiddleware({ 
  target: 'http://order-service:5002', 
  changeOrigin: true, 
  pathRewrite: { '^/api/orders': '/api/orders' } 
}));

app.use('/api/user', createProxyMiddleware({ 
  target: 'http://user-service:5003', 
  changeOrigin: true, 
  pathRewrite: { '^/api/user': '/api/user' } 
}));

app.use('/api/cart', createProxyMiddleware({ 
  target: 'http://cart-service:5004', 
  changeOrigin: true, 
  pathRewrite: { '^/api/cart': '/api/cart' } 
}));

// Proxy rules for new services
app.use('/api/favorites', createProxyMiddleware({ 
  target: 'http://cart-service:5004', 
  changeOrigin: true, 
  pathRewrite: { '^/api/favorites': '/api/favorites' } 
}));

app.use('/api/payments', createProxyMiddleware({ 
  target: 'http://payment-service:5005', 
  changeOrigin: true, 
  pathRewrite: { '^/api/payments': '/api/payments' } 
}));

app.use('/api/notifications', createProxyMiddleware({ 
  target: 'http://notification-service:5006', 
  changeOrigin: true, 
  pathRewrite: { '^/api/notifications': '/api/notifications' } 
}));

app.use('/api/admin', createProxyMiddleware({ 
  target: 'http://admin-service:5007', 
  changeOrigin: true, 
  pathRewrite: { '^/api/admin': '/api/admin' } 
}));

app.use('/api/analytics', createProxyMiddleware({ 
  target: 'http://analytics-service:5008', 
  changeOrigin: true, 
  pathRewrite: { '^/api/analytics': '/api/analytics' } 
}));

// WebSocket proxy for real-time notifications
app.use('/socket.io', createProxyMiddleware({ 
  target: 'http://notification-service:5006', 
  changeOrigin: true,
  ws: true, // Enable WebSocket proxying
}));

const PORT = process.env.API_GATEWAY_PORT || 8080;
app.listen(PORT, () => console.log(`API Gateway listening on ${PORT}`));