import { Router, Response } from 'express';
import { z } from 'zod';
import { store } from '../models/store.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { DocumentModel } from '../models/types.ts';

export const documentsRouter = Router();

// GET /api/documents?updatedSince=... (Incremental sync endpoint)
documentsRouter.get('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const userId = req.user!.id;
  const updatedSince = req.query.updatedSince ? parseInt(req.query.updatedSince as string, 10) : undefined;

  const documents = store.getUserDocuments(userId, updatedSince);
  const pages = store.getUserPages(userId, updatedSince);

  res.json({
    documents,
    pages,
    serverTimestamp: Date.now(),
  });
});

// Document schema
const documentSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, 'Tên tài liệu không được để trống'),
  pageOrder: z.array(z.string()).default([]),
  tags: z.array(z.string()).default([]),
  createdAt: z.number().optional(),
  updatedAt: z.number().optional(),
  deletedAt: z.number().nullable().optional(),
});

// POST /api/documents (Create or upsert)
documentsRouter.post('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const parseResult = documentSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ error: parseResult.error.issues[0]?.message || 'Dữ liệu tài liệu không hợp lệ' });
    return;
  }

  const userId = req.user!.id;
  const data = parseResult.data;
  const now = Date.now();

  const existing = store.getDocumentById(data.id);
  if (existing && existing.userId !== userId) {
    res.status(403).json({ error: 'Không có quyền truy cập tài liệu này' });
    return;
  }

  // Conflict resolution: if existing has newer updatedAt, keep newer
  if (existing && existing.updatedAt > (data.updatedAt || 0)) {
    res.json({ document: existing, conflict: 'remote_newer' });
    return;
  }

  const doc: DocumentModel = {
    id: data.id,
    userId,
    name: data.name,
    pageOrder: data.pageOrder,
    tags: data.tags,
    createdAt: data.createdAt || (existing ? existing.createdAt : now),
    updatedAt: data.updatedAt || now,
    deletedAt: data.deletedAt ?? null,
  };

  const saved = store.saveDocument(doc);
  res.json({ document: saved });
});

// PUT /api/documents/:id (Update)
documentsRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const id = req.params.id;
  const userId = req.user!.id;

  const existing = store.getDocumentById(id);
  if (existing && existing.userId !== userId) {
    res.status(403).json({ error: 'Không có quyền truy cập tài liệu này' });
    return;
  }

  const now = Date.now();
  const updatePayload = req.body;

  const doc: DocumentModel = {
    id,
    userId,
    name: updatePayload.name ?? (existing?.name || 'Tài liệu không tên'),
    pageOrder: Array.isArray(updatePayload.pageOrder) ? updatePayload.pageOrder : (existing?.pageOrder || []),
    tags: Array.isArray(updatePayload.tags) ? updatePayload.tags : (existing?.tags || []),
    createdAt: existing?.createdAt || now,
    updatedAt: updatePayload.updatedAt || now,
    deletedAt: updatePayload.deletedAt ?? existing?.deletedAt ?? null,
  };

  const saved = store.saveDocument(doc);
  res.json({ document: saved });
});

// DELETE /api/documents/:id (Soft delete)
documentsRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const id = req.params.id;
  const userId = req.user!.id;

  const existing = store.getDocumentById(id);
  if (!existing || existing.userId !== userId) {
    res.status(404).json({ error: 'Không tìm thấy tài liệu' });
    return;
  }

  const now = Date.now();
  existing.deletedAt = now;
  existing.updatedAt = now;
  store.saveDocument(existing);

  // Soft delete all pages of this document too
  const pages = store.getPagesByDocumentId(id);
  for (const page of pages) {
    page.deletedAt = now;
    page.updatedAt = now;
    store.savePage(page);
  }

  res.json({ message: 'Tài liệu đã được xóa', deletedAt: now });
});
