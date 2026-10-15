import React, { useState, useEffect } from 'react';
import { Lock, Delete, ShieldCheck, KeyRound, Fingerprint } from 'lucide-react';
import { security } from '../../lib/security.ts';

interface PinLockModalProps {
  mode: 'unlock' | 'set' | 'disable';
  isOpen: boolean;
  onSuccess: () => void;
  onCancel?: () => void;
}

export const PinLockModal: React.FC<PinLockModalProps> = ({
  mode,
  isOpen,
  onSuccess,
  onCancel,
}) => {
  const [pin, setPin] = useState<string>('');
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [step, setStep] = useState<'enter' | 'confirm'>('enter');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPin('');
      setConfirmPin('');
      setStep('enter');
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleKeyPress = async (num: string) => {
    setErrorMsg(null);
    if (pin.length < 4) {
      const nextPin = pin + num;
      setPin(nextPin);

      if (nextPin.length === 4) {
        if (mode === 'unlock') {
          const isValid = await security.verifyPin(nextPin);
          if (isValid) {
            security.setLocked(false);
            onSuccess();
          } else {
            setErrorMsg('Mã PIN không đúng, vui lòng thử lại');
            setTimeout(() => setPin(''), 400);
          }
        } else if (mode === 'set') {
          if (step === 'enter') {
            setConfirmPin(nextPin);
            setPin('');
            setStep('confirm');
          } else {
            if (nextPin === confirmPin) {
              await security.setPin(nextPin);
              onSuccess();
            } else {
              setErrorMsg('Mã PIN xác nhận không khớp, hãy tạo lại');
              setStep('enter');
              setPin('');
              setConfirmPin('');
            }
          }
        } else if (mode === 'disable') {
          const isValid = await security.verifyPin(nextPin);
          if (isValid) {
            security.removePin();
            onSuccess();
          } else {
            setErrorMsg('Mã PIN không đúng');
            setTimeout(() => setPin(''), 400);
          }
        }
      }
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950 p-4 select-none animate-in fade-in duration-200">
      <div className="w-full max-w-xs flex flex-col items-center text-center">
        {/* Icon & Title */}
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center mb-4 text-emerald-400">
          <Lock className="w-8 h-8" />
        </div>

        <h2 className="text-base font-bold text-white mb-1">
          {mode === 'unlock'
            ? 'Nhập mã PIN mở khóa'
            : mode === 'set'
            ? step === 'enter'
              ? 'Tạo mã PIN 4 số'
              : 'Xác nhận lại mã PIN'
            : 'Xác nhận mã PIN để gỡ khóa'}
        </h2>

        <p className="text-xs text-slate-400 mb-6">
          {mode === 'unlock'
            ? 'Bảo vệ quyền riêng tư tài liệu của bạn'
            : 'Mã PIN bảo mật riêng trực tiếp trên máy của bạn'}
        </p>

        {/* 4 Circles Display */}
        <div className="flex gap-4 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all ${
                i < pin.length
                  ? 'bg-emerald-400 border-emerald-400 scale-110 shadow-[0_0_10px_#34d399]'
                  : 'border-slate-600 bg-transparent'
              }`}
            />
          ))}
        </div>

        {errorMsg && (
          <div className="text-xs text-rose-400 font-medium mb-4 animate-shake">
            {errorMsg}
          </div>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-4 w-full max-w-[260px] mb-6">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
            <button
              key={digit}
              onClick={() => handleKeyPress(digit)}
              className="h-16 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white text-xl font-bold active:scale-90 transition flex items-center justify-center shadow"
            >
              {digit}
            </button>
          ))}
          <div className="flex items-center justify-center">
            {onCancel && (
              <button
                onClick={onCancel}
                className="text-xs text-slate-400 hover:text-white"
              >
                Hủy
              </button>
            )}
          </div>
          <button
            onClick={() => handleKeyPress('0')}
            className="h-16 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-white text-xl font-bold active:scale-90 transition flex items-center justify-center shadow"
          >
            0
          </button>
          <button
            onClick={handleDelete}
            className="h-16 rounded-full bg-slate-900 border border-slate-800 hover:bg-slate-800 text-slate-400 hover:text-white active:scale-90 transition flex items-center justify-center"
          >
            <Delete className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
};
