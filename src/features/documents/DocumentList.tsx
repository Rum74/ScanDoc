import React, { useState, useEffect } from 'react';
import {
  Search,
  Camera,
  FolderOpen,
  MoreVertical,
  Share2,
  Trash2,
  Edit2,
  User,
  Plus,
  Sparkles,
  Calendar,
  FileText,
} from 'lucide-react';
import { useDocStore } from '../../store/useDocStore.ts';
import { useScanStore } from '../../store/useScanStore.ts';
import { useAuthStore } from '../../store/useAuthStore.ts';
import { getLocalPagesByDocument, LocalPage } from '../../lib/db.ts';
import { PWAInstallButton } from '../../components/PWAInstallButton.tsx';
import { OfflineIndicator } from '../../components/OfflineIndicator.tsx';
import { AuthModal } from '../auth/AuthModal.tsx';
import { ExportModal } from '../export/ExportModal.tsx';

export const DocumentList: React.FC = () => {
  const {
    documents,
    loadDocuments,
    openDocument,
    deleteDocument,
    renameDocument,
    searchQuery,
    setSearchQuery,
    setView,
  } = useDocStore();

  const { initCapture } = useScanStore();
  const { isAuthenticated, user } = useAuthStore();

  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [docPageCounts, setDocPageCounts] = useState<Record<string, number>>({});
  const [docOcrMatches, setDocOcrMatches] = useState<Record<string, boolean>>({});
  const [menuOpenDocId, setMenuOpenDocId] = useState<string | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [exportDoc, setExportDoc] = useState<{ id: string; name: string; pages: LocalPage[] } | null>(null);

  // Load documents on mount
  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Load covers and OCR index
  useEffect(() => {
    let isCancelled = false;
    const newThumbnails: Record<string, string> = {};
    const counts: Record<string, number> = {};
    const ocrMatches: Record<string, boolean> = {};

    async function loadCovers() {
      for (const doc of documents) {
        try {
          const pages = await getLocalPagesByDocument(doc.id);
          counts[doc.id] = pages.length;

          // Check if any page matches search query via OCR text
          if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            const hasOcrMatch = pages.some(
              (p) => p.ocrText && p.ocrText.toLowerCase().includes(q)
            );
            if (hasOcrMatch) ocrMatches[doc.id] = true;
          }

          if (pages.length > 0) {
            const firstPage = pages[0];
            const blob = firstPage.thumbnailBlob || firstPage.processedBlob || firstPage.originalBlob;
            if (blob) {
              newThumbnails[doc.id] = URL.createObjectURL(blob);
            }
          }
        } catch {
          // ignore
        }
      }

      if (!isCancelled) {
        setThumbnails(newThumbnails);
        setDocPageCounts(counts);
        setDocOcrMatches(ocrMatches);
      }
    }

    loadCovers();

    return () => {
      isCancelled = true;
      Object.values(newThumbnails).forEach((url) => URL.revokeObjectURL(url));
    };
  }, [documents, searchQuery]);

  const handleStartScan = () => {
    initCapture();
    setView('capture');
  };

  const handleOpenExport = async (docId: string, docName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenDocId(null);
    const pages = await getLocalPagesByDocument(docId);
    setExportDoc({ id: docId, name: docName, pages });
  };

  const handleRename = (docId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenDocId(null);
    const newName = prompt('Nhập tên tài liệu mới:', currentName);
    if (newName && newName.trim()) {
      renameDocument(docId, newName.trim());
    }
  };

  const handleDelete = (docId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setMenuOpenDocId(null);
    if (confirm('Bạn có chắc muốn xóa tài liệu này không?')) {
      deleteDocument(docId);
    }
  };

  // Filter documents by title, tags, or OCR content
  const filteredDocuments = documents.filter((doc) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    const titleMatch = doc.name.toLowerCase().includes(q);
    const tagMatch = doc.tags.some((t) => t.toLowerCase().includes(q));
    const ocrMatch = docOcrMatches[doc.id];
    return titleMatch || tagMatch || ocrMatch;
  });

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Top Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-emerald-600 to-blue-600 flex items-center justify-center shadow-md">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="text-base font-extrabold text-white tracking-tight flex items-center gap-1.5">
              ScanDoc
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/30">
                PWA
              </span>
            </div>
            <div className="text-[11px] text-slate-400">Máy quét tài liệu di động</div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <PWAInstallButton />
          <OfflineIndicator />

          {/* User profile / auth button */}
          <button
            onClick={() => setIsAuthModalOpen(true)}
            className="p-2 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 active:scale-95 transition"
            title={isAuthenticated ? user?.email : 'Đăng nhập / Tài khoản'}
          >
            <User className={`w-4 h-4 ${isAuthenticated ? 'text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="p-3 bg-slate-900/60 border-b border-slate-800/80">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên tài liệu hoặc nội dung chữ OCR..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-emerald-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-white px-1"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Document List Viewport */}
      <div className="flex-1 overflow-y-auto p-4 pb-28">
        {filteredDocuments.length === 0 ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <div className="w-16 h-16 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
              <FolderOpen className="w-8 h-8 text-slate-600" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              {searchQuery ? 'Không tìm thấy tài liệu phù hợp' : 'Chưa có tài liệu nào'}
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mb-5">
              {searchQuery
                ? 'Thử tìm với từ khóa khác hoặc xóa bộ lọc tìm kiếm'
                : 'Bấm nút Scan bên dưới để quét tài liệu đầu tiên của bạn'}
            </p>
            {!searchQuery && (
              <button
                onClick={handleStartScan}
                className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition"
              >
                <Camera className="w-4 h-4" />
                Bắt đầu quét ngay
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
            {filteredDocuments.map((doc) => {
              const thumb = thumbnails[doc.id];
              const pageCount = docPageCounts[doc.id] ?? 0;
              const isMenuOpen = menuOpenDocId === doc.id;
              const hasOcr = docOcrMatches[doc.id];

              return (
                <div
                  key={doc.id}
                  onClick={() => openDocument(doc.id)}
                  className="relative group bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-3.5 flex gap-3.5 cursor-pointer shadow-lg hover:shadow-xl transition active:scale-[0.99]"
                >
                  {/* Thumbnail Cover */}
                  <div className="w-20 h-24 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center overflow-hidden shrink-0">
                    {thumb ? (
                      <img
                        src={thumb}
                        alt={doc.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileText className="w-8 h-8 text-slate-700" />
                    )}
                  </div>

                  {/* Document Information */}
                  <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h3 className="text-sm font-bold text-white truncate group-hover:text-emerald-400 transition">
                          {doc.name}
                        </h3>

                        {/* More Action Menu Button */}
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenDocId(isMenuOpen ? null : doc.id);
                            }}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Dropdown Menu */}
                          {isMenuOpen && (
                            <div className="absolute right-0 top-6 z-30 w-36 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl py-1 text-xs">
                              <button
                                onClick={(e) => handleOpenExport(doc.id, doc.name, e)}
                                className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Share2 className="w-3.5 h-3.5 text-blue-400" />
                                Xuất PDF
                              </button>
                              <button
                                onClick={(e) => handleRename(doc.id, doc.name, e)}
                                className="w-full px-3 py-2 text-left text-slate-200 hover:bg-slate-700 flex items-center gap-2"
                              >
                                <Edit2 className="w-3.5 h-3.5 text-emerald-400" />
                                Đổi tên
                              </button>
                              <button
                                onClick={(e) => handleDelete(doc.id, e)}
                                className="w-full px-3 py-2 text-left text-rose-400 hover:bg-rose-500/10 flex items-center gap-2"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Xóa
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-1">
                        <Calendar className="w-3 h-3 text-slate-500" />
                        <span>
                          {new Date(doc.updatedAt).toLocaleDateString('vi-VN', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mt-2">
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] font-semibold text-slate-300">
                        {pageCount} trang
                      </span>

                      {hasOcr && (
                        <span className="px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[9px] font-bold text-emerald-300 flex items-center gap-1">
                          <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                          Khớp OCR
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Floating Action Button (FAB) for Instant Scanning */}
      <div className="fixed bottom-6 right-6 z-30">
        <button
          onClick={handleStartScan}
          className="flex items-center gap-2 px-5 py-3.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-[0_10px_25px_rgba(16,185,129,0.45)] hover:shadow-[0_12px_30px_rgba(16,185,129,0.6)] active:scale-95 transition cursor-pointer"
        >
          <Camera className="w-5 h-5 text-white" />
          <span>Quét tài liệu</span>
        </button>
      </div>

      {/* Modals */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
      />

      {exportDoc && (
        <ExportModal
          isOpen={true}
          onClose={() => setExportDoc(null)}
          documentTitle={exportDoc.name}
          pages={exportDoc.pages}
        />
      )}
    </div>
  );
};
