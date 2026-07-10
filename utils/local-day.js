// Datas de atividade são dias de calendário do aluno, não do servidor UTC.
// Estas funções não usam `toISOString()` para formar a chave YYYY-MM-DD.

function asDate(value) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) throw new TypeError('Data inválida');
  return date;
}

export function localDateKey(value = new Date()) {
  const date = asDate(value);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function dateFromLocalKey(key) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key || '')) throw new TypeError('Chave de dia inválida');
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, month - 1, day, 12);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    throw new TypeError('Chave de dia inválida');
  }
  return date;
}

export function addLocalDays(days, value = new Date()) {
  const date = asDate(value);
  // Meio-dia evita a hora inexistente em transições de horário de verão.
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

export function localDayBounds(value = new Date()) {
  const date = asDate(value);
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export function daysBetweenLocalKeys(fromKey, toKey = localDateKey()) {
  const from = dateFromLocalKey(fromKey);
  const to = dateFromLocalKey(toKey);
  return Math.round((Date.UTC(to.getFullYear(), to.getMonth(), to.getDate())
    - Date.UTC(from.getFullYear(), from.getMonth(), from.getDate())) / 86400000);
}
