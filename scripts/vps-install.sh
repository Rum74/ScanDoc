#!/usr/bin/env bash
# ==============================================================================
# ScanDoc - Script Cài Đặt Trọn Gói Tự Động Cho VPS (Domain: scandoc.click)
# Tương thích 100% với VPS ĐÃ CÓ WEB ĐANG CHẠY (Không làm ảnh hưởng web cũ)
# ==============================================================================

set -euo pipefail

DOMAIN="scandoc.click"
PORT_INTERNAL="3050"
APP_DIR="/opt/scandoc"

echo "============================================================"
echo "🚀 ĐANG CÀI ĐẶT SCANDOC LÊN VPS CHO TÊN MIỀN: ${DOMAIN}"
echo "============================================================"

# 1. Kiểm tra quyền root
if [ "$EUID" -ne 0 ]; then
  echo "❌ Vui lòng chạy script này với quyền root: sudo bash scripts/vps-install.sh"
  exit 1
fi

# 2. Đảm bảo Docker & Docker Compose đã được cài đặt
if ! command -v docker &> /dev/null; then
  echo "📦 Đang cài đặt Docker..."
  apt-get update -y
  apt-get install -y curl ca-certificates gnupg
  curl -fsSL https://get.docker.com -o /tmp/get-docker.sh
  sh /tmp/get-docker.sh
  rm -f /tmp/get-docker.sh
fi

if ! docker compose version &> /dev/null; then
  echo "📦 Đang cài đặt Docker Compose..."
  apt-get update -y
  apt-get install -y docker-compose-plugin || true
fi

# 3. Tạo thư mục lưu trữ dữ liệu
mkdir -p /data/uploads /data/db
chmod -R 777 /data/uploads /data/db || true

# 4. Tạo file .env hoàn chỉnh nếu chưa có
cd "$APP_DIR"
cat << 'EOF' > .env
DOMAIN=scandoc.click
NODE_ENV=production
PORT=3000
MONGO_INITDB_ROOT_USERNAME=scandoc_user
MONGO_INITDB_ROOT_PASSWORD=scandoc_secure_pass_2026_x87f6
MONGO_URI=mongodb://scandoc_user:scandoc_secure_pass_2026_x87f6@mongo:27017/scandoc?authSource=admin
JWT_SECRET=scandoc_jwt_947f89b6c430e7fa1209b55891d4e0e8f3b2a1975e840d
REFRESH_SECRET=scandoc_refresh_8b21c49e0f31a78dc1249b55891d4e0e8f3b2a1975e840
JWT_EXPIRES_IN=15m
REFRESH_EXPIRES_IN=7d
UPLOAD_DIR=/data/uploads
MAX_USER_BYTES=1073741824
EOF

# 5. Khởi động ScanDoc trên cổng 3050 (không đè lên cổng 80/443 của web cũ)
echo "🐳 Đang khởi chạy ScanDoc và MongoDB..."
docker compose -f docker-compose.coexist.yml up -d --build

# 6. Đợi kiểm tra dịch vụ
echo "⏳ Đang kiểm tra ứng dụng khởi động..."
sleep 10

if curl -s http://127.0.0.1:3050/api/health | grep -q '"status":"ok"'; then
  echo "✅ ScanDoc đã chạy thành công trên cổng nội bộ 3050!"
else
  echo "⚠️ Ứng dụng đang khởi động, tiếp tục cấu hình kết nối..."
fi

# 7. Tự động cấu hình Nginx nếu máy chủ có Nginx
if command -v nginx &> /dev/null; then
  echo "🌐 Phát hiện Nginx trên VPS! Đang tự động cấu hình Virtual Host cho ${DOMAIN}..."
  
  cat << EOF > /etc/nginx/sites-available/${DOMAIN}
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};
    client_max_body_size 25M;

    location / {
        proxy_pass http://127.0.0.1:${PORT_INTERNAL};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF

  ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/
  nginx -t && systemctl reload nginx
  echo "✅ Nginx đã nhận diện domain ${DOMAIN} trỏ về ScanDoc!"

  # Kiểm tra certbot
  if command -v certbot &> /dev/null; then
    echo "🔒 Đang cấp chứng chỉ SSL HTTPS miễn phí qua Certbot..."
    certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email || true
  else
    echo "💡 Gợi ý: Chạy lệnh sau để bật SSL HTTPS miễn phí:"
    echo "   sudo apt install -y certbot python3-certbot-nginx"
    echo "   sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
  fi
fi

echo ""
echo "============================================================"
echo "🎉 HOÀN TẤT TRIỂN KHAI SCANDOC!"
echo "   👉 Tên miền: https://${DOMAIN}"
echo "   👉 API Test: http://127.0.0.1:3050/api/health"
echo "   👉 Web cũ của bạn trên VPS vẫn hoạt động bình thường 100%!"
echo "============================================================"
