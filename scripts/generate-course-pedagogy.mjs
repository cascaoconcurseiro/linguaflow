// #533: gera conteúdo e metadados novos; nunca reescreve migrations históricas.
import { readFileSync, writeFileSync } from 'node:fs';
import { PEDAGOGY_CURRICULUM } from '../supabase/content/curriculum-pedagogy.mjs';
import { CURRENT_CURRICULUM } from '../supabase/content/curriculum-current.mjs';
import { generateBatch } from './generate-course-seed.mjs';
export const CONTENT_FILE='supabase/migrations/20261007120327_course_content_pedagogy_533.sql';
export const MIGRATION_FILE='supabase/migrations/20261007120333_course_pedagogy_533.sql';
const q=v=>`'${String(v).replaceAll("'","''")}'`;
const arr=xs=>`ARRAY[${xs.map(q).join(',')}]::text[]`;
const original=readFileSync(new URL('../supabase/migrations/20261006230000_course_curriculum.sql',import.meta.url),'utf8');
const functions=original.slice(original.indexOf('CREATE OR REPLACE FUNCTION public.rpc_course_catalog'));
export async function generatePedagogy(){
  const batch=await generateBatch('pedagogy-533');
  if(batch.errors.length)throw Error(batch.errors.join('\n'));
  const content=batch.sql;
  const ids=new Set(PEDAGOGY_CURRICULUM.map(l=>l.id));
  if(ids.size!==414)throw Error('Cobertura esperada: 414 aulas');
  const values=PEDAGOGY_CURRICULUM.map(l=>`  (${q(l.id)},${q(l.courseId)},${q(l.level)},${l.order},${l.core},${arr(l.requires)},${q(l.role)},${q(l.module)},${l.moduleOrder})`).join(',\n');
  let updated=functions.replace("'is_core', c.is_core,", "'is_core', c.is_core,\n      'lesson_roles', (SELECT coalesce(jsonb_agg(DISTINCT cl.lesson_role),'[]'::jsonb) FROM public.course_lessons cl WHERE cl.course_id=c.id),");
  updated=updated.replace("'level', coalesce(l.level,c.level), 'curriculum_order', l.curriculum_order,", "'level', coalesce(l.level,c.level), 'curriculum_order', l.curriculum_order,\n          'lesson_role', l.lesson_role, 'module_title', l.module_title, 'module_order', l.module_order,");
  updated=updated.replace('l.id AS lesson_id, l.chapter_number\n    FROM', 'l.id AS lesson_id, l.chapter_number, l.module_title, l.module_order\n    FROM');
  updated=updated.replace('SELECT c.course_id, c.lesson_id, c.level\n    FROM core', 'SELECT c.course_id, c.lesson_id, c.level, c.module_title\n    FROM core');
  updated=updated.replace("'level', level) FROM next_lesson)", "'level', level, 'module_title', module_title) FROM next_lesson)");
  updated=updated.replace("'levels', (SELECT jsonb_agg", ` 'modules', (SELECT coalesce(jsonb_agg(jsonb_build_object(
      'level', m.level,'title',m.module_title,'order',m.module_order,'total',m.total,'completed',m.completed
    ) ORDER BY m.level,m.module_order),'[]'::jsonb) FROM (
      SELECT c.level,c.module_title,c.module_order,count(*) AS total,
        count(*) FILTER(WHERE c.lesson_id IN(SELECT lesson_id FROM done)) AS completed
      FROM core c GROUP BY c.level,c.module_title,c.module_order
    ) m),
    'levels', (SELECT jsonb_agg`);
  const migration=`-- #533: somente conteúdo/organização; revisão #531 e progresso permanecem intactos.
-- Fonte versionada: supabase/content/curriculum-pedagogy.mjs. Rollback: course_pedagogy_533.sql.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
  IF (SELECT count(*) FROM public.course_lessons WHERE id NOT LIKE 'lesson-pedagogy-%')<>372
    OR (SELECT count(*) FROM public.course_units WHERE id NOT LIKE 'unit-pedagogy-%')<>4088
    OR (SELECT md5(string_agg(concat_ws(chr(31),id,kind,text,translation_pt,coalesce(explanation_note,''),coalesce(example_en,''),coalesce(example_pt,'')),chr(30) ORDER BY id COLLATE "C")) FROM public.course_units WHERE id NOT LIKE 'unit-pedagogy-%')<>'d0002890d367706d6d43090022638f99'
    OR (SELECT count(*) FROM public.course_lessons WHERE id LIKE 'lesson-pedagogy-%')<>42
    OR (SELECT count(*) FROM public.course_units WHERE id LIKE 'unit-pedagogy-%')<>336
  THEN RAISE EXCEPTION 'Conteúdo divergente #533; reconciliar antes de publicar'; END IF;
END $$;
ALTER TABLE public.course_lessons
  ADD COLUMN IF NOT EXISTS lesson_role TEXT NOT NULL DEFAULT 'extra' CHECK(lesson_role IN('base','extra','optional')),
  ADD COLUMN IF NOT EXISTS module_title TEXT,
  ADD COLUMN IF NOT EXISTS module_order INT CHECK(module_order>0);
WITH reviewed(id,course_id,level,curriculum_order,is_core,requirements,lesson_role,module_title,module_order) AS (VALUES
${values}
)
UPDATE public.course_lessons l SET level=r.level,curriculum_order=r.curriculum_order,is_core=r.is_core,
  prerequisite_lesson_ids=r.requirements,lesson_role=r.lesson_role,module_title=r.module_title,module_order=r.module_order
FROM reviewed r WHERE l.id=r.id AND l.course_id=r.course_id;
UPDATE public.course_catalog c SET is_core=EXISTS(
  SELECT 1 FROM public.course_lessons l WHERE l.course_id=c.id AND l.is_core AND l.lesson_role='base'
),updated_at=now() WHERE EXISTS(SELECT 1 FROM public.course_lessons l WHERE l.course_id=c.id AND l.module_title IS NOT NULL);
DO $$ BEGIN
  IF (SELECT count(*) FROM public.course_lessons WHERE module_title IS NOT NULL)<>414
    OR EXISTS(SELECT 1 FROM public.course_lessons l CROSS JOIN LATERAL unnest(l.prerequisite_lesson_ids) r(id)
      LEFT JOIN public.course_lessons p ON p.id=r.id WHERE p.id IS NULL OR NOT p.is_core OR p.curriculum_order>=l.curriculum_order)
  THEN RAISE EXCEPTION 'Cobertura/dependências inválidas #533'; END IF;
END $$;
${updated}
-- Grants existentes permanecem explícitos; funções de leitura não aceitam user_id do cliente.
REVOKE ALL ON FUNCTION public.rpc_course_catalog(),public.rpc_course_path() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.rpc_course_catalog(),public.rpc_course_path() TO authenticated;
NOTIFY pgrst,'reload schema';
`;
  const previous=CURRENT_CURRICULUM.map(l=>`(${q(l.id)},${q(l.level)},${l.order},${l.core},${arr(l.requires)})`).join(',\n');
  const rollback=`-- #533: executar numa transação. Preserva unidades e todo histórico; novas aulas ficam despublicadas.
WITH previous(id,level,curriculum_order,is_core,requirements) AS (VALUES
${previous}
) UPDATE public.course_lessons l SET level=p.level,curriculum_order=p.curriculum_order,is_core=p.is_core,
  prerequisite_lesson_ids=p.requirements,lesson_role=CASE WHEN p.is_core THEN 'base' ELSE 'extra' END,
  module_title=NULL,module_order=NULL FROM previous p WHERE l.id=p.id;
UPDATE public.course_lessons SET is_core=false,lesson_role='extra' WHERE id LIKE 'lesson-pedagogy-%';
UPDATE public.course_catalog SET is_core=true WHERE id NOT LIKE 'course-pedagogy-%';
UPDATE public.course_catalog SET is_published=false,is_core=false WHERE id LIKE 'course-pedagogy-%';
${functions}
NOTIFY pgrst,'reload schema';
`;
  return {content,migration,rollback};
}
if(process.argv[1]?.endsWith('generate-course-pedagogy.mjs')){
  const {content,migration,rollback}=await generatePedagogy();
  const outputs=[[CONTENT_FILE,content],[MIGRATION_FILE,migration],['supabase/rollback/course_pedagogy_533.sql',rollback]];
  for(const [path,text] of outputs){
    if(process.argv.includes('--check')){
      if(readFileSync(new URL('../'+path,import.meta.url),'utf8')!==text)throw Error(`Drift: ${path}`);
    }else writeFileSync(new URL('../'+path,import.meta.url),text);
  }
  console.log('ok: 42 aulas, 336 frases; organização das 414 aulas e rollback preservando progresso');
}
