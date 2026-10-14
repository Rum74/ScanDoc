import { Point, FilterType } from './db.ts';

// Worker initialization
let worker: Worker | null = null;
let msgCounter = 0;
const pendingCallbacks = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('../workers/scanner.worker.ts', import.meta.url), {
      type: 'module',
    });
    worker.onmessage = (e) => {
      const { id, type, error, ...rest } = e.data;
      const cb = pendingCallbacks.get(id);
      if (cb) {
        pendingCallbacks.delete(id);
        if (type === 'ERROR' || error) {
          cb.reject(new Error(error || 'Worker error'));
        } else {
          cb.resolve(rest);
        }
      }
    };
  }
  return worker;
}

function sendWorkerMessage<T>(type: string, payload: any, transferables?: Transferable[]): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = ++msgCounter;
    pendingCallbacks.set(id, { resolve, reject });
    const w = getWorker();
    w.postMessage({ id, type, payload }, transferables || []);
  });
}

// Chuyển Blob thành HTMLImageElement
export function blobToImage(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Không thể đọc dữ liệu ảnh'));
    };
    img.src = url;
  });
}

// 1. TỰ ĐỘNG PHÁT HIỆN 4 GÓC TÀI LIỆU
// Thu nhỏ trước (cạnh dài tối đa 800px) để giảm tải và tăng tốc độ xử lý
export async function detectCorners(blob: Blob): Promise<[Point, Point, Point, Point]> {
  const img = await blobToImage(blob);
  const origW = img.naturalWidth || img.width;
  const origH = img.naturalHeight || img.height;

  // Tính tỷ lệ thu nhỏ với cạnh lớn nhất ~800px
  const maxEdge = 800;
  let targetW = origW;
  let targetH = origH;
  if (Math.max(origW, origH) > maxEdge) {
    if (origW > origH) {
      targetW = maxEdge;
      targetH = Math.round((origH * maxEdge) / origW);
    } else {
      targetH = maxEdge;
      targetW = Math.round((origW * maxEdge) / origH);
    }
  }

  // Vẽ lên offscreen canvas nhỏ
  const canvas = document.createElement('canvas');
  canvas.width = targetW;
  canvas.height = targetH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Không thể khởi tạo Canvas 2D context');

  ctx.drawImage(img, 0, 0, targetW, targetH);
  const imageData = ctx.getImageData(0, 0, targetW, targetH);

  // Gửi tới Web Worker
  const res = await sendWorkerMessage<{ corners: [Point, Point, Point, Point] }>('DETECT_CORNERS', {
    imageData,
    origWidth: origW,
    origHeight: origH,
  });

  return res.corners;
}

// Helper: tính khoảng cách
function dist(p1: Point, p2: Point): number {
  return Math.hypot(p1.x - p2.x, p1.y - p2.y);
}

// 2. BIẾN ĐỔI PHỐI CẢNH (WARP) VÀ ÁP DỤNG BỘ LỌC
export async function processPageImage(
  originalBlob: Blob,
  corners: [Point, Point, Point, Point], // TL, TR, BR, BL (tọa độ 0 - 1)
  rotation: number = 0,
  filter: FilterType = 'enhanced',
  brightness: number = 0,
  contrast: number = 0
): Promise<{ processedBlob: Blob; thumbnailBlob: Blob }> {
  const img = await blobToImage(originalBlob);
  const W = img.naturalWidth || img.width;
  const H = img.naturalHeight || img.height;

  // Quy đổi tọa độ 0-1 sang pixel thực tế
  const pts: [Point, Point, Point, Point] = [
    { x: corners[0].x * W, y: corners[0].y * H },
    { x: corners[1].x * W, y: corners[1].y * H },
    { x: corners[2].x * W, y: corners[2].y * H },
    { x: corners[3].x * W, y: corners[3].y * H },
  ];

  // Tính chiều rộng và chiều cao sau khi căn phẳng (A4 ratio hoặc khoảng cách thực tế)
  const topW = dist(pts[0], pts[1]);
  const botW = dist(pts[3], pts[2]);
  const leftH = dist(pts[0], pts[3]);
  const rightH = dist(pts[1], pts[2]);

  let dstW = Math.round(Math.max(topW, botW));
  let dstH = Math.round(Math.max(leftH, rightH));

  // Giới hạn độ phân giải hợp lý (max 2400px để giữ nét chữ sắc sảo mà không tràn bộ nhớ điện thoại)
  const maxDim = 2400;
  if (Math.max(dstW, dstH) > maxDim) {
    const scale = maxDim / Math.max(dstW, dstH);
    dstW = Math.round(dstW * scale);
    dstH = Math.round(dstH * scale);
  }

  // Khởi tạo Canvas biến đổi phối cảnh
  const warpCanvas = document.createElement('canvas');
  warpCanvas.width = dstW;
  warpCanvas.height = dstH;
  const warpCtx = warpCanvas.getContext('2d', { willReadFrequently: true });
  if (!warpCtx) throw new Error('Không thể khởi tạo Canvas 2D');

  // Chia lưới tam giác (triangulation subdivision) để render phối cảnh tốc độ 60fps trên Canvas 2D
  renderPerspectiveWarp(warpCtx, img, pts, dstW, dstH);

  // Xoay ảnh nếu rotation !== 0
  let currentCanvas = warpCanvas;
  if (rotation % 360 !== 0) {
    currentCanvas = rotateCanvas(warpCanvas, rotation);
  }

  const finalCtx = currentCanvas.getContext('2d', { willReadFrequently: true });
  if (!finalCtx) throw new Error('Không thể lấy context');

  const finalWidth = currentCanvas.width;
  const finalHeight = currentCanvas.height;
  const imgData = finalCtx.getImageData(0, 0, finalWidth, finalHeight);

  // Áp dụng bộ lọc ảnh trong Web Worker
  const filterRes = await sendWorkerMessage<{ pixels: Uint8ClampedArray }>(
    'APPLY_FILTERS',
    {
      pixels: imgData.data,
      width: finalWidth,
      height: finalHeight,
      filter,
      brightness,
      contrast,
    },
    [imgData.data.buffer]
  );

  const filteredImgData = new ImageData(new Uint8ClampedArray(filterRes.pixels), finalWidth, finalHeight);
  finalCtx.putImageData(filteredImgData, 0, 0);

  // Xuất ảnh xử lý chất lượng cao (JPEG 0.90)
  const processedBlob = await new Promise<Blob>((resolve, reject) => {
    currentCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Lỗi xuất ảnh'))),
      'image/jpeg',
      0.9
    );
  });

  // Tạo thumbnail nhẹ cho danh sách (cạnh max 320px, JPEG 0.75)
  const thumbnailBlob = await createThumbnail(currentCanvas, 320);

  return { processedBlob, thumbnailBlob };
}

// Chia nhỏ thành 2 tam giác để warp bằng affine transform trên Canvas 2D
function renderPerspectiveWarp(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  src: [Point, Point, Point, Point],
  w: number,
  h: number
) {
  // Tam giác 1: TL (0), TR (1), BL (3) -> dst: (0,0), (w,0), (0,h)
  drawTriangle(ctx, img, src[0], src[1], src[3], { x: 0, y: 0 }, { x: w, y: 0 }, { x: 0, y: h });

  // Tam giác 2: TR (1), BR (2), BL (3) -> dst: (w,0), (w,h), (0,h)
  drawTriangle(ctx, img, src[1], src[2], src[3], { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h });
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  s0: Point, s1: Point, s2: Point,
  d0: Point, d1: Point, d2: Point
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(d0.x, d0.y);
  ctx.lineTo(d1.x, d1.y);
  ctx.lineTo(d2.x, d2.y);
  ctx.closePath();
  ctx.clip();

  // Tính ma trận Affine biến đổi từ src sang dst
  const delta = (s0.x - s2.x) * (s1.y - s2.y) - (s1.x - s2.x) * (s0.y - s2.y);
  if (Math.abs(delta) < 1e-7) {
    ctx.restore();
    return;
  }

  const deltaA = (d0.x - d2.x) * (s1.y - s2.y) - (d1.x - d2.x) * (s0.y - s2.y);
  const deltaB = (s0.x - s2.x) * (d1.x - d2.x) - (s1.x - s2.x) * (d0.x - d2.x);
  const deltaC = s0.x * (s1.y * d2.x - s2.y * d1.x) - s1.x * (s0.y * d2.x - s2.y * d0.x) + s2.x * (s0.y * d1.x - s1.y * d0.x);

  const deltaD = (d0.y - d2.y) * (s1.y - s2.y) - (d1.y - d2.y) * (s0.y - s2.y);
  const deltaE = (s0.x - s2.x) * (d1.y - d2.y) - (s1.x - s2.x) * (d0.y - d2.y);
  const deltaF = s0.x * (s1.y * d2.y - s2.y * d1.y) - s1.x * (s0.y * d2.y - s2.y * d0.y) + s2.x * (s0.y * d1.y - s1.y * d0.y);

  const a = deltaA / delta;
  const b = deltaD / delta;
  const c = deltaB / delta;
  const d = deltaE / delta;
  const e = deltaC / delta;
  const f = deltaF / delta;

  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function rotateCanvas(source: HTMLCanvasElement, degrees: number): HTMLCanvasElement {
  const normDeg = ((degrees % 360) + 360) % 360;
  if (normDeg === 0) return source;

  const rad = (normDeg * Math.PI) / 180;
  const is90or270 = normDeg === 90 || normDeg === 270;

  const dest = document.createElement('canvas');
  dest.width = is90or270 ? source.height : source.width;
  dest.height = is90or270 ? source.width : source.height;

  const ctx = dest.getContext('2d');
  if (!ctx) return source;

  ctx.translate(dest.width / 2, dest.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);

  return dest;
}

export function createThumbnail(canvasOrImage: HTMLCanvasElement | HTMLImageElement, maxEdge: number = 320): Promise<Blob> {
  const w = canvasOrImage.width;
  const h = canvasOrImage.height;
  let tw = w;
  let th = h;

  if (Math.max(w, h) > maxEdge) {
    if (w > h) {
      tw = maxEdge;
      th = Math.round((h * maxEdge) / w);
    } else {
      th = maxEdge;
      tw = Math.round((w * maxEdge) / h);
    }
  }

  const thumbCanvas = document.createElement('canvas');
  thumbCanvas.width = tw;
  thumbCanvas.height = th;
  const ctx = thumbCanvas.getContext('2d');
  if (ctx) {
    ctx.drawImage(canvasOrImage, 0, 0, tw, th);
  }

  return new Promise((resolve, reject) => {
    thumbCanvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Lỗi thumbnail'))),
      'image/jpeg',
      0.75
    );
  });
}
