// dashboard/js/ui/homeViewStyles.js — Estilos da tela Início, injetados uma vez no <head> pela homeView.

export const HOME_VIEW_CSS = `
        .home-loading { padding: 32px; color: var(--color-text-light); font-weight: 700; }
        .onboarding-shell { min-height: calc(100vh - 150px); display: grid; place-items: center; padding: 24px; }
        .onboarding-card { width: min(100%, 620px); background: var(--color-surface); border: 2px solid var(--color-border); border-radius: 24px; padding: clamp(24px, 6vw, 48px); box-shadow: 0 8px 24px rgba(0,0,0,.08); }
        .onboarding-card h2 { color: var(--color-text); font-size: clamp(26px, 5vw, 34px); margin: 0 0 12px; }
        .onboarding-card p { color: var(--color-text-light); font-size: 16px; line-height: 1.55; }
        .onboarding-kicker { color: var(--color-primary) !important; font-size: 12px !important; font-weight: 900; letter-spacing: .08em; margin: 0 0 10px; }
        .onboarding-options { display: grid; gap: 12px; margin: 26px 0; }
        .onboarding-option { appearance: none; width: 100%; text-align: left; background: var(--color-bg-alt); border: 2px solid var(--color-border); border-radius: 14px; color: var(--color-text); cursor: pointer; font: inherit; padding: 16px; }
        .onboarding-option strong, .onboarding-option span { display: block; }
        .onboarding-option span { color: var(--color-text-light); font-size: 14px; margin-top: 4px; }
        .onboarding-option.selected { border-color: var(--color-primary); box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 22%, transparent); }
        .onboarding-option:focus-visible, .onboarding-actions button:focus-visible { outline: 3px solid #1cb0f6; outline-offset: 3px; }
        .onboarding-actions { display: flex; align-items: center; gap: 12px; justify-content: flex-end; margin-top: 28px; }
        .onboarding-actions .btn-action { flex: 0 1 auto; min-height: 52px; padding: 12px 20px; }
        .onboarding-back { background: transparent; border: 0; color: var(--color-text-light); cursor: pointer; font: inherit; font-weight: 800; padding: 12px; }
        .onboarding-status { min-height: 1.5em; color: #d9534f !important; font-weight: 700; }
        @media (max-width: 480px) { .onboarding-shell { padding: 16px; } .onboarding-actions { align-items: stretch; flex-direction: column-reverse; } .onboarding-actions .btn-action { width: 100%; } }
        .gamified-home {
            display: flex;
            flex-direction: column;
            gap: 24px;
            padding: clamp(12px, 4vw, 24px);
            max-width: 1200px;
            margin: 0 auto;
            font-family: 'Nunito', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: var(--color-bg);
            min-height: 100vh;
        }

        @media (min-width: 768px) {
            .gamified-home {
                flex-direction: row;
                align-items: flex-start;
            }
        }

        .dashboard-main {
            flex: 1;
            background: var(--color-surface);
            border: 2px solid var(--color-border);
            border-radius: 24px;
            padding: clamp(16px, 5vw, 32px);
            box-shadow: 0 8px 24px rgba(0,0,0,0.08);
            display: flex;
            flex-direction: column;
            gap: 32px;
        }

        .dashboard-header h2 {
            color: var(--color-text);
            font-size: 28px;
            margin: 0 0 8px 0;
        }

        .dashboard-header p {
            color: var(--color-text-light);
            font-size: 16px;
            margin: 0;
            font-weight: bold;
        }

        .home-data-warning { display:grid; gap:6px; padding:14px 16px; border:2px solid var(--color-warning); border-radius:14px; background:color-mix(in srgb, var(--color-warning) 12%, var(--color-surface)); color:var(--color-text); }
        .home-data-warning span { color:var(--color-text-light); font-size:13px; line-height:1.5; }
        .home-data-warning button { justify-self:start; min-height:44px; padding:0; border:0; background:transparent; color:var(--color-secondary); font:800 14px var(--font-main); cursor:pointer; }

        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 16px;
        }

        .stat-card {
            background: var(--color-bg-alt);
            border: 2px solid var(--color-border);
            border-radius: 16px;
            padding: 24px;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .stat-icon {
            font-size: 32px;
            margin-bottom: 8px;
        }

        .stat-value {
            font-size: 32px;
            font-weight: 900;
            color: var(--color-text);
            margin-bottom: 4px;
        }

        .stat-label {
            font-size: 14px;
            font-weight: bold;
            color: var(--color-text-light);
        }

        /* Conquistas (Onda 8): grade de badges — desbloqueadas em cor cheia
           com leve "pop" de fundo, bloqueadas em cinza/opacidade reduzida
           (o aluno vê o que existe pra alcançar, não só o que já tem). */
        .achievements-section { margin-bottom: 24px; }
        .achievements-grid {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(84px, 1fr));
            gap: 10px;
        }
        .achv-badge {
            display: flex;
            flex-direction: column;
            align-items: center;
            text-align: center;
            gap: 4px;
            padding: 10px 6px;
            border-radius: var(--radius-md);
            border: 2px solid var(--color-border);
            background: var(--color-bg-alt);
            transition: transform 0.15s;
        }
        .achv-badge.unlocked {
            border-color: var(--color-warning);
            background: rgba(255, 200, 0, 0.1);
        }
        .achv-badge.unlocked:hover { transform: translateY(-2px); }
        .achv-badge.locked { opacity: 0.4; filter: grayscale(1); }
        .achv-icon { font-size: 24px; }
        .achv-label {
            font-size: 10px;
            font-weight: 700;
            color: var(--color-text-light);
            line-height: 1.3;
        }

        .action-buttons {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        @media (min-width: 600px) {
            .action-buttons {
                flex-direction: row;
            }
        }

        .btn-action {
            flex: 1;
            padding: 20px;
            border-radius: 16px;
            font-size: 18px;
            font-weight: 800;
            font-family: inherit;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 12px;
            border: none;
            color: white;
            transition: transform 0.1s, box-shadow 0.1s;
        }

        .btn-study {
            background: #58cc02;
            box-shadow: 0 6px 0 #58a700;
        }

        .btn-study:hover {
            background: #61df02;
        }

        .btn-study:active {
            transform: translateY(6px);
            box-shadow: 0 0 0 #58a700;
        }

        .btn-icon {
            font-size: 24px;
        }

        .sidebar {
            width: 100%;
        }

        @media (min-width: 768px) {
            .sidebar {
                width: 350px;
                flex-shrink: 0;
            }
        }

        .quests-card {
            background: var(--color-surface);
            border-radius: 24px;
            border: 2px solid var(--color-border);
            padding: 24px;
        }

        .quests-card h3 {
            margin: 0 0 20px 0;
            color: var(--color-text);
            font-size: 20px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .quests-list {
            display: flex;
            flex-direction: column;
            gap: 16px;
        }

        .quest-item {
            display: flex;
            align-items: center;
            gap: 16px;
        }

        .quest-icon {
            font-size: 32px;
        }

        .quest-details {
            flex: 1;
        }

        .quest-text {
            font-weight: bold;
            color: var(--color-text);
            margin-bottom: 8px;
            font-size: 15px;
        }

        .quest-progress {
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .progress-bar {
            flex: 1;
            height: 12px;
            background: var(--color-border);
            border-radius: 6px;
            overflow: hidden;
        }

        .progress-fill {
            height: 100%;
            background: #ffc800;
            border-radius: 6px;
            transition: width 0.3s ease;
        }

        .progress-text {
            font-size: 14px;
            font-weight: bold;
            color: var(--color-text-light);
        }

        .heatmap-section {
            background: var(--color-bg-alt);
            border: 2px solid var(--color-border);
            border-radius: 16px;
            padding: 24px;
            margin-top: 16px;
        }

        .heatmap-header h3 {
            margin: 0 0 16px 0;
            color: var(--color-text);
            font-size: 18px;
        }

        .heatmap-grid {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .heatmap-cell {
            width: 18px;
            height: 18px;
            border-radius: 4px;
            background: var(--color-border);
            transition: transform 0.1s;
        }

        .heatmap-cell:hover {
            transform: scale(1.2);
        }

        .heatmap-cell[data-level="1"] { background: #9be9a8; }
        .heatmap-cell[data-level="2"] { background: #40c463; }
        .heatmap-cell[data-level="3"] { background: #30a14e; }
        .heatmap-cell[data-level="4"] { background: #216e39; }

        /* Issue #102: a Home editorial, with one clear action and quieter data. */
        .gamified-home { gap: 40px; background: var(--color-bg); }
        .gamified-home .dashboard-main { background: transparent; border: 0; border-radius: 0; box-shadow: none; padding: 0; }
        .home-primary-plan { border: 0; border-left: 4px solid var(--color-primary); border-radius: 0; background: var(--color-surface); box-shadow: none; }
        .home-primary-plan .btn-action { border-radius: 7px; box-shadow: none; transition: background-color .16s ease, border-color .16s ease; }
        .home-primary-plan .btn-action:hover { filter: none; background: var(--color-primary-shadow); }
        .home-primary-plan .btn-action:active { transform: none; box-shadow: none; }
        .stats-grid { gap: 0; border-top: 1px solid var(--color-border); border-bottom: 1px solid var(--color-border); }
        .stat-card { background: transparent; border: 0; border-right: 1px solid var(--color-border); border-radius: 0; padding: 18px 14px; align-items: flex-start; text-align: left; }
        .stat-card:last-child { border-right: 0; }
        .stat-icon { display: none; }
        .stat-value { font-size: 28px; margin-bottom: 2px; }
        .stat-label { font-size: 12px; font-weight: 700; }
        .stat-note { margin-top: 3px; color: var(--color-text-light); font-size: 11px; }
        .home-study-hours-card, .home-memory-insight-card { background: transparent; border: 0; border-top: 1px solid var(--color-border); border-radius: 0; padding: 22px 0; }
        .study-hours-language { display: inline-grid; place-items: center; min-width: 38px; min-height: 38px; border: 1px solid var(--color-border); color: var(--color-secondary); font-size: 12px; font-weight: 900; letter-spacing: .06em; }
        .study-hours-flag { display: none; }
        .study-skills-grid { gap: 0; border-top: 1px solid var(--color-border); }
        .study-skill-pill { background: transparent; border: 0; border-bottom: 1px solid var(--color-border); border-radius: 0; padding: 12px 0; }
        .skill-icon { display: none; }
        .study-skill-pill .skill-name { text-transform: none; letter-spacing: 0; }
        .home-alert-banner { border-width: 1px; border-radius: 0; box-shadow: none; }
        .home-alert-icon { display: none; }
        .memory-badge { font-size: 12px; }
        .home-secondary-actions .btn-action { border-radius: 7px; box-shadow: none; transition: background-color .16s ease, border-color .16s ease; }
        .home-secondary-actions .btn-action:active { transform: none; box-shadow: none; }
        .quests-card { background: transparent; border: 0; border-top: 1px solid var(--color-border); border-radius: 0; padding: 22px 0; }
        .quest-mark { width: 10px; height: 10px; flex: 0 0 10px; border: 2px solid var(--color-border); border-radius: 50%; }
        .quest-done .quest-mark { background: var(--color-primary); border-color: var(--color-primary); }
        .quest-item[style] { background: transparent !important; border-radius: 0 !important; padding: 8px 0 !important; margin: 0 !important; border-left: 3px solid #bd5b12; }
        .progress-bar { height: 5px; border-radius: 0; }
        .progress-fill { border-radius: 0; transition: width .2s ease; }
        .achv-badge { border-width: 1px; border-radius: 4px; background: transparent; }
        .achv-badge.unlocked { border-color: var(--color-primary); background: transparent; }
        .achv-badge.unlocked:hover { transform: none; }
        .heatmap-section { background: transparent; border: 0; border-top: 1px solid var(--color-border); border-radius: 0; padding: 22px 0; }
        .heatmap-cell { border-radius: 1px; transition: none; }
        .heatmap-cell:hover { transform: none; }
        .home-more { border: 0; border-top: 1px solid var(--color-border); border-radius: 0; background: transparent; }
        .home-more[open] { border-color: var(--color-border); }
        .home-more > summary { padding-left: 0; padding-right: 0; }
        .home-more-body { padding-left: 0; padding-right: 0; }
        @media (prefers-reduced-motion: reduce) { .home-primary-plan .btn-action, .home-secondary-actions .btn-action, .progress-fill { transition: none !important; } }

        /* Issue #109: referência visual atualizada — azul de estudo, bordas
           finas e uma composição de leitura, não uma parede de cards. */
        .gamified-home { max-width: 1240px; padding: 26px clamp(16px, 4vw, 34px) 44px; gap: 0; }
        .gamified-home .dashboard-main { width:100%; }
        .dashboard-header { margin-bottom: 2px; }
        .dashboard-header-row { display:flex; align-items:flex-start; justify-content:space-between; gap:24px; }
        .dashboard-header h2 { font-size:clamp(32px, 4vw, 44px); letter-spacing:-.035em; line-height:1; margin-bottom:10px; }
        .dashboard-header p { font-size:16px; font-weight:600; color:var(--color-text-light); }
        .home-date-label { flex:0 0 auto; min-height:44px; display:inline-flex; align-items:center; padding:0 14px; border:1px solid var(--color-border); border-radius:10px; color:var(--color-text); font-weight:800; font-size:13px; white-space:nowrap; }
        .home-primary-plan { position:relative; min-height:230px; display:grid; grid-template-columns:minmax(0, 1fr) 280px; gap:24px; align-items:center; overflow:hidden; padding:26px; border:1px solid color-mix(in srgb, var(--color-secondary) 45%, var(--color-border)); border-radius:14px; background:linear-gradient(110deg, color-mix(in srgb, var(--color-secondary) 12%, var(--color-surface)), var(--color-surface)); }
        .home-primary-copy { position:relative; z-index:1; }
        .home-primary-plan h1 { max-width:620px; margin:8px 0 12px; font-size:clamp(28px, 4vw, 40px); letter-spacing:-.035em; }
        .home-primary-reason { max-width:650px; color:var(--color-text-light); }
        .home-primary-meta { margin:12px 0 20px; }
        .home-primary-plan .btn-action { display:inline-flex; align-items:center; gap:14px; min-width:228px; min-height:48px; padding:12px 16px; border:0; border-radius:9px; background:var(--color-primary); color:#06120a; font-size:16px; letter-spacing:0; }
        .home-primary-plan .btn-action span { font-size:24px; line-height:1; }
        .home-primary-plan .btn-action:hover { background:color-mix(in srgb, var(--color-primary) 86%, white); }
        .home-primary-visual { position:relative; min-height:170px; display:grid; place-items:center; }
        .home-story-shortcut { width:100%; min-height:150px; padding:22px; display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-end; gap:7px; border:1px solid color-mix(in srgb, var(--color-secondary) 55%, var(--color-border)); border-radius:11px; background:color-mix(in srgb, var(--color-secondary) 8%, var(--color-surface)); color:var(--color-text); text-align:left; cursor:pointer; transition:border-color .16s ease, background-color .16s ease; }
        .home-story-shortcut:hover, .home-story-shortcut:focus-visible { border-color:var(--color-secondary); background:color-mix(in srgb, var(--color-secondary) 13%, var(--color-surface)); }
        .home-story-shortcut-kicker { color:var(--color-secondary); font-size:10px; font-weight:900; letter-spacing:.13em; }
        .home-story-shortcut strong { font:400 24px/1.15 var(--font-reading); }
        .home-story-shortcut > span:last-child { color:var(--color-text-light); font-size:12px; line-height:1.4; }
        .home-note-card { position:relative; width:168px; min-height:110px; padding:20px; border:1px solid #2e6ba5; border-radius:12px; background:#13375d; color:#d7edff; transform:rotate(-7deg); box-shadow:14px 10px 0 rgba(22,75,123,.35); font:italic 18px/1.15 Georgia, serif; }
        .home-note-card::before, .home-note-card::after { content:''; position:absolute; inset:7px -20px -7px 20px; border:1px solid rgba(37,169,255,.35); border-radius:12px; z-index:-1; }
        .home-note-card::after { inset:14px -32px -14px 32px; opacity:.55; }
        .home-note-card i { display:block; width:62px; height:6px; margin-top:16px; border-radius:3px; background:var(--color-secondary); }
        .home-note-caption { position:absolute; right:6px; bottom:16px; color:var(--color-secondary); font-size:13px; font-weight:900; transform:rotate(-6deg); }
        .stats-grid { grid-template-columns:repeat(4, minmax(0, 1fr)); gap:12px; margin-top:16px; border:0; }
        .stat-card { position:relative; min-height:94px; padding:16px 16px 14px 56px; border:1px solid var(--color-border); border-radius:11px; background:color-mix(in srgb, var(--color-surface) 92%, var(--color-secondary)); }
        .stat-card:last-child { border-right:1px solid var(--color-border); }
        .stat-symbol { position:absolute; top:17px; left:16px; display:grid; place-items:center; width:30px; height:30px; border-radius:50%; background:rgba(37,169,255,.16); color:var(--color-secondary); font-size:20px; font-weight:800; }
        .stat-value { font-size:24px; line-height:1; }
        .stat-label { margin-top:7px; font-size:13px; font-weight:700; }
        .home-study-hours-card { margin-top:16px; padding:18px; border:1px solid var(--color-border); border-radius:14px; background:var(--color-surface); }
        .study-hours-header { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:14px; }
        .study-hours-title-wrap { display:flex; align-items:center; gap:12px; }
        .study-hours-language { min-width:38px; min-height:38px; border:0; border-radius:50%; background:rgba(37,169,255,.16); color:var(--color-secondary); }
        .study-hours-title { font-size:16px; }
        .study-hours-subtitle { font-size:12px; color:var(--color-text-light); }
        .study-skills-grid { display:grid; grid-template-columns:repeat(4, minmax(0, 1fr)); gap:0; padding:14px 0 0; border:1px solid var(--color-border); border-radius:11px; background:color-mix(in srgb, var(--color-bg) 55%, var(--color-surface)); }
        .study-skill-pill { min-width:0; padding:0 16px 14px; border:0; border-right:1px solid var(--color-border); border-radius:0; background:transparent; }
        .study-skill-pill:last-child { border-right:0; }
        .study-skill-pill .skill-name { display:block; margin-bottom:5px; color:var(--color-text-light); font-size:13px; font-weight:600; }
        .study-skill-pill .skill-time { font-size:16px; }
        .home-critical-cards-card { margin-top:16px; padding:18px; border:1px solid var(--color-border); border-radius:14px; background:var(--color-surface); }
        .critical-cards-header { margin-bottom:14px; }
        .critical-cards-title { font-size:16px; }
        .critical-cards-subtitle { display:block; margin-top:4px; color:var(--color-text-light); font-size:12px; }
        .critical-cards-list { display:grid; gap:1px; margin:0; padding:0; list-style:none; border:1px solid var(--color-border); border-radius:11px; overflow:hidden; }
        .critical-cards-footer { margin-top:14px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
        .critical-cards-footer .critical-cards-subtitle { margin-top:0; }
        .critical-cards-footer .btn { min-height:44px; margin-left:auto; }
        .critical-card-item { min-height:52px; display:flex; align-items:center; justify-content:space-between; gap:14px; padding:9px 14px; background:color-mix(in srgb, var(--color-bg) 48%, var(--color-surface)); }
        .critical-card-main { min-width:0; display:grid; gap:2px; }
        .critical-card-word { font-size:14px; }
        .critical-card-trans { color:var(--color-text-light); font-size:12px; }
        .critical-card-tags { display:flex; align-items:center; gap:8px; flex-wrap:wrap; justify-content:flex-end; margin-left:auto; }
        .critical-card-item { flex-wrap:wrap; }
        .critical-card-actions { display:flex; gap:4px; }
        .critical-card-action { min-height:44px; padding:0 10px; border:0; border-radius:8px; background:transparent; color:var(--color-secondary); font:700 13px var(--font-main); cursor:pointer; transition:background-color .16s ease; }
        .critical-card-action:hover { background:color-mix(in srgb, var(--color-secondary) 10%, transparent); }
        .critical-card-action:disabled { color:var(--color-text-light); cursor:progress; }
        @media (prefers-reduced-motion: reduce) { .critical-card-action { transition:none; } }
        .badge-lapse, .badge-leech { border-radius:999px; padding:5px 9px; font-size:11px; font-weight:800; white-space:nowrap; }
        .badge-lapse { color:var(--color-text); background:rgba(255,75,75,.16); border:1px solid rgba(255,75,75,.5); }
        .badge-leech { color:#2b1b00; background:#ffd977; }
        .home-secondary-actions { margin-top:18px; grid-template-columns:repeat(2,minmax(0, 1fr)); }
        .home-secondary-actions .btn-action { justify-content:space-between; padding:0 18px; border:1px solid var(--color-secondary); border-radius:9px; background:transparent; color:var(--color-secondary); }
        .home-secondary-actions .btn-action::after { content:'›'; font-size:24px; line-height:1; }
        .home-more { margin-top:22px; }
        @media (max-width: 760px) {
            .gamified-home { padding:18px 14px 34px; }
            .dashboard-header-row { display:block; }
            .home-date-label { margin-top:12px; }
            .home-primary-plan { grid-template-columns:1fr; min-height:0; padding:22px 18px; }
            .home-primary-visual { min-height:0; margin-top:4px; }
            .home-story-shortcut { min-height:112px; }
            .stats-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
            .study-hours-header { align-items:flex-start; flex-direction:column; }
            .study-hours-header #btn-open-log-study { width:100%; }
            .study-skills-grid { grid-template-columns:repeat(2, minmax(0, 1fr)); }
            .study-skill-pill:nth-child(2) { border-right:0; }
            .study-skill-pill:nth-child(-n+2) { border-bottom:1px solid var(--color-border); padding-bottom:12px; }
            .study-skill-pill:nth-child(n+3) { padding-top:12px; }
            .critical-card-item { align-items:flex-start; flex-direction:column; gap:7px; }
            .critical-card-tags { justify-content:flex-start; }
            .home-secondary-actions { grid-template-columns:1fr; }
        }
        @media (prefers-reduced-motion: reduce) { .home-note-card { transform:none; } }
    `;
