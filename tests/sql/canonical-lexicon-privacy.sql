-- #559: um aluno nunca recebe a frase de contexto enviada por outro. Só em Postgres descartável.
BEGIN;
GRANT USAGE ON SCHEMA auth TO authenticated;
INSERT INTO auth.users(id,email) VALUES
 ('00000000-0000-4000-8000-0000000005a1','lex-a@test.local'),
 ('00000000-0000-4000-8000-0000000005b2','lex-b@test.local');

-- Aluno A salva a palavra com uma frase pessoal.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000005a1',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000005a1","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := public.get_or_cache_canonical_lexicon('diary','en',
    '{"word_pt":"diário","word_phon":"/ˈdaɪəri/","context":{"sentence":"My secret diary is under the bed.","sentence_pt":"Meu diário secreto está debaixo da cama."}}'::jsonb);
  IF r->>'word_pt' IS DISTINCT FROM 'diário' THEN RAISE EXCEPTION 'A: palavra não gravada: %', r; END IF;
  IF jsonb_array_length(r->'contexts') <> 1 THEN RAISE EXCEPTION 'A: deve receber a própria frase: %', r; END IF;
END $$;
RESET ROLE;

-- Aluno B consulta e grava: recebe a palavra, nunca a frase de A.
SELECT set_config('request.jwt.claim.sub','00000000-0000-4000-8000-0000000005b2',true);
SELECT set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-0000000005b2","role":"authenticated"}',true);
SET LOCAL ROLE authenticated;
DO $$ DECLARE r jsonb; BEGIN
  r := public.get_canonical_lexicon('diary','en',null);
  IF r->>'word_pt' IS DISTINCT FROM 'diário' THEN RAISE EXCEPTION 'B: deve ver a tradução compartilhada: %', r; END IF;
  IF jsonb_array_length(r->'contexts') <> 0 THEN RAISE EXCEPTION 'B: vazou frase de A sem pedir: %', r; END IF;

  r := public.get_canonical_lexicon('diary','en','I write in my diary every night.');
  IF jsonb_array_length(r->'contexts') <> 0 THEN RAISE EXCEPTION 'B: vazou frase de A com outra frase: %', r; END IF;

  r := public.get_or_cache_canonical_lexicon('diary','en',
    '{"context":{"sentence":"I write in my diary every night.","sentence_pt":"Escrevo no meu diário toda noite."}}'::jsonb);
  IF jsonb_array_length(r->'contexts') <> 1 OR r->'contexts'->0->>'sentence' <> 'I write in my diary every night.' THEN
    RAISE EXCEPTION 'B: gravação devolveu frases de outros: %', r; END IF;

  -- A mesma frase (ex.: legenda do mesmo vídeo) continua aproveitando o cache, sem IA.
  r := public.get_canonical_lexicon('diary','en','  my secret diary is under the bed. ');
  IF jsonb_array_length(r->'contexts') <> 1 THEN RAISE EXCEPTION 'B: correspondência exata deve reaproveitar o cache: %', r; END IF;

  -- Leitura direta da tabela não é mais permitida.
  BEGIN
    PERFORM 1 FROM public.canonical_lexicon LIMIT 1;
    RAISE EXCEPTION 'B: leu a tabela diretamente';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  -- Funções internas não são chamáveis pelo aluno.
  BEGIN
    PERFORM private.canonical_lexicon_upsert('diary','en',null);
    RAISE EXCEPTION 'B: chamou a função interna';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- Sem usuário: as RPCs recusam.
SELECT set_config('request.jwt.claim.sub','',true);
SELECT set_config('request.jwt.claims','{"role":"anon"}',true);
DO $$ BEGIN
  BEGIN
    PERFORM public.get_canonical_lexicon('diary','en',null);
    RAISE EXCEPTION 'sem usuário: leitura aceita';
  EXCEPTION WHEN sqlstate '28000' THEN NULL;
  END;
END $$;

SELECT 'canonical-lexicon-privacy: OK' AS result;
ROLLBACK;
