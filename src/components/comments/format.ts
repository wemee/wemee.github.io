// 留言時間顯示:近期用相對時間,超過 30 天退回絕對日期(zh-TW)

export function formatRelative(ts: number): string {
  const diffSec = Math.floor((Date.now() - ts) / 1000);

  if (diffSec < 60) return '剛剛';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} 天前`;

  const d = new Date(ts);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}

/** 由暱稱推出一個穩定的色相,給頭像底色用。 */
export function hueFromName(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) % 360;
  }
  return hash;
}
