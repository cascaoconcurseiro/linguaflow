import { db } from '../../utils/db.js';
import { renderCoursePractice } from '../../dashboard/js/ui/coursePracticeView.js';
localStorage.setItem('lf_course_prefs', JSON.stringify({ audio: false, sfx: false, reduceMotion: true }));
const all = [
  { id: 'u0', order_index: 1, kind: 'word', text: 'keys', translation_pt: 'chaves', explanation_note: 'Plural de key.', example_en: 'I lost my keys.', example_pt: 'Perdi minhas chaves.', example_annotations: [{ surface: 'I', pos: 'pronoun', ipa: '/aɪ/', gloss: 'eu' }, { surface: 'lost', pos: 'verb', ipa: '/lɔːst/', gloss: 'perdi' }, { surface: 'my', pos: 'determiner', ipa: '/maɪ/', gloss: 'meu, minha' }, { surface: 'keys', pos: 'noun', ipa: '/kiz/', gloss: 'chaves' }], annotations: [{ surface: 'keys', pos: 'noun', gloss: 'chaves' }], syntax_groups: [{ role: 'object', surface: 'keys' }] },
  { id: 'u1', order_index: 1, kind: 'sentence', text: 'I am here.', translation_pt: 'Estou aqui.', explanation_note: 'Verbo to be.', annotations: [{ surface: 'I', pos: 'pron', gloss: 'eu' }, { surface: 'am', pos: 'verb', gloss: 'estou' }, { surface: 'here', pos: 'adv', gloss: 'aqui' }] },
  { id: 'u2', order_index: 1, kind: 'sentence', text: 'Go now.', translation_pt: 'Vá agora.' },
  { id: 'u3', order_index: 1, kind: 'sentence', text: 'She works.', translation_pt: 'Ela trabalha.', annotations: [{ surface: 'She', pos: 'pron', gloss: 'ela' }, { surface: 'works', pos: 'verb', gloss: 'trabalha' }], syntax_groups: [{ role: 'subject', surface: 'She' }, { role: 'verb', surface: 'works' }] },
  { id: "u5", order_index: 1, kind: "sentence", text: "It's a rip-off, Ana!", translation_pt: "É um roubo, Ana!", annotations: [{ surface: "It's", pos: "pronoun", ipa: "/ɪts/", gloss: "é" }, { surface: "a", pos: "determiner", ipa: "/ə/", gloss: "um" }, { surface: "rip-off", pos: "noun", ipa: "/ˈrɪpˌɔːf/", gloss: "roubo" }] },
  { id: 'u4', order_index: 1, kind: 'sentence', text: '<img src=x onerror=alert(1)>', translation_pt: '<script>1</script>', explanation_note: '<b>nota</b>' },
];
const index = Number(new URLSearchParams(location.search).get('u') || 0);
const withObjective = !location.search.includes('noobjective');
db.courses = {
  async getLesson() { return { id: 'l1', chapter_number: 1, title: 'Aula', course_catalog: { title: 'Curso' }, learning_objective: withObjective ? 'Instruções curtas com imperativo' : '', units: [all[index]] }; },
  async getNote() { return ''; },
  async commitPractice() { return { percent_completed: 10 }; },
  async getPath() { return { next: null }; },
};
await renderCoursePractice(document.getElementById('panel'), { onLeaveView() {}, navigate() {} }, { kind: 'lesson', lessonId: 'l1', courseId: 'c1', difficulty: 'medium' });
document.documentElement.dataset.ready = 'true';
