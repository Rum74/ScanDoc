import React, { useState } from 'react';
import { X, FileText, Share2, Download, Check, Sparkles, Image as ImageIcon } from 'lucide-react';
import { generatePdf, shareFile, downloadBlob, PdfQuality } from '../../lib/pdf.ts';
import { LocalPage } from '../../lib/db.ts';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentTitle: string;
  pages: LocalPage[];
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  documentTitle,
  pages,
}) => {
  const [quality, setQuality] = useState<PdfQuality>('medium');
  const [exportType, setExportType] = useState<'pdf' | 'jpg'>('pdf');
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  if (!isOpen) return null;

  const validPages = pages.filter((p) => p.processedBlob || p.originalBlob);

  const handleExport = async (action: 'download' | 'share') => {
    if (validPages.length === 0) return;

    try {
      setIsExporting(true);
      const safeTitle = (documentTitle || 'ScanDoc_Tài_liệu').replace(/[^a-zA-Z0-9_\u00C0-\u024F\u1E00-\u1EFF-]/g, '_');

      if (exportType === 'pdf') {
        const pageInputs = validPages.map((p, idx) => ({
          blob: p.processedBlob || p.originalBlob,
          name: `Trang ${idx + 1}`,
        }));

        const pdfBlob = await generatePdf(pageInputs, quality, (curr, tot) => {
          setExportProgress({ current: curr, total: tot });
        });

        const filename = `${safeTitle}.pdf`;
        if (action === 'share') {
          await shareFile(pdfBlob, filename, documentTitle);
        } else {
          downloadBlob(pdfBlob, filename);
        }
      } else {
        // Single page or all pages as JPG
        for (let i = 0; i < validPages.length; i++) {
          const blob = validPages[i].processedBlob || validPages[i].originalBlob;
          const filename = `${safeTitle}_trang_${i + 1}.jpg`;
          if (action === 'share' && i === 0 && validPages.length === 1) {
            await shareFile(blob, filename, documentTitle);
          } else {
            downloadBlob(blob, filename);
          }
        }
      }

      setIsExporting(false);
      setExportProgress(null);
      onClose();
    } catch (err) {
      console.error('Export error:', err);
      setIsExporting(false);
      setExportProgress(null);
    }
  };

  const qualityOptions: { key: PdfQuality; title: string; desc: string; sizeEst: string }[] = [
    { key: 'small', title: 'Nhỏ', desc: 'Dung lượng nhẹ, dễ gửi Zalo/Email', sizeEst: '~150 - 300 KB/trang' },
    { key: 'medium', title: 'Vừa (Khuyên dùng)', desc: 'Cân bằng tối ưu giữa độ nét và dung lượng', sizeEst: '~500 - 800 KB/trang' },
    { key: 'high', title: 'Cao', desc: 'Sắc nét tối đa, chất lượng in ấn tài liệu', sizeEst: '~1.5 - 2.5 MB/trang' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Share2 className="w-5 h-5 text-emerald-400" />
            Xuất & Chia sẻ tài liệu
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4">
          <div className="text-xs text-slate-300">
            Tài liệu: <span className="font-semibold text-white">{documentTitle}</span> ({validPages.length} trang)
          </div>

          {/* Export Type Selection */}
          <div className="flex rounded-xl bg-slate-800/80 p-1">
            <button
              onClick={() => setExportType('pdf')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                exportType === 'pdf' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              File PDF ({validPages.length} trang)
            </button>
            <button
              onClick={() => setExportType('jpg')}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition ${
                exportType === 'jpg' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Ảnh JPG
            </button>
          </div>

          {/* Quality Options for PDF */}
          {exportType === 'pdf' && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-slate-300">Chất lượng PDF xuất bản:</label>
              <div className="space-y-2">
                {qualityOptions.map((opt) => {
                  const isSelected = quality === opt.key;
                  return (
                    <div
                      key={opt.key}
                      onClick={() => setQuality(opt.key)}
                      className={`p-3 rounded-xl border cursor-pointer transition flex items-start justify-between ${
                        isSelected
                          ? 'bg-emerald-600/15 border-emerald-500 ring-1 ring-emerald-500/50'
                          : 'bg-slate-800/60 border-slate-700/60 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                          {opt.title}
                          {opt.key === 'medium' && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-emerald-500/20 text-emerald-300 font-normal">
                              Tốt nhất
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 mt-0.5">{opt.desc}</div>
                        <div className="text-[10px] text-emerald-400/90 font-mono mt-0.5">{opt.sizeEst}</div>
                      </div>
                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center mt-0.5 ${
                          isSelected ? 'border-emerald-400 bg-emerald-500 text-slate-950' : 'border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {isExporting && exportProgress && (
            <div className="bg-slate-800/80 p-3 rounded-xl text-center space-y-1.5">
              <div className="text-xs text-emerald-300 font-medium">
                Đang đóng gói trang {exportProgress.current} / {exportProgress.total}...
              </div>
              <div className="w-full h-1.5 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200"
                  style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-2.5 pt-2">
            <button
              disabled={isExporting}
              onClick={() => handleExport('share')}
              className="flex-1 py-3 px-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-100 font-semibold text-xs active:scale-98 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Share2 className="w-4 h-4 text-blue-400" />
              <span>Chia sẻ ngay</span>
            </button>

            <button
              disabled={isExporting}
              onClick={() => handleExport('download')}
              className="flex-1 py-3 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 active:scale-98 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>Tải về máy</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
