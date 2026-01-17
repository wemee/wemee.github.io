import { useState, useCallback, useRef, useEffect } from 'react';
import { SmartEditor, type AspectPreset } from '../ImageLab/SmartEditor';
import { LayoutEngine, PHOTO_SIZES, PAPER_SIZES, type PhotoSizeKey, type PaperSizeKey } from './LayoutEngine';

// ===== ID Photo Aspect Presets =====
const ID_PHOTO_PRESETS: AspectPreset[] = [
    { label: '2吋', value: 3.5 / 4.5 },
    { label: '1吋', value: 2.5 / 3.0 },
    { label: '2吋半身', value: 3.5 / 5.0 },
];

// ===== Component =====
export function IDPhotoEditor() {
    // State
    const [croppedBlob, setCroppedBlob] = useState<Blob | null>(null);
    const [photoSize, setPhotoSize] = useState<PhotoSizeKey>('2inch');
    const [paperSize, setPaperSize] = useState<PaperSizeKey>('4x6');
    const [showCutLines, setShowCutLines] = useState(true);
    const [photoCount, setPhotoCount] = useState(0);

    // For real-time preview from SmartEditor's cropper
    const [livePreviewBlob, setLivePreviewBlob] = useState<Blob | null>(null);
    const cropperRef = useRef<any>(null);

    // Get aspect for selected photo size
    const getAspectForPhotoSize = (size: PhotoSizeKey): number => {
        return PHOTO_SIZES[size].width / PHOTO_SIZES[size].height;
    };

    // When crop changes, update live preview
    const handleCropChange = useCallback(() => {
        // This will be called on crop changes - we'll update preview blob
        // For now, we rely on the export button to update
    }, []);

    // When user confirms crop (clicks "確認裁切")
    const handleCropReady = useCallback((blob: Blob) => {
        setCroppedBlob(blob);
        setLivePreviewBlob(blob);
    }, []);

    // Reset
    const handleReset = useCallback(() => {
        setCroppedBlob(null);
        setLivePreviewBlob(null);
    }, []);

    return (
        <div className="space-y-6">
            {/* Hero Section */}
            <div className="bg-accent-green/20 border border-accent-green rounded-lg p-4">
                <h5 className="font-bold text-accent-green mb-1">💰 超商印一組只要 6~10 元！</h5>
                <p className="text-base-400">
                    照相館洗一組大頭照要好幾百？自己裁好、排版，去超商選「4x6 生活照列印」就搞定！<br />
                    <strong className="text-base-50">一張 4x6 可以印 8 張 2 吋大頭照，花費不到 10 塊錢。</strong>
                </p>
            </div>

            {/* Main Editor Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left: SmartEditor (2 cols) */}
                <div className="lg:col-span-2 space-y-4">
                    {/* Photo Size Selector */}
                    <div className="flex items-center gap-4 p-3 rounded-lg bg-base-800 border border-base-600">
                        <span className="text-base-400">證件照尺寸：</span>
                        <div className="flex gap-2">
                            {Object.entries(PHOTO_SIZES).map(([key, info]) => (
                                <button
                                    key={key}
                                    onClick={() => setPhotoSize(key as PhotoSizeKey)}
                                    className={`px-3 py-1.5 rounded text-sm transition ${photoSize === key
                                        ? 'bg-accent-green text-base-50'
                                        : 'bg-base-600 text-base-400 hover:bg-base-500'
                                        }`}
                                >
                                    {info.name.split(' ')[0]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* SmartEditor */}
                    <SmartEditor
                        aspectPresets={ID_PHOTO_PRESETS}
                        defaultAspect={getAspectForPhotoSize(photoSize)}
                        showOutputSettings={false}
                        outputMode="callback"
                        onCropReady={handleCropReady}
                        accentColor="green"
                        exportButtonText="✂️ 確認裁切並生成排版"
                    />
                </div>

                {/* Right: Layout Preview (1 col) */}
                <div className="space-y-4">
                    {/* Preview Panel */}
                    <div className="rounded-lg border border-base-600 bg-base-800 overflow-hidden">
                        <div className="px-4 py-3 bg-base-600/30 border-b border-base-600 flex items-center justify-between">
                            <span className="flex items-center text-base-50">
                                📄 排版預覽
                            </span>
                            {croppedBlob && (
                                <span className="px-2 py-1 bg-accent-cyan/20 text-accent-cyan rounded text-sm">
                                    {photoCount} 張
                                </span>
                            )}
                        </div>
                        <div className="p-4">
                            {croppedBlob ? (
                                <LayoutEngine
                                    croppedImageBlob={croppedBlob}
                                    photoSize={photoSize}
                                    paperSize={paperSize}
                                    showCutLines={showCutLines}
                                    onLayoutReady={setPhotoCount}
                                />
                            ) : (
                                <div className="text-center py-12 text-base-600">
                                    <div className="text-4xl mb-2">👆</div>
                                    <p>上傳並裁切照片後</p>
                                    <p>點擊「下載圖片」產生預覽</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Settings */}
                    <div className="rounded-lg border border-base-600 bg-base-800 overflow-hidden">
                        <div className="px-4 py-3 bg-base-600/30 border-b border-base-600">
                            ⚙️ 輸出設定
                        </div>
                        <div className="p-4 space-y-3">
                            <div>
                                <label className="block text-sm text-base-400 mb-1">相紙尺寸</label>
                                <select
                                    value={paperSize}
                                    onChange={(e) => setPaperSize(e.target.value as PaperSizeKey)}
                                    className="w-full px-3 py-2 bg-base-900 border border-base-600 rounded text-base-50 focus:border-accent-green focus:outline-none"
                                >
                                    {Object.entries(PAPER_SIZES).map(([key, info]) => (
                                        <option key={key} value={key}>{info.name}</option>
                                    ))}
                                </select>
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={showCutLines}
                                    onChange={(e) => setShowCutLines(e.target.checked)}
                                    className="w-4 h-4 rounded border-base-600 bg-base-900 text-accent-green"
                                />
                                <span className="text-base-400">顯示裁剪輔助線</span>
                            </label>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default IDPhotoEditor;
