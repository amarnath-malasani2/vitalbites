const axios = require('axios');

// Service health check configuration
const services = {
  'auth-service': 'http://auth-service:5000/health',
  'menu-service': 'http://menu-service:5001/health',
  'order-service': 'http://order-service:5002/health',
  'user-service': 'http://user-service:5003/health',
  'cart-service': 'http://cart-service:5004/health'
};

// Check individual service health
const checkServiceHealth = async (serviceName, url) => {
  try {
    const response = await axios.get(url, { timeout: 5000 });
    return {
      service: serviceName,
      status: 'healthy',
      responseTime: response.duration || 0,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      service: serviceName,
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
};

// Check all services health
const checkAllServicesHealth = async () => {
  const healthChecks = Object.entries(services).map(([serviceName, url]) =>
    checkServiceHealth(serviceName, url)
  );
  
  const results = await Promise.all(healthChecks);
  
  const overallHealthy = results.every(result => result.status === 'healthy');
  
  return {
    status: overallHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    services: results
  };
};

// Gateway health endpoint
const healthEndpoint = async (req, res) => {
  try {
    const healthStatus = await checkAllServicesHealth();
    const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
    
    res.status(statusCode).json({
      gateway: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.env.npm_package_version || '1.0.0'
      },
      ...healthStatus
    });
  } catch (error) {
    res.status(503).json({
      gateway: {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
};

// Readiness check endpoint
const readinessEndpoint = async (req, res) => {
  try {
    const healthStatus = await checkAllServicesHealth();
    const ready = healthStatus.status === 'healthy';
    
    res.status(ready ? 200 : 503).json({
      ready,
      timestamp: new Date().toISOString(),
      dependencies: healthStatus.services
    });
  } catch (error) {
    res.status(503).json({
      ready: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// Liveness check endpoint
const livenessEndpoint = (req, res) => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage()
  });
};

module.exports = {
  healthEndpoint,
  readinessEndpoint,
  livenessEndpoint,
  checkServiceHealth,
  checkAllServicesHealth
};