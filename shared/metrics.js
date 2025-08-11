class MetricsCollector {
  constructor() {
    this.metrics = {
      requestCount: new Map(),
      responseTime: new Map(),
      errorCount: new Map(),
      lastReset: Date.now()
    };
  }

  // Record a request
  recordRequest(method, path, statusCode, duration) {
    const key = `${method}:${path}`;
    const statusKey = `${key}:${statusCode}`;

    // Update request count
    this.metrics.requestCount.set(key, (this.metrics.requestCount.get(key) || 0) + 1);

    // Update response time
    if (!this.metrics.responseTime.has(key)) {
      this.metrics.responseTime.set(key, { total: 0, count: 0, min: Infinity, max: 0 });
    }
    const responseTime = this.metrics.responseTime.get(key);
    responseTime.total += duration;
    responseTime.count += 1;
    responseTime.min = Math.min(responseTime.min, duration);
    responseTime.max = Math.max(responseTime.max, duration);

    // Update error count
    if (statusCode >= 400) {
      this.metrics.errorCount.set(statusKey, (this.metrics.errorCount.get(statusKey) || 0) + 1);
    }
  }

  // Get current metrics
  getMetrics() {
    const uptime = Date.now() - this.metrics.lastReset;
    const memory = process.memoryUsage();

    const metrics = {
      timestamp: new Date().toISOString(),
      uptime: uptime,
      memory: {
        rss: memory.rss,
        heapTotal: memory.heapTotal,
        heapUsed: memory.heapUsed,
        external: memory.external
      },
      requests: {},
      errors: {},
      responseTime: {}
    };

    // Convert request counts
    for (const [key, count] of this.metrics.requestCount) {
      metrics.requests[key] = {
        count,
        rate: count / (uptime / 1000) // requests per second
      };
    }

    // Convert error counts
    for (const [key, count] of this.metrics.errorCount) {
      metrics.errors[key] = count;
    }

    // Convert response times
    for (const [key, data] of this.metrics.responseTime) {
      metrics.responseTime[key] = {
        average: data.total / data.count,
        min: data.min === Infinity ? 0 : data.min,
        max: data.max,
        total: data.total,
        count: data.count
      };
    }

    return metrics;
  }

  // Reset metrics
  reset() {
    this.metrics.requestCount.clear();
    this.metrics.responseTime.clear();
    this.metrics.errorCount.clear();
    this.metrics.lastReset = Date.now();
  }

  // Express middleware
  middleware() {
    return (req, res, next) => {
      const start = Date.now();

      // Override res.end to capture metrics
      const originalEnd = res.end;
      res.end = (...args) => {
        const duration = Date.now() - start;
        const path = req.route ? req.route.path : req.path;
        
        this.recordRequest(req.method, path, res.statusCode, duration);
        
        originalEnd.apply(res, args);
      };

      next();
    };
  }
}

// Singleton instance
const metricsCollector = new MetricsCollector();

module.exports = metricsCollector;