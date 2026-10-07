// Currículo efetivo após aceite do áudio pelo dono em 2026-10-07 (#503/#505); preserva o snapshot publicado #528.
import { CURRICULUM } from './curriculum.mjs';
export const AUDIO_APPROVED_COURSE_IDS = ['course-spoken-reductions-a2', 'course-connected-speech-b2'];
export const CURRENT_CURRICULUM = CURRICULUM.map(l => AUDIO_APPROVED_COURSE_IDS.includes(l.courseId) ? { ...l, core: true } : l);
