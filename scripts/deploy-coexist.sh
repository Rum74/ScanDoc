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

# 1. Dừng container cũ và build lại từ đầu không dùng cache
docker compose -f docker-compose.coexist.yml down || true
docker compose -f docker-compose.coexist.yml build --no-cache
docker compose -f docker-compose.coexist.yml up -d

# 2. Kiểm tra dịch vụ
echo "⏳ Đang kiểm tra ứng dụng tại http://127.0.0.1:3050/api/health..."
sleep 6

HEALTH_RES=$(curl -s http://127.0.0.1:3050/api/health || echo "FAILED")
echo "Chi tiết API Health:"
echo "$HEALTH_RES"

if echo "$HEALTH_RES" | grep -q '"status":"ok"'; then
  echo ""
  echo "✅ ScanDoc đã khởi động thành công trên cổng 3050!"
  echo "🌐 Test trực tiếp: http://221.121.1.220:3050"
  echo "🌐 Domain: http://scandoc.click (cần Nginx reverse proxy sang port 3050)"
  echo "⚠️ Nếu trình duyệt hiển thị bản cũ, hãy mở Tab Ẩn danh hoặc bấm Ctrl+Shift+R."
else
  echo "⚠️ Đang khởi động, kiểm tra log bằng: docker compose -f docker-compose.coexist.yml logs -f"
fi
echo "============================================================"
