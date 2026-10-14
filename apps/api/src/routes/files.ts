import { Router, Response } from 'express';
import fs from 'fs';
import { store } from '../models/store.ts';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.ts';

export const filesRouter = Router();

// GET /api/files/:id (Stream file to owner)
filesRouter.get('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const fileId = req.params.id;
  const user = req.user!;

  const file = store.getFileById(fileId);
  if (!file) {
    res.status(404).json({ error: 'Không tìm thấy tệp' });
    return;
  }

  // Enforce ownership
  if (file.userId !== user.id) {
    res.status(403).json({ error: 'Bạn không có quyền truy cập tệp này' });
    return;
  }

  if (!fs.existsSync(file.filePath)) {
    res.status(404).json({ error: 'Tệp không tồn tại trên hệ thống lưu trữ' });
    return;
  }

  res.setHeader('Content-Type', file.mimeType);
  res.setHeader('Content-Length', file.sizeBytes);
  res.setHeader('Cache-Control', 'private, max-age=86400'); // Cache 1 day for owner

  const stream = fs.createReadStream(file.filePath);
  stream.pipe(res);
});
