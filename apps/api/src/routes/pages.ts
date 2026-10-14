import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { store } from '../models/store.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';
import { PageModel, FileModel } from '../models/types.ts';
import { config } from '../config/index.ts';

export const pagesRouter = Router();

// Configure multer storage
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const userReq = req as AuthenticatedRequest;
    const userId = userReq.user?.id || 'anonymous';
    const userDir = path.join(config.uploadDir, userId);
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }
    cb(null, userDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: config.maxFileSize, // 15MB limit
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Chỉ chấp nhận file định dạng JPG, PNG hoặc WEBP'));
    }
  },
});

// PUT /api/pages/:id (Update page metadata)
pagesRouter.put('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const pageId = req.params.id;
  const userId = req.user!.id;
  const body = req.body;

  const existing = store.getPageById(pageId);
  if (existing && existing.userId !== userId) {
    res.status(403).json({ error: 'Không có quyền truy cập trang này' });
    return;
  }

  // Conflict resolution: if remote is newer
  if (existing && existing.updatedAt > (body.updatedAt || 0)) {
    res.json({ page: existing, conflict: 'remote_newer' });
    return;
  }

  const now = Date.now();
  const page: PageModel = {
    id: pageId,
    documentId: body.documentId || existing?.documentId || '',
    userId,
    corners: body.corners || existing?.corners || [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ],
    rotation: body.rotation ?? existing?.rotation ?? 0,
    filter: body.filter ?? existing?.filter ?? 'original',
    brightness: body.brightness ?? existing?.brightness ?? 0,
    contrast: body.contrast ?? existing?.contrast ?? 0,
    ocrText: body.ocrText ?? existing?.ocrText ?? '',
    originalFileId: body.originalFileId || existing?.originalFileId,
    thumbnailFileId: body.thumbnailFileId || existing?.thumbnailFileId,
    createdAt: existing?.createdAt || body.createdAt || now,
    updatedAt: body.updatedAt || now,
    deletedAt: body.deletedAt ?? existing?.deletedAt ?? null,
  };

  const saved = store.savePage(page);
  res.json({ page: saved });
});

// POST /api/pages/:id/files (Upload original & thumbnail blobs)
pagesRouter.post(
  '/:id/files',
  requireAuth,
  upload.fields([
    { name: 'original', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]),
  (req: AuthenticatedRequest, res: Response): void => {
    try {
      const pageId = req.params.id;
      const user = req.user!;
      const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

      if (!files || (!files.original && !files.thumbnail)) {
        res.status(400).json({ error: 'Không có file nào được tải lên' });
        return;
      }

      // Calculate total new upload bytes
      let uploadBytes = 0;
      if (files.original?.[0]) uploadBytes += files.original[0].size;
      if (files.thumbnail?.[0]) uploadBytes += files.thumbnail[0].size;

      // Check quota
      if (user.usedBytes + uploadBytes > config.maxUserBytes) {
        // Cleanup uploaded files
        if (files.original?.[0]) fs.unlinkSync(files.original[0].path);
        if (files.thumbnail?.[0]) fs.unlinkSync(files.thumbnail[0].path);
        
        res.status(413).json({
          error: `Vượt quá giới hạn lưu trữ cho phép (${Math.round(config.maxUserBytes / (1024 * 1024))}MB). Vui lòng dọn dẹp bớt tài liệu.`,
        });
        return;
      }

      const page = store.getPageById(pageId);
      const now = Date.now();

      let originalFileId: string | undefined;
      let thumbnailFileId: string | undefined;

      if (files.original?.[0]) {
        const orig = files.original[0];
        const fId = 'file_orig_' + Math.random().toString(36).substring(2, 9);
        const fModel: FileModel = {
          id: fId,
          userId: user.id,
          pageId,
          type: 'original',
          filename: orig.originalname,
          filePath: orig.path,
          mimeType: orig.mimetype,
          sizeBytes: orig.size,
          createdAt: now,
        };
        store.saveFile(fModel);
        originalFileId = fId;
      }

      if (files.thumbnail?.[0]) {
        const thumb = files.thumbnail[0];
        const fId = 'file_thumb_' + Math.random().toString(36).substring(2, 9);
        const fModel: FileModel = {
          id: fId,
          userId: user.id,
          pageId,
          type: 'thumbnail',
          filename: thumb.originalname,
          filePath: thumb.path,
          mimeType: thumb.mimetype,
          sizeBytes: thumb.size,
          createdAt: now,
        };
        store.saveFile(fModel);
        thumbnailFileId = fId;
      }

      // Update user used bytes
      store.updateUserUsedBytes(user.id, uploadBytes);

      // Update page references if page exists
      if (page) {
        if (originalFileId) page.originalFileId = originalFileId;
        if (thumbnailFileId) page.thumbnailFileId = thumbnailFileId;
        page.updatedAt = now;
        store.savePage(page);
      }

      res.json({
        message: 'Tải file thành công',
        originalFileId,
        thumbnailFileId,
        usedBytes: user.usedBytes + uploadBytes,
      });
    } catch (err: unknown) {
      console.error('Upload files error:', err);
      const msg = err instanceof Error ? err.message : 'Lỗi khi tải file lên';
      res.status(500).json({ error: msg });
    }
  }
);
