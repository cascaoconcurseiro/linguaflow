#!/usr/bin/env node
/**
 * LinguaFlow - Script de Empacotamento de Produção da Extensão Chrome
 * Gera dist/linguaflow-extension-v<version>.zip pronto para a Chrome Web Store.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = path.resolve(import.meta.dirname, '..');
const distDir = path.join(root, 'dist');
const stagingDir = path.join(distDir, 'extension');

console.log('📦 Empacotando LinguaFlow Chrome Extension para Produção...');

// 1. Ler e validar manifest.json e package.json
const pkgPath = path.join(root, 'package.json');
const manifestPath = path.join(root, 'manifest.json');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

if (pkg.version !== manifest.version) {
  console.error(`❌ Inconsistência de versão: package.json (${pkg.version}) !== manifest.json (${manifest.version})`);
  process.exit(1);
}

const version = manifest.version;
console.log(`Versão identificada: v${version}`);

// 2. Preparar diretório dist limpo
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

// 3. Coletar arquivos estritamente necessários para a extensão
const filesToCopy = new Set([
  'manifest.json',
]);

// Ícones do manifest
if (manifest.icons) {
  Object.values(manifest.icons).forEach(icon => filesToCopy.add(icon));
}
if (manifest.action?.default_icon) {
  if (typeof manifest.action.default_icon === 'string') {
    filesToCopy.add(manifest.action.default_icon);
  } else {
    Object.values(manifest.action.default_icon).forEach(icon => filesToCopy.add(icon));
  }
}
if (manifest.action?.default_popup) {
  filesToCopy.add(manifest.action.default_popup);
  // popup.js e popup.css
  const popupDir = path.dirname(manifest.action.default_popup);
  if (fs.existsSync(path.join(root, popupDir))) {
    fs.readdirSync(path.join(root, popupDir)).forEach(f => {
      if (/\.(js|css|html|png|svg)$/.test(f)) filesToCopy.add(path.join(popupDir, f).replace(/\\/g, '/'));
    });
  }
}

// Background
if (manifest.background?.service_worker) {
  filesToCopy.add(manifest.background.service_worker);
}

// Content scripts
if (Array.isArray(manifest.content_scripts)) {
  for (const cs of manifest.content_scripts) {
    (cs.js || []).forEach(f => filesToCopy.add(f));
    (cs.css || []).forEach(f => filesToCopy.add(f));
  }
}

// Web accessible resources
if (Array.isArray(manifest.web_accessible_resources)) {
  for (const war of manifest.web_accessible_resources) {
    (war.resources || []).forEach(f => filesToCopy.add(f));
  }
}

// Ícones extras comuns se existirem
['icon16.png', 'icon32.png', 'icon48.png', 'icon128.png'].forEach(f => {
  if (fs.existsSync(path.join(root, f))) filesToCopy.add(f);
});

// 4. Copiar para o staging
let copiedCount = 0;
for (const rel of filesToCopy) {
  const src = path.join(root, rel);
  if (!fs.existsSync(src)) {
    console.error(`❌ Arquivo declarado no manifest não encontrado: ${rel}`);
    process.exit(1);
  }
  const dest = path.join(stagingDir, rel);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  copiedCount++;
}

console.log(`✓ ${copiedCount} arquivos copiados para o staging de release`);

// 5. Gerar arquivo ZIP de produção
const zipName = `linguaflow-extension-v${version}.zip`;
const zipPath = path.join(distDir, zipName);

if (fs.existsSync(zipPath)) {
  fs.unlinkSync(zipPath);
}

// Usa tar -a -c -f (suportado nativamente no Windows 10/11 e Linux) ou powershell como fallback
try {
  execFileSync('tar', ['-a', '-c', '-f', zipPath, '.'], {
    cwd: stagingDir,
    stdio: 'ignore',
  });
} catch {
  // Fallback para PowerShell no Windows
  if (process.platform === 'win32') {
    execFileSync('powershell.exe', [
      '-NoProfile',
      '-Command',
      `Compress-Archive -Path "${stagingDir}/*" -DestinationPath "${zipPath}" -Force`
    ]);
  } else {
    execFileSync('zip', ['-r', zipPath, '.'], { cwd: stagingDir });
  }
}

const stats = fs.statSync(zipPath);
const sizeKb = (stats.size / 1024).toFixed(1);

console.log(`\n======================================================`);
console.log(`✅ Build de produção gerado com sucesso!`);
console.log(`   Arquivo: dist/${zipName}`);
console.log(`   Tamanho: ${sizeKb} KB`);
console.log(`   Arquivos incluídos: ${copiedCount}`);
console.log(`======================================================\n`);
