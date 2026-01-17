import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Difficulty, type SudokuValue } from '../../lib/sudoku/types';
import styles from './sudoku.module.css';

// Simple inline SVG icons to avoid external dependencies
const EraseIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M7 21h10M19 10.5L9.5 20M5.5 13.5 15 4l5 5-9.5 9.5-5-5z" />
    </svg>
);

const NotesIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
);

const NewGameIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 5v14M5 12h14" />
    </svg>
);

const UndoIcon = () => (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 7v6h6M3 13a9 9 0 1 0 2.83-6.36L3 9" />
    </svg>
);

export const Controls: React.FC = () => {
    const { setCellValue, newGame, erase, toggleNote, undo, redo, historyIndex, history } = useGameStore();
    const [noteMode, setNoteMode] = useState(false);

    const handleNumber = (num: number) => {
        if (noteMode) {
            toggleNote(num);
        } else {
            setCellValue(num as SudokuValue);
        }
    };

    return (
        <div className={styles.controls}>
            {/* Action Bar */}
            <div className={styles.actionBar}>
                <button onClick={undo} className={styles.actionButton} disabled={historyIndex <= 0}>
                    <UndoIcon />
                    <span className={styles.actionLabel}>Undo</span>
                </button>

                <button onClick={erase} className={styles.actionButton}>
                    <EraseIcon />
                    <span className={styles.actionLabel}>Erase</span>
                </button>

                <button
                    onClick={() => setNoteMode(!noteMode)}
                    className={`${styles.actionButton} ${noteMode ? styles.actionButtonActive : ''}`}
                >
                    <NotesIcon />
                    <span className={styles.actionLabel}>Notes</span>
                </button>

                <button onClick={() => newGame(Difficulty.Easy)} className={styles.actionButton}>
                    <NewGameIcon />
                    <span className={styles.actionLabel}>New</span>
                </button>
            </div>

            {/* Numpad */}
            <div className={styles.numpad}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <button key={num} onClick={() => handleNumber(num)} className={styles.numButton}>
                        {num}
                    </button>
                ))}
            </div>
        </div>
    );
};
