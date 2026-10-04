// content/subtitles/subtitle-panel-styles.js — CSS do painel lateral de legendas (palavras clicáveis, temas claro e escuro, marcas de expressão), injetado no documento fora do Shadow DOM.

export function subtitlePanelCss({ expressionCss }) {
  return `
            #lf-subtitle-panel .lf-word {
                cursor: pointer;
                display: inline-block;
                transition: color 0.12s;
                border-radius: 3px;
                padding: 0 1px;
            }
            #lf-subtitle-panel .lf-word:hover {
                color: #FBBF24 !important;
                background: rgba(251, 191, 36, 0.1);
            }
            #lf-subtitle-panel .lf-known { color: #86EFAC; }
            #lf-subtitle-panel .lf-mature { color: #34D399; text-decoration: underline dotted; }
            #lf-subtitle-panel .lf-review { color: #38BDF8; text-decoration: underline dashed; }
            #lf-subtitle-panel .lf-learning { color: #FBBF24; text-decoration: underline dashed; }
            #lf-subtitle-panel .lf-saved { color: #93C5FD; text-decoration: underline dashed; }
            #lf-subtitle-panel .lf-expression { border-bottom: 2px dotted rgba(56, 189, 248, 0.6); }
            ${expressionCss}
            #lf-subtitle-panel .lf-new { color: inherit; }
            #lf-subtitle-panel.theme-light .lf-known { color: #15803d; }
            #lf-subtitle-panel.theme-light .lf-mature { color: #047857; }
            #lf-subtitle-panel.theme-light .lf-review { color: #0369a1; }
            #lf-subtitle-panel.theme-light .lf-learning { color: #b45309; }
            #lf-subtitle-panel.theme-light .lf-saved { color: #1d4ed8; }
            #lf-subtitle-panel.theme-light .lf-word:hover { color: #92400e !important; background: rgba(217, 119, 6, 0.12); }
            #lf-subtitle-panel .lf-sub-text { margin: 0; }
            #lf-subtitle-panel .lf-search-hit { background: rgba(251, 191, 36, 0.35); color: inherit; border-radius: 3px; padding: 0 1px; }
            #lf-subtitle-panel .lf-play-cue {
                background: transparent; border: none; padding: 2px 4px; margin: 0; cursor: pointer;
                font: inherit; font-size: 11px; font-weight: 700; color: inherit; border-radius: 4px;
                flex-shrink: 0; min-width: 40px; text-align: left;
            }
            #lf-subtitle-panel .lf-play-cue:focus-visible,
            #lf-subtitle-panel .lf-loop-cue:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
            #lf-subtitle-panel .lf-skeleton-row { padding: 12px 16px; display: flex; flex-direction: column; gap: 8px; }
            #lf-subtitle-panel .lf-skeleton-bar { height: 12px; border-radius: 4px; background: rgba(148, 163, 184, 0.22); }
            #lf-subtitle-panel .lf-skeleton-bar.short { width: 55%; }
            #lf-subtitle-panel .lf-cue-actions { display: flex; gap: 4px; align-items: center; flex-shrink: 0; }
            #lf-subtitle-panel .lf-explain-cue { font: inherit; font-size: 11px; font-weight: 700; padding: 3px 8px; border-radius: 6px; cursor: pointer; background: transparent; border: 1px solid rgba(148,163,184,0.45); color: inherit; }
            #lf-subtitle-panel .lf-explain-cue[aria-expanded="true"] { border-color: #38bdf8; color: #7dd3fc; }
            #lf-subtitle-panel .lf-explain-cue:disabled { opacity: 0.6; cursor: progress; }
            #lf-subtitle-panel .lf-explain-cue:focus-visible,
            #lf-subtitle-panel .lf-line-explain-retry:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
            #lf-subtitle-panel .lf-line-explain { margin: 6px 0 0 48px; padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(148,163,184,0.3); font-size: 13px; line-height: 1.45; display: flex; flex-direction: column; gap: 6px; cursor: default; }
            #lf-subtitle-panel .lf-line-explain[hidden] { display: none; }
            #lf-subtitle-panel .lf-line-explain p, #lf-subtitle-panel .lf-line-explain ul { margin: 0; }
            #lf-subtitle-panel .lf-line-explain ul { padding-left: 18px; }
            #lf-subtitle-panel .lf-line-explain-label { display: block; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.75; }
            #lf-subtitle-panel .lf-line-explain-note { font-size: 11px; opacity: 0.7; }
            #lf-subtitle-panel .lf-line-explain-error { color: #fca5a5; }
            #lf-subtitle-panel.theme-light .lf-line-explain-error { color: #b91c1c; }
            #lf-subtitle-panel.theme-light .lf-explain-cue[aria-expanded="true"] { border-color: #0369a1; color: #0369a1; }
            #lf-subtitle-panel .lf-line-explain-retry { align-self: flex-start; font: inherit; font-size: 12px; font-weight: 700; padding: 4px 10px; border-radius: 6px; cursor: pointer; background: transparent; border: 1px solid currentColor; color: inherit; }

            /* --- Aba Palavras e explorador (tema escuro padrão) --- */
            #lf-subtitle-panel .lf-words-card { background: rgba(255,255,255,0.04); border: 1px solid #384352; border-radius: 10px; padding: 14px 16px; margin-bottom: 10px; }
            #lf-subtitle-panel .lf-words-score { margin: 0 0 8px; font-size: 13px; line-height: 1.4; color: #cbd5e1; }
            #lf-subtitle-panel .lf-words-score strong { font-size: 22px; color: #f1f5f9; margin-right: 4px; }
            #lf-subtitle-panel .lf-words-score-empty { margin: 0 0 8px; font-size: 13px; line-height: 1.4; color: #cbd5e1; }
            #lf-subtitle-panel .lf-words-bar { height: 6px; border-radius: 6px; background: rgba(255,255,255,0.08); overflow: hidden; margin-bottom: 10px; }
            #lf-subtitle-panel .lf-words-bar span { display: block; height: 100%; background: #34d399; }
            #lf-subtitle-panel .lf-words-counts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin: 0; }
            #lf-subtitle-panel .lf-words-counts div { display: flex; flex-direction: column-reverse; }
            #lf-subtitle-panel .lf-words-counts dt { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #94a3b8; font-weight: 700; }
            #lf-subtitle-panel .lf-words-counts dd { margin: 0; font-size: 18px; font-weight: 800; color: #f1f5f9; }
            #lf-subtitle-panel .lf-words-status { margin: 0 0 8px; min-height: 16px; font-size: 12px; color: #94a3b8; }
            #lf-subtitle-panel .lf-words-empty { text-align: center; color: #94a3b8; font-size: 13px; padding: 30px 15px; margin: 0; }
            #lf-subtitle-panel .lf-words-nav { display: flex; gap: 6px; margin-bottom: 14px; padding: 4px; border-radius: 10px; border: 1px solid #384352; }
            #lf-subtitle-panel .lf-words-nav-btn { flex: 1; padding: 7px 8px; border-radius: 8px; font: inherit; font-size: 11px; font-weight: 700; cursor: pointer; border: 1px solid transparent; background: transparent; color: #94a3b8; white-space: nowrap; }
            #lf-subtitle-panel .lf-words-nav-btn[aria-pressed="true"] { border-color: currentColor; background: rgba(56,189,248,0.12); color: #7dd3fc; }
            #lf-subtitle-panel .lf-keywords-title { margin: 4px 0 4px; font-size: 13px; font-weight: 800; color: #f1f5f9; }
            #lf-subtitle-panel .lf-keywords-hint { margin: 0 0 8px; font-size: 12px; color: #94a3b8; }
            #lf-subtitle-panel .lf-keywords-list { list-style: none; margin: 0 0 16px; padding: 0; display: flex; flex-direction: column; gap: 6px; }
            #lf-subtitle-panel .lf-keyword { display: flex; align-items: center; gap: 6px; }
            #lf-subtitle-panel .lf-keyword .lf-chip { flex: 1; text-align: left; }
            #lf-subtitle-panel .lf-keyword-action { font: inherit; font-size: 11px; font-weight: 700; padding: 5px 9px; border-radius: 8px; cursor: pointer; background: transparent; border: 1px solid #475569; color: #cbd5e1; }
            #lf-subtitle-panel .lf-keyword-action:disabled { opacity: 0.6; cursor: progress; }
            #lf-subtitle-panel .lf-chip-grid { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 2px 12px; }
            #lf-subtitle-panel .lf-chip { font: inherit; font-size: 12px; font-weight: 700; padding: 5px 11px; border-radius: 999px; cursor: pointer; border: 1px solid rgba(148,163,184,0.35); background: rgba(255,255,255,0.04); color: #cbd5e1; transition: background-color 0.12s, border-color 0.12s; }
            #lf-subtitle-panel .lf-chip:hover { background: rgba(255,255,255,0.1); }
            #lf-subtitle-panel .lf-chip-phrasal { color: #f9a8d4; border-color: rgba(244,114,182,0.4); }
            #lf-subtitle-panel .lf-chip-slang { color: #fdba74; border-color: rgba(251,146,60,0.4); }
            #lf-subtitle-panel .lf-chip-status-known { color: #86efac; border-color: rgba(134,239,172,0.35); }
            #lf-subtitle-panel .lf-chip-status-mature { color: #34d399; border-color: rgba(52,211,153,0.35); }
            #lf-subtitle-panel .lf-chip-status-review { color: #7dd3fc; border-color: rgba(125,211,252,0.35); }
            #lf-subtitle-panel .lf-chip-status-learning { color: #fbbf24; border-color: rgba(251,191,36,0.35); }
            #lf-subtitle-panel .lf-chip-status-new { color: #93c5fd; border-color: rgba(147,197,253,0.35); }
            #lf-subtitle-panel .lf-band { margin-bottom: 8px; }
            #lf-subtitle-panel .lf-band-header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 7px 10px; border-radius: 7px; cursor: pointer; font: inherit; font-size: 12px; font-weight: 700; background: rgba(255,255,255,0.05); border: none; border-left: 3px solid #94a3b8; color: #cbd5e1; margin-bottom: 6px; }
            #lf-subtitle-panel .lf-band-top1k { border-left-color: #fbbf24; }
            #lf-subtitle-panel .lf-band-top2k { border-left-color: #fb923c; }
            #lf-subtitle-panel .lf-band-top3k { border-left-color: #38bdf8; }
            #lf-subtitle-panel .lf-band-count { font-weight: 600; color: #94a3b8; }
            #lf-subtitle-panel .lf-words-nav-btn:focus-visible,
            #lf-subtitle-panel .lf-chip:focus-visible,
            #lf-subtitle-panel .lf-keyword-action:focus-visible,
            #lf-subtitle-panel .lf-band-header:focus-visible,
            #lf-subtitle-panel .lf-se-btn:focus-visible,
            #lf-subtitle-panel .lf-se-time-btn:focus-visible,
            #lf-subtitle-panel .lf-se-loop-btn:focus-visible { outline: 2px solid #38bdf8; outline-offset: 2px; }
            #lf-subtitle-panel .lf-se-header { padding: 14px 16px; border-bottom: 1px solid #384352; flex-shrink: 0; display: flex; flex-direction: column; gap: 10px; }
            #lf-subtitle-panel .lf-se-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
            #lf-subtitle-panel .lf-se-title-row { align-items: baseline; }
            #lf-subtitle-panel .lf-se-term { margin: 0; font-size: 18px; font-weight: 800; color: #f8fafc; }
            #lf-subtitle-panel .lf-se-count { font-size: 11px; color: #94a3b8; font-weight: 600; }
            #lf-subtitle-panel .lf-se-exports .lf-se-btn { flex: 1; justify-content: center; }
            #lf-subtitle-panel .lf-se-btn { display: inline-flex; align-items: center; gap: 6px; font: inherit; font-size: 12px; font-weight: 700; padding: 6px 12px; border-radius: 8px; cursor: pointer; background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.14); color: #e2e8f0; }
            #lf-subtitle-panel .lf-se-btn-accent { color: #7dd3fc; border-color: rgba(56,189,248,0.4); }
            #lf-subtitle-panel .lf-se-badge { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; padding: 3px 8px; border-radius: 6px; border: 1px solid currentColor; color: #7dd3fc; }
            #lf-subtitle-panel .lf-se-list { flex: 1; overflow-y: auto; padding: 12px; display: flex; flex-direction: column; gap: 8px; scrollbar-width: thin; }
            #lf-subtitle-panel .lf-sentence-card { border: 1px solid rgba(255,255,255,0.08); background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px 12px; display: flex; flex-direction: column; gap: 6px; }
            #lf-subtitle-panel .lf-sentence-card.is-looping { border-color: #38bdf8; background: rgba(2,132,199,0.2); }
            #lf-subtitle-panel .lf-se-time-btn { font: inherit; font-size: 11px; font-weight: 700; padding: 2px 6px; border-radius: 4px; border: none; cursor: pointer; background: rgba(56,189,248,0.12); color: #7dd3fc; }
            #lf-subtitle-panel .lf-se-loop-btn { font-size: 12px; padding: 2px 6px; border-radius: 4px; border: none; cursor: pointer; background: rgba(255,255,255,0.06); color: #94a3b8; }
            #lf-subtitle-panel .lf-se-text { margin: 0; font-size: 14px; font-weight: 700; line-height: 1.4; color: #f1f5f9; }
            #lf-subtitle-panel .lf-se-trans-line { margin: 0; font-size: 12.5px; font-weight: 600; line-height: 1.4; color: #94a3b8; }
            #lf-subtitle-panel .lf-se-pending { opacity: 0.7; font-style: italic; }
            #lf-subtitle-panel .lf-term-hit { background: rgba(56,189,248,0.18); color: inherit; padding: 0 3px; border-radius: 3px; font-weight: 800; border: none; }
            #lf-subtitle-panel .lf-term-hit.lf-chip-phrasal { background: rgba(244,114,182,0.2); }
            #lf-subtitle-panel .lf-term-hit.lf-chip-slang { background: rgba(251,146,60,0.22); }

            /* --- Tema claro --- */
            #lf-subtitle-panel.theme-light .lf-words-card { background: #ffffff; border-color: #dddfdf; }
            #lf-subtitle-panel.theme-light .lf-words-score,
            #lf-subtitle-panel.theme-light .lf-words-score-empty,
            #lf-subtitle-panel.theme-light .lf-keyword-action,
            #lf-subtitle-panel.theme-light .lf-chip,
            #lf-subtitle-panel.theme-light .lf-band-header { color: #334155; }
            #lf-subtitle-panel.theme-light .lf-words-score strong,
            #lf-subtitle-panel.theme-light .lf-words-counts dd,
            #lf-subtitle-panel.theme-light .lf-keywords-title,
            #lf-subtitle-panel.theme-light .lf-se-term,
            #lf-subtitle-panel.theme-light .lf-se-text { color: #162338; }
            #lf-subtitle-panel.theme-light .lf-words-counts dt,
            #lf-subtitle-panel.theme-light .lf-words-status,
            #lf-subtitle-panel.theme-light .lf-words-empty,
            #lf-subtitle-panel.theme-light .lf-keywords-hint,
            #lf-subtitle-panel.theme-light .lf-band-count,
            #lf-subtitle-panel.theme-light .lf-se-count,
            #lf-subtitle-panel.theme-light .lf-se-trans-line,
            #lf-subtitle-panel.theme-light .lf-se-loop-btn { color: #5b6472; }
            #lf-subtitle-panel.theme-light .lf-words-bar { background: #e5e7eb; }
            #lf-subtitle-panel.theme-light .lf-words-bar span { background: #047857; }
            #lf-subtitle-panel.theme-light .lf-words-nav { border-color: #dddfdf; }
            #lf-subtitle-panel.theme-light .lf-words-nav-btn { color: #5b6472; }
            #lf-subtitle-panel.theme-light .lf-words-nav-btn[aria-pressed="true"] { color: #0369a1; background: rgba(3,105,161,0.08); }
            #lf-subtitle-panel.theme-light .lf-chip,
            #lf-subtitle-panel.theme-light .lf-keyword-action { background: #ffffff; border-color: #cbd5e1; }
            #lf-subtitle-panel.theme-light .lf-chip:hover { background: #f3f2ef; }
            #lf-subtitle-panel.theme-light .lf-chip-phrasal { color: #be185d; border-color: rgba(190,24,93,0.35); }
            #lf-subtitle-panel.theme-light .lf-chip-slang { color: #c2410c; border-color: rgba(194,65,12,0.35); }
            #lf-subtitle-panel.theme-light .lf-chip-status-known { color: #15803d; }
            #lf-subtitle-panel.theme-light .lf-chip-status-mature { color: #047857; }
            #lf-subtitle-panel.theme-light .lf-chip-status-review { color: #0369a1; }
            #lf-subtitle-panel.theme-light .lf-chip-status-learning { color: #b45309; }
            #lf-subtitle-panel.theme-light .lf-chip-status-new { color: #1d4ed8; }
            #lf-subtitle-panel.theme-light .lf-band-header { background: #f3f2ef; }
            #lf-subtitle-panel.theme-light .lf-se-header { border-bottom-color: #dddfdf; }
            #lf-subtitle-panel.theme-light .lf-se-btn { background: #ffffff; border-color: #cbd5e1; color: #334155; }
            #lf-subtitle-panel.theme-light .lf-se-btn-accent,
            #lf-subtitle-panel.theme-light .lf-se-badge,
            #lf-subtitle-panel.theme-light .lf-se-time-btn { color: #0369a1; }
            #lf-subtitle-panel.theme-light .lf-sentence-card { background: #ffffff; border-color: #dddfdf; }
            #lf-subtitle-panel.theme-light .lf-se-loop-btn { background: #f3f2ef; }

            #lf-subtitle-panel .lf-subtitle-item.active {
                background: rgba(166, 190, 255, 0.12) !important;
                border-left-color: #a6beff !important;
                z-index: 10;
                box-shadow: none;
            }
            #lf-subtitle-panel .lf-subtitle-item.is-looping {
                background: rgba(2, 132, 199, 0.28) !important;
                border-left-color: #38bdf8 !important;
                border-left-width: 4px !important;
                z-index: 12;
                box-shadow: inset 0 0 16px rgba(56, 189, 248, 0.3), 0 4px 14px rgba(0, 0, 0, 0.4) !important;
            }
            #lf-subtitle-panel.theme-light .lf-subtitle-item.is-looping {
                background: rgba(2, 132, 199, 0.16) !important;
                border-left-color: #0284c7 !important;
                box-shadow: inset 0 0 12px rgba(2, 132, 199, 0.2), 0 2px 8px rgba(0, 0, 0, 0.1) !important;
            }
            #lf-subtitle-panel .lf-loop-cue.is-active {
                background: #0284c7 !important;
                color: #ffffff !important;
                border-radius: 6px !important;
                box-shadow: 0 0 10px rgba(56, 189, 248, 0.85) !important;
                padding: 2px 6px !important;
            }
            #lf-subtitle-panel .lf-subtitle-item {
                transition: background-color 0.14s, border-color 0.14s;
            }
            #lf-subtitle-panel .lf-subtitle-item:not(.active):not(.is-looping) {
                opacity: 0.8;
            }

            /* --- THEME STYLES --- */
            #lf-subtitle-panel {
                font-family: 'Nunito', sans-serif;
                box-shadow: -12px 0 28px rgba(0,0,0,0.22);
            }
            @media (prefers-reduced-motion: reduce) {
                #lf-subtitle-panel *, #lf-subtitle-panel *::before, #lf-subtitle-panel *::after {
                    animation-duration: 0.01ms !important;
                    transition-duration: 0.01ms !important;
                }
            }
            #lf-subtitle-panel.theme-light {
                background: #fcfbf8;
                border-left: 1px solid #d1d5db;
                color: #162338;
            }
            #lf-subtitle-panel.theme-dark {
                background: #161b24;
                border-left: 1px solid #384352;
                color: #edf0f4;
            }
            
            #lf-subtitle-panel.theme-light .lf-panel-header { background: #fcfbf8; border-bottom: 1px solid #dddfdf; }
            #lf-subtitle-panel.theme-dark .lf-panel-header { background: #161b24; border-bottom: 1px solid #384352; }
            
            #lf-subtitle-panel.theme-light .lf-panel-title { color: #162338; }
            #lf-subtitle-panel.theme-dark .lf-panel-title { color: #edf0f4; }
            
            #lf-subtitle-panel.theme-light .lf-close-btn { color: #afafaf; }
            #lf-subtitle-panel.theme-light .lf-close-btn:hover { background: #f7f7f7; color: #777777; }
            #lf-subtitle-panel.theme-dark .lf-close-btn { color: #64748B; }
            #lf-subtitle-panel.theme-dark .lf-close-btn:hover { background: #1e293b; color: #f8fafc; }

            #lf-subtitle-panel.theme-light .lf-tabs { background: #f3f2ef; border-bottom: 1px solid #dddfdf; }
            #lf-subtitle-panel.theme-dark .lf-tabs { background: #161b24; border-bottom: 1px solid #384352; }
            
            #lf-subtitle-panel.theme-light .lf-toolbar { background: #f3f2ef; border-bottom: 1px solid #dddfdf; }
            #lf-subtitle-panel.theme-dark .lf-toolbar { background: #1c2430; border-bottom: 1px solid #384352; }
            
            #lf-subtitle-panel.theme-light .lf-search-input { background: #ffffff; border: 1px solid #dddfdf; color: #162338; }
            #lf-subtitle-panel.theme-dark .lf-search-input { background: #202733; border: 1px solid #384352; color: #edf0f4; }

            #lf-subtitle-panel.theme-light .lf-search-input::placeholder { color: #afafaf; }
            
            #lf-subtitle-panel.theme-light .lf-subtitle-list { background: #fcfbf8; }
            #lf-subtitle-panel.theme-dark .lf-subtitle-list { background: #161b24; }

            #lf-subtitle-panel.theme-light .lf-subtitle-item { border-bottom: 1px solid #dddfdf; border-left: 2px solid transparent; }
            #lf-subtitle-panel.theme-dark .lf-subtitle-item { border-bottom: 1px solid #384352; border-left: 2px solid transparent; }
            
            #lf-subtitle-panel.theme-light .lf-subtitle-item:not(.active):hover { background: #f3f2ef !important; }
            #lf-subtitle-panel.theme-dark .lf-subtitle-item:not(.active):hover { background: #202733 !important; }
            
            #lf-subtitle-panel.theme-light .lf-time { color: #6b7280; }
            #lf-subtitle-panel.theme-light .lf-tab-btn.active { color: #2052c4 !important; border-bottom-color: #2052c4 !important; }
            #lf-subtitle-panel.theme-light .lf-tab-btn:not(.active) { color: #6b7280 !important; }
            #lf-subtitle-panel.theme-light #lf-export-pdf,
            #lf-subtitle-panel.theme-light #lf-export-csv { color: #475569 !important; border-color: #cbd5e1 !important; }
            #lf-subtitle-panel.theme-light #lf-export-anki,
            #lf-subtitle-panel.theme-light #lf-follow-btn { color: #0369a1 !important; }
            #lf-subtitle-panel.theme-dark .lf-time { color: #64748B; }
            
            #lf-subtitle-panel.theme-light .lf-trans-text { color: #2052c4; }
            #lf-subtitle-panel.theme-dark .lf-trans-text { color: #a6beff; }

            #lf-subtitle-panel.theme-light .lf-checkbox-label { color: #777777; }
            #lf-subtitle-panel.theme-dark .lf-checkbox-label { color: #94a3b8; }
        `;
}
