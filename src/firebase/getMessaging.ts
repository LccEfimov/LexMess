// Safe wrapper around @react-native-firebase/messaging.
//
// Goal: never crash the app if Firebase is not installed, not linked, or misconfigured.
// Instead, return null and let the caller gracefully disable push notifications.

/* eslint-disable @typescript-eslint/no-explicit-any */

let cachedFactory: ((...args: any[]) => any) | null | undefined;

function resolveMessagingFactory(): ((...args: any[]) => any) | null {
  if (cachedFactory !== undefined) {
    return cachedFactory;
  }

  try {
    // Dynamic require to avoid crashing when the dependency isn't present.
    const mod = require('@react-native-firebase/messaging');
    const factory = mod && (mod as any).default;
    cachedFactory = typeof factory === 'function' ? factory : null;
  } catch (e) {
    cachedFactory = null;
  }

  return cachedFactory;
}

export function getMessaging(): any | null {
  const factory = resolveMessagingFactory();
  if (!factory) {
    return null;
  }
  try {
    return factory();
  } catch (e) {
    return null;
  }
}
