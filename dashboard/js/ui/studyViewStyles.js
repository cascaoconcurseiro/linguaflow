// dashboard/js/ui/studyViewStyles.js — Estilos da tela Estudar (revisão FSRS), injetados uma vez no <head> pela studyView.

export const STUDY_VIEW_CSS = `
    .study-layout { display:block; min-height:100%; width:100%; background-color:var(--color-bg-alt); }
    .study-main { width:100%; box-sizing:border-box; display:flex; flex-direction:column; align-items:center; padding:32px 24px 48px; position:relative; }

    .anki-study-header { width:100%; max-width:720px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; margin-bottom:16px; }
    .anki-session-counters { display:flex; align-items:center; gap:8px; }
    .anki-counter-badge { font-size:12px; font-weight:800; padding:4px 10px; border-radius:14px; display:inline-flex; align-items:center; gap:4px; }
    .anki-badge-new { background:#eff6ff; color:#2563eb; border:1px solid #bfdbfe; }
    .anki-badge-learn { background:#fff7ed; color:#ea580c; border:1px solid #fed7aa; }
    .anki-badge-review { background:#f0fdf4; color:#16a34a; border:1px solid #bbf7d0; }
    .anki-card-quick-actions { display:flex; align-items:center; gap:6px; }
    .anki-card-timer { display:inline-flex; align-items:center; gap:4px; font-family:var(--font-main, monospace); font-variant-numeric:tabular-nums; letter-spacing:0.5px; font-size:12px; font-weight:800; color:var(--color-secondary); background:rgba(28, 176, 246, 0.1); border:1px solid rgba(28, 176, 246, 0.25); padding:4px 10px; border-radius:8px; transition:opacity 0.2s ease; }
    .anki-action-btn { min-height:36px; padding:6px 12px; border-radius:8px; border:1px solid var(--color-border); background:var(--color-surface); color:var(--color-text); font-family:var(--font-main); font-size:12px; font-weight:800; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:transform 0.1s, background-color 0.2s; }
    .anki-action-btn:hover { background:var(--color-bg-alt); }
    .anki-action-btn:active { transform:translateY(2px); }
    .anki-action-btn:focus-visible { outline: 2px solid var(--color-secondary); outline-offset: 2px; }

    .anki-modal-overlay { position:fixed; z-index:9999; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); backdrop-filter:blur(3px); display:flex; justify-content:center; align-items:center; padding:16px; }
    .anki-modal-box { background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-lg); width:min(520px, 100%); max-height:90vh; overflow-y:auto; box-shadow:var(--shadow-lg); padding:24px; }
    .anki-modal-header { display:flex; justify-content:space-between; align-items:center; margin-bottom:18px; border-bottom:1px solid var(--color-border); padding-bottom:12px; }
    .anki-modal-header h3 { margin:0; font-size:18px; color:var(--color-text); font-weight:900; }
    .anki-modal-close { background:transparent; border:none; font-size:20px; color:var(--color-text-light); cursor:pointer; padding:4px 8px; font-weight:bold; }
    .anki-modal-form { display:grid; gap:16px; }
    .anki-form-group { display:grid; gap:6px; text-align:left; }
    .anki-form-group label { font-size:13px; font-weight:800; color:var(--color-text); }
    .anki-form-group input, .anki-form-group textarea { width:100%; box-sizing:border-box; padding:10px 12px; border:2px solid var(--color-border); border-radius:var(--radius-md); font-family:var(--font-main); font-size:15px; background:var(--color-bg-alt); color:var(--color-text); }
    .anki-form-group input:focus, .anki-form-group textarea:focus { border-color:var(--color-secondary); outline:none; }
    .anki-modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:16px; }

    .card-info-modal-box { width:min(560px, 100%); }
    .card-info-header-row { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; }
    .card-info-word { font-size:22px; font-weight:900; color:var(--color-primary); }
    .card-info-grid { display:grid; grid-template-columns:repeat(2, minmax(0, 1fr)); gap:10px; margin-bottom:20px; }
    .card-info-cell { background:var(--color-bg-alt); padding:10px 12px; border-radius:10px; display:flex; flex-direction:column; gap:4px; text-align:left; }
    .card-info-cell.full-width { grid-column:span 2; }
    .cell-label { font-size:11px; font-weight:800; color:var(--color-text-light); text-transform:uppercase; letter-spacing:0.5px; }
    .cell-value { font-size:15px; font-weight:900; color:var(--color-text); }
    .card-info-history h4 { margin:0 0 10px 0; font-size:14px; font-weight:900; color:var(--color-text); text-align:left; }
    .card-history-table { width:100%; border-collapse:collapse; font-size:13px; text-align:left; }
    .card-history-table th, .card-history-table td { padding:8px 10px; border-bottom:1px solid var(--color-border); }
    .card-history-table th { color:var(--color-text-light); font-weight:800; font-size:11px; text-transform:uppercase; }
    .empty-history { font-size:13px; color:var(--color-text-light); text-align:left; font-style:italic; }

    .media-container { width:100%; max-width:720px; min-height:88px; background:var(--color-surface); border:2px solid var(--color-border); border-radius:var(--radius-lg); display:flex; align-items:center; justify-content:center; margin-bottom:28px; }

    .audio-wave-placeholder { display: flex; align-items: center; gap: 8px; opacity: 0.5; transition: opacity 0.3s; }
    .audio-wave-placeholder.is-playing { opacity:1; }
    .wave-bar { width:8px; height:30px; background:var(--color-secondary); border-radius:4px; animation:wave 1s infinite alternate; animation-play-state:paused; }
    .audio-wave-placeholder.is-playing .wave-bar { animation-play-state:running; }
    .wave-bar:nth-child(2) { animation-delay: 0.2s; height: 50px; }
    .wave-bar:nth-child(3) { animation-delay: 0.4s; height: 20px; }
    .wave-bar:nth-child(4) { animation-delay: 0.6s; height: 40px; }
    .wave-bar:nth-child(5) { animation-delay: 0.8s; height: 30px; }
    @keyframes wave { 0% { transform: scaleY(0.5); } 100% { transform: scaleY(1.2); } }

    .btn-play-audio { background: var(--color-secondary); color: white; border: none; border-bottom: 4px solid var(--color-secondary-shadow); width: 44px; height: 44px; border-radius: 22px; font-size: 18px; cursor: pointer; margin-left: 16px; display:flex; align-items:center; justify-content:center;}
    .btn-play-audio:active { transform: translateY(4px); border-bottom-width: 0; }

    .sentence-container { text-align:center; max-width:720px; width:100%; margin-bottom:24px; transition:transform 0.12s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.12s ease; }
    .sentence-container.card-discard-pass { transform: translateY(-14px); opacity: 0; }
    .sentence-container.card-discard-fail { transform: translateX(-16px) rotate(-1deg); opacity: 0; }
    .sentence-container.card-enter-next { animation: cardEnter 0.14s cubic-bezier(0.16, 1, 0.3, 1) both; }
    @keyframes cardEnter {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .sentence-text { font-size: 32px; font-weight: 800; color: var(--color-text); line-height: 1.5; margin-bottom: 32px; }

    .cloze-blur { background: var(--color-border); color: transparent; padding: 0 16px; border-radius: var(--radius-md); user-select: none; transition: all 0.3s; display: inline-block; min-width: 60px;}
    .cloze-revealed { background: rgba(88, 204, 2, 0.15); color: var(--color-primary); }

    .ex-chip { background: var(--color-surface); border: 2px solid var(--color-border); border-bottom-width: 4px; border-radius: 12px; padding: 10px 16px; font-family: var(--font-main); font-weight: 800; font-size: 16px; color: var(--color-text); cursor: pointer; transition: transform 0.1s; }
    .ex-chip:hover { border-color: var(--color-secondary); }
    .ex-chip:active { transform: translateY(2px); }
    .ex-chip-used { background: rgba(28,176,246,0.12); border-color: var(--color-secondary); }

    .reveal-btn { font-size: 20px; padding: 16px 40px; width:100%; max-width: 320px; margin: 0 auto; display: block; box-shadow: 0 4px 0 var(--color-primary-shadow); transition: transform 0.1s, box-shadow 0.1s; }
    .reveal-btn:hover:not(:disabled) { filter: brightness(1.05); }
    .reveal-btn:active:not(:disabled) { transform: translateY(4px); box-shadow: 0 0 0 transparent !important; }
    .reveal-btn:disabled { opacity: 0.6; cursor: default; }

    .grading-buttons { margin-top:16px; width:100%; max-width:720px; }
    .grading-row { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:12px; width:100%; }
    .grade-btn { flex: 1; font-family: var(--font-main); font-weight: 800; font-size: 18px; padding: 16px 8px; border-radius: var(--radius-md); border: none; cursor: pointer; color: white; display: flex; flex-direction: column; align-items: center; gap: 6px; transition: transform 0.1s, box-shadow 0.1s, filter 0.15s; }
    .grade-btn:hover:not(:disabled) { filter: brightness(1.06); }
    .grade-btn:active { transform: translateY(4px); box-shadow: 0 0 0 transparent !important; }
    button:focus-visible, input:focus-visible, summary:focus-visible { outline: 3px solid var(--color-secondary); outline-offset: 3px; }
    .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; border:0; }

    .btn-danger { background: #ff4b4b; box-shadow: 0 4px 0 #cc3c3c; }
    .btn-warning { background: #ff9600; box-shadow: 0 4px 0 #cc7800; }
    .btn-secondary { background: var(--color-secondary); box-shadow: 0 4px 0 var(--color-secondary-shadow); }

    .study-explore { width:min(100%, 720px); margin-top:20px; }
    .study-explore-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:start; }
    .study-resources { width:100%; border:0; border-top:1px solid var(--color-border); background:transparent; }
    .study-resources > summary { min-height:52px; padding:0 4px; cursor:pointer; list-style:none; display:flex; align-items:center; justify-content:space-between; color:var(--color-text); font-weight:800; }
    .study-resources > summary::-webkit-details-marker { display:none; }
    .study-resources > summary > span:last-child { color:var(--color-text-light); transition:transform .15s ease; }
    .study-resources[open] > summary > span:last-child { transform:rotate(180deg); }
    .study-resources-content { width:100%; max-width:720px; box-sizing:border-box; margin:0 auto; padding:0 0 28px; overflow:visible; background:transparent; }
    .study-resource-panel-header { min-height:52px; margin:0 0 12px; padding:0; display:flex; align-items:center; justify-content:space-between; border-bottom:1px solid var(--color-border); background:transparent; }
    .study-resource-panel-header strong { font-size:18px; }
    .study-resource-panel-header button { min-height:44px; border:0; background:transparent; color:var(--color-secondary); font-weight:900; cursor:pointer; }
    .learning-resource-section { margin:0 0 18px; padding:18px 0; border:0; border-top:1px solid var(--color-border); background:transparent; }
    .learning-resource-section h3 { margin:4px 0 6px; font-size:20px; }
    .learning-resource-kicker { margin:0; color:var(--color-primary); font-size:11px; font-weight:800; letter-spacing:.08em; }
    .learning-resource-description { margin:0 0 14px; color:var(--color-text-light); font-size:13px; line-height:1.5; }
    .learning-resource-video { border-color:var(--color-secondary); background:color-mix(in srgb, var(--color-secondary) 6%, var(--color-surface)); }
    .study-session-context { display:flex; align-items:center; justify-content:space-between; gap:12px; margin:16px 0; padding:10px 12px; border-radius:10px; background:var(--color-bg-alt); color:var(--color-text-light); font-size:13px; }
    .study-session-context button, .study-card-actions button { min-height:44px; border:0; background:transparent; color:var(--color-secondary); font:inherit; font-weight:800; cursor:pointer; }
    .study-card-menu { position:relative; }
    .study-card-menu > summary { width:52px; height:52px; display:grid; place-items:center; list-style:none; border:2px solid var(--color-border); border-radius:var(--radius-lg); background:var(--color-surface); color:var(--color-text); font-size:24px; font-weight:900; cursor:pointer; }
    .study-card-menu > summary::-webkit-details-marker { display:none; }
    .study-card-menu-content { position:absolute; z-index:35; right:0; top:calc(100% + 8px); width:min(300px, calc(100vw - 24px)); padding:10px; border:1px solid var(--color-border); border-radius:14px; background:var(--color-surface); box-shadow:var(--shadow-md); }
    .study-card-actions { display:grid; gap:4px; }
    .study-card-actions button { width:100%; text-align:left; padding:8px 10px; border-radius:9px; }
    .study-card-actions button:hover, .study-card-actions button:focus-visible { background:var(--color-bg-alt); }
    .study-mnemonic { margin-top:14px; }
    .context-explanation-card { width:100%; max-width:720px; box-sizing:border-box; margin:12px auto 0; border-left:3px solid var(--color-secondary); background:transparent; text-align:left; overflow:hidden; }
    .context-explanation-card > summary { min-height:42px; padding:8px 12px; display:flex; align-items:center; justify-content:space-between; gap:10px; cursor:pointer; list-style:none; color:var(--color-text); font-size:13.5px; font-weight:800; background:var(--color-bg-alt); user-select:none; }
    .context-explanation-card > summary::-webkit-details-marker { display:none; }
    .context-explanation-card > summary:hover { background:color-mix(in srgb, var(--color-secondary) 8%, var(--color-bg-alt)); }
    .context-explanation-card[open] > summary { border-bottom:1px solid var(--color-border); }
    .context-explanation-card > summary > span:first-child { display:inline-flex; align-items:center; gap:8px; color:var(--color-secondary); }
    .context-explanation-card > summary > span:last-child { color:var(--color-text-light); font-size:15px; font-weight:900; transition:transform 0.2s cubic-bezier(0.4, 0, 0.2, 1); }
    .context-explanation-card[open] > summary > span:last-child { transform:rotate(180deg); }
    #iso-context-explanation { padding:12px 14px 12px 16px; color:var(--color-text); font-size:14px; line-height:1.6; background:var(--color-surface); }
    .rich-word-container { display:flex; flex-direction:column; gap:8px; }
    .rich-word-header { display:flex; align-items:center; justify-content:space-between; gap:10px; }
    .rich-word-meta { flex:1; min-width:0; display:flex; flex-direction:column; gap:3px; }
    .rich-word-title-row { display:flex; align-items:center; gap:8px; flex-wrap:wrap; }
    .rich-word-title { font-size:17px; font-weight:900; color:var(--color-text); line-height:1.2; }
    .rich-arrow { color:var(--color-text-light); font-size:13px; font-weight:700; opacity:0.7; }
    .rich-trans-text { font-size:17px; font-weight:800; color:var(--color-primary); line-height:1.2; }
    .btn-iso-audio { width:32px; height:32px; background:rgba(28,176,246,0.1); border:1px solid rgba(28,176,246,0.25); border-radius:50%; color:var(--color-secondary); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; font-size:14px; flex-shrink:0; transition:transform 0.1s, background-color 0.15s; }
    .btn-iso-audio:hover { background:rgba(28,176,246,0.2); transform:scale(1.05); }
    .btn-iso-audio:active { transform:scale(0.95); }
    .rich-explain-box { padding:8px 0 2px; }
    .rich-context-label { margin-bottom:4px; color:var(--color-secondary); font-size:11px; font-weight:900; letter-spacing:.06em; text-transform:uppercase; }
    .rich-explain-body { font-size:13.5px; color:var(--color-text); line-height:1.55; }
    .rich-quote-box { background:var(--color-bg-alt); border-left:3px solid var(--color-secondary); border-radius:0 8px 8px 0; padding:8px 12px; font-size:13px; color:var(--color-text-light); line-height:1.5; font-style:italic; }
    .rich-quote-label { font-weight:700; font-style:normal; color:var(--color-secondary); font-size:11px; text-transform:uppercase; letter-spacing:.04em; margin-right:4px; }
    .context-word-highlight { color:#fb923c; font-weight:700; font-style:normal; }
    @media (max-width:640px) {
      .context-explanation-card > summary { padding:9px 12px; font-size:13px; }
      #iso-context-explanation { padding:10px 12px; }
      .rich-word-title { font-size:15px; }
      .rich-trans-text { font-size:15px; }
    }

    .more-contexts { border:1px solid var(--color-border); border-radius:14px; background:var(--color-surface); }
    .more-contexts > summary { min-height:48px; padding:0 14px; display:flex; align-items:center; cursor:pointer; color:var(--color-text); font-weight:900; }
    .more-contexts-content { padding:0 14px 14px; display:grid; gap:16px; }
    .more-contexts-content h3 { margin:8px 0; font-size:16px; }
    .sidebar-title { font-size: 22px; font-weight: 900; margin-bottom: 24px; color: var(--color-text); display:flex; align-items:center; gap:8px;}
    .chunks-list { display: flex; flex-direction: column; gap: 16px; }
    .chunk-more { border-top:1px solid var(--color-border); }
    .chunk-more > summary { min-height:44px; display:flex; align-items:center; color:var(--color-secondary); font-weight:900; cursor:pointer; }
    .chunk-more > div { display:flex; flex-direction:column; gap:16px; padding-top:8px; }

    .chunk-card { background: var(--color-surface); border: 1px solid var(--color-border); border-left:4px solid var(--color-primary); border-radius:4px 10px 10px 4px; padding:16px 18px; position:relative; overflow:hidden;}
    .chunk-label { margin-bottom:6px; color:var(--color-primary); font-size:11px; font-weight:800; letter-spacing:.06em; text-transform:uppercase; }
    .chunk-en { font-weight: 900; font-size: 18px; color: var(--color-text); margin-bottom: 6px; }
    .chunk-br { font-size: 15px; color: var(--color-secondary); font-weight: 800; margin-bottom: 8px; }
    .chunk-pt { font-size: 14px; color: var(--color-text-light); font-style: italic; background: var(--color-bg-alt); display: inline-block; padding: 4px 10px; border-radius: 12px;}

    .chunk-action-btn { background: var(--color-secondary); color: white; border: none; border-radius: 50%; width: 36px; height: 36px; font-size: 15px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
    .chunk-action-btn { min-width:44px; min-height:44px; }
    .chunk-action-btn:disabled { opacity: 0.5; cursor: default; }
    .chunk-save-btn { background: var(--color-primary); }


    #youglish-box { padding:10px; border-radius:12px; background:var(--color-bg-alt); }
    #youglish-box .btn { width:100%; min-height:44px; padding:9px; font-size:13px; }
    #youglish-fallback { margin-top:8px; display:inline-flex; color:var(--color-secondary); font-weight:900; }
    #yg-widget-embed { width: 100%; min-height: 0; }
    #yg-widget-embed iframe { max-width: 100%; border-radius: var(--radius-md); }
    .study-video-context { width:min(100%, 620px); margin:18px auto 0; text-align:left; }
    #saved-video-context:empty { display:none; }
    .video-context { max-width: 560px; }
    .video-context-label { color: var(--color-text-light); font-size: 12px; font-weight: 800; }
    .video-context-title { display: block; color: var(--color-text); font-size: 13px; margin: 3px 0 7px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .video-context-actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
    .video-context-actions a, .video-context-embed { color: var(--color-secondary); background: transparent; border: 0; cursor: pointer; font: inherit; font-size: 13px; font-weight: 800; padding: 0; text-decoration: underline; }
    .video-context-actions .clip-control { min-height:40px; padding:8px 12px; border:2px solid var(--color-secondary); border-radius:10px; text-decoration:none; background:rgba(28,176,246,.10); }
    .video-context-actions .clip-control:disabled { opacity:.65; cursor:wait; }
    .clip-status { margin-top:8px; color:var(--color-text-light); font-size:12px; line-height:1.4; }
    .video-context-frame { margin-top: 12px; aspect-ratio: 16 / 9; background: #000; border-radius: 12px; overflow: hidden; }
    .video-context-frame iframe { width: 100%; height: 100%; border: 0; }
    #study-yt-mount { width:min(100%, 620px); margin:12px auto 0; aspect-ratio: 16 / 9; background: #000; border-radius:var(--radius-md); overflow:hidden; }
    #study-yt-mount iframe { width: 100%; height: 100%; border: 0; }
    .exercise-grade-prompt { margin-top:14px; color:var(--color-text-light); font-size:15px; font-weight:700; }
    #bury-btn, #btn-undo, .clip-control, .ex-chip { min-height:44px; }


    @media (prefers-reduced-motion: reduce) {
      .wave-bar { animation:none !important; }
      .sentence-container, .sentence-container.card-discard-pass, .sentence-container.card-discard-fail, .sentence-container.card-enter-next, .grade-btn, .reveal-btn, .anki-action-btn, .btn-skill-option, .btn-duration-chip { transition:none !important; transform:none !important; animation:none !important; opacity: 1 !important; }
      * { scroll-behavior:auto !important; }
    }

    @media (max-width: 768px) {
      /* O #app-root é a única área que rola no celular. Antes havia três
         scroll containers concorrentes e o card parecia metade fixo. */
      .study-layout { min-height:100dvh; }
      .study-main { min-height:calc(100dvh - var(--topbar-height)); padding:18px 14px 28px; justify-content:flex-start; }
      .study-layout.is-revealed .study-main { padding-bottom:calc(92px + env(safe-area-inset-bottom)); }
      .study-resources-content { width:100%; max-width:none; padding:0 0 22px; }
      .study-resource-panel-header { margin-left:0; margin-right:0; }
      .study-card-menu-content { position:fixed; left:10px; right:10px; top:auto; bottom:calc(82px + env(safe-area-inset-bottom)); width:auto; }
      .grading-buttons { position:fixed; z-index:20; left:0; right:0; bottom:0; margin:0; padding:10px 12px calc(10px + env(safe-area-inset-bottom)); background:var(--color-surface); border-top:2px solid var(--color-border); box-shadow:0 -8px 24px rgba(0,0,0,.10); }
      .grading-row { grid-template-columns:repeat(4,minmax(0,1fr)); gap:5px; max-width:680px; margin:0 auto; }
      .grade-btn { min-width:0; min-height:58px; padding:7px 2px; font-size:13px; gap:2px; }
      .grade-btn span:last-child { font-size:10px !important; }
      .study-video-context { margin-top:16px; }
      .sentence-text { font-size: 26px; }
    }
    @media (max-width: 380px) {
      .study-main { padding:16px 10px 24px; }
      .study-layout.is-revealed .study-main { padding-bottom:calc(88px + env(safe-area-inset-bottom)); }
      .media-container { height: 76px; margin-bottom: 20px; }
      .sentence-text { font-size: 22px; margin-bottom: 22px; }
      .grading-buttons { padding-left:6px; padding-right:6px; }
      .grade-btn { font-size:12px; min-height:56px; }
    }

    @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

    @keyframes xpFloat {
      0% { opacity:1; transform:translate(-50%,-50%) scale(1); }
      50% { opacity:1; transform:translate(-50%,-80%) scale(1.2); }
      100% { opacity:0; transform:translate(-50%,-120%) scale(0.8); }
    }

    .loading-spinner {
      width: 40px;
      height: 40px;
      border: 4px solid rgba(88, 204, 2, 0.2);
      border-left-color: var(--color-primary);
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    @keyframes spin { 100% { transform: rotate(360deg); } }

    /* Issue #102: study is a quiet instrument, not a stack of promotional cards. */
    .study-layout { background: var(--color-bg); }
    .study-main { padding-top: 24px; }
    .anki-session-counters { gap: 14px; }
    .anki-counter-badge { padding: 3px 0; border: 0; border-radius: 0; background: transparent; color: var(--color-text-light); font-size: 11px; }
    .anki-counter-badge strong { color: var(--color-text); font-size: 14px; }
    .anki-card-timer { padding: 3px 0; border: 0; border-radius: 0; background: transparent; color: var(--color-text-light); }
    .timer-label { font-size: 10px; letter-spacing: .04em; text-transform: uppercase; }
    .media-container { min-height: 72px; border: 0; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); border-radius: 0; background: transparent; }
    .btn-play-audio { width: auto; height: auto; min-height: 44px; margin-left: 14px; padding: 8px 14px; border: 1px solid var(--color-secondary); border-radius: 5px; background: transparent; color: var(--color-secondary); font-size: 14px; }
    .btn-play-audio:active { transform: none; border-bottom-width: 1px; }
    .sentence-container { transition: opacity .12s ease; }
    .sentence-text { max-width: 780px; font-size: clamp(26px, 4vw, 34px); letter-spacing: -.01em; }
    .cloze-blur { border-radius: 3px; }
    .reveal-btn { max-width: 360px; border-radius: 6px; box-shadow: none; transition: background-color .16s ease, border-color .16s ease; }
    .reveal-btn:active:not(:disabled) { transform: none; box-shadow: none !important; }
    .study-explore { margin-top: 28px; }
    .study-resources > summary { border-top: 0; font-size: 14px; }
    .study-card-menu > summary { width: 44px; height: 44px; border: 1px solid var(--color-border); border-radius: 5px; font-size: 20px; }
    .study-card-menu-content { border-radius: 5px; box-shadow: 0 8px 24px rgba(27,45,54,.12); }
    .study-card-actions button { border-radius: 4px; }
    .context-explanation-card { border-left: 0; border-top: 2px solid var(--color-secondary); border-radius: 0; }
    .context-explanation-card > summary { padding-left: 0; padding-right: 0; background: transparent; }
    .context-explanation-card > summary:hover { background: transparent; }
    #iso-context-explanation { padding-left: 0; padding-right: 0; background: transparent; }
    .btn-iso-audio { width: auto; min-width: 44px; height: 44px; padding: 8px 10px; border-radius: 5px; background: transparent; font-size: 12px; transition: background-color .16s ease, border-color .16s ease; }
    .btn-iso-audio:hover, .btn-iso-audio:active { background: var(--color-bg-alt); transform: none; }
    .rich-quote-box { border-radius: 0; background: transparent; padding-left: 10px; }
    .chunk-card { border-left-width: 3px; border-radius: 0; padding: 16px 0 16px 14px; }
    .chunk-pt { border-radius: 0; background: transparent; padding-left: 0; }
    .chunk-action-btn { width: auto; height: 44px; min-width: 64px; border: 1px solid var(--color-border); border-radius: 4px; background: transparent; color: var(--color-secondary); font-size: 11px; font-weight: 800; }
    .chunk-action-btn:hover { background: var(--color-bg-alt); }
    .chunk-save-btn { background: transparent; color: var(--color-primary-dark, var(--color-primary)); }
    .chat-bubble-ai, .chat-bubble-user { border-radius: 4px; }
    .video-context-frame, #study-yt-mount { border-radius: 4px; }
    .video-context-actions .clip-control { border-radius: 4px; background: transparent; }
    .learning-resource-video { background: transparent; border-color: var(--color-border); }
    .study-empty-mark { color: var(--color-text-light); font-size: 36px; line-height: 1; margin-bottom: 16px; }
    @media (prefers-reduced-motion: reduce) {
      .sentence-container, .reveal-btn, .btn-iso-audio { transition: none !important; }
      .wave-bar { animation: none !important; }
    }

    /* Issue #109 / scroll-isolation: a sessão de estudo ocupa toda a altura
       disponível. O #app-root NÃO rola (body.lf-study-mode bloqueia isso);
       apenas .study-main rola internamente. Os botões de avaliação ficam
       fixos em relação à viewport — sem scrollbar externa aparecendo. */
    body.lf-study-mode #app-root { overflow: hidden; }
    .study-layout { background:var(--color-bg); display:flex; flex-direction:column; height:calc(100dvh - var(--topbar-height)); overflow:hidden; }
    .study-main { flex:1; overflow-y:auto; overflow-x:hidden; overscroll-behavior:contain; scrollbar-width:thin; width:min(100%, 1160px); margin:0 auto; padding:24px 28px calc(var(--study-grading-dock-height, 140px) + 24px); box-sizing:border-box; }
    .sentence-container { max-width:none; margin:0 0 14px; padding:25px 48px 28px; border:1px solid var(--color-border); border-radius:14px; background:var(--color-surface); text-align:center; overflow:visible; }
    .anki-study-header { width:100%; max-width:none; margin:0 0 18px; padding:0 4px 14px; border-bottom:1px solid var(--color-border); }
    .anki-session-counters { gap:0; }
    .anki-counter-badge { min-width:116px; padding:0 22px; border:0; border-right:1px solid var(--color-border); border-radius:0; background:transparent; color:var(--color-text-light); font-size:13px; }
    .anki-counter-badge:first-child { padding-left:0; }
    .anki-counter-badge:last-child { border-right:0; }
    .anki-counter-badge strong { display:block; color:var(--color-text); font-size:24px; line-height:1; }
    .anki-card-timer { padding:0; border:0; background:transparent; color:var(--color-secondary); font-size:16px; }
    .timer-label { display:block; font-size:11px; color:var(--color-text-light); }
    .study-card-meta { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:28px; text-align:left; }
    .study-card-meta > div:first-child { display:grid; gap:3px; }
    .study-card-meta-actions { display:flex; align-items:center; justify-content:flex-end; gap:12px; flex:0 0 auto; margin-left:auto; }
    .study-card-meta strong { color:var(--color-text); font-size:14px; letter-spacing:.06em; }
    .study-card-meta span { color:var(--color-text-light); font-size:13px; }
    .study-card-meta-position { padding:8px 12px; border:1px solid var(--color-border); border-radius:999px; white-space:nowrap; }
    .sentence-text { max-width:980px; margin:0 auto 18px; font-size:clamp(30px, 4.3vw, 54px); line-height:1.16; letter-spacing:-.035em; }
    .media-container { width:auto; max-width:none; min-height:56px; margin:0 auto 12px; border:0; background:transparent; border-radius:0; }
    .audio-wave-placeholder { gap:7px; }
    .wave-bar { width:5px; height:22px; border-radius:4px; background:var(--color-secondary); }
    .wave-bar:nth-child(2) { height:34px; }
    .wave-bar:nth-child(3) { height:17px; }
    .wave-bar:nth-child(4) { height:29px; }
    .wave-bar:nth-child(5) { height:22px; }
    .btn-play-audio { display:inline-flex; align-items:center; justify-content:center; width:auto; min-width:92px; height:44px; margin-left:14px; padding:0 14px; border:1px solid var(--color-secondary); border-radius:8px; border-bottom-width:1px; background:rgba(37,169,255,.14); color:var(--color-secondary); font-size:13px; font-weight:800; }
    .btn-play-audio:active { transform:none; border-bottom-width:1px; }
    .btn-iso-audio { width:auto; min-width:44px; height:44px; padding:0 12px; border:1px solid var(--color-secondary); border-radius:8px; background:transparent; color:var(--color-secondary); }
    .context-explanation-card { max-width:920px; margin:18px auto 0; border:0; border-top:1px solid var(--color-border); }
    .context-explanation-card > summary { min-height:52px; padding:0; background:transparent; font-size:15px; }
    .context-explanation-card > summary:hover { background:transparent; }
    #iso-context-explanation { padding:12px 0 0; background:transparent; text-align:left; }
    .rich-word-title { font-size:21px; }
    .rich-trans-text { font-size:21px; }
    .rich-explain-body { font-size:15px; line-height:1.6; }
    .rich-context-label { color:var(--color-primary); }
    .rich-quote-box { margin-top:12px; background:transparent; border-left:2px solid var(--color-secondary); border-radius:0; }
    .grading-buttons { position:fixed; inset:auto 0 0; z-index:110; width:100%; max-width:none; margin:0; }
    .grading-row { gap:12px; }
    .grade-btn { min-height:88px; border-radius:12px; border:0; font-size:18px; box-shadow:none; }
    .grade-btn:hover:not(:disabled) { filter:brightness(1.06); }
    .grade-btn:active { transform:translateY(2px); box-shadow:none !important; }
    .btn-danger { background:#ff3f4b; }
    .btn-warning { background:#ff9819; }
    .btn-secondary { background:#169de8; }
    .btn-primary { background:var(--color-primary); color:#06120a; }
    .study-explore { width:100%; max-width:none; margin-top:20px; }
    .study-resources > summary { min-height:56px; padding:0 4px; border-top:0; font-size:16px; }
    .study-resources-content { max-width:none; }
    .study-resource-panel-header { min-height:56px; }
    .learning-resource-section { padding:18px 0; }
    .more-contexts { border:1px solid var(--color-border); border-radius:10px; background:var(--color-surface); }
    .more-contexts > summary { min-height:52px; padding:0 16px; }
    @media (max-width: 720px) {
      .study-main { padding:16px 12px calc(var(--study-grading-dock-height, 104px) + 16px); }
      .anki-study-header { align-items:flex-start; }
      .anki-session-counters { width:100%; justify-content:space-between; }
      .anki-counter-badge { min-width:0; padding:0 10px; font-size:11px; }
      .anki-counter-badge:first-child { padding-left:0; }
      .anki-card-quick-actions { width:100%; justify-content:flex-end; margin-top:-4px; }
      .sentence-container { padding:20px 14px 22px; border-radius:12px; }
      .study-card-meta { margin-bottom:22px; }
      .study-card-meta > div:first-child span { max-width:210px; }
      .sentence-text { font-size:clamp(26px, 8vw, 36px); }
      .grading-row { gap:6px; }
      .grade-btn { min-height:72px; padding:8px 3px; font-size:14px; }
    }
    @media (prefers-reduced-motion: reduce) {
      .home-note-card, .sentence-container { transform:none !important; }
      .wave-bar { animation:none !important; }
    }
  `;
