// Common UI Components based on Headless UI
// Using Solar theme colors from Tailwind config

export { Modal } from './Modal';
export { Tabs } from './Tabs';

// Common button styles for use across the app
export const buttonStyles = {
    primary: 'px-4 py-2 rounded bg-accent-blue hover:bg-accent-blue/80 text-base-50 font-medium transition',
    secondary: 'px-4 py-2 rounded border border-base-600 text-base-400 hover:bg-base-600 hover:text-base-50 transition',
    success: 'px-4 py-2 rounded bg-accent-green hover:bg-accent-green/80 text-base-50 font-medium transition',
    danger: 'px-4 py-2 rounded bg-accent-red hover:bg-accent-red/80 text-base-50 font-medium transition',
    warning: 'px-4 py-2 rounded bg-accent-yellow hover:bg-accent-yellow/80 text-base-900 font-medium transition',
    ghost: 'px-4 py-2 rounded text-base-400 hover:bg-base-600/50 hover:text-base-50 transition',
};

// Common input styles
export const inputStyles = {
    base: 'w-full px-3 py-2 bg-base-900 border border-base-600 rounded text-base-50 placeholder:text-base-600 focus:border-accent-blue focus:outline-none transition',
    error: 'w-full px-3 py-2 bg-base-900 border border-accent-red rounded text-base-50 focus:outline-none',
};

// Card component styles
export const cardStyles = {
    container: 'rounded-lg border border-base-600 bg-base-800 overflow-hidden',
    header: 'px-4 py-3 bg-base-600/30 border-b border-base-600',
    body: 'p-4',
    footer: 'px-4 py-3 border-t border-base-600',
};

// Alert/Notice styles
export const alertStyles = {
    info: 'bg-accent-cyan/20 border border-accent-cyan rounded-lg p-4',
    success: 'bg-accent-green/20 border border-accent-green rounded-lg p-4',
    warning: 'bg-accent-yellow/20 border border-accent-yellow rounded-lg p-4',
    error: 'bg-accent-red/20 border border-accent-red rounded-lg p-4',
};
