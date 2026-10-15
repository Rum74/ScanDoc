import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { blobToImage } from './image-processing.ts';

// 1. GỘP NHIỀU FILE PDF THÀNH 1 FILE
export async function mergePdfFiles(pdfBlobs: Blob[]): Promise<Blob> {
  const mergedPdf = await PDFDocument.create();

  for (const blob of pdfBlobs) {
    const arrayBuffer = await blob.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer);
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  const mergedBytes = await mergedPdf.save();
  return new Blob([mergedBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

// 2. TÁCH TRANG PDF
export async function splitPdfFile(pdfBlob: Blob, pageIndices: number[]): Promise<Blob> {
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const srcPdf = await PDFDocument.load(arrayBuffer);
  const newPdf = await PDFDocument.create();

  const validIndices = pageIndices.filter((idx) => idx >= 0 && idx < srcPdf.getPageCount());
  const copiedPages = await newPdf.copyPages(srcPdf, validIndices);
  copiedPages.forEach((page) => newPdf.addPage(page));

  const splitBytes = await newPdf.save();
  return new Blob([splitBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

// 3. THÊM WATERMARK (CHỮ CHÌM BẢN QUYỀN) VÀO PDF
export async function addWatermarkToPdf(
  pdfBlob: Blob,
  watermarkText: string = 'BẢN SAO',
  opacity: number = 0.25,
  fontSize: number = 48
): Promise<Blob> {
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(watermarkText, fontSize);
    const textHeight = font.heightAtSize(fontSize);

    // Center diagonal watermark
    page.drawText(watermarkText, {
      x: width / 2 - textWidth / 2,
      y: height / 2 - textHeight / 2,
      size: fontSize,
      font,
      color: rgb(0.8, 0.2, 0.2),
      opacity,
      rotate: degrees(45),
    });
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

// 4. XOAY CÁC TRANG PDF
export async function rotatePdfFile(pdfBlob: Blob, rotateDeg: number = 90): Promise<Blob> {
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const pdfDoc = await PDFDocument.load(arrayBuffer);
  const pages = pdfDoc.getPages();

  for (const page of pages) {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + rotateDeg) % 360));
  }

  const bytes = await pdfDoc.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}

// 5. GHÉP 2 MẶT CCCD / HỘ CHIẾU LÊN 1 TRANG A4
export async function combineIdCardSides(frontBlob: Blob, backBlob: Blob): Promise<Blob> {
  const pdfDoc = await PDFDocument.create();

  // Standard A4: 595.28 x 841.89 points
  const page = pdfDoc.addPage([595.28, 841.89]);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const frontImg = await blobToImage(frontBlob);
  const backImg = await blobToImage(backBlob);

  // Convert to high-quality JPEGs
  const frontCanvas = document.createElement('canvas');
  frontCanvas.width = frontImg.width;
  frontCanvas.height = frontImg.height;
  frontCanvas.getContext('2d')?.drawImage(frontImg, 0, 0);
  const frontJpeg = await new Promise<Blob>((res) => frontCanvas.toBlob((b) => res(b!), 'image/jpeg', 0.9));

  const backCanvas = document.createElement('canvas');
  backCanvas.width = backImg.width;
  backCanvas.height = backImg.height;
  backCanvas.getContext('2d')?.drawImage(backImg, 0, 0);
  const backJpeg = await new Promise<Blob>((res) => backCanvas.toBlob((b) => res(b!), 'image/jpeg', 0.9));

  const frontEmbedded = await pdfDoc.embedJpg(await frontJpeg.arrayBuffer());
  const backEmbedded = await pdfDoc.embedJpg(await backJpeg.arrayBuffer());

  // Fixed ID card standard display dimension on A4: ~340x215 pt (ratio 85.6 x 53.98 mm)
  const cardW = 340;
  const cardH = 215;
  const centerX = (595.28 - cardW) / 2;

  // Header Title
  page.drawText('CAN CUOC CONG DAN / HO CHIEU', {
    x: 595.28 / 2 - 110,
    y: 841.89 - 50,
    size: 14,
    font,
    color: rgb(0.2, 0.2, 0.2),
  });

  // Top: Mặt trước (Front)
  page.drawText('MAT TRUOC', {
    x: centerX,
    y: 841.89 - 78,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawImage(frontEmbedded, {
    x: centerX,
    y: 841.89 - 90 - cardH,
    width: cardW,
    height: cardH,
  });

  // Bottom: Mặt sau (Back)
  page.drawText('MAT SAU', {
    x: centerX,
    y: 841.89 - 120 - cardH * 2 + cardH - 12,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3),
  });
  page.drawImage(backEmbedded, {
    x: centerX,
    y: 841.89 - 120 - cardH * 2 - 25,
    width: cardW,
    height: cardH,
  });

  const bytes = await pdfDoc.save();
  return new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
}
