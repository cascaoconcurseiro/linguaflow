// Player de aula com serviços simulados. Query: difficulty=easy|medium|hard, kind=lesson|review,
// units=sentences|word|three, fail=load|empty|commit, noprefs.
import { db } from '../../utils/db.js';
import { renderCoursePractice } from '../../dashboard/js/ui/coursePracticeView.js';

const query = new URLSearchParams(location.search);
const difficulty = query.get('difficulty') || 'medium';
const kind = query.get('kind') || 'lesson';
const fail = query.get('fail') || '';
if (!query.has('noprefs')) localStorage.setItem('lf_course_prefs', JSON.stringify({ audio: false, sfx: false, reduceMotion: true }));

const sentence = (id, text, pt, extra = {}) => ({ id, order_index: 1, kind: 'sentence', text, translation_pt: pt, explanation_note: `Nota de ${id}.`, ...extra });
const SETS = {
  sentences: [sentence('s1', 'I am here.', 'Estou aqui.'), sentence('s2', 'You are late.', 'Você está atrasado.')],
  three: [sentence('s1', 'I am here.', 'Estou aqui.'), sentence('s2', 'You are late.', 'Você está atrasado.'), sentence('s3', 'We go home.', 'Vamos para casa.')],
  word: [{ id: 'w1', order_index: 1, kind: 'word', text: 'keys', translation_pt: 'chaves', example_en: 'I lost my keys.', example_pt: 'Perdi minhas chaves.', explanation_note: 'Plural de key.' }],
};
const units = fail === 'empty' ? [] : SETS[query.get('units') || 'sentences'];

const state = { commits: [], navigations: [], toasts: [], vocab: [], notes: [], loads: 0, heartbeats: 0 };
window.__player = state;

db.logSession = async () => { state.heartbeats += 1; };
db.courses = {
  async getLesson() {
    state.loads += 1;
    if (fail === 'load' && state.loads === 1) throw Object.assign(new Error('offline'), { kind: 'network' });
    return { id: 'l1', chapter_number: 3, title: 'Aula de teste', course_catalog: { title: 'Curso de teste' }, learning_objective: 'Foco de teste', units };
  },
  async getUnits() { state.loads += 1; return units; },
  async getNote() { return ''; },
  async saveNote(id, note) { state.notes.push([id, note]); },
  async saveVocabulary(id) { state.vocab.push(id); },
  async commitPractice(payload) {
    state.commits.push(payload);
    if (fail === 'commit' && state.commits.length === 1) throw Object.assign(new Error('offline'), { kind: 'network' });
    return { percent_completed: 40 };
  },
  async getPath() { return { next: null }; },
};

const app = {
  onLeaveView() {},
  navigate: (route, params) => state.navigations.push({ route, params }),
  showToast: (message, type) => state.toasts.push({ message, type }),
};
const params = kind === 'lesson'
  ? { kind: 'lesson', lessonId: 'l1', courseId: 'c1', difficulty }
  : { kind, unitIds: units.map(u => u.id), difficulty };
await renderCoursePractice(document.getElementById('panel'), app, params);
document.documentElement.dataset.ready = 'true';
