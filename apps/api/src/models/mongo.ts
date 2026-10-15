import mongoose, { Schema } from 'mongoose';
import { User, DocumentModel, PageModel, FileModel } from './types.ts';
import { config } from '../config/index.ts';

// User Schema
const userSchema = new Schema<User>({
  id: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String },
  passwordHash: { type: String, required: true },
  usedBytes: { type: Number, default: 0 },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true },
});

// Document Schema
const documentSchema = new Schema<DocumentModel>({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  pageOrder: { type: [String], default: [] },
  tags: { type: [String], default: [] },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true, index: true },
  deletedAt: { type: Number, default: null },
});

// Page Schema
const pageSchema = new Schema<PageModel>({
  id: { type: String, required: true, unique: true },
  documentId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  corners: { type: Schema.Types.Mixed, required: true },
  rotation: { type: Number, default: 0 },
  filter: { type: String, default: 'enhanced' },
  brightness: { type: Number, default: 0 },
  contrast: { type: Number, default: 0 },
  ocrText: { type: String, default: '' },
  originalFileId: { type: String },
  thumbnailFileId: { type: String },
  createdAt: { type: Number, required: true },
  updatedAt: { type: Number, required: true, index: true },
  deletedAt: { type: Number, default: null },
});

// File Schema
const fileSchema = new Schema<FileModel>({
  id: { type: String, required: true, unique: true },
  userId: { type: String, required: true, index: true },
  pageId: { type: String, required: true },
  type: { type: String, required: true },
  filename: { type: String, required: true },
  filePath: { type: String, required: true },
  mimeType: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  createdAt: { type: Number, required: true },
});

export const UserModel = mongoose.models.User || mongoose.model<User>('User', userSchema);
export const DocModel = mongoose.models.Document || mongoose.model<DocumentModel>('Document', documentSchema);
export const PageDocModel = mongoose.models.Page || mongoose.model<PageModel>('Page', pageSchema);
export const FileRecordModel = mongoose.models.File || mongoose.model<FileModel>('File', fileSchema);

let isConnected = false;

export async function connectMongo(): Promise<boolean> {
  if (isConnected) return true;
  if (!config.mongoUri) return false;

  try {
    mongoose.set('strictQuery', false);
    await mongoose.connect(config.mongoUri, {
      serverSelectionTimeoutMS: 5000,
    });
    isConnected = true;
    console.log('[MongoDB Atlas] Đã kết nối cơ sở dữ liệu đám mây thành công!');
    return true;
  } catch (err) {
    console.warn('[MongoDB Atlas] Không thể kết nối (sử dụng bộ nhớ cục bộ):', err);
    isConnected = false;
    return false;
  }
}

export function isMongoConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
