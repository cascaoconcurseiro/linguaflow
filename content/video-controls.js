// content/video-controls.js
import { db } from '../utils/db.js';

/**
 * LinguaFlow - Video Controls & Shortcuts (A, S, D, Q, R, Space)
 */
export class VideoControls {
    constructor(engine) {
        this.engine = engine;
        this.video = null;
        this.autoPause = false;
        
        const check = setInterval(async () => {
            this.video = document.querySelector('video');
            if (this.video) {
                clearInterval(check);
                this.autoPause = await db.getSetting('autoPause') || false;
                this.attachShortcuts();
                this.startAutoPauseChecker();
                
                window.addEventListener('LF_UPDATE_AUTOPAUSE', (e) => {
                    this.autoPause = e.detail;
                });
                
                console.log("LinguaFlow: Hotkeys Ativadas (A, S, D, Q, R)");
            }
        }, 1000);
    }

    attachShortcuts() {
        document.addEventListener('keydown', async (e) => {
            if (['INPUT', 'TEXTAREA'].includes(e.target.tagName)) return;
            
            const timeMs = this.video.currentTime * 1000;
            const currentIdx = this.engine.currentCueIndex;
            const cues = this.engine.cues;

            switch(e.key.toLowerCase()) {
                case 'a': // Anterior
                    if (currentIdx > 0) {
                        this.video.currentTime = (cues[currentIdx - 1].start / 1000) + 0.01;
                    }
                    break;
                    
                case 's': // Repetir atual
                    if (currentIdx >= 0) {
                        this.video.currentTime = (cues[currentIdx].start / 1000) + 0.01;
                        this.video.play();
                    }
                    break;
                    
                case 'd': // Seguinte
                    const nextCue = cues.find(c => c.start > timeMs);
                    if (nextCue) {
                        this.video.currentTime = (nextCue.start / 1000) + 0.01;
                    }
                    break;
                    
                case 'q': // Toggle Auto-Pausa
                    this.autoPause = !this.autoPause;
                    db.setSetting('autoPause', this.autoPause);
                    this.showToast(`Auto-Pausa ${this.autoPause ? 'LIGADA' : 'DESLIGADA'}`);
                    // Atualiza no panel caso esteja aberto
                    const pnl = document.getElementById('linguaflow-settings-host');
                    if (pnl && pnl.shadowRoot.getElementById('sel-autopause')) {
                        pnl.shadowRoot.getElementById('sel-autopause').value = this.autoPause ? 'on' : 'off';
                    }
                    break;
                    
                case 'r': // Salvar Legenda Atual Inteira
                    if (currentIdx >= 0 && cues[currentIdx]) {
                        const cue = cues[currentIdx];
                        await db.saveWord({
                            word: "[Frase Inteira]",
                            lang: 'en',
                            translation: cue.translatedText || "Sem tradução",
                            context_sentence: cue.text,
                            deck_id: 1
                        });
                        this.showToast("Frase Salva no Dashboard! ✓");
                    }
                    break;

                case ' ': // Espaço Play/Pause
                    e.preventDefault();
                    if (this.video.paused) this.video.play();
                    else this.video.pause();
                    break;
            }
        });
    }

    startAutoPauseChecker() {
        let lastCueId = -1;
        setInterval(() => {
            if (this.autoPause && this.engine.currentCueIndex !== -1) {
                if (lastCueId !== this.engine.currentCueIndex) {
                    lastCueId = this.engine.currentCueIndex;
                }
            } else if (this.autoPause && this.engine.currentCueIndex === -1 && lastCueId !== -1) {
                // Legenda acabou, pausa o video!
                this.video.pause();
                lastCueId = -1; // Reset
            }
        }, 100);
    }

    showToast(msg) {
        let t = document.getElementById('lf-toast');
        if (!t) {
            t = document.createElement('div');
            t.id = 'lf-toast';
            t.style = "position:fixed; top:20px; left:50%; transform:translateX(-50%); background:rgba(15,23,42,0.9); color:#38BDF8; font-weight:bold; font-family:sans-serif; padding:12px 24px; border-radius:8px; z-index:999999; border:1px solid rgba(56,189,248,0.3); pointer-events:none;";
            document.body.appendChild(t);
        }
        t.textContent = msg;
        t.style.display = 'block';
        setTimeout(() => t.style.display = 'none', 2000);
    }
}
