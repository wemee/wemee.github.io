export type SudokuValue = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | null;

export enum Difficulty {
    Easy = 'Easy',
    Medium = 'Medium',
    Hard = 'Hard',
    Expert = 'Expert',
    Master = 'Master' // For the insane ones
}

export interface Position {
    row: number; // 0-8
    col: number; // 0-8
}

export interface Cell {
    id: string;          // Unique ID for React keys (e.g., "0-0", "8-8")
    row: number;
    col: number;
    value: SudokuValue;

    // State flags
    isFixed: boolean;    // Initial clue, cannot be changed
    isValid: boolean;    // For conflict checking (red highlight)
    isSelected: boolean; // Currently focused
    isRelated: boolean;  // Same row/col/block (for visual guide)

    // Notes / Pencil marks
    notes: number[];     // User-entered candidates
}

export type Grid = Cell[][];

export interface GameState {
    grid: Grid;
    status: 'idle' | 'playing' | 'paused' | 'won' | 'lost';
    difficulty: Difficulty;
    timer: number;       // Seconds
    mistakes: number;    // Counter for errors
    history: Grid[];     // For undo functionality (simplified snapshot)
    historyIndex: number;
}
