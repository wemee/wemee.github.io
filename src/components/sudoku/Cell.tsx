import React from 'react';
import { useGameStore } from '../../store/gameStore';
import type { Cell as CellType } from '../../lib/sudoku/types';
import styles from './sudoku.module.css';

interface CellProps {
    cell: CellType;
}

export const Cell: React.FC<CellProps> = ({ cell }) => {
    const selectCell = useGameStore((state) => state.selectCell);

    const handleClick = () => {
        selectCell(cell.row, cell.col);
    };

    // Determine CSS classes based on cell state
    const classNames = [styles.cell];

    if (cell.isFixed) classNames.push(styles.cellFixed);
    if (cell.isSelected) classNames.push(styles.cellSelected);
    else if (cell.isRelated) classNames.push(styles.cellRelated);
    if (!cell.isValid) classNames.push(styles.cellError);

    // Block borders (thicker lines for 3x3 blocks)
    if ((cell.col + 1) % 3 === 0 && cell.col !== 8) {
        classNames.push(styles.cellRightBorder);
    }
    if ((cell.row + 1) % 3 === 0 && cell.row !== 8) {
        classNames.push(styles.cellBottomBorder);
    }

    // Render notes if no value
    const renderNotes = () => (
        <div className={styles.notes}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
                <div key={num} className={styles.note}>
                    {cell.notes.includes(num) ? num : ''}
                </div>
            ))}
        </div>
    );

    return (
        <div onClick={handleClick} className={classNames.join(' ')}>
            {cell.value ? cell.value : renderNotes()}
        </div>
    );
};
