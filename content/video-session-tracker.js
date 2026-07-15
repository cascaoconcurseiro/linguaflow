// Awards a video-learning event only after real, foreground playback.
// The background worker owns the final throttle and database call.
const QUALIFYING_SECONDS = 5 * 60;
const MAX_PROGRESS_GAP_SECONDS = 2.5;

export class VideoSessionTracker {
  constructor() {
    this.watchedSeconds = 0;
    this.lastTime = null;
    this.video = null;
    this.onTimeUpdate = this.onTimeUpdate.bind(this);
    this.onVideoChange = this.onVideoChange.bind(this);
  }

  start() {
    this.onVideoChange();
    const observer = new MutationObserver(() => this.onVideoChange());
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  onVideoChange() {
    const nextVideo = document.querySelector('video');
    if (nextVideo === this.video) return;
    if (this.video) this.video.removeEventListener('timeupdate', this.onTimeUpdate);
    this.video = nextVideo;
    this.lastTime = null;
    if (this.video) this.video.addEventListener('timeupdate', this.onTimeUpdate);
  }

  onTimeUpdate() {
    if (!this.video || document.visibilityState !== 'visible' || this.video.paused || this.video.ended) {
      this.lastTime = null;
      return;
    }

    const currentTime = this.video.currentTime;
    if (Number.isFinite(this.lastTime)) {
      const progress = currentTime - this.lastTime;
      // Count normal forward playback only: no seeking, replay loops, or rate spikes.
      if (progress > 0 && progress <= MAX_PROGRESS_GAP_SECONDS) {
        this.watchedSeconds += progress;
        if (this.watchedSeconds >= QUALIFYING_SECONDS) this.claimSession();
      }
    }
    this.lastTime = currentTime;
  }

  claimSession() {
    // Reset before sending so a delayed/background response cannot emit duplicates.
    this.watchedSeconds = 0;
    chrome.runtime.sendMessage(
      { type: 'LF_VIDEO_SESSION_COMPLETED', watchedSeconds: QUALIFYING_SECONDS },
      () => void chrome.runtime.lastError,
    );
  }
}
