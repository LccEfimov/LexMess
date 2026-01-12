 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/src/storage/passphraseStorage.ts b/src/storage/passphraseStorage.ts
index 8c8f0066cb028c48a8e3077ee3e21b4a0ee52cfa..40f89b8c7912105e3e3e3fa3de42d1d9f0c3d589 100644
--- a/src/storage/passphraseStorage.ts
+++ b/src/storage/passphraseStorage.ts
@@ -1,32 +1,57 @@
 import AsyncStorage from '@react-native-async-storage/async-storage';
+import * as Keychain from 'react-native-keychain';
 
 const STORAGE_KEY = 'lexmess_device_passphrase_v1';
+const SERVICE = 'lexmess_device_passphrase_v1';
 
 /**
  * Получить (или сгенерировать) уникальную passphrase для шифрования локальной БД и контейнеров.
  */
 export async function getDevicePassphrase() {
   try {
-    const existing = await AsyncStorage.getItem(STORAGE_KEY);
-    if (existing && existing.length > 0) {
-      return existing;
+    const res = await Keychain.getGenericPassword({service: SERVICE});
+    if (res && typeof res.password === 'string' && res.password.length > 0) {
+      return res.password;
     }
   } catch (e) {
     // eslint-disable-next-line no-console
-    console.warn('[passphraseStorage] getDevicePassphrase read failed', e);
+    console.warn('[passphraseStorage] getDevicePassphrase keychain read failed', e);
+  }
+
+  try {
+    const legacy = await AsyncStorage.getItem(STORAGE_KEY);
+    if (legacy && legacy.length > 0) {
+      try {
+        await Keychain.setGenericPassword('passphrase', legacy, {service: SERVICE});
+      } catch (e) {
+        // eslint-disable-next-line no-console
+        console.warn('[passphraseStorage] getDevicePassphrase keychain migrate failed', e);
+        return legacy;
+      }
+      try {
+        await AsyncStorage.removeItem(STORAGE_KEY);
+      } catch (e) {
+        // eslint-disable-next-line no-console
+        console.warn('[passphraseStorage] getDevicePassphrase legacy cleanup failed', e);
+      }
+      return legacy;
+    }
+  } catch (e) {
+    // eslint-disable-next-line no-console
+    console.warn('[passphraseStorage] getDevicePassphrase legacy read failed', e);
   }
 
   // Минимально случайная строка; при желании можно заменить на криптостойкий генератор.
   const random = Array.from({length: 64})
     .map(() => Math.floor(Math.random() * 16).toString(16))
     .join('');
 
   try {
-    await AsyncStorage.setItem(STORAGE_KEY, random);
+    await Keychain.setGenericPassword('passphrase', random, {service: SERVICE});
+    return random;
   } catch (e) {
     // eslint-disable-next-line no-console
-    console.warn('[passphraseStorage] getDevicePassphrase write failed', e);
+    console.warn('[passphraseStorage] getDevicePassphrase keychain write failed', e);
+    throw new Error('Failed to persist device passphrase in Keychain');
   }
-
-  return random;
 }
 
EOF
)