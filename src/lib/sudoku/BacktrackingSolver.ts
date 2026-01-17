import type { ISudokuSolver } from './interfaces';
import type { Grid, SudokuValue } from './types';
import { GRID_SIZE, BLOCK_SIZE } from './constants';

/**
 * BacktrackingSolver implements ISudokuSolver using a classic backtracking algorithm.
 */
export class BacktrackingSolver implements ISudokuSolver {

    isValidMove(grid: Grid, row: number, col: number, value: SudokuValue): boolean {
        if (value === null) return true; // Erasing is always valid

        // Check row
        for (let i = 0; i < GRID_SIZE; i++) {
            if (i !== col && grid[row][i].value === value) return false;
        }

        // Check column
        for (let i = 0; i < GRID_SIZE; i++) {
            if (i !== row && grid[i][col].value === value) return false;
        }

        // Check 3x3 block
        const startRow = row - (row % BLOCK_SIZE);
        const startCol = col - (col % BLOCK_SIZE);
        for (let r = startRow; r < startRow + BLOCK_SIZE; r++) {
            for (let c = startCol; c < startCol + BLOCK_SIZE; c++) {
                if ((r !== row || c !== col) && grid[r][c].value === value) return false;
            }
        }

        return true;
    }

    solve(grid: Grid): Grid | null {
        // Convert to simple number array for efficiency
        const board = this.gridToBoard(grid);
        if (this.solveBoard(board)) {
            return this.boardToGrid(board, grid);
        }
        return null;
    }

    countSolutions(grid: Grid): number {
        const board = this.gridToBoard(grid);
        return this.countBoardSolutions(board);
    }

    // --- Internal helpers ---

    private gridToBoard(grid: Grid): number[][] {
        return grid.map(row => row.map(cell => cell.value ?? 0));
    }

    private boardToGrid(board: number[][], original: Grid): Grid {
        return original.map((row, r) =>
            row.map((cell, c) => ({
                ...cell,
                value: board[r][c] as SudokuValue,
                notes: [...cell.notes]
            }))
        );
    }

    private isValidBoardMove(board: number[][], row: number, col: number, num: number): boolean {
        for (let i = 0; i < GRID_SIZE; i++) {
            if (board[row][i] === num) return false;
            if (board[i][col] === num) return false;
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

    private solveBoard(board: number[][]): boolean {
        for (let row = 0; row < GRID_SIZE; row++) {
            for (let col = 0; col < GRID_SIZE; col++) {
                if (board[row][col] === 0) {
                    for (let num = 1; num <= GRID_SIZE; num++) {
                        if (this.isValidBoardMove(board, row, col, num)) {
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

    private countBoardSolutions(board: number[][]): number {
        let count = 0;

        const solve = (b: number[][]): void => {
            for (let row = 0; row < GRID_SIZE; row++) {
                for (let col = 0; col < GRID_SIZE; col++) {
                    if (b[row][col] === 0) {
                        for (let num = 1; num <= GRID_SIZE; num++) {
                            if (this.isValidBoardMove(b, row, col, num)) {
                                b[row][col] = num;
                                solve(b);
                                if (count > 1) return; // Optimization: stop early
                                b[row][col] = 0;
                            }
                        }
                        return;
                    }
                }
            }
            count++;
        };

        const clone = board.map(row => [...row]);
        solve(clone);
        return count;
    }
}
