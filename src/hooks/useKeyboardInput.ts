import { useEffect } from 'react';
import { useGameStore } from '../store/gameStore';
import type { SudokuValue } from '../lib/sudoku/types';

export const useKeyboardInput = () => {
    const {
        setCellValue,
        toggleNote,
        undo,
        redo,
        deleteCellValue,
        moveSelection
    } = useGameStore();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ignore if inside an input field
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            const { key, shiftKey, metaKey, ctrlKey } = e;
            const isCmd = metaKey || ctrlKey;

            // --- Navigation (Arrow Keys) ---
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key)) {
                e.preventDefault();
                const direction = key.replace('Arrow', '').toLowerCase() as 'up' | 'down' | 'left' | 'right';
                moveSelection(direction);
                return;
            }

            // --- Actions ---

            // Undo/Redo
            if (isCmd && key.toLowerCase() === 'z') {
                e.preventDefault();
                if (shiftKey) {
                    redo();
                } else {
                    undo();
                }
                return;
            }

            // Delete / Backspace
            if (key === 'Backspace' || key === 'Delete') {
                deleteCellValue();
                return;
            }

            // --- Number Input ---
            const num = parseInt(key);
            if (!isNaN(num) && num >= 1 && num <= 9) {
                // Shift + Number = Toggle Note
                // OR standard pencil mode toggle (handled in component state usually, but let's support shift modifier)
                // For now, let's assume Shift implies Note
                if (shiftKey) {
                    toggleNote(num);
                } else {
                    setCellValue(num as SudokuValue);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [setCellValue, toggleNote, undo, redo, deleteCellValue, moveSelection]);
};
