/**
 * ScanDoc - Image Processing Web Worker
 * Chạy các tác vụ nặng: phát hiện 4 góc tài liệu, cắt phối cảnh (perspective warp),
 * áp dụng bộ lọc (gốc, màu tăng cường, xám, đen trắng adaptive, khử bóng).
 */

export interface Point {
  x: number;
  y: number;
}

export type FilterType = 'original' | 'enhanced' | 'grayscale' | 'bw' | 'shadow_removal';

// Helper: tính khoảng cách Euclid giữa 2 điểm
function distance(p1: Point, p2: Point): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

// 1. DÒ TÌM 4 GÓC TỰ ĐỘNG
// Thu nhỏ ảnh về max 800px cạnh dài, phát hiện biên và tìm tứ giác có diện tích lớn nhất
export function detectDocumentCorners(
  imageData: ImageData,
  origWidth: number,
  origHeight: number
): [Point, Point, Point, Point] {
  const { width, height, data } = imageData;
  const gray = new Uint8Array(width * height);

  // Chuyển sang ảnh xám
  for (let i = 0, j = 0; i < data.length; i += 4, j++) {
    gray[j] = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
  }

  // Gaussian blur 5x5 nhẹ để giảm nhiễu hạt
  const blurred = new Uint8Array(width * height);
  for (let y = 2; y < height - 2; y++) {
    for (let x = 2; x < width - 2; x++) {
      let sum = 0;
      // Kernel xấp xỉ
      sum += gray[(y - 1) * width + x] * 2;
      sum += gray[(y + 1) * width + x] * 2;
      sum += gray[y * width + (x - 1)] * 2;
      sum += gray[y * width + (x + 1)] * 2;
      sum += gray[y * width + x] * 4;
      blurred[y * width + x] = Math.floor(sum / 12);
    }
  }

  // Tìm gradient Sobel cơ bản
  const edges = new Uint8Array(width * height);
  let maxGrad = 0;
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const gx =
        -blurred[(y - 1) * width + (x - 1)] +
        blurred[(y - 1) * width + (x + 1)] -
        2 * blurred[y * width + (x - 1)] +
        2 * blurred[y * width + (x + 1)] -
        blurred[(y + 1) * width + (x - 1)] +
        blurred[(y + 1) * width + (x + 1)];

      const gy =
        -blurred[(y - 1) * width + (x - 1)] -
        2 * blurred[(y - 1) * width + x] -
        blurred[(y - 1) * width + (x + 1)] +
        blurred[(y + 1) * width + (x - 1)] +
        2 * blurred[(y + 1) * width + x] +
        blurred[(y + 1) * width + (x + 1)];

      const mag = Math.abs(gx) + Math.abs(gy);
      edges[y * width + x] = mag > 255 ? 255 : mag;
      if (mag > maxGrad) maxGrad = mag;
    }
  }

  // Quét các điểm biên mạnh ở 4 góc phần tư để định vị tứ giác tài liệu
  const thresh = Math.max(50, Math.min(120, maxGrad * 0.35));

  // Phân bổ 4 góc: Top-Left, Top-Right, Bottom-Right, Bottom-Left
  let bestTL: Point = { x: Math.round(width * 0.08), y: Math.round(height * 0.08) };
  let bestTR: Point = { x: Math.round(width * 0.92), y: Math.round(height * 0.08) };
  let bestBR: Point = { x: Math.round(width * 0.92), y: Math.round(height * 0.92) };
  let bestBL: Point = { x: Math.round(width * 0.08), y: Math.round(height * 0.92) };

  let minScoreTL = Infinity;
  let maxScoreTR = -Infinity;
  let maxScoreBR = -Infinity;
  let minScoreBL = Infinity;

  // Lấy các điểm cạnh mạnh (sample theo bước nhảy 3px để cực nhanh)
  for (let y = Math.floor(height * 0.05); y < height * 0.95; y += 4) {
    for (let x = Math.floor(width * 0.05); x < width * 0.95; x += 4) {
      if (edges[y * width + x] > thresh) {
        // x + y nhỏ nhất -> TL
        const sTL = x + y;
        if (sTL < minScoreTL) {
          minScoreTL = sTL;
          bestTL = { x, y };
        }
        // x - y lớn nhất -> TR
        const sTR = x - y;
        if (sTR > maxScoreTR) {
          maxScoreTR = sTR;
          bestTR = { x, y };
        }
        // x + y lớn nhất -> BR
        const sBR = x + y;
        if (sBR > maxScoreBR) {
          maxScoreBR = sBR;
          bestBR = { x, y };
        }
        // x - y nhỏ nhất -> BL
        const sBL = x - y;
        if (sBL < minScoreBL) {
          minScoreBL = sBL;
          bestBL = { x, y };
        }
      }
    }
  }

  // Kiểm tra tính hợp lệ của tứ giác (diện tích tối thiểu)
  const quadWidth = (distance(bestTL, bestTR) + distance(bestBL, bestBR)) / 2;
  const quadHeight = (distance(bestTL, bestBL) + distance(bestTR, bestBR)) / 2;
  const area = quadWidth * quadHeight;
  const minValidArea = width * height * 0.15; // Phải chiếm ít nhất 15% diện tích màn hình

  if (area < minValidArea) {
    // Trả về lề mặc định 6% nếu không tìm thấy biên rõ ràng
    return [
      { x: 0.06, y: 0.06 },
      { x: 0.94, y: 0.06 },
      { x: 0.94, y: 0.94 },
      { x: 0.06, y: 0.94 },
    ];
  }

  // Chuẩn hóa tọa độ về dải [0, 1]
  return [
    { x: Math.max(0, Math.min(1, bestTL.x / width)), y: Math.max(0, Math.min(1, bestTL.y / height)) },
    { x: Math.max(0, Math.min(1, bestTR.x / width)), y: Math.max(0, Math.min(1, bestTR.y / height)) },
    { x: Math.max(0, Math.min(1, bestBR.x / width)), y: Math.max(0, Math.min(1, bestBR.y / height)) },
    { x: Math.max(0, Math.min(1, bestBL.x / width)), y: Math.max(0, Math.min(1, bestBL.y / height)) },
  ];
}

// 2. BIẾN ĐỔI PHỐI CẢNH (PERSPECTIVE WARP)
// Tính toán ma trận biến đổi phối cảnh 3x3 ngược và nội suy song tuyến (bilinear interpolation)
export function getPerspectiveTransformMatrix(
  src: [Point, Point, Point, Point],
  dstW: number,
  dstH: number
): number[] {
  // dst points: (0,0), (dstW,0), (dstW,dstH), (0,dstH)
  const [p0, p1, p2, p3] = src;
  const x0 = p0.x, y0 = p0.y;
  const x1 = p1.x, y1 = p1.y;
  const x2 = p2.x, y2 = p2.y;
  const x3 = p3.x, y3 = p3.y;

  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const sx = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const sy = y0 - y1 + y2 - y3;

  let g = 0, h = 0;
  if (sx === 0 && sy === 0) {
    // Affine
    return [
      (x1 - x0) / dstW, (x3 - x0) / dstH, x0,
      (y1 - y0) / dstW, (y3 - y0) / dstH, y0,
      0, 0, 1,
    ];
  }

  const det = dx1 * dy2 - dy1 * dx2;
  g = ((sx * dy2 - sy * dx2) / (det || 1e-7)) / dstW;
  h = ((dx1 * sy - dy1 * sx) / (det || 1e-7)) / dstH;

  const a = (x1 - x0) / dstW + g * x1;
  const b = (x3 - x0) / dstH + h * x3;
  const c = x0;
  const d = (y1 - y0) / dstW + g * y1;
  const e = (y3 - y0) / dstH + h * y3;
  const f = y0;

  return [a, b, c, d, e, f, g, h, 1];
}

// 3. BỘ LỌC TÀI LIỆU NÂNG CAO
export function applyDocumentFilters(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  filter: FilterType,
  brightness: number, // -50 đến 50
  contrast: number // -50 đến 50
) {
  const len = pixels.length;

  // Tính hệ số tương phản
  const factor = (259 * (contrast + 255)) / (255 * (259 - contrast));

  if (filter === 'grayscale') {
    for (let i = 0; i < len; i += 4) {
      let g = 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
      g = factor * (g + brightness - 128) + 128;
      g = g < 0 ? 0 : g > 255 ? 255 : g;
      pixels[i] = g;
      pixels[i + 1] = g;
      pixels[i + 2] = g;
    }
  } else if (filter === 'bw') {
    // Đen trắng: Adaptive Threshold cục bộ dạng integral image (Bradley-Roth)
    const gray = new Uint8Array(width * height);
    for (let i = 0, j = 0; i < len; i += 4, j++) {
      gray[j] = Math.round(0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2]);
    }

    // Integral Image
    const integral = new Float64Array(width * height);
    for (let y = 0; y < height; y++) {
      let sum = 0;
      for (let x = 0; x < width; x++) {
        sum += gray[y * width + x];
        if (y === 0) {
          integral[y * width + x] = sum;
        } else {
          integral[y * width + x] = integral[(y - 1) * width + x] + sum;
        }
      }
    }

    const s = Math.max(8, Math.round(width / 16)); // Kích thước cửa sổ
    const t = 15; // Ngưỡng phần trăm

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const x1 = Math.max(0, x - s);
        const x2 = Math.min(width - 1, x + s);
        const y1 = Math.max(0, y - s);
        const y2 = Math.min(height - 1, y + s);
        const count = (x2 - x1 + 1) * (y2 - y1 + 1);

        const sum =
          integral[y2 * width + x2] -
          (x1 > 0 ? integral[y2 * width + (x1 - 1)] : 0) -
          (y1 > 0 ? integral[(y1 - 1) * width + x2] : 0) +
          (x1 > 0 && y1 > 0 ? integral[(y1 - 1) * width + (x1 - 1)] : 0);

        const idx = (y * width + x) * 4;
        const val = gray[y * width + x];

        // Nếu điểm ảnh nhỏ hơn (1 - t/100) giá trị trung bình xung quanh -> chữ đen (0), ngược lại nền trắng (255)
        const isBlack = val * count < sum * ((100 - t) / 100);
        const out = isBlack ? 0 : 255;
        pixels[idx] = out;
        pixels[idx + 1] = out;
        pixels[idx + 2] = out;
      }
    }
  } else if (filter === 'enhanced') {
    // Màu tăng cường (Magic Color): làm sáng nền giấy, tăng độ sắc nét văn bản
    for (let i = 0; i < len; i += 4) {
      let r = pixels[i];
      let g = pixels[i + 1];
      let b = pixels[i + 2];

      // Làm sáng nền và tăng tương phản nhẹ
      r = Math.min(255, Math.pow(r / 255, 0.85) * 255 + brightness + 10);
      g = Math.min(255, Math.pow(g / 255, 0.85) * 255 + brightness + 10);
      b = Math.min(255, Math.pow(b / 255, 0.85) * 255 + brightness + 10);

      // Contrast
      r = factor * (r - 128) + 128;
      g = factor * (g - 128) + 128;
      b = factor * (b - 128) + 128;

      pixels[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      pixels[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      pixels[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  } else if (filter === 'shadow_removal') {
    // Khử bóng: ước lượng nền chiếu sáng bằng downsample làm mịn rồi chia mẫu
    const scale = 8;
    const sw = Math.floor(width / scale);
    const sh = Math.floor(height / scale);
    const bgMap = new Float32Array(sw * sh);

    for (let sy = 0; sy < sh; sy++) {
      for (let sx = 0; sx < sw; sx++) {
        let sum = 0;
        let count = 0;
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = sx * scale + dx;
            const py = sy * scale + dy;
            if (px < width && py < height) {
              const idx = (py * width + px) * 4;
              const lum = 0.299 * pixels[idx] + 0.587 * pixels[idx + 1] + 0.114 * pixels[idx + 2];
              sum += lum;
              count++;
            }
          }
        }
        bgMap[sy * sw + sx] = count ? sum / count : 128;
      }
    }

    for (let y = 0; y < height; y++) {
      const sy = Math.min(sh - 1, Math.floor(y / scale));
      for (let x = 0; x < width; x++) {
        const sx = Math.min(sw - 1, Math.floor(x / scale));
        const bgVal = Math.max(30, bgMap[sy * sw + sx]);
        const idx = (y * width + x) * 4;

        for (let c = 0; c < 3; c++) {
          let val = (pixels[idx + c] / bgVal) * 220 + brightness;
          val = factor * (val - 128) + 128;
          pixels[idx + c] = val < 0 ? 0 : val > 255 ? 255 : val;
        }
      }
    }
  } else {
    // Original + Brightness/Contrast
    if (brightness !== 0 || contrast !== 0) {
      for (let i = 0; i < len; i += 4) {
        let r = factor * (pixels[i] + brightness - 128) + 128;
        let g = factor * (pixels[i + 1] + brightness - 128) + 128;
        let b = factor * (pixels[i + 2] + brightness - 128) + 128;
        pixels[i] = r < 0 ? 0 : r > 255 ? 255 : r;
        pixels[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
        pixels[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
      }
    }
  }
}

// Worker message handling
self.onmessage = (e: MessageEvent) => {
  const { type, payload, id } = e.data;

  try {
    if (type === 'DETECT_CORNERS') {
      const { imageData, origWidth, origHeight } = payload;
      const corners = detectDocumentCorners(imageData, origWidth, origHeight);
      self.postMessage({ id, type: 'DETECT_CORNERS_SUCCESS', corners });
    } else if (type === 'APPLY_FILTERS') {
      const { pixels, width, height, filter, brightness, contrast } = payload;
      applyDocumentFilters(pixels, width, height, filter, brightness, contrast);
      (self as any).postMessage({ id, type: 'APPLY_FILTERS_SUCCESS', pixels }, [pixels.buffer]);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Lỗi xử lý ảnh trong worker';
    self.postMessage({ id, type: 'ERROR', error: errorMsg });
  }
};
