import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Share2,
  Trash2,
  Edit2,
  Plus,
  Sparkles,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  X,
} from 'lucide-react';
import { useDocStore } from '../../store/useDocStore.ts';
import { useScanStore } from '../../store/useScanStore.ts';
import { ExportModal } from '../export/ExportModal.tsx';
import { OcrModal } from '../ocr/OcrModal.tsx';
import { LocalPage } from '../../lib/db.ts';

export const DocumentDetail: React.FC = () => {
  const {
    activeDocument,
    activePages,
    renameDocument,
    deleteDocument,
    deletePageFromDocument,
    reorderDocumentPages,
    setView,
  } = useDocStore();

  const { initCapture, setCapturedBlob, setCorners, setFilter, setBrightness, setContrast, setEditingPageId, generateProcessedPreview } = useScanStore();

  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [ocrPage, setOcrPage] = useState<{ page: LocalPage; index: number } | null>(null);
  const [previewPage, setPreviewPage] = useState<LocalPage | null>(null);
  const [pageUrls, setPageUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activeDocument) {
      setTitleInput(activeDocument.name);
    }
  }, [activeDocument]);

  // Generate thumbnail blob URLs
  useEffect(() => {
    const urls: Record<string, string> = {};
    for (const p of activePages) {
      const blob = p.thumbnailBlob || p.processedBlob || p.originalBlob;
      if (blob) {
        urls[p.id] = URL.createObjectURL(blob);
      }
    }
    setPageUrls(urls);

    return () => {
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    };
  }, [activePages]);

  if (!activeDocument) {
    return null;
  }

  const handleSaveTitle = async () => {
    if (titleInput.trim()) {
      await renameDocument(activeDocument.id, titleInput.trim());
    }
    setIsEditingTitle(false);
  };

  const handleDeleteDoc = async () => {
    if (window.confirm('Bạn có chắc muốn xóa tài liệu này không?')) {
      await deleteDocument(activeDocument.id);
    }
  };

  const handleDeletePage = async (pageId: string) => {
    if (window.confirm('Xóa trang này khỏi tài liệu?')) {
      await deletePageFromDocument(activeDocument.id, pageId);
    }
  };

  const handleMovePage = async (currentIndex: number, direction: 'left' | 'right') => {
    const newIdx = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
    if (newIdx < 0 || newIdx >= activePages.length) return;

    const newOrder = activePages.map((p) => p.id);
    const temp = newOrder[currentIndex];
    newOrder[currentIndex] = newOrder[newIdx];
    newOrder[newIdx] = temp;

    await reorderDocumentPages(activeDocument.id, newOrder);
  };

  const handleAddNewPage = () => {
    initCapture(activeDocument.id);
    setView('capture');
  };

  const handleReEditPage = async (page: LocalPage) => {
    initCapture(activeDocument.id);
    setEditingPageId(page.id);
    setCorners(page.corners);
    setFilter(page.filter);
    setBrightness(page.brightness);
    setContrast(page.contrast);
    await setCapturedBlob(page.originalBlob);
    await generateProcessedPreview();
    setView('filter_edit');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950 overflow-hidden">
      {/* Detail Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <button
          onClick={() => setView('list')}
          className="p-2 rounded-xl bg-slate-800 text-slate-300 hover:text-white active:scale-95 transition"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="flex-1 mx-3 truncate">
          {isEditingTitle ? (
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={titleInput}
                onChange={(e) => setTitleInput(e.target.value)}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleSaveTitle()}
                className="w-full px-2.5 py-1 text-sm bg-slate-800 border border-emerald-500 rounded-lg text-white focus:outline-none"
              />
              <button
                onClick={handleSaveTitle}
                className="p-1.5 rounded-lg bg-emerald-600 text-white"
              >
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => setIsEditingTitle(true)}>
              <h1 className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
                {activeDocument.name}
              </h1>
              <Edit2 className="w-3.5 h-3.5 text-slate-400 hover:text-emerald-400 shrink-0" />
            </div>
          )}
          <div className="text-[11px] text-slate-400">
            {activePages.length} trang • Cập nhật lúc {new Date(activeDocument.updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md active:scale-95 transition"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Xuất PDF</span>
          </button>
          <button
            onClick={handleDeleteDoc}
            className="p-2 rounded-xl bg-slate-800/80 text-rose-400 hover:bg-rose-500/10 active:scale-95 transition"
            title="Xóa tài liệu"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Pages Grid Viewport */}
      <div className="flex-1 overflow-y-auto p-4 pb-24">
        {activePages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-slate-400">
            <p className="text-sm mb-4">Tài liệu này chưa có trang nào.</p>
            <button
              onClick={handleAddNewPage}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs flex items-center gap-2 shadow-lg"
            >
              <Plus className="w-4 h-4" />
              Chụp trang đầu tiên
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {activePages.map((page, idx) => {
              const url = pageUrls[page.id];
              return (
                <div
                  key={page.id}
                  className="group relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg flex flex-col hover:border-slate-700 transition"
                >
                  {/* Page Image */}
                  <div
                    onClick={() => setPreviewPage(page)}
                    className="relative aspect-[3/4] bg-slate-950 flex items-center justify-center overflow-hidden cursor-pointer"
                  >
                    {url ? (
                      <img
                        src={url}
                        alt={`Trang ${idx + 1}`}
                        className="w-full h-full object-contain p-1.5"
                      />
                    ) : (
                      <span className="text-xs text-slate-600">Đang tải...</span>
                    )}

                    {/* Page Number Badge */}
                    <div className="absolute top-2 left-2 px-2 py-0.5 rounded-md bg-black/70 backdrop-blur-md text-[10px] font-bold text-white border border-white/10">
                      Trang {idx + 1}
                    </div>

                    {/* OCR Indicator if text extracted */}
                    {page.ocrText && (
                      <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded-md bg-emerald-600/80 backdrop-blur-md text-[9px] font-bold text-white border border-emerald-400/30 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-amber-300" />
                        <span>OCR</span>
                      </div>
                    )}
                  </div>

                  {/* Actions bar for page */}
                  <div className="p-2 bg-slate-900/90 border-t border-slate-800 flex items-center justify-between">
                    {/* Reorder buttons */}
                    <div className="flex items-center gap-0.5">
                      <button
                        disabled={idx === 0}
                        onClick={() => handleMovePage(idx, 'left')}
                        className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 active:scale-95"
                        title="Di chuyển sang trái"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        disabled={idx === activePages.length - 1}
                        onClick={() => handleMovePage(idx, 'right')}
                        className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-20 active:scale-95"
                        title="Di chuyển sang phải"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Tools */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setOcrPage({ page, index: idx + 1 })}
                        className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 active:scale-95 transition"
                        title="Quét chữ OCR"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleReEditPage(page)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition"
                        title="Chỉnh lại viền & bộ lọc"
                      >
                        <Sliders className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeletePage(page.id)}
                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/10 active:scale-95 transition"
                        title="Xóa trang"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Quick Add Page Card */}
            <button
              onClick={handleAddNewPage}
              className="aspect-[3/4] rounded-2xl border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-900/30 hover:bg-slate-900/60 flex flex-col items-center justify-center p-4 text-slate-400 hover:text-emerald-400 active:scale-98 transition group cursor-pointer"
            >
              <div className="w-12 h-12 rounded-full bg-slate-800 group-hover:bg-emerald-600/20 flex items-center justify-center mb-2 transition">
                <Plus className="w-6 h-6 group-hover:text-emerald-400" />
              </div>
              <span className="text-xs font-semibold">Chụp thêm trang</span>
            </button>
          </div>
        )}
      </div>

      {/* Full Page Zoom Modal */}
      {previewPage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4">
          <button
            onClick={() => setPreviewPage(null)}
            className="absolute top-4 right-4 p-2 rounded-full bg-slate-800 text-white z-50"
          >
            <X className="w-5 h-5" />
          </button>
          {pageUrls[previewPage.id] && (
            <img
              src={pageUrls[previewPage.id]}
              alt="Page preview full"
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
          )}
        </div>
      )}

      {/* Modals */}
      <ExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        documentTitle={activeDocument.name}
        pages={activePages}
      />

      {ocrPage && (
        <OcrModal
          isOpen={true}
          onClose={() => setOcrPage(null)}
          page={ocrPage.page}
          pageNumber={ocrPage.index}
        />
      )}
    </div>
  );
};
