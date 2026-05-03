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
    }
};
