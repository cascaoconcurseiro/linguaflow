// #535: novas migrations, jamais reescrever o conteúdo publicado em #533.
import { readFileSync, writeFileSync } from 'node:fs';
import { SEQUENCE_CURRICULUM, BLOCKS } from '../supabase/content/curriculum-sequence.mjs';
import { PEDAGOGY_CURRICULUM } from '../supabase/content/curriculum-pedagogy.mjs';
import { generateBatch } from './generate-course-seed.mjs';
export const CONTENT_FILE='supabase/migrations/20261007133915_course_content_sequence_535.sql';
export const MIGRATION_FILE='supabase/migrations/20261007133922_course_sequence_535.sql';
const q=v=>`'${String(v).replaceAll("'","''")}'`;
const arr=xs=>`ARRAY[${xs.map(q).join(',')}]::text[]`;
const previousSql=readFileSync(new URL('../supabase/migrations/20261007120333_course_pedagogy_533.sql',import.meta.url),'utf8');
const previousFunctions=previousSql.slice(previousSql.indexOf('CREATE OR REPLACE FUNCTION public.rpc_course_catalog'));
function values(rows,extended=false){return rows.map(l=>`(${q(l.id)},${q(l.level)},${l.order},${l.core},${arr(l.requires)},${q(l.role)},${q(l.module)},${l.moduleOrder}${extended?`,${q(l.stage)},${q(l.goal)}`:''})`).join(',\n');}
export async function generateSequence(){
 const batch=await generateBatch('sequence-535');if(batch.errors.length)throw Error(batch.errors.join('\n'));
 let functions=previousFunctions.replace("'lesson_role', l.lesson_role,", "'lesson_stage', l.lesson_stage, 'learning_objective', l.learning_objective, 'lesson_role', l.lesson_role,");
 functions=functions.replace('l.chapter_number, l.module_title, l.module_order\n', 'l.chapter_number, l.module_title, l.module_order, l.title, c.title AS course_title, l.lesson_stage, l.learning_objective\n');
 functions=functions.replace('SELECT c.course_id, c.lesson_id, c.level, c.module_title\n', 'SELECT c.course_id, c.lesson_id, c.level, c.module_title, c.title, c.course_title, c.lesson_stage, c.learning_objective\n');
 functions=functions.replace("'module_title', module_title) FROM next_lesson)", "'module_title', module_title, 'title', title, 'course_title', course_title, 'lesson_stage', lesson_stage, 'learning_objective', learning_objective) FROM next_lesson)");
 const migration=`-- #535: organização e aplicação. Preserva player, progresso e revisão #531.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
DO $$ BEGIN
 IF (SELECT count(*) FROM public.course_lessons)<>449 OR (SELECT count(*) FROM public.course_units)<>4704
 OR (SELECT md5(string_agg(concat_ws(chr(31),id,kind,text,translation_pt,coalesce(explanation_note,''),coalesce(example_en,''),coalesce(example_pt,'')),chr(30) ORDER BY id COLLATE "C")) FROM public.course_units WHERE id NOT LIKE 'unit-sequence-%')<>'02830f820e6710de5b07ec2d968fef3d'
 THEN RAISE EXCEPTION 'Conteúdo divergente #535; reconciliar antes de publicar'; END IF;
END $$;
ALTER TABLE public.course_lessons
 ADD COLUMN IF NOT EXISTS lesson_stage TEXT CHECK(lesson_stage IN('introduction','practice','application','consolidation')),
 ADD COLUMN IF NOT EXISTS learning_objective TEXT;
WITH reviewed(id,level,curriculum_order,is_core,requirements,lesson_role,module_title,module_order,lesson_stage,learning_objective) AS (VALUES
${values(SEQUENCE_CURRICULUM,true)}
) UPDATE public.course_lessons l SET level=r.level,curriculum_order=r.curriculum_order,is_core=r.is_core,
 prerequisite_lesson_ids=r.requirements,lesson_role=r.lesson_role,module_title=r.module_title,module_order=r.module_order,
 lesson_stage=r.lesson_stage,learning_objective=r.learning_objective FROM reviewed r WHERE l.id=r.id;
UPDATE public.course_catalog c SET is_core=EXISTS(SELECT 1 FROM public.course_lessons l WHERE l.course_id=c.id AND l.is_core AND l.lesson_role='base'),updated_at=now();
DO $$ BEGIN
 IF (SELECT count(*) FROM public.course_lessons WHERE lesson_stage IS NOT NULL AND learning_objective IS NOT NULL)<>449
 OR (SELECT count(*) FROM public.course_lessons WHERE is_core)<>247
 OR EXISTS(SELECT 1 FROM public.course_lessons l CROSS JOIN LATERAL unnest(l.prerequisite_lesson_ids) r(id)
 LEFT JOIN public.course_lessons p ON p.id=r.id WHERE p.id IS NULL OR NOT p.is_core OR p.curriculum_order>=l.curriculum_order)
 THEN RAISE EXCEPTION 'Cobertura ou dependências inválidas #535'; END IF;
END $$;
${functions}`;
 const rollback=`-- #535: executar numa transação. Preserva unidades e histórico, despublica adições.
WITH previous(id,level,curriculum_order,is_core,requirements,lesson_role,module_title,module_order) AS (VALUES
${values(PEDAGOGY_CURRICULUM)}
) UPDATE public.course_lessons l SET level=p.level,curriculum_order=p.curriculum_order,is_core=p.is_core,
 prerequisite_lesson_ids=p.requirements,lesson_role=p.lesson_role,module_title=p.module_title,module_order=p.module_order,
 lesson_stage=NULL,learning_objective=NULL FROM previous p WHERE l.id=p.id;
UPDATE public.course_lessons SET is_core=false,lesson_role='extra' WHERE id LIKE 'lesson-sequence-%';
UPDATE public.course_catalog c SET is_core=EXISTS(SELECT 1 FROM public.course_lessons l WHERE l.course_id=c.id AND l.is_core);
UPDATE public.course_catalog SET is_published=false,is_core=false WHERE id LIKE 'course-sequence-%';
${previousFunctions}`;
 const doc=`# Sequência pedagógica do LinguaFlow — #535\n\nFonte vigente: curriculum-sequence.mjs. Substitui a organização #533; mantém IDs, histórico e método de ouvir/digitar.\n\n## Critério pedagógico\n\nO CEFR descreve capacidades de uso da língua; não impõe uma lista universal de gramática. A distribuição abaixo é uma decisão editorial orientada pelos descritores do Conselho da Europa e pelos repertórios do British Council. Terminar ditados não certifica conversação, escrita livre, interação nem mediação.\n\nFontes consultadas em 07/10/2026:\n- https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors\n- https://www.coe.int/en/web/common-european-framework-reference-languages/cefr-descriptors-search\n- https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2\n- https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2\n\n## O que mudou\n\n35 aulas novas, 280 frases originais traduzidas: 32 fechamentos de bloco e 3 introduções (perguntas wh, adjetivos -ed/-ing, question tags). Introdução → prática em contexto → consolidação; revisão espaçada continua pelo mecanismo #531. São exposições e prática controlada; oito frases não demonstram domínio por si.\n\nNúmeros antecedem preços/horas; presente simples antecede frequência; was/were antecede passado simples. Vocabulário A2 foi distribuído por contexto (o maior bloco contém 17 aulas, incluindo consolidação). Cada fechamento exige a base de seu bloco e libera o bloco seguinte. Dependências locais explicitam as estruturas usadas. Dentro do bloco, vocabulário pode ser estudado em paralelo.\n\nBase: 247 aulas (A1 48, A2 79, B1 53, B2 53, C1 14). Extras: 129. Opcionais: 73. Total: 449 aulas, 4.704 unidades, 39 cursos. C1 conserva os oito módulos e a ordem anterior; não foi ampliado neste recorte. C2 não existe no catálogo.\n\n## Planejamento por bloco\n\n| Nível | Bloco | Objetivo de prática | Aulas base |\n|---|---|---|---:|\n${BLOCKS.map(b=>`| ${b.level} | ${b.number}. ${b.title} | ${b.goal} | ${b.ids.length} |`).join('\n')}\n\n## Extras e opcionais\n\nExtras oferecem variações, vocabulário, reduções de fala, verbos e histórias complementares. Opcionais cobrem objetivos específicos, como trabalho, entrevista e negociação. Ambos aparecem no filtro por nível; sua conclusão não é exigida para avançar. Recebem como referência o fechamento do bloco correspondente para contextualizar o estudo. É orientação, não bloqueio do acesso manual. Cursos mistos continuam exibindo o nível de cada aula.\n\n## Conclusão de aula\n\nPrimeiro salva a sessão idempotente; depois consulta rpc_course_path e oferece a aula seguinte com título, nível e módulo, inclusive em outro curso. Continuar abre o preparo existente. Finalizar por hoje volta ao curso. Falha ao salvar mantém o resultado local e permite tentar novamente. Falha apenas na recomendação permite buscar novamente sem gravar a sessão outra vez. Sem próxima aula: mensagem de base concluída ou de pré-requisitos pendentes. Revisões mantêm seu encerramento próprio.\n\n## Observação operacional\n\nPerguntas: falha ao gravar ou só ao recomendar? O retry duplica a sessão? Erros registram completion_failed com stage, kind limitado e correlation_id da sessão, sem texto digitado ou dados de conta. Idempotência continua no servidor; o teste pós-commit e contagens de sessão cobrem duplicação. Não introduz pipeline de métricas novo.\n\n## Limites e próximos conteúdos\n\nEsta revisão melhora a sequência da prática controlada. Mantém pendente uma avaliação humana das traduções, do áudio e da carga de cada bloco. A avaliação do nível precisa observar compreensão, produção oral e escrita, interação e mediação fora do ditado. Preservar o método não elimina essas necessidades. C1 precisa de futura expansão em textos longos, síntese, nuance e registro; C2 requer planejamento próprio antes de ser anunciado.\n\n## Inventário vigente\n\n| Aula | Nível | Papel | Bloco | Etapa | Pré-requisitos |\n|---|---|---|---|---|---|\n${SEQUENCE_CURRICULUM.map(l=>`| ${l.id} | ${l.level} | ${l.role} | ${l.module} | ${l.stage} | ${l.requires.join(', ')||'—'} |`).join('\n')}\n`;
 return {content:batch.sql,migration,rollback,doc};
}
if(process.argv[1]?.endsWith('generate-course-sequence.mjs')){
 const output=await generateSequence();
 for(const [key,path] of Object.entries({content:CONTENT_FILE,migration:MIGRATION_FILE,rollback:'supabase/rollback/course_sequence_535.sql',doc:'docs/product/SEQUENCIA_PEDAGOGICA.md'})){
 const url=new URL('../'+path,import.meta.url);
 if(process.argv.includes('--check')){if(readFileSync(url,'utf8')!==output[key])throw Error(`Drift: ${path}`);}else writeFileSync(url,output[key]);
 }
 console.log('ok: 449 aulas organizadas; 35 novas, 280 frases, 247 base; rollback sem remover histórico');
}
