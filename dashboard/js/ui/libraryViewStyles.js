// dashboard/js/ui/libraryViewStyles.js — Estilos da tela Cofre, injetados uma vez no <head> pela libraryView.

export const LIBRARY_VIEW_CSS = `
        .library-container {
            padding: 40px;
            max-width: 1000px;
            margin: 0 auto;
            padding-bottom: 100px;
        }
        .lib-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 32px;
        }
        .lib-title-block h2 {
            font-size: 32px;
            color: var(--color-text);
            margin: 0 0 8px 0;
        }
        .lib-title-block p {
            color: var(--color-text-light);
            font-size: 16px;
            margin: 0;
        }
        .lib-stats {
            background: var(--color-surface);
            border: 2px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: 16px 24px;
            text-align: center;
        }
        .stat-number {
            font-size: 28px;
            font-weight: 900;
            color: var(--color-primary);
        }
        .stat-lbl {
            font-size: 12px;
            color: var(--color-text-light);
            text-transform: uppercase;
            font-weight: bold;
        }
        .cat-tabs {
            display: flex;
            gap: 12px;
            margin-bottom: 24px;
            overflow-x: auto;
            padding-bottom: 8px;
        }
        .cat-tab {
            padding: 12px 24px;
            border-radius: 20px;
            border: 2px solid var(--color-border);
            background: var(--color-surface);
            color: var(--color-text-light);
            font-weight: bold;
            cursor: pointer;
            white-space: nowrap;
            transition: color var(--motion-fast), background-color var(--motion-fast), border-color var(--motion-fast);
        }
        .cat-tab.active {
            background: var(--color-primary);
            color: white;
            border-color: var(--color-primary);
        }
        .az-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 32px;
            background: var(--color-surface);
            padding: 16px;
            border-radius: var(--radius-lg);
            border: 2px solid var(--color-border);
        }
        .az-letter {
            width: 40px;
            height: 40px;
            border-radius: 8px;
            border: 2px solid transparent;
            background: var(--color-bg-alt);
            color: var(--color-text);
            font-weight: bold;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: color var(--motion-fast), background-color var(--motion-fast);
        }
        .az-letter:hover {
            background: var(--color-border);
        }
        .az-letter.active {
            background: var(--color-secondary);
            color: white;
        }
        .lib-header-right { display:flex; align-items:center; gap:12px; }
        .lib-mode-switch { display:flex; background:var(--color-bg-alt); padding:3px; border-radius:10px; border:1px solid var(--color-border); }
        .lib-mode-btn { background:transparent; border:none; padding:8px 14px; border-radius:8px; font-family:var(--font-main); font-weight:800; font-size:13px; color:var(--color-text-light); cursor:pointer; transition:color var(--motion-fast), background-color var(--motion-fast), box-shadow var(--motion-fast); }
        .lib-mode-btn.active { background:var(--color-surface); color:var(--color-text); box-shadow:0 2px 6px rgba(0,0,0,0.06); }

        /* Decks Grid */
        .deck-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(290px, 1fr)); gap:18px; margin-top:20px; }
        .deck-card { background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-lg); padding:20px; display:flex; flex-direction:column; justify-content:space-between; gap:16px; box-shadow:0 4px 12px rgba(0,0,0,0.03); transition:transform 0.15s, border-color 0.15s; }
        .deck-card:hover { transform:translateY(-2px); border-color:var(--color-secondary); }
        .deck-card:focus-within { border-color:var(--color-secondary); box-shadow:0 0 0 2px var(--color-secondary); }
        .deck-card-top { display:flex; align-items:center; gap:12px; }
        .deck-icon { font-size:30px; width:46px; height:46px; display:grid; place-items:center; background:var(--color-bg-alt); border-radius:12px; }
        .deck-info { min-width:0; flex:1; }
        .deck-title { margin:0 0 2px 0; font-size:18px; font-weight:900; color:var(--color-text); }
        .deck-meta { font-size:13px; color:var(--color-text-light); font-weight:700; }
        .deck-counters { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .deck-badge { font-size:11px; font-weight:800; padding:4px 8px; border-radius:12px; display:inline-flex; align-items:center; gap:4px; }
        .deck-badge .badge-num { font-size:13px; font-weight:900; }
        .deck-actions { display:flex; gap:8px; }
        .btn-study-deck { flex:1; padding:10px; font-size:14px; font-weight:900; transition:transform 0.1s, box-shadow 0.1s; }
        .btn-study-deck:active { transform:translateY(2px); }
        .btn-filter-deck { padding:10px 14px; font-size:13px; transition:transform 0.1s; }
        .btn-filter-deck:active { transform:translateY(2px); }

        /* Batch Selection Header & Bar */
        .batch-select-header { display:flex; align-items:center; justify-content:space-between; padding:8px 4px; margin-bottom:8px; }
        .batch-select-label { font-size:13px; font-weight:800; color:var(--color-text); display:inline-flex; align-items:center; gap:8px; cursor:pointer; }
        .selected-count-badge { font-size:12px; font-weight:800; color:var(--color-primary); background:rgba(88,204,2,0.1); padding:4px 10px; border-radius:12px; }
        .card-select-wrap { display:grid; place-items:center; margin-right:12px; }
        .word-select-chk { width:18px; height:18px; cursor:pointer; accent-color:var(--color-primary); }

        .batch-bar { position:fixed; z-index:100; bottom:24px; left:50%; transform:translateX(-50%); background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-lg); padding:12px 20px; display:flex; align-items:center; justify-content:space-between; gap:20px; box-shadow:0 12px 36px rgba(0,0,0,0.18); width:min(720px, calc(100vw - 32px)); }
        .batch-bar-left { font-size:14px; font-weight:800; color:var(--color-text); white-space:nowrap; }
        .batch-bar-actions { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
        .btn-sm { padding:6px 12px; font-size:12px; font-weight:800; border-radius:8px; }

        .words-list {
            display: grid;
            gap: 16px;
        }
        .word-card {
            background: var(--color-surface);
            border: 2px solid var(--color-border);
            border-radius: var(--radius-md);
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            transition: transform var(--motion-fast), box-shadow var(--motion-fast);
        }
        .word-card.is-paused { border-style:dashed; }
        .word-info { min-width:0; flex:1; }
        .word-card-meta { margin-bottom:8px; }
        .word-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0,0,0,0.05);
        }
        .word-main {
            font-size: 20px;
            font-weight: 900;
            color: var(--color-text);
            margin-bottom: 4px;
        }
        .word-trans {
            font-size: 15px;
            color: var(--color-text-light);
        }
        .word-context { max-width:620px; margin:12px 0 0; padding:10px 12px; border-left:3px solid var(--color-secondary); background:var(--color-bg-alt); color:var(--color-text); font-size:14px; line-height:1.5; }
        .video-context { margin-top: 10px; max-width: 560px; }
        .video-context-label { color: var(--color-text-light); font-size: 12px; font-weight: 800; }
        .video-context-title { display: block; color: var(--color-text); font-size: 13px; margin: 3px 0 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .video-context-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .video-context-actions a, .video-context-embed { color: var(--color-secondary); background: transparent; border: 0; cursor: pointer; font: inherit; font-size: 13px; font-weight: 800; padding: 0; text-decoration: underline; }
        .video-context-frame { margin-top: 12px; aspect-ratio: 16 / 9; background: #000; border-radius: 12px; overflow: hidden; }
        .video-context-frame iframe { width: 100%; height: 100%; border: 0; }
        .word-actions {
            display: flex;
            align-items: center;
            gap: 16px;
        }
        .btn-delete {
            background: transparent;
            border: none;
            cursor: pointer;
            font-size: 20px;
            opacity: 0.5;
            transition: opacity 0.2s;
        }
        .btn-delete:hover {
            opacity: 1;
        }
        .badge {
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 12px;
            font-weight: bold;
        }
        .badge-new { background: var(--color-bg-alt); color: var(--color-text-light); }
        .badge-learning { background: var(--color-warning); color: white; }
        .badge-due { background:var(--color-danger); color:white; }
        .badge-review { background: var(--color-secondary); color: white; }
        .badge-mature { background: var(--color-primary); color: white; }
        .badge-paused { background: var(--color-bg-alt); color: var(--color-text-light); border:1px solid var(--color-border); }
        .view-state, .empty-state {
            text-align: center;
            padding: 60px;
            color: var(--color-text-light);
            font-weight: bold;
            background: var(--color-surface);
            border: 2px dashed var(--color-border);
            border-radius: var(--radius-lg);
        }
        .view-state { width:min(620px, calc(100% - 32px)); margin:32px auto; display:grid; justify-items:center; gap:10px; }
        .view-state-error { border-color:var(--color-danger); }
        .view-state strong, .empty-state strong, .empty-state span { display:block; }
        .view-state strong, .empty-state strong { color:var(--color-text); font-size:17px; }
        .empty-state span { margin:7px auto 14px; max-width:520px; font-weight:600; }
        @media (max-width: 768px) {
            .library-container { padding: 16px; padding-bottom: 100px; }
            .lib-header { flex-wrap: wrap; gap: 16px; }
            .lib-title-block h2 { font-size: 24px; }
            .word-card { flex-wrap: wrap; gap: 10px; }
            .word-actions { gap: 10px; }
            .empty-state { padding: 32px 16px; }
        }

        /* Segunda revisão: coleção editorial, sem transformar cada elemento em um card. */
        .library-container { padding-top: 28px; }
        .lib-stats, .deck-card, .word-card, .az-grid { box-shadow: none; border-width: 1px; }
        .cat-tab, .status-chip, .deck-badge, .selected-count-badge { border-radius: 4px; }
        .cat-tab { padding: 9px 14px; }
        .cat-tab.active { background: var(--color-text); border-color: var(--color-text); }
        .lib-mode-switch { background: transparent; border: 0; padding: 0; gap: 14px; }
        .lib-mode-btn { padding: 8px 0; border-radius: 0; border-bottom: 2px solid transparent; }
        .lib-mode-btn.active { background: transparent; box-shadow: none; border-bottom-color: var(--color-primary); }
        .deck-card { border-radius: 6px; border-top: 3px solid var(--color-border); }
        .deck-card:hover { transform: none; border-top-color: var(--color-secondary); }
        .deck-index { width: 32px; height: 32px; display: grid; place-items: center; border-left: 3px solid var(--color-secondary); color: var(--color-text); font-weight: 900; font-size: 18px; }
        .deck-badge { padding: 3px 6px; }
        .batch-bar { border-width: 1px; border-radius: 6px; box-shadow: 0 8px 24px rgba(0,0,0,.12); }
        .word-card:hover { transform: none; box-shadow: none; }
        @media (prefers-reduced-motion: reduce) {
            .library-container *, .library-container *::before, .library-container *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; }
        }
    `;
