// content/subtitles/subtitle-shadow-template.js — HTML e CSS da legenda dentro do Shadow DOM (original, tradução, marcas de expressão e aviso), montados a partir do CSS de shadowing e do CSS das marcas.

export function subtitleShadowHtml({ shadowCss, expressionCss }) {
  return `
            <style>
                :host { all: initial; pointer-events: auto; }
                .lf-notice {
                    margin: 0;
                    padding: 6px 12px;
                    border-radius: 6px;
                    background: rgba(8, 8, 8, 0.72);
                    color: #E5E7EB;
                    font: 600 14px/1.4 'Inter', Arial, sans-serif;
                    animation: lfNoticeIn 180ms ease-out;
                }
                .lf-notice[hidden] { display: none; }
                @keyframes lfNoticeIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @media (prefers-reduced-motion: reduce) {
                    .lf-notice { animation: none; }
                }
                .lf-wrap {
                    display: inline-flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 4px;
                    pointer-events: auto;
                }
                ${shadowCss}
                .lf-orig-row {
                    position: relative;
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                }
                .lf-orig {
                    font-family: 'Inter', Arial, sans-serif;
                    font-weight: 800;
                    font-size: calc(var(--lf-font-size, 31px) * var(--lf-sub-scale, 1));
                    color: #FFF;
                    text-shadow: 0 2px 12px rgba(0,0,0,0.95), 0 0 6px rgba(0,0,0,0.8);
                    line-height: 1.25;
                    letter-spacing: 0.4px;
                }
                .lf-trans {
                    font-family: 'Inter', Arial, sans-serif;
                    font-weight: 600;
                    font-size: calc(var(--lf-font-size-trans, 18px) * var(--lf-sub-scale, 1));
                    color: #38BDF8;
                    background: rgba(10,15,30, var(--lf-bg-opacity, 0.78));
                    backdrop-filter: blur(10px);
                    padding: 5px 18px;
                    border-radius: 12px;
                    border: 1px solid rgba(56,189,248,0.2);
                    transition: filter 0.25s, opacity 0.25s;
                    text-shadow: 0 1px 6px rgba(0,0,0,0.8);
                }
                /* Modo Blur Premium (Frosted Glass) */
                .mode-blur .lf-trans {
                    filter: blur(12px) saturate(1.8);
                    opacity: 0.35;
                    cursor: pointer;
                    background: rgba(255, 255, 255, 0.05);
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .mode-blur .lf-trans:hover {
                    filter: blur(0px) saturate(1);
                    opacity: 1;
                    background: rgba(10, 15, 30, var(--lf-bg-opacity, 0.78));
                }
                /* Palavras clicáveis */
                .lf-word {
                    cursor: pointer;
                    display: inline-block;
                    transition: transform 0.12s, color 0.12s;
                    border-radius: 3px;
                    font-family: var(--lf-font-family, 'Inter'), sans-serif;
                }
                .lf-word:hover {
                    transform: scale(1.18) translateY(-2px);
                    color: #FBBF24 !important;
                }
                .lf-word:focus-visible {
                    outline: 2px solid #FBBF24;
                    outline-offset: 3px;
                    color: #FBBF24 !important;
                }
                .lf-known    { color: var(--lf-color-known, #86EFAC); }  /* verde claro — já sei */
                .lf-mature   { color: #34D399; text-decoration: underline dotted; text-underline-offset: 3px; } /* verde — dominada */
                .lf-review   { color: #38BDF8; text-decoration: underline dashed; text-underline-offset: 3px; } /* azul — revisando */
                .lf-learning { color: #FBBF24; text-decoration: underline dashed; text-underline-offset: 3px; } /* amarelo — aprendendo */
                .lf-saved    { color: var(--lf-color-saved, #93C5FD); text-decoration: underline dashed; text-underline-offset: 4px; } /* azul claro — nova */
                .lf-cefr-A1 { text-decoration: underline solid var(--cefr-a1, #60a5fa) !important; text-underline-offset: 4px; text-decoration-thickness: 3px; color: inherit !important; }
                .lf-cefr-A2 { text-decoration: underline solid var(--cefr-a2, #4ade80) !important; text-underline-offset: 4px; text-decoration-thickness: 3px; color: inherit !important; }
                .lf-cefr-B1 { text-decoration: underline solid var(--cefr-b1, #facc15) !important; text-underline-offset: 4px; text-decoration-thickness: 3px; color: inherit !important; }
                .lf-cefr-B2 { text-decoration: underline solid var(--cefr-b2, #fb923c) !important; text-underline-offset: 4px; text-decoration-thickness: 3px; color: inherit !important; }
                .lf-cefr-C1 { text-decoration: underline solid var(--cefr-c1, #f87171) !important; text-underline-offset: 4px; text-decoration-thickness: 3px; color: inherit !important; }
                .lf-cefr-C2 { text-decoration: underline solid var(--cefr-c2, #c084fc) !important; text-underline-offset: 4px; text-decoration-thickness: 3px; color: inherit !important; }
                .lf-expression {
                    border-bottom: 2px dotted rgba(56, 189, 248, 0.6);
                    padding-bottom: 1px;
                    border-radius: 4px;
                }
                ${expressionCss}
                .lf-new      { color: #FFF; } /* branco — nunca vista */

                /* Botão de tradução rápida */
                .lf-translate-btn {
                    background: rgba(56,189,248,0.15);
                    border: 1px solid rgba(56,189,248,0.4);
                    color: #38BDF8;
                    padding: 3px 10px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    font-family: 'Inter', Arial, sans-serif;
                    cursor: pointer;
                    transition: all 0.2s;
                    backdrop-filter: blur(8px);
                    pointer-events: auto;
                    display: inline-block;
                    white-space: nowrap;
                    position: absolute;
                    left: calc(100% + 12px);
                    top: 50%;
                    transform: translateY(-50%);
                }
                .lf-translate-btn:hover {
                    background: rgba(56,189,248,0.3);
                    transform: translateY(-50%) scale(1.05);
                }


                .lf-blur {
                    filter: blur(5px);
                    opacity: 0.8;
                    transition: filter 0.3s ease, opacity 0.3s ease;
                }

                .lf-blur:hover {
                    filter: blur(0px);
                    opacity: 1;
                }

                /* Tradução temporária (flash) */
                .lf-trans-flash {
                    animation: flashIn 0.3s ease-out;
                }
                @keyframes flashIn {
                    from { opacity: 0; transform: translateY(4px); }
                    to   { opacity: 1; transform: translateY(0); }
                }

                /* Tooltip de hover */
                .lf-hover-tooltip {
                    position: fixed;
                    background: rgba(16, 185, 129, 0.95);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    font-family: 'Inter', sans-serif;
                    z-index: 999999;
                    pointer-events: none;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                    white-space: nowrap;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: translateX(-50%) translateY(-5px); }
                    to { opacity: 1; transform: translateX(-50%) translateY(0); }
                }

                @keyframes fadeOut {
                    from { opacity: 1; transform: translateX(-50%) translateY(0); }
                    to { opacity: 0; transform: translateX(-50%) translateY(-5px); }
                }
            </style>
            <div class="lf-wrap" id="lf-wrap" data-subtitle-mode="native">
                <div class="lf-shadow-prev" id="lf-shadow-prev" aria-hidden="true"></div>
                <div class="lf-orig-row">
                    <div class="lf-orig" id="lf-orig"></div>
                    <button class="lf-translate-btn" id="lf-translate-btn" type="button" style="display:none;" title="Traduzir frase" aria-label="Traduzir frase">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m5 8 6 6"></path><path d="m4 14 6-6 2-3"></path><path d="M2 5h12"></path><path d="M7 2h1"></path><path d="m22 22-5-10-5 10"></path><path d="M14 18h6"></path></svg>
                    </button>
                </div>
                <div class="lf-shadow-progress" aria-hidden="true"><div class="lf-shadow-bar" id="lf-shadow-bar"></div></div>
                <div class="lf-shadow-next" id="lf-shadow-next" aria-hidden="true"></div>
                <div class="lf-trans" id="lf-trans" style="display:none;">
                    <span id="lf-trans-txt"></span>
                </div>
            </div>
            <p class="lf-notice" id="lf-notice" role="status" aria-live="polite" hidden></p>
        `;
}
