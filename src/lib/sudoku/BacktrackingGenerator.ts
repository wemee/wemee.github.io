import type { ISudokuGenerator, ISudokuSolver } from './interfaces';
import type { Cell, Difficulty, Grid, SudokuValue } from './types';
import { GRID_SIZE, BLOCK_SIZE } from './constants';
import { BacktrackingSolver } from './BacktrackingSolver';

/**
 * Clues to keep for each difficulty level.
 * Fewer clues = harder puzzle.
 * 17 is the theoretical minimum for a unique solution.
 */
const DIFFICULTY_CLUE_COUNT: Record<Difficulty, number> = {
    Easy: 38,
    Medium: 30,
    Hard: 25,
    Expert: 22,
    Master: 17
};

/**
 * BacktrackingGenerator implements ISudokuGenerator.
 * It creates a full valid board, then removes cells based on difficulty.
 */
export class BacktrackingGenerator implements ISudokuGenerator {
    private solver: ISudokuSolver;

    constructor(solver?: ISudokuSolver) {
        this.solver = solver ?? new BacktrackingSolver();
    }

    generate(difficulty: Difficulty): Grid {
        // 1. Create a full, valid solution
        const board = this.createFullBoard();

        // 2. Remove cells to create puzzle
        const cluesToKeep = DIFFICULTY_CLUE_COUNT[difficulty];
        const cellsToRemove = (GRID_SIZE * GRID_SIZE) - cluesToKeep;
        this.removeNumbers(board, cellsToRemove);

        // 3. Convert to Grid structure
        return this.boardToGrid(board);
    }

    // --- Internal helpers ---

    private createFullBoard(): number[][] {
        const board = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(0));

        // Fill diagonal 3x3 blocks (they are independent, no conflicts)
        for (let i = 0; i < GRID_SIZE; i += BLOCK_SIZE) {
            this.fillBox(board, i, i);
        }

        // Fill the rest using backtracking
        this.solveBoard(board);

        return board;
    }

    private fillBox(board: number[][], rowStart: number, colStart: number): void {
        const nums = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
        let idx = 0;
        for (let r = rowStart; r < rowStart + BLOCK_SIZE; r++) {
            for (let c = colStart; c < colStart + BLOCK_SIZE; c++) {
                board[r][c] = nums[idx++];
            }
        }
    }

    private solveBoard(board: number[][]): boolean {
        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE; col++) {
                if (board[row][col] === 0) {
                    const nums = this.shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]);
                    for (const num of nums) {
                        if (this.isValidMove(board, row, col, num)) {
                            board[row][col] = num;
                            if (this.solveBoard(board)) return true;
                            board[row][col] = 0;
                        }
                    }
                    return false;
                }
            }
        }
        return true;
    }

    private isValidMove(board: number[][], row: number, col: number, num: number): boolean {
        for (let i = 0; i < GRID_SIZE; i++) {
            if (board[row][i] === num || board[i][col] === num) return false;
        }

        const startRow = row - (row % BLOCK_SIZE);
        const startCol = col - (col % BLOCK_SIZE);
        for (let r = startRow; r < startRow + BLOCK_SIZE; r++) {
            for (let c = startCol; c < startCol + BLOCK_SIZE; c++) {
                if (board[r][c] === num) return false;
            }
        }

        return true;
    }

    private removeNumbers(board: number[][], count: number): void {
        let removed = 0;
        const maxAttempts = count * 4; // Safety limit
        let attempts = 0;

        while (removed < count && attempts < maxAttempts) {
            const row = Math.floor(Math.random() * GRID_SIZE);
            const col = Math.floor(Math.random() * GRID_SIZE);

            if (board[row][col] !== 0) {
                // For strict unique solution checking, we could use countSolutions here
                // but for performance in MVP, we trust the generation process
                board[row][col] = 0;
                removed++;
            }
            attempts++;
        }
    }

    private shuffle<T>(array: T[]): T[] {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    }

    private boardToGrid(board: number[][]): Grid {
        return board.map((row, rowIndex) =>
            row.map((val, colIndex) => ({
                id: `${rowIndex}-${colIndex}`,
                row: rowIndex,
                col: colIndex,
                value: val === 0 ? null : (val as SudokuValue),
                isFixed: val !== 0,
                isValid: true,
                isSelected: false,
                isRelated: false,
                notes: []
            }))
        );
    }
}
