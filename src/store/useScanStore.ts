import { create } from 'zustand';
import { Point, FilterType } from '../lib/db.ts';
import { detectCorners, processPageImage } from '../lib/image-processing.ts';

interface ScanState {
  targetDocumentId: string | null;
  editingPageId: string | null;
  originalBlob: Blob | null;
  corners: [Point, Point, Point, Point];
  activeCornerIndex: number | null;
  loupePos: { x: number; y: number } | null;
  rotation: number;
  filter: FilterType;
  brightness: number;
  contrast: number;
  sharpen: number;
  denoise: number;
  processedPreviewBlob: Blob | null;
  thumbnailBlob: Blob | null;
  isDetecting: boolean;
  isProcessing: boolean;

  setTargetDocumentId: (id: string | null) => void;
  setEditingPageId: (id: string | null) => void;
  initCapture: (documentId?: string) => void;
  setCapturedBlob: (blob: Blob) => Promise<void>;
  setCorners: (corners: [Point, Point, Point, Point]) => void;
  updateCorner: (index: number, point: Point) => void;
  setActiveCornerIndex: (idx: number | null) => void;
  setLoupePos: (pos: { x: number; y: number } | null) => void;
  redetectCorners: () => Promise<void>;

  setFilter: (filter: FilterType) => void;
  setBrightness: (brightness: number) => void;
  setContrast: (contrast: number) => void;
  setSharpen: (sharpen: number) => void;
  setDenoise: (denoise: number) => void;
  rotateClockwise: () => void;
  rotateCounterClockwise: () => void;

  generateProcessedPreview: () => Promise<void>;
  reset: () => void;
}

const defaultCorners: [Point, Point, Point, Point] = [
  { x: 0.08, y: 0.08 },
  { x: 0.92, y: 0.08 },
  { x: 0.92, y: 0.92 },
  { x: 0.08, y: 0.92 },
];

export const useScanStore = create<ScanState>((set, get) => ({
  targetDocumentId: null,
  editingPageId: null,
  originalBlob: null,
  corners: [...defaultCorners],
  activeCornerIndex: null,
  loupePos: null,
  rotation: 0,
  filter: 'enhanced',
  brightness: 0,
  contrast: 0,
  sharpen: 0,
  denoise: 0,
  processedPreviewBlob: null,
  thumbnailBlob: null,
  isDetecting: false,
  isProcessing: false,

  setTargetDocumentId: (id) => set({ targetDocumentId: id }),
  setEditingPageId: (id) => set({ editingPageId: id }),

  initCapture: (documentId) => {
    set({
      targetDocumentId: documentId || null,
      editingPageId: null,
      originalBlob: null,
      corners: [...defaultCorners],
      activeCornerIndex: null,
      loupePos: null,
      rotation: 0,
      filter: 'enhanced',
      brightness: 0,
      contrast: 0,
      processedPreviewBlob: null,
      thumbnailBlob: null,
      isDetecting: false,
      isProcessing: false,
    });
  },

  setCapturedBlob: async (blob: Blob) => {
    set({ originalBlob: blob, isDetecting: true });
    try {
      const corners = await detectCorners(blob);
      set({ corners, isDetecting: false });
    } catch (err) {
      console.warn('Corner detection error, using fallback margins:', err);
      set({ corners: [...defaultCorners], isDetecting: false });
    }
  },

  setCorners: (corners) => set({ corners }),

  updateCorner: (index, point) => {
    const { corners } = get();
    const next = [...corners] as [Point, Point, Point, Point];
    next[index] = {
      x: Math.max(0, Math.min(1, point.x)),
      y: Math.max(0, Math.min(1, point.y)),
    };
    set({ corners: next });
  },

  setActiveCornerIndex: (idx) => set({ activeCornerIndex: idx }),
  setLoupePos: (pos) => set({ loupePos: pos }),

  redetectCorners: async () => {
    const { originalBlob } = get();
    if (!originalBlob) return;
    try {
      set({ isDetecting: true });
      const corners = await detectCorners(originalBlob);
      set({ corners, isDetecting: false });
    } catch {
      set({ corners: [...defaultCorners], isDetecting: false });
    }
  },

  setFilter: (filter) => set({ filter }),
  setBrightness: (brightness) => set({ brightness }),
  setContrast: (contrast) => set({ contrast }),
  setSharpen: (sharpen) => set({ sharpen }),
  setDenoise: (denoise) => set({ denoise }),

  rotateClockwise: () => {
    const current = get().rotation;
    set({ rotation: (current + 90) % 360 });
  },

  rotateCounterClockwise: () => {
    const current = get().rotation;
    set({ rotation: (current - 90 + 360) % 360 });
  },

  generateProcessedPreview: async () => {
    const { originalBlob, corners, rotation, filter, brightness, contrast, sharpen, denoise } = get();
    if (!originalBlob) return;

    try {
      set({ isProcessing: true });
      const { processedBlob, thumbnailBlob } = await processPageImage(
        originalBlob,
        corners,
        rotation,
        filter,
        brightness,
        contrast,
        sharpen,
        denoise
      );
      set({ processedPreviewBlob: processedBlob, thumbnailBlob, isProcessing: false });
    } catch (err) {
      console.error('Error generating processed preview:', err);
      set({ isProcessing: false });
    }
  },

  reset: () => {
    set({
      targetDocumentId: null,
      editingPageId: null,
      originalBlob: null,
      corners: [...defaultCorners],
      activeCornerIndex: null,
      loupePos: null,
      rotation: 0,
      filter: 'enhanced',
      brightness: 0,
      contrast: 0,
      sharpen: 0,
      denoise: 0,
      processedPreviewBlob: null,
      thumbnailBlob: null,
      isDetecting: false,
      isProcessing: false,
    });
  },
}));
