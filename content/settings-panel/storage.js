// content/settings-panel/storage.js — Lê e grava as configurações do painel no banco (importado sob demanda para não pesar no carregamento).

export async function readAllSettings() {
  const { db } = await import('../../utils/db.js');
  const settings = [
    'targetLang',
    'sourceLang',
    'uiTheme',
    'subtitleMode',
    'bgOpacity',
    'fontSize',
    'fontSizeTrans',
    'autoPause',
    'smartAutoPause',
    'smartHideKnownTranslation',
    'smartLookupHint',
    'showOriginal',
    'showTranslation',
    'subtitleBottom',
    'subtitleHorizontal',
    'translationDelay',
    'translationAnticipation',
    'flashDuration',
    'wordColorKnown',
    'wordColorSaved',
    'blurSubtitles',
    'ttsPlaybackRate',
    'fontFamily',
    'colorPalette',
    'popupMode',
    'cefrTargetLevel',
    'cefrColorsEnabled',
    'startMode',
    'markPhrasal',
    'markSlang',
    'markReduction',
    'markSoundsLike',
    'markMarkers',
    'cefrColorA1',
    'cefrColorA2',
    'cefrColorB1',
    'cefrColorB2',
    'cefrColorC1',
    'cefrColorC2',
  ];
  const obj = {};
  for (const key of settings) {
    const val = await db.getSetting(key);
    if (val !== undefined && val !== null) obj[key] = val;
  }
  return obj;
}

export async function writeSetting(key, value) {
  const { db } = await import('../../utils/db.js');
  return db.setSetting(key, value).catch((e) => {
    console.warn('[LinguaFlow Settings] Falha ao salvar', key, e?.message);
  });
}
