// Código-fonte do painel de configurações do player para testes que verificam o texto do código.
//
// O painel foi dividido em módulos (content/settings-panel/*.js: armazenamento, opções de marcas e a estrutura
// HTML/CSS). Os testes de contrato continuam valendo para o painel como um todo, então leem tudo junto.
import { readdirSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

const root = new URL('../../content/', import.meta.url);
const partsDir = new URL('settings-panel/', root);
const partFiles = () => readdirSync(partsDir).filter((f) => f.endsWith('.js')).sort();

export async function readSettingsPanelSource() {
  const parts = await Promise.all(partFiles().map((f) => readFile(new URL(f, partsDir), 'utf8')));
  return [await readFile(new URL('settings-panel.js', root), 'utf8'), ...parts].join('\n');
}

export function readSettingsPanelSourceSync() {
  const parts = partFiles().map((f) => readFileSync(new URL(f, partsDir), 'utf8'));
  return [readFileSync(new URL('settings-panel.js', root), 'utf8'), ...parts].join('\n');
}
