-- Gerado por scripts/generate-course-seed.mjs a partir de supabase/content/. Não editar à mão.

-- Conteúdo original: frases do cotidiano com tradução pt-BR, notas, grupos sintáticos e anotações por palavra.

INSERT INTO public.course_catalog (id, slug, title, short_description, long_description, level, category, order_index, track, track_order, is_core, is_published)
VALUES ('course-1000-words-a1', '1000-essential-words', '1000 Palavras Essenciais', 'As palavras mais usadas do inglês, por tema, com significado e frase de exemplo.', 'Vocabulário essencial organizado por temas do dia a dia. Você ouve, escreve a palavra e vê como ela aparece numa frase real.', 'A1', 'grammar', 11, 'fundamentos', 2, true, true)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description, level = EXCLUDED.level, category = EXCLUDED.category,
  order_index = EXCLUDED.order_index, track = EXCLUDED.track, track_order = EXCLUDED.track_order,
  is_core = EXCLUDED.is_core, is_published = EXCLUDED.is_published, updated_at = now();

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-05', 'course-1000-words-a1', 5, 'Números de 21 em diante', 'Dezenas, centenas, milhares e ordinais.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-05-01', 'lesson-1000-words-a1-05', 1, 'word', 'twenty-one', 'vinte e um', '/ˌtwɛntiˈwʌn/', 'De 21 a 99 as dezenas levam hífen: twenty-one, forty-five.', '[]'::jsonb, '[{"surface":"twenty-one","pos":"numeral","ipa":"/ˌtwɛntiˈwʌn/","gloss":"vinte e um"}]'::jsonb, 'She''s twenty-one years old.', 'Ela tem vinte e um anos.'),
  ('unit-1000-words-a1-05-02', 'lesson-1000-words-a1-05', 2, 'word', 'thirty', 'trinta', '/ˈθɜːrti/', 'Força no começo: THIR-ty. Em "thirteen" (13) a força vai no fim.', '[]'::jsonb, '[{"surface":"thirty","pos":"numeral","ipa":"/ˈθɜːrti/","gloss":"trinta"}]'::jsonb, 'The trip takes thirty minutes.', 'A viagem leva trinta minutos.'),
  ('unit-1000-words-a1-05-03', 'lesson-1000-words-a1-05', 3, 'word', 'forty', 'quarenta', '/ˈfɔːrti/', 'Sem "u": forty, embora seja "four".', '[]'::jsonb, '[{"surface":"forty","pos":"numeral","ipa":"/ˈfɔːrti/","gloss":"quarenta"}]'::jsonb, 'I have forty emails.', 'Tenho quarenta e-mails.'),
  ('unit-1000-words-a1-05-04', 'lesson-1000-words-a1-05', 4, 'word', 'fifty', 'cinquenta', '/ˈfɪfti/', NULL, '[]'::jsonb, '[{"surface":"fifty","pos":"numeral","ipa":"/ˈfɪfti/","gloss":"cinquenta"}]'::jsonb, 'It costs fifty dollars.', 'Custa cinquenta dólares.'),
  ('unit-1000-words-a1-05-05', 'lesson-1000-words-a1-05', 5, 'word', 'sixty', 'sessenta', '/ˈsɪksti/', NULL, '[]'::jsonb, '[{"surface":"sixty","pos":"numeral","ipa":"/ˈsɪksti/","gloss":"sessenta"}]'::jsonb, 'There are sixty minutes in an hour.', 'Uma hora tem sessenta minutos.'),
  ('unit-1000-words-a1-05-06', 'lesson-1000-words-a1-05', 6, 'word', 'seventy', 'setenta', '/ˈsɛvənti/', NULL, '[]'::jsonb, '[{"surface":"seventy","pos":"numeral","ipa":"/ˈsɛvənti/","gloss":"setenta"}]'::jsonb, 'My grandfather is seventy.', 'Meu avô tem setenta anos.'),
  ('unit-1000-words-a1-05-07', 'lesson-1000-words-a1-05', 7, 'word', 'eighty', 'oitenta', '/ˈeɪti/', 'Só um "t": eighty.', '[]'::jsonb, '[{"surface":"eighty","pos":"numeral","ipa":"/ˈeɪti/","gloss":"oitenta"}]'::jsonb, 'The bus holds eighty people.', 'O ônibus leva oitenta pessoas.'),
  ('unit-1000-words-a1-05-08', 'lesson-1000-words-a1-05', 8, 'word', 'ninety', 'noventa', '/ˈnaɪnti/', 'Cuidado na grafia: "nine" perde o "e" em "ninety" (90). Não escreva "nineety".', '[]'::jsonb, '[{"surface":"ninety","pos":"numeral","ipa":"/ˈnaɪnti/","gloss":"noventa"}]'::jsonb, 'I got ninety percent.', 'Tirei noventa por cento.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;
