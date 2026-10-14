export type FilterType = 'original' | 'enhanced' | 'grayscale' | 'bw' | 'shadow_removal';

export interface Point {
  x: number;
  y: number;
}

export interface User {
  id: string;
  email: string;
  name?: string;
  passwordHash: string;
  usedBytes: number;
  createdAt: number;
  updatedAt: number;
}

export interface DocumentModel {
  id: string;
  userId: string;
  name: string;
  pageOrder: string[]; // array of page ids
  tags: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface PageModel {
  id: string;
  documentId: string;
  userId: string;
  corners: [Point, Point, Point, Point]; // TL, TR, BR, BL
  rotation: number; // 0, 90, 180, 270
  filter: FilterType;
  brightness: number; // -50 to 50
  contrast: number; // -50 to 50
  ocrText?: string;
  originalFileId?: string;
  thumbnailFileId?: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface FileModel {
  id: string;
  userId: string;
  pageId: string;
  type: 'original' | 'thumbnail';
  filename: string;
  filePath: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
}
