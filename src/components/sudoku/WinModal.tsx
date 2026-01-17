import React from 'react';
import { useGameStore } from '../../store/gameStore';
import { formatTime } from '../../lib/sudoku/utils';

export const WinModal: React.FC = () => {
    const { status, newGame, difficulty, timer, mistakes } = useGameStore();

    if (status !== 'won') return null;

    return (
        <div className="fixed inset-0 bg-black/80 flex flex-col items-center justify-center z-50 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-[#002b36] p-8 rounded-3xl border-2 border-sudoku-text-user shadow-2xl max-w-sm w-full text-center relative overflow-hidden">

                {/* Confetti-like effect background (implied or use a library later) */}

                <h2 className="text-4xl font-black text-sudoku-text-user mb-2 tracking-widest uppercase animate-bounce">
                    Solved!
                </h2>

                <p className="text-sudoku-text mb-8 tracking-widest text-xs uppercase opacity-80">
                    Pure Logic Mastered
                </p>

                <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-[#073642] p-4 rounded-xl flex flex-col">
                        <span className="text-[0.6rem] uppercase tracking-widest text-sudoku-text opacity-60">Time</span>
                        <span className="text-xl font-bold text-[#fdf6e3]">{formatTime(timer, 'full')}</span>
                    </div>
                    <div className="bg-[#073642] p-4 rounded-xl flex flex-col">
                        <span className="text-[0.6rem] uppercase tracking-widest text-sudoku-text opacity-60">Mistakes</span>
                        <span className={`text-xl font-bold ${mistakes === 0 ? 'text-[#fdf6e3]' : 'text-red-400'}`}>
                            {mistakes}
                        </span>
                    </div>
                </div>

                <button
                    onClick={() => newGame(difficulty)}
                    className="w-full py-4 bg-sudoku-text-user text-[#002b36] font-bold uppercase tracking-widest rounded-xl hover:brightness-110 active:scale-95 transition-all shadow-lg shadow-sudoku-text-user/20"
                >
                    Play Again
                </button>
            </div>
        </div>
    );
};
