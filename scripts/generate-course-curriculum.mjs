// Gera metadados curriculares append-only e a auditoria integral por aula (#528), sem alterar conteúdo/progresso.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { CURRICULUM } from '../supabase/content/curriculum.mjs';
import { CURRENT_CURRICULUM } from '../supabase/content/curriculum-current.mjs';
import { loadCourseContentSnapshot } from './course-content-snapshot.mjs';

const LEVELS = ['A1','A2','B1','B2','C1'];
const sql = v => `'${String(v).replaceAll("'", "''")}'`;
export const MIGRATION_FILE = 'supabase/migrations/20261006230000_course_curriculum.sql';

export async function generateCourseCurriculum() {
  // Corte fixo: lotes futuros não podem reescrever esta migration já publicada.
  const courses = await loadCourseContentSnapshot({ through: '20261006221000' });
  const lessons = courses.flatMap(c => c.lessons);
  const byId = new Map(CURRICULUM.map(l => [l.id, l]));
  if (byId.size !== CURRICULUM.length || lessons.length !== CURRICULUM.length || lessons.some(l => !byId.has(l.id))) throw new Error('Cobertura curricular incompleta ou duplicada');
  const orders = new Set();
  for (const l of CURRICULUM) {
    if (!LEVELS.includes(l.level) || !Number.isInteger(l.order) || l.order < 1 || orders.has(l.order)) throw new Error(`Nível/ordem inválido: ${l.id}`);
    orders.add(l.order);
    if (!lessons.some(source => source.id === l.id && source.courseId === l.courseId)) throw new Error(`Curso divergente: ${l.id}`);
    for (const id of l.requires) {
      const previous = byId.get(id);
      if (!previous || previous.order >= l.order || LEVELS.indexOf(previous.level) > LEVELS.indexOf(l.level) || !previous.core) throw new Error(`Pré-requisito inválido: ${l.id} -> ${id}`);
    }
  }
  const units = lessons.flatMap(l => l.units).sort((a,b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const digest = createHash('md5').update(units.map(u => [u.id,u.kind || 'sentence',u.text,u.pt,u.note || '',u.example?.[0] || '',u.example?.[1] || ''].join('\x1f')).join('\x1e')).digest('hex');
  const values = CURRICULUM.map(l => `  (${sql(l.id)}, ${sql(l.courseId)}, ${sql(l.level)}, ${l.order}, ${l.core}, ARRAY[${l.requires.map(sql).join(',')}]::text[])`).join(',\n');
  const courseValues = courses.map(c => {
    const list = CURRICULUM.filter(l => l.courseId === c.id);
    const max = LEVELS[Math.max(...list.map(l => LEVELS.indexOf(l.level)))];
    const rename = {
      'course-1000-words-a1': 'Vocabulário Essencial por Temas',
      'course-grammar-b2': 'Gramática Intermediária e Avançada',
    };
    const short = c.id === 'course-1000-words-a1' ? '880 itens de vocabulário, em temas do concreto ao abstrato; níveis definidos por capítulo.' : c.short;
    const description = c.id === 'course-1000-words-a1' ? 'Vocabulário por temas: pessoas, casa, alimentação, serviços, personalidade e conectores. O catálogo contém 880 itens em 44 capítulos; a extensão do vocabulário não certifica um nível.' : c.long;
    const long = `${description} Os níveis variam por capítulo; confira o nível e os pré-requisitos de cada aula. A numeração histórica e seu progresso foram preservados.`;
    return `  (${sql(c.id)}, ${sql(max)}, ${sql(rename[c.id] || c.title)}, ${sql(short)}, ${sql(long)})`;
  }).join(',\n');
  const catalogSource = readFileSync(new URL('../supabase/migrations/20260928000200_course_catalog_unit_kind.sql', import.meta.url), 'utf8').replaceAll('\r\n','\n');
  let catalog = catalogSource.slice(catalogSource.indexOf('CREATE OR REPLACE FUNCTION'));
  catalog = catalog.replace("'long_description', c.long_description, 'level', c.level, 'category', c.category,", `'long_description', c.long_description, 'level', c.level, 'category', c.category,
      'level_min', (SELECT min(coalesce(cl.level,c.level)) FROM public.course_lessons cl WHERE cl.course_id=c.id AND EXISTS(SELECT 1 FROM public.course_units cu WHERE cu.lesson_id=cl.id)),
      'level_max', (SELECT max(coalesce(cl.level,c.level)) FROM public.course_lessons cl WHERE cl.course_id=c.id AND EXISTS(SELECT 1 FROM public.course_units cu WHERE cu.lesson_id=cl.id)),
      'curriculum_order', (SELECT min(cl.curriculum_order) FROM public.course_lessons cl WHERE cl.course_id=c.id),`);
  catalog = catalog.replace("'id', l.id, 'chapter_number', l.chapter_number, 'title', l.title, 'description', l.description,", `'id', l.id, 'chapter_number', l.chapter_number, 'title', l.title, 'description', l.description,
          'level', coalesce(l.level,c.level), 'curriculum_order', l.curriculum_order,
          'is_core', c.is_core AND l.is_core AND l.curriculum_order IS NOT NULL,
          'prerequisite_titles', (SELECT coalesce(jsonb_agg(pl.title ORDER BY pl.curriculum_order),'[]'::jsonb) FROM public.course_lessons pl WHERE pl.id=ANY(l.prerequisite_lesson_ids)),`);
  catalog = catalog.replace('ORDER BY l.chapter_number)', 'ORDER BY coalesce(l.level,c.level), l.curriculum_order NULLS LAST, l.chapter_number)');
  const pathSource = readFileSync(new URL('../supabase/migrations/20261006197000_course_path_c1.sql', import.meta.url),'utf8').replaceAll('\r\n','\n');
  let path = pathSource.slice(pathSource.indexOf('CREATE OR REPLACE FUNCTION'));
  path = path.replace('c.id AS course_id, c.level, c.track, c.track_order, c.order_index, l.id AS lesson_id, l.chapter_number', 'c.id AS course_id, l.level, l.curriculum_order, l.prerequisite_lesson_ids, l.id AS lesson_id, l.chapter_number');
  path = path.replace('WHERE c.is_published AND c.is_core AND EXISTS', 'WHERE c.is_published AND c.is_core AND l.is_core AND l.curriculum_order IS NOT NULL AND EXISTS');
  path = path.replace('p.completed::NUMERIC / p.total >= 0.8', 'p.completed = p.total');
  path = path.replace("AND c.level IN (SELECT level FROM status WHERE NOT skipped_by_placement)", `AND c.level = (SELECT level FROM current_level)
      AND NOT EXISTS (
        SELECT 1 FROM unnest(c.prerequisite_lesson_ids) AS requirement(id)
        LEFT JOIN public.course_lessons pl ON pl.id=requirement.id
        WHERE pl.id IS NULL OR (pl.id NOT IN (SELECT lesson_id FROM done)
          AND pl.level NOT IN (SELECT level FROM status WHERE skipped_by_placement))
      )`);
  path = path.replace("array_position(ARRAY['fundamentos', 'dia-a-dia', 'viagem', 'gramatica', 'trabalho', 'fluencia'], c.track),\n      c.track_order, c.order_index, c.chapter_number", 'c.curriculum_order, c.lesson_id');
  path = path.replace("'current_level', coalesce((SELECT level FROM current_level), (SELECT level FROM next_lesson)),", ` 'current_level', coalesce((SELECT level FROM next_lesson), (SELECT level FROM current_level)),
    'blocked', NOT EXISTS(SELECT 1 FROM next_lesson) AND EXISTS(SELECT 1 FROM core c WHERE c.lesson_id NOT IN(SELECT lesson_id FROM done) AND c.level IN(SELECT level FROM status WHERE NOT skipped_by_placement)),`);
  // Normalizar CRLF antes das substituições de trechos; abaixo também garante que nenhum ORDER BY legado escapou.
  if (path.includes('c.track_order') || !path.includes('c.curriculum_order, c.lesson_id')) throw new Error('Definição da trilha mudou; revisar gerador antes de publicar');
  const migration = `-- Gerado por scripts/generate-course-curriculum.mjs; fonte supabase/content/curriculum.mjs (#528).
-- Auditoria editorial em docs/product/CURRICULO_CEFR.md. IDs, conteúdo e histórico do aluno preservados.
-- Rollback: supabase/rollback/course_curriculum_528.sql. Sem novas permissões nem alterações de RLS.
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$ BEGIN
  IF (SELECT count(*) FROM public.course_lessons) <> ${lessons.length}
    OR (SELECT count(*) FROM public.course_units) <> ${units.length}
    OR (SELECT md5(string_agg(concat_ws(chr(31), id,kind,text,translation_pt,coalesce(explanation_note,''),coalesce(example_en,''),coalesce(example_pt,'')),chr(30) ORDER BY id COLLATE "C")) FROM public.course_units) <> ${sql(digest)}
  THEN RAISE EXCEPTION 'Conteúdo divergente da auditoria #528; não publicar sem reconciliar'; END IF;
END $$;

ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS level TEXT CHECK(level IN ('A1','A2','B1','B2','C1','C2')),
  ADD COLUMN IF NOT EXISTS curriculum_order INT CHECK(curriculum_order > 0),
  ADD COLUMN IF NOT EXISTS is_core BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS prerequisite_lesson_ids TEXT[] NOT NULL DEFAULT '{}';

WITH reviewed(id,course_id,level,curriculum_order,is_core,requirements) AS (VALUES
${values}
)
UPDATE public.course_lessons l SET level=r.level, curriculum_order=r.curriculum_order,
  is_core=r.is_core, prerequisite_lesson_ids=r.requirements
FROM reviewed r WHERE l.id=r.id AND l.course_id=r.course_id;

WITH reviewed(id,level,title,short_description,long_description) AS (VALUES
${courseValues}
)
UPDATE public.course_catalog c SET level=r.level,title=r.title,short_description=r.short_description,
  long_description=r.long_description,updated_at=now() FROM reviewed r WHERE c.id=r.id;

DO $$ BEGIN
  IF (SELECT count(*) FROM public.course_lessons WHERE curriculum_order IS NOT NULL) <> ${lessons.length}
  THEN RAISE EXCEPTION 'Cobertura curricular incompleta'; END IF;
END $$;

${catalog.trim()}

${path.trim()}
`;
  const cell = v => `"${String(v ?? '').replaceAll('"','""')}"`;
  const report = '\uFEFF'+[['curso','id_aula','aula','nivel_anterior_curso','nivel_aula','ordem_global','trilha','pre_requisitos','itens','evidencia_inicial','evidencia_final','criterio_editorial'],...CURRENT_CURRICULUM.map(r => {
    const c=courses.find(c=>c.id===r.courseId), l=c.lessons.find(l=>l.id===r.id);
    return [c.title,r.id,l.title,c.level,r.level,r.order,r.core?'central':'complementar',r.requires.join(' | '),l.units.length,l.units[0].text,l.units.at(-1).text,r.reason];
  })].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
  const restore = courses.map(c => `UPDATE public.course_catalog SET level=${sql(c.level)},title=${sql(c.title)},short_description=${sql(c.short)},long_description=${sql(c.long)},updated_at=now() WHERE id=${sql(c.id)};`).join('\n');
  const rollback = `-- Reversão operacional #528: executar numa transação; preserva colunas, conteúdo e histórico.\nSET LOCAL lock_timeout='5s';\nSET LOCAL statement_timeout='60s';\n${restore}\nUPDATE public.course_lessons SET level=NULL,curriculum_order=NULL,is_core=false,prerequisite_lesson_ids='{}';\n${catalogSource.slice(catalogSource.indexOf('CREATE OR REPLACE FUNCTION'))}\n${pathSource.slice(pathSource.indexOf('CREATE OR REPLACE FUNCTION'))}`;
  return {migration,report,rollback,digest,lessons:lessons.length,units:units.length};
}

if (process.argv[1]?.endsWith('generate-course-curriculum.mjs')) {
  const result=await generateCourseCurriculum();
  const files=[[MIGRATION_FILE,result.migration],['docs/product/CURRICULO_AULAS.csv',result.report],['supabase/rollback/course_curriculum_528.sql',result.rollback]];
  if(process.argv.includes('--check')) {
    for(const [file,content] of files) if(readFileSync(file,'utf8').replaceAll('\r\n','\n')!==content.replaceAll('\r\n','\n')) throw new Error(`Drift curricular: ${file}`);
  } else for(const [file,content] of files) writeFileSync(file,content);
  console.log(`Currículo: ${result.lessons} aulas, ${result.units} itens; hash ${result.digest}.`);
}
