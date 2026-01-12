export type EncryptLccParams = {
  roomId: string;
  peerId: string;
  passphrase: string;
  plaintextBase64: string;
  messageType: 'text' | 'file' | string;
};

export type EncryptLccResult = {
  sessionId: string;
  messageBase64: string;
  messageType: 'text' | 'file' | string;
};

export type DecryptLccParams = {
  passphrase: string;
  sessionId?: string;
  messageBase64: string;
  messageType?: 'text' | 'file' | string;
};

export type DecryptLccResult = string; // plaintextBase64

export type EmbedContainerInPngParams = {
  containerBase64: string;
  containerType?: string;
};

export type EmbedContainerInPngResult = string; // pngBase64

export type ExtractContainerFromPngParams = {
  pngBase64: string;
};

export type ExtractContainerFromPngResult = string; // containerBase64
