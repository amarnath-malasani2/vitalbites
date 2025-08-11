# VitalBites API Documentation

## Overview
VitalBites provides a comprehensive REST API for food delivery services with enhanced microservices architecture.

## Base URL
- Development: `http://localhost:8080`
- Production: `https://your-domain.com`

## Authentication
Most endpoints require JWT authentication. Include the token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

## Common Headers
- `Content-Type: application/json`
- `x-correlation-id: <optional-tracking-id>`

## Rate Limits
- Authentication endpoints: 10 requests per 15 minutes
- General endpoints: 100 requests per 15 minutes
- Admin endpoints: 50 requests per 15 minutes

## API Endpoints

### System Endpoints

#### Health Check
```http
GET /health
```
Returns comprehensive system health including all services.

**Response:**
```json
{
  "gateway": {
    "status": "healthy",
    "timestamp": "2024-01-01T12:00:00.000Z",
    "uptime": 3600,
    "memory": {...},
    "version": "1.0.0"
  },
  "status": "healthy",
  "services": [
    {
      "service": "auth-service",
      "status": "healthy",
      "responseTime": 45
    }
  ]
}
```

#### Readiness Probe
```http
GET /ready
```

#### Liveness Probe  
```http
GET /live
```

#### Metrics
```http
GET /metrics
```
Returns performance metrics and statistics.

**Response:**
```json
{
  "timestamp": "2024-01-01T12:00:00.000Z",
  "uptime": 3600,
  "memory": {
    "rss": 45,
    "heapTotal": 20,
    "heapUsed": 15,
    "external": 2
  },
  "requests": {
    "GET:/api/menu": {
      "count": 150,
      "rate": 2.5
    }
  },
  "responseTime": {
    "GET:/api/menu": {
      "average": 45,
      "min": 20,
      "max": 150
    }
  }
}
```

#### Circuit Breaker Status
```http
GET /circuit-breaker-status
```

### Authentication Endpoints

#### Send OTP
```http
POST /api/auth/send-otp
```

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "message": "OTP sent"
}
```

#### Verify OTP
```http
POST /api/auth/verify-otp
```

**Request:**
```json
{
  "email": "user@example.com",
  "otp": "123456"
}
```

**Response (New User):**
```json
{
  "needDetails": true,
  "isNewUser": true,
  "message": "Please complete your registration"
}
```

**Response (Existing User):**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "userId": "60f7b1c9e4b0c8a2d8f9e123",
  "username": "John Doe",
  "mobile": "+919876543210",
  "role": "user"
}
```

#### Complete Registration
```http
POST /api/auth/complete-registration
```

**Request:**
```json
{
  "email": "user@example.com",
  "username": "John Doe",
  "mobile": "+919876543210"
}
```

#### Verify Token
```http
GET /api/auth/verify
Authorization: Bearer <token>
```

#### Address Management

##### Get User Addresses
```http
GET /api/auth/addresses
Authorization: Bearer <token>
```

##### Add Address
```http
POST /api/auth/addresses
Authorization: Bearer <token>
```

**Request:**
```json
{
  "fullName": "John Doe",
  "mobile": "+919876543210",
  "street": "123 Main Street, Apartment 4B",
  "city": "Mumbai",
  "state": "Maharashtra", 
  "pincode": "400001",
  "deliveryInstructions": "Ring the bell twice",
  "isDefault": true
}
```

##### Update Address
```http
PUT /api/auth/addresses/:addressId
Authorization: Bearer <token>
```

##### Delete Address
```http
DELETE /api/auth/addresses/:addressId
Authorization: Bearer <token>
```

### Menu Management

#### Get Menu Items
```http
GET /api/menu
```

**Response:**
```json
[
  {
    "_id": "60f7b1c9e4b0c8a2d8f9e123",
    "name": "Margherita Pizza",
    "description": "Classic Italian pizza with tomato sauce and mozzarella",
    "price": 299.99,
    "category": "Pizza",
    "available": true,
    "image": "margherita.jpg"
  }
]
```

#### Add Menu Item (Admin)
```http
POST /api/menu
Authorization: Bearer <admin-token>
```

**Request:**
```json
{
  "name": "Margherita Pizza",
  "description": "Classic Italian pizza with tomato sauce and mozzarella",
  "price": 299.99,
  "category": "Pizza",
  "available": true
}
```

#### Update Menu Item (Admin)
```http
PUT /api/menu/:id
Authorization: Bearer <admin-token>
```

#### Delete Menu Item (Admin)
```http
DELETE /api/menu/:id
Authorization: Bearer <admin-token>
```

### Order Management

#### Place Order
```http
POST /api/orders
Authorization: Bearer <token>
```

**Request:**
```json
{
  "userId": "60f7b1c9e4b0c8a2d8f9e123",
  "items": [
    {
      "itemId": "60f7b1c9e4b0c8a2d8f9e456",
      "quantity": 2,
      "price": 299.99
    }
  ],
  "address": "123 Main Street, Mumbai, Maharashtra - 400001",
  "phone": "+919876543210",
  "total": 599.98
}
```

#### Get User Orders
```http
GET /api/orders/:userId
Authorization: Bearer <token>
```

#### Get All Orders (Admin)
```http
GET /api/orders
Authorization: Bearer <admin-token>
```

#### Update Order Status (Admin)
```http
PUT /api/orders/:id
Authorization: Bearer <admin-token>
```

**Request:**
```json
{
  "status": "preparing|out_for_delivery|delivered"
}
```

### Cart Management

#### Get Cart
```http
GET /api/cart
Authorization: Bearer <token>
```

#### Add to Cart
```http
POST /api/cart
Authorization: Bearer <token>
```

#### Update Cart Item
```http
PUT /api/cart/:itemId
Authorization: Bearer <token>
```

#### Remove from Cart
```http
DELETE /api/cart/:itemId  
Authorization: Bearer <token>
```

### User Management

#### Get User Profile
```http
GET /api/user/:userId
Authorization: Bearer <token>
```

#### Update User Profile
```http
PUT /api/user/:userId
Authorization: Bearer <token>
```

**Request:**
```json
{
  "username": "John Doe",
  "gender": "male",
  "dateOfBirth": "1990-01-01"
}
```

## Error Responses

All error responses follow this format:

```json
{
  "error": "Error message",
  "correlationId": "abc123def456",
  "timestamp": "2024-01-01T12:00:00.000Z",
  "details": [] // Optional validation errors
}
```

### HTTP Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing/invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error
- `503` - Service Unavailable (circuit breaker open)

## Validation Rules

### Email
- Must be valid email format
- Automatically normalized (lowercase, trimmed)

### Mobile Number
- Format: +91XXXXXXXXXX
- Must start with digits 6-9
- Exactly 10 digits after +91

### Username
- 2-50 characters
- Letters and spaces only
- Automatically trimmed

### Password/OTP
- OTP: Exactly 6 digits
- Strong password requirements for admin accounts

### Address
- All fields required except delivery instructions
- Pincode: 6 digits, cannot start with 0
- Street: 5-200 characters
- City/State: 2-50 characters

## Rate Limiting

When rate limit is exceeded:

```json
{
  "error": "Too many requests from this IP",
  "retryAfter": 60
}
```

## CORS Policy

Allowed origins are configurable via environment variables:
- Development: `localhost:80`, `localhost:3000` 
- Production: Your domain(s)

## Request Tracing

All requests receive a correlation ID for tracing:
- Automatically generated if not provided
- Included in all error responses
- Useful for debugging across services