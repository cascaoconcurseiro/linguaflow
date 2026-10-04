// content/subtitles/youtube-dock-styles.js — CSS dos controles LinguaFlow na barra do YouTube (Issue #429)
// Extraído sem alteração de content/subtitle-engine.js; o texto é injetado em <style id="lf-yt-styles">.

export const YOUTUBE_DOCK_CSS = `
          #lf-yt-horizontal-dock {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            height: 38px;
            padding: 0 8px;
            border-radius: 999px;
            background: rgba(8, 12, 22, 0.82);
            border: 1px solid rgba(255, 255, 255, 0.16);
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.4);
            backdrop-filter: blur(12px) saturate(150%);
            margin-right: 6px;
            vertical-align: middle;
            box-sizing: border-box;
            transition: all 0.2s ease;
            flex-shrink: 0;
          }
          .lf-dock-btn {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            border: none;
            background: transparent;
            color: #f8fafc;
            font: 700 16px/1 system-ui, -apple-system, sans-serif;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            padding: 0;
            transition: background 0.18s ease, color 0.18s ease, transform 0.15s ease, box-shadow 0.18s ease;
            outline: none;
            flex-shrink: 0;
          }
          .lf-dock-btn:hover,
          .lf-dock-btn:focus-visible {
            background: rgba(56, 189, 248, 0.22);
            color: #7dd3fc;
            transform: scale(1.08);
          }
          .lf-dock-btn[data-action="previous"],
          .lf-dock-btn[data-action="next"] {
            font-size: 19px;
            line-height: 1;
          }
          .lf-dock-toggle {
            height: 32px;
            padding: 0 6px;
            border-radius: 999px;
            border: none;
            background: transparent;
            display: inline-flex;
            align-items: center;
            gap: 6px;
            cursor: pointer;
            color: #94a3b8;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.02em;
            transition: color 0.2s ease;
            outline: none;
            flex-shrink: 0;
          }
          .lf-dock-toggle[aria-pressed="true"],
          .lf-dock-toggle.active {
            color: #7dd3fc;
          }
          .lf-dock-toggle .lf-switch-track {
            width: 28px;
            height: 14px;
            background: #334155;
            border-radius: 999px;
            position: relative;
            transition: background 0.25s ease;
            display: inline-block;
            flex-shrink: 0;
          }
          .lf-dock-toggle[aria-pressed="true"] .lf-switch-track,
          .lf-dock-toggle .lf-switch-track.active,
          .lf-switch-track.active {
            background: #0284c7;
          }
          .lf-dock-toggle .lf-switch-thumb {
            position: absolute;
            top: 2px;
            left: 2px;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #cbd5e1;
            transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1), background 0.25s ease;
          }
          .lf-dock-toggle[aria-pressed="true"] .lf-switch-thumb,
          .lf-dock-toggle .lf-switch-track.active .lf-switch-thumb,
          .lf-switch-track.active .lf-switch-thumb {
            transform: translateX(14px);
            background: #38bdf8;
            box-shadow: 0 0 8px #38bdf8;
          }
          .lf-dock-btn[data-action="loop"].is-active,
          .lf-dock-btn[data-action="loop"][aria-pressed="true"] {
            background: rgba(56, 189, 248, 0.28);
            color: #7dd3fc;
            box-shadow: 0 0 10px rgba(56, 189, 248, 0.45), inset 0 0 0 1px rgba(125, 211, 252, 0.45);
          }
          .lf-dock-btn[data-action="speed"] {
            font-size: 12px;
            letter-spacing: -0.02em;
            width: 32px;
          }
          .lf-dock-btn[data-action="speed"].is-altered {
            color: #facc15;
            background: rgba(250, 204, 21, 0.18);
            box-shadow: inset 0 0 0 1px rgba(250, 204, 21, 0.45);
          }
          .lf-dock-btn[data-action="panel"].is-active {
            background: rgba(168, 85, 247, 0.25);
            color: #c084fc;
            box-shadow: 0 0 10px rgba(168, 85, 247, 0.45), inset 0 0 0 1px rgba(168, 85, 247, 0.5);
          }
          .lf-dock-btn[data-action="previous"]:active,
          .lf-dock-btn[data-action="next"]:active {
            background: rgba(56, 189, 248, 0.3);
            color: #38bdf8;
            transform: scale(0.92);
          }
          #lf-yt-horizontal-dock.lf-off > :not(.lf-dock-toggle) { display: none !important; }
          .lf-dock-sep {
            width: 1px;
            height: 18px;
            background: rgba(255, 255, 255, 0.18);
            margin: 0 2px;
            flex-shrink: 0;
          }

          /* Modo Compacto: Player intermediário (< 820px ou .ytp-small-mode) */
          .ytp-small-mode #lf-yt-horizontal-dock,
          #lf-yt-horizontal-dock.lf-size-compact {
            height: 32px;
            padding: 0 5px;
            gap: 2px;
            margin-right: 4px;
          }
          .ytp-small-mode #lf-yt-horizontal-dock .lf-dock-btn,
          #lf-yt-horizontal-dock.lf-size-compact .lf-dock-btn {
            width: 28px;
            height: 28px;
            font-size: 14px;
          }
          .ytp-small-mode #lf-yt-horizontal-dock .lf-dock-btn[data-action="previous"],
          .ytp-small-mode #lf-yt-horizontal-dock .lf-dock-btn[data-action="next"],
          #lf-yt-horizontal-dock.lf-size-compact .lf-dock-btn[data-action="previous"],
          #lf-yt-horizontal-dock.lf-size-compact .lf-dock-btn[data-action="next"] {
            font-size: 16px;
          }
          .ytp-small-mode #lf-yt-horizontal-dock .lf-dock-toggle,
          #lf-yt-horizontal-dock.lf-size-compact .lf-dock-toggle {
            height: 28px;
            padding: 0 4px;
            gap: 4px;
            font-size: 11px;
          }
          .ytp-small-mode #lf-yt-horizontal-dock .lf-switch-track,
          #lf-yt-horizontal-dock.lf-size-compact .lf-switch-track {
            width: 24px;
            height: 12px;
          }
          .ytp-small-mode #lf-yt-horizontal-dock .lf-switch-thumb,
          #lf-yt-horizontal-dock.lf-size-compact .lf-switch-thumb {
            width: 8px;
            height: 8px;
          }
          .ytp-small-mode #lf-yt-horizontal-dock .lf-dock-toggle[aria-pressed="true"] .lf-switch-thumb,
          .ytp-small-mode #lf-yt-horizontal-dock .lf-switch-track.active .lf-switch-thumb,
          #lf-yt-horizontal-dock.lf-size-compact .lf-dock-toggle[aria-pressed="true"] .lf-switch-thumb,
          #lf-yt-horizontal-dock.lf-size-compact .lf-switch-track.active .lf-switch-thumb {
            transform: translateX(12px);
          }
          .ytp-small-mode #lf-yt-horizontal-dock .lf-dock-sep,
          #lf-yt-horizontal-dock.lf-size-compact .lf-dock-sep {
            height: 14px;
            margin: 0 1px;
          }

          /* Modo Mini: Player reduzido (< 620px) */
          #lf-yt-horizontal-dock.lf-size-mini {
            height: 28px;
            padding: 0 4px;
            gap: 2px;
            margin-right: 3px;
          }
          #lf-yt-horizontal-dock.lf-size-mini .lf-dock-btn {
            width: 24px;
            height: 24px;
            font-size: 12px;
          }
          #lf-yt-horizontal-dock.lf-size-mini .lf-dock-btn[data-action="settings"] {
            font-size: 13px;
          }
          #lf-yt-horizontal-dock.lf-size-mini .lf-dock-toggle {
            height: 24px;
            padding: 0 3px;
            gap: 0;
          }
          #lf-yt-horizontal-dock.lf-size-mini .lf-toggle-text {
            display: none;
          }
          #lf-yt-horizontal-dock.lf-size-mini .lf-switch-track {
            width: 22px;
            height: 11px;
          }
          #lf-yt-horizontal-dock.lf-size-mini .lf-switch-thumb {
            width: 7px;
            height: 7px;
          }
          #lf-yt-horizontal-dock.lf-size-mini .lf-dock-toggle[aria-pressed="true"] .lf-switch-thumb,
          #lf-yt-horizontal-dock.lf-size-mini .lf-switch-track.active .lf-switch-thumb {
            transform: translateX(11px);
          }
          #lf-yt-horizontal-dock.lf-size-mini .lf-dock-sep,
          #lf-yt-horizontal-dock.lf-size-mini .lf-dock-btn[data-action="previous"],
          #lf-yt-horizontal-dock.lf-size-mini .lf-dock-btn[data-action="next"] {
            display: none !important;
          }

          /* Modo Tiny: Player muito pequeno / split-screen estreito (< 480px) */
          #lf-yt-horizontal-dock.lf-size-tiny {
            height: 26px;
            padding: 0 2px;
            gap: 1px;
            margin-right: 2px;
          }
          #lf-yt-horizontal-dock.lf-size-tiny .lf-dock-btn {
            width: 22px;
            height: 22px;
            font-size: 11px;
          }
          #lf-yt-horizontal-dock.lf-size-tiny .lf-dock-btn[data-action="settings"] {
            font-size: 12px;
          }
          #lf-yt-horizontal-dock.lf-size-tiny .lf-dock-toggle {
            height: 22px;
            padding: 0 2px;
            gap: 0;
          }
          #lf-yt-horizontal-dock.lf-size-tiny .lf-toggle-text {
            display: none;
          }
          #lf-yt-horizontal-dock.lf-size-tiny .lf-switch-track {
            width: 18px;
            height: 10px;
          }
          #lf-yt-horizontal-dock.lf-size-tiny .lf-switch-thumb {
            width: 6px;
            height: 6px;
          }
          #lf-yt-horizontal-dock.lf-size-tiny .lf-dock-toggle[aria-pressed="true"] .lf-switch-thumb,
          #lf-yt-horizontal-dock.lf-size-tiny .lf-switch-track.active .lf-switch-thumb {
            transform: translateX(8px);
          }
          #lf-yt-horizontal-dock.lf-size-tiny .lf-dock-sep,
          #lf-yt-horizontal-dock.lf-size-tiny .lf-dock-btn[data-action="previous"],
          #lf-yt-horizontal-dock.lf-size-tiny .lf-dock-btn[data-action="next"],
          #lf-yt-horizontal-dock.lf-size-tiny .lf-dock-btn[data-action="loop"],
          #lf-yt-horizontal-dock.lf-size-tiny .lf-dock-btn[data-action="speed"] {
            display: none !important;
          }

          /* Fallback responsivo via Viewport Media Queries */
          @media (max-width: 820px) {
            #lf-yt-horizontal-dock:not(.lf-size-mini):not(.lf-size-tiny) {
              height: 32px;
              padding: 0 5px;
              gap: 2px;
              margin-right: 4px;
            }
            #lf-yt-horizontal-dock:not(.lf-size-mini):not(.lf-size-tiny) .lf-dock-btn {
              width: 28px;
              height: 28px;
              font-size: 14px;
            }
            #lf-yt-horizontal-dock:not(.lf-size-mini):not(.lf-size-tiny) .lf-dock-toggle {
              height: 28px;
              padding: 0 4px;
              gap: 4px;
              font-size: 11px;
            }
            #lf-yt-horizontal-dock:not(.lf-size-mini):not(.lf-size-tiny) .lf-switch-track {
              width: 24px;
              height: 12px;
            }
            #lf-yt-horizontal-dock:not(.lf-size-mini):not(.lf-size-tiny) .lf-switch-thumb {
              width: 8px;
              height: 8px;
            }
            #lf-yt-horizontal-dock:not(.lf-size-mini):not(.lf-size-tiny) .lf-dock-toggle[aria-pressed="true"] .lf-switch-thumb,
            #lf-yt-horizontal-dock:not(.lf-size-mini):not(.lf-size-tiny) .lf-switch-track.active .lf-switch-thumb {
              transform: translateX(12px);
            }
            #lf-yt-horizontal-dock:not(.lf-size-mini):not(.lf-size-tiny) .lf-dock-sep {
              height: 14px;
              margin: 0 1px;
            }
          }

          @media (max-width: 620px) {
            #lf-yt-horizontal-dock:not(.lf-size-tiny) {
              height: 28px;
              padding: 0 4px;
              gap: 2px;
              margin-right: 3px;
            }
            #lf-yt-horizontal-dock:not(.lf-size-tiny) .lf-dock-btn {
              width: 24px;
              height: 24px;
              font-size: 12px;
            }
            #lf-yt-horizontal-dock:not(.lf-size-tiny) .lf-dock-btn[data-action="settings"] {
              font-size: 13px;
            }
            #lf-yt-horizontal-dock:not(.lf-size-tiny) .lf-dock-toggle {
              height: 24px;
              padding: 0 3px;
              gap: 0;
            }
            #lf-yt-horizontal-dock:not(.lf-size-tiny) .lf-toggle-text {
              display: none;
            }
            #lf-yt-horizontal-dock:not(.lf-size-tiny) .lf-switch-track {
              width: 22px;
              height: 11px;
            }
            #lf-yt-horizontal-dock:not(.lf-size-tiny) .lf-switch-thumb {
              width: 7px;
              height: 7px;
            }
            #lf-yt-horizontal-dock:not(.lf-size-tiny) .lf-dock-toggle[aria-pressed="true"] .lf-switch-thumb,
            #lf-yt-horizontal-dock:not(.lf-size-tiny) .lf-switch-track.active .lf-switch-thumb {
              transform: translateX(11px);
            }
            #lf-yt-horizontal-dock:not(.lf-size-tiny) .lf-dock-sep,
            #lf-yt-horizontal-dock:not(.lf-size-tiny) .lf-dock-btn[data-action="previous"],
            #lf-yt-horizontal-dock:not(.lf-size-tiny) .lf-dock-btn[data-action="next"] {
              display: none !important;
            }
          }

          @media (max-width: 480px) {
            #lf-yt-horizontal-dock {
              height: 26px !important;
              padding: 0 2px !important;
              gap: 1px !important;
              margin-right: 2px !important;
            }
            #lf-yt-horizontal-dock .lf-dock-btn {
              width: 22px !important;
              height: 22px !important;
              font-size: 11px !important;
            }
            #lf-yt-horizontal-dock .lf-dock-btn[data-action="settings"] {
              font-size: 12px !important;
            }
            #lf-yt-horizontal-dock .lf-dock-toggle {
              height: 22px !important;
              padding: 0 2px !important;
              gap: 0 !important;
            }
            #lf-yt-horizontal-dock .lf-toggle-text {
              display: none !important;
            }
            #lf-yt-horizontal-dock .lf-switch-track {
              width: 18px !important;
              height: 10px !important;
            }
            #lf-yt-horizontal-dock .lf-switch-thumb {
              width: 6px !important;
              height: 6px !important;
            }
            #lf-yt-horizontal-dock .lf-dock-toggle[aria-pressed="true"] .lf-switch-thumb,
            #lf-yt-horizontal-dock .lf-switch-track.active .lf-switch-thumb {
              transform: translateX(8px) !important;
            }
            #lf-yt-horizontal-dock .lf-dock-sep,
            #lf-yt-horizontal-dock .lf-dock-btn[data-action="previous"],
            #lf-yt-horizontal-dock .lf-dock-btn[data-action="next"],
            #lf-yt-horizontal-dock .lf-dock-btn[data-action="loop"],
            #lf-yt-horizontal-dock .lf-dock-btn[data-action="speed"] {
              display: none !important;
            }
          }
          #lf-speed-popover {
            position: fixed;
            z-index: 2147483646;
            width: 250px;
            background: rgba(15, 23, 42, 0.96);
            border: 1px solid rgba(255, 255, 255, 0.16);
            border-radius: 14px;
            padding: 12px;
            box-shadow: 0 12px 36px rgba(0, 0, 0, 0.55);
            backdrop-filter: blur(14px) saturate(150%);
            font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            color: #f8fafc;
            box-sizing: border-box;
            pointer-events: auto;
            animation: lfFadeInUp 0.18s ease-out;
          }
          #lf-speed-popover .lf-speed-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin-bottom: 10px;
          }
          #lf-speed-popover .lf-speed-title {
            font-size: 13px;
            font-weight: 700;
            color: #f8fafc;
          }
          #lf-speed-popover .lf-speed-val {
            font-size: 13px;
            font-weight: 800;
            color: #38bdf8;
            background: rgba(56, 189, 248, 0.15);
            padding: 2px 7px;
            border-radius: 6px;
          }
          #lf-speed-popover .lf-speed-presets {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 6px;
            margin-bottom: 12px;
          }
          #lf-speed-popover .lf-speed-chip {
            appearance: none;
            background: rgba(255, 255, 255, 0.07);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 8px;
            padding: 6px 4px;
            color: #e2e8f0;
            font: 700 12px/1.2 system-ui, sans-serif;
            cursor: pointer;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 2px;
            transition: all 0.15s ease;
          }
          #lf-speed-popover .lf-speed-chip:hover {
            background: rgba(56, 189, 248, 0.18);
            border-color: rgba(56, 189, 248, 0.4);
            color: #7dd3fc;
          }
          #lf-speed-popover .lf-speed-chip.is-selected {
            background: rgba(56, 189, 248, 0.28);
            border-color: #38bdf8;
            color: #38bdf8;
            box-shadow: 0 0 8px rgba(56, 189, 248, 0.4);
          }
          #lf-speed-popover .lf-speed-chip-desc {
            font-size: 9px;
            font-weight: 500;
            opacity: 0.8;
          }
          #lf-speed-popover .lf-speed-slider-wrap {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
            background: rgba(0, 0, 0, 0.25);
            padding: 6px 8px;
            border-radius: 8px;
          }
          #lf-speed-popover .lf-speed-step-btn {
            width: 24px;
            height: 24px;
            border-radius: 50%;
            border: 1px solid rgba(255, 255, 255, 0.2);
            background: rgba(255, 255, 255, 0.08);
            color: #f8fafc;
            font: 700 14px/1 system-ui;
            cursor: pointer;
            display: grid;
            place-items: center;
            padding: 0;
            transition: all 0.15s;
          }
          #lf-speed-popover .lf-speed-step-btn:hover {
            background: rgba(56, 189, 248, 0.25);
            color: #38bdf8;
            border-color: #38bdf8;
          }
          #lf-speed-popover #lf-speed-range {
            flex: 1;
            height: 6px;
            border-radius: 999px;
            accent-color: #38bdf8;
            cursor: pointer;
          }
          #lf-speed-popover .lf-speed-hint {
            font-size: 10px;
            color: #94a3b8;
            text-align: center;
            line-height: 1.3;
          }
          @keyframes lfFadeInUp {
            from { opacity: 0; transform: translateY(6px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `;
