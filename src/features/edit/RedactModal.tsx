import React, { useRef, useState, useEffect } from 'react';
import { X, Check, ShieldAlert, RotateCcw, EyeOff } from 'lucide-react';
import { blobToImage } from '../../lib/image-processing.ts';

interface RedactModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageBlob: Blob;
  onApplyRedact: (newBlob: Blob) => void;
}

interface RedactBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const RedactModal: React.FC<RedactModalProps> = ({
  isOpen,
  onClose,
  imageBlob,
  onApplyRedact,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [boxes, setBoxes] = useState<RedactBox[]>([]);
  const [currentBox, setCurrentBox] = useState<RedactBox | null>(null);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [imgObj, setImgObj] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    if (isOpen && imageBlob) {
      blobToImage(imageBlob).then((img) => {
        setImgObj(img);
        setBoxes([]);
        setCurrentBox(null);
      });
    }
  }, [isOpen, imageBlob]);

  // Redraw canvas
  useEffect(() => {
    if (!canvasRef.current || !imgObj) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = imgObj.width;
    canvas.height = imgObj.height;

    // Draw base image
    ctx.drawImage(imgObj, 0, 0);

    // Draw applied redaction boxes (solid privacy black bars)
    ctx.fillStyle = '#0f172a';
    for (const b of boxes) {
      ctx.fillRect(b.x, b.y, b.w, b.h);
    }

    // Draw currently dragging box
    if (currentBox) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.75)';
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.fillRect(currentBox.x, currentBox.y, currentBox.w, currentBox.h);
      ctx.strokeRect(currentBox.x, currentBox.y, currentBox.w, currentBox.h);
    }
  }, [imgObj, boxes, currentBox]);

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    setStartPos({ x, y });
    setCurrentBox({ x, y, w: 0, h: 0 });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!startPos || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const currX = (e.clientX - rect.left) * (canvas.width / rect.width);
    const currY = (e.clientY - rect.top) * (canvas.height / rect.height);

    const x = Math.min(startPos.x, currX);
    const y = Math.min(startPos.y, currY);
    const w = Math.abs(currX - startPos.x);
    const h = Math.abs(currY - startPos.y);

    setCurrentBox({ x, y, w, h });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (currentBox && currentBox.w > 5 && currentBox.h > 5) {
      setBoxes((prev) => [...prev, currentBox]);
    }
    setStartPos(null);
    setCurrentBox(null);
  };

  const handleUndo = () => {
    setBoxes((prev) => prev.slice(0, -1));
  };

  const handleApply = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob(
      (b) => {
        if (b) {
          onApplyRedact(b);
          onClose();
        }
      },
      'image/jpeg',
      0.95
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-800 p-4 shadow-2xl text-slate-100 flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-rose-400" />
            Làm mờ / Che thông tin nhạy cảm
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="text-[11px] text-slate-400 my-2">
          💡 Chạm và kéo vùng chữ (CCCD, số tài khoản, địa chỉ) để tạo thanh che đen bảo mật.
        </div>

        {/* Canvas Viewport */}
        <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-950 rounded-xl p-2 min-h-[300px]">
          <canvas
            ref={canvasRef}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="max-w-full max-h-[60vh] object-contain rounded cursor-crosshair touch-none shadow-lg"
          />
        </div>

        <div className="pt-3 flex items-center justify-between gap-2 border-t border-slate-800 mt-2">
          <button
            disabled={boxes.length === 0}
            onClick={handleUndo}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-slate-300 text-xs font-semibold flex items-center gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Hoàn tác ({boxes.length})</span>
          </button>

          <button
            onClick={handleApply}
            className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md flex items-center justify-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            <span>Lưu bản che thông tin</span>
          </button>
        </div>
      </div>
    </div>
  );
};
