const redis = require('redis');

class ServiceRegistry {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.services = new Map();
    this.healthCheckInterval = null;
  }

  async connect(redisUrl = process.env.REDIS_URL || 'redis://redis:6379') {
    try {
      this.client = redis.createClient({ url: redisUrl });
      
      this.client.on('error', (err) => {
        console.error('[SERVICE_REGISTRY] Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[SERVICE_REGISTRY] Connected to Redis');
        this.isConnected = true;
      });

      await this.client.connect();
      
      // Start health check interval
      this.startHealthChecks();
      
    } catch (error) {
      console.error('[SERVICE_REGISTRY] Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  // Register a service
  async registerService(serviceName, host, port, healthCheckUrl) {
    const serviceInfo = {
      name: serviceName,
      host,
      port,
      healthCheckUrl,
      registeredAt: Date.now(),
      lastHealthCheck: null,
      status: 'unknown'
    };

    // Store in local map
    this.services.set(serviceName, serviceInfo);

    // Store in Redis if connected
    if (this.isConnected) {
      const key = `service:${serviceName}`;
      await this.client.hSet(key, {
        host,
        port: port.toString(),
        healthCheckUrl,
        registeredAt: serviceInfo.registeredAt.toString(),
        status: serviceInfo.status
      });
      
      // Set TTL to 60 seconds - services must refresh
      await this.client.expire(key, 60);
    }

    console.log(`[SERVICE_REGISTRY] Registered service: ${serviceName} at ${host}:${port}`);
  }

  // Get a service by name
  async getService(serviceName) {
    // Try local cache first
    if (this.services.has(serviceName)) {
      return this.services.get(serviceName);
    }

    // Try Redis
    if (this.isConnected) {
      const key = `service:${serviceName}`;
      const serviceData = await this.client.hGetAll(key);
      
      if (serviceData && Object.keys(serviceData).length > 0) {
        const serviceInfo = {
          name: serviceName,
          host: serviceData.host,
          port: parseInt(serviceData.port),
          healthCheckUrl: serviceData.healthCheckUrl,
          registeredAt: parseInt(serviceData.registeredAt),
          status: serviceData.status
        };
        
        this.services.set(serviceName, serviceInfo);
        return serviceInfo;
      }
    }

    return null;
  }

  // Get all services
  async getAllServices() {
    const allServices = new Map();
    
    // Add local services
    for (const [name, service] of this.services) {
      allServices.set(name, service);
    }

    // Add Redis services
    if (this.isConnected) {
      const keys = await this.client.keys('service:*');
      for (const key of keys) {
        const serviceName = key.replace('service:', '');
        if (!allServices.has(serviceName)) {
          const service = await this.getService(serviceName);
          if (service) {
            allServices.set(serviceName, service);
          }
        }
      }
    }

    return Array.from(allServices.values());
  }

  // Health check a service
  async checkServiceHealth(serviceName) {
    const service = await this.getService(serviceName);
    if (!service) {
      return false;
    }

    try {
      const axios = require('axios');
      const response = await axios.get(service.healthCheckUrl, { 
        timeout: 5000,
        validateStatus: (status) => status < 400
      });
      
      service.status = 'healthy';
      service.lastHealthCheck = Date.now();
      
      // Update in Redis
      if (this.isConnected) {
        await this.client.hSet(`service:${serviceName}`, {
          status: 'healthy',
          lastHealthCheck: service.lastHealthCheck.toString()
        });
      }
      
      return true;
    } catch (error) {
      service.status = 'unhealthy';
      service.lastHealthCheck = Date.now();
      
      // Update in Redis
      if (this.isConnected) {
        await this.client.hSet(`service:${serviceName}`, {
          status: 'unhealthy',
          lastHealthCheck: service.lastHealthCheck.toString()
        });
      }
      
      console.warn(`[SERVICE_REGISTRY] Health check failed for ${serviceName}: ${error.message}`);
      return false;
    }
  }

  // Start periodic health checks
  startHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    this.healthCheckInterval = setInterval(async () => {
      const services = await this.getAllServices();
      for (const service of services) {
        await this.checkServiceHealth(service.name);
      }
    }, 30000); // Check every 30 seconds
  }

  // Stop health checks
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  // Unregister a service
  async unregisterService(serviceName) {
    this.services.delete(serviceName);
    
    if (this.isConnected) {
      await this.client.del(`service:${serviceName}`);
    }
    
    console.log(`[SERVICE_REGISTRY] Unregistered service: ${serviceName}`);
  }

  // Get service URL for load balancing
  async getServiceUrl(serviceName) {
    const service = await this.getService(serviceName);
    if (!service) {
      throw new Error(`Service ${serviceName} not found`);
    }
    
    if (service.status === 'unhealthy') {
      throw new Error(`Service ${serviceName} is unhealthy`);
    }
    
    return `http://${service.host}:${service.port}`;
  }

  // Graceful shutdown
  async shutdown() {
    this.stopHealthChecks();
    if (this.client && this.isConnected) {
      await this.client.disconnect();
    }
  }
}

// Singleton instance
const serviceRegistry = new ServiceRegistry();

module.exports = serviceRegistry;