import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, CheckCircle2, AlertCircle, CloudUpload } from 'lucide-react';
import { useSyncStore } from '../store/useSyncStore.ts';
import { useAuthStore } from '../store/useAuthStore.ts';

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  const { status, pendingCount, triggerSync } = useSyncStore();
  const { isAuthenticated } = useAuthStore();

  const handleSyncClick = () => {
    if (isOnline) {
      triggerSync(isAuthenticated);
    }
  };

  if (!isOnline) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-medium">
        <WifiOff className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        <span>Ngoại tuyến ({pendingCount})</span>
      </div>
    );
  }

  if (status === 'syncing') {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-medium animate-pulse">
        <RefreshCw className="w-3.5 h-3.5 text-blue-400 shrink-0 animate-spin" />
        <span>Đang đồng bộ...</span>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <button
        onClick={handleSyncClick}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-medium hover:bg-rose-500/25 transition cursor-pointer"
        title="Bấm để thử đồng bộ lại"
      >
        <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
        <span>Thử lại đồng bộ</span>
      </button>
    );
  }

  if (pendingCount > 0 && !isAuthenticated) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-slate-300 text-xs font-medium">
        <CloudUpload className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        <span>Lưu cục bộ ({pendingCount})</span>
      </div>
    );
  }

  return (
    <div
      onClick={handleSyncClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium cursor-pointer hover:bg-emerald-500/20 transition"
      title="Dữ liệu đã được đồng bộ"
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      <span>Đã đồng bộ</span>
    </div>
  );
};
