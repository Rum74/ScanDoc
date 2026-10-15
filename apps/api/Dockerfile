# Multi-stage Dockerfile for ScanDoc API & Fullstack Web
# Stage 1: Build Frontend Assets
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

# Stage 2: Production Runner
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Security: Run as non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

COPY package*.json ./
RUN npm install --omit=dev --legacy-peer-deps && \
    npm install -g tsx

COPY --chown=nodejs:nodejs . .
# Copy compiled frontend from builder stage
COPY --from=builder --chown=nodejs:nodejs /app/dist ./dist

# Create uploads directory and permissions
RUN mkdir -p /data/uploads /data/db && \
    chown -R nodejs:nodejs /data

USER nodejs

EXPOSE 3000
CMD ["tsx", "server.ts"]
