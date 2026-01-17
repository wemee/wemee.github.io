import type { ISudokuGenerator, ISudokuSolver } from './interfaces';
import type { Cell, Difficulty, Grid, Position, SudokuValue } from './types';
import { GRID_SIZE, BLOCK_SIZE } from './constants';

/**
 * SudokuEngine is the core business logic class.
 * It is framework-agnostic (no React, no Zustand dependencies).
 * It receives generator and solver implementations via constructor (Dependency Injection).
 */
export class SudokuEngine {
    private generator: ISudokuGenerator;
    private solver: ISudokuSolver;

    constructor(generator: ISudokuGenerator, solver: ISudokuSolver) {
        this.generator = generator;
        this.solver = solver;
    }

    /**
     * Creates a new Sudoku game.
     */
    createGame(difficulty: Difficulty): Grid {
        return this.generator.generate(difficulty);
    }

    /**
     * Deep clones a Grid to avoid mutation issues.
     */
    cloneGrid(grid: Grid): Grid {
        return grid.map(row => row.map(cell => ({ ...cell, notes: [...cell.notes] })));
    }

    /**
     * Sets a value in a cell. Returns a new Grid (immutable update).
     * Returns null if the cell is fixed.
     */
    setCellValue(grid: Grid, row: number, col: number, value: SudokuValue): Grid | null {
        const cell = grid[row][col];
        if (cell.isFixed) return null;

        const newGrid = this.cloneGrid(grid);
        newGrid[row][col].value = value;
        newGrid[row][col].notes = []; // Clear notes when value is set

        return newGrid;
    }

    /**
     * Toggles a note (pencil mark) on a cell. Returns a new Grid.
     * Returns null if the cell is fixed or already has a value.
     */
    toggleNote(grid: Grid, row: number, col: number, note: number): Grid | null {
        const cell = grid[row][col];
        if (cell.isFixed || cell.value !== null) return null;

        const newGrid = this.cloneGrid(grid);
        const notes = newGrid[row][col].notes;

        if (notes.includes(note)) {
            newGrid[row][col].notes = notes.filter(n => n !== note);
        } else {
            newGrid[row][col].notes = [...notes, note].sort((a, b) => a - b);
        }

        return newGrid;
    }

    /**
     * Erases the value of a cell. Returns a new Grid.
     * Returns null if the cell is fixed.
     */
    eraseCell(grid: Grid, row: number, col: number): Grid | null {
        return this.setCellValue(grid, row, col, null);
    }

    /**
     * Updates selection and related highlighting. Returns a new Grid.
     */
    selectCell(grid: Grid, row: number, col: number): Grid {
        return grid.map(r =>
            r.map(cell => ({
                ...cell,
                notes: [...cell.notes], // Preserve notes
                isSelected: cell.row === row && cell.col === col,
                isRelated:
                    cell.row === row ||
                    cell.col === col ||
                    (Math.floor(cell.row / BLOCK_SIZE) === Math.floor(row / BLOCK_SIZE) &&
                        Math.floor(cell.col / BLOCK_SIZE) === Math.floor(col / BLOCK_SIZE))
            }))
        );
    }

    /**
     * Finds the currently selected cell position.
     */
    getSelectedPosition(grid: Grid): Position | null {
        for (const row of grid) {
            for (const cell of row) {
                if (cell.isSelected) {
                    return { row: cell.row, col: cell.col };
                }
            }
        }
        return null;
    }

    /**
     * Validates the entire grid for conflicts.
     * Marks cells with `isValid = false` if they conflict with Sudoku rules.
     * Returns a new Grid with validation state updated.
     */
    validateGrid(grid: Grid): Grid {
        const newGrid = this.cloneGrid(grid);

        // Reset all validity
        for (const row of newGrid) {
            for (const cell of row) {
                cell.isValid = true;
            }
        }

        // Check each filled cell for conflicts
        for (let r = 0; r < GRID_SIZE; r++) {
            for (let c = 0; c < GRID_SIZE; c++) {
                const cell = newGrid[r][c];
                if (cell.value === null) continue;

                // Check row
                for (let i = 0; i < GRID_SIZE; i++) {
                    if (i !== c && newGrid[r][i].value === cell.value) {
                        cell.isValid = false;
                        newGrid[r][i].isValid = false;
                    }
                }

                // Check column
                for (let i = 0; i < GRID_SIZE; i++) {
                    if (i !== r && newGrid[i][c].value === cell.value) {
                        cell.isValid = false;
                        newGrid[i][c].isValid = false;
                    }
                }

                // Check block
                const blockRowStart = Math.floor(r / BLOCK_SIZE) * BLOCK_SIZE;
                const blockColStart = Math.floor(c / BLOCK_SIZE) * BLOCK_SIZE;
                for (let br = blockRowStart; br < blockRowStart + BLOCK_SIZE; br++) {
                    for (let bc = blockColStart; bc < blockColStart + BLOCK_SIZE; bc++) {
                        if ((br !== r || bc !== c) && newGrid[br][bc].value === cell.value) {
                            cell.isValid = false;
                            newGrid[br][bc].isValid = false;
                        }
                    }
                }
            }
        }

        return newGrid;
    }

    /**
     * Checks if the puzzle is complete (all cells filled and valid).
     */
    isComplete(grid: Grid): boolean {
        for (const row of grid) {
            for (const cell of row) {
                if (cell.value === null || !cell.isValid) {
                    return false;
                }
            }
        }
        return true;
    }
}
