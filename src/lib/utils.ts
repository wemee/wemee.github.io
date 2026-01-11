/**
 * 格式化日期為繁體中文格式
 * @param date - 要格式化的日期
 * @returns 格式化後的字串，例如 "2026年1月11日"
 */
export function formatDate(date: Date): string {
    return date.toLocaleDateString('zh-TW', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
}
