#!/usr/bin/env node
// Gera o inventário de docs/MAPA_DO_PROJETO.md a partir dos arquivos rastreados pelo git.
//
// Uso:
//   node scripts/generate-project-map.mjs          reescreve o inventário no mapa
//   node scripts/generate-project-map.mjs --check  falha (código 1) se o mapa estiver desatualizado
//
// O propósito de cada arquivo vem do comentário de cabeçalho dele (fonte única).
// Arquivos que não aceitam comentário (JSON, TOML) têm a descrição fixa em STATIC_DESCRIPTIONS.
// O porte do arquivo é uma classe (P/M/G/GG), não a contagem exata, para o mapa
// só mudar quando algo realmente muda de categoria.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MAP_FILE = 'docs/MAPA_DO_PROJETO.md';
const START = '<!-- mapa:inicio (gerado por scripts/generate-project-map.mjs; não edite à mão) -->';
const END = '<!-- mapa:fim -->';
const NO_DESCRIPTION = '⚠ sem descrição';

// Arquivos em formatos sem comentário.
const STATIC_DESCRIPTIONS = {
  'manifest.json': 'Manifest MV3 da extensão: permissões, sites, content scripts e recursos expostos.',
  'package.json': 'Versão, dependências de desenvolvimento e todos os scripts de teste/lint/build.',
  'package-lock.json': 'Dependências travadas (instaladas com `npm ci`).',
  'vercel.json': 'Deploy do dashboard na Vercel: rewrites para `/dashboard/*`, cabeçalhos de segurança e cache.',
  'biome.json': 'Regras do Biome (lint e formatação) aplicadas em scripts, utils, dashboard/js/core e tests.',
  'knip.json': 'Configuração do Knip (código e dependências não usados).',
  'config/biome-undeclared/biome.json': 'Configuração do Biome só para detectar variáveis não declaradas.',
  '.mcp.json': 'Servidores MCP usados nas sessões de desenvolvimento assistido.',
  'utils/cefr-wordlist.json': 'Nível CEFR (A1…C2) de cada palavra em inglês; base do perfil lexical e da dificuldade dos textos.',
  'utils/frequency-en.json': 'Posição de frequência de cada palavra em inglês (1 = mais comum).',
  'dashboard/manifest.webmanifest': 'Manifest da PWA do dashboard (nome, ícones, cores, escopo).',
  'supabase/config.toml': 'Configuração do Supabase: autenticação, pool de conexões e `verify_jwt` das Edge Functions.',
};

const SIZE_LABELS = [
  [150, 'P'],
  [500, 'M'],
  [1000, 'G'],
  [Infinity, 'GG ⚠'],
];

export function sizeClass(lines) {
  return SIZE_LABELS.find(([limit]) => lines <= limit)[1];
}

const COMMENTABLE = /\.(js|mjs|cjs|ts|css|html|sql|sh|ps1|yml)$/;

function stripCommentMarkers(line) {
  return line
    .replace(/^\s*(<!--|\/\*\*?|\/\/+|--+|#+|<#)\s*/, '')
    .replace(/\s*(-->|\*\/|#>)\s*$/, '')
    .replace(/^\*\s?/, '')
    .trim();
}

// Remove "caminho.ext —" do começo: o caminho sozinho não explica nada.
function stripPathPrefix(text, file) {
  const base = path.basename(file);
  const pattern = new RegExp(`^(?:[\\w./-]*${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|[\\w./-]+\\.(?:js|mjs|cjs|ts|css|html|sql|sh|ps1))\\s*[—–:-]*\\s*`);
  return text.replace(pattern, '').trim();
}

// Linhas do comentário de cabeçalho (já sem os marcadores), até o primeiro código.
function headerCommentLines(text) {
  const out = [];
  let inBlock = false;
  for (const raw of text.split('\n').slice(0, 40)) {
    const line = raw.trim();
    if (!out.length && !inBlock && (!line || line.startsWith('#!') || /^<!doctype/i.test(line))) continue;
    const opensBlock = /^(\/\*|<!--|<#)/.test(line);
    const startsComment = opensBlock || /^(\/\/|--|#|\*)/.test(line);
    if (!inBlock && !startsComment) break;
    if (opensBlock) inBlock = !/(\*\/|-->|#>)\s*$/.test(line);
    else if (inBlock && /(\*\/|-->|#>)\s*$/.test(line)) inBlock = false;
    out.push(stripCommentMarkers(line));
  }
  return out;
}

const DECORATION = /^[=\-_*#~\s]*$/;
const NOISE = /^(use strict|@ts-|eslint|biome-ignore)/i;

export function describeFile(file, text) {
  if (STATIC_DESCRIPTIONS[file]) return STATIC_DESCRIPTIONS[file];
  if (!COMMENTABLE.test(file)) return NO_DESCRIPTION;

  const lines = headerCommentLines(text);
  if (!lines.length && file.endsWith('.yml')) {
    const name = text.match(/^name:\s*(.+)$/m);
    if (name) return name[1].replace(/^['"]|['"]$/g, '');
  }

  // Junta as linhas do mesmo parágrafo até fechar a frase (ou chegar a ~150 caracteres).
  let description = '';
  for (let i = 0; i < lines.length; i += 1) {
    const line = i === 0 ? stripPathPrefix(lines[i], file) : lines[i];
    if (DECORATION.test(line) || NOISE.test(line)) {
      if (description) break;
      continue;
    }
    description = description ? `${description} ${line}` : line;
    if (/[.!?]$/.test(description) && description.length >= 25) break;
    if (description.length >= 150) break;
  }
  description = description.replace(/\s+/g, ' ').replace(/[:,;—-]\s*$/, '').trim();
  if (!description) return NO_DESCRIPTION;
  const escaped = description.replace(/\|/g, '\\|');
  return escaped.length > 170 ? `${escaped.slice(0, 167)}…` : escaped;
}

function gitFiles() {
  return execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .sort();
}

function lineCount(text) {
  return text.length === 0 ? 0 : text.split('\n').length;
}

function readText(file) {
  try {
    return readFileSync(path.join(ROOT, file), 'utf8');
  } catch {
    return '';
  }
}

const CODE_FILE = /\.(js|mjs|cjs|ts|css|html|sh|ps1|yml)$/;

// Cada seção diz quais arquivos entram e como são listados.
const SECTIONS = [
  {
    title: 'Raiz e configuração',
    pick: (f) => !f.includes('/') && (CODE_FILE.test(f) || /\.json$/.test(f)) && f !== 'package-lock.json'
      || f === 'config/biome-undeclared/biome.json' || f === '.mcp.json',
  },
  {
    title: 'Extensão Chrome — service worker (`background/`)',
    pick: (f) => f.startsWith('background/'),
  },
  {
    title: 'Extensão Chrome — popup (`popup/`)',
    pick: (f) => f.startsWith('popup/'),
  },
  {
    title: 'Extensão Chrome — scripts injetados nas páginas (`content/`)',
    pick: (f) => f.startsWith('content/') && !f.startsWith('content/subtitles/') && !f.startsWith('content/popup/'),
  },
  {
    title: 'Extensão Chrome — legendas (`content/subtitles/`)',
    pick: (f) => f.startsWith('content/subtitles/'),
  },
  {
    title: 'Extensão Chrome — análise linguística do popup de palavra (`content/popup/`)',
    pick: (f) => f.startsWith('content/popup/'),
  },
  {
    title: 'Dashboard PWA — núcleo (`dashboard/js/core/`)',
    pick: (f) => f.startsWith('dashboard/js/core/'),
  },
  {
    title: 'Dashboard PWA — telas (`dashboard/js/ui/`)',
    pick: (f) => f.startsWith('dashboard/js/ui/') && !f.startsWith('dashboard/js/ui/admin/') && !f.startsWith('dashboard/js/ui/courses/'),
  },
  {
    title: 'Dashboard PWA — telas de Cursos (`dashboard/js/ui/courses/`)',
    pick: (f) => f.startsWith('dashboard/js/ui/courses/'),
  },
  {
    title: 'Dashboard PWA — console administrativo (`dashboard/js/ui/admin/`)',
    pick: (f) => f.startsWith('dashboard/js/ui/admin/'),
  },
  {
    title: 'Dashboard PWA — casca, estilos e service worker',
    pick: (f) => f.startsWith('dashboard/') && !f.startsWith('dashboard/js/') && !f.startsWith('dashboard/icons/'),
  },
  {
    title: 'Código compartilhado (`utils/`) — usado pela extensão e pelo dashboard',
    pick: (f) => f.startsWith('utils/') && !f.startsWith('utils/db/'),
  },
  {
    title: 'Camada de dados por domínio (`utils/db/`)',
    pick: (f) => f.startsWith('utils/db/'),
  },
  {
    title: 'Backend — Edge Functions (`supabase/functions/`)',
    pick: (f) => f.startsWith('supabase/functions/') || f === 'supabase/config.toml',
  },
  {
    title: 'Conteúdo editorial dos cursos (`supabase/content/`)',
    pick: (f) => f.startsWith('supabase/content/') && !f.startsWith('supabase/content/batches/'),
  },
  {
    title: 'Automação (`scripts/` e `.github/workflows/`)',
    pick: (f) => f.startsWith('scripts/') || f.startsWith('.github/workflows/'),
  },
];

function table(rows) {
  return [
    '| Arquivo | Porte | Para que serve |',
    '|---|---|---|',
    ...rows.map(({ file, size, purpose }) => `| \`${file}\` | ${size} | ${purpose} |`),
  ].join('\n');
}

function summaryOf(prefix, files) {
  return files.filter((f) => f.startsWith(prefix));
}

export function buildInventory(files = gitFiles()) {
  const used = new Set();
  const parts = [];
  const missing = [];

  for (const section of SECTIONS) {
    const picked = files.filter((f) => section.pick(f));
    if (!picked.length) continue;
    const rows = picked.map((file) => {
      used.add(file);
      const text = readText(file);
      const purpose = describeFile(file, text);
      if (purpose === NO_DESCRIPTION) missing.push(file);
      return { file, size: sizeClass(lineCount(text)), purpose };
    });
    parts.push(`### ${section.title}\n\n${table(rows)}`);
  }

  // Resumos de grupos grandes (listar arquivo por arquivo não ajuda quem chega agora).
  const migrations = summaryOf('supabase/migrations/', files);
  const batches = summaryOf('supabase/content/batches/', files);
  const tests = summaryOf('tests/', files);
  const unitTests = tests.filter((f) => /^tests\/[^/]+\.test\.mjs$/.test(f));
  const e2e = tests.filter((f) => f.startsWith('tests/e2e/') && f.endsWith('.spec.mjs'));
  const dbTests = tests.filter((f) => f.startsWith('tests/db/'));
  const productionTests = tests.filter((f) => f.startsWith('tests/production/'));
  const docs = files.filter((f) => /^docs\/[^/]+\.md$/.test(f));
  const icons = files.filter((f) => /\.(png|svg|webm)$/.test(f));
  [...migrations, ...batches, ...tests, ...docs, ...icons].forEach((f) => used.add(f));

  const first = migrations[0]?.split('/').pop();
  const last = migrations[migrations.length - 1]?.split('/').pop();
  parts.push([
    '### Grupos resumidos',
    '',
    '| Grupo | Quantidade | Observação |',
    '|---|---|---|',
    `| \`supabase/migrations/\` | ${migrations.length} | Migrations SQL append-only, ordenadas por data no nome (\`AAAAMMDDHHMMSS_assunto.sql\`). Primeira: \`${first}\`. Última: \`${last}\`. Nunca edite uma migration já aplicada. |`,
    `| \`supabase/content/batches/\` | ${batches.length} | Lotes editoriais dos cursos (palavras, frases, parágrafos, histórias). Validados por \`npm run content:check\`. |`,
    `| \`tests/*.test.mjs\` | ${unitTests.length} | Testes unitários e de contrato (Node). Nome do arquivo = assunto testado. |`,
    `| \`tests/e2e/\` | ${e2e.length} | Playwright: carrega a extensão num Chromium real com páginas-fixture. |`,
    `| \`tests/db/\` | ${dbTests.length} | SQL e scripts que reproduzem as migrations num Postgres efêmero e testam RPCs/RLS. |`,
    `| \`tests/production/\` | ${productionTests.length} | Verificação de isolamento entre contas no Supabase de produção (workflow agendado). |`,
    `| \`docs/*.md\` | ${docs.length} | Documentação viva; histórico em \`docs/history/\`, produto em \`docs/product/\`. |`,
    `| imagens e mídia | ${icons.length} | Ícones da extensão e do PWA, logo e vídeo de fixture dos testes. |`,
  ].join('\n'));

  const unclassified = files.filter((f) => !used.has(f)
    && !f.startsWith('docs/')
    && !f.startsWith('dashboard/icons/')
    && !f.startsWith('.github/ISSUE_TEMPLATE/')
    && !['.gitattributes', '.gitignore', 'LICENSE', 'AGENTS.md', 'CHANGELOG.md', 'CONTRIBUTING.md', 'README.md', 'SECURITY.md', 'package-lock.json', '.github/SECURITY.md', '.github/pull_request_template.md'].includes(f));

  return { markdown: parts.join('\n\n'), missing, unclassified };
}

export function renderMap(current, inventoryMarkdown) {
  const start = current.indexOf(START);
  const end = current.indexOf(END);
  if (start === -1 || end === -1 || end < start) {
    throw new Error(`${MAP_FILE} precisa conter os marcadores do inventário.`);
  }
  return `${current.slice(0, start)}${START}\n\n${inventoryMarkdown}\n\n${current.slice(end)}`;
}

function main() {
  const check = process.argv.includes('--check');
  const { markdown, missing, unclassified } = buildInventory();
  const current = readText(MAP_FILE);
  const next = renderMap(current, markdown);

  if (missing.length) {
    console.error(`Arquivos sem descrição de propósito (adicione um comentário de cabeçalho):\n  ${missing.join('\n  ')}`);
  }
  if (unclassified.length) {
    console.error(`Arquivos que nenhuma seção do mapa cobre (ajuste SECTIONS em scripts/generate-project-map.mjs):\n  ${unclassified.join('\n  ')}`);
  }

  if (check) {
    if (current !== next) {
      console.error(`${MAP_FILE} está desatualizado. Rode: npm run map`);
      process.exit(1);
    }
    if (missing.length || unclassified.length) process.exit(1);
    console.log('Mapa do projeto atualizado.');
    return;
  }
  writeFileSync(path.join(ROOT, MAP_FILE), next);
  console.log(`${MAP_FILE} atualizado.`);
  if (missing.length || unclassified.length) process.exit(1);
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) main();
