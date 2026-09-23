// Offline preview for visual and browser contract checks; never uses live account data.
import { db } from '../../utils/db.js';
import { renderFluencyCheck } from '../../dashboard/js/ui/fluencyCheckView.js';
let draft = null;
const catalog = {
  listening: { options:['Ela mudou o horário da reunião.','A reunião foi cancelada.','Ela perdeu o ônibus.'], instruction:'Ouça uma mensagem curta e escolha a ideia principal.' },
  writing: { instruction:'Envie uma mensagem curta para remarcar uma reunião.' },
  interaction: { instruction:'Peça uma informação e esclareça os detalhes com o atendente.', objective:'Concluir a troca de mensagens.' },
};
db.fluencyCheckAdapter = {
  async load() { return { latest:null, draft }; },
  async saveDraft(value) { draft = structuredClone(value); },
  async clearDraft() { draft = null; },
  async issue(skill, level, id) { return { id, skill, target_level:level, material:catalog[skill], expires_at:new Date(Date.now()+3600000).toISOString() }; },
  async audio() { throw new Error('Áudio não disponível nesta prévia offline.'); },
  async submit() { throw new Error('A prévia não registra avaliações.'); },
};
const root = document.getElementById('app-root');
await renderFluencyCheck(root, { db, onLeaveView() {}, navigate() {}, showToast() {} });
