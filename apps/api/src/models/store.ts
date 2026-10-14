import fs from 'fs';
import path from 'path';
import { User, DocumentModel, PageModel, FileModel } from './types.ts';
import { config } from '../config/index.ts';

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
    return user;
  }

  updateUserUsedBytes(userId: string, deltaBytes: number): number {
    const user = this.data.users[userId];
    if (user) {
      user.usedBytes = Math.max(0, (user.usedBytes || 0) + deltaBytes);
      user.updatedAt = Date.now();
      this.persist();
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
    return page;
  }

  // --- Files ---
  getFileById(id: string): FileModel | undefined {
    return this.data.files[id];
  }

  saveFile(file: FileModel): FileModel {
    this.data.files[file.id] = file;
    this.persist();
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
      return true;
    }
    return false;
  }
}

export const store = new Store();
