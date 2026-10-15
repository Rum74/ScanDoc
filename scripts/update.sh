#!/usr/bin/env bash
# ==============================================================================
# Script tự động cập nhật ScanDoc lên phiên bản mới nhất từ GitHub trên VPS
# ==============================================================================
set -e

echo "============================================================"
echo "🔄 CẬP NHẬT SCANDOC LÊN PHIÊN BẢN MỚI NHẤT"
echo "============================================================"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SCRIPT_DIR"

echo "📥 1/3. Đang đồng bộ mã nguồn mới nhất từ GitHub..."
git fetch origin main
git reset --hard origin/main
git clean -fd

echo "🔨 2/3. Dừng container cũ và build lại từ đầu (Không dùng cache cũ)..."
docker compose -f docker-compose.coexist.yml down || true
docker compose -f docker-compose.coexist.yml build --no-cache
docker compose -f docker-compose.coexist.yml up -d

echo "⏳ 3/3. Kiểm tra trạng thái hệ thống sau khi khởi động..."
sleep 6

HEALTH_RES=$(curl -s http://127.0.0.1:3050/api/health || echo "FAILED")
echo ""
echo "Chi tiết API Health:"
echo "$HEALTH_RES"
echo ""

echo "============================================================"
echo "✅ ĐÃ CẬP NHẬT THÀNH CÔNG!"
echo "🌐 Kiểm tra trực tiếp tại IP: http://221.121.1.220:3050"
echo "🌐 Hoặc qua tên miền: http://scandoc.click"
echo ""
echo "⚠️ LƯU Ý NẾU TRÌNH DUYỆT VẪN HIỆN GIAO DIỆN CŨ:"
echo "Do ứng dụng là PWA (Service Worker lưu đệm ngoại tuyến):"
echo "1. Hãy mở bằng Tab Ẩn Danh (Incognito) để thấy ngay giao diện mới."
echo "2. Hoặc trên trình duyệt bấm tổ hợp phím Ctrl + Shift + R (Windows) hoặc Cmd + Shift + R (Mac) để xóa bộ nhớ đệm."
echo "3. Trên điện thoại: Vào cài đặt trình duyệt -> Xóa dữ liệu web của scandoc.click."
echo "============================================================"
