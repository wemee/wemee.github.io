/**
 * Snake AI - DQN Agent for browser inference
 * Uses pre-trained weights from Python training
 */

export interface SnakeAIConfig {
    weightsUrl?: string;
}

interface QNetWeights {
    'q_net.0.weight': number[][];
    'q_net.0.bias': number[];
    'q_net.2.weight': number[][];
    'q_net.2.bias': number[];
    'q_net.4.weight': number[][];
    'q_net.4.bias': number[];
}

/**
 * Compact 11-feature extractor
 * Same logic as Python's Compact11Wrapper
 */
function extractFeatures(
    snake: [number, number][],
    food: [number, number],
    direction: number,
    gridWidth: number,
    gridHeight: number
): number[] {
    const features = new Array(11).fill(0);
    const head = snake[0];

    // Direction deltas: UP=0, DOWN=1, LEFT=2, RIGHT=3
    const directionDelta: Record<number, [number, number]> = {
        0: [0, -1],  // UP
        1: [0, 1],   // DOWN
        2: [-1, 0],  // LEFT
        3: [1, 0],   // RIGHT
    };

    // Relative directions (relative to current heading)
    const relativeDirs: Record<number, { straight: number; right: number; left: number }> = {
        0: { straight: 0, right: 3, left: 2 },  // UP
        1: { straight: 1, right: 2, left: 3 },  // DOWN
        2: { straight: 2, right: 0, left: 1 },  // LEFT
        3: { straight: 3, right: 1, left: 0 },  // RIGHT
    };

    const snakeSet = new Set(snake.map(([x, y]) => `${x},${y}`));

    const checkCollision = (pos: [number, number]): boolean => {
        const [x, y] = pos;
        if (x < 0 || x >= gridWidth || y < 0 || y >= gridHeight) return true;
        return snakeSet.has(`${x},${y}`);
    };

    // Danger detection (features 0-2)
    const relDirs = relativeDirs[direction];
    const relNames = ['straight', 'right', 'left'] as const;
    for (let i = 0; i < 3; i++) {
        const absDir = relDirs[relNames[i]];
        const [dx, dy] = directionDelta[absDir];
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

/**
 * Simple feedforward network for Q-value prediction
 */
function forward(input: number[], weights: QNetWeights): number[] {
    // Layer 1: Linear(11, 64) + ReLU
    let x = matmul(weights['q_net.0.weight'], input);
    x = addBias(x, weights['q_net.0.bias']);
    x = relu(x);

    // Layer 2: Linear(64, 64) + ReLU
    x = matmul(weights['q_net.2.weight'], x);
    x = addBias(x, weights['q_net.2.bias']);
    x = relu(x);

    // Layer 3: Linear(64, 4)
    x = matmul(weights['q_net.4.weight'], x);
    x = addBias(x, weights['q_net.4.bias']);

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

export class SnakeAI {
    private weights: QNetWeights | null = null;
    private loaded = false;

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

        const features = extractFeatures(snake, food, direction, gridWidth, gridHeight);
        const qValues = forward(features, this.weights);
        return argmax(qValues);
    }
}

export default SnakeAI;
