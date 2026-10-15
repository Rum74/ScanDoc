import fs from 'fs';
import path from 'path';
import { User, DocumentModel, PageModel, FileModel } from './types.ts';
import { config } from '../config/index.ts';
import { connectMongo, isMongoConnected, UserModel, DocModel, PageDocModel, FileRecordModel } from './mongo.ts';

interface DatabaseSchema {
  users: Record<string, User>;
  documents: Record<string, DocumentModel>;
  pages: Record<string, PageModel>;
  files: Record<string, FileModel>;
}

class Store {
  private data: DatabaseSchema = {
    users: {},
    documents: {},
    pages: {},
    files: {},
  };
  private dbFilePath: string;

  constructor() {
    this.dbFilePath = path.resolve(process.cwd(), 'data/db.json');
    this.ensureDirs();
    this.load();
    this.initMongo();
  }

  private async initMongo() {
    if (config.mongoUri) {
      const ok = await connectMongo();
      if (ok) {
        await this.syncFromMongo();
      }
    }
  }

  private async syncFromMongo() {
    try {
      const [users, docs, pages, files] = await Promise.all([
        UserModel.find().lean(),
        DocModel.find().lean(),
        PageDocModel.find().lean(),
        FileRecordModel.find().lean(),
      ]);

      for (const u of users) {
        this.data.users[(u as any).id] = u as any;
      }
      for (const d of docs) {
        this.data.documents[(d as any).id] = d as any;
      }
      for (const p of pages) {
        this.data.pages[(p as any).id] = p as any;
      }
      for (const f of files) {
        this.data.files[(f as any).id] = f as any;
      }
      this.persist();
      console.log(`[Store] Đã nạp ${docs.length} tài liệu từ MongoDB Atlas vào bộ nhớ`);
    } catch (err) {
      console.warn('[Store] Lỗi đồng bộ dữ liệu ban đầu từ MongoDB:', err);
    }
  }

  private ensureDirs() {
    const dataDir = path.dirname(this.dbFilePath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (!fs.existsSync(config.uploadDir)) {
      fs.mkdirSync(config.uploadDir, { recursive: true });
    }
  }

  private load() {
    try {
      if (fs.existsSync(this.dbFilePath)) {
        const raw = fs.readFileSync(this.dbFilePath, 'utf-8');
        this.data = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[Store] Could not load db.json, using fresh store:', e);
    }
  }

  private persist() {
    try {
      this.ensureDirs();
      fs.writeFileSync(this.dbFilePath, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (e) {
      console.error('[Store] Failed to persist data:', e);
    }
  }

  // --- Users ---
  getUserById(id: string): User | undefined {
    return this.data.users[id];
  }

  getUserByEmail(email: string): User | undefined {
    const target = email.toLowerCase().trim();
    return Object.values(this.data.users).find((u) => u.email.toLowerCase() === target);
  }

  saveUser(user: User): User {
    this.data.users[user.id] = user;
    this.persist();

    // Async sync to MongoDB Atlas
    if (isMongoConnected()) {
      UserModel.findOneAndUpdate({ id: user.id }, user, { upsert: true }).catch((err) =>
        console.warn('[Store] Mongo saveUser error:', err)
      );
    }

    return user;
  }

  updateUserUsedBytes(userId: string, deltaBytes: number): number {
    const user = this.data.users[userId];
    if (user) {
      user.usedBytes = Math.max(0, (user.usedBytes || 0) + deltaBytes);
      user.updatedAt = Date.now();
      this.persist();

      if (isMongoConnected()) {
        UserModel.updateOne({ id: userId }, { $set: { usedBytes: user.usedBytes, updatedAt: user.updatedAt } }).catch(
          (err) => console.warn('[Store] Mongo update bytes error:', err)
        );
      }

      return user.usedBytes;
    }
    return 0;
  }

  // --- Documents ---
  getDocumentById(id: string): DocumentModel | undefined {
    return this.data.documents[id];
  }

  getUserDocuments(userId: string, updatedSince?: number): DocumentModel[] {
    return Object.values(this.data.documents).filter((doc) => {
      if (doc.userId !== userId) return false;
      if (updatedSince && doc.updatedAt <= updatedSince) return false;
      return true;
    });
  }

  saveDocument(doc: DocumentModel): DocumentModel {
    this.data.documents[doc.id] = doc;
    this.persist();

    if (isMongoConnected()) {
      DocModel.findOneAndUpdate({ id: doc.id }, doc, { upsert: true }).catch((err) =>
        console.warn('[Store] Mongo saveDocument error:', err)
      );
    }

    return doc;
  }

  // --- Pages ---
  getPageById(id: string): PageModel | undefined {
    return this.data.pages[id];
  }

  getPagesByDocumentId(documentId: string): PageModel[] {
    return Object.values(this.data.pages).filter(
      (p) => p.documentId === documentId && !p.deletedAt
    );
  }

  getUserPages(userId: string, updatedSince?: number): PageModel[] {
    return Object.values(this.data.pages).filter((p) => {
      if (p.userId !== userId) return false;
      if (updatedSince && p.updatedAt <= updatedSince) return false;
      return true;
    });
  }

  savePage(page: PageModel): PageModel {
    this.data.pages[page.id] = page;
    this.persist();

    if (isMongoConnected()) {
      PageDocModel.findOneAndUpdate({ id: page.id }, page, { upsert: true }).catch((err) =>
        console.warn('[Store] Mongo savePage error:', err)
      );
    }

    return page;
  }

  // --- Files ---
  getFileById(id: string): FileModel | undefined {
    return this.data.files[id];
  }

  saveFile(file: FileModel): FileModel {
    this.data.files[file.id] = file;
    this.persist();

    if (isMongoConnected()) {
      FileRecordModel.findOneAndUpdate({ id: file.id }, file, { upsert: true }).catch((err) =>
        console.warn('[Store] Mongo saveFile error:', err)
      );
    }

    return file;
  }

  deleteFile(id: string): boolean {
    const f = this.data.files[id];
    if (f) {
      try {
        if (fs.existsSync(f.filePath)) {
          fs.unlinkSync(f.filePath);
        }
      } catch (err) {
        console.warn(`[Store] Could not delete physical file ${f.filePath}:`, err);
      }
      this.updateUserUsedBytes(f.userId, -f.sizeBytes);
      delete this.data.files[id];
      this.persist();

      if (isMongoConnected()) {
        FileRecordModel.deleteOne({ id }).catch((err) =>
          console.warn('[Store] Mongo deleteFile error:', err)
        );
      }

      return true;
    }
    return false;
  }
}

export const store = new Store();
