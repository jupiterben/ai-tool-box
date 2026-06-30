export interface ReferenceImage {
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface WebviewInputPayload {
  content: string;
  referenceImage?: ReferenceImage | null;
}

export const REFERENCE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const REFERENCE_IMAGE_ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,image/gif';
