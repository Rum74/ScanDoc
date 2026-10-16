# Multi-stage Dockerfile for ScanDoc API & Fullstack Web
# Stage 1: Build Frontend Assets
FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY --chown=nodejs:nodejs . .
# Copy compiled frontend from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist
# Copy pre-installed node_modules from builder (saves ~500s build time on VPS!)
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Create uploads directory and permissions
RUN mkdir -p /data/uploads /data/db && \
    chown -R nodejs:nodejs /data

USER nodejs

EXPOSE 3000
CMD ["node_modules/.bin/tsx", "server.ts"]
