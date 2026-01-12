import {AppState} from 'react-native';

export type AppStateStatus = 'active' | 'background' | 'inactive' | string;

let current: AppStateStatus = (AppState.currentState as any) || 'active';
const listeners = new Set<(s: AppStateStatus) => void>();

let subscribed = false;

function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  try {
    AppState.addEventListener('change', (next: any) => {
      current = (next as any) || current;
      for (const fn of Array.from(listeners)) {
        try {
          fn(current);
        } catch {}
      }
    });
  } catch (e) {
    // Older RN: no-op if event API differs.
  }
}

export function isAppActive(): boolean {
  return String(current) === 'active';
}

export function onAppStateChange(fn: (s: AppStateStatus) => void): () => void {
  ensureSubscribed();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
