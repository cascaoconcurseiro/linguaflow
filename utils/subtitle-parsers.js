// utils/subtitle-parsers.js

/**
 * LinguaFlow - Subtitle Parsers (Módulo 5)
 * Converte os formatos caóticos da web para um JSON limpo e padronizado:
 * { start: Number, end: Number, text: String }
 */

export class SubtitleParsers {
    
    /**
     * Converte strings de tempo diversas para segundos decimais.
     */
    timeToSeconds(timeStr) {
        if (!timeStr) return 0;
        
        // Normaliza as vírgulas do formato europeu/SRT
        const parts = timeStr.replace(',', '.').split(':');
        let sec = 0;
        
        if (parts.length === 3) {
            sec = (parseFloat(parts[0]) * 3600) + (parseFloat(parts[1]) * 60) + parseFloat(parts[2]);
        } else if (parts.length === 2) {
            sec = (parseFloat(parts[0]) * 60) + parseFloat(parts[1]);
        } else {
            sec = parseFloat(parts[0]);
        }
        
        return Number(sec.toFixed(3));
    }

    parseSRT(text) {
        const cues = [];
        const blocks = text.trim().split(/\r?\n\r?\n/);
        
        for (const block of blocks) {
            const lines = block.split(/\r?\n/);
            if (lines.length >= 3) {
                const timeLine = lines[1];
                const match = timeLine.match(/(\d{2}:\d{2}:\d{2},\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2},\d{3})/);
                if (match) {
                    const start = this.timeToSeconds(match[1]);
                    const end = this.timeToSeconds(match[2]);
                    const textContent = lines.slice(2).join(' ').replace(/<[^>]+>/g, '').trim();
                    cues.push({ start, end, text: textContent });
                }
            }
        }
        return cues;
    }

    parseVTT(text) {
        const cues = [];
        const blocks = text.trim().split(/\r?\n\r?\n/);
        
        for (const block of blocks) {
            if (block.startsWith('WEBVTT')) continue;
            
            const lines = block.split(/\r?\n/);
            let timeLineIdx = lines.findIndex(l => l.includes('-->'));
            
            if (timeLineIdx !== -1) {
                const match = lines[timeLineIdx].match(/([\d:.]+)\s*-->\s*([\d:.]+)/);
                if (match) {
                    const start = this.timeToSeconds(match[1]);
                    const end = this.timeToSeconds(match[2]);
                    // Limpa tags de estilo do VTT (<c>, <b>) preservando o texto
                    const textContent = lines.slice(timeLineIdx + 1).join(' ').replace(/<[^>]+>/g, '').trim();
                    cues.push({ start, end, text: textContent });
                }
            }
        }
        return cues;
    }

    parseTTML(xmlStr) {
        const cues = [];
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlStr, "text/xml");
            const pTags = xmlDoc.getElementsByTagName('p');
            
            for (let i = 0; i < pTags.length; i++) {
                const p = pTags[i];
                let startStr = p.getAttribute('begin');
                let endStr = p.getAttribute('end');
                
                // YouTube srv3 format interno usa 't' (ms iniciais) e 'd' (duração ms)
                if (!startStr && p.getAttribute('t')) {
                    const t = parseInt(p.getAttribute('t'), 10);
                    const d = parseInt(p.getAttribute('d') || "0", 10);
                    startStr = (t / 1000).toFixed(3);
                    endStr = ((t + d) / 1000).toFixed(3);
                }

                if (startStr && endStr) {
                    const textContent = p.textContent.replace(/[\n\r]+/g, ' ').trim();
                    if (textContent) {
                        cues.push({ 
                            start: this.timeToSeconds(startStr), 
                            end: this.timeToSeconds(endStr), 
                            text: textContent 
                        });
                    }
                }
            }
        } catch(e) {
            console.error("LinguaFlow: Erro de parse no formato TTML", e);
        }
        return cues;
    }
    
    parseYouTubeJSON(jsonObj) {
        const cues = [];
        if (jsonObj.events) {
            jsonObj.events.forEach(event => {
                if (event.segs && event.tStartMs !== undefined) {
                    const start = event.tStartMs / 1000;
                    const duration = (event.dDurationMs || 0) / 1000;
                    // Limpa caracteres invisíveis
                    const text = event.segs.map(seg => seg.utf8).join('').replace(/\n/g, ' ').trim();
                    if (text) {
                        cues.push({ start, end: start + duration, text });
                    }
                }
            });
        }
        return cues;
    }
}

export const subtitleParsers = new SubtitleParsers();
