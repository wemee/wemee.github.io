/**
 * Snake AI - DQN Agent for browser inference
 * Uses pre-trained weights from Python training
 *
 * Architecture: Strategy Pattern for feature extraction
 * - SnakeAI: Context, manages weights and inference
 * - FeatureExtractor: Strategy interface
 * - Compact11Extractor: 11-dim features (legacy)
 * - LidarExtractor: 28-dim LIDAR vision (advanced)
 */

// ============================================================
// Types
// ============================================================

export interface SnakeGameState {
    snake: [number, number][];
    food: [number, number];
    direction: number;  // 0=UP, 1=DOWN, 2=LEFT, 3=RIGHT
    gridWidth: number;
    gridHeight: number;
}

interface QNetWeights {
    [key: string]: number[][] | number[];
}

// ============================================================
// Feature Extractor Strategy Interface
// ============================================================

/**
 * Strategy interface for feature extraction.
 * Implementations must produce normalized features (0-1 range)
 * that are grid-size agnostic for generalization.
 */
export interface FeatureExtractor {
    /** Human-readable name for debugging */
    readonly name: string;

    /** Expected feature dimension */
    readonly featureDim: number;

    /** Extract features from game state */
    extract(state: SnakeGameState): number[];

    /** Optional reset for stateful extractors */
    reset?(): void;

    /** Optional hunger level for debugging */
    getHunger?(): number;
}

// ============================================================
// Compact11 Extractor (Legacy 11-dim)
// ============================================================

/**
 * Original 11-dimensional feature extractor.
 * Same logic as Python's Compact11Wrapper.
 *
 * Features:
 * [0-2]  Danger detection (straight, right, left)
 * [3-6]  Current direction (one-hot)
 * [7-10] Food relative position
 */
export class Compact11Extractor implements FeatureExtractor {
    readonly name = 'Compact11';
    readonly featureDim = 11;

    private static readonly DIRECTION_DELTA: Record<number, [number, number]> = {
        0: [0, -1],  // UP
        1: [0, 1],   // DOWN
        2: [-1, 0],  // LEFT
        3: [1, 0],   // RIGHT
    };

    private static readonly RELATIVE_DIRS: Record<number, { straight: number; right: number; left: number }> = {
        0: { straight: 0, right: 3, left: 2 },  // UP
        1: { straight: 1, right: 2, left: 3 },  // DOWN
        2: { straight: 2, right: 0, left: 1 },  // LEFT
        3: { straight: 3, right: 1, left: 0 },  // RIGHT
    };

    extract(state: SnakeGameState): number[] {
        const { snake, food, direction, gridWidth, gridHeight } = state;
        const features = new Array(11).fill(0);
        const head = snake[0];

        const snakeSet = new Set(snake.map(([x, y]) => `${x},${y}`));

        const checkCollision = (pos: [number, number]): boolean => {
            const [x, y] = pos;
            if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return true;
            return snakeSet.has(`${x},${y}`);
        };

        // Danger detection (features 0-2)
        const relDirs = Compact11Extractor.RELATIVE_DIRS[direction];
        const relNames = ['straight', 'right', 'left'] as const;
        for (let i = 0; i < 3; i++) {
            const absDir = relDirs[relNames[i]];
            const [dx, dy] = Compact11Extractor.DIRECTION_DELTA[absDir];
            const nextPos: [number, number] = [head[0] + dx, head[1] + dy];
            features[i] = checkCollision(nextPos) ? 1 : 0;
        }

        // Current direction one-hot (features 3-6): LEFT, RIGHT, UP, DOWN
        const dirMapping: Record<number, number> = { 2: 3, 3: 4, 0: 5, 1: 6 };
        features[dirMapping[direction]] = 1;

        // Food relative position (features 7-10)
        features[7] = food[0] < head[0] ? 1 : 0;  // food_left
        features[8] = food[0] > head[0] ? 1 : 0;  // food_right
        features[9] = food[1] < head[1] ? 1 : 0;  // food_up
        features[10] = food[1] > head[1] ? 1 : 0; // food_down

        return features;
    }
}

// ============================================================
// LIDAR Extractor (Advanced 28-dim)
// ============================================================

/**
 * Advanced 28-dimensional LIDAR feature extractor.
 * Same logic as Python's LidarHungerWrapper.
 *
 * Features:
 * [0-7]   Distance to obstacle in 8 directions (normalized)
 * [8-15]  Is obstacle a wall? (0 or 1)
 * [16-23] Is food visible in this direction? (0 or 1)
 * [24]    Snake length (normalized)
 * [25]    Hunger level (normalized, 0 = just ate, 1 = max hunger)
 * [26]    Food distance X (normalized, signed)
 * [27]    Food distance Y (normalized, signed)
 * 
 * NOTE: This extractor is STATEFUL - it tracks hunger between calls.
 * Call reset() when starting a new game.
 */
export class LidarExtractor implements FeatureExtractor {
    readonly name = 'LIDAR';
    readonly featureDim = 28;

    // Hunger tracking (matches Python LidarHungerWrapper)
    private readonly baseHungerPenalty = -0.01;
    private readonly hungerIncrement = -0.01;
    private readonly maxHungerPenalty = -0.5;
    private currentHungerPenalty = -0.01;
    private prevFoodDistance: number | null = null;
    private prevSnakeLength = 0;

    // 8 directions: UP, DOWN, LEFT, RIGHT, UP-LEFT, UP-RIGHT, DOWN-LEFT, DOWN-RIGHT
    private static readonly DIRECTIONS: [number, number][] = [
        [0, -1],   // UP
        [0, 1],    // DOWN
        [-1, 0],   // LEFT
        [1, 0],    // RIGHT
        [-1, -1],  // UP-LEFT
        [1, -1],   // UP-RIGHT
        [-1, 1],   // DOWN-LEFT
        [1, 1],    // DOWN-RIGHT
    ];

    /** Reset hunger state when starting a new game */
    reset(): void {
        this.currentHungerPenalty = this.baseHungerPenalty;
        this.prevFoodDistance = null;
        this.prevSnakeLength = 0;
    }

    /** Get current normalized hunger level (0-1) */
    getHunger(): number {
        const hungerRange = Math.abs(this.maxHungerPenalty - this.baseHungerPenalty);
        if (hungerRange > 0) {
            return Math.abs(this.currentHungerPenalty - this.baseHungerPenalty) / hungerRange;
        }
        return 0;
    }

    extract(state: SnakeGameState): number[] {
        const { snake, food, gridWidth, gridHeight } = state;
        const features = new Array(28).fill(0);
        const head = snake[0];
        const maxDistance = Math.max(gridWidth, gridHeight);

        // Calculate current food distance
        const currentFoodDistance = Math.abs(head[0] - food[0]) + Math.abs(head[1] - food[1]);

        // Update hunger state based on food approach
        const ateFood = snake.length > this.prevSnakeLength && this.prevSnakeLength > 0;

        if (ateFood) {
            // Reset penalty when eating
            this.currentHungerPenalty = this.baseHungerPenalty;
        } else if (this.prevFoodDistance !== null) {
            const distanceDelta = this.prevFoodDistance - currentFoodDistance;
            if (distanceDelta > 0) {
                // Got closer to food - keep penalty unchanged
            } else {
                // Not approaching - accumulate penalty
                this.currentHungerPenalty = Math.max(
                    this.currentHungerPenalty + this.hungerIncrement,
                    this.maxHungerPenalty
                );
            }
        }

        // Update state for next call
        this.prevFoodDistance = currentFoodDistance;
        this.prevSnakeLength = snake.length;

        // Build snake body set (excluding head for collision check)
        const snakeBody = new Set<string>();
        for (let i = 1; i < snake.length; i++) {
            const [x, y] = snake[i];
            snakeBody.add(`${x},${y}`);
        }

        // LIDAR: 8 directions
        for (let i = 0; i < LidarExtractor.DIRECTIONS.length; i++) {
            const [dx, dy] = LidarExtractor.DIRECTIONS[i];
            const { distance, hitWall, foundFood } = this.castRay(
                head, dx, dy, gridWidth, gridHeight, snakeBody, food
            );

            // Normalize distance (0 = adjacent, 1 = far)
            features[i] = distance / maxDistance;

            // Is it a wall?
            features[8 + i] = hitWall ? 1 : 0;

            // Food in this direction?
            features[16 + i] = foundFood ? 1 : 0;
        }

        // Snake length (normalized)
        const maxPossibleLength = gridWidth * gridHeight;
        features[24] = snake.length / maxPossibleLength;

        // Hunger (normalized, 0 = no hunger, 1 = max hunger)
        const hungerRange = Math.abs(this.maxHungerPenalty - this.baseHungerPenalty);
        if (hungerRange > 0) {
            features[25] = Math.abs(this.currentHungerPenalty - this.baseHungerPenalty) / hungerRange;
        } else {
            features[25] = 0;
        }

        // Food relative position (normalized, signed)
        features[26] = (food[0] - head[0]) / gridWidth;
        features[27] = (food[1] - head[1]) / gridHeight;

        return features;
    }

    private castRay(
        start: [number, number],
        dx: number,
        dy: number,
        gridW: number,
        gridH: number,
        snakeBody: Set<string>,
        food: [number, number]
    ): { distance: number; hitWall: boolean; foundFood: boolean } {
        let [x, y] = start;
        let distance = 0;
        let foundFood = false;

        while (true) {
            x += dx;
            y += dy;
            distance += 1;

            // Check if food is at this position
            if (x === food[0] && y === food[1]) {
                foundFood = true;
            }

            // Check wall collision
            if (x < 0 || x >= gridW || y < 0 || y >= gridH) {
                return { distance, hitWall: true, foundFood };
            }

            // Check snake body collision
            if (snakeBody.has(`${x},${y}`)) {
                return { distance, hitWall: false, foundFood };
            }
        }
    }
}

// ============================================================
// Neural Network Utilities
// ============================================================

function forward(input: number[], weights: QNetWeights): number[] {
    let x = input;

    // Find all layer indices (0, 2, 4, ... are Linear layers in Sequential)
    const layerIndices: number[] = [];
    for (const key of Object.keys(weights)) {
        const match = key.match(/q_net\.(\d+)\.weight/);
        if (match) {
            layerIndices.push(parseInt(match[1]));
        }
    }
    layerIndices.sort((a, b) => a - b);

    for (let i = 0; i < layerIndices.length; i++) {
        const layerIdx = layerIndices[i];
        const weight = weights[`q_net.${layerIdx}.weight`] as number[][];
        const bias = weights[`q_net.${layerIdx}.bias`] as number[];

        x = matmul(weight, x);
        x = addBias(x, bias);

        // ReLU for all but last layer
        if (i < layerIndices.length - 1) {
            x = relu(x);
        }
    }

    return x;
}

function matmul(weight: number[][], input: number[]): number[] {
    return weight.map(row => row.reduce((sum, w, i) => sum + w * input[i], 0));
}

function addBias(x: number[], bias: number[]): number[] {
    return x.map((v, i) => v + bias[i]);
}

function relu(x: number[]): number[] {
    return x.map(v => Math.max(0, v));
}

function argmax(arr: number[]): number {
    return arr.reduce((maxIdx, val, idx, a) => val > a[maxIdx] ? idx : maxIdx, 0);
}

// ============================================================
// SnakeAI Class (Context)
// ============================================================

export interface SnakeAIConfig {
    weightsUrl?: string;
    extractor?: FeatureExtractor;
}

/**
 * Snake AI using DQN weights for inference.
 *
 * Usage:
 * ```ts
 * // Legacy 11-dim AI
 * const ai = new SnakeAI();
 * await ai.load('/models/snake/snake_weights.json');
 *
 * // Advanced LIDAR AI
 * const ai = new SnakeAI({ extractor: new LidarExtractor() });
 * await ai.load('/models/snake/snake_lidar_weights.json');
 * ```
 */
export class SnakeAI {
    private weights: QNetWeights | null = null;
    private loaded = false;
    private readonly extractor: FeatureExtractor;

    constructor(config: SnakeAIConfig = {}) {
        // Default to legacy Compact11 for backward compatibility
        this.extractor = config.extractor ?? new Compact11Extractor();
    }

    async load(weightsUrl: string = '/models/snake/snake_weights.json'): Promise<void> {
        const response = await fetch(weightsUrl);
        if (!response.ok) {
            throw new Error(`Failed to load weights: ${response.status}`);
        }
        this.weights = await response.json();
        this.loaded = true;
    }

    isLoaded(): boolean {
        return this.loaded;
    }

    getExtractorName(): string {
        return this.extractor.name;
    }

    /** Reset AI state (e.g. for new game) */
    reset(): void {
        if (this.extractor.reset) {
            this.extractor.reset();
        }
    }

    /** Get current hunger level (for UI display) */
    getHunger(): number {
        if (this.extractor.getHunger) {
            return this.extractor.getHunger();
        }
        return 0;
    }

    /**
     * Predict best action given game state
     * @returns Action: 0=UP, 1=DOWN, 2=LEFT, 3=RIGHT
     */
    predict(
        snake: [number, number][],
        food: [number, number],
        direction: number,
        gridWidth: number,
        gridHeight: number
    ): number {
        if (!this.weights) {
            throw new Error('AI not loaded. Call load() first.');
        }

        // Ensure integer coordinates
        const state: SnakeGameState = {
            snake: snake.map(p => [Math.round(p[0]), Math.round(p[1])] as [number, number]),
            food: [Math.round(food[0]), Math.round(food[1])],
            direction,
            gridWidth,
            gridHeight,
        };

        const features = this.extractor.extract(state);
        const qValues = forward(features, this.weights);
        return argmax(qValues);
    }
}

export default SnakeAI;
