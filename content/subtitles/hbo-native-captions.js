// content/subtitles/hbo-native-captions.js — Liga a legenda nativa da Max/HBO por código.
//
// A Max só baixa o arquivo de legenda (VTT) quando a legenda do próprio player
// está ligada. Sem ele o LinguaFlow não tem o que mostrar. Por isso, ao ligar o
// LF, ligamos a legenda nativa por baixo (ela fica invisível, ver
// _hideHBONativeSubtitles) em vez de pedir ao usuário que faça isso na mão.

const OFF_LABELS = /^(off|none|disabled|desligad[oa]s?|desativad[oa]s?|nenhum[a]?|sem legendas?|no subtitles?)$/i;
const AUDIO_HINT = /(audio|áudio)/i;

export const MAX_CC_BUTTON_SELECTOR = [
  '[data-testid="player-ui-controls-subtitle-btn"]',
  '[data-testid*="subtitle" i]',
  '[data-testid*="caption" i]',
  'button[aria-label*="Subtitle" i]',
  'button[aria-label*="Caption" i]',
  'button[aria-label*="Legenda" i]',
  'button[aria-label*="Audio" i]',
  'button[aria-label*="Áudio" i]',
  'button[class*="subtitle" i]',
].join(', ');

export function isOffLabel(text) {
  return OFF_LABELS.test(String(text || '').trim());
}

/** Nomes do idioma (en, pt…) como a Max os escreve: "English", "Inglês"… */
export function languageLabels(code) {
  const base = String(code || '').toLowerCase().split('-')[0];
  if (!base) return [];
  const names = new Set([base]);
  for (const locale of ['en', 'pt', base]) {
    try {
      const name = new Intl.DisplayNames([locale], { type: 'language' }).of(base);
      if (name) names.add(name.toLowerCase());
    } catch {
      /* Intl.DisplayNames indisponível: segue só com o código */
    }
  }
  return [...names];
}

/**
 * Escolhe o item de legenda a clicar no menu da Max.
 * items: [{ text, checked, isAudio }] na ordem do menu.
 * Retorna { index } para clicar, ou { index: -1, alreadyOn: true } se já há
 * uma legenda ligada, ou { index: -1 } se não há o que escolher.
 */
export function pickSubtitleOption(items, sourceLang) {
  const candidates = [];
  items.forEach((item, index) => {
    if (!item || item.isAudio) return;
    const text = String(item.text || '').trim();
    if (!text || AUDIO_HINT.test(text)) return;
    candidates.push({ index, text, checked: Boolean(item.checked), off: isOffLabel(text) });
  });
  if (candidates.some((c) => c.checked && !c.off)) return { index: -1, alreadyOn: true };

  const subtitles = candidates.filter((c) => !c.off);
  if (!subtitles.length) return { index: -1 };

  const labels = languageLabels(sourceLang);
  const preferred = subtitles.find((c) => {
    const lower = c.text.toLowerCase();
    return labels.some((label) => lower.startsWith(label) || lower.includes(`${label} `));
  });
  return { index: (preferred || subtitles[0]).index };
}

/** Lê os itens de rádio visíveis do menu aberto da Max. */
export function readMenuItems(doc) {
  const nodes = [...doc.querySelectorAll('[role="menuitemradio"], [role="radio"]')];
  return nodes.map((node) => {
    const group = node.closest?.('[role="group"], [role="radiogroup"], [role="menu"]');
    const groupLabel = group?.getAttribute?.('aria-label') || '';
    return {
      node,
      text: node.textContent || node.getAttribute?.('aria-label') || '',
      checked:
        node.getAttribute?.('aria-checked') === 'true' || node.getAttribute?.('aria-selected') === 'true',
      isAudio: AUDIO_HINT.test(groupLabel),
    };
  });
}
