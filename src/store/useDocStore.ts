import { create } from 'zustand';
import {
  LocalDocument,
  LocalPage,
  getAllLocalDocuments,
  getLocalDocument,
  saveLocalDocument,
  softDeleteLocalDocument,
  getLocalPagesByDocument,
  saveLocalPage,
  softDeleteLocalPage,
  addToOutbox,
} from '../lib/db.ts';

export type AppView = 'list' | 'detail' | 'capture' | 'corner_adjust' | 'filter_edit';

interface DocState {
  currentView: AppView;
  documents: LocalDocument[];
  activeDocument: LocalDocument | null;
  activePages: LocalPage[];
  activePageIndex: number;
  searchQuery: string;
  selectedTag: string | null;
  isLoading: boolean;

  setView: (view: AppView) => void;
  setSearchQuery: (q: string) => void;
  setSelectedTag: (tag: string | null) => void;
  setActivePageIndex: (idx: number) => void;

  loadDocuments: () => Promise<void>;
  openDocument: (id: string) => Promise<void>;
  createDocument: (customName?: string) => Promise<LocalDocument>;
  renameDocument: (id: string, newName: string) => Promise<void>;
  deleteDocument: (id: string) => Promise<void>;

  addPageToDocument: (documentId: string, page: LocalPage) => Promise<void>;
  updatePageData: (page: LocalPage) => Promise<void>;
  deletePageFromDocument: (documentId: string, pageId: string) => Promise<void>;
  reorderDocumentPages: (documentId: string, newOrder: string[]) => Promise<void>;
}

export const useDocStore = create<DocState>((set, get) => ({
  currentView: 'list',
  documents: [],
  activeDocument: null,
  activePages: [],
  activePageIndex: 0,
  searchQuery: '',
  selectedTag: null,
  isLoading: false,

  setView: (view: AppView) => set({ currentView: view }),
  setSearchQuery: (q: string) => set({ searchQuery: q }),
  setSelectedTag: (tag: string | null) => set({ selectedTag: tag }),
  setActivePageIndex: (idx: number) => set({ activePageIndex: idx }),

  loadDocuments: async () => {
    try {
      set({ isLoading: true });
      const docs = await getAllLocalDocuments();
      set({ documents: docs });
    } finally {
      set({ isLoading: false });
    }
  },

  openDocument: async (id: string) => {
    try {
      set({ isLoading: true });
      const doc = await getLocalDocument(id);
      if (doc) {
        const rawPages = await getLocalPagesByDocument(id);
        // Sort pages according to pageOrder
        const orderMap = new Map(doc.pageOrder.map((pid, idx) => [pid, idx]));
        const sortedPages = [...rawPages].sort((a, b) => {
          const idxA = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
          const idxB = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
          return idxA - idxB;
        });

        set({
          activeDocument: doc,
          activePages: sortedPages,
          activePageIndex: 0,
          currentView: 'detail',
        });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  createDocument: async (customName?: string) => {
    const now = Date.now();
    const d = new Date(now);
    const dateStr = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()} ${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`;
    const name = customName || `Tài liệu ${dateStr}`;
    const id = 'doc_' + now + '_' + Math.random().toString(36).substring(2, 7);

    const newDoc: LocalDocument = {
      id,
      name,
      pageOrder: [],
      tags: [],
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    };

    await saveLocalDocument(newDoc);
    await addToOutbox({
      action: 'create',
      entityType: 'document',
      entityId: id,
    });

    const docs = await getAllLocalDocuments();
    set({
      documents: docs,
      activeDocument: newDoc,
      activePages: [],
      activePageIndex: 0,
    });

    return newDoc;
  },

  renameDocument: async (id: string, newName: string) => {
    const doc = await getLocalDocument(id);
    if (doc) {
      doc.name = newName.trim() || 'Tài liệu không tên';
      doc.updatedAt = Date.now();
      await saveLocalDocument(doc);
      await addToOutbox({
        action: 'update',
        entityType: 'document',
        entityId: id,
      });

      const docs = await getAllLocalDocuments();
      set((state) => ({
        documents: docs,
        activeDocument: state.activeDocument?.id === id ? doc : state.activeDocument,
      }));
    }
  },

  deleteDocument: async (id: string) => {
    await softDeleteLocalDocument(id);
    await addToOutbox({
      action: 'delete',
      entityType: 'document',
      entityId: id,
    });

    const docs = await getAllLocalDocuments();
    set((state) => ({
      documents: docs,
      activeDocument: state.activeDocument?.id === id ? null : state.activeDocument,
      currentView: state.activeDocument?.id === id ? 'list' : state.currentView,
    }));
  },

  addPageToDocument: async (documentId: string, page: LocalPage) => {
    await saveLocalPage(page);

    // Queue outbox for page update & file upload
    await addToOutbox({
      action: 'update',
      entityType: 'page',
      entityId: page.id,
    });
    await addToOutbox({
      action: 'upload_files',
      entityType: 'page',
      entityId: page.id,
    });

    // Update document pageOrder
    const doc = await getLocalDocument(documentId);
    if (doc) {
      if (!doc.pageOrder.includes(page.id)) {
        doc.pageOrder.push(page.id);
      }
      doc.updatedAt = Date.now();
      await saveLocalDocument(doc);
      await addToOutbox({
        action: 'update',
        entityType: 'document',
        entityId: doc.id,
      });
    }

    // Refresh active document state
    const docs = await getAllLocalDocuments();
    const updatedPages = await getLocalPagesByDocument(documentId);
    set({
      documents: docs,
      activeDocument: doc || null,
      activePages: updatedPages,
      activePageIndex: updatedPages.length - 1,
    });
  },

  updatePageData: async (page: LocalPage) => {
    page.updatedAt = Date.now();
    await saveLocalPage(page);
    await addToOutbox({
      action: 'update',
      entityType: 'page',
      entityId: page.id,
    });

    const { activeDocument } = get();
    if (activeDocument) {
      const updatedPages = await getLocalPagesByDocument(activeDocument.id);
      set({ activePages: updatedPages });
    }
  },

  deletePageFromDocument: async (documentId: string, pageId: string) => {
    await softDeleteLocalPage(pageId);
    await addToOutbox({
      action: 'update',
      entityType: 'page',
      entityId: pageId,
    });

    const doc = await getLocalDocument(documentId);
    if (doc) {
      doc.pageOrder = doc.pageOrder.filter((id) => id !== pageId);
      doc.updatedAt = Date.now();
      await saveLocalDocument(doc);
      await addToOutbox({
        action: 'update',
        entityType: 'document',
        entityId: doc.id,
      });
    }

    const docs = await getAllLocalDocuments();
    const updatedPages = await getLocalPagesByDocument(documentId);
    set({
      documents: docs,
      activeDocument: doc || null,
      activePages: updatedPages,
      activePageIndex: Math.max(0, updatedPages.length - 1),
    });
  },

  reorderDocumentPages: async (documentId: string, newOrder: string[]) => {
    const doc = await getLocalDocument(documentId);
    if (doc) {
      doc.pageOrder = newOrder;
      doc.updatedAt = Date.now();
      await saveLocalDocument(doc);
      await addToOutbox({
        action: 'update',
        entityType: 'document',
        entityId: doc.id,
      });

      const pages = await getLocalPagesByDocument(documentId);
      const orderMap = new Map(newOrder.map((pid, idx) => [pid, idx]));
      const sorted = [...pages].sort((a, b) => {
        const ia = orderMap.has(a.id) ? orderMap.get(a.id)! : 9999;
        const ib = orderMap.has(b.id) ? orderMap.get(b.id)! : 9999;
        return ia - ib;
      });

      set({ activeDocument: doc, activePages: sorted });
    }
  },
}));
