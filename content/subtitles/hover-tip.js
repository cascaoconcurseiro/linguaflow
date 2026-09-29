// content/subtitles/hover-tip.js — Dica leve ao passar o mouse numa palavra
// (#369): tradução, traduções por classe e tradução da frase, sem IA e sem
// abrir o card. O clique continua abrindo o card completo.

// Conteúdo da dica a partir do que já chegou; campos vazios somem.
export function hoverTipLines({ word = '', translation = '', senses = [], sentenceTranslation = '' } = {}) {
  const lines = [];
  const main = String(translation || '').trim();
  const clean = String(word || '').trim();
  if (clean) lines.push({ kind: 'word', text: main && main.toLowerCase() !== clean.toLowerCase() ? `${clean}: ${main}` : clean });
  for (const sense of (Array.isArray(senses) ? senses : []).slice(0, 2)) {
    const terms = (sense?.terms || []).filter((t) => t && t.toLowerCase() !== main.toLowerCase()).slice(0, 4);
    if (terms.length) lines.push({ kind: 'sense', label: sense.label || sense.pos || '', text: terms.join(', ') });
  }
  const sentence = String(sentenceTranslation || '').trim();
  if (sentence) lines.push({ kind: 'sentence', text: sentence });
  return lines;
}

const GAP = 8;

// Posição acima da palavra; abaixo se não couber; sempre dentro da tela.
export function hoverTipPosition(anchor, tip, viewport) {
  const left = Math.min(Math.max(GAP, anchor.left + anchor.width / 2 - tip.width / 2), viewport.width - tip.width - GAP);
  const above = anchor.top - tip.height - GAP;
  const top = above >= GAP ? above : Math.min(anchor.bottom + GAP, viewport.height - tip.height - GAP);
  return { left: Math.round(left), top: Math.round(top) };
}

export function createHoverTip(doc = document) {
  let el = null;
  let token = 0;

  const ensure = () => {
    if (el?.isConnected) return el;
    el = doc.createElement('div');
    el.id = 'lf-hover-tip';
    el.setAttribute('role', 'tooltip');
    el.style.cssText = [
      'position:fixed', 'z-index:2147483646', 'max-width:320px', 'padding:8px 12px', 'border-radius:10px',
      'background:rgba(13,17,28,.96)', 'color:#f8fafc', 'border:1px solid rgba(255,255,255,.14)',
      'box-shadow:0 8px 24px rgba(0,0,0,.45)', "font:13px/1.45 'Outfit','Segoe UI',system-ui,sans-serif",
      'pointer-events:none', 'opacity:0', 'transition:opacity .12s ease', 'display:none',
    ].join(';');
    if (doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches) el.style.transition = 'none';
    return el;
  };

  const render = (lines) => {
    const tip = ensure();
    tip.replaceChildren(...lines.map((line) => {
      const row = doc.createElement('div');
      if (line.kind === 'word') row.style.cssText = 'font-weight:800;color:#4ade80;';
      if (line.kind === 'sentence') row.style.cssText = 'margin-top:4px;padding-top:4px;border-top:1px solid rgba(255,255,255,.1);color:#cbd5e1;font-size:12px;';
      if (line.kind === 'sense') {
        const label = doc.createElement('span');
        label.style.cssText = 'color:#7dd3fc;font-weight:700;margin-right:4px;';
        label.textContent = line.label;
        row.append(label, doc.createTextNode(line.text));
      } else {
        row.textContent = line.text;
      }
      return row;
    }));
  };

  const place = (anchorRect) => {
    const tip = ensure();
    const box = tip.getBoundingClientRect();
    const view = doc.defaultView || { innerWidth: 1280, innerHeight: 720 };
    const { left, top } = hoverTipPosition(anchorRect, box, { width: view.innerWidth, height: view.innerHeight });
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  };

  return {
    // `load` resolve os dados aos poucos; a dica é atualizada a cada parte.
    show(anchorRect, initial, load) {
      const id = ++token;
      const tip = ensure();
      const parent = doc.fullscreenElement || doc.body;
      if (tip.parentElement !== parent) parent.appendChild(tip);
      let data = { ...initial };
      render(hoverTipLines(data));
      tip.style.display = 'block';
      place(anchorRect);
      tip.style.opacity = '1';
      load?.((patch) => {
        if (id !== token) return;
        data = { ...data, ...patch };
        render(hoverTipLines(data));
        place(anchorRect);
      });
    },
    hide() {
      token++;
      if (!el) return;
      el.style.opacity = '0';
      el.style.display = 'none';
    },
    get element() { return el; },
  };
}
