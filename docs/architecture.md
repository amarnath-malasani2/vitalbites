# VitalBites Microservices Architecture Documentation

## Overview
VitalBites is a food delivery application built using a microservices architecture with the following enhancements:

## Architecture Components

### Services
- **API Gateway** (Port 8080) - Request routing, rate limiting, circuit breaking
- **Auth Service** (Port 5000) - JWT authentication, OTP verification
- **Menu Service** (Port 5001) - Food menu management
- **Order Service** (Port 5002) - Order processing
- **Cart Service** (Port 5004) - Shopping cart management  
- **User Service** (Port 5003) - User profile management
- **Frontend** - Nginx-served static files
- **MongoDB** - Database with separate databases per service

### Key Features Implemented

#### 1. Enhanced API Gateway
- **Rate Limiting**: Different limits for auth vs general endpoints
- **Request/Response Logging**: Comprehensive logging with correlation IDs
- **Health Check Endpoints**: Monitor service health (`/health`, `/ready`, `/live`)
- **Circuit Breaker Pattern**: Prevents cascade failures
- **Security Headers**: XSS protection, content type options
- **Error Handling**: Standardized error responses

#### 2. Health Monitoring
Each service provides:
- `/health` - Overall service health including database connectivity
- `/ready` - Readiness probe for container orchestration
- `/live` - Liveness probe for basic service availability

#### 3. Enhanced Security
- Security headers (XSS Protection, Content-Type Options, Frame Options)
- CORS configuration with allowed origins
- JWT token validation
- Non-root user containers
- Secrets management via environment variables

#### 4. Database Architecture  
- Separate MongoDB databases per service
- Connection pooling and retry logic
- Health checks for database connectivity
- Graceful shutdown handling

#### 5. Container Optimization
- Multi-stage Docker builds
- Production vs development stages
- Health checks in containers
- Non-root user execution
- Optimized image sizes

## Deployment

### Development
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Production
```bash
docker-compose -f docker-compose.prod.yml up --build
```

## Environment Configuration
Copy the appropriate example file and update values:
- `.env.dev.example` → `.env.dev`
- `.env.prod.example` → `.env.prod`

## API Endpoints

### Health Checks
- `GET /health` - Comprehensive health status
- `GET /ready` - Readiness probe
- `GET /live` - Liveness probe
- `GET /circuit-breaker-status` - Circuit breaker states

### Authentication
- `POST /api/auth/send-otp` - Send OTP to email
- `POST /api/auth/verify-otp` - Verify OTP and login
- `POST /api/auth/complete-registration` - Complete user registration
- `GET /api/auth/verify` - Verify JWT token

### Menu Management
- `GET /api/menu` - Get all menu items
- `POST /api/menu` - Add menu item (admin)
- `PUT /api/menu/:id` - Update menu item (admin)  
- `DELETE /api/menu/:id` - Delete menu item (admin)

### Order Management
- `POST /api/orders` - Place order
- `GET /api/orders/:userId` - Get user orders
- `GET /api/orders` - Get all orders (admin)
- `PUT /api/orders/:id` - Update order status (admin)

### Cart Management
- Protected endpoints requiring JWT authentication
- See cart service routes for detailed endpoints

### User Management
- `GET /api/user/:userId` - Get user profile
- `PUT /api/user/:userId` - Update user profile

## Monitoring Features

### Logging
- Correlation IDs for request tracing
- Structured logging with timestamps
- Error logging with stack traces
- Request/response logging with duration

### Circuit Breaker
- Prevents cascade failures
- Configurable failure thresholds
- Automatic recovery attempts
- Status monitoring endpoint

### Rate Limiting
- IP-based rate limiting
- Different limits for different endpoints
- Configurable time windows and limits
- Clear error messages with retry information

## Development Guidelines

### Adding New Services
1. Follow the existing service structure
2. Implement health check endpoints
3. Add to docker-compose files
4. Update API gateway routes
5. Add circuit breaker configuration

### Error Handling
- Use shared error handler middleware
- Include correlation IDs in responses
- Provide clear, actionable error messages
- Log errors appropriately

### Security Best Practices
- Always validate input
- Use JWT for authentication
- Implement proper CORS policies
- Run containers as non-root users
- Keep secrets in environment variables

## Future Enhancements
- Redis caching layer
- Message queuing with RabbitMQ
- Distributed tracing with Jaeger
- Metrics collection with Prometheus
- Service discovery
- Auto-scaling configuration