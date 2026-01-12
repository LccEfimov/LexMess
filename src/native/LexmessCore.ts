import {NativeModules, Platform} from 'react-native';

const LINKING_ERROR =
  `LexmessCore native module is not linked properly. ` +
  `Make sure:\n` +
  Platform.select({
    ios: "- you ran 'pod install' in the ios/ directory\n",
    android: '- you rebuilt the app after installing the package\n',
    default: '',
  });

export type EncryptParams = {
  dbName?: string;
  passphrase: string;
  roomId: string;
  peerId: string;
  plaintextBase64: string;
  messageType?: number;
};

export type EncryptResult = {
  sessionId: string;
  messageBase64: string;
  messageType?: number;
};

export type DecryptParams = {
  dbName?: string;
  passphrase: string;
  roomId: string;
  peerId: string;
  messageBase64: string;
  messageType?: number;
};

export type EmbedContainerParams = {
  containerBase64: string;
};

export type ExtractContainerParams = {
  pngBase64: string;
};

export interface LexmessCoreModule {
  encryptLcc(params: EncryptParams): Promise<EncryptResult>;
  decryptLcc(params: DecryptParams): Promise<string>; // returns plaintextBase64

  // PNG stego (LSB-in-pixels, Android). The params are kept minimal for RN convenience.
  embedContainerInPng(params: EmbedContainerParams): Promise<string>; // returns pngBase64
  extractContainerFromPng(params: ExtractContainerParams): Promise<string>; // returns containerBase64

  // Legacy names (older code). We keep them as optional aliases.
  embedContainer?: (containerPngBase64: string, payloadBase64: string) => Promise<string>;
  extractContainer?: (containerPngBase64: string) => Promise<string>;
}

const nm: any = NativeModules;
const nativeModule = nm?.LexmessCore;

function createUnlinkedStub(): LexmessCoreModule {
  return {
    encryptLcc: async (_params: EncryptParams) => {
      throw new Error(LINKING_ERROR);
    },
    decryptLcc: async (_params: DecryptParams) => {
      throw new Error(LINKING_ERROR);
    },
    embedContainerInPng: async (_params: EmbedContainerParams) => {
      throw new Error(LINKING_ERROR);
    },
    extractContainerFromPng: async (_params: ExtractContainerParams) => {
      throw new Error(LINKING_ERROR);
    },
  };
}

if (!nativeModule) {
  // Do not crash on startup. Feature calls will fail with a clear error.
  // eslint-disable-next-line no-console
  console.warn(LINKING_ERROR);
}

const impl: LexmessCoreModule = (nativeModule as LexmessCoreModule) || createUnlinkedStub();

export default impl;
