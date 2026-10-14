import { PDFDocument } from 'pdf-lib';
import { blobToImage } from './image-processing.ts';

export type PdfQuality = 'small' | 'medium' | 'high';

export async function generatePdf(
  pages: { blob: Blob; name?: string }[],
  quality: PdfQuality = 'medium',
  onProgress?: (current: number, total: number) => void
): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  // Preset max dimensions and JPEG qualities
  const presets = {
    small: { maxEdge: 900, jpegQuality: 0.65 },
    medium: { maxEdge: 1600, jpegQuality: 0.82 },
    high: { maxEdge: 2600, jpegQuality: 0.94 },
  };

  const { maxEdge, jpegQuality } = presets[quality];

  for (let i = 0; i < pages.length; i++) {
    const pageItem = pages[i];
    if (onProgress) onProgress(i + 1, pages.length);

    const img = await blobToImage(pageItem.blob);
    const origW = img.naturalWidth || img.width;
    const origH = img.naturalHeight || img.height;

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

    // Convert to compressed jpeg bytes via Canvas
    const canvas = document.createElement('canvas');
    canvas.width = targetW;
    canvas.height = targetH;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D failed');
    ctx.drawImage(img, 0, 0, targetW, targetH);

    const jpegBlob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Export failed'))),
        'image/jpeg',
        jpegQuality
      );
    });

    const arrayBuffer = await jpegBlob.arrayBuffer();
    const embeddedImage = await pdfDoc.embedJpg(arrayBuffer);

    // Standard A4 dimensions in points: 595.28 x 841.89
    // Adjust orientation based on image aspect ratio
    const isLandscape = targetW > targetH;
    const a4W = isLandscape ? 841.89 : 595.28;
    const a4H = isLandscape ? 595.28 : 841.89;

    const page = pdfDoc.addPage([a4W, a4H]);

    // Fit image inside A4 margins (10 points margin)
    const margin = 10;
    const availW = a4W - margin * 2;
    const availH = a4H - margin * 2;

    const scale = Math.min(availW / embeddedImage.width, availH / embeddedImage.height);
    const drawW = embeddedImage.width * scale;
    const drawH = embeddedImage.height * scale;

    // Center image on page
    const posX = margin + (availW - drawW) / 2;
    const posY = margin + (availH - drawH) / 2;

    page.drawImage(embeddedImage, {
      x: posX,
      y: posY,
      width: drawW,
      height: drawH,
    });
  }

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

// Helper to trigger browser download
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Web Share API helper
export async function shareFile(fileBlob: Blob, filename: string, title: string = 'ScanDoc Document') {
  const file = new File([fileBlob], filename, { type: fileBlob.type });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title,
        text: 'Tài liệu scan từ ScanDoc',
      });
      return true;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') {
        return false; // User cancelled share dialog
      }
    }
  }

  // Fallback to direct download
  downloadBlob(fileBlob, filename);
  return false;
}
