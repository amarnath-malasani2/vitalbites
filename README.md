# VitalBites - Enhanced Microservices Food Delivery Platform

A scalable food delivery application built with enhanced microservices architecture, featuring robust middleware, comprehensive monitoring, and production-ready deployment configurations.

## 🚀 Features

### Enhanced API Gateway
- **Rate Limiting**: Configurable limits per endpoint type
- **Circuit Breaker**: Prevents cascade failures
- **Request Tracing**: Correlation IDs for distributed tracing
- **Health Monitoring**: Comprehensive health checks
- **Security Headers**: XSS protection, CSRF mitigation

### Microservices
- **Auth Service**: JWT-based authentication with OTP verification
- **Menu Service**: Food menu management with validation
- **Order Service**: Order processing and tracking
- **Cart Service**: Shopping cart management
- **User Service**: User profile and preferences
- **Frontend**: Nginx-served static files

### Infrastructure
- **Database per Service**: Isolated MongoDB databases
- **Multi-stage Docker Builds**: Optimized for production
- **Health Checks**: Liveness and readiness probes
- **Environment Configs**: Separate dev/prod configurations
- **Shared Utilities**: Common middleware and validations

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐
│    Frontend     │────│   API Gateway    │
│   (Nginx:80)    │    │   (Port 8080)    │
└─────────────────┘    └──────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
        ┌───────▼───────┐ ┌─────▼─────┐ ┌─────▼─────┐
        │ Auth Service  │ │Menu Service│ │Order Service│
        │  (Port 5000)  │ │(Port 5001) │ │(Port 5002) │
        └───────────────┘ └───────────┘ └─────────────┘
                │               │               │
        ┌───────▼───────┐ ┌─────▼─────┐ ┌─────▼─────┐
        │ User Service  │ │Cart Service│ │  MongoDB  │
        │  (Port 5003)  │ │(Port 5004) │ │(Port 27017)│
        └───────────────┘ └───────────┘ └───────────┘
```

## 🚀 Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 18+ (for local development)

### Development Setup
1. Clone the repository:
```bash
git clone <repository-url>
cd vitalbites
```

2. Copy environment configuration:
```bash
cp .env.dev.example .env.dev
```

3. Start development environment:
```bash
docker-compose -f docker-compose.dev.yml up --build
```

### Production Deployment
1. Copy production environment:
```bash
cp .env.prod.example .env.prod
# Edit .env.prod with your production values
```

2. Deploy production environment:
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

## 📡 API Endpoints

### Health & Monitoring
- `GET /health` - Comprehensive system health
- `GET /ready` - Readiness probe
- `GET /live` - Liveness probe
- `GET /circuit-breaker-status` - Circuit breaker states

### Authentication
- `POST /api/auth/send-otp` - Send OTP to email
- `POST /api/auth/verify-otp` - Verify OTP and login
- `POST /api/auth/complete-registration` - Complete user registration

### Menu Management
- `GET /api/menu` - Get all menu items
- `POST /api/menu` - Add menu item (admin)
- `PUT /api/menu/:id` - Update menu item (admin)
- `DELETE /api/menu/:id` - Delete menu item (admin)

### Order Processing
- `POST /api/orders` - Place order
- `GET /api/orders/:userId` - Get user orders
- `GET /api/orders` - Get all orders (admin)

## 🔒 Security Features

- **Input Validation**: Comprehensive request validation
- **Rate Limiting**: DDoS protection
- **JWT Authentication**: Secure token-based auth
- **CORS Protection**: Configurable cross-origin policies
- **Security Headers**: XSS, content sniffing protection
- **Non-root Containers**: Enhanced container security

## 📊 Monitoring & Observability

- **Request Tracing**: Correlation IDs across services
- **Health Checks**: Service and dependency monitoring
- **Circuit Breaker**: Automatic failure handling
- **Structured Logging**: Timestamp and correlation tracking
- **Error Handling**: Standardized error responses

## 🛠️ Development

### Adding New Services
1. Create service directory with Dockerfile
2. Add health check endpoints (`/health`, `/ready`, `/live`)
3. Update docker-compose files
4. Add API Gateway routes
5. Configure circuit breaker

### Testing
```bash
# Test API Gateway syntax
cd api-gateway && node -c index.js

# Test individual service
cd auth-service && node -c index.js
```

## 📁 Project Structure

```
vitalbites/
├── api-gateway/          # API Gateway with middleware
│   ├── middleware/       # Rate limiting, logging, circuit breaker
│   ├── index.js
│   └── Dockerfile
├── auth-service/         # Authentication service
├── menu-service/         # Menu management
├── order-service/        # Order processing
├── cart-service/         # Shopping cart
├── user-service/         # User profiles
├── shared/              # Common utilities
│   ├── errorHandler.js
│   ├── validation.js
│   └── authMiddleware.js
├── docs/                # Documentation
├── docker-compose.dev.yml
├── docker-compose.prod.yml
└── README.md
```

## 🌟 Key Enhancements

### Phase 1: Core Infrastructure ✅
- Enhanced API Gateway with middleware
- Health check endpoints
- Circuit breaker pattern
- Multi-stage Docker builds
- Environment-specific configurations

### Phase 2: Security & Validation 🚧
- Input validation middleware
- Enhanced error handling
- Security headers
- CORS configuration

### Phase 3: Monitoring 🔄
- Metrics collection
- Distributed tracing
- Performance monitoring

### Phase 4: Advanced Features 📋
- Redis caching
- Message queuing
- Service discovery
- Auto-scaling

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

**VitalBites** - Delivering food with microservices excellence! 🍽️