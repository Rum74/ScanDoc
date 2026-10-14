import { openDB, DBSchema, IDBPDatabase } from 'idb';

export type FilterType = 'original' | 'enhanced' | 'grayscale' | 'bw' | 'shadow_removal';

export interface Point {
  x: number;
  y: number;
}

export interface LocalDocument {
  id: string;
  name: string;
  pageOrder: string[]; // page IDs in display order
  tags: string[];
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface LocalPage {
  id: string;
  documentId: string;
  originalBlob: Blob; // Original uncropped photo
  corners: [Point, Point, Point, Point]; // TL, TR, BR, BL coordinates (0-1 normalized)
  rotation: number; // 0, 90, 180, 270
  filter: FilterType;
  brightness: number; // -50 to 50
  contrast: number; // -50 to 50
  processedBlob?: Blob; // Cache of warped & filtered image
  thumbnailBlob?: Blob; // Small thumbnail
  ocrText?: string;
  originalFileId?: string;
  thumbnailFileId?: string;
  updatedAt: number;
  deletedAt: number | null;
}

export interface OutboxItem {
  id: string;
  action: 'create' | 'update' | 'delete' | 'upload_files';
  entityType: 'document' | 'page';
  entityId: string;
  payload?: any;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

interface ScanDocDB extends DBSchema {
  documents: {
    key: string;
    value: LocalDocument;
    indexes: { 'by-updatedAt': number; 'by-deleted': number };
  };
  pages: {
    key: string;
    value: LocalPage;
    indexes: { 'by-documentId': string; 'by-updatedAt': number };
  };
  outbox: {
    key: string;
    value: OutboxItem;
    indexes: { 'by-createdAt': number };
  };
}

const DB_NAME = 'scandoc_offline_db';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<ScanDocDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<ScanDocDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ScanDocDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Documents store
        const docStore = db.createObjectStore('documents', { keyPath: 'id' });
        docStore.createIndex('by-updatedAt', 'updatedAt');
        docStore.createIndex('by-deleted', 'deletedAt');

        // Pages store
        const pageStore = db.createObjectStore('pages', { keyPath: 'id' });
        pageStore.createIndex('by-documentId', 'documentId');
        pageStore.createIndex('by-updatedAt', 'updatedAt');

        // Outbox queue store
        const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
        outboxStore.createIndex('by-createdAt', 'createdAt');
      },
    });
  }
  return dbPromise;
}

// === DOCUMENT REPOSITORY ===

export async function getAllLocalDocuments(): Promise<LocalDocument[]> {
  const db = await getDB();
  const all = await db.getAll('documents');
  return all.filter((d) => !d.deletedAt).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getLocalDocument(id: string): Promise<LocalDocument | undefined> {
  const db = await getDB();
  return db.get('documents', id);
}

export async function saveLocalDocument(doc: LocalDocument): Promise<void> {
  const db = await getDB();
  await db.put('documents', doc);
}

export async function softDeleteLocalDocument(id: string): Promise<void> {
  const db = await getDB();
  const doc = await db.get('documents', id);
  if (doc) {
    const now = Date.now();
    doc.deletedAt = now;
    doc.updatedAt = now;
    await db.put('documents', doc);

    // Soft delete corresponding pages
    const pages = await getLocalPagesByDocument(id);
    for (const page of pages) {
      page.deletedAt = now;
      page.updatedAt = now;
      await db.put('pages', page);
    }
  }
}

// === PAGE REPOSITORY ===

export async function getLocalPage(id: string): Promise<LocalPage | undefined> {
  const db = await getDB();
  return db.get('pages', id);
}

export async function getLocalPagesByDocument(documentId: string): Promise<LocalPage[]> {
  const db = await getDB();
  const tx = db.transaction('pages', 'readonly');
  const index = tx.store.index('by-documentId');
  const pages = await index.getAll(documentId);
  await tx.done;
  return pages.filter((p) => !p.deletedAt);
}

export async function saveLocalPage(page: LocalPage): Promise<void> {
  const db = await getDB();
  await db.put('pages', page);
}

export async function softDeleteLocalPage(pageId: string): Promise<void> {
  const db = await getDB();
  const page = await db.get('pages', pageId);
  if (page) {
    page.deletedAt = Date.now();
    page.updatedAt = Date.now();
    await db.put('pages', page);
  }
}

// === OUTBOX SYNC QUEUE ===

export async function addToOutbox(item: Omit<OutboxItem, 'id' | 'createdAt' | 'attempts'>): Promise<string> {
  const db = await getDB();
  const id = 'outbox_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
  const outboxItem: OutboxItem = {
    ...item,
    id,
    createdAt: Date.now(),
    attempts: 0,
  };
  await db.put('outbox', outboxItem);
  return id;
}

export async function getPendingOutbox(): Promise<OutboxItem[]> {
  const db = await getDB();
  return db.getAllFromIndex('outbox', 'by-createdAt');
}

export async function removeOutboxItem(id: string): Promise<void> {
  const db = await getDB();
  await db.delete('outbox', id);
}

export async function updateOutboxAttempt(id: string, error?: string): Promise<void> {
  const db = await getDB();
  const item = await db.get('outbox', id);
  if (item) {
    item.attempts += 1;
    item.lastError = error;
    await db.put('outbox', item);
  }
}
