import React, { useState } from 'react';
import { useGameStore } from '../../store/gameStore';
import { Difficulty } from '../../lib/sudoku/types';
import type { SudokuValue } from '../../lib/sudoku/types';
import { twMerge } from 'tailwind-merge';

// Simple inline SVG icons
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

const ActionButton: React.FC<{
    onClick: () => void;
    label: string;
    icon: React.ReactNode;
    active?: boolean;
    disabled?: boolean;
}> = ({ onClick, label, icon, active, disabled }) => (
    <button
        onClick={onClick}
        disabled={disabled}
        className={twMerge(
            "flex flex-col items-center gap-1 px-4 py-2 bg-transparent border-none rounded-lg transition-colors duration-200 cursor-pointer",
            "text-sudoku-text hover:bg-sudoku-button-hover hover:text-sudoku-text-fixed",
            active && "text-sudoku-cell-bg-selected",
            disabled && "opacity-50 cursor-not-allowed hover:bg-transparent hover:text-sudoku-text"
        )}
    >
        {icon}
        <span className="text-[0.7rem] uppercase tracking-wider font-medium">{label}</span>
    </button>
);

const NumButton: React.FC<{ num: number; onClick: () => void }> = ({ num, onClick }) => (
    <button
        onClick={onClick}
        className={twMerge(
            "aspect-square flex items-center justify-center text-2xl font-light",
            "bg-sudoku-button-bg text-sudoku-text-user rounded-xl shadow-[0_4px_0_#002b36]",
            "border-none cursor-pointer transition-all duration-100",
            "hover:brightness-125 active:translate-y-1 active:shadow-none"
        )}
    >
        {num}
    </button>
);

export const Controls: React.FC = () => {
    const { setCellValue, newGame, erase, toggleNote, undo, historyIndex } = useGameStore();
    const [noteMode, setNoteMode] = useState(false);

    const handleNumber = (num: number) => {
        if (noteMode) {
            toggleNote(num);
        } else {
            setCellValue(num as SudokuValue);
        }
    };

    return (
        <div className="flex flex-col gap-4 mt-6 w-full max-w-[450px] mx-auto">
            {/* Action Bar */}
            <div className="flex justify-around items-center">
                <ActionButton
                    onClick={undo}
                    label="Undo"
                    icon={<UndoIcon />}
                    disabled={historyIndex <= 0}
                />
                <ActionButton onClick={erase} label="Erase" icon={<EraseIcon />} />
                <ActionButton
                    onClick={() => setNoteMode(!noteMode)}
                    label="Notes"
                    icon={<NotesIcon />}
                    active={noteMode}
                />
                <ActionButton onClick={() => newGame(Difficulty.Easy)} label="New" icon={<NewGameIcon />} />
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-5 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                    <NumButton key={num} num={num} onClick={() => handleNumber(num)} />
                ))}
            </div>
        </div>
    );
};
