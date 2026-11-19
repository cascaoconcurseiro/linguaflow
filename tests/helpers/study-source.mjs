// Código-fonte da revisão (dashboard/js/ui/studyView.js) para testes que verificam o texto do código.
//
// A tela de estudo foi dividida: o arquivo principal guarda o fluxo da sessão e os blocos autocontidos
// (widget do YouGlish, feedback, comparação de respostas e janelas do cartão) moraram em study/*.js.
// Os testes de contrato valem para a revisão como um todo, então leem o arquivo principal e os módulos juntos.
import { readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';

export const STUDY_FILES = [
  'dashboard/js/ui/studyView.js',
  'dashboard/js/ui/study/youglish.js',
  'dashboard/js/ui/study/feedback.js',
  'dashboard/js/ui/study/studyText.js',
  'dashboard/js/ui/study/cardModals.js',
];

const url = (file) => new URL(`../../${file}`, import.meta.url);

export async function readStudySource() {
  return (await Promise.all(STUDY_FILES.map((file) => readFile(url(file), 'utf8')))).join('\n');
}

export function readStudySourceSync() {
  return STUDY_FILES.map((file) => readFileSync(url(file), 'utf8')).join('\n');
}
