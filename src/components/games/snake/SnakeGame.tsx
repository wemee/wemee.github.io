/**
 * 貪吃蛇遊戲 React 組件
 * 支援人類玩家 + AI 自動遊戲
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { SnakeGameCore, type Direction, type SnakeObservation, type SnakeAction } from '@/lib/games/SnakeGameCore';
import { SnakeAI, LidarExtractor } from '@/lib/games/SnakeAI';
import { useGameLoop } from '@/hooks/useGameLoop';

interface SnakeGameProps {
    gridWidth?: number;
    gridHeight?: number;
    cellSize?: number;
    tickInterval?: number;
}

const DIRECTION_TO_ACTION: Record<Direction, SnakeAction> = {
    'UP': 0,
    'DOWN': 1,
    'LEFT': 2,
    'RIGHT': 3,
};

const ACTION_TO_DIRECTION: Record<SnakeAction, Direction> = {
    0: 'UP',
    1: 'DOWN',
    2: 'LEFT',
    3: 'RIGHT',
};

export function SnakeGame({
    gridWidth = 32,
    gridHeight = 32,
    cellSize = 15,
    tickInterval = 100,
}: SnakeGameProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const gameRef = useRef<SnakeGameCore | null>(null);
    const aiRef = useRef<SnakeAI | null>(null);
    const lastTickRef = useRef<number>(0);
    const nextDirectionRef = useRef<Direction | null>(null);

    const [gameState, setGameState] = useState<SnakeObservation | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isAIMode, setIsAIMode] = useState(false);
    const [aiLoading, setAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);
    const [currentHunger, setCurrentHunger] = useState(0);

    // 初始化遊戲
    useEffect(() => {
        gameRef.current = new SnakeGameCore({ gridWidth, gridHeight });
        setGameState(gameRef.current.getState());
    }, [gridWidth, gridHeight]);

    // 載入 AI
    const loadAI = useCallback(async () => {
        if (aiRef.current?.isLoaded()) return true;

        setAiLoading(true);
        setAiError(null);

        try {
            aiRef.current = new SnakeAI({ extractor: new LidarExtractor() });
            await aiRef.current.load('/models/snake/snake_lidar_weights.json');
            setAiLoading(false);
            return true;
        } catch (e) {
            setAiError('AI 載入失敗');
            setAiLoading(false);
            return false;
        }
    }, []);

    // 遊戲邏輯 tick
    const handleTick = useCallback((deltaTime: number) => {
        if (!gameRef.current || gameRef.current.isGameOver()) return;

        lastTickRef.current += deltaTime;
        if (lastTickRef.current < tickInterval) return;
        lastTickRef.current = 0;

        let action: SnakeAction;

        if (isAIMode && aiRef.current?.isLoaded()) {
            // AI 決策
            const state = gameRef.current.getState();
            const snake: [number, number][] = state.snake.map(s => [s.x, s.y]);
            const food: [number, number] = [state.food.x, state.food.y];
            const direction = DIRECTION_TO_ACTION[state.direction];

            action = aiRef.current.predict(snake, food, direction, gridWidth, gridHeight) as SnakeAction;

            // Update hunger display
            if (aiRef.current.getHunger) {
                setCurrentHunger(aiRef.current.getHunger());
            }
        } else {
            // 人類玩家
            if (nextDirectionRef.current) {
                gameRef.current.setDirection(nextDirectionRef.current);
                nextDirectionRef.current = null;
            }
            action = gameRef.current.getDirectionAction();
        }

        gameRef.current.step(action);
        setGameState(gameRef.current.getState());
    }, [tickInterval, isAIMode, gridWidth, gridHeight]);

    const { start, stop } = useGameLoop({
        onTick: handleTick,
        autoStart: false,
    });

    // 開始遊戲
    const startGame = useCallback(async (aiMode: boolean) => {
        if (aiMode) {
            const loaded = await loadAI();
            if (!loaded) return;
            // Reset AI state (e.g. hunger tracking)
            aiRef.current?.reset();
        }

        if (gameRef.current) {
            gameRef.current.reset();
            setGameState(gameRef.current.getState());
            lastTickRef.current = 0;
            nextDirectionRef.current = null;
            setIsAIMode(aiMode);
            setIsPlaying(true);
            start();
        }
    }, [start, loadAI]);

    // 結束遊戲
    const stopGame = useCallback(() => {
        stop();
        setIsPlaying(false);
    }, [stop]);

    // 監聽遊戲結束
    useEffect(() => {
        if (gameState?.gameOver && isPlaying) {
            stopGame();
        }
    }, [gameState?.gameOver, isPlaying, stopGame]);

    // 鍵盤控制
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isPlaying || isAIMode) return;

            let dir: Direction | null = null;
            switch (e.key) {
                case 'ArrowUp':
                case 'w':
                case 'W':
                    dir = 'UP';
                    break;
                case 'ArrowDown':
                case 's':
                case 'S':
                    dir = 'DOWN';
                    break;
                case 'ArrowLeft':
                case 'a':
                case 'A':
                    dir = 'LEFT';
                    break;
                case 'ArrowRight':
                case 'd':
                case 'D':
                    dir = 'RIGHT';
                    break;
            }

            if (dir) {
                e.preventDefault();
                nextDirectionRef.current = dir;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isPlaying, isAIMode]);

    // 繪製畫面
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !gameState) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const width = gridWidth * cellSize;
        const height = gridHeight * cellSize;

        // 清空畫布
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        // 繪製網格線
        ctx.strokeStyle = '#2a2a4e';
        ctx.lineWidth = 0.5;
        for (let x = 0; x <= gridWidth; x++) {
            ctx.beginPath();
            ctx.moveTo(x * cellSize, 0);
            ctx.lineTo(x * cellSize, height);
            ctx.stroke();
        }
        for (let y = 0; y <= gridHeight; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * cellSize);
            ctx.lineTo(width, y * cellSize);
            ctx.stroke();
        }

        // 繪製食物
        ctx.fillStyle = '#ff6b6b';
        ctx.beginPath();
        ctx.arc(
            gameState.food.x * cellSize + cellSize / 2,
            gameState.food.y * cellSize + cellSize / 2,
            cellSize / 2 - 2,
            0,
            Math.PI * 2
        );
        ctx.fill();

        // 繪製蛇
        gameState.snake.forEach((segment, index) => {
            const isHead = index === 0;
            ctx.fillStyle = isHead ? (isAIMode ? '#60a5fa' : '#4ade80') : (isAIMode ? '#3b82f6' : '#22c55e');
            ctx.fillRect(
                segment.x * cellSize + 1,
                segment.y * cellSize + 1,
                cellSize - 2,
                cellSize - 2
            );

            // 頭部加眼睛
            if (isHead) {
                ctx.fillStyle = '#1a1a2e';
                const eyeSize = 3;
                const eyeOffset = cellSize / 4;

                let eye1 = { x: 0, y: 0 };
                let eye2 = { x: 0, y: 0 };
                switch (gameState.direction) {
                    case 'UP':
                        eye1 = { x: -eyeOffset, y: -eyeOffset };
                        eye2 = { x: eyeOffset, y: -eyeOffset };
                        break;
                    case 'DOWN':
                        eye1 = { x: -eyeOffset, y: eyeOffset };
                        eye2 = { x: eyeOffset, y: eyeOffset };
                        break;
                    case 'LEFT':
                        eye1 = { x: -eyeOffset, y: -eyeOffset };
                        eye2 = { x: -eyeOffset, y: eyeOffset };
                        break;
                    case 'RIGHT':
                        eye1 = { x: eyeOffset, y: -eyeOffset };
                        eye2 = { x: eyeOffset, y: eyeOffset };
                        break;
                }

                const centerX = segment.x * cellSize + cellSize / 2;
                const centerY = segment.y * cellSize + cellSize / 2;

                ctx.beginPath();
                ctx.arc(centerX + eye1.x, centerY + eye1.y, eyeSize, 0, Math.PI * 2);
                ctx.fill();
                ctx.beginPath();
                ctx.arc(centerX + eye2.x, centerY + eye2.y, eyeSize, 0, Math.PI * 2);
                ctx.fill();
            }
        });

        // 遊戲結束畫面
        if (gameState.gameOver) {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
            ctx.fillRect(0, 0, width, height);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 24px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('Game Over', width / 2, height / 2 - 20);

            ctx.font = '18px sans-serif';
            ctx.fillText(`Score: ${gameState.score}`, width / 2, height / 2 + 10);
        }
    }, [gameState, gridWidth, gridHeight, cellSize, isAIMode]);

    // 觸控控制
    const handleDirectionClick = (dir: Direction) => {
        if (isPlaying && !isAIMode) {
            nextDirectionRef.current = dir;
        }
    };

    const canvasWidth = gridWidth * cellSize;
    const canvasHeight = gridHeight * cellSize;

    return (
        <div className="flex flex-col items-center gap-4">
            {/* 分數顯示 */}
            <div className="flex items-center gap-6 text-base-100">
                <span className="text-lg">🏆 分數: <strong className={isAIMode ? 'text-blue-400' : 'text-green-400'}>{gameState?.score ?? 0}</strong></span>
                <span className="text-lg">🐍 長度: <strong className={isAIMode ? 'text-blue-400' : 'text-green-400'}>{gameState?.snake.length ?? 0}</strong></span>
                {isAIMode && isPlaying && (
                    <div className="flex items-center gap-2">
                        <span className="text-blue-400 text-sm">🤖 AI 模式</span>
                        <div className="tooltip" data-tip="AI 飢餓度 (越高越急迫)">
                            <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-300 ${currentHunger > 0.8 ? 'bg-red-500' : 'bg-yellow-400'}`}
                                    style={{ width: `${currentHunger * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* 遊戲畫布 */}
            <div className="relative">
                <canvas
                    ref={canvasRef}
                    width={canvasWidth}
                    height={canvasHeight}
                    className="rounded-lg border-2 border-base-600"
                />

                {/* 開始按鈕 */}
                {!isPlaying && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/50 rounded-lg">
                        <button
                            onClick={() => startGame(false)}
                            className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg transition text-lg w-48"
                        >
                            ▶️ 玩家遊戲
                        </button>
                        <button
                            onClick={() => startGame(true)}
                            disabled={aiLoading}
                            className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition text-lg w-48 disabled:opacity-50"
                        >
                            {aiLoading ? '載入中...' : '🤖 AI 遊戲'}
                        </button>
                        {aiError && <p className="text-red-400 text-sm">{aiError}</p>}
                    </div>
                )}
            </div>

            {/* 手機觸控控制 */}
            {!isAIMode && (
                <div className="grid grid-cols-3 gap-2 lg:hidden">
                    <div></div>
                    <button
                        onClick={() => handleDirectionClick('UP')}
                        className="p-4 bg-base-700 hover:bg-base-600 rounded-lg text-2xl active:scale-95 transition"
                    >
                        ⬆️
                    </button>
                    <div></div>

                    <button
                        onClick={() => handleDirectionClick('LEFT')}
                        className="p-4 bg-base-700 hover:bg-base-600 rounded-lg text-2xl active:scale-95 transition"
                    >
                        ⬅️
                    </button>
                    <div className="p-4 bg-base-800 rounded-lg text-center text-base-400 text-sm">
                        🎮
                    </div>
                    <button
                        onClick={() => handleDirectionClick('RIGHT')}
                        className="p-4 bg-base-700 hover:bg-base-600 rounded-lg text-2xl active:scale-95 transition"
                    >
                        ➡️
                    </button>

                    <div></div>
                    <button
                        onClick={() => handleDirectionClick('DOWN')}
                        className="p-4 bg-base-700 hover:bg-base-600 rounded-lg text-2xl active:scale-95 transition"
                    >
                        ⬇️
                    </button>
                    <div></div>
                </div>
            )}

            {/* 操作說明 */}
            <p className="text-base-400 text-sm text-center">
                {isAIMode
                    ? '🤖 DQN 強化學習 AI 自動遊戲中...'
                    : <>使用 <kbd className="px-1.5 py-0.5 bg-base-700 rounded text-xs">↑ ↓ ← →</kbd> 或
                        <kbd className="px-1.5 py-0.5 bg-base-700 rounded text-xs ml-1">W A S D</kbd> 控制方向</>
                }
            </p>
        </div>
    );
}

export default SnakeGame;

