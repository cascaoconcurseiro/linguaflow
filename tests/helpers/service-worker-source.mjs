// Código-fonte do service worker (background/service-worker.js) para testes que verificam o texto do código.
//
// O service worker foi dividido: o arquivo principal guarda a central de mensagens, a fila local de palavras
// e os alarmes; os blocos autocontidos (dicionário, pedidos de IA e classificador de palavras) moraram em
// módulos próprios de background/. Os testes de contrato valem para o service worker como um todo, então
// leem o arquivo principal e esses módulos juntos. Os demais módulos de background/ continuam sendo lidos à parte.
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export const SERVICE_WORKER_FILES = [
  'background/service-worker.js',
  'background/dictionary.js',
  'background/ai-requests.js',
  'background/word-classifier.js',
];

const url = (file) => new URL(`../../${file}`, import.meta.url);

export async function readServiceWorkerSource() {
  return (await Promise.all(SERVICE_WORKER_FILES.map((file) => readFile(url(file), 'utf8')))).join('\n');
}

export function readServiceWorkerSourceSync() {
  return SERVICE_WORKER_FILES.map((file) => readFileSync(url(file), 'utf8')).join('\n');
}
