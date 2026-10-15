/**
 * ScanDoc Security & Privacy Module
 * Quản lý mã PIN bảo mật, mã hóa tại chỗ và bảo vệ ứng dụng
 */

const PIN_STORAGE_KEY = 'scandoc_user_pin_hash';
const LOCK_STATE_KEY = 'scandoc_is_app_locked';

// Simple salt & hash for PIN
async function hashPin(pin: string): Promise<string> {
  const enc = new TextEncoder();
  const data = enc.encode('scandoc_salt_2026_' + pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const security = {
  isPinSet(): boolean {
    return !!localStorage.getItem(PIN_STORAGE_KEY);
  },

  async setPin(pin: string): Promise<void> {
    const hashed = await hashPin(pin);
    localStorage.setItem(PIN_STORAGE_KEY, hashed);
    localStorage.setItem(LOCK_STATE_KEY, 'false');
  },

  async verifyPin(pin: string): Promise<boolean> {
    const stored = localStorage.getItem(PIN_STORAGE_KEY);
    if (!stored) return true; // No PIN configured
    const hashed = await hashPin(pin);
    return stored === hashed;
  },

  removePin(): void {
    localStorage.removeItem(PIN_STORAGE_KEY);
    localStorage.removeItem(LOCK_STATE_KEY);
  },

  isAppLocked(): boolean {
    if (!this.isPinSet()) return false;
    return localStorage.getItem(LOCK_STATE_KEY) === 'true';
  },

  setLocked(locked: boolean): void {
    localStorage.setItem(LOCK_STATE_KEY, locked ? 'true' : 'false');
  },

  async isBiometricAvailable(): Promise<boolean> {
    if (window.PublicKeyCredential && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      try {
        return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      } catch {
        return false;
      }
    }
    return false;
  },
};
