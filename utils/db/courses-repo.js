// utils/db/courses-repo.js — Repositório do domínio de Cursos (escuta + digitação)
// Conteúdo vem das tabelas course_*; progresso, erros, revisões e sessões só
// mudam por RPC. Leituras lançam erro para a view mostrar o estado de falha em
// vez de "vazio" enganoso.

const UNIT_FIELDS = 'id,lesson_id,order_index,kind,text,translation_pt,ipa,explanation_note,syntax_groups,annotations,example_en,example_pt';
const ID_PATTERN = /^[a-z0-9-]{1,80}$/;
const PERIODS = new Set(['daily', 'weekly', 'monthly', 'all']);

function assertId(value, name) {
  if (!ID_PATTERN.test(String(value || ''))) throw new Error(`${name} inválido`);
  return value;
}

export class CoursesRepository {
  /**
   * @param {import('../db.js').Database} db
   */
  constructor(db) {
    this.db = db;
  }

  _read(endpoint) {
    return this.db._fetch(endpoint, { throwOnReadError: true });
  }

  _rpc(name, body = {}) {
    return this.db._fetch(`rpc/${name}`, { method: 'POST', body });
  }

  async listCatalog() {
    const rows = await this._rpc('rpc_course_catalog');
    return (Array.isArray(rows) ? rows : []).map((course) => ({
      ...course,
      lessons: (course.lessons || []).filter((l) => l.unit_count > 0),
    })).filter((course) => course.lessons.length > 0);
  }

  async setInMyCourses(courseId, inMyCourses) {
    assertId(courseId, 'courseId');
    return this._rpc('rpc_set_course_in_my_courses', { p_course_id: courseId, p_in: Boolean(inMyCourses) });
  }

  async getLesson(lessonId) {
    assertId(lessonId, 'lessonId');
    const rows = await this._read(
      `course_lessons?id=eq.${lessonId}&select=id,title,chapter_number,course_id,`
      + `course_catalog(id,title,level),course_units(${UNIT_FIELDS})`,
    );
    const lesson = rows?.[0];
    if (!lesson) return null;
    return {
      ...lesson,
      units: (lesson.course_units || []).sort((a, b) => a.order_index - b.order_index),
    };
  }

  // Frases avulsas (prática de revisões/erros), na ordem pedida.
  async getUnits(unitIds) {
    const ids = [...new Set(unitIds || [])].slice(0, 200);
    ids.forEach((id) => assertId(id, 'unitId'));
    if (ids.length === 0) return [];
    const rows = await this._read(
      `course_units?id=in.(${ids.join(',')})&select=${UNIT_FIELDS},course_lessons(title,course_catalog(title))`,
    );
    const byId = new Map((rows || []).map((u) => [u.id, u]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  }

  getPath() {
    return this._rpc('rpc_course_path');
  }

  getHubSummary() {
    return this._rpc('rpc_get_course_hub_summary');
  }

  getAnalysis({ days = 30, courseId = null, difficulty = null } = {}) {
    if (courseId) assertId(courseId, 'courseId');
    return this._rpc('rpc_course_analysis', {
      p_days: days,
      p_course_id: courseId,
      p_difficulty: ['easy', 'medium', 'hard'].includes(difficulty) ? difficulty : null,
    });
  }

  getLeaderboard(period = 'weekly') {
    if (!PERIODS.has(period)) throw new Error('período inválido');
    return this._rpc('rpc_course_leaderboard', { p_period: period, p_limit: 100 });
  }

  listMistakes({ includeResolved = false } = {}) {
    return this._read(
      `course_user_mistakes?${includeResolved ? '' : 'is_resolved=eq.false&'}order=last_practiced_at.desc&limit=200`
      + '&select=unit_id,wrong_text_submitted,mistake_count,is_resolved,last_practiced_at,'
      + 'course_units(text,translation_pt,lesson_id,course_lessons(title,course_catalog(title)))',
    );
  }

  listReviews() {
    return this._read(
      'course_user_reviews?order=due_date.asc&limit=500'
      + '&select=unit_id,due_date,interval_days,repetition_number,'
      + 'course_units(text,translation_pt,lesson_id,course_lessons(title,course_id,course_catalog(title)))',
    );
  }

  listVocabulary() {
    return this._read(
      'course_user_vocabulary?order=created_at.desc&limit=500'
      + '&select=unit_id,created_at,course_units(kind,text,translation_pt,ipa,explanation_note,example_en,lesson_id,'
      + 'course_lessons(title,course_id,course_catalog(title)))',
    );
  }

  async saveVocabulary(unitId) {
    assertId(unitId, 'unitId');
    return this.db._fetch('course_user_vocabulary?on_conflict=user_id,unit_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=ignore-duplicates' },
      body: { unit_id: unitId },
    });
  }

  async removeVocabulary(unitId) {
    assertId(unitId, 'unitId');
    return this.db._fetch(`course_user_vocabulary?unit_id=eq.${unitId}`, { method: 'DELETE' });
  }

  listNotes() {
    return this._read(
      'course_user_notes?order=updated_at.desc&limit=500'
      + '&select=unit_id,note_content,updated_at,course_units(text,translation_pt,lesson_id,'
      + 'course_lessons(title,course_id,course_catalog(title)))',
    );
  }

  async getNote(unitId) {
    assertId(unitId, 'unitId');
    const rows = await this._read(`course_user_notes?unit_id=eq.${unitId}&select=note_content`);
    return rows?.[0]?.note_content || '';
  }

  async saveNote(unitId, content) {
    assertId(unitId, 'unitId');
    const note = String(content || '').trim().slice(0, 2000);
    if (!note) throw new Error('Nota vazia');
    return this.db._fetch('course_user_notes?on_conflict=user_id,unit_id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates' },
      body: { unit_id: unitId, note_content: note, updated_at: new Date().toISOString() },
    });
  }

  async deleteNote(unitId) {
    assertId(unitId, 'unitId');
    return this.db._fetch(`course_user_notes?unit_id=eq.${unitId}`, { method: 'DELETE' });
  }

  commitPractice(payload) {
    return this._rpc('rpc_course_commit_practice', {
      p_client_session_id: payload.clientSessionId,
      p_kind: payload.kind || 'lesson',
      p_lesson_id: payload.kind && payload.kind !== 'lesson' ? null : payload.lessonId,
      p_difficulty: payload.difficulty,
      p_started_at: payload.startedAt,
      p_active_time_seconds: payload.activeTimeSeconds,
      p_score: payload.score,
      p_highest_combo: payload.highestCombo,
      p_results: payload.results,
      p_completed: payload.completed !== false,
    });
  }

  // Compatibilidade com resultados pendentes gravados pela versão anterior.
  commitSession(payload) {
    const results = (payload.results || []).map((r) => (
      'hint_count' in r ? r : { ...r, hint_count: r.used_hint ? 1 : 0 }
    ));
    return this.commitPractice({ ...payload, results, kind: payload.kind || 'lesson' });
  }
}
