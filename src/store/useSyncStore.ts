import { create } from 'zustand';
import { api } from '../lib/api.ts';
import {
  getPendingOutbox,
  removeOutboxItem,
  updateOutboxAttempt,
  saveLocalDocument,
  getLocalDocument,
  saveLocalPage,
  getLocalPage,
  LocalDocument,
  LocalPage,
} from '../lib/db.ts';

export type SyncStatus = 'synced' | 'syncing' | 'waiting' | 'error';

interface SyncState {
  status: SyncStatus;
  lastSyncAt: number | null;
  pendingCount: number;
  errorMessage: string | null;
  checkPendingCount: () => Promise<void>;
  triggerSync: (isAuthenticated: boolean) => Promise<void>;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  status: 'synced',
  lastSyncAt: null,
  pendingCount: 0,
  errorMessage: null,

  checkPendingCount: async () => {
    try {
      const items = await getPendingOutbox();
      set({ pendingCount: items.length });
    } catch {
      // ignore
    }
  },

  triggerSync: async (isAuthenticated: boolean) => {
    // If user is guest, sync is waiting for an account
    if (!isAuthenticated) {
      const items = await getPendingOutbox();
      set({ status: 'waiting', pendingCount: items.length });
      return;
    }

    if (!navigator.onLine) {
      set({ status: 'waiting' });
      return;
    }

    const { status } = get();
    if (status === 'syncing') return;

    try {
      set({ status: 'syncing', errorMessage: null });
      const pending = await getPendingOutbox();
      set({ pendingCount: pending.length });

      // 1. Flush Outbox Items to Server
      for (const item of pending) {
        try {
          if (item.action === 'create' || item.action === 'update') {
            if (item.entityType === 'document') {
              const doc = await getLocalDocument(item.entityId);
              if (doc) {
                await api.saveDocument(doc);
              }
            } else if (item.entityType === 'page') {
              const page = await getLocalPage(item.entityId);
              if (page) {
                await api.updatePage(page.id, {
                  documentId: page.documentId,
                  corners: page.corners,
                  rotation: page.rotation,
                  filter: page.filter,
                  brightness: page.brightness,
                  contrast: page.contrast,
                  ocrText: page.ocrText,
                  originalFileId: page.originalFileId,
                  thumbnailFileId: page.thumbnailFileId,
                  createdAt: page.updatedAt,
                  updatedAt: page.updatedAt,
                  deletedAt: page.deletedAt,
                });
              }
            }
          } else if (item.action === 'delete') {
            if (item.entityType === 'document') {
              await api.deleteDocument(item.entityId);
            }
          } else if (item.action === 'upload_files') {
            const page = await getLocalPage(item.entityId);
            if (page && page.originalBlob && page.thumbnailBlob) {
              const res = await api.uploadPageFiles(page.id, page.originalBlob, page.thumbnailBlob);
              page.originalFileId = res.originalFileId;
              page.thumbnailFileId = res.thumbnailFileId;
              await saveLocalPage(page);
            }
          }

          // Operation successful, remove from outbox
          await removeOutboxItem(item.id);
        } catch (itemErr: unknown) {
          const errStr = itemErr instanceof Error ? itemErr.message : 'Lỗi gửi đồng bộ';
          console.warn(`[Sync] Outbox item ${item.id} failed:`, itemErr);
          await updateOutboxAttempt(item.id, errStr);
          // If network error, stop sync loop
          if (!navigator.onLine) {
            set({ status: 'waiting' });
            return;
          }
        }
      }

      // 2. Pull remote changes from server
      const lastSync = get().lastSyncAt || undefined;
      const remote = await api.getDocuments(lastSync);

      // Merge remote documents
      if (remote.documents && Array.isArray(remote.documents)) {
        for (const rDoc of remote.documents) {
          const lDoc = await getLocalDocument(rDoc.id);
          // Newer updatedAt wins
          if (!lDoc || (rDoc.updatedAt && rDoc.updatedAt > lDoc.updatedAt)) {
            const merged: LocalDocument = {
              id: rDoc.id,
              name: rDoc.name,
              pageOrder: rDoc.pageOrder || [],
              tags: rDoc.tags || [],
              createdAt: rDoc.createdAt,
              updatedAt: rDoc.updatedAt,
              deletedAt: rDoc.deletedAt || null,
            };
            await saveLocalDocument(merged);
          }
        }
      }

      // Merge remote pages
      if (remote.pages && Array.isArray(remote.pages)) {
        for (const rPage of remote.pages) {
          const lPage = await getLocalPage(rPage.id);
          if (!lPage || (rPage.updatedAt && rPage.updatedAt > lPage.updatedAt)) {
            // If local page doesn't have blob, we can lazy download from server
            let origBlob = lPage?.originalBlob;
            let thumbBlob = lPage?.thumbnailBlob;

            if (!origBlob && rPage.originalFileId) {
              try {
                origBlob = await api.fetchFileBlob(rPage.originalFileId);
              } catch {
                // ignore lazy load error
              }
            }

            if (!thumbBlob && rPage.thumbnailFileId) {
              try {
                thumbBlob = await api.fetchFileBlob(rPage.thumbnailFileId);
              } catch {
                // ignore
              }
            }

            if (origBlob) {
              const mergedPage: LocalPage = {
                id: rPage.id,
                documentId: rPage.documentId,
                originalBlob: origBlob,
                corners: rPage.corners,
                rotation: rPage.rotation || 0,
                filter: rPage.filter || 'original',
                brightness: rPage.brightness || 0,
                contrast: rPage.contrast || 0,
                thumbnailBlob: thumbBlob,
                ocrText: rPage.ocrText,
                originalFileId: rPage.originalFileId,
                thumbnailFileId: rPage.thumbnailFileId,
                updatedAt: rPage.updatedAt,
                deletedAt: rPage.deletedAt || null,
              };
              await saveLocalPage(mergedPage);
            }
          }
        }
      }

      const remainingOutbox = await getPendingOutbox();
      set({
        status: remainingOutbox.length === 0 ? 'synced' : 'waiting',
        lastSyncAt: remote.serverTimestamp || Date.now(),
        pendingCount: remainingOutbox.length,
      });
    } catch (err: unknown) {
      console.error('[Sync Error]:', err);
      const msg = err instanceof Error ? err.message : 'Đồng bộ thất bại';
      set({ status: 'error', errorMessage: msg });
    }
  },
}));
