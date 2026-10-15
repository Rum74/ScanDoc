import React, { useState, useRef } from 'react';
import {
  X,
  Layers,
  Scissors,
  CreditCard,
  FileText,
  Stamp,
  RotateCw,
  Image as ImageIcon,
  Printer,
  Download,
  Share2,
  Check,
  Plus,
  Trash2,
  AlertCircle,
} from 'lucide-react';
import {
  mergePdfFiles,
  splitPdfFile,
  addWatermarkToPdf,
  rotatePdfFile,
  combineIdCardSides,
} from '../../lib/pdf-tools.ts';
import { convertTextToWordDocx } from '../../lib/word-converter.ts';
import { downloadBlob, shareFile } from '../../lib/pdf.ts';
import { recognizeVietnameseText } from '../../lib/ocr.ts';

interface PdfToolsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type ToolTab =
  | 'merge'
  | 'split'
  | 'idcard'
  | 'word'
  | 'watermark'
  | 'rotate'
  | 'jpg'
  | 'print';

export const PdfToolsModal: React.FC<PdfToolsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<ToolTab>('merge');
  const [isProcessing, setIsProcessing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Merge state
  const [mergeFiles, setMergeFiles] = useState<{ name: string; blob: Blob }[]>([]);

  // Split state
  const [splitFile, setSplitFile] = useState<{ name: string; blob: Blob } | null>(null);
  const [splitRange, setSplitRange] = useState<string>('1-2');

  // ID Card state
  const [idFront, setIdFront] = useState<{ name: string; blob: Blob } | null>(null);
  const [idBack, setIdBack] = useState<{ name: string; blob: Blob } | null>(null);

  // Watermark state
  const [wmFile, setWmFile] = useState<{ name: string; blob: Blob } | null>(null);
  const [wmText, setWmText] = useState('BẢN SAO');
  const [wmOpacity, setWmOpacity] = useState(0.25);

  // Word state
  const [wordFile, setWordFile] = useState<{ name: string; blob: Blob } | null>(null);

  // File Inputs
  const mergeInputRef = useRef<HTMLInputElement>(null);
  const splitInputRef = useRef<HTMLInputElement>(null);
  const idFrontInputRef = useRef<HTMLInputElement>(null);
  const idBackInputRef = useRef<HTMLInputElement>(null);
  const wmInputRef = useRef<HTMLInputElement>(null);
  const wordInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 1. Gộp PDF
  const handleMergeSubmit = async () => {
    if (mergeFiles.length < 2) {
      alert('Vui lòng chọn ít nhất 2 tệp PDF để gộp');
      return;
    }
    try {
      setIsProcessing(true);
      setStatusMsg('Đang gộp các tệp PDF...');
      const mergedBlob = await mergePdfFiles(mergeFiles.map((f) => f.blob));
      downloadBlob(mergedBlob, 'ScanDoc_Gop_Tai_Lieu.pdf');
      setIsProcessing(false);
      setStatusMsg('Gộp PDF thành công!');
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      alert('Lỗi gộp PDF. Vui lòng thử lại với tệp hợp lệ.');
    }
  };

  // 2. Tách PDF
  const handleSplitSubmit = async () => {
    if (!splitFile) return;
    try {
      setIsProcessing(true);
      setStatusMsg('Đang tách trang PDF...');
      // parse range e.g. "1-3" or "1,2,5"
      const indices: number[] = [];
      const parts = splitRange.split(',');
      for (const p of parts) {
        if (p.includes('-')) {
          const [start, end] = p.split('-').map((n) => parseInt(n.trim(), 10) - 1);
          for (let i = start; i <= end; i++) indices.push(i);
        } else {
          indices.push(parseInt(p.trim(), 10) - 1);
        }
      }
      const splitBlob = await splitPdfFile(splitFile.blob, indices);
      downloadBlob(splitBlob, `${splitFile.name.replace('.pdf', '')}_trang_tach.pdf`);
      setIsProcessing(false);
      setStatusMsg('Tách PDF thành công!');
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      alert('Lỗi tách PDF. Kiểm tra lại dải trang.');
    }
  };

  // 3. Ghép CCCD 2 mặt
  const handleIdCardSubmit = async () => {
    if (!idFront || !idBack) {
      alert('Vui lòng chọn đủ 2 ảnh Mặt trước và Mặt sau của CCCD');
      return;
    }
    try {
      setIsProcessing(true);
      setStatusMsg('Đang căn chỉnh và ghép 2 mặt lên trang A4...');
      const combinedPdf = await combineIdCardSides(idFront.blob, idBack.blob);
      downloadBlob(combinedPdf, 'CCCD_2_Mat_A4.pdf');
      setIsProcessing(false);
      setStatusMsg('Ghép CCCD thành công!');
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      alert('Lỗi ghép CCCD.');
    }
  };

  // 4. Chuyển PDF / Ảnh sang Word
  const handleWordSubmit = async () => {
    if (!wordFile) return;
    try {
      setIsProcessing(true);
      setStatusMsg('Đang trích xuất OCR và định dạng văn bản Word...');
      const text = await recognizeVietnameseText(wordFile.blob, (p) => {
        setStatusMsg(p.status);
      });
      const docxBlob = await convertTextToWordDocx(wordFile.name.replace(/\.[^/.]+$/, ''), [
        { pageNum: 1, text: text || 'Nội dung trích xuất từ tài liệu' },
      ]);
      downloadBlob(docxBlob, `${wordFile.name.replace(/\.[^/.]+$/, '')}.docx`);
      setIsProcessing(false);
      setStatusMsg('Đã chuyển sang Word (.docx) thành công!');
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      alert('Lỗi chuyển đổi sang Word.');
    }
  };

  // 5. Watermark
  const handleWatermarkSubmit = async () => {
    if (!wmFile) return;
    try {
      setIsProcessing(true);
      setStatusMsg('Đang đóng dấu chữ chìm...');
      const outBlob = await addWatermarkToPdf(wmFile.blob, wmText, wmOpacity);
      downloadBlob(outBlob, `${wmFile.name.replace('.pdf', '')}_watermark.pdf`);
      setIsProcessing(false);
      setStatusMsg('Đóng dấu thành công!');
    } catch (e) {
      console.error(e);
      setIsProcessing(false);
      alert('Lỗi đóng dấu watermark.');
    }
  };

  const navItems: { key: ToolTab; label: string; icon: any }[] = [
    { key: 'merge', label: 'Gộp PDF', icon: Layers },
    { key: 'split', label: 'Tách PDF', icon: Scissors },
    { key: 'idcard', label: 'Ghép CCCD 2 mặt', icon: CreditCard },
    { key: 'word', label: 'PDF sang Word', icon: FileText },
    { key: 'watermark', label: 'Watermark', icon: Stamp },
    { key: 'rotate', label: 'Xoay PDF', icon: RotateCw },
    { key: 'print', label: 'In không dây', icon: Printer },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 select-none">
      <div className="w-full max-w-xl rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 flex flex-col max-h-[88vh] animate-in fade-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="p-1 rounded-lg bg-emerald-500/20 text-emerald-400">
                <FileText className="w-5 h-5" />
              </span>
              Bộ công cụ PDF & Tài liệu
            </h2>
            <div className="text-[11px] text-slate-400">
              Tổ chức, chuyển đổi và tối ưu tài liệu chuyên nghiệp
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex gap-1.5 overflow-x-auto py-3 border-b border-slate-800/80 scrollbar-none shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => {
                  setActiveTab(item.key);
                  setStatusMsg(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 transition active:scale-95 ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'bg-slate-800/80 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto py-4 space-y-4">
          {statusMsg && (
            <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>{statusMsg}</span>
            </div>
          )}

          {/* TAB 1: GỘP PDF */}
          {activeTab === 'merge' && (
            <div className="space-y-3">
              <input
                type="file"
                ref={mergeInputRef}
                multiple
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files) {
                    const newFiles = Array.from(e.target.files).map((f) => ({
                      name: f.name,
                      blob: f,
                    }));
                    setMergeFiles((prev) => [...prev, ...newFiles]);
                  }
                }}
              />

              <div className="text-xs text-slate-300">
                Ghép nhiều tệp PDF riêng lẻ thành 1 tệp duy nhất theo đúng thứ tự bạn chọn.
              </div>

              {mergeFiles.length === 0 ? (
                <div
                  onClick={() => mergeInputRef.current?.click()}
                  className="p-8 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition bg-slate-950/40"
                >
                  <Plus className="w-8 h-8 text-slate-500 mb-2" />
                  <span className="text-xs font-semibold text-white">Chọn các tệp PDF để gộp</span>
                  <span className="text-[10px] text-slate-400 mt-0.5">Hỗ trợ chọn nhiều file cùng lúc</span>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {mergeFiles.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white"
                      >
                        <span className="truncate max-w-[280px]">
                          {i + 1}. {f.name}
                        </span>
                        <button
                          onClick={() => setMergeFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-rose-400 hover:text-rose-300 p-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => mergeInputRef.current?.click()}
                    className="w-full py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-emerald-400 border border-slate-700 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    Thêm file PDF khác
                  </button>

                  <button
                    disabled={isProcessing}
                    onClick={handleMergeSubmit}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-lg shadow-emerald-600/20 active:scale-98 transition flex items-center justify-center gap-2"
                  >
                    {isProcessing ? 'Đang gộp...' : `Gộp ${mergeFiles.length} tệp PDF thành một`}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TÁCH PDF */}
          {activeTab === 'split' && (
            <div className="space-y-3">
              <input
                type="file"
                ref={splitInputRef}
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setSplitFile({ name: f.name, blob: f });
                }}
              />

              <div className="text-xs text-slate-300">
                Tách các trang cụ thể từ một tệp PDF lớn (Ví dụ: <code className="text-emerald-400">1-3</code> hoặc <code className="text-emerald-400">1,3,5</code>).
              </div>

              {!splitFile ? (
                <div
                  onClick={() => splitInputRef.current?.click()}
                  className="p-8 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition bg-slate-950/40"
                >
                  <Scissors className="w-8 h-8 text-slate-500 mb-2" />
                  <span className="text-xs font-semibold text-white">Chọn tệp PDF cần tách</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-800 text-xs text-white flex items-center justify-between">
                    <span className="truncate">{splitFile.name}</span>
                    <button
                      onClick={() => setSplitFile(null)}
                      className="text-rose-400 text-xs font-medium"
                    >
                      Đổi file
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Các trang cần tách (VD: 1-2 hoặc 1,3,5):
                    </label>
                    <input
                      type="text"
                      value={splitRange}
                      onChange={(e) => setSplitRange(e.target.value)}
                      placeholder="1-3"
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <button
                    disabled={isProcessing}
                    onClick={handleSplitSubmit}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-lg active:scale-98 transition flex items-center justify-center gap-2"
                  >
                    {isProcessing ? 'Đang tách...' : 'Tách & Tải về file mới'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: GHÉP 2 MẶT CCCD / HỘ CHIẾU */}
          {activeTab === 'idcard' && (
            <div className="space-y-3">
              <input
                type="file"
                ref={idFrontInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setIdFront({ name: f.name, blob: f });
                }}
              />
              <input
                type="file"
                ref={idBackInputRef}
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setIdBack({ name: f.name, blob: f });
                }}
              />

              <div className="text-xs text-slate-300">
                Tự động ghép Mặt trước và Mặt sau của CCCD / Bằng lái lên đúng tỉ lệ trên cùng 1 trang A4 để in ấn.
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Front card slot */}
                <div
                  onClick={() => idFrontInputRef.current?.click()}
                  className={`p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition min-h-[120px] text-center ${
                    idFront
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:border-emerald-500'
                  }`}
                >
                  <CreditCard className="w-6 h-6 mb-1" />
                  <span className="text-xs font-semibold">
                    {idFront ? '✓ Mặt trước' : '+ Mặt trước CCCD'}
                  </span>
                  {idFront && <span className="text-[10px] truncate max-w-[120px]">{idFront.name}</span>}
                </div>

                {/* Back card slot */}
                <div
                  onClick={() => idBackInputRef.current?.click()}
                  className={`p-4 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition min-h-[120px] text-center ${
                    idBack
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                      : 'border-slate-700 bg-slate-950/40 text-slate-400 hover:border-emerald-500'
                  }`}
                >
                  <CreditCard className="w-6 h-6 mb-1" />
                  <span className="text-xs font-semibold">
                    {idBack ? '✓ Mặt sau' : '+ Mặt sau CCCD'}
                  </span>
                  {idBack && <span className="text-[10px] truncate max-w-[120px]">{idBack.name}</span>}
                </div>
              </div>

              <button
                disabled={!idFront || !idBack || isProcessing}
                onClick={handleIdCardSubmit}
                className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 font-bold text-xs text-white shadow-lg active:scale-98 transition flex items-center justify-center gap-2"
              >
                {isProcessing ? 'Đang ghép trang A4...' : 'Ghép 2 mặt lên 1 trang A4 (PDF)'}
              </button>
            </div>
          )}

          {/* TAB 4: PDF SANG WORD */}
          {activeTab === 'word' && (
            <div className="space-y-3">
              <input
                type="file"
                ref={wordInputRef}
                accept="application/pdf,image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setWordFile({ name: f.name, blob: f });
                }}
              />

              <div className="text-xs text-slate-300">
                Chuyển đổi tài liệu PDF hoặc ảnh scan sang file Microsoft Word (.docx) chuẩn chỉnh để chỉnh sửa.
              </div>

              {!wordFile ? (
                <div
                  onClick={() => wordInputRef.current?.click()}
                  className="p-8 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition bg-slate-950/40"
                >
                  <FileText className="w-8 h-8 text-blue-400 mb-2" />
                  <span className="text-xs font-semibold text-white">Chọn tệp PDF hoặc ảnh</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-800 text-xs text-white flex items-center justify-between">
                    <span className="truncate">{wordFile.name}</span>
                    <button
                      onClick={() => setWordFile(null)}
                      className="text-rose-400 text-xs font-medium"
                    >
                      Đổi file
                    </button>
                  </div>

                  <button
                    disabled={isProcessing}
                    onClick={handleWordSubmit}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 font-bold text-xs text-white shadow-lg active:scale-98 transition flex items-center justify-center gap-2"
                  >
                    {isProcessing ? 'Đang trích xuất sang Word...' : 'Chuyển đổi sang Word (.docx)'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 5: WATERMARK */}
          {activeTab === 'watermark' && (
            <div className="space-y-3">
              <input
                type="file"
                ref={wmInputRef}
                accept="application/pdf"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setWmFile({ name: f.name, blob: f });
                }}
              />

              <div className="text-xs text-slate-300">
                Đóng dấu chữ chìm bản quyền bảo mật (Watermark) nghiêng 45° lên toàn bộ các trang PDF.
              </div>

              {!wmFile ? (
                <div
                  onClick={() => wmInputRef.current?.click()}
                  className="p-8 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition bg-slate-950/40"
                >
                  <Stamp className="w-8 h-8 text-amber-400 mb-2" />
                  <span className="text-xs font-semibold text-white">Chọn tệp PDF để đóng dấu</span>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="p-3 rounded-xl bg-slate-800 text-xs text-white flex items-center justify-between">
                    <span className="truncate">{wmFile.name}</span>
                    <button onClick={() => setWmFile(null)} className="text-rose-400 text-xs font-medium">
                      Đổi file
                    </button>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Chữ đóng dấu:</label>
                    <div className="flex gap-1.5 mb-2">
                      {['BẢN SAO', 'TUYỆT MẬT', 'NỘI BỘ'].map((preset) => (
                        <button
                          key={preset}
                          onClick={() => setWmText(preset)}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold border ${
                            wmText === preset
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                              : 'bg-slate-800 text-slate-400 border-slate-700'
                          }`}
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                    <input
                      type="text"
                      value={wmText}
                      onChange={(e) => setWmText(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-white text-xs focus:outline-none focus:border-emerald-500"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Độ mờ chữ:</span>
                      <span>{Math.round(wmOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.6"
                      step="0.05"
                      value={wmOpacity}
                      onChange={(e) => setWmOpacity(parseFloat(e.target.value))}
                      className="w-full accent-amber-500 cursor-pointer"
                    />
                  </div>

                  <button
                    disabled={isProcessing}
                    onClick={handleWatermarkSubmit}
                    className="w-full py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 font-bold text-xs text-white shadow-lg active:scale-98 transition flex items-center justify-center gap-2"
                  >
                    {isProcessing ? 'Đang xử lý...' : 'Đóng dấu Watermark & Tải về'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* TAB 6: IN KHÔNG DÂY */}
          {activeTab === 'print' && (
            <div className="space-y-4 text-center py-4">
              <Printer className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
              <h3 className="text-sm font-bold text-white">In ấn không dây tức thì</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Hỗ trợ kết nối máy in qua Wi-Fi (AirPrint / Mopria / Google Cloud Print) trực tiếp từ trình duyệt điện thoại.
              </p>
              <button
                onClick={() => window.print()}
                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-lg shadow-emerald-600/20 active:scale-95 transition inline-flex items-center gap-2 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                Mở lệnh In ấn
              </button>
            </div>
          )}

          {/* TAB 7: XOAY PDF */}
          {activeTab === 'rotate' && (
            <div className="space-y-3">
              <input
                type="file"
                accept="application/pdf"
                id="rotate-input"
                className="hidden"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    setIsProcessing(true);
                    setStatusMsg('Đang xoay toàn bộ trang 90°...');
                    const rotated = await rotatePdfFile(f, 90);
                    downloadBlob(rotated, `${f.name.replace('.pdf', '')}_xoay_90.pdf`);
                    setIsProcessing(false);
                    setStatusMsg('Xoay PDF thành công!');
                  }
                }}
              />
              <div
                onClick={() => document.getElementById('rotate-input')?.click()}
                className="p-8 border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition bg-slate-950/40"
              >
                <RotateCw className="w-8 h-8 text-emerald-400 mb-2" />
                <span className="text-xs font-semibold text-white">Chọn tệp PDF để xoay 90°</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
