/**
 * Formats seconds into a human-readable time string.
 * @param seconds - Total seconds.
 * @param format - 'colon' for 'm:ss' or 'full' for 'Xm Ys'.
 */
export const formatTime = (seconds: number, format: 'colon' | 'full' = 'colon'): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;

    if (format === 'full') {
        return `${mins}m ${secs}s`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};
