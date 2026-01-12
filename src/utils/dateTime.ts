export function isToday(ts: number): boolean {
  const d = new Date(ts);
  const n = new Date();
  return (
    d.getFullYear() === n.getFullYear() &&
    d.getMonth() === n.getMonth() &&
    d.getDate() === n.getDate()
  );
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

export function formatShortDate(ts: number): string {
  const d = new Date(ts);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
}

export function formatDate(ts: number): string {
  return formatShortDate(ts);
}

export function formatTimestamp(ts?: number | null): string {
  const v = Number(ts || 0);
  if (!v) return '';
  return isToday(v) ? formatTime(v) : formatShortDate(v);
}

export function formatTs(ts?: number | null): string {
  return formatTimestamp(ts);
}
