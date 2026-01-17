import React, { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Cell } from './Cell';
import { useKeyboardInput } from '../../hooks/useKeyboardInput';

export const SudokuBoard: React.FC = () => {
    const { grid, newGame, status } = useGameStore();

    // Enable keyboard support
    useKeyboardInput();

    useEffect(() => {
        if (status === 'idle') {
            newGame();
        }
    }, [status, newGame]);

    if (!grid || grid.length === 0) {
        return (
            <div className="flex items-center justify-center p-12 text-sudoku-text animate-pulse">
                Starting Sudoku Engine...
            </div>
        );
    }

    return (
        <div className="grid grid-cols-9 grid-rows-9 w-full max-w-[450px] aspect-square mx-auto border-[3px] border-sudoku-border-block rounded-lg overflow-hidden bg-sudoku-border gap-px shadow-2xl">
            {grid.map((row) =>
                row.map((cell) => <Cell key={cell.id} cell={cell} />)
            )}
        </div>
    );
};
