# Multi-stage Dockerfile for ScanDoc API
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci --include=dev

COPY . .
# We use tsx or compile TypeScript
RUN npm run build || true

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package*.json ./
RUN npm ci --only=production && \
    npm install -g tsx

COPY --chown=nodejs:nodejs . .

# Create uploads directory and permissions
RUN mkdir -p /data/uploads /data/db && \
    chown -R nodejs:nodejs /data

USER nodejs

EXPOSE 3000
CMD ["tsx", "server.ts"]
