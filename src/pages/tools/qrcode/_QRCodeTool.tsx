import { useState, useRef, useCallback } from 'react';
import { Tabs } from '@/components/ui/Tabs';
import { cardStyles, buttonStyles, inputStyles, alertStyles } from '@/components/ui';

declare global {
    interface Window {
        jsQR: (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;
        qrcode: (typeNumber: number, errorLevel: string) => {
            addData: (data: string) => void;
            make: () => void;
            getModuleCount: () => number;
            isDark: (row: number, col: number) => boolean;
        };
    }
}

// Decode Panel Component
function DecodePanel() {
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [result, setResult] = useState<{ data: string; isUrl: boolean } | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = useCallback((file: File) => {
        const url = URL.createObjectURL(file);
        setPreviewUrl(url);
        setError(null);
        setResult(null);

        const img = new Image();
        img.onload = () => {
            const canvas = canvasRef.current;
            if (!canvas) return;

            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            ctx.drawImage(img, 0, 0);
            const imgData = ctx.getImageData(0, 0, img.width, img.height);

            if (window.jsQR) {
                const code = window.jsQR(imgData.data, imgData.width, imgData.height);
                if (code) {
                    setResult({
                        data: code.data,
                        isUrl: /^https?:\/\//i.test(code.data)
                    });
                } else {
                    setError('未偵測到 QR Code，請確認圖片清晰');
                }
            }

            URL.revokeObjectURL(url);
        };
        img.src = url;
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file?.type.startsWith('image/')) {
            handleFile(file);
        }
    }, [handleFile]);

    const copyToClipboard = useCallback((text: string) => {
        navigator.clipboard.writeText(text);
    }, []);

    const clear = useCallback(() => {
        setPreviewUrl(null);
        setResult(null);
        setError(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }, []);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Upload Card */}
            <div className={cardStyles.container}>
                <div className={`${cardStyles.header} flex items-center`}>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent-blue text-base-50 text-sm font-bold mr-2">1</span>
                    上傳圖片
                </div>
                <div className={cardStyles.body}>
                    {!previewUrl ? (
                        <div
                            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition ${isDragging ? 'border-accent-green bg-accent-green/10' : 'border-accent-blue hover:bg-accent-blue/10'
                                }`}
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={handleDrop}
                        >
                            <div className="text-5xl mb-2">📁</div>
                            <p className="text-base-400 mb-1">拖拉圖片到這裡，或點擊選擇</p>
                            <p className="text-base-600 text-sm">支援 JPG、PNG、截圖</p>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                            />
                        </div>
                    ) : (
                        <div className="space-y-3">
                            <img src={previewUrl} alt="預覽" className="max-w-full rounded" />
                            <button className={buttonStyles.secondary + ' w-full'} onClick={clear}>
                                清除重選
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Result Card */}
            <div className={cardStyles.container}>
                <div className={`${cardStyles.header} flex items-center`}>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent-blue text-base-50 text-sm font-bold mr-2">2</span>
                    解析結果
                </div>
                <div className={`${cardStyles.body} min-h-[100px] flex flex-col justify-center`}>
                    {error && (
                        <p className="text-accent-yellow">⚠️ {error}</p>
                    )}
                    {result && (
                        <div className="space-y-3">
                            <div className="p-3 bg-black/20 rounded font-mono text-base-50 break-all">
                                {result.data}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    className={buttonStyles.secondary}
                                    onClick={() => copyToClipboard(result.data)}
                                >
                                    📋 複製
                                </button>
                                {result.isUrl && (
                                    <a
                                        href={result.data}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={buttonStyles.success}
                                    >
                                        🔗 開啟連結
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                    {!error && !result && (
                        <p className="text-base-600">尚未解析任何 QR Code</p>
                    )}
                </div>
            </div>

            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}

// Encode Panel Component
function EncodePanel() {
    const [text, setText] = useState('');
    const [size, setSize] = useState('6');
    const [errorLevel, setErrorLevel] = useState('M');
    const [qrCanvas, setQrCanvas] = useState<HTMLCanvasElement | null>(null);
    const [error, setError] = useState<string | null>(null);

    const generate = useCallback(() => {
        if (!text.trim()) {
            setError('請輸入內容');
            setQrCanvas(null);
            return;
        }

        try {
            const qr = window.qrcode(0, errorLevel);
            qr.addData(text);
            qr.make();

            const moduleCount = qr.getModuleCount();
            const cellSize = parseInt(size);
            const canvasSize = moduleCount * cellSize;

            const canvas = document.createElement('canvas');
            canvas.width = canvasSize;
            canvas.height = canvasSize;
            const ctx = canvas.getContext('2d')!;

            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvasSize, canvasSize);

            ctx.fillStyle = '#000000';
            for (let row = 0; row < moduleCount; row++) {
                for (let col = 0; col < moduleCount; col++) {
                    if (qr.isDark(row, col)) {
                        ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize);
                    }
                }
            }

            setQrCanvas(canvas);
            setError(null);
        } catch (e) {
            setError('產生失敗：內容可能太長');
            setQrCanvas(null);
        }
    }, [text, size, errorLevel]);

    const download = useCallback(() => {
        if (!qrCanvas) return;
        qrCanvas.toBlob((blob) => {
            if (!blob) return;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'qrcode.png';
            a.click();
            URL.revokeObjectURL(url);
        }, 'image/png');
    }, [qrCanvas]);

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Input Card */}
            <div className={cardStyles.container}>
                <div className={`${cardStyles.header} flex items-center`}>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent-blue text-base-50 text-sm font-bold mr-2">1</span>
                    輸入內容
                </div>
                <div className={cardStyles.body + ' space-y-4'}>
                    <div>
                        <label className="block text-sm text-base-400 mb-1">文字或網址</label>
                        <textarea
                            value={text}
                            onChange={(e) => setText(e.target.value)}
                            className={inputStyles.base}
                            rows={3}
                            placeholder="輸入要轉換的文字或網址..."
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-sm text-base-400 mb-1">大小</label>
                            <select value={size} onChange={(e) => setSize(e.target.value)} className={inputStyles.base}>
                                <option value="4">小 (132px)</option>
                                <option value="6">中 (198px)</option>
                                <option value="8">大 (264px)</option>
                                <option value="10">特大 (330px)</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-base-400 mb-1">容錯等級</label>
                            <select value={errorLevel} onChange={(e) => setErrorLevel(e.target.value)} className={inputStyles.base}>
                                <option value="L">L (7%)</option>
                                <option value="M">M (15%)</option>
                                <option value="Q">Q (25%)</option>
                                <option value="H">H (30%)</option>
                            </select>
                        </div>
                    </div>
                    <button className={buttonStyles.primary + ' w-full'} onClick={generate}>
                        ✨ 產生 QR Code
                    </button>
                </div>
            </div>

            {/* Preview Card */}
            <div className={cardStyles.container}>
                <div className={`${cardStyles.header} flex items-center`}>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent-blue text-base-50 text-sm font-bold mr-2">2</span>
                    QR Code 預覽
                </div>
                <div className={`${cardStyles.body} text-center min-h-[150px] flex flex-col items-center justify-center`}>
                    {error && <p className="text-accent-yellow">{error}</p>}
                    {qrCanvas && (
                        <div className="space-y-4">
                            <img
                                src={qrCanvas.toDataURL()}
                                alt="QR Code"
                                className="border-4 border-white rounded shadow-lg mx-auto"
                            />
                            <button className={buttonStyles.success} onClick={download}>
                                ⬇️ 下載 PNG
                            </button>
                        </div>
                    )}
                    {!error && !qrCanvas && (
                        <p className="text-base-600">輸入內容後點擊產生</p>
                    )}
                </div>
            </div>
        </div>
    );
}

// Main Component
export default function QRCodeTool() {
    const tabs = [
        { label: '解碼 QR Code', icon: '📷', content: <DecodePanel /> },
        { label: '產生 QR Code', icon: '✨', content: <EncodePanel /> },
    ];

    return <Tabs tabs={tabs} />;
}
