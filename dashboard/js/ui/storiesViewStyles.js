// dashboard/js/ui/storiesViewStyles.js — Estilos da tela Histórias, injetados uma vez no <head> pela storiesView.

export const STORIES_VIEW_CSS = `
      @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      @keyframes slideUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      #story-content {
        max-width: 680px;
        margin: 0 auto;
        font-size: 19px;
        line-height: 1.85;
        letter-spacing: -0.003em;
        color: var(--color-text);
        font-family: 'Newsreader', 'Merriweather', 'Charter', 'Georgia', serif, system-ui;
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }
      .story-paragraph {
        margin: 0 0 24px 0;
        text-align: left;
        line-height: 1.85;
        word-break: break-word;
      }
      .story-paragraph:last-child {
        margin-bottom: 0;
      }
      .story-word {
        cursor: pointer;
        transition: color var(--motion-fast), background-color var(--motion-fast);
        border-radius: 4px;
        padding: 0 2px;
        display: inline;
      }
      .story-word:hover {
        background-color: rgba(88,204,2,0.18);
        color: var(--color-primary);
        font-weight: 600;
      }
      .story-word:focus-visible {
        outline: 2px solid var(--color-secondary);
        outline-offset: 2px;
      }
      .story-word.saved {
        border-bottom: 2px solid #ffc800;
        background: rgba(255,200,0,0.12);
      }
      .story-word.known {
        color: var(--color-primary);
      }
      #lf-story-word-tooltip {
        position: fixed;
        display: none;
        z-index: 9500;
        background: var(--color-surface);
        border: 1.5px solid var(--color-border);
        border-radius: 8px;
        padding: 6px 12px;
        font-size: 13px;
        font-weight: 600;
        color: var(--color-text);
        box-shadow: 0 6px 20px rgba(0,0,0,0.12);
        pointer-events: none;
        max-width: 260px;
        line-height: 1.4;
        transition: opacity 0.12s ease;
      }
      .lf-story-tab {
        transition: color var(--motion-fast, 0.15s) ease, border-color var(--motion-fast, 0.15s) ease;
      }
      .lf-story-tab:hover {
        color: var(--color-text) !important;
      }
      .lf-story-tab.active {
        color: var(--color-secondary) !important;
        border-bottom-color: var(--color-secondary) !important;
      }
      .quiz-opt { display:block; width:100%; text-align:left; margin:6px 0; padding:10px 14px; border:2px solid var(--color-border); border-radius:8px; background:var(--color-surface); color:var(--color-text); font-family:var(--font-main); font-size:14px; font-weight:600; cursor:pointer; }
      .quiz-opt:hover, .quiz-opt:focus-visible { border-color: var(--color-secondary); }
      .quiz-opt.correct { border-color: var(--color-primary); background: rgba(88,204,2,0.15); }
      .quiz-opt.wrong { border-color: #f44336; background: rgba(244,67,54,0.1); }
      .history-item { padding: 16px; border: 2px solid var(--color-border); border-radius: var(--radius-sm); background: var(--color-surface); cursor: pointer; display:flex; justify-content:space-between; align-items:center; }
      .history-item:hover { border-color: var(--color-primary); }
      .story-act { background:none; border:1px solid var(--color-border); border-radius:8px; padding:6px 9px; cursor:pointer; font-size:15px; line-height:1; }
      /* Celular (18/07): alvo de toque minimo de 44px — 30px era mira de agulha */
      @media (pointer: coarse) { .story-act { min-width:44px; min-height:44px; font-size:18px; } }
      .story-act:hover, .story-act:focus-visible { border-color: var(--color-secondary); }
      .story-archive-toggle { display:block; width:100%; margin:4px 0 10px; padding:8px; border:1px dashed var(--color-border); border-radius:10px; background:transparent; color:var(--color-text-light); font:700 13px var(--font-main); cursor:pointer; }
      .history-item.archived { opacity:.55; }
      .history-item .level-tag { font-size:11px; font-weight:bold; padding:2px 6px; border-radius:8px; background:var(--color-primary); color:white; margin-left:8px; vertical-align:middle; }
      .story-mode-tabs { display:grid; grid-template-columns:1fr 1fr; gap:6px; padding:5px; margin-bottom:24px; border:1px solid var(--color-border); border-radius:14px; background:var(--color-bg-alt); }
      .story-mode-tabs .lf-tab { min-height:46px; border:0; border-radius:10px; background:transparent; color:var(--color-text-light); font:800 15px var(--font-main); cursor:pointer; }
      .story-mode-tabs .lf-tab.active { color:var(--color-text); background:var(--color-surface); box-shadow:var(--shadow-sm); }
      .story-library-heading { margin-bottom:16px; }
      .story-library-heading h2 { margin:0 0 4px; color:var(--color-text); font-size:20px; }
      .story-library-heading p { margin:0; color:var(--color-text-light); font-size:14px; }
      .story-mission-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:14px; }
      .story-field { display:grid; gap:7px; color:var(--color-text); font-size:13px; font-weight:800; }
      .story-field select { width:100%; min-height:48px; padding:10px 12px; border:1px solid var(--color-border); border-radius:5px; background:var(--color-surface); color:var(--color-text); font:500 15px var(--font-main); cursor:pointer; }
      .story-field select:focus-visible { outline:3px solid var(--color-secondary); outline-offset:2px; }
      .story-create-actions { display:flex; justify-content:flex-start; margin-top:18px; }
      @media (max-width:620px) { .story-mission-grid { grid-template-columns:1fr; } .story-create-actions .btn { width:100%; justify-content:center; } }
      @media (max-width: 640px) {
        #story-content { font-size: 17px !important; line-height: 1.75 !important; }
        .story-paragraph { margin-bottom: 18px; }
        #story-title-display { font-size: 22px !important; }
      }
      #story-reader-container { border: 0 !important; border-top: 3px solid var(--color-secondary) !important; border-radius: 0 !important; box-shadow: none !important; }
      .story-create-panel, .history-item, .quiz-opt { border-radius: 4px !important; box-shadow: none !important; }
      .story-mode-tabs { border: 0; border-bottom: 1px solid var(--color-border); border-radius: 0; padding: 0; background: transparent; }
      .story-mode-tabs .lf-tab { border-radius: 0; }
      .story-mode-tabs .lf-tab.active { box-shadow: none; border-bottom: 2px solid var(--color-primary); }
      .lf-btn-bounce:hover { transform: none !important; }
      @media (prefers-reduced-motion: reduce) {
        .story-page *, .story-page *::before, .story-page *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
      }
    `;
