const redis = require('redis');

class MetricsService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.metrics = {
      requestCount: new Map(),
      responseTime: new Map(),
      errorCount: new Map(),
      startTime: Date.now()
    };
  }

  async connect(redisUrl = process.env.REDIS_URL || 'redis://redis:6379') {
    try {
      this.client = redis.createClient({ url: redisUrl });
      
      this.client.on('error', (err) => {
        console.error('[METRICS] Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[METRICS] Redis connected for metrics');
        this.isConnected = true;
      });

      await this.client.connect();
    } catch (error) {
      console.error('[METRICS] Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  recordMetric(method, path, statusCode, duration) {
    const key = `${method}:${path}`;
    
    // Update local metrics
    this.metrics.requestCount.set(key, (this.metrics.requestCount.get(key) || 0) + 1);
    
    if (!this.metrics.responseTime.has(key)) {
      this.metrics.responseTime.set(key, { total: 0, count: 0, min: Infinity, max: 0 });
    }
    const responseTime = this.metrics.responseTime.get(key);
    responseTime.total += duration;
    responseTime.count += 1;
    responseTime.min = Math.min(responseTime.min, duration);
    responseTime.max = Math.max(responseTime.max, duration);

    if (statusCode >= 400) {
      const errorKey = `${key}:${statusCode}`;
      this.metrics.errorCount.set(errorKey, (this.metrics.errorCount.get(errorKey) || 0) + 1);
    }

    // Store in Redis if connected
    if (this.isConnected && this.client) {
      this.storeInRedis(key, statusCode, duration).catch(err => 
        console.error('[METRICS] Error storing in Redis:', err)
      );
    }
  }

  async storeInRedis(key, statusCode, duration) {
    const timestamp = Date.now();
    const metricKey = `metrics:${key}:${timestamp}`;
    
    await this.client.hSet(metricKey, {
      statusCode: statusCode.toString(),
      duration: duration.toString(),
      timestamp: timestamp.toString()
    });
    
    // Set TTL to 1 day
    await this.client.expire(metricKey, 86400);
  }

  getMetrics() {
    const uptime = Date.now() - this.metrics.startTime;
    const memory = process.memoryUsage();

    const result = {
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptime / 1000), // seconds
      memory: {
        rss: Math.round(memory.rss / 1024 / 1024), // MB
        heapTotal: Math.round(memory.heapTotal / 1024 / 1024), // MB
        heapUsed: Math.round(memory.heapUsed / 1024 / 1024), // MB
        external: Math.round(memory.external / 1024 / 1024) // MB
      },
      requests: {},
      errors: {},
      responseTime: {}
    };

    // Convert maps to objects
    for (const [key, count] of this.metrics.requestCount) {
      result.requests[key] = {
        count,
        rate: Math.round((count / (uptime / 1000)) * 100) / 100 // requests per second
      };
    }

    for (const [key, count] of this.metrics.errorCount) {
      result.errors[key] = count;
    }

    for (const [key, data] of this.metrics.responseTime) {
      result.responseTime[key] = {
        average: Math.round(data.total / data.count),
        min: data.min === Infinity ? 0 : data.min,
        max: data.max,
        count: data.count
      };
    }

    return result;
  }

  middleware() {
    return (req, res, next) => {
      const start = Date.now();
      
      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = Date.now() - start;
        const path = req.route ? req.route.path : req.path;
        
        this.recordMetric(req.method, path, res.statusCode, duration);
        
        originalEnd.apply(res, args);
      };

      next();
    };
  }
}

module.exports = new MetricsService();