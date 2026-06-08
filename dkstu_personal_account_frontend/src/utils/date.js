const TZ = 'Europe/Moscow'; // UTC+3, no DST

export function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: TZ,
  });
}

export function formatDateShort(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: TZ,
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return (
    d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', timeZone: TZ }) +
    ' ' +
    d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  );
}
