// utils/db/courses-repo.js — Repositório do domínio de Cursos (escuta + digitação)
// Conteúdo vem das tabelas course_*; progresso, erros e revisões só mudam pela
// RPC rpc_commit_course_session. Leituras lançam erro para a view mostrar o
// estado de falha em vez de "vazio" enganoso.

const UNIT_FIELDS = 'id,order_index,text,translation_pt,ipa,explanation_note,syntax_groups,annotations';
const ID_PATTERN = /^[a-z0-9-]{1,80}$/;

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

  async listCatalog() {
    const rows = await this._read(
      'course_catalog?is_published=eq.true&order=order_index.asc'
      + '&select=id,slug,title,short_description,long_description,level,category,'
      + 'course_lessons(id,chapter_number,title,description,course_units(count))',
    );
    return (rows || []).map((course) => ({
      ...course,
      lessons: (course.course_lessons || [])
        .map((lesson) => ({ ...lesson, unit_count: lesson.course_units?.[0]?.count || 0 }))
        .filter((lesson) => lesson.unit_count > 0)
        .sort((a, b) => a.chapter_number - b.chapter_number),
    })).filter((course) => course.lessons.length > 0);
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

  getHubSummary() {
    return this.db._fetch('rpc/rpc_get_course_hub_summary', { method: 'POST', body: {} });
  }

  listMistakes() {
    return this._read(
      'course_user_mistakes?is_resolved=eq.false&order=last_practiced_at.desc&limit=200'
      + '&select=unit_id,wrong_text_submitted,mistake_count,last_practiced_at,'
      + 'course_units(text,translation_pt,lesson_id,course_lessons(title,course_catalog(title)))',
    );
  }

  listDueReviews() {
    return this._read(
      `course_user_reviews?due_date=lte.${encodeURIComponent(new Date().toISOString())}`
      + '&order=due_date.asc&limit=200&select=unit_id,due_date,course_units(lesson_id)',
    );
  }

  listVocabulary() {
    return this._read(
      'course_user_vocabulary?order=created_at.desc&limit=500'
      + '&select=unit_id,created_at,course_units(text,translation_pt,ipa,explanation_note)',
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

  commitSession(payload) {
    return this.db._fetch('rpc/rpc_commit_course_session', {
      method: 'POST',
      body: {
        p_client_session_id: payload.clientSessionId,
        p_lesson_id: payload.lessonId,
        p_difficulty: payload.difficulty,
        p_started_at: payload.startedAt,
        p_active_time_seconds: payload.activeTimeSeconds,
        p_score: payload.score,
        p_highest_combo: payload.highestCombo,
        p_results: payload.results,
      },
    });
  }
}
