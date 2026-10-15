import React, { useRef, useState, useEffect } from 'react';
import { X, Check, RotateCcw, PenTool, CheckCircle } from 'lucide-react';

interface SignatureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplySignature: (signatureDataUrl: string) => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  onClose,
  onApplySignature,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [color, setColor] = useState<'#1d4ed8' | '#0f172a' | '#dc2626'>('#1d4ed8');
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setHasDrawn(false);
      }
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const startDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawing) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setIsDrawing(false);
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    onApplySignature(dataUrl);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-sm rounded-2xl bg-slate-900 border border-slate-800 p-5 shadow-2xl text-slate-100 flex flex-col">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <PenTool className="w-4 h-4 text-emerald-400" />
            Ký tên điện tử (E-Sign)
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="py-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400">Dùng ngón tay ký vào ô dưới:</span>
            {/* Color Picker */}
            <div className="flex items-center gap-2">
              {[
                { color: '#1d4ed8', label: 'Xanh mực' },
                { color: '#0f172a', label: 'Đen' },
                { color: '#dc2626', label: 'Đỏ' },
              ].map((c) => (
                <button
                  key={c.color}
                  onClick={() => setColor(c.color as any)}
                  style={{ backgroundColor: c.color }}
                  className={`w-5 h-5 rounded-full border-2 transition ${
                    color === c.color ? 'border-white scale-125' : 'border-slate-700'
                  }`}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Signature Canvas */}
          <div className="w-full h-44 rounded-xl bg-white border border-slate-300 relative overflow-hidden touch-none shadow-inner">
            <canvas
              ref={canvasRef}
              width={600}
              height={300}
              onPointerDown={startDrawing}
              onPointerMove={draw}
              onPointerUp={stopDrawing}
              className="w-full h-full cursor-crosshair"
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none text-slate-400 text-xs italic">
                Ký tên tại đây
              </div>
            )}
          </div>
        </div>

        <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-800">
          <button
            onClick={handleClear}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Ký lại</span>
          </button>

          <button
            disabled={!hasDrawn}
            onClick={handleSave}
            className="flex-1 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-xs font-semibold shadow-md flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Chèn chữ ký vào trang</span>
          </button>
        </div>
      </div>
    </div>
  );
};
