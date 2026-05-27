export class SubtitleFetcher {
    constructor(engineContext) {
        this.ctx = engineContext;
    }

    parseVTT(vttStr) {
        const cues = [];
        const blocks = vttStr.split(/\n\s*\n/);
        blocks.forEach(b => {
            const lines = b.trim().split('\n');
            let timeLine = lines.find(l => l.includes('-->'));
            if (!timeLine) return;
            const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
            const parseTime = t => {
                const timePart = t.split(/\s+/)[0].replace(',', '.');
                const p = timePart.split(':');
                let sec = parseFloat(p.pop() || 0);
                if(p.length) sec += parseInt(p.pop() || 0) * 60;
                if(p.length) sec += parseInt(p.pop() || 0) * 3600;
                return sec;
            };
            const text = lines.slice(lines.indexOf(timeLine) + 1).map(l => l.replace(/<[^>]+>/g, '').trim()).join(' ').trim();
            if(text) cues.push({ start: parseTime(startStr), end: parseTime(endStr), text });
        });
        return cues;
    }

    async fetchYoutubeSubtitles() {
        if (this.ctx.cues.length > 0) return;
        
        try {
            const { lastYoutubeSubtitleUrls } = await chrome.storage.local.get('lastYoutubeSubtitleUrls');
            const urls = lastYoutubeSubtitleUrls ?? [];
            const videoId = new URL(window.location.href).searchParams.get('v');
            if (!videoId) return;

            const matchingUrls = urls.filter(r => {
                try { return new URL(r).searchParams.get('v') === videoId; }
                catch { return false; }
            }).reverse();

            if (matchingUrls.length === 0) return;

            for (const url of matchingUrls) {
                const response = await fetch(new URL(url).toString());
                if (!response.ok) continue;
                
                const text = await response.text();
                let data = null;
                
                if (text.startsWith('{')) {
                    try { data = JSON.parse(text); } catch {}
                }
                
                if (data && data.events) {
                    const cues = this.processYtSub(data);
                    if (cues && cues.length > 0) {
                        this.ctx.cues = cues;
                        this.ctx.xhrCues = cues;
                        this.ctx.usingXhr = true;
                        if(this.ctx._renderVideoWordPrep) this.ctx._renderVideoWordPrep();
                        return;
                    }
                }
            }
        } catch (e) {
            console.error('[LinguaFlow] Erro ao recuperar legendas:', e);
        }
    }

    processYtSub(data) {
        // Lógica simplificada baseada no _processYtSub original (mantendo a segurança)
        const raw = this._processEvents(data);
        for (let e = 0; e < raw.length - 1; e++) {
            if (raw[e].end > raw[e + 1].start) raw[e].end = raw[e + 1].start;
        }
        return raw.map(e => {
            const a = Number(e.start.toFixed(2));
            const m = Number(e.end.toFixed(2));
            return {
                start: a,
                end: m,
                text: this._cleanSubtitleText(e.text),
            };
        }).filter(e => e != null);
    }

    _processEvents(s) {
        if (!s?.events?.length) return [];
        const m = [];
        s.events.forEach(evt => {
            if (!evt.segs || evt.segs.length === 0) return;
            const startMs = evt.tStartMs ?? 0;
            const durationMs = evt.dDurationMs ?? 0;
            let text = '';
            evt.segs.forEach(seg => { text += (seg.utf8 || ''); });
            text = text.replace(/\n/g, ' ').trim();
            if (!text) return;
            const cleanText = text.replace(/\[.*?\]/g, '').trim();
            if (!cleanText) return;
            m.push({ text: cleanText, start: startMs / 1000, end: (startMs + durationMs) / 1000 });
        });
        m.sort((a, b) => a.start - b.start);
        return m;
    }

    _cleanSubtitleText(text) {
        if (!text) return '';
        return text.replace(/\[.*?\]/g, '').replace(/\(.*?\)/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
    }
}
