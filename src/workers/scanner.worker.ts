/**
 * ScanDoc - Image Processing Web Worker
 * Chạy các tác vụ nặng: phát hiện 4 góc tài liệu, cắt phối cảnh (perspective warp),
 * áp dụng bộ lọc (gốc, màu tăng cường, xám, đen trắng adaptive, khử bóng),
 * làm nét (sharpen) và khử nhiễu (denoise).
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

  const thresh = Math.max(50, Math.min(120, maxGrad * 0.35));

  let bestTL: Point = { x: Math.round(width * 0.08), y: Math.round(height * 0.08) };
  let bestTR: Point = { x: Math.round(width * 0.92), y: Math.round(height * 0.08) };
  let bestBR: Point = { x: Math.round(width * 0.92), y: Math.round(height * 0.92) };
  let bestBL: Point = { x: Math.round(width * 0.08), y: Math.round(height * 0.92) };

  let minScoreTL = Infinity;
  let maxScoreTR = -Infinity;
  let maxScoreBR = -Infinity;
  let minScoreBL = Infinity;

  for (let y = Math.floor(height * 0.05); y < height * 0.95; y += 4) {
    for (let x = Math.floor(width * 0.05); x < width * 0.95; x += 4) {
      if (edges[y * width + x] > thresh) {
        const sTL = x + y;
        if (sTL < minScoreTL) {
          minScoreTL = sTL;
          bestTL = { x, y };
        }
        const sTR = x - y;
        if (sTR > maxScoreTR) {
          maxScoreTR = sTR;
          bestTR = { x, y };
        }
        const sBR = x + y;
        if (sBR > maxScoreBR) {
          maxScoreBR = sBR;
          bestBR = { x, y };
        }
        const sBL = x - y;
        if (sBL < minScoreBL) {
          minScoreBL = sBL;
          bestBL = { x, y };
        }
      }
    }
  }

  const quadWidth = (distance(bestTL, bestTR) + distance(bestBL, bestBR)) / 2;
  const quadHeight = (distance(bestTL, bestBL) + distance(bestTR, bestBR)) / 2;
  const area = quadWidth * quadHeight;
  const minValidArea = width * height * 0.15;

  if (area < minValidArea) {
    return [
      { x: 0.06, y: 0.06 },
      { x: 0.94, y: 0.06 },
      { x: 0.94, y: 0.94 },
      { x: 0.06, y: 0.94 },
    ];
  }

  return [
    { x: Math.max(0, Math.min(1, bestTL.x / width)), y: Math.max(0, Math.min(1, bestTL.y / height)) },
    { x: Math.max(0, Math.min(1, bestTR.x / width)), y: Math.max(0, Math.min(1, bestTR.y / height)) },
    { x: Math.max(0, Math.min(1, bestBR.x / width)), y: Math.max(0, Math.min(1, bestBR.y / height)) },
    { x: Math.max(0, Math.min(1, bestBL.x / width)), y: Math.max(0, Math.min(1, bestBL.y / height)) },
  ];
}

// 2. LÀM NÉT (SHARPEN) & KHỬ NHIỄU (DENOISE)
function applyDenoise(pixels: Uint8ClampedArray, width: number, height: number, amount: number) {
  if (amount <= 0) return;
  const copy = new Uint8ClampedArray(pixels);
  const factor = Math.min(1, amount / 100);

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        // 3x3 median approximation
        const neighbors = [
          copy[((y - 1) * width + (x - 1)) * 4 + c],
          copy[((y - 1) * width + x) * 4 + c],
          copy[((y - 1) * width + (x + 1)) * 4 + c],
          copy[(y * width + (x - 1)) * 4 + c],
          copy[(y * width + x) * 4 + c],
          copy[(y * width + (x + 1)) * 4 + c],
          copy[((y + 1) * width + (x - 1)) * 4 + c],
          copy[((y + 1) * width + x) * 4 + c],
          copy[((y + 1) * width + (x + 1)) * 4 + c],
        ].sort((a, b) => a - b);
        const median = neighbors[4];
        pixels[idx + c] = Math.round(pixels[idx + c] * (1 - factor) + median * factor);
      }
    }
  }
}

function applySharpen(pixels: Uint8ClampedArray, width: number, height: number, amount: number) {
  if (amount <= 0) return;
  const copy = new Uint8ClampedArray(pixels);
  const strength = (amount / 100) * 1.5;

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = (y * width + x) * 4;
      for (let c = 0; c < 3; c++) {
        const top = copy[((y - 1) * width + x) * 4 + c];
        const bot = copy[((y + 1) * width + x) * 4 + c];
        const left = copy[(y * width + (x - 1)) * 4 + c];
        const right = copy[(y * width + (x + 1)) * 4 + c];
        const center = copy[idx + c];

        const laplacian = 5 * center - top - bot - left - right;
        const val = center * (1 - strength) + laplacian * strength;
        pixels[idx + c] = Math.max(0, Math.min(255, Math.round(val)));
      }
    }
  }
}

// 3. BỘ LỌC TÀI LIỆU NÂNG CAO
export function applyDocumentFilters(
  pixels: Uint8ClampedArray,
  width: number,
  height: number,
  filter: FilterType,
  brightness: number, // -50 đến 50
  contrast: number, // -50 đến 50
  sharpen: number = 0, // 0 đến 100
  denoise: number = 0 // 0 đến 100
) {
  const len = pixels.length;

  // 1. Áp dụng Denoise trước
  if (denoise > 0) {
    applyDenoise(pixels, width, height, denoise);
  }

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

    const s = Math.max(8, Math.round(width / 16));
    const t = 15;

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

        const isBlack = val * count < sum * ((100 - t) / 100);
        const out = isBlack ? 0 : 255;
        pixels[idx] = out;
        pixels[idx + 1] = out;
        pixels[idx + 2] = out;
      }
    }
  } else if (filter === 'enhanced') {
    for (let i = 0; i < len; i += 4) {
      let r = pixels[i];
      let g = pixels[i + 1];
      let b = pixels[i + 2];

      r = Math.min(255, Math.pow(r / 255, 0.85) * 255 + brightness + 10);
      g = Math.min(255, Math.pow(g / 255, 0.85) * 255 + brightness + 10);
      b = Math.min(255, Math.pow(b / 255, 0.85) * 255 + brightness + 10);

      r = factor * (r - 128) + 128;
      g = factor * (g - 128) + 128;
      b = factor * (b - 128) + 128;

      pixels[i] = r < 0 ? 0 : r > 255 ? 255 : r;
      pixels[i + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
      pixels[i + 2] = b < 0 ? 0 : b > 255 ? 255 : b;
    }
  } else if (filter === 'shadow_removal') {
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

  // 3. Áp dụng Sharpen sau khi lọc màu
  if (sharpen > 0) {
    applySharpen(pixels, width, height, sharpen);
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
      const { pixels, width, height, filter, brightness, contrast, sharpen, denoise } = payload;
      applyDocumentFilters(pixels, width, height, filter, brightness, contrast, sharpen || 0, denoise || 0);
      (self as any).postMessage({ id, type: 'APPLY_FILTERS_SUCCESS', pixels }, [pixels.buffer]);
    }
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : 'Lỗi xử lý ảnh trong worker';
    self.postMessage({ id, type: 'ERROR', error: errorMsg });
  }
};
