import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export async function convertTextToWordDocx(
  documentTitle: string,
  pages: { pageNum: number; text: string }[]
): Promise<Blob> {
  const docSections = [];

  for (const p of pages) {
    const pageParagraphs: Paragraph[] = [];

    // Header for Page
    pageParagraphs.push(
      new Paragraph({
        text: `TRANG ${p.pageNum}`,
        heading: HeadingLevel.HEADING_2,
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 120 },
      })
    );

    // Split text into lines/paragraphs
    const lines = p.text.split('\n');
    for (const line of lines) {
      if (line.trim().length > 0) {
        pageParagraphs.push(
          new Paragraph({
            children: [
              new TextRun({
                text: line,
                font: 'Calibri',
                size: 24, // 12pt
              }),
            ],
            spacing: { after: 100 },
          })
        );
      }
    }

    docSections.push({
      properties: {},
      children: pageParagraphs,
    });
  }

  const doc = new Document({
    title: documentTitle,
    description: 'Tài liệu xuất bản từ ScanDoc',
    sections: docSections.length > 0 ? docSections : [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [new TextRun({ text: documentTitle, bold: true, size: 28 })],
          }),
        ],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  return blob;
}
