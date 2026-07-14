export const OFFICIAL_SITE_URL = 'https://linguaflow-web-tau.vercel.app/';

const EXACT_HOSTS = new Set([
  'linguaflow-web-tau.vercel.app',
  'linguaflow.vercel.app',
]);

export function isLinguaFlowHost(hostname = '') {
  const host = String(hostname).trim().toLowerCase().replace(/\.$/, '');
  if (EXACT_HOSTS.has(host)) return true;

  // Vercel cria aliases de preview como
  // linguaflow-<hash>-<team>.vercel.app. Desativar o Reader nesses aliases
  // evita que a extensão interfira justamente durante a validação do app.
  return host.startsWith('linguaflow-') && host.endsWith('.vercel.app');
}

export function isLinguaFlowUrl(value) {
  try {
    return isLinguaFlowHost(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function isLinguaFlowPage(locationLike, documentLike) {
  if (isLinguaFlowHost(locationLike?.hostname)) return true;

  // Protege desenvolvimento local e futuros domínios customizados sem
  // bloquear genericamente localhost ou todos os projetos da Vercel.
  const title = String(documentLike?.title || '').trim().toLowerCase();
  return title.startsWith('linguaflow')
    && !!documentLike?.querySelector?.('#app-root')
    && !!documentLike?.querySelector?.('script[src*="js/core/app.js"]');
}
