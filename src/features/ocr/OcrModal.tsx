import React, { useState } from 'react';
import { X, Sparkles, Copy, Check, FileText, AlertCircle } from 'lucide-react';
import { recognizeVietnameseText, OcrProgress } from '../../lib/ocr.ts';
import { LocalPage } from '../../lib/db.ts';
import { useDocStore } from '../../store/useDocStore.ts';

interface OcrModalProps {
  isOpen: boolean;
  onClose: () => void;
  page: LocalPage;
  pageNumber: number;
}

export const OcrModal: React.FC<OcrModalProps> = ({
  isOpen,
  onClose,
  page,
  pageNumber,
}) => {
  const [extractedText, setExtractedText] = useState<string>(page.ocrText || '');
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState<OcrProgress | null>(null);
  const [copied, setCopied] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);

  const { updatePageData } = useDocStore();

  if (!isOpen) return null;

  const handleStartOcr = async () => {
    const targetBlob = page.processedBlob || page.originalBlob;
    if (!targetBlob) return;

    try {
      setIsRunning(true);
      setOcrError(null);
      setProgress({ status: 'Bắt đầu khởi động nhận diện...', progress: 0.05 });

      const text = await recognizeVietnameseText(targetBlob, (p) => {
        setProgress(p);
      });

      setExtractedText(text);

      // Save OCR text to page metadata for search
      page.ocrText = text;
      await updatePageData(page);

      setIsRunning(false);
      setProgress(null);
    } catch (err: unknown) {
      console.error('OCR failed:', err);
      setIsRunning(false);
      setProgress(null);
      setOcrError(
        err instanceof Error ? err.message : 'Không thể nhận diện văn bản. Vui lòng thử lại.'
      );
    }
  };

  const handleCopy = async () => {
    if (!extractedText) return;
    try {
      await navigator.clipboard.writeText(extractedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-400" />
            Nhận diện chữ viết (OCR Tiếng Việt) - Trang {pageNumber}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          {ocrError && (
            <div className="p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{ocrError}</span>
            </div>
          )}

          {/* Progress Indicator */}
          {isRunning && progress && (
            <div className="p-3.5 bg-slate-800/80 rounded-xl space-y-2 border border-slate-700/60">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-400 font-medium">{progress.status}</span>
                <span className="text-slate-400 font-mono">{Math.round(progress.progress * 100)}%</span>
              </div>
              <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-300"
                  style={{ width: `${Math.max(5, progress.progress * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Text Result */}
          {extractedText ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300">Văn bản đã nhận diện:</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-emerald-400 active:scale-95 transition"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Đã sao chép</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Sao chép chữ</span>
                    </>
                  )}
                </button>
              </div>

              <textarea
                value={extractedText}
                onChange={(e) => setExtractedText(e.target.value)}
                rows={10}
                className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs leading-relaxed focus:outline-none focus:border-emerald-500 font-mono"
                placeholder="Văn bản trích xuất sẽ hiển thị tại đây..."
              />
            </div>
          ) : (
            <div className="p-8 text-center bg-slate-950/50 rounded-xl border border-slate-800/60">
              <FileText className="w-12 h-12 text-slate-600 mx-auto mb-2" />
              <div className="text-sm font-medium text-slate-300">Chưa quét văn bản cho trang này</div>
              <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                Sử dụng công nghệ AI Tesseract để trích xuất toàn bộ chữ tiếng Việt và tiếng Anh từ hình ảnh.
              </p>
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-800 flex gap-2.5">
          <button
            disabled={isRunning}
            onClick={handleStartOcr}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow-md active:scale-98 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isRunning ? (
              <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>{extractedText ? 'Quét lại OCR' : 'Bắt đầu quét chữ (OCR)'}</span>
              </>
            )}
          </button>
          <button
            onClick={onClose}
            className="py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
