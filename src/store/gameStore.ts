import { create } from 'zustand';
import { SudokuEngine } from '../lib/sudoku/SudokuEngine';
import { BacktrackingGenerator } from '../lib/sudoku/BacktrackingGenerator';
import { BacktrackingSolver } from '../lib/sudoku/BacktrackingSolver';
import { Difficulty, type Grid, type SudokuValue, type Position } from '../lib/sudoku/types';

// --- Create Engine Instance (Dependency Injection) ---
const generator = new BacktrackingGenerator();
const solver = new BacktrackingSolver();
const engine = new SudokuEngine(generator, solver);

// --- State Types ---
interface GameState {
    grid: Grid;
    status: 'idle' | 'playing' | 'paused' | 'won';
    difficulty: Difficulty;
    timer: number;
    mistakes: number;
    history: Grid[];
    historyIndex: number;
}

interface GameActions {
    newGame: (difficulty?: Difficulty) => void;
    selectCell: (row: number, col: number) => void;
    setCellValue: (value: SudokuValue) => void;
    toggleNote: (value: number) => void;
    erase: () => void;
    undo: () => void;
    redo: () => void;
}

type GameStore = GameState & GameActions;

// --- Store Definition ---
export const useGameStore = create<GameStore>((set, get) => ({
    // Initial State
    grid: [],
    status: 'idle',
    difficulty: Difficulty.Easy,
    timer: 0,
    mistakes: 0,
    history: [],
    historyIndex: -1,

    // Actions (delegate to engine)
    newGame: (difficulty = Difficulty.Easy) => {
        const grid = engine.createGame(difficulty);
        set({
            grid,
            status: 'playing',
            difficulty,
            timer: 0,
            mistakes: 0,
            history: [grid],
            historyIndex: 0
        });
    },

    selectCell: (row, col) => {
        set(state => ({
            grid: engine.selectCell(state.grid, row, col)
        }));
    },

    setCellValue: (value) => {
        const state = get();
        const pos = engine.getSelectedPosition(state.grid);
        if (!pos) return;

        const newGrid = engine.setCellValue(state.grid, pos.row, pos.col, value);
        if (!newGrid) return; // Cell was fixed

        const validatedGrid = engine.validateGrid(newGrid);
        const preservedGrid = engine.selectCell(validatedGrid, pos.row, pos.col);

        // Check for win
        const isWon = engine.isComplete(preservedGrid);

        set({
            grid: preservedGrid,
            status: isWon ? 'won' : 'playing',
            history: [...state.history.slice(0, state.historyIndex + 1), preservedGrid],
            historyIndex: state.historyIndex + 1
        });
    },

    toggleNote: (value) => {
        const state = get();
        const pos = engine.getSelectedPosition(state.grid);
        if (!pos) return;

        const newGrid = engine.toggleNote(state.grid, pos.row, pos.col, value);
        if (!newGrid) return;

        const preservedGrid = engine.selectCell(newGrid, pos.row, pos.col);
        set({ grid: preservedGrid });
    },

    erase: () => {
        get().setCellValue(null);
    },

    undo: () => {
        const state = get();
        if (state.historyIndex > 0) {
            const prevGrid = state.history[state.historyIndex - 1];
            set({
                grid: prevGrid,
                historyIndex: state.historyIndex - 1
            });
        }
    },

    redo: () => {
        const state = get();
        if (state.historyIndex < state.history.length - 1) {
            const nextGrid = state.history[state.historyIndex + 1];
            set({
                grid: nextGrid,
                historyIndex: state.historyIndex + 1
            });
        }
    }
}));
