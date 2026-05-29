/**
 * LinguaFlow Video Utilities
 * Shared logic for timestamp generation and time formatting
 */

export const videoUtils = {
    /**
     * Generates a URL with the current timestamp for the video
     * @returns {string} The URL with ?t= parameter
     */
    getVideoUrlWithTimestamp() {
        const video = document.querySelector('video') || document.getElementsByTagName('video')[0];
        if (!video) return window.location.href;
        
        const time = Math.floor(video.currentTime);
        let urlStr = window.location.href;
        
        // Handle YouTube Shorts (convert to watch?v=)
        if (urlStr.includes('/shorts/')) {
            urlStr = urlStr.replace('/shorts/', '/watch?v=');
        }
        
        const url = new URL(urlStr);
        
        if (url.hostname.includes('youtube.com')) {
            url.searchParams.set('t', time + 's');
        } else if (url.hostname.includes('netflix.com')) {
            url.searchParams.set('t', time);
        } else {
            url.searchParams.set('t', time);
            url.searchParams.set('time', time);
        }
        
        return url.toString();
    },

    /**
     * Formats seconds into MM:SS
     * @param {number} seconds 
     * @returns {string}
     */
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    },

    /**
     * Captures a screenshot of the video (Works on YouTube, might fail on Netflix DRM)
     * @returns {string|null} base64 image or null
     */
    captureSnapshot() {
        const video = document.querySelector('video');
        if (!video) return null;
        try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth || 1280;
            canvas.height = video.videoHeight || 720;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            return canvas.toDataURL('image/jpeg', 0.7);
        } catch (e) {
            console.warn('[LinguaFlow] DRM blocks screenshot:', e);
            return null;
        }
    },

    /**
     * Captures audio of the last few seconds (using MediaRecorder if stream exists)
     */
    async captureAudio() {
        // Devido à segurança cross-origin e DRM, capturar áudio in-browser 
        // de <video> usando captureStream() frequentemente falha. 
        // Retornamos null para o MVP seguro. 
        return null; 
    }
};
