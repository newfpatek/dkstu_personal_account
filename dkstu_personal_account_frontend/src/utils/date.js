const TZ = 'Europe/Moscow'; // UTC+3, no DST

// Если строка без timezone-суффикса (нет Z / +HH:MM) — явно добавляем Z,
// чтобы браузер трактовал её как UTC, а не как локальное время ОС.
function toUTC(dateStr) {
  if (!dateStr || typeof dateStr !== 'string') return dateStr;
  if (/Z$|[+-]\d{2}:\d{2}$/.test(dateStr)) return dateStr;
  return dateStr + 'Z';
}

export function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(toUTC(dateStr)).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return null;
  return new Date(toUTC(dateStr)).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return null;
  const d = new Date(toUTC(dateStr));
  return (
    d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: TZ }) +
    ' ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  );
}
