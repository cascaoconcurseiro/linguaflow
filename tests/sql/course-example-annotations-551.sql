-- #551: banco descartável; toda frase de exemplo tem palavra por palavra na ordem da frase, e nada mais mudou.
DO $$
DECLARE examples int; filled int; wrong int; missing_fields int;
BEGIN
  SELECT count(*), count(*) FILTER (WHERE example_annotations IS NOT NULL) INTO examples, filled FROM public.course_units WHERE example_en IS NOT NULL AND trim(example_en) <> '';
  IF examples <> 1100 OR filled <> examples THEN RAISE EXCEPTION 'exemplos sem palavra por palavra: % de %', examples - filled, examples; END IF;
  SELECT count(*) INTO wrong FROM public.course_units
   WHERE example_annotations IS NOT NULL AND jsonb_array_length(example_annotations) <> cardinality(regexp_split_to_array(trim(example_en), '\s+'));
  IF wrong > 0 THEN RAISE EXCEPTION '% exemplos com número de palavras diferente da frase', wrong; END IF;
  SELECT count(*) INTO missing_fields FROM public.course_units u, jsonb_array_elements(u.example_annotations) a
   WHERE coalesce(a->>'surface','') = '' OR coalesce(a->>'gloss','') = '' OR coalesce(a->>'ipa','') = '' OR coalesce(a->>'pos','') = '';
  IF missing_fields > 0 THEN RAISE EXCEPTION '% palavras de exemplo sem classe, IPA ou glosa', missing_fields; END IF;
  IF EXISTS (SELECT 1 FROM public.course_units WHERE example_en IS NULL AND example_annotations IS NOT NULL) THEN RAISE EXCEPTION 'anotação de exemplo em unidade sem exemplo'; END IF;
  IF (SELECT count(*) FROM public.course_units) <> 4704 THEN RAISE EXCEPTION 'a migration alterou o número de unidades'; END IF;
END $$;
