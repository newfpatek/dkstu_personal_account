export function getErrorMessage(err, fallback = 'Произошла ошибка') {
  const msg = err?.response?.data?.message;
  if (!msg) return fallback;
  if (Array.isArray(msg)) return msg.join('; ');
  return msg;
}
