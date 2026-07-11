// Contexto de vídeo salvo pela extensão. Só YouTube recebe embed: demais
// plataformas podem bloquear iframes (DRM) e devem abrir no ponto salvo.

function escapeHtml(value = '') {
  return String(value).replace(/[&<>'"]/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
  }[char]));
}

function parseSeconds(value) {
  if (!value) return 0;
  if (/^\d+$/.test(value)) return Number(value);
  const match = String(value).match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/i);
  if (!match) return 0;
  return Number(match[1] || 0) * 3600 + Number(match[2] || 0) * 60 + Number(match[3] || 0);
}

export function getVideoContext(videoUrl) {
  if (typeof videoUrl !== 'string' || videoUrl.length > 2048) return null;
  let url;
  try {
    url = new URL(videoUrl);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;

  const host = url.hostname.toLowerCase().replace(/^www\./, '');
  let videoId = null;
  if (host === 'youtu.be') videoId = url.pathname.split('/').filter(Boolean)[0];
  if (host === 'youtube.com' || host === 'm.youtube.com') {
    videoId = url.searchParams.get('v')
      || url.pathname.match(/^\/(?:shorts|embed)\/([A-Za-z0-9_-]{11})/)?.[1];
  }
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return { externalUrl: url.toString(), embedUrl: null };
  }

  const hashTime = new URLSearchParams(url.hash.replace(/^#/, '')).get('t');
  const seconds = Math.min(parseSeconds(url.searchParams.get('t') || url.searchParams.get('start') || hashTime), 86400);
  const embedUrl = new URL(`https://www.youtube-nocookie.com/embed/${videoId}`);
  embedUrl.searchParams.set('start', String(seconds));
  embedUrl.searchParams.set('rel', '0');
  return { externalUrl: url.toString(), embedUrl: embedUrl.toString(), videoId, start: seconds };
}

export function renderVideoContext(wordData = {}, id) {
  const context = getVideoContext(wordData.video_url);
  if (!context) return '';
  const title = escapeHtml(wordData.video_title || 'vídeo de origem');
  const platform = escapeHtml(wordData.platform || 'vídeo');
  const safeExternal = escapeHtml(context.externalUrl);
  const safeEmbed = context.embedUrl ? escapeHtml(context.embedUrl) : '';
  return `
    <section class="video-context" aria-label="Contexto do vídeo">
      <span class="video-context-label">🎬 Salvo de ${platform}</span>
      <span class="video-context-title" title="${title}">${title}</span>
      <div class="video-context-actions">
        ${safeEmbed ? `<button type="button" class="video-context-embed" data-video-embed="${safeEmbed}" aria-expanded="false" aria-controls="${id}">Ver aqui</button>` : ''}
        <a href="${safeExternal}" target="_blank" rel="noopener noreferrer">Rever no ponto salvo ↗</a>
      </div>
      ${safeEmbed ? `<div class="video-context-frame" id="${id}" hidden></div>` : ''}
    </section>`;
}

export function attachVideoContext(container) {
  container.querySelectorAll('.video-context-embed').forEach(button => {
    button.addEventListener('click', () => {
      const frame = container.querySelector(`#${button.getAttribute('aria-controls')}`);
      if (!frame) return;
      const open = button.getAttribute('aria-expanded') === 'true';
      if (open) {
        frame.hidden = true;
        frame.replaceChildren();
        button.setAttribute('aria-expanded', 'false');
        button.textContent = 'Ver aqui';
        return;
      }
      const iframe = document.createElement('iframe');
      iframe.src = button.dataset.videoEmbed;
      iframe.title = 'Vídeo original no ponto salvo';
      iframe.loading = 'lazy';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.allowFullscreen = true;
      frame.replaceChildren(iframe);
      frame.hidden = false;
      button.setAttribute('aria-expanded', 'true');
      button.textContent = 'Fechar vídeo';
    });
  });
}
