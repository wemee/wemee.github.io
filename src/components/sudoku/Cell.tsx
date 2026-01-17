import React from 'react';
import { useGameStore } from '../../store/gameStore';
import type { Cell as CellType } from '../../lib/sudoku/types';
import { twMerge } from 'tailwind-merge';

interface CellProps {
    cell: CellType;
}

export const Cell: React.FC<CellProps> = ({ cell }) => {
    const selectCell = useGameStore((state) => state.selectCell);

    const handleClick = () => {
        selectCell(cell.row, cell.col);
    };

    const isThickRight = (cell.col + 1) % 3 === 0 && cell.col !== 8;
    const isThickBottom = (cell.row + 1) % 3 === 0 && cell.row !== 8;

    const baseClasses = "flex items-center justify-center text-2xl font-medium cursor-pointer select-none transition-all duration-150 relative hover:brightness-110 active:scale-95";

    const classes = twMerge(
        baseClasses,
        "bg-sudoku-cell-bg text-sudoku-text-user",
        // Fixed value
        cell.isFixed && "bg-sudoku-cell-bg-fixed text-sudoku-text-fixed font-bold",
        // Selection and Relation
        cell.isSelected && "bg-sudoku-cell-bg-selected text-sudoku-text-selected z-10",
        (!cell.isSelected && cell.isRelated) && "bg-sudoku-cell-bg-related",
        // Errors
        !cell.isValid && "bg-sudoku-cell-bg-error text-red-500",
        // Borders
        isThickRight && "border-r-2 border-sudoku-border-block",
        isThickBottom && "border-b-2 border-sudoku-border-block"
    );

    // Notes Grid
    const renderNotes = () => (
        <div className="grid grid-cols-3 grid-rows-3 w-full h-full pointer-events-none p-0.5">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <div key={num} className="flex items-center justify-center text-[0.6rem] leading-none text-sudoku-text opacity-70">
                    {cell.notes.includes(num) ? num : ''}
                </div>
            ))}
        </div>
    );

    return (
        <div onClick={handleClick} className={classes}>
            {cell.value ? cell.value : renderNotes()}
        </div>
    );
};
