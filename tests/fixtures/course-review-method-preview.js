import { db } from '../../utils/db.js';
import { renderCoursePractice } from '../../dashboard/js/ui/coursePracticeView.js';
localStorage.setItem('lf_course_prefs', JSON.stringify({ audio: false, sfx: false, reduceMotion: true }));
const units = ['One.', 'Two.', 'Three.', 'Four.'].map((text, i) => ({ id: `r${i}`, text, kind: 'sentence', translation_pt: text }));
const commits = [];
db.courses = {
  async getUnits() { return units; },
  async commitPractice(payload) { commits.push(payload); return {}; },
};
window.__review = { commits };
await renderCoursePractice(document.getElementById('panel'), { onLeaveView() {}, navigate() {} }, { kind: 'review', unitIds: units.map((u) => u.id), difficulty: 'hard' });
document.documentElement.dataset.ready = 'true';
