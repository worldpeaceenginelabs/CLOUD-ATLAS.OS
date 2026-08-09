import { openUrl } from '@tauri-apps/plugin-opener';

export async function openExternal(url: string): Promise<void> {
  const value = String(url).trim();
  if (!value) return;

  try {
    await openUrl(value);
    return;
  } catch {
    // Non-Tauri web build (or blocked by permissions): fall back to browser behavior.
    window.open(value, '_blank', 'noopener,noreferrer');
  }
}

