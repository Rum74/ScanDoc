import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  RotateCw,
  Crop,
  Sliders,
  Plus,
  Check,
  Sun,
  Contrast,
  Sparkles,
} from 'lucide-react';
import { useScanStore } from '../../store/useScanStore.ts';
import { useDocStore } from '../../store/useDocStore.ts';
import { FilterType, LocalPage } from '../../lib/db.ts';

export const PageEditor: React.FC = () => {
  const {
    originalBlob,
    corners,
    rotation,
    filter,
    brightness,
    contrast,
    processedPreviewBlob,
    thumbnailBlob,
    isProcessing,
    setFilter,
    setBrightness,
    setContrast,
    rotateClockwise,
    rotateCounterClockwise,
    generateProcessedPreview,
    targetDocumentId,
    editingPageId,
    initCapture,
  } = useScanStore();

  const {
    activeDocument,
    createDocument,
    addPageToDocument,
    updatePageData,
    openDocument,
    setView,
  } = useDocStore();

  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [showSliders, setShowSliders] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Update object URL for preview
  useEffect(() => {
    if (processedPreviewBlob) {
      const url = URL.createObjectURL(processedPreviewBlob);
      setPreviewUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [processedPreviewBlob]);

  // Handle Filter Change
  const handleFilterSelect = async (f: FilterType) => {
    setFilter(f);
    setTimeout(() => {
      generateProcessedPreview();
    }, 50);
  };

  const handleRotate = async (cw: boolean) => {
    if (cw) rotateClockwise();
    else rotateCounterClockwise();
    setTimeout(() => {
      generateProcessedPreview();
    }, 50);
  };

  const handleSliderChange = () => {
    generateProcessedPreview();
  };

  // Helper to persist page
  const saveCurrentPage = async (): Promise<string> => {
    if (!originalBlob || !processedPreviewBlob || !thumbnailBlob) {
      throw new Error('Chưa hoàn tất xử lý ảnh');
    }

    setIsSaving(true);
    let docId = targetDocumentId || activeDocument?.id;

    // If no document exists, create a new one
    if (!docId) {
      const newDoc = await createDocument();
      docId = newDoc.id;
    }

    const now = Date.now();
    const pageId = editingPageId || 'page_' + now + '_' + Math.random().toString(36).substring(2, 7);

    const pageModel: LocalPage = {
      id: pageId,
      documentId: docId,
      originalBlob,
      corners,
      rotation,
      filter,
      brightness,
      contrast,
      processedBlob: processedPreviewBlob,
      thumbnailBlob,
      updatedAt: now,
      deletedAt: null,
    };

    if (editingPageId) {
      await updatePageData(pageModel);
    } else {
      await addPageToDocument(docId, pageModel);
    }

    setIsSaving(false);
    return docId;
  };

  // Action: Add another page immediately
  const handleAddMorePages = async () => {
    try {
      const docId = await saveCurrentPage();
      initCapture(docId);
      setView('capture');
    } catch (err) {
      console.error('Error adding more pages:', err);
      setIsSaving(false);
    }
  };

  // Action: Complete and open document detail view
  const handleDone = async () => {
    try {
      const docId = await saveCurrentPage();
      await openDocument(docId);
      setView('detail');
    } catch (err) {
      console.error('Error saving document page:', err);
      setIsSaving(false);
    }
  };

  const filtersList: { key: FilterType; label: string; desc: string }[] = [
    { key: 'enhanced', label: 'Tăng cường', desc: 'Sáng đẹp' },
    { key: 'original', label: 'Ảnh gốc', desc: 'Tự nhiên' },
    { key: 'bw', label: 'Đen trắng', desc: 'Văn bản' },
    { key: 'grayscale', label: 'Mức xám', desc: 'Tối ưu' },
    { key: 'shadow_removal', label: 'Khử bóng', desc: 'Đều màu' },
  ];

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header */}
      <div className="p-3.5 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-50">
        <button
          onClick={() => setView('corner_adjust')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-xl bg-slate-800/80 active:scale-95 transition"
        >
          <Crop className="w-4 h-4 text-emerald-400" />
          <span>Cắt lại</span>
        </button>

        <span className="text-xs font-bold text-white tracking-wide">
          Chỉnh sửa & Bộ lọc
        </span>

        {/* Rotate controls in header for quick access */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => handleRotate(false)}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white active:scale-95 transition"
            title="Xoay trái 90°"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleRotate(true)}
            className="p-2 rounded-xl bg-slate-800/80 text-slate-300 hover:text-white active:scale-95 transition"
            title="Xoay phải 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Image Viewport */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center p-3 overflow-hidden bg-slate-950">
        {isProcessing ? (
          <div className="flex flex-col items-center gap-3">
            <span className="animate-spin rounded-full h-8 w-8 border-3 border-emerald-400 border-t-transparent" />
            <span className="text-xs font-medium text-emerald-300">Đang áp dụng bộ lọc...</span>
          </div>
        ) : previewUrl ? (
          <img
            src={previewUrl}
            alt="Processed Document"
            className="max-w-full max-h-[68vh] object-contain rounded-lg shadow-2xl border border-slate-800"
          />
        ) : null}
      </div>

      {/* Adjust Sliders Drawer (Collapsible) */}
      {showSliders && (
        <div className="p-4 bg-slate-900/95 border-t border-slate-800 space-y-3 animate-in slide-in-from-bottom duration-150">
          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                <Sun className="w-3.5 h-3.5 text-amber-400" />
                Độ sáng
              </span>
              <span className="font-semibold text-white">{brightness}</span>
            </div>
            <input
              type="range"
              min="-40"
              max="40"
              value={brightness}
              onChange={(e) => setBrightness(parseInt(e.target.value, 10))}
              onPointerUp={handleSliderChange}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-slate-300 mb-1">
              <span className="flex items-center gap-1.5">
                <Contrast className="w-3.5 h-3.5 text-blue-400" />
                Độ tương phản
              </span>
              <span className="font-semibold text-white">{contrast}</span>
            </div>
            <input
              type="range"
              min="-40"
              max="40"
              value={contrast}
              onChange={(e) => setContrast(parseInt(e.target.value, 10))}
              onPointerUp={handleSliderChange}
              className="w-full accent-emerald-500 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Filters Bar & Bottom Actions */}
      <div className="bg-slate-900/95 border-t border-slate-800 p-3 pb-5 space-y-3 z-50">
        {/* Filter Presets Pill Carousel */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setShowSliders(!showSliders)}
            className={`p-2.5 rounded-xl border flex items-center gap-1 shrink-0 text-xs font-medium transition ${
              showSliders
                ? 'bg-emerald-600 text-white border-emerald-500'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
            title="Thanh trượt sáng / tương phản"
          >
            <Sliders className="w-4 h-4" />
            <span>Tinh chỉnh</span>
          </button>

          {filtersList.map((item) => {
            const isActive = filter === item.key;
            return (
              <button
                key={item.key}
                onClick={() => handleFilterSelect(item.key)}
                className={`flex-1 min-w-[82px] py-2 px-2.5 rounded-xl border text-center shrink-0 transition active:scale-95 ${
                  isActive
                    ? 'bg-emerald-600/20 border-emerald-500 text-emerald-300 shadow-md ring-1 ring-emerald-500/50'
                    : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="text-xs font-semibold flex items-center justify-center gap-1">
                  {item.key === 'enhanced' && <Sparkles className="w-3 h-3 text-amber-400" />}
                  {item.label}
                </div>
                <div className="text-[10px] opacity-75 mt-0.5">{item.desc}</div>
              </button>
            );
          })}
        </div>

        {/* Primary Save Action Buttons */}
        <div className="flex gap-2.5 pt-1">
          <button
            disabled={isSaving || isProcessing}
            onClick={handleAddMorePages}
            className="flex-1 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 font-semibold text-xs active:scale-98 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <Plus className="w-4 h-4 text-emerald-400" />
            <span>+ Thêm trang tiếp</span>
          </button>

          <button
            disabled={isSaving || isProcessing}
            onClick={handleDone}
            className="flex-1 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 active:scale-98 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isSaving ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Hoàn tất & Lưu</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
