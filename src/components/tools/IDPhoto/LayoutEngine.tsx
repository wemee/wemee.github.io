import { useRef, useEffect, useCallback } from 'react';

// ===== Constants =====
const PHOTO_SIZES = {
    '2inch': { width: 3.5, height: 4.5, name: '2吋 (身分證/護照)' },
    '1inch': { width: 2.5, height: 3.0, name: '1吋 (駕照/執照)' },
    '2inch-half': { width: 3.5, height: 5.0, name: '2吋半身 (履歷)' },
} as const;

const PAPER_SIZES = {
    '4x6': { width: 15.2, height: 10.2, name: '4×6 (超商沖印)' },
    'a4': { width: 29.7, height: 21.0, name: 'A4 (家用印表機)' },
} as const;

const DPI = 300;
const CM_TO_INCH = 0.393701;

function cmToPixels(cm: number): number {
    return Math.round(cm * CM_TO_INCH * DPI);
}

// ===== Types =====
export type PhotoSizeKey = keyof typeof PHOTO_SIZES;
export type PaperSizeKey = keyof typeof PAPER_SIZES;

interface LayoutEngineProps {
    croppedImageBlob: Blob | null;
    photoSize: PhotoSizeKey;
    paperSize: PaperSizeKey;
    showCutLines: boolean;
    onLayoutReady?: (photoCount: number) => void;
    onDownload?: () => void;
}

interface LayoutInfo {
    cols: number;
    rows: number;
    total: number;
    photoWidth: number;
    photoHeight: number;
    paperWidth: number;
    paperHeight: number;
    gapPixels: number;
}

// ===== Component =====
export function LayoutEngine({
    croppedImageBlob,
    photoSize,
    paperSize,
    showCutLines,
    onLayoutReady,
    onDownload,
}: LayoutEngineProps) {
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const croppedImageRef = useRef<HTMLImageElement | null>(null);

    // Calculate layout
    const calculateLayout = useCallback((): LayoutInfo => {
        const photo = PHOTO_SIZES[photoSize];
        const paper = PAPER_SIZES[paperSize];
        const gap = 0.2; // cm

        const cols = Math.floor(paper.width / (photo.width + gap));
        const rows = Math.floor(paper.height / (photo.height + gap));

        return {
            cols,
            rows,
            total: cols * rows,
            photoWidth: cmToPixels(photo.width),
            photoHeight: cmToPixels(photo.height),
            paperWidth: cmToPixels(paper.width),
            paperHeight: cmToPixels(paper.height),
            gapPixels: cmToPixels(gap),
        };
    }, [photoSize, paperSize]);

    // Draw preview
    const drawPreview = useCallback(() => {
        const canvas = previewCanvasRef.current;
        const img = croppedImageRef.current;
        if (!canvas || !img) return;

        const layout = calculateLayout();
        onLayoutReady?.(layout.total);

        const scale = 0.3; // Preview scale
        canvas.width = layout.paperWidth * scale;
        canvas.height = layout.paperHeight * scale;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate centering
        const totalPhotosWidth = layout.cols * layout.photoWidth + (layout.cols - 1) * layout.gapPixels;
        const totalPhotosHeight = layout.rows * layout.photoHeight + (layout.rows - 1) * layout.gapPixels;
        const startX = (layout.paperWidth - totalPhotosWidth) / 2;
        const startY = (layout.paperHeight - totalPhotosHeight) / 2;

        // Draw photos
        for (let row = 0; row < layout.rows; row++) {
            for (let col = 0; col < layout.cols; col++) {
                const x = startX + col * (layout.photoWidth + layout.gapPixels);
                const y = startY + row * (layout.photoHeight + layout.gapPixels);

                ctx.drawImage(
                    img,
                    x * scale,
                    y * scale,
                    layout.photoWidth * scale,
                    layout.photoHeight * scale
                );

                if (showCutLines) {
                    ctx.strokeStyle = '#CCCCCC';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(
                        x * scale,
                        y * scale,
                        layout.photoWidth * scale,
                        layout.photoHeight * scale
                    );
                }
            }
        }
    }, [calculateLayout, showCutLines, onLayoutReady]);

    // Load cropped image when blob changes
    useEffect(() => {
        if (!croppedImageBlob) {
            croppedImageRef.current = null;
            return;
        }

        const url = URL.createObjectURL(croppedImageBlob);
        const img = new Image();
        img.onload = () => {
            croppedImageRef.current = img;
            drawPreview();
        };
        img.src = url;

        return () => URL.revokeObjectURL(url);
    }, [croppedImageBlob, drawPreview]);

    // Redraw on settings change
    useEffect(() => {
        if (croppedImageRef.current) {
            drawPreview();
        }
    }, [photoSize, paperSize, showCutLines, drawPreview]);

    // Download high-res version
    const handleDownload = useCallback(() => {
        const img = croppedImageRef.current;
        if (!img) return;

        const layout = calculateLayout();

        // Create full resolution canvas
        const canvas = document.createElement('canvas');
        canvas.width = layout.paperWidth;
        canvas.height = layout.paperHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // White background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Calculate centering
        const totalPhotosWidth = layout.cols * layout.photoWidth + (layout.cols - 1) * layout.gapPixels;
        const totalPhotosHeight = layout.rows * layout.photoHeight + (layout.rows - 1) * layout.gapPixels;
        const startX = (layout.paperWidth - totalPhotosWidth) / 2;
        const startY = (layout.paperHeight - totalPhotosHeight) / 2;

        // Draw photos at full resolution
        for (let row = 0; row < layout.rows; row++) {
            for (let col = 0; col < layout.cols; col++) {
                const x = startX + col * (layout.photoWidth + layout.gapPixels);
                const y = startY + row * (layout.photoHeight + layout.gapPixels);

                ctx.drawImage(img, x, y, layout.photoWidth, layout.photoHeight);

                if (showCutLines) {
                    ctx.strokeStyle = '#CCCCCC';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(x, y, layout.photoWidth, layout.photoHeight);
                }
            }
        }

        // Download
        canvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `id_photo_${paperSize}.jpg`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            onDownload?.();
        }, 'image/jpeg', 0.95);
    }, [calculateLayout, showCutLines, paperSize, onDownload]);

    return (
        <div className="space-y-4">
            {/* Preview Canvas */}
            <div className="text-center">
                <canvas
                    ref={previewCanvasRef}
                    className="border border-base-600 rounded bg-white mx-auto"
                    style={{ maxWidth: '100%', height: 'auto' }}
                />
                <p className="text-sm text-base-600 mt-2">
                    預覽為縮小顯示，實際列印為 300 DPI 高解析
                </p>
            </div>

            {/* Download Button */}
            <button
                onClick={handleDownload}
                disabled={!croppedImageBlob}
                className="w-full px-4 py-3 rounded-lg bg-accent-green hover:bg-accent-green/80 text-base-50 font-bold text-lg transition disabled:opacity-50"
            >
                ⬇️ 下載排版圖片
            </button>
        </div>
    );
}

// Export constants for external use
export { PHOTO_SIZES, PAPER_SIZES };
