export const LOGO_MAX_DATA_URL_CHARS = 90_000;
export const LOGO_TARGET_PX = 96;

export const SIGNATURE_MAX_DATA_URL_CHARS = 180_000;
export const SIGNATURE_MAX_WIDTH_PX = 480;
export const SIGNATURE_MAX_HEIGHT_PX = 160;

export type EncodeLogoResult =
  | { dataUrl: string; bytes: number }
  | { error: string };

export interface EncodeImageOptions {
  fit: 'cover' | 'contain';
  targetWidth: number;
  targetHeight: number;
  maxDataUrlChars: number;
  background?: string; // CSS color; leave undefined for transparent (contain only)
  mimeType?: 'image/png' | 'image/webp';
  quality?: number;
  tooLargeMessage?: string;
}

function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read file'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected FileReader result'));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(file);
  });
}

function readBlobAsDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('Failed to read blob'));
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unexpected FileReader result'));
        return;
      }
      resolve(result);
    };
    reader.readAsDataURL(blob);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to decode image'));
    img.src = dataUrl;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), type, quality);
  });
}

export async function encodeLogo(file: File): Promise<EncodeLogoResult> {
  if (!file.type.startsWith('image/')) {
    return { error: 'Please pick an image file (PNG, JPEG, WebP, or GIF)' };
  }

  let sourceDataUrl: string;
  try {
    sourceDataUrl = await readFileAsDataURL(file);
  } catch {
    return { error: 'Could not read image file' };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(sourceDataUrl);
  } catch {
    return { error: 'Could not decode image' };
  }

  const canvas = document.createElement('canvas');
  canvas.width = LOGO_TARGET_PX;
  canvas.height = LOGO_TARGET_PX;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { error: 'Canvas not supported in this environment' };
  }

  // Cover behavior: scale source so the shorter side fills the canvas, then center-crop.
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  if (sw <= 0 || sh <= 0) {
    return { error: 'Image has no pixels' };
  }
  const scale = Math.max(LOGO_TARGET_PX / sw, LOGO_TARGET_PX / sh);
  const drawW = sw * scale;
  const drawH = sh * scale;
  const dx = (LOGO_TARGET_PX - drawW) / 2;
  const dy = (LOGO_TARGET_PX - drawH) / 2;
  ctx.clearRect(0, 0, LOGO_TARGET_PX, LOGO_TARGET_PX);
  ctx.drawImage(img, dx, dy, drawW, drawH);

  let blob = await canvasToBlob(canvas, 'image/webp', 0.85);
  if (!blob) {
    blob = await canvasToBlob(canvas, 'image/png', 0.85);
  }
  if (!blob) {
    return { error: 'Could not encode image' };
  }

  let dataUrl: string;
  try {
    dataUrl = await readBlobAsDataURL(blob);
  } catch {
    return { error: 'Could not finalize image' };
  }

  if (dataUrl.length > LOGO_MAX_DATA_URL_CHARS) {
    return { error: 'Logo too large; please pick a smaller image' };
  }

  return { dataUrl, bytes: blob.size };
}

export async function encodeImage(
  file: File,
  options: EncodeImageOptions,
): Promise<EncodeLogoResult> {
  if (!file.type.startsWith('image/')) {
    return { error: 'Please pick an image file (PNG, JPEG, WebP, or GIF)' };
  }

  let sourceDataUrl: string;
  try {
    sourceDataUrl = await readFileAsDataURL(file);
  } catch {
    return { error: 'Could not read image file' };
  }

  let img: HTMLImageElement;
  try {
    img = await loadImage(sourceDataUrl);
  } catch {
    return { error: 'Could not decode image' };
  }

  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  if (sw <= 0 || sh <= 0) {
    return { error: 'Image has no pixels' };
  }

  let canvasW = options.targetWidth;
  let canvasH = options.targetHeight;
  let drawW: number;
  let drawH: number;
  let dx: number;
  let dy: number;

  if (options.fit === 'cover') {
    const scale = Math.max(options.targetWidth / sw, options.targetHeight / sh);
    drawW = sw * scale;
    drawH = sh * scale;
    dx = (options.targetWidth - drawW) / 2;
    dy = (options.targetHeight - drawH) / 2;
  } else {
    const scale = Math.min(options.targetWidth / sw, options.targetHeight / sh, 1);
    drawW = Math.max(1, Math.round(sw * scale));
    drawH = Math.max(1, Math.round(sh * scale));
    canvasW = drawW;
    canvasH = drawH;
    dx = 0;
    dy = 0;
  }

  const canvas = document.createElement('canvas');
  canvas.width = canvasW;
  canvas.height = canvasH;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { error: 'Canvas not supported in this environment' };
  }

  if (options.background) {
    ctx.fillStyle = options.background;
    ctx.fillRect(0, 0, canvasW, canvasH);
  } else {
    ctx.clearRect(0, 0, canvasW, canvasH);
  }
  ctx.drawImage(img, dx, dy, drawW, drawH);

  const mime = options.mimeType ?? 'image/png';
  const quality = options.quality ?? 0.92;
  let blob = await canvasToBlob(canvas, mime, quality);
  if (!blob && mime !== 'image/png') {
    blob = await canvasToBlob(canvas, 'image/png', quality);
  }
  if (!blob) {
    return { error: 'Could not encode image' };
  }

  let dataUrl: string;
  try {
    dataUrl = await readBlobAsDataURL(blob);
  } catch {
    return { error: 'Could not finalize image' };
  }

  if (dataUrl.length > options.maxDataUrlChars) {
    return { error: options.tooLargeMessage ?? 'Image too large; please pick a smaller one' };
  }

  return { dataUrl, bytes: blob.size };
}

export function encodeSignature(file: File): Promise<EncodeLogoResult> {
  return encodeImage(file, {
    fit: 'contain',
    targetWidth: SIGNATURE_MAX_WIDTH_PX,
    targetHeight: SIGNATURE_MAX_HEIGHT_PX,
    maxDataUrlChars: SIGNATURE_MAX_DATA_URL_CHARS,
    mimeType: 'image/png',
    tooLargeMessage: 'Signature too large; try a smaller or simpler image',
  });
}

export function encodeOwnerLogo(file: File): Promise<EncodeLogoResult> {
  return encodeImage(file, {
    fit: 'contain',
    targetWidth: 256,
    targetHeight: 256,
    maxDataUrlChars: 140_000,
    mimeType: 'image/png',
    tooLargeMessage: 'Logo too large; please pick a smaller image',
  });
}
