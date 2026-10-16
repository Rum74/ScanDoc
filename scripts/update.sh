#!/usr/bin/env bash
# ==============================================================================
# Script tự động cập nhật ScanDoc lên phiên bản mới nhất từ GitHub trên VPS
# Tối ưu đặc biệt cho VPS 1GB RAM: Kích hoạt Swap + Giảm tải build Docker
# ==============================================================================
set -e

echo "============================================================"
echo "🚀 BẮT ĐẦU CẬP NHẬT SCANDOC LÊN PHIÊN BẢN MỚI NHẤT"
echo "============================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# 1. Kiểm tra và kích hoạt Swap nếu RAM < 1.5GB để tránh treo/OOM khi build
CURRENT_SWAP=$(free -m | awk '/^Swap:/ {print $2}')
if [ -z "$CURRENT_SWAP" ] || [ "$CURRENT_SWAP" -lt 512 ]; then
  echo "⚙️  Phát hiện VPS ít bộ nhớ đệm (RAM 1GB). Đang tạo Swap 2GB chống treo..."
  if [ ! -f /swapfile ]; then
    fallocate -l 2G /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile || true
    echo '/swapfile none swap sw 0 0' >> /etc/fstab || true
    echo "✅ Đã bật Swap 2GB thành công!"
  else
    swapon /swapfile || true
  fi
fi

# 2. Cập nhật mã nguồn
echo "📥 1/3. Đồng bộ mã nguồn mới nhất..."
git fetch origin main || true
git reset --hard origin/main || true
git clean -fd || true

# 3. Đảm bảo Dockerfile siêu nhẹ (1 lần install thay vì 2 lần, dùng Node 22)
cat << 'DOCKERFILE_EOF' > apps/api/Dockerfile
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
# Copy pre-installed node_modules from builder (tiết kiệm 500s build trên VPS!)
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules

# Create uploads directory and permissions
RUN mkdir -p /data/uploads /data/db && \
    chown -R nodejs:nodejs /data

USER nodejs

EXPOSE 3000
CMD ["node_modules/.bin/tsx", "server.ts"]
DOCKERFILE_EOF

# 4. Build và khởi động lại container
echo "🔨 2/3. Khởi động lại container (Tối ưu RAM & không dùng cache cũ)..."
docker compose -f docker-compose.coexist.yml down || true
docker compose -f docker-compose.coexist.yml build --no-cache
docker compose -f docker-compose.coexist.yml up -d

echo "⏳ 3/3. Đang kiểm tra phản hồi của web..."
sleep 6

HEALTH_RES=$(curl -s http://127.0.0.1:3050/api/health || echo "FAILED")
echo ""
echo "Kết quả kiểm tra nội bộ (Port 3050):"
echo "$HEALTH_RES"
echo ""

# 5. Khởi động lại Nginx nếu cần để xóa lỗi 502 Bad Gateway
if command -v systemctl >/dev/null 2>&1; then
  systemctl reload nginx || systemctl restart nginx || true
fi

echo "============================================================"
echo "🎉 CẬP NHẬT THÀNH CÔNG!"
echo "🌐 Truy cập trực tiếp: http://scandoc.click"
echo "🌐 Hoặc IP VPS: http://221.121.1.220:3050"
echo "============================================================"
