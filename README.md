# ScanDoc - Hướng dẫn triển khai cho scandoc.click trên VPS (221.121.1.220)

Hệ thống đã được đóng gói và cấu hình sẵn sàng 100% để chạy tên miền **scandoc.click** trên máy chủ VPS IP **221.121.1.220**.

---

## BƯỚC 1: Cấu hình DNS Tên Miền (Tại nơi quản lý domain của bạn)

Đăng nhập vào trang quản trị tên miền `scandoc.click` (Cloudflare, Namecheap, GoDaddy, Pavietnam, Matbao...) và thêm 2 bản ghi sau:

| Loại (Type) | Tên (Host / Name) | Giá trị (IP Address) | Proxy / TTL |
| :--- | :--- | :--- | :--- |
| **A** | `@` (hoặc `scandoc.click`) | **`221.121.1.220`** | DNS only (Tắt đám mây cam nếu dùng Cloudflare) |
| **A** | `www` | **`221.121.1.220`** | DNS only |

> 💡 **Lưu ý**: Caddy sẽ tự động kết nối Let's Encrypt để xin chứng chỉ SSL HTTPS miễn phí cho `scandoc.click` và `www.scandoc.click` ngay khi DNS nhận diện IP.

---

## BƯỚC 2: Đăng nhập vào VPS qua SSH

Mở Terminal trên máy tính của bạn và đăng nhập vào VPS:
```bash
ssh root@221.121.1.220
```

---

## BƯỚC 3: Đưa mã nguồn lên VPS & Chạy 1 Lệnh Tự Động

### Cách A: Tải và triển khai trực tiếp bằng 1 lệnh trên VPS
Tại terminal của VPS, bạn chỉ cần chạy:

```bash
mkdir -p /opt/scandoc && cd /opt/scandoc

# Nếu bạn đẩy code lên Git (GitHub/GitLab):
# git clone <link-repo-cua-ban> .

# Chạy script tự động cài đặt Docker, mở cổng và khởi chạy:
sudo bash scripts/deploy.sh
```

### Cách B: Copy trực tiếp thư mục dự án từ máy tính lên VPS qua SCP
Nếu mã nguồn đang ở trên máy tính của bạn:
```bash
# Chạy lệnh này từ máy tính của bạn:
scp -r ./* root@221.121.1.220:/opt/scandoc/

# Sau đó đăng nhập vào VPS và chạy:
ssh root@221.121.1.220
cd /opt/scandoc
sudo bash scripts/deploy.sh
```

---

## BƯỚC 4: Kiểm tra hoạt động

1. **Kiểm tra trạng thái container:**
   ```bash
   docker compose ps
   ```
   Bạn sẽ thấy 4 container đều ở trạng thái `running` (hoặc `healthy`):
   - `caddy` (Cổng 80, 443 với SSL tự động)
   - `web` (Giao diện PWA ScanDoc)
   - `api` (Backend Express + JWT + Multer)
   - `mongo` (Cơ sở dữ liệu MongoDB an toàn nội bộ)

2. **Kiểm tra API trực tiếp trên VPS:**
   ```bash
   curl -f http://localhost:3000/api/health
   ```

3. **Truy cập từ trình duyệt điện thoại hoặc máy tính:**
   - 👉 **https://scandoc.click**
   - 👉 **https://www.scandoc.click**

---

## BƯỚC 5: Thiết lập sao lưu tự động hàng ngày (Khuyên dùng)

Trên VPS, chạy lệnh sau để tự động sao lưu MongoDB và ảnh scan lúc 2h sáng mỗi ngày:
```bash
chmod +x /opt/scandoc/scripts/backup.sh
(crontab -l 2>/dev/null; echo "0 2 * * * /opt/scandoc/scripts/backup.sh >> /var/log/scandoc_backup.log 2>&1") | crontab -
```
