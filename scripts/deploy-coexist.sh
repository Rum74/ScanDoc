#!/usr/bin/env bash
# ==============================================================================
# Script triển khai ScanDoc chạy SONG SONG với web cũ trên cùng VPS
# Không chiếm cổng 80/443 của website hiện tại
# ==============================================================================

set -euo pipefail

echo "============================================================"
echo "🚀 Khởi chạy ScanDoc chạy song song với web cũ (Port 3050)..."
echo "============================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

# 1. Chạy container ScanDoc và MongoDB ở port nội bộ 3050
docker compose -f docker-compose.coexist.yml up -d --build

# 2. Kiểm tra dịch vụ
echo "⏳ Đang kiểm tra ứng dụng tại http://127.0.0.1:3050/api/health..."
sleep 8

if curl -s http://127.0.0.1:3050/api/health | grep -q '"status":"ok"'; then
  echo "✅ ScanDoc đã khởi động thành công trên cổng nội bộ 3050!"
  echo ""
  echo "👉 Bước tiếp theo: Cấu hình Web Server hiện tại (Nginx/aaPanel) để chuyển tiếp scandoc.click sang port 3050."
  echo "   (Xem file nginx-scandoc.conf để copy cấu hình)"
else
  echo "⚠️ Đang khởi động, kiểm tra log bằng: docker compose -f docker-compose.coexist.yml logs -f"
fi
echo "============================================================"
