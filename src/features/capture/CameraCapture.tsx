import React, { useEffect, useRef, useState } from 'react';
import {
  Camera,
  Zap,
  ZapOff,
  Image as ImageIcon,
  X,
  AlertTriangle,
  Sparkles,
  CheckCircle,
} from 'lucide-react';
import { useScanStore } from '../../store/useScanStore.ts';
import { useDocStore } from '../../store/useDocStore.ts';

export const CameraCapture: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);

  // Auto-capture states
  const [isAutoCapture, setIsAutoCapture] = useState(true);
  const [isDocumentDetected, setIsDocumentDetected] = useState(false);
  const [autoCountdown, setAutoCountdown] = useState<number | null>(null);
  const stableCounterRef = useRef<number>(0);
  const countdownIntervalRef = useRef<any>(null);

  const { setCapturedBlob } = useScanStore();
  const { setView } = useDocStore();

  // Start Camera
  useEffect(() => {
    let activeStream: MediaStream | null = null;

    async function initCamera() {
      setCameraError(null);
      try {
        const constraints: MediaStreamConstraints = {
          audio: false,
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
        };

        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        activeStream = mediaStream;
        setStream(mediaStream);

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          await videoRef.current.play();
        }

        const track = mediaStream.getVideoTracks()[0];
        const capabilities = track.getCapabilities?.() as any;
        if (capabilities && capabilities.torch) {
          setHasTorch(true);
        }
      } catch (err: unknown) {
        console.warn('Camera access denied or unavailable:', err);
        setCameraError(
          'Không thể truy cập camera. Vui lòng cấp quyền cho trình duyệt hoặc chọn ảnh từ thư viện thiết bị.'
        );
      }
    }

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach((t) => t.stop());
      }
      if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    };
  }, []);

  // Real-time auto-capture detection loop
  useEffect(() => {
    if (!isAutoCapture || isCapturing) return;

    const interval = setInterval(() => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;

      const video = videoRef.current;
      // Offscreen quick sample canvas
      const sampleW = 160;
      const sampleH = 120;
      const offCanvas = document.createElement('canvas');
      offCanvas.width = sampleW;
      offCanvas.height = sampleH;
      const ctx = offCanvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0, sampleW, sampleH);
      const data = ctx.getImageData(0, 0, sampleW, sampleH).data;

      // Sample contrast & document presence in center region
      let centerLum = 0;
      let centerCount = 0;
      for (let y = 30; y < 90; y += 4) {
        for (let x = 40; x < 120; x += 4) {
          const idx = (y * sampleW + x) * 4;
          centerLum += 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          centerCount++;
        }
      }
      const avgLum = centerCount ? centerLum / centerCount : 0;

      // Document paper brightness is typically > 110
      if (avgLum > 105 && avgLum < 245) {
        setIsDocumentDetected(true);
        stableCounterRef.current += 1;

        // When stable for 3 checks (~1.2s), trigger auto countdown
        if (stableCounterRef.current >= 3 && autoCountdown === null) {
          startCountdown();
        }
      } else {
        setIsDocumentDetected(false);
        stableCounterRef.current = 0;
        if (autoCountdown !== null) {
          clearInterval(countdownIntervalRef.current);
          setAutoCountdown(null);
        }
      }
    }, 400);

    return () => clearInterval(interval);
  }, [isAutoCapture, isCapturing, autoCountdown]);

  const startCountdown = () => {
    let count = 2;
    setAutoCountdown(count);

    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);

    countdownIntervalRef.current = setInterval(() => {
      count -= 1;
      if (count > 0) {
        setAutoCountdown(count);
      } else {
        clearInterval(countdownIntervalRef.current);
        setAutoCountdown(null);
        handleCapture();
      }
    }, 600);
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    if (track) {
      try {
        const next = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: next }],
        });
        setTorchOn(next);
      } catch (e) {
        console.warn('Could not toggle torch:', e);
      }
    }
  };

  const handleCapture = async () => {
    if (!videoRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      if (navigator.vibrate) navigator.vibrate([30, 40, 30]);

      const video = videoRef.current;
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth || 1920;
      canvas.height = video.videoHeight || 1080;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Chụp ảnh thất bại'))), 'image/jpeg', 0.95);
      });

      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
      }

      await setCapturedBlob(blob);
      setView('corner_adjust');
    } catch (err) {
      console.error('Capture error:', err);
      setIsCapturing(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsCapturing(true);
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }

    await setCapturedBlob(file);
    setView('corner_adjust');
  };

  const handleClose = () => {
    if (stream) {
      stream.getTracks().forEach((t) => t.stop());
    }
    setView('list');
  };

  return (
    <div className="fixed inset-0 z-40 bg-black flex flex-col justify-between overflow-hidden select-none">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Top action bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/85 via-black/40 to-transparent">
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center justify-center active:scale-95 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Auto capture toggle button */}
        <button
          onClick={() => {
            setIsAutoCapture(!isAutoCapture);
            setAutoCountdown(null);
          }}
          className={`px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition flex items-center gap-1.5 ${
            isAutoCapture
              ? 'bg-emerald-600/90 border-emerald-400 text-white shadow-lg shadow-emerald-500/20'
              : 'bg-black/50 border-white/20 text-slate-300'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isAutoCapture ? 'Tự động chụp: BẬT' : 'Chụp thủ công'}</span>
        </button>

        {hasTorch ? (
          <button
            onClick={toggleTorch}
            className={`w-10 h-10 rounded-full backdrop-blur-md border border-white/10 flex items-center justify-center active:scale-95 transition ${
              torchOn ? 'bg-amber-500 text-black' : 'bg-black/40 text-white'
            }`}
          >
            {torchOn ? <Zap className="w-5 h-5 fill-current" /> : <ZapOff className="w-5 h-5" />}
          </button>
        ) : (
          <div className="w-10 h-10" />
        )}
      </div>

      {/* Main Viewport */}
      <div className="relative flex-1 w-full h-full flex items-center justify-center bg-black">
        {cameraError ? (
          <div className="max-w-xs text-center p-6 bg-slate-900/90 rounded-2xl border border-slate-800 text-slate-200">
            <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
            <h3 className="text-base font-bold text-white mb-2">Quyền truy cập Camera</h3>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">{cameraError}</p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold flex items-center justify-center gap-2 shadow-lg"
            >
              <ImageIcon className="w-4 h-4" />
              Chọn ảnh từ thư viện
            </button>
          </div>
        ) : (
          <>
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover"
            />

            {/* Document Guide Reticle Overlay */}
            <div
              className={`absolute inset-8 pointer-events-none flex flex-col justify-between border-2 rounded-2xl transition-all duration-300 shadow-[0_0_0_2000px_rgba(0,0,0,0.45)] ${
                isDocumentDetected
                  ? 'border-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.5)]'
                  : 'border-white/30'
              }`}
            >
              <div className="flex justify-between p-1">
                <div
                  className={`w-7 h-7 border-t-4 border-l-4 rounded-tl-lg transition-colors ${
                    isDocumentDetected ? 'border-emerald-400' : 'border-white'
                  }`}
                />
                <div
                  className={`w-7 h-7 border-t-4 border-r-4 rounded-tr-lg transition-colors ${
                    isDocumentDetected ? 'border-emerald-400' : 'border-white'
                  }`}
                />
              </div>

              {/* Scanning laser line */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse" />

              <div className="flex justify-between p-1">
                <div
                  className={`w-7 h-7 border-b-4 border-l-4 rounded-bl-lg transition-colors ${
                    isDocumentDetected ? 'border-emerald-400' : 'border-white'
                  }`}
                />
                <div
                  className={`w-7 h-7 border-b-4 border-r-4 rounded-br-lg transition-colors ${
                    isDocumentDetected ? 'border-emerald-400' : 'border-white'
                  }`}
                />
              </div>
            </div>

            {/* Auto countdown overlay */}
            {autoCountdown !== null && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-24 h-24 rounded-full bg-emerald-500/80 backdrop-blur-md border-4 border-white flex items-center justify-center text-4xl font-black text-white shadow-2xl animate-ping">
                  {autoCountdown}
                </div>
              </div>
            )}

            <div className="absolute bottom-28 pointer-events-none text-center">
              <span className="px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium shadow-lg">
                {isAutoCapture
                  ? isDocumentDetected
                    ? 'Giữ yên máy để tự chụp...'
                    : 'Giơ máy vào tài liệu để tự nhận diện'
                  : 'Bấm nút chụp bên dưới'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-50 p-6 pb-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-around">
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-12 h-12 rounded-full bg-slate-800/80 backdrop-blur-md border border-white/10 text-white flex items-center justify-center active:scale-95 transition"
          title="Tải ảnh từ máy"
        >
          <ImageIcon className="w-6 h-6 text-slate-300" />
        </button>

        {/* Shutter Button */}
        <button
          disabled={isCapturing || !!cameraError}
          onClick={handleCapture}
          className="relative w-20 h-20 rounded-full border-4 border-white flex items-center justify-center p-1 active:scale-90 transition disabled:opacity-50"
        >
          <div className="w-full h-full rounded-full bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.6)] flex items-center justify-center">
            {isCapturing ? (
              <span className="animate-spin rounded-full h-6 w-6 border-2 border-white border-t-transparent" />
            ) : (
              <Camera className="w-8 h-8 text-white" />
            )}
          </div>
        </button>

        <div className="w-12 h-12" />
      </div>
    </div>
  );
};
