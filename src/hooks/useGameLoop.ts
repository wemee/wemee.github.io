/**
 * 遊戲循環 Hook
 * 通用的 requestAnimationFrame 封裝
 */

import { useRef, useCallback, useEffect } from 'react';

interface UseGameLoopOptions {
    /** 每幀回調，參數為 deltaTime (ms) */
    onTick: (deltaTime: number) => void;
    /** 是否自動開始 */
    autoStart?: boolean;
    /** 目標 FPS（可選，用於限制更新頻率） */
    targetFps?: number;
}

interface UseGameLoopReturn {
    start: () => void;
    stop: () => void;
    pause: () => void;
    resume: () => void;
    isRunning: boolean;
}

export function useGameLoop({
    onTick,
    autoStart = false,
    targetFps,
}: UseGameLoopOptions): UseGameLoopReturn {
    const rafIdRef = useRef<number | null>(null);
    const lastTimeRef = useRef<number>(0);
    const isRunningRef = useRef<boolean>(false);
    const isPausedRef = useRef<boolean>(false);
    const onTickRef = useRef(onTick);

    // 保持 onTick 最新
    useEffect(() => {
        onTickRef.current = onTick;
    }, [onTick]);

    const minFrameTime = targetFps ? 1000 / targetFps : 0;

    const loop = useCallback((currentTime: number) => {
        if (!isRunningRef.current) return;

        const deltaTime = currentTime - lastTimeRef.current;

        // 如果有目標 FPS，限制更新頻率
        if (deltaTime >= minFrameTime) {
            if (!isPausedRef.current) {
                onTickRef.current(deltaTime);
            }
            lastTimeRef.current = currentTime;
        }

        rafIdRef.current = requestAnimationFrame(loop);
    }, [minFrameTime]);

    const start = useCallback(() => {
        if (isRunningRef.current) return;
        isRunningRef.current = true;
        isPausedRef.current = false;
        lastTimeRef.current = performance.now();
        rafIdRef.current = requestAnimationFrame(loop);
    }, [loop]);

    const stop = useCallback(() => {
        isRunningRef.current = false;
        isPausedRef.current = false;
        if (rafIdRef.current !== null) {
            cancelAnimationFrame(rafIdRef.current);
            rafIdRef.current = null;
        }
    }, []);

    const pause = useCallback(() => {
        isPausedRef.current = true;
    }, []);

    const resume = useCallback(() => {
        isPausedRef.current = false;
        lastTimeRef.current = performance.now();
    }, []);

    // 自動開始
    useEffect(() => {
        if (autoStart) {
            start();
        }
        return () => stop();
    }, [autoStart, start, stop]);

    return {
        start,
        stop,
        pause,
        resume,
        get isRunning() {
            return isRunningRef.current;
        },
    };
}

export default useGameLoop;
