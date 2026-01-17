import type { Difficulty, Grid, SudokuValue } from './types';

/**
 * Interface for Sudoku puzzle generation.
 * Implementations can vary (e.g., backtracking, constraint propagation).
 */
export interface ISudokuGenerator {
    /**
     * Generates a new Sudoku puzzle.
     * @param difficulty - The difficulty level of the puzzle.
     * @returns A Grid representing the puzzle (with some cells empty).
     */
    generate(difficulty: Difficulty): Grid;
}

/**
 * Interface for Sudoku puzzle solving.
 * Implementations can vary (e.g., backtracking, Dancing Links).
 */
export interface ISudokuSolver {
    /**
     * Attempts to solve the given Sudoku puzzle.
     * @param grid - The puzzle to solve.
     * @returns The solved Grid, or null if unsolvable.
     */
    solve(grid: Grid): Grid | null;

    /**
     * Checks if placing a value at a position is valid according to Sudoku rules.
     * @param grid - The current grid state.
     * @param row - Row index (0-8).
     * @param col - Column index (0-8).
     * @param value - The value to check.
     * @returns True if the move is valid, false otherwise.
     */
    isValidMove(grid: Grid, row: number, col: number, value: SudokuValue): boolean;

    /**
     * Counts the number of solutions for a given puzzle.
     * Useful for verifying unique solutions during generation.
     * @param grid - The puzzle to check.
     * @returns The number of solutions (stops counting after 2 for efficiency).
     */
    countSolutions(grid: Grid): number;
}
