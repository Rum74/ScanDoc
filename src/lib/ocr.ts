import { createWorker } from 'tesseract.js';

export interface OcrProgress {
  status: string;
  progress: number; // 0 to 1
}

let ocrWorkerInstance: any = null;

export async function recognizeVietnameseText(
  imageBlob: Blob,
  onProgress?: (info: OcrProgress) => void
): Promise<string> {
  let worker = ocrWorkerInstance;

  try {
    if (!worker) {
      if (onProgress) onProgress({ status: 'Đang khởi động công cụ nhận diện OCR...', progress: 0.1 });
      worker = await createWorker(['vie', 'eng'], 1, {
        logger: (m) => {
          if (onProgress && m.status && typeof m.progress === 'number') {
            let label = 'Đang nhận diện chữ viết...';
            if (m.status.includes('loading')) label = 'Đang tải gói ngôn ngữ Tiếng Việt...';
            else if (m.status.includes('recognizing')) label = 'Đang phân tích văn bản...';
            onProgress({ status: label, progress: m.progress });
          }
        },
      });
      ocrWorkerInstance = worker;
    }

    if (onProgress) onProgress({ status: 'Đang trích xuất văn bản...', progress: 0.7 });

    const ret = await worker.recognize(imageBlob);
    const text = ret.data.text.trim();

    if (onProgress) onProgress({ status: 'Hoàn tất trích xuất!', progress: 1 });
    return text;
  } catch (err: unknown) {
    console.error('OCR error:', err);
    throw new Error('Không thể nhận diện văn bản. Vui lòng đảm bảo thiết bị có kết nối mạng tải gói tiếng Việt lần đầu hoặc thử lại với ảnh rõ nét hơn.');
  }
}
