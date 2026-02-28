import { writable, derived, get } from 'svelte/store';

export type PwaPlatform = 'ios' | 'android' | 'desktop';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const _nativePrompt = writable<BeforeInstallPromptEvent | null>(null);
const _isInstalled = writable(false);

export const nativePrompt = derived(_nativePrompt, $p => $p);
export const isInstalled = derived(_isInstalled, $i => $i);

export const platform: PwaPlatform = (() => {
  const ua = navigator.userAgent;
  if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
  if (/android/i.test(ua)) return 'android';
  return 'desktop';
})();

export const installInstructions: Record<PwaPlatform, string> = {
  ios: 'Tap the Share icon → "Add to Home Screen"',
  android: 'Tap the browser menu → "Add to Home Screen"',
  desktop: 'Click the install icon in the address bar',
};

if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(display-mode: standalone)');
  if (
    mq.matches ||
    (navigator as any).standalone === true ||
    localStorage.getItem('pwaInstalled') === 'true'
  ) {
    _isInstalled.set(true);
  }
  mq.addEventListener('change', (e) => {
    if (e.matches) _isInstalled.set(true);
  });

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    _nativePrompt.set(e as BeforeInstallPromptEvent);
  });

  window.addEventListener('appinstalled', () => {
    localStorage.setItem('pwaInstalled', 'true');
    _isInstalled.set(true);
    _nativePrompt.set(null);
  });
}

export async function triggerInstall(): Promise<void> {
  const prompt = get(_nativePrompt);
  if (!prompt) return;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  if (outcome === 'accepted') {
    localStorage.setItem('pwaInstalled', 'true');
    _isInstalled.set(true);
    _nativePrompt.set(null);
  }
}
