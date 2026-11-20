// Todo nome importado de um módulo local precisa existir entre as exportações desse módulo.
//
// Um `import { x } from './y.js'` sem `export` correspondente só falha quando o navegador carrega a tela, e nem o
// lint nem os testes de texto percebem. Pegamos isso na refatoração que dividiu studyView, storiesView e o
// service worker; este teste impede que o erro volte, para qualquer arquivo do app.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const DIRS = ['dashboard/js', 'background', 'content', 'popup', 'utils'];

const walk = (dir) => readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((entry) => {
  const rel = path.posix.join(dir, entry.name);
  if (entry.isDirectory()) return walk(rel);
  return rel.endsWith('.js') ? [rel] : [];
});

// Remove comentários para que `// import { x } from ...` ou `export` em texto não contem.
const strip = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

function exportsOf(file) {
  const src = strip(readFileSync(path.join(root, file), 'utf8'));
  const names = new Set();
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function\*?|class|const|let|var)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop();
      if (name) names.add(name);
    }
  }
  const hasDefault = /^export\s+default\b/m.test(src);
  const reexportsAll = [...src.matchAll(/^export\s*\*\s*from\s*['"]([^'"]+)['"]/gm)].map((m) => m[1]);
  return { names, hasDefault, reexportsAll };
}

test('todo nome importado de um módulo local é exportado por ele', () => {
  const problems = [];
  const cache = new Map();
  const info = (file) => cache.get(file) ?? (cache.set(file, exportsOf(file)), cache.get(file));
  const resolveNames = (file, seen = new Set()) => {
    if (seen.has(file)) return new Set();
    seen.add(file);
    const { names, reexportsAll } = info(file);
    const all = new Set(names);
    for (const rel of reexportsAll) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), rel));
      if (existsSync(path.join(root, target))) resolveNames(target, seen).forEach((n) => all.add(n));
    }
    return all;
  };

  let checked = 0;
  for (const file of DIRS.flatMap(walk)) {
    const src = strip(readFileSync(path.join(root, file), 'utf8'));
    for (const m of src.matchAll(/^import\s+(?:(\w+)\s*,\s*)?\{([^}]*)\}\s*from\s*['"](\.{1,2}\/[^'"?]+)(?:\?[^'"]*)?['"]/gm)) {
      const target = path.posix.normalize(path.posix.join(path.posix.dirname(file), m[3]));
      if (!existsSync(path.join(root, target))) {
        problems.push(`${file}: importa de ${m[3]}, que não existe`);
        continue;
      }
      const available = resolveNames(target);
      for (const part of m[2].split(',')) {
        const imported = part.trim().split(/\s+as\s+/)[0].trim();
        if (!imported) continue;
        checked += 1;
        if (!available.has(imported)) problems.push(`${file}: importa "${imported}" de ${m[3]}, mas ${target} não o exporta`);
      }
    }
  }
  assert.ok(checked > 500, `a verificação deve cobrir os imports do app (cobriu ${checked})`);
  assert.deepEqual(problems, []);
});
