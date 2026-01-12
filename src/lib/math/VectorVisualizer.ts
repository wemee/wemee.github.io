
export interface Vector {
    x: number;
    y: number;
}

export interface VectorState {
    vectorA: Vector;
    vectorB: Vector;
    dotProduct: number;
    cosineSimilarity: number;
    angleDeg: number;
    magnitudeA: number;
    magnitudeB: number;
}

export class VectorVisualizer {
    private canvas: HTMLCanvasElement;
    private ctx: CanvasRenderingContext2D;
    private width!: number;
    private height!: number;
    private centerX!: number;
    private centerY!: number;

    // State
    private vectorA: Vector = { x: 100, y: 0 };
    private vectorB: Vector = { x: 50, y: 86.6 }; // approx 60 degrees
    private originalVectorA: Vector | null = null;
    private originalVectorB: Vector | null = null;
    private isNormalizedMode: boolean = false;
    private isDraggingA: boolean = false;
    private isDraggingB: boolean = false;
    private readonly defaultScale = 1; // Pixels per unit, can scale if needed, but using direct pixels for simplicity
    private readonly hitRadius = 20;

    // Callback for UI updates
    private onUpdate: ((state: VectorState) => void) | null = null;

    // Event handler references for cleanup
    private boundHandleStart: (e: MouseEvent | Touch) => void;
    private boundHandleMove: (e: MouseEvent | Touch) => void;
    private boundHandleEnd: () => void;
    private boundHandleResize: () => void;
    private boundHandleTouchStart: (e: TouchEvent) => void;
    private boundHandleTouchMove: (e: TouchEvent) => void;

    constructor(canvasId: string, onUpdate?: (state: VectorState) => void) {
        const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
        if (!canvas) throw new Error(`Canvas with id ${canvasId} not found`);

        this.canvas = canvas;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get 2D context from canvas');
        this.ctx = ctx;
        this.onUpdate = onUpdate || null;

        // Bind event handlers
        this.boundHandleStart = this.handleStart.bind(this);
        this.boundHandleMove = this.handleMove.bind(this);
        this.boundHandleEnd = this.handleEnd.bind(this);
        this.boundHandleResize = () => {
            this.setupCanvas();
            this.render();
        };
        this.boundHandleTouchStart = (e: TouchEvent) => {
            e.preventDefault();
            this.handleStart(e.touches[0]);
        };
        this.boundHandleTouchMove = (e: TouchEvent) => {
            if (this.isDraggingA || this.isDraggingB) e.preventDefault();
            this.handleMove(e.touches[0]);
        };

        // 初始化尺寸 (必須在事件監聯前執行)
        this.setupCanvas();

        // 監聽視窗大小改變以重設 Canvas
        window.addEventListener('resize', this.boundHandleResize);

        this.initEventListeners();
        this.render();
        this.notifyUpdate();
    }

    private setupCanvas() {
        const dpr = window.devicePixelRatio || 1;
        // 取得 CSS 顯示尺寸
        const rect = this.canvas.getBoundingClientRect();

        // 設定邏輯尺寸
        this.width = rect.width;
        this.height = 500; // 固定高度，需與 CSS 一致

        // 設定物理尺寸 (Retina 支援)，避免模糊
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;

        // 強制 CSS 尺寸以確保佈局穩定
        this.canvas.style.width = `${this.width}px`;
        this.canvas.style.height = `${this.height}px`;

        // 縮放繪圖 Context，所有的繪圖指令都使用邏輯座標 (CSS Pixel)
        this.ctx.resetTransform(); // 重置變換矩陣，避免重複縮放
        this.ctx.scale(dpr, dpr);

        // 設定中心點 (邏輯座標)
        this.centerX = this.width / 2;
        this.centerY = this.height / 2;
    }

    public setNormalizedMode(enabled: boolean) {
        this.isNormalizedMode = enabled;
        if (enabled) {
            // Save original vectors before normalizing
            this.originalVectorA = { ...this.vectorA };
            this.originalVectorB = { ...this.vectorB };
            this.normalizeVector(this.vectorA, 150); // Fixed length for visualization
            this.normalizeVector(this.vectorB, 150);
        } else {
            // Restore original vectors
            if (this.originalVectorA && this.originalVectorB) {
                this.vectorA = { ...this.originalVectorA };
                this.vectorB = { ...this.originalVectorB };
                this.originalVectorA = null;
                this.originalVectorB = null;
            }
        }
        this.render();
        this.notifyUpdate();
    }

    public setVectors(type: 'similar' | 'orthogonal' | 'opposite' | 'random') {
        const len = 150;

        switch (type) {
            case 'similar':
                this.vectorA = { x: len, y: 0 };
                this.vectorB = { x: len, y: 0 };
                break;
            case 'orthogonal':
                this.vectorA = { x: len, y: 0 };
                this.vectorB = { x: 0, y: -len };
                break;
            case 'opposite':
                this.vectorA = { x: len, y: 0 };
                this.vectorB = { x: -len, y: 0 };
                break;
            case 'random':
                const angleA = Math.random() * Math.PI * 2;
                const angleB = Math.random() * Math.PI * 2;
                const lenA = this.isNormalizedMode ? len : 50 + Math.random() * 150;
                const lenB = this.isNormalizedMode ? len : 50 + Math.random() * 150;
                this.vectorA = { x: Math.cos(angleA) * lenA, y: Math.sin(angleA) * lenA };
                this.vectorB = { x: Math.cos(angleB) * lenB, y: Math.sin(angleB) * lenB };
                break;
        }
        this.render();
        this.notifyUpdate();
    }

    private initEventListeners() {
        // Mouse events
        this.canvas.addEventListener('mousedown', this.boundHandleStart as EventListener);
        window.addEventListener('mousemove', this.boundHandleMove as EventListener);
        window.addEventListener('mouseup', this.boundHandleEnd);

        // Touch events
        this.canvas.addEventListener('touchstart', this.boundHandleTouchStart, { passive: false });
        window.addEventListener('touchmove', this.boundHandleTouchMove, { passive: false });
        window.addEventListener('touchend', this.boundHandleEnd);
    }

    public destroy() {
        // Remove all event listeners
        this.canvas.removeEventListener('mousedown', this.boundHandleStart as EventListener);
        window.removeEventListener('mousemove', this.boundHandleMove as EventListener);
        window.removeEventListener('mouseup', this.boundHandleEnd);
        window.removeEventListener('resize', this.boundHandleResize);

        this.canvas.removeEventListener('touchstart', this.boundHandleTouchStart);
        window.removeEventListener('touchmove', this.boundHandleTouchMove);
        window.removeEventListener('touchend', this.boundHandleEnd);
    }

    private getMousePos(e: MouseEvent | Touch) {
        const rect = this.canvas.getBoundingClientRect();

        // 關鍵修正：因為我們已經在 setupCanvas 用 ctx.scale 處理了 DPR，
        // 且所有的繪圖（包含 translate 到中心點）都是基於邏輯座標。
        // 但注意：getMousePos 是要回傳相對於「變換前的中心點」的向量。
        // e.clientX - rect.left 是滑鼠在 Canvas 左上角的邏輯座標。
        // 減去 this.centerX 後，就是相對於 Canvas 中心的邏輯向量。
        return {
            x: e.clientX - rect.left - this.centerX,
            y: e.clientY - rect.top - this.centerY
        };
    }

    private handleStart(e: MouseEvent | Touch) {
        const pos = this.getMousePos(e);

        // Check distance to vector heads
        if (this.dist(pos, this.vectorA) < this.hitRadius) {
            this.isDraggingA = true;
        } else if (this.dist(pos, this.vectorB) < this.hitRadius) {
            this.isDraggingB = true;
        }
    }

    private handleMove(e: MouseEvent | Touch) {
        if (!this.isDraggingA && !this.isDraggingB) return;

        const pos = this.getMousePos(e);

        // Limit length if normalized mode
        if (this.isNormalizedMode) {
            const angle = Math.atan2(pos.y, pos.x);
            const fixedLen = 150;
            pos.x = Math.cos(angle) * fixedLen;
            pos.y = Math.sin(angle) * fixedLen;
        }

        if (this.isDraggingA) {
            this.vectorA = pos;
        } else if (this.isDraggingB) {
            this.vectorB = pos;
        }

        this.render();
        this.notifyUpdate();
    }

    private handleEnd() {
        this.isDraggingA = false;
        this.isDraggingB = false;
    }

    private dist(p1: Vector, p2: Vector): number {
        return Math.sqrt(Math.pow(p1.x - p2.x, 2) + Math.pow(p1.y - p2.y, 2));
    }

    private normalizeVector(v: Vector, targetLen: number) {
        const currentLen = Math.sqrt(v.x * v.x + v.y * v.y);
        if (currentLen === 0) return;
        v.x = (v.x / currentLen) * targetLen;
        v.y = (v.y / currentLen) * targetLen;
    }

    private getMagnitude(v: Vector): number {
        return Math.sqrt(v.x * v.x + v.y * v.y);
    }

    // --- Calculations ---

    private calculateDotProduct(): number {
        // In screen coordinates, y is down.
        // For mathematical intuition, we usually think y is up. 
        // However, dot product formula x1*x2 + y1*y2 works regardless of orientation 
        // as long as the coordinate system is consistent.
        // We will display raw pixel values scaled down (e.g. / 100) to make numbers more readable.
        return (this.vectorA.x * this.vectorB.x + this.vectorA.y * this.vectorB.y);
    }

    private calculateCosineSim(): number {
        const dot = this.calculateDotProduct();
        const magA = this.getMagnitude(this.vectorA);
        const magB = this.getMagnitude(this.vectorB);
        if (magA === 0 || magB === 0) return 0;
        return dot / (magA * magB);
    }

    private calculateProjection(): Vector {
        // Project A onto B
        // proj = ( (A . B) / |B|^2 ) * B
        const dot = this.calculateDotProduct();
        const magBSq = this.vectorB.x * this.vectorB.x + this.vectorB.y * this.vectorB.y;
        if (magBSq === 0) return { x: 0, y: 0 };

        const scalar = dot / magBSq;
        return {
            x: scalar * this.vectorB.x,
            y: scalar * this.vectorB.y
        };
    }

    private notifyUpdate() {
        if (this.onUpdate) {
            // Scale down pixel values for display to make them look like "normal math class" numbers
            // Let's say 100px = 1 unit
            const scale = 1 / 100;

            const vA = { x: this.vectorA.x * scale, y: -this.vectorA.y * scale }; // Invert Y for Cartesian display
            const vB = { x: this.vectorB.x * scale, y: -this.vectorB.y * scale };

            this.onUpdate({
                vectorA: vA,
                vectorB: vB,
                dotProduct: this.calculateDotProduct() * (scale * scale),
                cosineSimilarity: this.calculateCosineSim(),
                angleDeg: Math.acos(Math.max(-1, Math.min(1, this.calculateCosineSim()))) * (180 / Math.PI),
                magnitudeA: this.getMagnitude(this.vectorA) * scale,
                magnitudeB: this.getMagnitude(this.vectorB) * scale
            });
        }
    }

    // --- Rendering ---

    private render() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        this.ctx.save();

        // Draw Grid
        this.drawGrid();

        // Move to center
        this.ctx.translate(this.centerX, this.centerY);

        // Draw Projection (A projected onto B)
        const proj = this.calculateProjection();
        this.ctx.beginPath();
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        this.ctx.lineWidth = 2;
        // Line from A head to Projection point
        this.ctx.moveTo(this.vectorA.x, this.vectorA.y);
        this.ctx.lineTo(proj.x, proj.y);
        this.ctx.stroke();

        // Draw Projection Vector (Shadow)
        // Only separate color if it helps. Let's make it a thick semi-transparent yellow overlay on B
        if (this.getMagnitude(proj) > 1) {
            this.drawArrow(
                { x: 0, y: 0 },
                proj,
                'rgba(255, 215, 0, 0.3)', // Gold transparent
                8
            );
        }
        this.ctx.setLineDash([]);

        // Draw Angle Arc
        const angleA = Math.atan2(this.vectorA.y, this.vectorA.x);
        const angleB = Math.atan2(this.vectorB.y, this.vectorB.x);
        const radius = 40;

        // Determine the shorter arc direction
        let startAngle = angleB;
        let endAngle = angleA;
        let angleDiff = endAngle - startAngle;

        // Normalize to [-PI, PI]
        while (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
        while (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;

        const counterClockwise = angleDiff < 0;

        this.ctx.beginPath();
        this.ctx.arc(0, 0, radius, startAngle, endAngle, counterClockwise);
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        // Draw Vector B (Blue)
        this.drawArrow({ x: 0, y: 0 }, this.vectorB, '#4facfe', 4, 'B'); // Solar Blue

        // Draw Vector A (Red/Orange)
        this.drawArrow({ x: 0, y: 0 }, this.vectorA, '#ff6b6b', 4, 'A'); // Solar Red

        this.ctx.restore();
    }

    private drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        this.ctx.lineWidth = 1;
        this.ctx.beginPath();

        const step = 50;

        // Vertical
        for (let x = this.centerX % step; x < this.width; x += step) {
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.height);
        }
        // Horizontal
        for (let y = this.centerY % step; y < this.height; y += step) {
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.width, y);
        }
        this.ctx.stroke();

        // Axes
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(this.centerX, 0);
        this.ctx.lineTo(this.centerX, this.height);
        this.ctx.moveTo(0, this.centerY);
        this.ctx.lineTo(this.width, this.centerY);
        this.ctx.stroke();
    }

    private drawArrow(from: Vector, to: Vector, color: string, width: number, label?: string) {
        const headLen = 15;
        const angle = Math.atan2(to.y - from.y, to.x - from.x);

        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.lineWidth = width;
        this.ctx.lineCap = 'round';

        // Line
        this.ctx.beginPath();
        this.ctx.moveTo(from.x, from.y);
        this.ctx.lineTo(to.x, to.y);
        this.ctx.stroke();

        // Head
        this.ctx.beginPath();
        this.ctx.moveTo(to.x, to.y);
        this.ctx.lineTo(to.x - headLen * Math.cos(angle - Math.PI / 6), to.y - headLen * Math.sin(angle - Math.PI / 6));
        this.ctx.lineTo(to.x - headLen * Math.cos(angle + Math.PI / 6), to.y - headLen * Math.sin(angle + Math.PI / 6));
        this.ctx.lineTo(to.x, to.y);
        this.ctx.fill();

        // Label
        if (label) {
            this.ctx.font = 'bold 16px "SF Mono", monospace';
            this.ctx.fillStyle = color;
            this.ctx.fillText(label, to.x + 10, to.y + 10);
        }

        // Drag Handle
        this.ctx.beginPath();
        this.ctx.arc(to.x, to.y, this.hitRadius / 1.5, 0, Math.PI * 2);
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        this.ctx.fill();
    }
}
