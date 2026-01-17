import { useRef, useState, useCallback, useEffect } from 'react';
import Cropper from 'react-cropper';
import type CropperType from 'cropperjs';
import './iphone-cropper.css';

// ===== Types =====
interface ImageData {
    file: File;
    url: string;
    width: number;
    height: number;
}

interface CropData {
    width: number;
    height: number;
    x: number;
    y: number;
}

export interface AspectPreset {
    label: string;
    value: number;
}

export interface SmartEditorProps {
    // Aspect ratio presets (customizable per use case)
    aspectPresets?: AspectPreset[];
    defaultAspect?: number;

    // UI visibility toggles
    showOutputSettings?: boolean;  // Size/Format/Quality panel (Image Lab)

    // Output mode
    outputMode?: 'download' | 'callback';
    onCropReady?: (blob: Blob, dimensions: { width: number; height: number }) => void;

    // Theming
    accentColor?: 'green' | 'blue' | 'cyan';

    // Button customization
    exportButtonText?: string;

    // Legacy props (for backward compat)
    onCropChange?: (data: CropData) => void;
}

// ===== Default Presets =====
const DEFAULT_ASPECT_PRESETS: AspectPreset[] = [
    { label: '自由', value: NaN },
    { label: '1:1', value: 1 },
    { label: '16:9', value: 16 / 9 },
    { label: '4:3', value: 4 / 3 },
];

// ===== Utility Functions =====
function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

// ===== Component =====
export function SmartEditor({
    aspectPresets = DEFAULT_ASPECT_PRESETS,
    defaultAspect = NaN,
    showOutputSettings = true,
    outputMode = 'download',
    onCropReady,
    accentColor = 'blue',
    exportButtonText = '⬇️ 下載圖片',
    onCropChange,
}: SmartEditorProps) {
    const cropperRef = useRef<HTMLImageElement & { cropper?: CropperType }>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [image, setImage] = useState<ImageData | null>(null);
    const [cropData, setCropData] = useState<CropData | null>(null);
    const [outputDimensions, setOutputDimensions] = useState<{ width: number; height: number } | null>(null);
    const [estimatedSize, setEstimatedSize] = useState<string>('--');
    const [isExporting, setIsExporting] = useState(false);
    const [currentAspectRatio, setCurrentAspectRatio] = useState<number>(defaultAspect);
    const [sizeMode, setSizeMode] = useState<'original' | 'half' | 'custom'>('original');
    const [customWidth, setCustomWidth] = useState<number>(800);
    const [outputFormat, setOutputFormat] = useState<'auto' | 'jpeg' | 'webp' | 'png'>('auto');
    const [outputQuality, setOutputQuality] = useState<number>(80);

    // Accent color class mapping
    const accentClasses = {
        green: { bg: 'bg-accent-green', hover: 'hover:bg-accent-green/80', border: 'border-accent-green', text: 'text-accent-green' },
        blue: { bg: 'bg-accent-blue', hover: 'hover:bg-accent-blue/80', border: 'border-accent-blue', text: 'text-accent-blue' },
        cyan: { bg: 'bg-accent-cyan', hover: 'hover:bg-accent-cyan/80', border: 'border-accent-cyan', text: 'text-accent-cyan' },
    };
    const accent = accentClasses[accentColor];

    // ===== File Upload =====
    const handleFileSelect = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) return;

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            setImage({
                file,
                url,
                width: img.naturalWidth,
                height: img.naturalHeight,
            });
        };
        img.src = url;
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) handleFileSelect(file);
    }, [handleFileSelect]);

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
    }, []);

    // ===== Cropper Events =====
    const handleCrop = useCallback(() => {
        const cropper = cropperRef.current?.cropper;
        if (!cropper) return;

        const data = cropper.getData();
        const newCropData: CropData = {
            width: Math.round(data.width),
            height: Math.round(data.height),
            x: Math.round(data.x),
            y: Math.round(data.y),
        };
        setCropData(newCropData);
        onCropChange?.(newCropData);

        // Update output dimensions based on size mode
        updateOutputDimensions(newCropData);
    }, [onCropChange, sizeMode, customWidth]);

    // Update output dimensions when size mode or custom width changes
    const updateOutputDimensions = useCallback((data: CropData | null) => {
        if (!data) return;

        let dims: { width: number; height: number };
        switch (sizeMode) {
            case 'half':
                dims = {
                    width: Math.round(data.width * 0.5),
                    height: Math.round(data.height * 0.5),
                };
                break;
            case 'custom':
                const ratio = data.height / data.width;
                dims = {
                    width: customWidth,
                    height: Math.round(customWidth * ratio),
                };
                break;
            default:
                dims = { width: data.width, height: data.height };
        }
        setOutputDimensions(dims);
    }, [sizeMode, customWidth]);

    useEffect(() => {
        updateOutputDimensions(cropData);
    }, [sizeMode, customWidth, cropData, updateOutputDimensions]);

    // ===== Auto-Zoom on Crop End (DISABLED - to be discussed) =====
    const handleCropEnd = useCallback(() => {
        // Auto-zoom disabled for now - will discuss better UX approach
        // const cropper = cropperRef.current?.cropper;
        // if (!cropper) return;
        // ... auto-zoom logic removed
    }, []);

    // ===== Estimate Output Size =====
    useEffect(() => {
        if (!cropperRef.current?.cropper || !outputDimensions) return;

        const timer = setTimeout(async () => {
            try {
                const cropper = cropperRef.current?.cropper;
                if (!cropper) return;

                const canvas = cropper.getCroppedCanvas({
                    width: outputDimensions.width,
                    height: outputDimensions.height,
                });

                if (!canvas) return;

                let finalFormat = outputFormat === 'auto'
                    ? (image?.file.type === 'image/jpeg' ? 'jpeg' : 'webp')
                    : outputFormat;

                const blob = await new Promise<Blob | null>((resolve) => {
                    canvas.toBlob(resolve, `image/${finalFormat}`, outputQuality / 100);
                });

                if (blob) {
                    setEstimatedSize(formatFileSize(blob.size));
                }
            } catch (error) {
                console.error('Error estimating size:', error);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [outputDimensions, outputFormat, outputQuality, image]);

    // ===== Export =====
    const handleExport = useCallback(async () => {
        const cropper = cropperRef.current?.cropper;
        if (!cropper || !outputDimensions || !image) return;

        setIsExporting(true);

        try {
            const canvas = cropper.getCroppedCanvas({
                width: outputDimensions.width,
                height: outputDimensions.height,
            });

            let finalFormat = outputFormat === 'auto'
                ? (image.file.type === 'image/jpeg' ? 'jpeg' : 'webp')
                : outputFormat;

            // Handle JPEG background (no transparency)
            let targetCanvas = canvas;
            if (finalFormat === 'jpeg') {
                targetCanvas = document.createElement('canvas');
                targetCanvas.width = canvas.width;
                targetCanvas.height = canvas.height;
                const ctx = targetCanvas.getContext('2d')!;
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(canvas, 0, 0);
            }

            const blob = await new Promise<Blob | null>((resolve) => {
                targetCanvas.toBlob(resolve, `image/${finalFormat}`, outputQuality / 100);
            });

            if (blob) {
                if (outputMode === 'callback' && onCropReady) {
                    // Callback mode: pass blob to parent
                    onCropReady(blob, outputDimensions);
                } else {
                    // Download mode: trigger file download
                    const ext = finalFormat === 'jpeg' ? 'jpg' : finalFormat;
                    const originalName = image.file.name.replace(/\.[^/.]+$/, '');
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${originalName}_processed.${ext}`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                }
            }
        } catch (error) {
            console.error('Export error:', error);
            alert('處理圖片時發生錯誤');
        } finally {
            setIsExporting(false);
        }
    }, [outputDimensions, outputFormat, outputQuality, image, outputMode, onCropReady]);

    // ===== Reset =====
    const handleReset = useCallback(() => {
        if (image?.url) {
            URL.revokeObjectURL(image.url);
        }
        setImage(null);
        setCropData(null);
        setOutputDimensions(null);
        setEstimatedSize('--');
        setCurrentAspectRatio(NaN);
        setSizeMode('original');
        setCustomWidth(800);
        setOutputFormat('auto');
        setOutputQuality(80);
    }, [image]);

    // ===== Aspect Ratio Controls =====
    const handleAspectChange = (ratio: number) => {
        setCurrentAspectRatio(ratio);
        cropperRef.current?.cropper?.setAspectRatio(ratio);
    };

    // ===== Zoom Controls =====
    const zoomIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const zoomAtCropCenter = (delta: number) => {
        const cropper = cropperRef.current?.cropper;
        if (!cropper) return;

        const cropBoxData = cropper.getCropBoxData();
        const centerX = cropBoxData.left + cropBoxData.width / 2;
        const centerY = cropBoxData.top + cropBoxData.height / 2;

        // Use zoomTo with pivot point at crop box center
        const imageData = cropper.getImageData();
        const currentRatio = imageData.width / imageData.naturalWidth;
        const newRatio = currentRatio * (1 + delta);

        cropper.zoomTo(newRatio, { x: centerX, y: centerY });
    };

    const startContinuousZoom = (delta: number) => {
        // Immediate first zoom
        zoomAtCropCenter(delta);
        // Then continuous zoom while held
        zoomIntervalRef.current = setInterval(() => {
            zoomAtCropCenter(delta);
        }, 100);
    };

    const stopContinuousZoom = () => {
        if (zoomIntervalRef.current) {
            clearInterval(zoomIntervalRef.current);
            zoomIntervalRef.current = null;
        }
    };

    const handleZoomReset = () => {
        // Full reset: restore original crop box and zoom
        cropperRef.current?.cropper?.reset();
    };

    // ===== Render =====
    if (!image) {
        return (
            <div
                ref={containerRef}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onClick={() => fileInputRef.current?.click()}
                className="upload-area border-2 border-dashed border-accent-blue rounded-xl p-12 text-center cursor-pointer hover:bg-accent-blue/10 transition"
            >
                <div className="text-6xl mb-4">📁</div>
                <p className="text-base-400 mb-2">拖拉圖片到這裡，或點擊選擇檔案</p>
                <p className="text-base-600 text-sm">支援 JPG、PNG、WebP、GIF</p>
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                    }}
                />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left: Cropper + Action Buttons */}
            <div className="lg:col-span-2 space-y-4">
                <div className="rounded-lg border border-base-600 bg-base-800 overflow-hidden">
                    <div className="px-4 py-3 bg-base-600/30 border-b border-base-600 flex items-center justify-between">
                        <span className="text-base-50">📷 編輯圖片</span>
                        <div className="flex items-center gap-3">
                            {/* Zoom Group */}
                            <div className="flex">
                                <button
                                    type="button"
                                    onMouseDown={() => startContinuousZoom(-0.1)}
                                    onMouseUp={stopContinuousZoom}
                                    onMouseLeave={stopContinuousZoom}
                                    onTouchStart={() => startContinuousZoom(-0.1)}
                                    onTouchEnd={stopContinuousZoom}
                                    className="px-2.5 py-1 border border-base-400 rounded-l bg-base-600 text-base-50 hover:bg-base-500 transition select-none"
                                    title="縮小"
                                >
                                    ➖
                                </button>
                                <button
                                    type="button"
                                    onMouseDown={() => startContinuousZoom(0.1)}
                                    onMouseUp={stopContinuousZoom}
                                    onMouseLeave={stopContinuousZoom}
                                    onTouchStart={() => startContinuousZoom(0.1)}
                                    onTouchEnd={stopContinuousZoom}
                                    className="px-2.5 py-1 border-y border-r border-base-400 rounded-r bg-base-600 text-base-50 hover:bg-base-500 transition select-none"
                                    title="放大"
                                >
                                    ➕
                                </button>
                            </div>

                            {/* Reset Button */}
                            <button
                                type="button"
                                onClick={handleZoomReset}
                                className="px-2.5 py-1 border border-base-400 rounded bg-base-600 text-base-50 hover:bg-base-500 transition"
                                title="重設縮放與裁切"
                            >
                                ↺
                            </button>

                            {/* TODO: Rotate Button - disabled for now, needs better UX
                            <button
                                type="button"
                                onClick={() => cropperRef.current?.cropper?.rotate(90)}
                                className="px-2.5 py-1 border border-base-500 rounded bg-base-700 text-base-100 hover:bg-base-500 transition"
                                title="順時針旋轉 90°"
                            >
                                ↻
                            </button>
                            */}

                            <span className="px-2 py-1 bg-base-600 rounded text-sm text-base-400">
                                {image.width} × {image.height}
                            </span>
                        </div>
                    </div>

                    {/* iPhone-style cropper container */}
                    <div className="cropper-iphone-wrapper bg-black relative">
                        <Cropper
                            ref={cropperRef}
                            src={image.url}
                            style={{ height: 450, width: '100%' }}
                            initialAspectRatio={currentAspectRatio}
                            aspectRatio={currentAspectRatio}
                            viewMode={1}
                            dragMode="move"
                            autoCropArea={1}
                            restore={false}
                            guides={false}
                            center={false}
                            highlight={false}
                            cropBoxMovable={true}
                            cropBoxResizable={true}
                            toggleDragModeOnDblclick={false}
                            crop={handleCrop}
                            cropend={handleCropEnd}
                            className="iphone-cropper"
                        />
                    </div>

                    <div className="px-4 py-3 border-t border-base-600 flex items-center justify-between">
                        <small className="text-base-600">💡 拖曳四角等比裁切，拖曳邊緣單向裁切</small>
                        <span className="px-2 py-1 bg-accent-cyan/20 text-accent-cyan rounded text-sm">
                            {outputDimensions ? `${outputDimensions.width} × ${outputDimensions.height} px` : '-- × -- px'}
                        </span>
                    </div>
                </div>

                {/* Action Buttons - grouped with editor */}
                <div className="flex gap-3">
                    <button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="flex-1 px-4 py-3 rounded-lg bg-accent-green hover:bg-accent-green/80 text-base-50 font-bold text-lg transition disabled:opacity-50"
                    >
                        {isExporting ? '⏳ 處理中...' : exportButtonText}
                    </button>
                    <button
                        onClick={handleReset}
                        className="px-4 py-3 rounded-lg border border-base-600 text-base-400 hover:bg-base-600 transition"
                    >
                        🔄 重選
                    </button>
                </div>
            </div>

            {/* Right: Settings Panel */}
            <div className="space-y-4">
                {/* Step 1: Aspect Ratio */}
                <div className="rounded-lg border border-base-600 bg-base-800 overflow-hidden">
                    <div className="px-4 py-3 bg-base-600/30 border-b border-base-600 flex items-center">
                        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${accent.bg} text-base-50 text-sm font-bold mr-2`}>
                            1
                        </span>
                        裁切比例
                    </div>
                    <div className="p-4">
                        <div className="grid grid-cols-4 gap-2">
                            {aspectPresets.map((ar) => (
                                <button
                                    key={ar.label}
                                    type="button"
                                    onClick={() => handleAspectChange(ar.value)}
                                    className={`px-3 py-2 rounded border text-sm transition ${(isNaN(currentAspectRatio) && isNaN(ar.value)) || currentAspectRatio === ar.value
                                        ? `${accent.border} ${accent.bg} text-base-50`
                                        : `border-base-600 text-base-400 hover:${accent.border}`
                                        }`}
                                >
                                    {ar.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Step 2 & 3: Output Settings (only for Image Lab mode) */}
                {showOutputSettings && (
                    <>
                        {/* Step 2: Output Size */}
                        <div className="rounded-lg border border-base-600 bg-base-800 overflow-hidden">
                            <div className="px-4 py-3 bg-base-600/30 border-b border-base-600 flex items-center">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${accent.bg} text-base-50 text-sm font-bold mr-2`}>
                                    2
                                </span>
                                輸出大小
                            </div>
                            <div className="p-4 space-y-2">
                                {(['original', 'half', 'custom'] as const).map((mode) => (
                                    <label key={mode} className="block cursor-pointer">
                                        <input
                                            type="radio"
                                            name="sizeMode"
                                            value={mode}
                                            checked={sizeMode === mode}
                                            onChange={() => setSizeMode(mode)}
                                            className="hidden"
                                        />
                                        <span
                                            className={`size-option-content flex flex-col p-3 border-2 rounded-lg transition ${sizeMode === mode
                                                ? `${accent.border} ${accent.bg}/10`
                                                : `border-base-600 hover:${accent.border}`
                                                }`}
                                        >
                                            <span className="font-medium text-base-50">
                                                {mode === 'original' && '原始大小'}
                                                {mode === 'half' && '縮小 50%'}
                                                {mode === 'custom' && '指定寬度'}
                                            </span>
                                            <span className="text-sm text-base-600">
                                                {mode === 'original' && '維持裁切後的尺寸'}
                                                {mode === 'half' && '適合一般分享'}
                                                {mode === 'custom' && '自動計算高度'}
                                            </span>
                                        </span>
                                    </label>
                                ))}
                                {sizeMode === 'custom' && (
                                    <div className="mt-3 flex">
                                        <input
                                            type="number"
                                            value={customWidth}
                                            onChange={(e) => setCustomWidth(parseInt(e.target.value) || 800)}
                                            className={`flex-1 px-3 py-2 bg-base-900 border border-base-600 rounded-l text-base-50 focus:${accent.border} focus:outline-none`}
                                            placeholder="800"
                                        />
                                        <span className="px-3 py-2 bg-base-600 border border-base-600 rounded-r text-base-400">
                                            px
                                        </span>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Step 3: Format & Quality */}
                        <div className="rounded-lg border border-base-600 bg-base-800 overflow-hidden">
                            <div className="px-4 py-3 bg-base-600/30 border-b border-base-600 flex items-center">
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full ${accent.bg} text-base-50 text-sm font-bold mr-2`}>
                                    3
                                </span>
                                格式與品質
                            </div>
                            <div className="p-4 space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <select
                                        value={outputFormat}
                                        onChange={(e) => setOutputFormat(e.target.value as 'auto' | 'jpeg' | 'webp' | 'png')}
                                        className={`px-3 py-2 bg-base-900 border border-base-600 rounded text-base-50 focus:${accent.border} focus:outline-none`}
                                    >
                                        <option value="auto">自動</option>
                                        <option value="jpeg">JPG</option>
                                        <option value="webp">WebP</option>
                                        <option value="png">PNG</option>
                                    </select>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min="10"
                                            max="100"
                                            value={outputQuality}
                                            onChange={(e) => setOutputQuality(parseInt(e.target.value))}
                                            className="flex-1"
                                        />
                                        <span className="text-sm text-base-400 w-10 text-right">{outputQuality}%</span>
                                    </div>
                                </div>
                                <div className="flex justify-center items-center gap-4 p-3 bg-black/20 rounded text-sm">
                                    <span className="text-base-400">
                                        原始: <strong className="text-base-50">{formatFileSize(image.file.size)}</strong>
                                    </span>
                                    <span className="text-base-600">→</span>
                                    <span className="text-base-400">
                                        預估: <strong className="text-accent-green">{estimatedSize}</strong>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div >
    );
}

export default SmartEditor;
