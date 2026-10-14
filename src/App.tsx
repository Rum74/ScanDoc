/**
 * ScanDoc - Mobile-First PWA Document Scanner
 */
import React, { useEffect } from 'react';
import { useDocStore } from './store/useDocStore.ts';
import { useAuthStore } from './store/useAuthStore.ts';
import { useSyncStore } from './store/useSyncStore.ts';
import { DocumentList } from './features/documents/DocumentList.tsx';
import { DocumentDetail } from './features/documents/DocumentDetail.tsx';
import { CameraCapture } from './features/capture/CameraCapture.tsx';
import { CornerAdjust } from './features/capture/CornerAdjust.tsx';
import { PageEditor } from './features/edit/PageEditor.tsx';

export default function App() {
  const { currentView } = useDocStore();
  const { checkAuth, isAuthenticated } = useAuthStore();
  const { triggerSync, checkPendingCount } = useSyncStore();

  // Initialize session & background sync on mount
  useEffect(() => {
    async function init() {
      await checkAuth();
      await checkPendingCount();
    }
    init();
  }, [checkAuth, checkPendingCount]);

  // When online comes back or isAuthenticated changes, trigger sync
  useEffect(() => {
    const handleOnline = () => {
      triggerSync(isAuthenticated);
    };

    window.addEventListener('online', handleOnline);

    if (navigator.onLine && isAuthenticated) {
      triggerSync(isAuthenticated);
    }

    return () => {
      window.removeEventListener('online', handleOnline);
    };
  }, [isAuthenticated, triggerSync]);

  return (
    <div className="h-full w-full flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {currentView === 'list' && <DocumentList />}
      {currentView === 'detail' && <DocumentDetail />}
      {currentView === 'capture' && <CameraCapture />}
      {currentView === 'corner_adjust' && <CornerAdjust />}
      {currentView === 'filter_edit' && <PageEditor />}
    </div>
  );
}
