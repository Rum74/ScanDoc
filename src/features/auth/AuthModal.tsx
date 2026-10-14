import React, { useState } from 'react';
import { X, LogIn, UserPlus, ShieldCheck, HardDrive, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../../store/useAuthStore.ts';
import { useSyncStore } from '../../store/useSyncStore.ts';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const { login, register, isLoading, user, isAuthenticated, logout } = useAuthStore();
  const { triggerSync } = useSyncStore();

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await register(email, password, name);
      }
      // After login or register, trigger immediate background sync
      triggerSync(true);
      onClose();
    } catch (err: unknown) {
      setLocalError(err instanceof Error ? err.message : 'Thao tác không thành công');
    }
  };

  const handleLogout = async () => {
    await logout();
    onClose();
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 MB';
    const mb = bytes / (1024 * 1024);
    if (mb < 1024) return `${mb.toFixed(1)} MB`;
    return `${(mb / 1024).toFixed(2)} GB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-900 border border-slate-800 p-6 shadow-2xl text-slate-100 animate-in fade-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            {isAuthenticated ? 'Tài khoản của bạn' : 'Tài khoản & Đồng bộ'}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {isAuthenticated && user ? (
          <div className="py-4 space-y-4">
            <div className="bg-slate-800/60 rounded-xl p-4 border border-slate-700/50">
              <div className="text-xs text-slate-400">Đang đăng nhập với</div>
              <div className="text-base font-semibold text-white mt-0.5">{user.email}</div>
              {user.name && <div className="text-sm text-emerald-400">{user.name}</div>}

              <div className="mt-4 pt-3 border-t border-slate-700/50">
                <div className="flex items-center justify-between text-xs text-slate-300 mb-1.5">
                  <span className="flex items-center gap-1.5">
                    <HardDrive className="w-3.5 h-3.5 text-blue-400" />
                    Dung lượng đã dùng
                  </span>
                  <span className="font-semibold text-white">
                    {formatBytes(user.usedBytes)} / {formatBytes(user.maxBytes || 1073741824)}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, Math.max(3, (user.usedBytes / (user.maxBytes || 1073741824)) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="text-xs text-slate-400 leading-relaxed bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-emerald-200">
              ✓ Toàn bộ ảnh gốc và tài liệu được mã hóa an toàn và tự động đồng bộ hai chiều giữa các thiết bị của bạn.
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleLogout}
                className="w-full py-2.5 rounded-xl border border-rose-500/40 text-rose-400 hover:bg-rose-500/10 font-semibold text-sm transition"
              >
                Đăng xuất
              </button>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-semibold text-sm transition"
              >
                Đóng
              </button>
            </div>
          </div>
        ) : (
          <div className="py-4">
            {/* Mode switch tabs */}
            <div className="flex rounded-xl bg-slate-800/80 p-1 mb-5">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setLocalError(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  mode === 'login' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setLocalError(null);
                }}
                className={`flex-1 py-2 text-xs font-semibold rounded-lg transition ${
                  mode === 'register' ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                Đăng ký mới
              </button>
            </div>

            {localError && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                <span>{localError}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {mode === 'register' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Họ tên / Biệt danh</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Nguyễn Văn A"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Mật khẩu</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-white text-sm focus:outline-none focus:border-emerald-500 transition"
                />
              </div>

              <div className="text-[11px] text-slate-400 bg-slate-800/40 border border-slate-700/40 rounded-xl p-3 leading-relaxed">
                💡 <span className="text-slate-200 font-medium">Chế độ Ngoại tuyến:</span> Bạn có thể tiếp tục sử dụng bình thường mà không cần đăng nhập. Khi tạo tài khoản, toàn bộ tài liệu đã quét sẽ tự động đồng bộ lên đám mây.
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full mt-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-semibold text-sm shadow-lg shadow-emerald-600/20 active:scale-98 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <span className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                ) : mode === 'login' ? (
                  <>
                    <LogIn className="w-4 h-4" />
                    Đăng nhập & Đồng bộ
                  </>
                ) : (
                  <>
                    <UserPlus className="w-4 h-4" />
                    Tạo tài khoản (1GB miễn phí)
                  </>
                )}
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
