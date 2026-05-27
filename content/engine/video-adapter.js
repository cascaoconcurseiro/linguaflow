export class VideoAdapter {
    constructor() {
        this.platform = this.detectPlatform();
        this.videoElement = null;
    }

    detectPlatform() {
        const h = window.location.hostname;
        if (h.includes('youtube.com')) return 'youtube';
        if (h.includes('netflix.com')) return 'netflix';
        if (h.includes('hbomax.com') || h.includes('max.com') || h.includes('hbo.com')) return 'max';
        if (h.includes('disneyplus.com')) return 'disney';
        if (h.includes('primevideo.com') || h.includes('amazon.com')) return 'prime';
        return 'generic';
    }

    findPlayerContainer() {
        const selectors = [
            '#movie_player', '.html5-video-player', 
            '.watch-video', '.NFPlayer', 
            '[data-testid="player-container"]', '[data-testid="video-player"]', 
            '[class*="PlayerContainer"]', '[class*="VideoPlayer"]',
            '.btm-media-clients', '.rendererContainer', '.webPlayerContainer'
        ];
        
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el && el.offsetHeight > 100) {
                const style = window.getComputedStyle(el);
                if (style.position === 'static') el.style.position = 'relative';
                return el;
            }
        }
        
        const video = document.querySelector('video');
        if (video) {
            let parent = video.parentElement;
            for (let i = 0; i < 8 && parent; i++) {
                const rect = parent.getBoundingClientRect();
                if (rect.width > 400 && rect.height > 300) {
                    if (window.getComputedStyle(parent).position === 'static') parent.style.position = 'relative';
                    return parent;
                }
                parent = parent.parentElement;
            }
        }
        return document.body;
    }

    hideHBONativeSubtitles() {
        if (this.platform !== 'max') return;
        let s = document.getElementById('lf-native-hide');
        if (!s) {
            s = document.createElement('style');
            s.id = 'lf-native-hide';
            document.head.appendChild(s);
        }
        s.textContent = '[data-testid="caption_renderer_overlay"],[class*="SubtitleText"],[class*="subtitle-text"],.track-text-container{opacity:0!important;pointer-events:none!important;}';
        console.debug('[LinguaFlow VideoAdapter] HBO Max: legenda nativa escondida via CSS');
    }
}
