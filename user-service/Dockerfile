# Multi-stage build for User Service
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm install
COPY . .
EXPOSE 5003
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS build
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force

# Production runtime stage
FROM node:18-alpine AS production
WORKDIR /app

# Install curl for health checks
RUN apk --no-cache add curl

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S vitalbites -u 1001

# Copy production dependencies and source code
COPY --from=build /app/node_modules ./node_modules
COPY --chown=vitalbites:nodejs . .

# Set user
USER vitalbites

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:5003/health || exit 1

EXPOSE 5003
CMD ["node", "index.js"]