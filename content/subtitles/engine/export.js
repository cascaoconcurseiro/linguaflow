// content/subtitles/engine/export.js — Exportação da transcrição: PDF, CSV e Anki.
import { escapeHTML } from '../../../utils/html.js';

export class ExportMethods {
  _exportPDF(customCues = null, customTitle = null) {
    this._showPdfExportModal(customCues, customTitle);
  }

  _showPdfExportModal(customCues = null, customTitle = null) {
    const existing = document.getElementById('lf-pdf-modal-overlay');
    if (existing) existing.remove();

    const cues = customCues && customCues.length > 0
      ? customCues
      : (this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues);
    if (!cues || cues.length === 0) {
      alert('Nenhuma legenda carregada ainda para exportar.');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'lf-pdf-modal-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.7);
      backdrop-filter: blur(4px);
      z-index: 2147483647;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      animation: lfFadeIn 0.15s ease-out;
    `;

    const isDark = this.uiTheme === 'dark';
    const bg = isDark ? '#1e293b' : '#ffffff';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const mutedColor = isDark ? '#94a3b8' : '#64748b';
    const borderColor = isDark ? '#334155' : '#e2e8f0';
    const cardBg = isDark ? '#0f172a' : '#f8fafc';
    const accent = '#0284c7';

    overlay.innerHTML = `
      <style>
        @keyframes lfFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes lfScaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .lf-pdf-opt-card {
          border: 2px solid ${borderColor};
          background: ${cardBg};
          border-radius: 8px;
          padding: 10px 12px;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: flex-start;
          gap: 10px;
        }
        .lf-pdf-opt-card:hover {
          border-color: ${accent};
        }
        .lf-pdf-opt-card.selected {
          border-color: ${accent};
          background: ${isDark ? 'rgba(2, 132, 199, 0.15)' : 'rgba(2, 132, 199, 0.08)'};
        }
      </style>
      <div style="background:${bg};color:${textColor};width:460px;max-width:92vw;border-radius:14px;box-shadow:0 20px 25px -5px rgba(0,0,0,0.4);border:1px solid ${borderColor};overflow:hidden;animation:lfScaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
        <div style="padding:16px 20px;border-bottom:1px solid ${borderColor};display:flex;align-items:center;justify-content:space-between;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:20px;">📄</span>
            <h3 style="margin:0;font-size:16px;font-weight:700;">Opções de Exportação PDF</h3>
          </div>
          <button id="lf-pdf-modal-close" style="background:transparent;border:none;color:${mutedColor};font-size:18px;cursor:pointer;padding:4px;border-radius:4px;">✕</button>
        </div>

        <div style="padding:16px 20px;display:flex;flex-direction:column;gap:14px;max-height:75vh;overflow-y:auto;">
          <!-- Densidade / Economia de Páginas -->
          <div>
            <label style="font-size:12px;font-weight:700;text-transform:uppercase;color:${mutedColor};display:block;margin-bottom:8px;">Formatação & Economia de Páginas</label>
            <div style="display:flex;flex-direction:column;gap:8px;">
              <label class="lf-pdf-opt-card selected" data-group="layout">
                <input type="radio" name="lf-pdf-layout" value="two-col" checked style="margin-top:2px;">
                <div>
                  <div style="font-size:13px;font-weight:700;color:${textColor};">⚡ Econômico (2 Colunas) <span style="background:#10b981;color:#fff;font-size:10px;padding:1px 6px;border-radius:10px;margin-left:4px;">Economiza até 75%</span></div>
                  <div style="font-size:11px;color:${mutedColor};margin-top:2px;">Duas colunas compactas e densas. Reduz drasticamente a quantidade de folhas impressas.</div>
                </div>
              </label>

              <label class="lf-pdf-opt-card" data-group="layout">
                <input type="radio" name="lf-pdf-layout" value="compact-table" style="margin-top:2px;">
                <div>
                  <div style="font-size:13px;font-weight:700;color:${textColor};">📋 Tabela Compacta (1 Coluna)</div>
                  <div style="font-size:11px;color:${mutedColor};margin-top:2px;">Linhas finas condensadas em formato de tabela tradicional.</div>
                </div>
              </label>

              <label class="lf-pdf-opt-card" data-group="layout">
                <input type="radio" name="lf-pdf-layout" value="expanded" style="margin-top:2px;">
                <div>
                  <div style="font-size:13px;font-weight:700;color:${textColor};">📖 Expandido (Modo Estudo)</div>
                  <div style="font-size:11px;color:${mutedColor};margin-top:2px;">Espaçamento maior entre falas, ideal para leitura solta e anotações.</div>
                </div>
              </label>
            </div>
          </div>

          <!-- Conteúdo -->
          <div>
            <label style="font-size:12px;font-weight:700;text-transform:uppercase;color:${mutedColor};display:block;margin-bottom:8px;">Conteúdo das Legendas</label>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;">
              <label class="lf-pdf-opt-card selected" data-group="content" style="padding:8px 10px;flex-direction:row;align-items:center;">
                <input type="radio" name="lf-pdf-content" value="bilingual" checked>
                <span style="font-size:12px;font-weight:600;">Bilíngue</span>
              </label>
              <label class="lf-pdf-opt-card" data-group="content" style="padding:8px 10px;flex-direction:row;align-items:center;">
                <input type="radio" name="lf-pdf-content" value="orig-only">
                <span style="font-size:12px;font-weight:600;">Só Original</span>
              </label>
              <label class="lf-pdf-opt-card" data-group="content" style="padding:8px 10px;flex-direction:row;align-items:center;">
                <input type="radio" name="lf-pdf-content" value="trans-only">
                <span style="font-size:12px;font-weight:600;">Só Tradução</span>
              </label>
            </div>
          </div>

          <!-- Opções Adicionais -->
          <div style="display:flex;align-items:center;justify-content:space-between;padding-top:4px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:12px;cursor:pointer;">
              <input type="checkbox" id="lf-pdf-timestamps" checked style="accent-color:${accent};">
              <span>Incluir Minutagem (Timestamps)</span>
            </label>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:12px;color:${mutedColor};">Fonte:</span>
              <select id="lf-pdf-font-size" style="background:${cardBg};color:${textColor};border:1px solid ${borderColor};border-radius:6px;padding:4px 8px;font-size:11px;outline:none;">
                <option value="small" selected>Pequena (Econômica)</option>
                <option value="medium">Média</option>
                <option value="large">Grande</option>
              </select>
            </div>
          </div>
        </div>

        <div style="padding:14px 20px;border-top:1px solid ${borderColor};display:flex;gap:10px;justify-content:flex-end;background:${cardBg};">
          <button id="lf-pdf-btn-cancel" style="background:transparent;border:1px solid ${borderColor};color:${textColor};padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;">Cancelar</button>
          <button id="lf-pdf-btn-generate" style="background:${accent};border:none;color:#ffffff;padding:8px 20px;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;display:flex;align-items:center;gap:6px;box-shadow:0 2px 4px rgba(2,132,199,0.3);">🖨️ Gerar PDF / Imprimir</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => overlay.remove();

    overlay.querySelector('#lf-pdf-modal-close').onclick = closeModal;
    overlay.querySelector('#lf-pdf-btn-cancel').onclick = closeModal;
    overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

    // Sincroniza classes visuais dos radio buttons
    const bindRadioGroup = (groupName) => {
      const cards = overlay.querySelectorAll(`.lf-pdf-opt-card[data-group="${groupName}"]`);
      cards.forEach((card) => {
        card.onclick = () => {
          const radio = card.querySelector('input[type="radio"]');
          if (radio) radio.checked = true;
          cards.forEach((c) => c.classList.remove('selected'));
          card.classList.add('selected');
        };
      });
    };
    bindRadioGroup('layout');
    bindRadioGroup('content');

    overlay.querySelector('#lf-pdf-btn-generate').onclick = () => {
      const layout = overlay.querySelector('input[name="lf-pdf-layout"]:checked')?.value || 'two-col';
      const content = overlay.querySelector('input[name="lf-pdf-content"]:checked')?.value || 'bilingual';
      const timestamps = overlay.querySelector('#lf-pdf-timestamps')?.checked ?? true;
      const fontSize = overlay.querySelector('#lf-pdf-font-size')?.value || 'small';

      closeModal();
      this._generatePDF({ layout, content, timestamps, fontSize }, cues, customTitle);
    };
  }

  _generatePDF(options = {}, customCues = null, customTitle = null) {
    const baseVideoTitle = document.title || 'Legendas';
    const videoTitle = customTitle ? `${baseVideoTitle} - ${customTitle}` : baseVideoTitle;
    const safeVideoTitle = escapeHTML(videoTitle);
    const cues = customCues && customCues.length > 0 ? customCues : (this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues);

    if (!cues || cues.length === 0) return;

    const {
      layout = 'two-col',
      content = 'bilingual',
      timestamps = true,
      fontSize = 'small',
    } = options;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Erro: Popup bloqueado. Permita popups no navegador para gerar o PDF.');
      return;
    }

    const fontStyles = {
      small: { base: '9.5pt', time: '8pt', orig: '10pt', trans: '9pt' },
      medium: { base: '11pt', time: '9pt', orig: '11.5pt', trans: '10.5pt' },
      large: { base: '13pt', time: '10pt', orig: '14pt', trans: '12.5pt' },
    }[fontSize] || { base: '9.5pt', time: '8pt', orig: '10pt', trans: '9pt' };

    let layoutCSS = '';
    if (layout === 'two-col') {
      layoutCSS = `
        .cues-container {
          column-count: 2;
          column-gap: 24px;
          column-rule: 1px solid #e2e8f0;
        }
        .cue-item {
          break-inside: avoid;
          page-break-inside: avoid;
          padding: 2.5px 0;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          gap: 8px;
        }
      `;
    } else if (layout === 'compact-table') {
      layoutCSS = `
        table { width: 100%; border-collapse: collapse; }
        tr { break-inside: avoid; page-break-inside: avoid; }
        td { padding: 3px 6px; vertical-align: top; border-bottom: 1px solid #e2e8f0; }
      `;
    } else {
      // expanded
      layoutCSS = `
        .cues-container { max-width: 800px; margin: 0 auto; }
        .cue-item {
          break-inside: avoid;
          page-break-inside: avoid;
          padding: 10px 0;
          border-bottom: 1px solid #f1f5f9;
          display: flex;
          gap: 15px;
        }
      `;
    }

    let html = `<!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <title>${safeVideoTitle} - LinguaFlow Script</title>
        <style>
          @page {
            margin: 1.2cm 1.4cm;
            size: A4;
          }
          @media print {
            body {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
              padding: 0;
              margin: 0;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            line-height: 1.35;
            font-size: ${fontStyles.base};
            padding: 12px;
            margin: 0 auto;
          }
          .pdf-header {
            border-bottom: 2px solid #0284c7;
            padding-bottom: 8px;
            margin-bottom: 12px;
            text-align: center;
          }
          .pdf-header h1 {
            font-size: 15px;
            color: #0f172a;
            margin: 0 0 3px;
          }
          .pdf-header p {
            font-size: 10px;
            color: #64748b;
            margin: 0;
          }
          .time {
            font-family: monospace;
            color: #64748b;
            font-size: ${fontStyles.time};
            white-space: nowrap;
            min-width: 38px;
            flex-shrink: 0;
            margin-top: 1px;
          }
          .text-content { flex: 1; min-width: 0; }
          .orig { font-size: ${fontStyles.orig}; font-weight: 600; color: #0f172a; }
          .trans { font-size: ${fontStyles.trans}; color: #0284c7; margin-top: 1px; font-weight: 500; }
          ${layoutCSS}
        </style>
      </head>
      <body>
        <div class="pdf-header">
          <h1>🎬 ${safeVideoTitle}</h1>
          <p>${cues.length} falas &bull; LinguaFlow &bull; ${new Date().toLocaleDateString('pt-BR')}</p>
        </div>
    `;

    if (layout === 'compact-table') {
      html += '<table>';
      cues.forEach((c) => {
        const time = this._formatTime(c.start);
        const orig = escapeHTML(c.text || '').replace(/\n/g, '<br>');
        const trans = escapeHTML(c.translatedText || '').replace(/\n/g, '<br>');

        const showOrig = content === 'bilingual' || content === 'orig-only';
        const showTrans = (content === 'bilingual' || content === 'trans-only') && trans;

        html += `<tr>
          ${timestamps ? `<td class="time">${time}</td>` : ''}
          <td class="text-content">
            ${showOrig ? `<div class="orig">${orig}</div>` : ''}
            ${showTrans ? `<div class="trans">${trans}</div>` : ''}
          </td>
        </tr>`;
      });
      html += '</table>';
    } else {
      html += '<div class="cues-container">';
      cues.forEach((c) => {
        const time = this._formatTime(c.start);
        const orig = escapeHTML(c.text || '').replace(/\n/g, '<br>');
        const trans = escapeHTML(c.translatedText || '').replace(/\n/g, '<br>');

        const showOrig = content === 'bilingual' || content === 'orig-only';
        const showTrans = (content === 'bilingual' || content === 'trans-only') && trans;

        html += `<div class="cue-item">
          ${timestamps ? `<div class="time">${time}</div>` : ''}
          <div class="text-content">
            ${showOrig ? `<div class="orig">${orig}</div>` : ''}
            ${showTrans ? `<div class="trans">${trans}</div>` : ''}
          </div>
        </div>`;
      });
      html += '</div>';
    }

    html += '</body></html>';
    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 400);
  }

  _exportCSV(customCues = null, customTitle = null) {
    const baseTitle = customTitle || document.title || 'Legendas';
    const cues = customCues && customCues.length > 0 ? customCues : (this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues);
    let csv = 'Timestamp;Original;Translation\n';

    cues.forEach((c) => {
      const time = this._formatTime(c.start);
      const neutralizeFormula = (value) => /^[=+\-@]/.test(value) ? `'${value}` : value;
      const orig = neutralizeFormula(c.text || '').replace(/"/g, '""');
      const trans = neutralizeFormula(c.translatedText || '').replace(/"/g, '""');
      csv += `${time};"${orig}";"${trans}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${baseTitle.replace(/[^a-z0-9]/gi, '_')}_LinguaFlow.csv`;
    link.click();
  }

  _exportAnki(customCues = null, customTitle = null) {
    const baseTitle = customTitle || document.title || 'Legendas';
    const cues = customCues && customCues.length > 0 ? customCues : (this.xhrCues && this.xhrCues.length > 0 ? this.xhrCues : this.cues);
    let content = '';

    cues.forEach((c) => {
      const orig = escapeHTML(c.text || '').replace(/\n/g, '<br>');
      const trans = escapeHTML(c.translatedText || '').replace(/\n/g, '<br>');
      const time = this._formatTime(c.start);
      // Formato Anki: Front [tab] Back [tab] Tag
      content += `${orig}<br><small style="color:gray">${time}</small>\t${trans}\tLinguaFlow_${this.platform}\n`;
    });

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${baseTitle.replace(/[^a-z0-9]/gi, '_')}_Anki.txt`;
    link.click();
  }

  _formatTime(seconds) {
    if (isNaN(seconds) || seconds === null) return '00:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return (h > 0 ? h + ':' : '') + (m < 10 ? '0' + m : m) + ':' + (s < 10 ? '0' + s : s);
  }
}
