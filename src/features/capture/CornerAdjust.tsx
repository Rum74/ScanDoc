import React, { useRef, useState, useEffect } from 'react';
import { RefreshCw, ArrowRight, ArrowLeft, Maximize2 } from 'lucide-react';
import { useScanStore } from '../../store/useScanStore.ts';
import { useDocStore } from '../../store/useDocStore.ts';
import { Point } from '../../lib/db.ts';

export const CornerAdjust: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null);

  const {
    originalBlob,
    corners,
    updateCorner,
    redetectCorners,
    setCorners,
    isDetecting,
    generateProcessedPreview,
  } = useScanStore();
  const { setView } = useDocStore();

  const [imageUrl, setImageUrl] = useState<string>('');
  const [activePin, setActivePin] = useState<number | null>(null);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const [imgLayout, setImgLayout] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  // Load image object URL
  useEffect(() => {
    if (!originalBlob) {
      setView('capture');
      return;
    }
    const url = URL.createObjectURL(originalBlob);
    setImageUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [originalBlob, setView]);

  // Update image layout bounds on load & resize
  const updateLayout = () => {
    if (!imgRef.current || !containerRef.current) return;
    const img = imgRef.current;
    const rect = img.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();

    setImgLayout({
      x: rect.left - containerRect.left,
      y: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height,
    });
  };

  useEffect(() => {
    window.addEventListener('resize', updateLayout);
    return () => window.removeEventListener('resize', updateLayout);
  }, []);

  // Draw magnifying loupe
  const updateLoupe = (pinIndex: number) => {
    if (!loupeCanvasRef.current || !imgRef.current) return;
    const canvas = loupeCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = imgRef.current;
    const pt = corners[pinIndex];

    const naturalW = img.naturalWidth || img.width;
    const naturalH = img.naturalHeight || img.height;

    const sourceX = pt.x * naturalW;
    const sourceY = pt.y * naturalH;

    const zoom = 2.5;
    const loupeW = canvas.width;
    const loupeH = canvas.height;
    const sampleW = loupeW / zoom;
    const sampleH = loupeH / zoom;

    ctx.clearRect(0, 0, loupeW, loupeH);

    // Draw zoomed patch
    ctx.drawImage(
      img,
      sourceX - sampleW / 2,
      sourceY - sampleH / 2,
      sampleW,
      sampleH,
      0,
      0,
      loupeW,
      loupeH
    );

    // Draw Crosshair
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 2;
    // Horizontal line
    ctx.beginPath();
    ctx.moveTo(loupeW / 2 - 16, loupeH / 2);
    ctx.lineTo(loupeW / 2 + 16, loupeH / 2);
    ctx.stroke();

    // Vertical line
    ctx.beginPath();
    ctx.moveTo(loupeW / 2, loupeH / 2 - 16);
    ctx.lineTo(loupeW / 2, loupeH / 2 + 16);
    ctx.stroke();

    // Center circular dot
    ctx.fillStyle = '#34d399';
    ctx.beginPath();
    ctx.arc(loupeW / 2, loupeH / 2, 3.5, 0, Math.PI * 2);
    ctx.fill();
  };

  // Convert client touch/mouse to normalized (0-1) coordinates
  const handlePointerDown = (index: number, e: React.PointerEvent) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setActivePin(index);

    const pt = corners[index];
    setDragPos({
      x: imgLayout.x + pt.x * imgLayout.width,
      y: imgLayout.y + pt.y * imgLayout.height,
    });
    updateLoupe(index);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (activePin === null || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();

    const clientX = e.clientX - containerRect.left;
    const clientY = e.clientY - containerRect.top;

    if (imgLayout.width <= 0 || imgLayout.height <= 0) return;

    const normX = Math.max(0, Math.min(1, (clientX - imgLayout.x) / imgLayout.width));
    const normY = Math.max(0, Math.min(1, (clientY - imgLayout.y) / imgLayout.height));

    const updatedPoint: Point = { x: normX, y: normY };
    updateCorner(activePin, updatedPoint);

    setDragPos({
      x: clientX,
      y: clientY,
    });

    updateLoupe(activePin);
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (activePin !== null) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
      setActivePin(null);
      setDragPos(null);
    }
  };

  // Reset to full rectangular bounding box
  const handleSetMaxCorners = () => {
    setCorners([
      { x: 0.02, y: 0.02 },
      { x: 0.98, y: 0.02 },
      { x: 0.98, y: 0.98 },
      { x: 0.02, y: 0.98 },
    ]);
  };

  const handleConfirm = async () => {
    await generateProcessedPreview();
    setView('filter_edit');
  };

  // Calculate polygon points in CSS coordinates
  const polygonPoints = corners
    .map(
      (c) =>
        `${imgLayout.x + c.x * imgLayout.width},${imgLayout.y + c.y * imgLayout.height}`
    )
    .join(' ');

  const cornerLabels = ['Trên - Trái', 'Trên - Phải', 'Dưới - Phải', 'Dưới - Trái'];

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 flex flex-col justify-between overflow-hidden select-none">
      {/* Top Header */}
      <div className="p-4 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between z-50">
        <button
          onClick={() => setView('capture')}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-xl bg-slate-800/80 active:scale-95 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Chụp lại</span>
        </button>

        <span className="text-xs font-bold text-white tracking-wide">
          Chỉnh 4 góc tài liệu
        </span>

        <button
          onClick={handleConfirm}
          className="flex items-center gap-1.5 text-xs font-semibold text-white px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 shadow-md active:scale-95 transition"
        >
          <span>Tiếp tục</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      {/* Main interactive area */}
      <div
        ref={containerRef}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative flex-1 w-full h-full flex items-center justify-center p-3 overflow-hidden touch-none"
      >
        {imageUrl && (
          <img
            ref={imgRef}
            src={imageUrl}
            alt="Captured Document"
            onLoad={updateLayout}
            className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-2xl pointer-events-none"
          />
        )}

        {/* SVG Polygon Overlay */}
        {imgLayout.width > 0 && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10">
            {/* Shaded polygon */}
            <polygon
              points={polygonPoints}
              fill="rgba(16, 185, 129, 0.22)"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeDasharray="4 2"
            />
          </svg>
        )}

        {/* 4 Interactive Corner Pins */}
        {imgLayout.width > 0 &&
          corners.map((c, idx) => {
            const posX = imgLayout.x + c.x * imgLayout.width;
            const posY = imgLayout.y + c.y * imgLayout.height;
            const isTarget = activePin === idx;

            return (
              <div
                key={idx}
                onPointerDown={(e) => handlePointerDown(idx, e)}
                style={{
                  left: `${posX}px`,
                  top: `${posY}px`,
                  transform: 'translate(-50%, -50%)',
                }}
                className="absolute z-20 w-11 h-11 flex items-center justify-center cursor-pointer touch-none"
              >
                {/* Visual pin circle */}
                <div
                  className={`w-7 h-7 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-black transition-transform ${
                    isTarget
                      ? 'scale-125 bg-emerald-400 text-slate-950 ring-4 ring-emerald-500/50'
                      : 'bg-emerald-600 text-white hover:scale-110'
                  }`}
                >
                  {idx + 1}
                </div>
              </div>
            );
          })}

        {/* Floating Magnifying Loupe (Kính lúp phóng to khi người dùng kéo) */}
        {activePin !== null && dragPos && (
          <div
            style={{
              left: `${Math.max(65, Math.min(window.innerWidth - 65, dragPos.x))}px`,
              top: `${Math.max(80, dragPos.y - 110)}px`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute z-30 pointer-events-none flex flex-col items-center"
          >
            <div className="w-28 h-28 rounded-full border-4 border-emerald-400 overflow-hidden shadow-[0_10px_25px_rgba(0,0,0,0.8)] bg-black ring-2 ring-white/50">
              <canvas
                ref={loupeCanvasRef}
                width={112}
                height={112}
                className="w-full h-full"
              />
            </div>
            <div className="mt-1 px-2.5 py-0.5 rounded-full bg-slate-900/95 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 shadow">
              {cornerLabels[activePin]}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Tool Bar */}
      <div className="p-4 bg-slate-900/95 border-t border-slate-800 flex items-center justify-between z-50">
        <button
          disabled={isDetecting}
          onClick={redetectCorners}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 active:scale-95 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isDetecting ? 'animate-spin' : ''}`} />
          <span>{isDetecting ? 'Đang dò viền...' : 'Phát hiện lại'}</span>
        </button>

        <button
          onClick={handleSetMaxCorners}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 active:scale-95 transition"
        >
          <Maximize2 className="w-3.5 h-3.5 text-blue-400" />
          <span>Toàn khung</span>
        </button>

        <div className="text-[11px] text-slate-400 hidden sm:block">
          Chạm và kéo 4 góc để căn lề trang giấy chính xác
        </div>
      </div>
    </div>
  );
};
