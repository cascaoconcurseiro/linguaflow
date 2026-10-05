// Cursos → Cofre (#434): leva uma frase/palavra estudada num curso para a fila única de revisão
// espaçada (FSRS, calculada no servidor). É sempre uma ação explícita do aluno; o curso continua
// independente e nada é enviado sozinho.
// Reusa db.saveWord (RPC save_word_with_card): não há escrita nova no banco nem agendamento no cliente.

const SENDABLE_KINDS = new Set(['sentence', 'word', 'phrasal', 'verb_forms']);
const MAX_CHARS = 300;
const MAX_WORDS = 25;

export function canSendUnitToVault(unit) {
  const text = String(unit?.text || '').trim();
  if (!text || text.length > MAX_CHARS) return false;
  if (!SENDABLE_KINDS.has(unit?.kind || 'sentence')) return false;
  return text.split(/\s+/).length <= MAX_WORDS;
}

/** Converte uma unidade de curso no formato que db.saveWord já aceita. */
export function unitToWordPayload(unit, { courseTitle = '' } = {}) {
  const text = String(unit?.text || '').trim();
  const kind = unit?.kind || 'sentence';
  const category = kind === 'word' ? 'word' : kind === 'phrasal' ? 'phrasal' : (text.split(/\s+/).length === 1 ? 'word' : 'idiom');
  const tags = ['curso'];
  if (courseTitle) tags.push(String(courseTitle).slice(0, 60));
  return {
    word: text,
    lang: 'en',
    translation: unit?.translation_pt || '',
    // Palavra solta tem frase de exemplo; frase inteira é o próprio contexto.
    context_sentence: unit?.example_en || text,
    phonetic: unit?.ipa || '',
    explanation: unit?.explanation_note || '',
    category,
    platform: 'curso',
    tags,
  };
}

/**
 * @returns {Promise<{status:'saved'|'exists'|'waiting'|'waiting-queue'|'unsupported'}>} — falhas de rede/servidor sobem como exceção.
 */
export async function sendUnitToVault(unit, { db, courseTitle } = {}) {
  if (!canSendUnitToVault(unit)) return { status: 'unsupported' };
  const payload = unitToWordPayload(unit, { courseTitle });
  // Nunca sobrescreve uma palavra que o aluno já tem (ex.: salva de um vídeo com a cena original).
  const existing = await db.getWord(payload.word, payload.lang);
  if (existing) return { status: 'exists' };
  const result = await db.saveWord(payload);
  if (!result?.ok) throw new Error('save_word_failed');
  if (!result.waitingForSlot) return { status: 'saved' };
  return { status: result.waitingReason === 'backlog' ? 'waiting-queue' : 'waiting' };
}

const BUTTON_STATES = {
  saved: ['✓ No Cofre', 'Frase enviada ao Cofre. Ela entra na sua fila de revisão.'],
  exists: ['✓ Já está no Cofre', 'Essa frase já estava no seu Cofre; nada foi alterado.'],
  waiting: ['⏳ Em espera', 'Seu Cofre está cheio: a frase ficou em espera até você abrir uma vaga.'],
  'waiting-queue': ['⏳ Em espera', 'Você tem muitas revisões vencidas: a frase espera e entra na fila quando ela baixar.'],
};

/** Liga o botão: carregando → sucesso/aviso, ou erro recuperável (o botão volta a funcionar). */
export async function runSendToVault(button, unit, { db, app, courseTitle } = {}) {
  if (!button || button.disabled) return;
  const original = button.textContent;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.textContent = 'Enviando…';
  try {
    const { status } = await sendUnitToVault(unit, { db, courseTitle });
    const [label, message] = BUTTON_STATES[status] || [original, ''];
    button.textContent = label;
    button.removeAttribute('aria-busy');
    if (message) app?.showToast?.(message, status.startsWith('waiting') ? 'info' : 'success');
    if (status === 'unsupported') button.disabled = true;
  } catch (error) {
    console.warn('[CourseVault] send_failed', error?.kind || error?.message);
    button.textContent = original;
    button.disabled = false;
    button.removeAttribute('aria-busy');
    app?.showToast?.('Não foi possível enviar ao Cofre agora. Tente de novo.', 'error');
  }
}
