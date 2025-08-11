// Simple circuit breaker implementation
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000;
    this.monitoringPeriod = options.monitoringPeriod || 60000;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    this.serviceName = options.serviceName || 'unknown';
  }

  async execute(request) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker is OPEN for ${this.serviceName}. Try again later.`);
      } else {
        this.state = 'HALF_OPEN';
        console.log(`[CIRCUIT_BREAKER] ${this.serviceName} moving to HALF_OPEN`);
      }
    }

    try {
      const result = await request();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    this.failureCount = 0;
    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
      console.log(`[CIRCUIT_BREAKER] ${this.serviceName} moving to CLOSED`);
    }
  }

  onFailure() {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.log(`[CIRCUIT_BREAKER] ${this.serviceName} moving to OPEN. Failures: ${this.failureCount}`);
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      serviceName: this.serviceName
    };
  }
}

// Circuit breakers for each service
const serviceBreakers = {
  'auth-service': new CircuitBreaker({ serviceName: 'auth-service', failureThreshold: 5, resetTimeout: 30000 }),
  'menu-service': new CircuitBreaker({ serviceName: 'menu-service', failureThreshold: 5, resetTimeout: 30000 }),
  'order-service': new CircuitBreaker({ serviceName: 'order-service', failureThreshold: 5, resetTimeout: 30000 }),
  'user-service': new CircuitBreaker({ serviceName: 'user-service', failureThreshold: 5, resetTimeout: 30000 }),
  'cart-service': new CircuitBreaker({ serviceName: 'cart-service', failureThreshold: 5, resetTimeout: 30000 })
};

// Middleware to wrap proxy requests with circuit breaker
const circuitBreakerMiddleware = (serviceName) => {
  return (req, res, next) => {
    const breaker = serviceBreakers[serviceName];
    if (!breaker) {
      return next();
    }

    // Store original end method
    const originalEnd = res.end;
    
    // Override end method to track success/failure
    res.end = function(chunk, encoding) {
      if (res.statusCode >= 500) {
        breaker.onFailure();
      } else {
        breaker.onSuccess();
      }
      originalEnd.call(this, chunk, encoding);
    };

    // Check circuit breaker state
    if (breaker.state === 'OPEN' && Date.now() < breaker.nextAttempt) {
      return res.status(503).json({
        error: `Service ${serviceName} is currently unavailable`,
        retryAfter: Math.ceil((breaker.nextAttempt - Date.now()) / 1000)
      });
    }

    next();
  };
};

// Health check endpoint for circuit breaker status
const getCircuitBreakerStatus = () => {
  const status = {};
  Object.keys(serviceBreakers).forEach(service => {
    status[service] = serviceBreakers[service].getState();
  });
  return status;
};

module.exports = {
  CircuitBreaker,
  serviceBreakers,
  circuitBreakerMiddleware,
  getCircuitBreakerStatus
};