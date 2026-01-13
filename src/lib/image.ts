/**
 * 圖片處理共用函式庫
 * 提供圖片讀取、縮放、壓縮、下載等功能
 * 所有處理都在瀏覽器端完成，確保使用者隱私
 */

export type ImageFormat = 'jpeg' | 'webp' | 'png';

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
