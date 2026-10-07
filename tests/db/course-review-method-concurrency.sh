#!/usr/bin/env bash
# #531: duas sessões concorrentes não promovem a mesma frase duas vezes.
set -euo pipefail
PSQL=("$1" -h "$3" -p "$2" -d "$4" -U "$5" -v ON_ERROR_STOP=1 -q)
"${PSQL[@]}" <<'SQL'
INSERT INTO auth.users(id) VALUES ('d5310000-0000-4000-8000-000000000003');
INSERT INTO public.course_catalog(id,slug,title,short_description,category,level,is_published) VALUES ('c531-race','c531-race','Teste','Teste','grammar','A1',true);
INSERT INTO public.course_lessons(id,course_id,chapter_number,title) VALUES ('l531-race','c531-race',1,'Teste');
INSERT INTO public.course_units(id,lesson_id,order_index,text,translation_pt) VALUES ('u531-race','l531-race',1,'Test','Teste');
SQL
call() {
  "${PSQL[@]}" <<'SQL'
SELECT set_config('request.jwt.claim.sub','d5310000-0000-4000-8000-000000000003',false);
SELECT public.rpc_course_commit_practice(gen_random_uuid(),'review',NULL,'easy',now()-interval '1 minute',20,100,1,'[{"unit_id":"u531-race","attempts":1,"hint_count":0,"revealed":false}]'::jsonb,true);
SQL
}
call > /dev/null & first=$!
call > /dev/null & second=$!
wait "$first"
wait "$second"
"${PSQL[@]}" <<'SQL'
DO $$ BEGIN
IF (SELECT repetition_number FROM public.course_user_reviews WHERE user_id='d5310000-0000-4000-8000-000000000003' AND unit_id='u531-race')<>1 THEN RAISE EXCEPTION 'dupla promoção concorrente'; END IF;
IF (SELECT count(*) FROM public.course_practice_sessions WHERE user_id='d5310000-0000-4000-8000-000000000003')<>2 THEN RAISE EXCEPTION 'sessões não preservadas'; END IF;
END $$;
DELETE FROM auth.users WHERE id='d5310000-0000-4000-8000-000000000003';
DELETE FROM public.course_catalog WHERE id='c531-race';
SQL
printf '%s\n' 'course-review-method-concurrency: OK'
