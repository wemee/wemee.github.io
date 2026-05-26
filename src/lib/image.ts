/**
 * 圖片處理共用函式庫
 * 提供圖片讀取、縮放、壓縮、下載等功能
 * 所有處理都在瀏覽器端完成，確保使用者隱私
 */

export type ImageFormat = 'jpeg' | 'webp' | 'png';

/**
 * 偵測檔案是否為瀏覽器無法原生解碼的格式（需要 JS/WASM 解碼器）
 * - HEIC/HEIF：只有 Safari 原生支援，需要 libheif (heic-to)
 * - TIFF：所有瀏覽器都不原生支援，需要 UTIF
 *
 * iOS Safari 對 HEIC 的 `file.type` 偶爾回傳空字串，所以同時用副檔名 fallback
 */
function detectNonNativeFormat(file: File): 'heic' | 'tiff' | null {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();

  if (type === 'image/heic' || type === 'image/heif' || name.endsWith('.heic') || name.endsWith('.heif')) {
    return 'heic';
  }
  if (type === 'image/tiff' || type === 'image/x-tiff' || name.endsWith('.tif') || name.endsWith('.tiff')) {
    return 'tiff';
  }
  return null;
}

/**
 * 把 HEIC/TIFF 等瀏覽器不原生支援的格式轉成原生可讀的 File。
 * 其他格式（JPEG/PNG/WebP/GIF/AVIF/BMP/ICO）原樣回傳。
 *
 * - HEIC → JPEG（quality 0.92，符合人像照片的取捨）
 * - TIFF → PNG（無損；只解第一頁，multi-page TIFF 後續頁面會忽略）
 *
 * 解碼器使用動態 import，未碰到對應格式時不會進入主 bundle。
 */
export async function decodeFile(file: File): Promise<File> {
  const kind = detectNonNativeFormat(file);
  if (!kind) return file;

  if (kind === 'heic') {
    const { heicTo } = await import('heic-to');
    const blob = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 });
    const newName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], newName || 'image.jpg', { type: 'image/jpeg' });
  }

  // TIFF — UTIF 為 CommonJS，default export 即 UTIF 物件
  const UTIF = (await import('utif')).default;
  const buf = await file.arrayBuffer();
  const ifds = UTIF.decode(buf);
  if (!ifds.length) {
    throw new Error('TIFF 檔案沒有可解析的頁面');
  }
  const page = ifds[0];
  UTIF.decodeImage(buf, page);
  const rgba = UTIF.toRGBA8(page);
  const canvas = document.createElement('canvas');
  canvas.width = page.width;
  canvas.height = page.height;
  const ctx = canvas.getContext('2d')!;
  const imageData = new ImageData(
    new Uint8ClampedArray(rgba.buffer, rgba.byteOffset, rgba.byteLength),
    page.width,
    page.height
  );
  ctx.putImageData(imageData, 0, 0);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('TIFF 轉 PNG 失敗'))), 'image/png')
  );
  const newName = file.name.replace(/\.(tif|tiff)$/i, '.png');
  return new File([blob], newName || 'image.png', { type: 'image/png' });
}

/**
 * 判斷是否需要顯示「解碼中…」的提示（HEIC/TIFF 通常 1–3 秒）
 */
export function needsDecoding(file: File): boolean {
  return detectNonNativeFormat(file) !== null;
}

/**
 * 讀取檔案並轉換為 HTMLImageElement
 * 會自動處理 EXIF 方向問題 (現代瀏覽器已原生支援)
 */
export function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('無法讀取圖片'));
    };
    
    img.src = url;
  });
}

/**
 * 建立 Canvas 並繪製圖片
 */
export function createCanvas(
  source: HTMLImageElement | HTMLCanvasElement,
  width?: number,
  height?: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  
  // 如果沒指定尺寸，使用原始尺寸
  const targetWidth = width ?? (source instanceof HTMLImageElement ? source.naturalWidth : source.width);
  const targetHeight = height ?? (source instanceof HTMLImageElement ? source.naturalHeight : source.height);
  
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  ctx.drawImage(source, 0, 0, targetWidth, targetHeight);
  
  return canvas;
}

/**
 * 計算等比例縮放後的尺寸
 */
export function calculateAspectRatio(
  originalWidth: number,
  originalHeight: number,
  targetWidth?: number,
  targetHeight?: number
): { width: number; height: number } {
  const ratio = originalWidth / originalHeight;
  
  if (targetWidth && !targetHeight) {
    return { width: targetWidth, height: Math.round(targetWidth / ratio) };
  }
  
  if (targetHeight && !targetWidth) {
    return { width: Math.round(targetHeight * ratio), height: targetHeight };
  }
  
  if (targetWidth && targetHeight) {
    return { width: targetWidth, height: targetHeight };
  }
  
  return { width: originalWidth, height: originalHeight };
}

/**
 * 縮放圖片
 */
export function resize(
  source: HTMLImageElement | HTMLCanvasElement,
  targetWidth: number,
  targetHeight: number
): HTMLCanvasElement {
  return createCanvas(source, targetWidth, targetHeight);
}

/**
 * 壓縮並轉換格式
 * PNG 轉 JPG 時會自動填白底 (處理透明區域)
 */
export function compress(
  canvas: HTMLCanvasElement,
  format: ImageFormat,
  quality: number = 0.8
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    // PNG 轉 JPG 需要處理透明背景
    let targetCanvas = canvas;
    
    if (format === 'jpeg') {
      // 建立新 Canvas 並填白底
      const ctx = canvas.getContext('2d')!;
      const newCanvas = document.createElement('canvas');
      const newCtx = newCanvas.getContext('2d')!;
      
      newCanvas.width = canvas.width;
      newCanvas.height = canvas.height;
      
      // 先填白底
      newCtx.fillStyle = '#FFFFFF';
      newCtx.fillRect(0, 0, newCanvas.width, newCanvas.height);
      
      // 再畫上原圖
      newCtx.drawImage(canvas, 0, 0);
      targetCanvas = newCanvas;
    }
    
    const mimeType = `image/${format}`;
    
    targetCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('無法壓縮圖片'));
        }
      },
      mimeType,
      quality
    );
  });
}

/**
 * 觸發瀏覽器下載
 */
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * 根據原始檔案智慧判斷最佳輸出格式
 * - JPG -> JPG (保持照片特性)
 * - PNG/GIF/WebP -> WebP (體積小且支援透明)
 */
export function getSmartFormat(originalFile: File): ImageFormat {
  const type = originalFile.type.toLowerCase();
  
  if (type === 'image/jpeg' || type === 'image/jpg') {
    return 'jpeg';
  }
  
  // PNG, GIF, WebP 都輸出為 WebP (體積最小且支援透明)
  return 'webp';
}

/**
 * 格式化檔案大小為人類可讀格式
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

/**
 * 取得檔案的副檔名
 */
export function getExtension(format: ImageFormat): string {
  return format === 'jpeg' ? 'jpg' : format;
}
