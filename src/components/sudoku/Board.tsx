import React, { useEffect } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Cell } from './Cell';
import styles from './sudoku.module.css';

export const SudokuBoard: React.FC = () => {
    const { grid, newGame, status } = useGameStore();

    useEffect(() => {
        if (status === 'idle') {
            newGame();
        }
    }, [status, newGame]);

    if (!grid || grid.length === 0) {
        return <div className={styles.loading}>Starting Sudoku Engine...</div>;
    }

    return (
        <div className={styles.board}>
            {grid.map((row) =>
                row.map((cell) => <Cell key={cell.id} cell={cell} />)
            )}
        </div>
    );
};
