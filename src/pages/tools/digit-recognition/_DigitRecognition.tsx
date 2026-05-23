import { useState, useEffect, useRef, useCallback } from 'react';

// MNIST digit recognizer using a TF.js CNN model loaded from /models/mnist/.
//
// Refactored out of an inline <script> in index.astro to gain (a) tf.tidy
// tensor lifecycle management — the previous version leaked intermediate
// tensors from the tf.grad closure on every prediction; (b) typed state and
// React-managed DOM updates instead of innerHTML / element id lookups;
// (c) a canvas that shrinks below 280 px on narrow phones.
//
// TF.js itself is still loaded as a global via <script> in the .astro page;
// we wait for window.tf to be defined before starting the model load.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TF = any;
type TFModel = { predict: (x: unknown) => { dataSync: () => Float32Array; dispose: () => void } };

declare global {
    interface Window {
        tf?: TF;
    }
}

// ===== Canvas / model constants =====
const DRAW_SIZE = 280;
const PREVIEW_SIZE = 140;
const MODEL_INPUT = 28;
const BBOX_PADDING = 20;        // padding around detected ink bbox, in draw-pixel units
const STROKE_WIDTH = 15;
const STROKE_COLOR = '#ffffff';
const CANVAS_BG = '#002b36';
const INK_THRESHOLD = 200;       // R-channel value above which a pixel counts as ink

type ModelStatus =
    | { kind: 'loading' }
    | { kind: 'ready' }
    | { kind: 'error'; message: string };

interface Prediction {
    digit: number;
    probabilities: number[]; // length 10
}

// ===== Pure helpers =====

function initDrawCanvas(canvas: HTMLCanvasElement): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth = STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
}

function fillCanvas(canvas: HTMLCanvasElement | null, color: string): void {
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

// Pull the (clientX, clientY) for the active pointer. For touch events we
// follow a specific Touch.identifier so a second finger landing mid-stroke
// can't hijack the line into a jump.
function getCanvasCoords(
    canvas: HTMLCanvasElement,
    e: MouseEvent | TouchEvent,
    touchId: number | null
): { x: number; y: number } | null {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let source: { clientX: number; clientY: number } | null = null;
    if ('touches' in e) {
        // touchend/touchcancel: the finger we want lives in changedTouches
        const lists = [e.touches, e.changedTouches];
        for (const list of lists) {
            for (let i = 0; i < list.length; i++) {
                if (touchId === null || list[i].identifier === touchId) {
                    source = list[i];
                    break;
                }
            }
            if (source) break;
        }
    } else {
        source = e;
    }
    if (!source) return null;
    return {
        x: (source.clientX - rect.left) * scaleX,
        y: (source.clientY - rect.top) * scaleY,
    };
}

// Find ink bbox, then render a centered 20x20 scale-down into a 28x28 canvas
// and return the normalized [0,1] flattened pixel array for the model. Returns
// null when the canvas is empty.
function preprocessForModel(
    drawCanvas: HTMLCanvasElement,
    previewCanvas: HTMLCanvasElement | null
): Float32Array | null {
    const ctx = drawCanvas.getContext('2d');
    if (!ctx) return null;

    const { width, height } = drawCanvas;
    const { data } = ctx.getImageData(0, 0, width, height);

    let minX = width, minY = height, maxX = 0, maxY = 0;
    let hasInk = false;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const idx = (y * width + x) * 4;
            if (data[idx] > INK_THRESHOLD) {
                hasInk = true;
                if (x < minX) minX = x;
                if (x > maxX) maxX = x;
                if (y < minY) minY = y;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (!hasInk) return null;

    minX = Math.max(0, minX - BBOX_PADDING);
    minY = Math.max(0, minY - BBOX_PADDING);
    maxX = Math.min(width, maxX + BBOX_PADDING);
    maxY = Math.min(height, maxY + BBOX_PADDING);

    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    const size = Math.max(bboxW, bboxH);
    const offsetX = minX - (size - bboxW) / 2;
    const offsetY = minY - (size - bboxH) / 2;

    const small = document.createElement('canvas');
    small.width = MODEL_INPUT;
    small.height = MODEL_INPUT;
    const smallCtx = small.getContext('2d');
    if (!smallCtx) return null;
    smallCtx.fillStyle = '#000';
    smallCtx.fillRect(0, 0, MODEL_INPUT, MODEL_INPUT);
    // Centered 20x20 region inside 28x28 — standard MNIST framing.
    smallCtx.drawImage(drawCanvas, offsetX, offsetY, size, size, 4, 4, 20, 20);

    // Mirror to the user-visible preview canvas.
    if (previewCanvas) {
        const previewCtx = previewCanvas.getContext('2d');
        if (previewCtx) {
            previewCtx.imageSmoothingEnabled = false;
            previewCtx.drawImage(small, 0, 0, previewCanvas.width, previewCanvas.height);
        }
    }

    const smallData = smallCtx.getImageData(0, 0, MODEL_INPUT, MODEL_INPUT).data;
    const pixels = new Float32Array(MODEL_INPUT * MODEL_INPUT);
    for (let i = 0; i < pixels.length; i++) {
        pixels[i] = smallData[i * 4] / 255.0;
    }
    return pixels;
}

// Blue → white → red gradient based on absolute gradient magnitude.
function renderSaliency(
    canvas: HTMLCanvasElement | null,
    gradients: Float32Array
): void {
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    let maxGrad = 0;
    for (let i = 0; i < gradients.length; i++) {
        const v = Math.abs(gradients[i]);
        if (v > maxGrad) maxGrad = v;
    }
    if (maxGrad === 0) return;

    const small = document.createElement('canvas');
    small.width = MODEL_INPUT;
    small.height = MODEL_INPUT;
    const smallCtx = small.getContext('2d');
    if (!smallCtx) return;
    const imageData = smallCtx.createImageData(MODEL_INPUT, MODEL_INPUT);

    for (let i = 0; i < gradients.length; i++) {
        const t = Math.abs(gradients[i]) / maxGrad;
        let r: number, g: number, b: number;
        if (t < 0.5) {
            const k = t * 2;
            r = Math.floor(k * 255);
            g = Math.floor(k * 255);
            b = 255;
        } else {
            const k = (t - 0.5) * 2;
            r = 255;
            g = Math.floor((1 - k) * 255);
            b = Math.floor((1 - k) * 255);
        }
        imageData.data[i * 4] = r;
        imageData.data[i * 4 + 1] = g;
        imageData.data[i * 4 + 2] = b;
        imageData.data[i * 4 + 3] = 255;
    }
    smallCtx.putImageData(imageData, 0, 0);

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(small, 0, 0, canvas.width, canvas.height);
}

// ===== Component =====

export default function DigitRecognition() {
    const drawCanvasRef = useRef<HTMLCanvasElement>(null);
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const saliencyCanvasRef = useRef<HTMLCanvasElement>(null);
    const modelRef = useRef<TFModel | null>(null);
    const isDrawingRef = useRef(false);
    const lastPosRef = useRef({ x: 0, y: 0 });
    // Identifier of the touch that started the current stroke. Stays null
    // for mouse input. Used to ignore secondary fingers landing mid-stroke.
    const touchIdRef = useRef<number | null>(null);

    const [modelStatus, setModelStatus] = useState<ModelStatus>({ kind: 'loading' });
    const [prediction, setPrediction] = useState<Prediction | null>(null);

    // Init draw canvas + clear preview/saliency on mount.
    useEffect(() => {
        if (drawCanvasRef.current) initDrawCanvas(drawCanvasRef.current);
        fillCanvas(previewCanvasRef.current, '#000');
        fillCanvas(saliencyCanvasRef.current, '#000');
    }, []);

    // Load the TF.js model once tf is on window.
    useEffect(() => {
        let cancelled = false;
        let pollTimer: ReturnType<typeof setInterval> | null = null;

        async function tryLoad() {
            try {
                const model = await window.tf!.loadLayersModel('/models/mnist/model.json');
                if (cancelled) {
                    model.dispose?.();
                    return;
                }
                modelRef.current = model as TFModel;
                setModelStatus({ kind: 'ready' });
            } catch (err) {
                if (cancelled) return;
                const message = err instanceof Error ? err.message : String(err);
                setModelStatus({ kind: 'error', message });
            }
        }

        if (window.tf) {
            void tryLoad();
        } else {
            pollTimer = setInterval(() => {
                if (window.tf) {
                    if (pollTimer) clearInterval(pollTimer);
                    pollTimer = null;
                    void tryLoad();
                }
            }, 50);
        }

        return () => {
            cancelled = true;
            if (pollTimer) clearInterval(pollTimer);
        };
    }, []);

    // Run inference + saliency. Wrapped in tf.tidy so intermediate tensors
    // from predict() / grad() are released; previous implementation leaked.
    const runPrediction = useCallback(() => {
        const drawCanvas = drawCanvasRef.current;
        const model = modelRef.current;
        if (!drawCanvas || !model || !window.tf) return;

        const pixels = preprocessForModel(drawCanvas, previewCanvasRef.current);
        if (!pixels) {
            setPrediction(null);
            fillCanvas(saliencyCanvasRef.current, '#000');
            return;
        }

        const tf = window.tf;
        const { probabilities, gradients, digit } = tf.tidy(() => {
            const input = tf.tensor4d(pixels, [1, MODEL_INPUT, MODEL_INPUT, 1]);
            const pred = model.predict(input);
            const probs = pred.dataSync() as Float32Array;

            let maxIdx = 0;
            for (let i = 1; i < probs.length; i++) {
                if (probs[i] > probs[maxIdx]) maxIdx = i;
            }

            const gradFn = tf.grad((x: unknown) => {
                const out = model.predict(x);
                return out.gather([maxIdx], 1).squeeze();
            });
            const grads = (gradFn(input).dataSync() as Float32Array).slice();

            return {
                probabilities: Array.from(probs),
                gradients: grads,
                digit: maxIdx,
            };
        });

        setPrediction({ digit, probabilities });
        renderSaliency(saliencyCanvasRef.current, gradients);
    }, []);

    // ===== Drawing event handlers =====

    const handlePointerStart = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        const canvas = drawCanvasRef.current;
        if (!canvas) return;
        // Already drawing? Ignore subsequent fingers landing on the canvas.
        if (isDrawingRef.current) {
            e.preventDefault();
            return;
        }
        e.preventDefault();

        const native = e.nativeEvent;
        if ('touches' in native && native.changedTouches.length > 0) {
            touchIdRef.current = native.changedTouches[0].identifier;
        } else {
            touchIdRef.current = null;
        }

        const coords = getCanvasCoords(canvas, native, touchIdRef.current);
        if (!coords) return;
        isDrawingRef.current = true;
        lastPosRef.current = coords;
    }, []);

    const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current) return;
        const canvas = drawCanvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!canvas || !ctx) return;
        e.preventDefault();
        const coords = getCanvasCoords(canvas, e.nativeEvent, touchIdRef.current);
        // Move event arrived but our tracked finger isn't in the list — let it pass.
        if (!coords) return;
        ctx.beginPath();
        ctx.moveTo(lastPosRef.current.x, lastPosRef.current.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
        lastPosRef.current = coords;
    }, []);

    const handlePointerEnd = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        if (!isDrawingRef.current) return;
        // For touch, only end the stroke when the tracked finger lifts —
        // other fingers releasing should not finalize the prediction.
        const native = e.nativeEvent;
        if ('changedTouches' in native && touchIdRef.current !== null) {
            let foundOurs = false;
            for (let i = 0; i < native.changedTouches.length; i++) {
                if (native.changedTouches[i].identifier === touchIdRef.current) {
                    foundOurs = true;
                    break;
                }
            }
            if (!foundOurs) return;
        }
        isDrawingRef.current = false;
        touchIdRef.current = null;
        runPrediction();
    }, [runPrediction]);

    const handleClear = useCallback(() => {
        if (drawCanvasRef.current) initDrawCanvas(drawCanvasRef.current);
        fillCanvas(previewCanvasRef.current, '#000');
        fillCanvas(saliencyCanvasRef.current, '#000');
        setPrediction(null);
    }, []);

    // ===== Render =====

    const probabilities = prediction?.probabilities ?? new Array(10).fill(0);
    const predictedDigit = prediction?.digit ?? null;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left: canvas + preview/saliency */}
            <div className="space-y-4">
                <div className="rounded-lg border border-base-600 bg-base-800 overflow-hidden">
                    <div className="px-4 py-3 bg-base-600/30 border-b border-base-600 flex items-center justify-between">
                        <span className="flex items-center">
                            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent-blue text-base-50 text-sm font-bold mr-2">
                                1
                            </span>
                            在下方畫一個數字 (0-9)
                        </span>
                        <button
                            onClick={handleClear}
                            className="px-3 py-1 rounded border border-base-600 text-base-400 hover:bg-base-600 text-sm transition"
                        >
                            清除
                        </button>
                    </div>
                    <div className="p-4 text-center">
                        <div
                            className="inline-block border-2 border-accent-blue rounded-lg overflow-hidden mx-auto"
                            style={{ touchAction: 'none', width: '100%', maxWidth: DRAW_SIZE }}
                        >
                            <canvas
                                ref={drawCanvasRef}
                                width={DRAW_SIZE}
                                height={DRAW_SIZE}
                                style={{ width: '100%', height: 'auto', display: 'block' }}
                                className="bg-base-900 cursor-crosshair"
                                onMouseDown={handlePointerStart}
                                onMouseMove={handlePointerMove}
                                onMouseUp={handlePointerEnd}
                                onMouseLeave={handlePointerEnd}
                                onTouchStart={handlePointerStart}
                                onTouchMove={handlePointerMove}
                                onTouchEnd={handlePointerEnd}
                            />
                        </div>
                        <p className="text-base-600 text-sm mt-2">用滑鼠或手指在畫布上書寫</p>
                    </div>
                </div>

                <div className="rounded-lg border border-base-600 bg-base-800 overflow-hidden">
                    <div className="px-4 py-3 bg-base-600/30 border-b border-base-600 flex items-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent-blue text-base-50 text-sm font-bold mr-2">
                            2
                        </span>
                        模型視角
                    </div>
                    <div className="p-4">
                        <div className="flex justify-center gap-6 flex-wrap">
                            <div className="text-center">
                                <canvas
                                    ref={previewCanvasRef}
                                    width={PREVIEW_SIZE}
                                    height={PREVIEW_SIZE}
                                    className="border border-base-600 rounded bg-black"
                                    style={{ imageRendering: 'pixelated' }}
                                />
                                <p className="text-base-600 text-sm mt-2">輸入圖片 (28×28)</p>
                            </div>
                            <div className="text-center">
                                <canvas
                                    ref={saliencyCanvasRef}
                                    width={PREVIEW_SIZE}
                                    height={PREVIEW_SIZE}
                                    className="border border-base-600 rounded bg-black"
                                    style={{ imageRendering: 'pixelated' }}
                                />
                                <p className="text-base-600 text-sm mt-2">Saliency Map</p>
                            </div>
                        </div>
                        <p className="text-base-600 text-sm mt-3 text-center">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-accent-red/30 text-accent-red">紅</span> = 高影響 &nbsp;
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-accent-blue/30 text-accent-blue">藍</span> = 低影響
                        </p>
                    </div>
                </div>
            </div>

            {/* Right: prediction result */}
            <div>
                <div className="rounded-lg border border-base-600 bg-base-800 overflow-hidden h-full">
                    <div className="px-4 py-3 bg-base-600/30 border-b border-base-600 flex items-center">
                        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-accent-blue text-base-50 text-sm font-bold mr-2">
                            3
                        </span>
                        預測結果
                    </div>
                    <div className="p-4">
                        {modelStatus.kind === 'loading' && (
                            <div className="text-center py-8">
                                <div className="inline-block w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full animate-spin mb-3" />
                                <p className="text-base-600">正在載入模型...</p>
                            </div>
                        )}
                        {modelStatus.kind === 'error' && (
                            <div className="text-center py-8">
                                <p className="text-accent-red">模型載入失敗</p>
                                <p className="text-base-600 text-sm mt-2">{modelStatus.message}</p>
                                <button
                                    onClick={() => window.location.reload()}
                                    className="mt-4 px-3 py-1 rounded border border-base-600 text-base-400 hover:bg-base-600 text-sm transition"
                                >
                                    重新載入
                                </button>
                            </div>
                        )}
                        {modelStatus.kind === 'ready' && (
                            <>
                                <div className="text-center mb-6">
                                    <div
                                        className="text-7xl font-bold text-accent-blue"
                                        style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.3)' }}
                                    >
                                        {predictedDigit ?? '?'}
                                    </div>
                                    <p className="text-base-600">預測數字</p>
                                </div>
                                <div className="space-y-2">
                                    {probabilities.map((p, i) => {
                                        const percent = p * 100;
                                        const isTop = i === predictedDigit;
                                        return (
                                            <div key={i} className="flex items-center gap-2">
                                                <span className="w-6 text-center font-bold text-base-400">{i}</span>
                                                <div className="flex-1 h-5 bg-base-600/30 rounded overflow-hidden">
                                                    <div
                                                        className={`h-full rounded transition-all duration-300 ${isTop ? 'bg-accent-green' : 'bg-accent-blue'}`}
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                                <span className="w-14 text-right text-sm font-mono text-base-400">
                                                    {percent.toFixed(1)}%
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
