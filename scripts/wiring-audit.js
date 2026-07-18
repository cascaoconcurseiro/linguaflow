// Auditoria de FIAÇÃO do LinguaFlow — prova mecânica de desconexão.
// Não conclui sobre comportamento (regra 1). Só prova ausência de ligação:
// um símbolo exportado sem importador, um id lido sem criador, um evento
// escutado sem emissor. Foi assim que pronunciationLab, lf-video-words e
// LF_WORD_KNOWN cairam — aqui isso vira varredura, não sorte.
const fs = require('fs');
const path = require('path');

// A auditoria faz parte do fluxo oficial e precisa rodar também no Windows.
// O antigo shell `find` era resolvido como FIND.EXE e abortava antes de ler
// qualquer arquivo. A travessia em Node é determinística e multiplataforma.
const ignoredDirs = new Set(['node_modules', 'tests', '.git']);
const files = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(js|ts|html)$/.test(entry.name)) files.push(full.replace(/^[.]?[\\/]/, '').replaceAll('\\', '/'));
  }
}
walk('.');

const src = {};
files.forEach(f => { src[f] = fs.readFileSync(f, 'utf8'); });
const ALL = Object.entries(src);
const CODE = ALL.filter(([f]) => /\.(js|ts)$/.test(f));

const rx = (s, re) => [...s.matchAll(re)].map(m => m[1]).filter(Boolean);
const uniq = a => [...new Set(a)];

// ── 1. MÓDULOS ÓRFÃOS ────────────────────────────────────────────────────────
// Um arquivo que exporta algo e que ninguém importa = código que não roda.
const exportsOf = {};
const importedPaths = new Set();
const importedSymbols = new Set();

for (const [f, s] of CODE) {
  const ex = [
    ...rx(s, /export\s+(?:async\s+)?function\s+(\w+)/g),
    ...rx(s, /export\s+(?:const|let|var)\s+(\w+)/g),
    ...rx(s, /export\s+class\s+(\w+)/g),
  ];
  const braced = [...s.matchAll(/export\s*\{([^}]+)\}/g)]
    .flatMap(m => m[1].split(',').map(x => x.trim().split(/\s+as\s+/).pop().trim()))
    .filter(x => x && x !== 'default');
  exportsOf[f] = uniq([...ex, ...braced]);

  // caminhos importados (estático, dinâmico, e o padrão chrome.runtime.getURL)
  rx(s, /from\s+['"]([^'"]+)['"]/g).forEach(p => importedPaths.add(p));
  rx(s, /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g).forEach(p => importedPaths.add(p));
  rx(s, /getURL\(\s*['"]([^'"]+)['"]\s*\)/g).forEach(p => importedPaths.add(p));
  // símbolos importados
  [...s.matchAll(/import\s*\{([^}]+)\}\s*from/g)]
    .flatMap(m => m[1].split(',').map(x => x.trim().split(/\s+as\s+/)[0].trim()))
    .forEach(x => x && importedSymbols.add(x));
  rx(s, /const\s*\{([^}]+)\}\s*=\s*await\s+import/g)
    .flatMap(g => g.split(',').map(x => x.trim().split(':')[0].trim()))
    .forEach(x => x && importedSymbols.add(x));
}
// html <script src>
for (const [f, s] of ALL.filter(([f]) => f.endsWith('.html'))) {
  rx(s, /<script[^>]+src=['"]([^'"]+)['"]/g).forEach(p => importedPaths.add(p));
}
// manifest.json entra como "importador" (content_scripts / background)
const mf = fs.existsSync('manifest.json') ? fs.readFileSync('manifest.json', 'utf8') : '';
rx(mf, /"([^"]+\.js)"/g).forEach(p => importedPaths.add(p));

const base = p => p.split('/').pop();
const isImported = f => [...importedPaths].some(p => base(p) === base(f));

const orphanFiles = CODE
  .filter(([f]) => exportsOf[f].length > 0 && !isImported(f))
  .map(([f]) => f);

const orphanSymbols = [];
for (const [f] of CODE) {
  if (!isImported(f)) continue; // já contado acima
  exportsOf[f].forEach(sym => {
    if (!importedSymbols.has(sym)) orphanSymbols.push(`${f} → ${sym}`);
  });
}

// ── 2. DOM MORTO ─────────────────────────────────────────────────────────────
// getElementById('x') onde 'x' nunca é criado = feature sem container.
const idsCreated = new Set();
const idsRead = {};
for (const [f, s] of ALL) {
  rx(s, /id=["']([\w-]+)["']/g).forEach(i => idsCreated.add(i));
  rx(s, /\.id\s*=\s*['"]([\w-]+)['"]/g).forEach(i => idsCreated.add(i));
  rx(s, /createElement\([^)]*\)[^;]*?id\s*=\s*['"]([\w-]+)['"]/g).forEach(i => idsCreated.add(i));
}
for (const [f, s] of CODE) {
  const read = uniq([
    ...rx(s, /getElementById\(\s*['"]([\w-]+)['"]/g),
    ...rx(s, /querySelector(?:All)?\(\s*['"]#([\w-]+)['"]/g),
  ]);
  read.forEach(i => { (idsRead[i] ||= new Set()).add(f); });
}
const deadIds = Object.entries(idsRead)
  .filter(([i]) => !idsCreated.has(i))
  .map(([i, fs_]) => `#${i}  ← lido em ${[...fs_].join(', ')}`);

// ── 3. EVENTOS ÓRFÃOS ────────────────────────────────────────────────────────
// Escutado e nunca emitido (LF_WORD_KNOWN), ou emitido e nunca escutado.
const listened = {}, dispatched = {};
for (const [f, s] of CODE) {
  uniq(rx(s, /addEventListener\(\s*['"](LF_[\w-]+|lf_[\w-]+)['"]/g))
    .forEach(e => { (listened[e] ||= new Set()).add(f); });
  uniq([
    ...rx(s, /CustomEvent\(\s*['"](LF_[\w-]+|lf_[\w-]+)['"]/g),
    ...rx(s, /postMessage\(\s*\{\s*type:\s*['"](LF_[\w-]+)['"]/g),
    ...rx(s, /type:\s*['"](LF_[\w-]+)['"]/g),
  ]).forEach(e => { (dispatched[e] ||= new Set()).add(f); });
}
const neverFired = Object.keys(listened).filter(e => !dispatched[e]);
const neverHeard = Object.keys(dispatched).filter(e => !listened[e]);

// ── 4. SUPERFÍCIE: o que o app diz ao usuário ────────────────────────────────
const shortcuts = [];
for (const [f, s] of CODE) {
  uniq([
    ...rx(s, /case\s+['"](Key\w|Digit\d|Space|Arrow\w+)['"]/g),
    ...rx(s, /e\.key\s*===?\s*['"]([\w ])['"]/g),
    ...rx(s, /e\.code\s*===?\s*['"](Key\w|Digit\d|Space)['"]/g),
  ]).forEach(k => shortcuts.push(`${k.padEnd(8)} ${f}`));
}

const out = (t, arr) => {
  console.log('\n' + '='.repeat(72) + '\n' + t + '  [' + arr.length + ']\n' + '='.repeat(72));
  arr.length ? arr.forEach(x => console.log('  ' + x)) : console.log('  (nenhum)');
};
out('🔴 MÓDULOS ÓRFÃOS — exportam e ninguém importa (classe pronunciationLab)', orphanFiles);
out('🟡 SÍMBOLOS ÓRFÃOS — exportados de arquivo vivo, nunca importados', orphanSymbols);
out('🔴 DOM MORTO — id lido e nunca criado (classe lf-video-words)', deadIds);
out('🔴 EVENTOS ESCUTADOS E NUNCA EMITIDOS (classe LF_WORD_KNOWN)', neverFired);
out('🟡 EVENTOS EMITIDOS E NUNCA ESCUTADOS', neverHeard);
out('⌨️  SUPERFÍCIE DE TECLADO — toda tecla capturada no projeto', shortcuts);
