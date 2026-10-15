#!/usr/bin/env bash
# ==============================================================================
# ScanDoc VPS 1-Click Deployment Script
# Domain: scandoc.click | VPS IP: 221.121.1.220
# ==============================================================================

set -euo pipefail

echo "============================================================"
echo "🚀 Bắt đầu triển khai ScanDoc lên VPS (scandoc.click)..."
echo "============================================================"

# 1. Kiểm tra quyền root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Vui lòng chạy script này với quyền root: sudo bash scripts/deploy.sh"
  exit 1
fi

# 2. Cài đặt Docker & Docker Compose nếu chưa có
if ! command -v docker &> /dev/null; then
  echo "📦 Đang cài đặt Docker..."
  apt-get update -y
  apt-get install -y curl ca-certificates gnupg lsb-release
  curl -fsSL https://get.docker.com -o get-docker.sh
  sh get-docker.sh
  rm -f get-docker.sh
fi

if ! docker compose version &> /dev/null; then
  echo "📦 Đang cài đặt Docker Compose..."
  apt-get update -y
  apt-get install -y docker-compose-plugin || true
fi

# 3. Mở cổng tường lửa UFW (80, 443, 22)
if command -v ufw &> /dev/null; then
  echo "🛡️ Cấu hình tường lửa UFW..."
  ufw allow 22/tcp || true
  ufw allow 80/tcp || true
  ufw allow 443/tcp || true
  ufw --force enable || true
fi

# 4. Chuẩn bị file cấu hình môi trường .env
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

if [ ! -f .env ]; then
  if [ -f .env.production ]; then
    echo "⚙️ Thiết lập file cấu hình từ .env.production..."
    cp .env.production .env
  else
    echo "⚙️ Thiết lập file cấu hình từ .env.example..."
    cp .env.example .env
  fi
fi

# 5. Phân quyền thư mục
mkdir -p /data/uploads /data/db
chmod -R 777 /data/uploads /data/db || true
chmod +x scripts/backup.sh || true

# 6. Khởi động các container qua Docker Compose
echo "🐳 Đang build và chạy Docker containers..."
docker compose down || true
docker compose up -d --build

# 7. Kiểm tra trạng thái dịch vụ (Health check)
echo "⏳ Đang đợi dịch vụ khởi động hoàn tất..."
sleep 10

MAX_ATTEMPTS=12
ATTEMPT=1
SUCCESS=0

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
  if docker compose ps | grep -q "healthy"; then
    SUCCESS=1
    break
  fi
  echo "Đang kiểm tra dịch vụ (lần $ATTEMPT/$MAX_ATTEMPTS)..."
  sleep 5
  ATTEMPT=$((ATTEMPT + 1))
done

echo ""
echo "============================================================"
if [ $SUCCESS -eq 1 ]; then
  echo "🎉 TRIỂN KHAI THÀNH CÔNG!"
  echo ""
  echo "🌐 Trang web của bạn đã hoạt động tại:"
  echo "   👉 https://scandoc.click"
  echo "   👉 https://www.scandoc.click"
  echo ""
  echo "🔍 Kiểm tra API Healthcheck:"
  echo "   👉 https://scandoc.click/api/health"
  echo ""
  echo "📋 Xem log hoạt động:"
  echo "   docker compose logs -f"
else
  echo "⚠️ Các dịch vụ đã được kích hoạt. Hãy kiểm tra trạng thái:"
  echo "   docker compose ps"
  echo "   docker compose logs -f api"
fi
echo "============================================================"
