# ScanDoc - Ứng dụng PWA Quét Tài Liệu Di Động

ScanDoc là ứng dụng PWA quét tài liệu chuyên nghiệp, giao diện tiếng Việt, mobile-first, hoạt động ngoại tuyến (Offline-First) với IndexedDB và tự động đồng bộ khi có kết nối mạng.

## Tính năng chính
- 📷 **Chụp & nhận diện viền thông minh**: Quét trực tiếp qua camera sau, nhận diện 4 góc tài liệu theo thời gian thực (tối ưu xử lý qua Web Worker, thu nhỏ ảnh ~800px trước khi dò biên).
- 🔍 **Chỉnh 4 góc phối cảnh (Perspective Warp)**: Tự do kéo 4 điểm góc kèm kính lúp phóng to 2.5x chính xác từng điểm ảnh.
- 🎨 **5 Bộ lọc tài liệu**:
  - Gốc (Original)
  - Màu tăng cường (Magic Color)
  - Xám (Grayscale)
  - Đen trắng văn bản (B&W Adaptive Threshold)
  - Khử bóng điện thoại (Shadow Removal)
- 📄 **Quản lý đa trang & Xuất PDF**: Chụp liên tục nhiều trang, sắp xếp thứ tự, xuất file PDF đa trang theo chất lượng (Nhỏ / Vừa / Cao), Web Share chia sẻ trực tiếp.
- 🔤 **OCR Tiếng Việt & Tiếng Anh**: Nhận dạng chữ viết, tìm kiếm toàn văn và sao chép văn bản.
- ☁️ **Đồng bộ đa thiết bị (Offline-First)**:
  - Có thể sử dụng ngay mà không cần tài khoản (lưu cục bộ IndexedDB).
  - Đăng ký/đăng nhập để tự động đồng bộ ngầm khi có mạng (Outbox queue, xung đột giải quyết theo `updatedAt` mới nhất).

---

## Hướng dẫn triển khai lên VPS bằng Docker

### 1. Chuẩn bị VPS
Yêu cầu hệ điều hành Ubuntu 20.04 / 22.04 / Debian, RAM tối thiểu 1GB.

Cài đặt Docker & Docker Compose:
```bash
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
```

### 2. Mở cổng tường lửa (UFW)
Mở cổng 80 (HTTP) và 443 (HTTPS):
```bash
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw reload
```

### 3. Trỏ tên miền DNS
Trỏ bản ghi `A` của tên miền (ví dụ: `scandoc.yourdomain.com`) về địa chỉ IP công khai của VPS.

### 4. Cấu hình biến môi trường
Clone mã nguồn vào VPS:
```bash
cd /opt
git clone <your-repo-url> scandoc
cd scandoc

cp .env.example .env
nano .env
```
Cập nhật các thông số quan trọng trong `.env`:
- `DOMAIN`: Tên miền của bạn (ví dụ: `scandoc.yourdomain.com`). Caddy sẽ tự động cấp chứng chỉ SSL Let's Encrypt miễn phí.
- `JWT_SECRET` & `REFRESH_SECRET`: Chuỗi ngẫu nhiên bảo mật dài tối thiểu 32 ký tự.
- `MAX_USER_BYTES`: Hạn mức lưu trữ mỗi tài khoản (mặc định 1GB = `1073741824`).

### 5. Khởi chạy hệ thống bằng Docker Compose
```bash
docker compose up -d --build
```

### 6. Kiểm tra trạng thái hoạt động
Kiểm tra API Health Check:
```bash
curl -f https://scandoc.yourdomain.com/api/health
```
Hoặc kiểm tra log:
```bash
docker compose logs -f api
```

### 7. Sao lưu định kỳ (Crontab)
Tự động sao lưu cơ sở dữ liệu MongoDB và tệp ảnh vào 2h sáng hàng ngày:
```bash
chmod +x scripts/backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/scandoc/scripts/backup.sh >> /var/log/scandoc_backup.log 2>&1") | crontab -
```
