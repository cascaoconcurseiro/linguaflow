// epub.js — Leitor de EPUB no navegador (Onda 3.1). Um .epub é um .zip com
// XHTML dentro; usamos fflate (CDN, ~8KB, só descompacta) e o DOMParser
// nativo do browser pra ler a estrutura (container.xml → OPF → spine).

let fflatePromise = null;
function ensureFflate() {
  if (fflatePromise) return fflatePromise;
  fflatePromise = new Promise((resolve, reject) => {
    if (window.fflate) { resolve(window.fflate); return; }
    const tag = document.createElement('script');
    tag.src = 'https://cdn.jsdelivr.net/npm/fflate@0.8.2/umd/index.js';
    tag.onload = () => resolve(window.fflate);
    tag.onerror = () => reject(new Error('Não foi possível carregar o leitor de EPUB (sem conexão?).'));
    document.head.appendChild(tag);
  });
  return fflatePromise;
}

function stripXhtml(xhtml) {
  return xhtml
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<\/(p|div|br|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n\n')
    .trim();
}

// Resolve um caminho relativo (href do manifest) contra o diretório do OPF.
function resolvePath(base, href) {
  const clean = decodeURIComponent(href.split('#')[0]);
  if (!base) return clean;
  const parts = (base + clean).split('/');
  const out = [];
  for (const p of parts) {
    if (p === '..') out.pop();
    else if (p !== '.' && p !== '') out.push(p);
  }
  return out.join('/');
}

export async function parseEpub(arrayBuffer) {
  const fflate = await ensureFflate();
  const bytes = new Uint8Array(arrayBuffer);
  let files;
  try {
    files = fflate.unzipSync(bytes);
  } catch {
    throw new Error('Arquivo EPUB corrompido ou inválido.');
  }

  const decoder = new TextDecoder('utf-8');
  const readText = (path) => {
    const data = files[path];
    return data ? decoder.decode(data) : null;
  };

  const containerXml = readText('META-INF/container.xml');
  if (!containerXml) throw new Error('EPUB inválido: falta META-INF/container.xml.');
  const parser = new DOMParser();
  const containerDoc = parser.parseFromString(containerXml, 'application/xml');
  const opfPath = containerDoc.getElementsByTagName('rootfile')[0]?.getAttribute('full-path');
  if (!opfPath) throw new Error('EPUB inválido: não achei o arquivo OPF.');

  const opfXml = readText(opfPath);
  if (!opfXml) throw new Error('EPUB inválido: OPF referenciado não existe no arquivo.');
  const opfDoc = parser.parseFromString(opfXml, 'application/xml');
  const opfDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';

  const title = (opfDoc.getElementsByTagName('dc:title')[0]?.textContent
    || opfDoc.getElementsByTagName('title')[0]?.textContent
    || 'Livro importado').trim().slice(0, 200);

  const manifest = {};
  Array.from(opfDoc.getElementsByTagName('item')).forEach(item => {
    const id = item.getAttribute('id');
    const href = item.getAttribute('href');
    if (id && href) manifest[id] = href;
  });

  const spineIds = Array.from(opfDoc.getElementsByTagName('itemref'))
    .map(el => el.getAttribute('idref'))
    .filter(Boolean);

  const parts = [];
  for (const id of spineIds) {
    const href = manifest[id];
    if (!href) continue;
    const fullPath = resolvePath(opfDir, href);
    const xhtml = readText(fullPath);
    if (!xhtml) continue;
    const text = stripXhtml(xhtml);
    if (text) parts.push(text);
  }

  const content = parts.join('\n\n').slice(0, 400000); // teto de segurança p/ livros gigantes
  if (!content) throw new Error('Não consegui extrair texto legível desse EPUB (pode ter DRM).');
  return { title, content };
}
