-- Gate #336: "Palavras que não estão fixando" dependem de a RPC real contar
-- esquecimentos e sinalizar leech. Percorre o ciclo que o aluno vive:
-- revisão -> "Errei" -> reaprende -> volta à revisão -> "Errei" de novo.

INSERT INTO auth.users (id) VALUES ('a9360000-0000-4000-8000-000000000001');
INSERT INTO public.user_stats (user_id) VALUES ('a9360000-0000-4000-8000-000000000001')
ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.words (id,user_id,word,category) VALUES
  ('b9360000-0000-4000-8000-000000000001','a9360000-0000-4000-8000-000000000001','forward','general'),
  ('b9360000-0000-4000-8000-000000000002','a9360000-0000-4000-8000-000000000001','gross','general');
INSERT INTO public.cards (id,user_id,word_id,status,reps,lapses,is_leech,interval,stability,difficulty,due_date,last_review) VALUES
  ('c9360000-0000-4000-8000-000000000001','a9360000-0000-4000-8000-000000000001','b9360000-0000-4000-8000-000000000001','review',3,0,false,4,4,5,now()-interval '1 day',now()-interval '5 days'),
  ('c9360000-0000-4000-8000-000000000002','a9360000-0000-4000-8000-000000000001','b9360000-0000-4000-8000-000000000002','new',0,0,false,0,NULL,NULL,now()-interval '1 day',NULL);
INSERT INTO public.settings(user_id,key,value) VALUES
  ('a9360000-0000-4000-8000-000000000001','leech_threshold','3'),
  ('a9360000-0000-4000-8000-000000000001','leech_action','tag'),
  ('a9360000-0000-4000-8000-000000000001','learning_steps','1'),
  ('a9360000-0000-4000-8000-000000000001','relearning_steps','1');

DO $$
DECLARE
  forward uuid := 'c9360000-0000-4000-8000-000000000001';
  gross uuid := 'c9360000-0000-4000-8000-000000000002';
  c public.cards;
  r jsonb;
  i integer;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','a9360000-0000-4000-8000-000000000001',false);

  FOR i IN 1..3 LOOP
    -- "Errei" numa palavra em revisão: conta um esquecimento.
    r := public.record_card_review(forward, 1::smallint, NULL::jsonb, gen_random_uuid());
    SELECT * INTO c FROM public.cards WHERE id = forward;
    IF c.lapses <> i THEN RAISE EXCEPTION 'esquecimento % não contado: lapses=% resp=%', i, c.lapses, r; END IF;
    IF c.status <> 'learning' OR coalesce(c.pre_lapse_interval,0) <= 0 THEN
      RAISE EXCEPTION 'esquecimento % não levou a reaprendizagem: %', i, to_jsonb(c);
    END IF;
    IF i < 3 AND c.is_leech THEN RAISE EXCEPTION 'sinalizada cedo demais (lapses=%)', i; END IF;
    IF c.suspended THEN RAISE EXCEPTION 'leech_action=tag não deve pausar a palavra'; END IF;

    EXIT WHEN i = 3;

    -- Passa o passo de reaprendizagem ("Bom") e a palavra volta à revisão.
    UPDATE public.cards SET due_date = now() - interval '1 minute' WHERE id = forward;
    r := public.record_card_review(forward, 3::smallint, NULL::jsonb, gen_random_uuid());
    SELECT * INTO c FROM public.cards WHERE id = forward;
    IF c.status NOT IN ('review','mature') THEN RAISE EXCEPTION 'reaprendizagem não voltou à revisão: %', to_jsonb(c); END IF;
    IF c.lapses <> i THEN RAISE EXCEPTION 'acerto não pode mudar esquecimentos: %', c.lapses; END IF;

    -- O tempo passa até a próxima revisão vencer.
    UPDATE public.cards SET due_date = now() - interval '1 minute' WHERE id = forward;
  END LOOP;

  IF NOT c.is_leech THEN RAISE EXCEPTION 'palavra com 3 esquecimentos (limite 3) não foi sinalizada: %', to_jsonb(c); END IF;

  -- Errar ainda na fase de aprendizado não é esquecimento (paridade Anki).
  r := public.record_card_review(gross, 1::smallint, NULL::jsonb, gen_random_uuid());
  UPDATE public.cards SET due_date = now() - interval '1 minute' WHERE id = gross;
  r := public.record_card_review(gross, 1::smallint, NULL::jsonb, gen_random_uuid());
  SELECT * INTO c FROM public.cards WHERE id = gross;
  IF c.lapses <> 0 OR c.is_leech THEN RAISE EXCEPTION 'erro na aprendizagem inicial contou como esquecimento: %', to_jsonb(c); END IF;
END $$;

-- leech_action=suspend: ao atingir o limite a palavra sai da fila sozinha.
UPDATE public.settings SET value='suspend'
 WHERE user_id='a9360000-0000-4000-8000-000000000001' AND key='leech_action';
UPDATE public.settings SET value='4'
 WHERE user_id='a9360000-0000-4000-8000-000000000001' AND key='leech_threshold';
UPDATE public.cards SET status='review', step_index=0, due_date=now()-interval '1 minute'
 WHERE id='c9360000-0000-4000-8000-000000000001';

DO $$
DECLARE c public.cards; r jsonb;
BEGIN
  PERFORM set_config('request.jwt.claim.sub','a9360000-0000-4000-8000-000000000001',false);
  r := public.record_card_review('c9360000-0000-4000-8000-000000000001'::uuid, 1::smallint, NULL::jsonb, gen_random_uuid());
  SELECT * INTO c FROM public.cards WHERE id='c9360000-0000-4000-8000-000000000001';
  IF c.lapses <> 4 OR NOT c.suspended THEN RAISE EXCEPTION 'leech_action=suspend não pausou no limite: %', to_jsonb(c); END IF;
END $$;

SELECT 'weak-words gate ok' AS result;
