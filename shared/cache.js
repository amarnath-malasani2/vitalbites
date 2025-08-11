const redis = require('redis');

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
  }

  async connect(redisUrl = process.env.REDIS_URL || 'redis://redis:6379') {
    try {
      this.client = redis.createClient({ url: redisUrl });
      
      this.client.on('error', (err) => {
        console.error('[CACHE] Redis error:', err);
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        console.log('[CACHE] Redis connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        console.warn('[CACHE] Redis disconnected');
        this.isConnected = false;
      });

      await this.client.connect();
      return this.client;
    } catch (error) {
      console.error('[CACHE] Failed to connect to Redis:', error);
      this.isConnected = false;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) {
      return null;
    }
    
    try {
      const value = await this.client.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      console.error('[CACHE] Error getting key:', key, error);
      return null;
    }
  }

  async set(key, value, ttlSeconds = 3600) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('[CACHE] Error setting key:', key, error);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('[CACHE] Error deleting key:', key, error);
      return false;
    }
  }

  async exists(key) {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      const exists = await this.client.exists(key);
      return exists === 1;
    } catch (error) {
      console.error('[CACHE] Error checking key existence:', key, error);
      return false;
    }
  }

  async flushAll() {
    if (!this.isConnected || !this.client) {
      return false;
    }

    try {
      await this.client.flushAll();
      return true;
    } catch (error) {
      console.error('[CACHE] Error flushing cache:', error);
      return false;
    }
  }

  async disconnect() {
    if (this.client) {
      await this.client.disconnect();
      this.isConnected = false;
    }
  }

  // Cache middleware for Express
  middleware(ttlSeconds = 3600) {
    return async (req, res, next) => {
      if (!this.isConnected) {
        return next();
      }

      const key = `cache:${req.method}:${req.originalUrl}`;
      
      try {
        const cached = await this.get(key);
        if (cached) {
          console.log(`[CACHE] Hit for key: ${key}`);
          return res.json(cached);
        }
      } catch (error) {
        console.error('[CACHE] Middleware error:', error);
      }

      // Override res.json to cache the response
      const originalJson = res.json.bind(res);
      res.json = (body) => {
        if (res.statusCode === 200) {
          this.set(key, body, ttlSeconds).catch(err => 
            console.error('[CACHE] Error caching response:', err)
          );
        }
        return originalJson(body);
      };

      next();
    };
  }
}

// Singleton instance
const cacheService = new CacheService();

module.exports = cacheService;