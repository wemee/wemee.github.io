import React, { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { formatTime } from '../../lib/sudoku/utils';

export const GameInfo: React.FC = () => {
    const { difficulty, mistakes, timer, tickTimer, status } = useGameStore();

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (status === 'playing') {
            interval = setInterval(tickTimer, 1000);
        }
        return () => clearInterval(interval);
    }, [status, tickTimer]);

    return (
        <div className="flex justify-between items-center w-full max-w-[450px] mb-4 text-sudoku-text text-sm font-medium uppercase tracking-wider">
            <div className="flex flex-col items-start">
                <span className="text-[0.6rem] opacity-60">Difficulty</span>
                <span className="text-sudoku-text-user">{difficulty}</span>
            </div>

            <div className="flex flex-col items-center">
                <span className="text-[0.6rem] opacity-60">Mistakes</span>
                <span className={`${mistakes > 0 ? 'text-red-400' : 'text-sudoku-text'}`}>
                    {mistakes}/3
                </span>
            </div>

            <div className="flex flex-col items-end">
                <span className="text-[0.6rem] opacity-60">Time</span>
                <span className="tabular-nums">{formatTime(timer)}</span>
            </div>
        </div>
    );
};
