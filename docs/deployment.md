# VitalBites Deployment Guide

## Prerequisites
- Docker Engine 20.10+ 
- Docker Compose v2.0+
- 4GB+ RAM
- 20GB+ disk space

## Environment Setup

### Development Environment

1. **Clone Repository**
```bash
git clone <repository-url>
cd vitalbites
```

2. **Configure Environment**
```bash
cp .env.dev.example .env.dev
# Edit .env.dev with your values
```

3. **Start Services**
```bash
docker-compose -f docker-compose.dev.yml up --build
```

4. **Verify Deployment**
```bash
# Check all services are healthy
curl http://localhost:8080/health

# Check individual services
curl http://localhost:8080/ready
curl http://localhost:8080/metrics
```

### Production Environment

1. **Configure Environment**
```bash
cp .env.prod.example .env.prod
```

2. **Update Production Configuration**
Edit `.env.prod`:
```bash
# Database
MONGO_ROOT_USERNAME=admin
MONGO_ROOT_PASSWORD=your_secure_password_here

# Authentication  
JWT_SECRET=your_super_secure_jwt_secret_key

# Email (for OTP)
SMTP_EMAIL=your_production_email@domain.com
SMTP_PASS=your_app_password

# CORS
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

3. **Deploy Production**
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

## Service Architecture

### Port Mapping
- **Frontend**: 80 (HTTP), 443 (HTTPS)
- **API Gateway**: 8080
- **Auth Service**: 5000 (internal)
- **Menu Service**: 5001 (internal)
- **Order Service**: 5002 (internal)  
- **User Service**: 5003 (internal)
- **Cart Service**: 5004 (internal)
- **MongoDB**: 27017 (internal)
- **Redis**: 6379 (internal)

### Health Checks
All services include health checks:
- **Interval**: 30 seconds
- **Timeout**: 10 seconds
- **Retries**: 3
- **Start Period**: 30-40 seconds

## Monitoring

### Health Endpoints
```bash
# Gateway health (includes all services)
curl http://localhost:8080/health

# Individual service health
curl http://localhost:8080/api/auth/health
curl http://localhost:8080/api/menu/health
# etc...
```

### Metrics
```bash
# Performance metrics
curl http://localhost:8080/metrics

# Circuit breaker status
curl http://localhost:8080/circuit-breaker-status
```

### Logs
```bash
# View all logs
docker-compose -f docker-compose.dev.yml logs -f

# View specific service logs
docker-compose -f docker-compose.dev.yml logs -f api-gateway
docker-compose -f docker-compose.dev.yml logs -f auth-service
```

## Scaling

### Horizontal Scaling (Production)
The production compose file supports scaling:

```bash
# Scale API Gateway
docker-compose -f docker-compose.prod.yml up --scale api-gateway=3 -d

# Scale specific services
docker-compose -f docker-compose.prod.yml up --scale auth-service=2 --scale menu-service=2 -d
```

### Load Balancing
For production, consider adding a load balancer:

**nginx.conf example:**
```nginx
upstream api_gateway {
    server api-gateway-1:8080;
    server api-gateway-2:8080;
    server api-gateway-3:8080;
}

server {
    listen 80;
    location /api/ {
        proxy_pass http://api_gateway;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

## Database Management

### MongoDB Setup
The system uses separate databases per service:
- `authdb` - User authentication & profiles
- `menudb` - Menu items & categories
- `orderdb` - Orders & order history
- `cartdb` - Shopping carts
- `userdb` - User profiles & preferences

### Backup Strategy
```bash
# Create backup
docker exec vitalbites-mongodb-1 mongodump --uri="mongodb://admin:password@localhost:27017" --gzip --archive=/backup/backup-$(date +%Y%m%d-%H%M%S).gz

# Restore backup  
docker exec -i vitalbites-mongodb-1 mongorestore --uri="mongodb://admin:password@localhost:27017" --gzip --archive=/backup/backup-file.gz
```

### Database Migrations
For schema changes, create migration scripts in each service:

```javascript
// migrations/001-add-user-preferences.js
const mongoose = require('mongoose');

async function up() {
  const User = mongoose.model('User');
  await User.updateMany(
    { preferences: { $exists: false } },
    { $set: { preferences: {} } }
  );
}

async function down() {
  const User = mongoose.model('User');
  await User.updateMany(
    { preferences: { $exists: true } },
    { $unset: { preferences: 1 } }
  );
}

module.exports = { up, down };
```

## SSL/HTTPS Setup

### Development
For development, HTTP is sufficient. For HTTPS testing:

1. Generate self-signed certificates:
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

2. Update nginx configuration to include SSL

### Production
Use Let's Encrypt for free SSL certificates:

```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com

# Auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

## Performance Tuning

### Container Resources
Update docker-compose.prod.yml for production workloads:

```yaml
services:
  api-gateway:
    deploy:
      resources:
        limits:
          memory: 1G
          cpus: '1'
        reservations:
          memory: 512M
          cpus: '0.5'
```

### MongoDB Optimization
```javascript
// Connection pool optimization
mongoose.connect(mongoUrl, {
  maxPoolSize: 10,        // Maintain up to 10 socket connections
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  family: 4               // Use IPv4, skip trying IPv6
});
```

### Redis Optimization
```yaml
redis:
  command: redis-server --maxmemory 512mb --maxmemory-policy allkeys-lru
```

## Troubleshooting

### Common Issues

1. **Services not starting**
```bash
# Check logs
docker-compose logs service-name

# Check resource usage
docker stats

# Restart specific service
docker-compose restart service-name
```

2. **Database connection issues**
```bash
# Check MongoDB status
docker exec vitalbites-mongodb-1 mongosh --eval "db.adminCommand('ping')"

# Check Redis status  
docker exec vitalbites-redis-1 redis-cli ping
```

3. **Memory issues**
```bash
# Check container memory usage
docker stats --no-stream

# Increase Docker memory limits
# Docker Desktop: Settings → Resources → Memory
```

4. **Port conflicts**
```bash
# Check port usage
netstat -tulpn | grep :8080

# Change ports in docker-compose.yml if needed
```

### Circuit Breaker Recovery
If services are in circuit breaker OPEN state:

```bash
# Check circuit breaker status
curl http://localhost:8080/circuit-breaker-status

# Wait for automatic recovery (30 seconds default)
# Or restart the affected service
docker-compose restart service-name
```

## Backup & Recovery

### Complete System Backup
```bash
#!/bin/bash
BACKUP_DIR="/backups/$(date +%Y%m%d-%H%M%S)"
mkdir -p $BACKUP_DIR

# Database backup
docker exec vitalbites-mongodb-1 mongodump --uri="mongodb://admin:password@localhost:27017" --gzip --archive=/tmp/mongodb-backup.gz
docker cp vitalbites-mongodb-1:/tmp/mongodb-backup.gz $BACKUP_DIR/

# Redis backup
docker exec vitalbites-redis-1 redis-cli BGSAVE
docker cp vitalbites-redis-1:/data/dump.rdb $BACKUP_DIR/

# Application code
tar -czf $BACKUP_DIR/app-code.tar.gz --exclude=node_modules --exclude=.git .
```

### Disaster Recovery
```bash
#!/bin/bash
BACKUP_DIR="/backups/20240101-120000"  # Your backup directory

# Restore MongoDB
docker exec -i vitalbites-mongodb-1 mongorestore --uri="mongodb://admin:password@localhost:27017" --gzip --archive < $BACKUP_DIR/mongodb-backup.gz

# Restore Redis
docker cp $BACKUP_DIR/dump.rdb vitalbites-redis-1:/data/
docker-compose restart redis

# Verify services
curl http://localhost:8080/health
```

## Security Checklist

### Pre-deployment Security
- [ ] Change all default passwords
- [ ] Use strong JWT secrets  
- [ ] Configure CORS properly
- [ ] Enable HTTPS in production
- [ ] Review exposed ports
- [ ] Update container base images
- [ ] Scan for vulnerabilities

### Runtime Security  
- [ ] Monitor failed authentication attempts
- [ ] Set up log monitoring/alerting
- [ ] Regular security updates
- [ ] Monitor resource usage
- [ ] Backup verification
- [ ] Access log review

## Maintenance

### Regular Tasks
- **Daily**: Check service health, review error logs
- **Weekly**: Review metrics, check disk space
- **Monthly**: Update dependencies, security patches
- **Quarterly**: Performance review, capacity planning

### Updates
```bash
# Update specific service
docker-compose pull service-name
docker-compose up -d service-name

# Update all services
docker-compose pull
docker-compose up -d
```