import React, { useEffect, useRef, useState } from 'react';
import { Camera, Zap, ZapOff, Image as ImageIcon, X, AlertTriangle } from 'lucide-react';
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

        // Check if torch/flash is supported
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
    };
  }, []);

  // Toggle Torch
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

  // Capture Image from Video Stream
  const handleCapture = async () => {
    if (!videoRef.current || isCapturing) return;

    try {
      setIsCapturing(true);
      // Subtle vibration
      if (navigator.vibrate) navigator.vibrate(40);

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

      // Stop camera track before moving
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

  // Pick from file gallery
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
      {/* Hidden file input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Top action bar */}
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <button
          onClick={handleClose}
          className="w-10 h-10 rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white flex items-center justify-center active:scale-95 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="text-xs font-semibold tracking-wider uppercase text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-3 py-1 rounded-full backdrop-blur-md">
          Chế độ quét tự động
        </div>

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
            <div className="absolute inset-8 pointer-events-none flex flex-col justify-between border-2 border-emerald-400/40 rounded-2xl shadow-[0_0_0_2000px_rgba(0,0,0,0.45)]">
              {/* Corner Brackets */}
              <div className="flex justify-between p-1">
                <div className="w-6 h-6 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                <div className="w-6 h-6 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
              </div>

              {/* Scanning laser line animation */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-pulse" />

              <div className="flex justify-between p-1">
                <div className="w-6 h-6 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                <div className="w-6 h-6 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
              </div>
            </div>

            <div className="absolute bottom-28 pointer-events-none text-center">
              <span className="px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white text-xs font-medium shadow-lg">
                Đặt tài liệu phẳng trong khung để tự nhận diện
              </span>
            </div>
          </>
        )}
      </div>

      {/* Bottom Controls Bar */}
      <div className="absolute bottom-0 left-0 right-0 z-50 p-6 pb-8 bg-gradient-to-t from-black/90 via-black/60 to-transparent flex items-center justify-around">
        {/* Gallery button */}
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

        {/* Balance spacer */}
        <div className="w-12 h-12" />
      </div>
    </div>
  );
};
