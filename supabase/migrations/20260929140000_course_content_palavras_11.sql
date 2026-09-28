-- Gerado por scripts/generate-course-seed.mjs a partir de supabase/content/. Não editar à mão.

-- Conteúdo original: frases do cotidiano com tradução pt-BR, notas, grupos sintáticos e anotações por palavra.

INSERT INTO public.course_catalog (id, slug, title, short_description, long_description, level, category, order_index, track, track_order, is_core, is_published)
VALUES ('course-1000-words-a1', '1000-essential-words', '1000 Palavras Essenciais', 'As palavras mais usadas do inglês, por tema, com significado e frase de exemplo.', 'Vocabulário essencial organizado por temas do dia a dia. Você ouve, escreve a palavra e vê como ela aparece numa frase real.', 'A1', 'grammar', 11, 'fundamentos', 2, true, true)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description, level = EXCLUDED.level, category = EXCLUDED.category,
  order_index = EXCLUDED.order_index, track = EXCLUDED.track, track_order = EXCLUDED.track_order,
  is_core = EXCLUDED.is_core, is_published = EXCLUDED.is_published, updated_at = now();

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-41', 'course-1000-words-a1', 41, 'Preposições de lugar e tempo', 'Onde e quando.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-41-01', 'lesson-1000-words-a1-41', 1, 'word', 'in', 'em, dentro', '/ɪn/', '"In" + cidade, país, mês, ano.', '[]'::jsonb, '[{"surface":"in","pos":"preposition","ipa":"/ɪn/","gloss":"em, dentro de"}]'::jsonb, 'The keys are in my bag.', 'As chaves estão na minha bolsa.'),
  ('unit-1000-words-a1-41-02', 'lesson-1000-words-a1-41', 2, 'word', 'on', 'em cima, em', '/ɑːn/', '"On" + dia, data, rua, superfície.', '[]'::jsonb, '[{"surface":"on","pos":"preposition","ipa":"/ɑːn/","gloss":"em, sobre"}]'::jsonb, 'The book is on the table.', 'O livro está na mesa.'),
  ('unit-1000-words-a1-41-03', 'lesson-1000-words-a1-41', 3, 'word', 'at', 'em (ponto)', '/æt/', '"At" + hora, endereço, ponto.', '[]'::jsonb, '[{"surface":"at","pos":"preposition","ipa":"/æt/","gloss":"em, às"}]'::jsonb, 'I am at work.', 'Estou no trabalho.'),
  ('unit-1000-words-a1-41-04', 'lesson-1000-words-a1-41', 4, 'word', 'under', 'embaixo de', '/ˈʌndər/', NULL, '[]'::jsonb, '[{"surface":"under","pos":"preposition","ipa":"/ˈʌndər/","gloss":"no nome de, sob"}]'::jsonb, 'The cat is under the bed.', 'O gato está debaixo da cama.'),
  ('unit-1000-words-a1-41-05', 'lesson-1000-words-a1-41', 5, 'word', 'above', 'acima de', '/əˈbʌv/', NULL, '[]'::jsonb, '[{"surface":"above","pos":"preposition","ipa":"/əˈbʌv/","gloss":"acima de"}]'::jsonb, 'The clock is above the door.', 'O relógio fica acima da porta.'),
  ('unit-1000-words-a1-41-06', 'lesson-1000-words-a1-41', 6, 'word', 'below', 'abaixo de', '/bɪˈloʊ/', NULL, '[]'::jsonb, '[{"surface":"below","pos":"preposition","ipa":"/bɪˈloʊ/","gloss":"abaixo de"}]'::jsonb, 'The temperature is below zero.', 'A temperatura está abaixo de zero.'),
  ('unit-1000-words-a1-41-07', 'lesson-1000-words-a1-41', 7, 'word', 'between', 'entre', '/bɪˈtwiːn/', NULL, '[]'::jsonb, '[{"surface":"between","pos":"preposition","ipa":"/bɪˈtwiːn/","gloss":"entre"}]'::jsonb, 'Sit between us.', 'Sente entre nós.'),
  ('unit-1000-words-a1-41-08', 'lesson-1000-words-a1-41', 8, 'word', 'behind', 'atrás de', '/bɪˈhaɪnd/', NULL, '[]'::jsonb, '[{"surface":"behind","pos":"preposition","ipa":"/bɪˈhaɪnd/","gloss":"atrás"}]'::jsonb, 'The park is behind the school.', 'O parque fica atrás da escola.'),
  ('unit-1000-words-a1-41-09', 'lesson-1000-words-a1-41', 9, 'word', 'next', 'ao lado (next to)', '/nɛkst/', NULL, '[]'::jsonb, '[{"surface":"next","pos":"adjective","ipa":"/nɛkst/","gloss":"próximo"}]'::jsonb, 'The bank is next to the pharmacy.', 'O banco fica ao lado da farmácia.'),
  ('unit-1000-words-a1-41-10', 'lesson-1000-words-a1-41', 10, 'word', 'near', 'perto de', '/nɪr/', NULL, '[]'::jsonb, '[{"surface":"near","pos":"preposition","ipa":"/nɪr/","gloss":"perto de"}]'::jsonb, 'I live near here.', 'Moro perto daqui.'),
  ('unit-1000-words-a1-41-11', 'lesson-1000-words-a1-41', 11, 'word', 'inside', 'dentro', '/ˌɪnˈsaɪd/', NULL, '[]'::jsonb, '[{"surface":"inside","pos":"adverb","ipa":"/ˌɪnˈsaɪd/","gloss":"dentro"}]'::jsonb, 'Let''s wait inside.', 'Vamos esperar dentro.'),
  ('unit-1000-words-a1-41-12', 'lesson-1000-words-a1-41', 12, 'word', 'outside', 'fora', '/ˌaʊtˈsaɪd/', NULL, '[]'::jsonb, '[{"surface":"outside","pos":"adverb","ipa":"/ˌaʊtˈsaɪd/","gloss":"lá fora"}]'::jsonb, 'The kids are outside.', 'As crianças estão lá fora.'),
  ('unit-1000-words-a1-41-13', 'lesson-1000-words-a1-41', 13, 'word', 'before', 'antes de', '/bɪˈfɔːr/', NULL, '[]'::jsonb, '[{"surface":"before","pos":"adverb","ipa":"/bɪˈfɔːr/","gloss":"antes"}]'::jsonb, 'Call me before noon.', 'Me ligue antes do meio-dia.'),
  ('unit-1000-words-a1-41-14', 'lesson-1000-words-a1-41', 14, 'word', 'after', 'depois de', '/ˈæftər/', NULL, '[]'::jsonb, '[{"surface":"after","pos":"preposition","ipa":"/ˈæftər/","gloss":"depois de"}]'::jsonb, 'See you after class.', 'Te vejo depois da aula.'),
  ('unit-1000-words-a1-41-15', 'lesson-1000-words-a1-41', 15, 'word', 'during', 'durante', '/ˈdʊrɪŋ/', NULL, '[]'::jsonb, '[{"surface":"during","pos":"preposition","ipa":"/ˈdʊrɪŋ/","gloss":"durante"}]'::jsonb, 'No phones during the movie.', 'Sem celular durante o filme.'),
  ('unit-1000-words-a1-41-16', 'lesson-1000-words-a1-41', 16, 'word', 'until', 'até (tempo)', '/ənˈtɪl/', '"Until" é tempo; "up to" é quantidade.', '[]'::jsonb, '[{"surface":"until","pos":"conjunction","ipa":"/ənˈtɪl/","gloss":"até"}]'::jsonb, 'The store is open until nine.', 'A loja abre até as nove.'),
  ('unit-1000-words-a1-41-17', 'lesson-1000-words-a1-41', 17, 'word', 'since', 'desde', '/sɪns/', '"Since" + ponto de início; "for" + período.', '[]'::jsonb, '[{"surface":"since","pos":"preposition","ipa":"/sɪns/","gloss":"desde"}]'::jsonb, 'I have lived here since May.', 'Moro aqui desde maio.'),
  ('unit-1000-words-a1-41-18', 'lesson-1000-words-a1-41', 18, 'word', 'for', 'por, durante', '/fɔːr/', NULL, '[]'::jsonb, '[{"surface":"for","pos":"preposition","ipa":"/fɔːr/","gloss":"para, por"}]'::jsonb, 'I lived there for two years.', 'Morei lá por dois anos.'),
  ('unit-1000-words-a1-41-19', 'lesson-1000-words-a1-41', 19, 'word', 'from', 'de (origem)', '/frʌm/', NULL, '[]'::jsonb, '[{"surface":"from","pos":"preposition","ipa":"/frʌm/","gloss":"de (origem)"}]'::jsonb, 'I am from Brazil.', 'Sou do Brasil.'),
  ('unit-1000-words-a1-41-20', 'lesson-1000-words-a1-41', 20, 'word', 'to', 'para, até', '/tuː/', NULL, '[]'::jsonb, '[{"surface":"to","pos":"preposition","ipa":"/tuː/","gloss":"para, a"}]'::jsonb, 'I go to work by bus.', 'Vou de ônibus para o trabalho.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-42', 'course-1000-words-a1', 42, 'Conectores', 'Palavras que ligam ideias.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-42-01', 'lesson-1000-words-a1-42', 1, 'word', 'and', 'e', '/ænd/', NULL, '[]'::jsonb, '[{"surface":"and","pos":"conjunction","ipa":"/ænd/","gloss":"e"}]'::jsonb, 'Coffee and milk.', 'Café com leite.'),
  ('unit-1000-words-a1-42-02', 'lesson-1000-words-a1-42', 2, 'word', 'but', 'mas', '/bʌt/', NULL, '[]'::jsonb, '[{"surface":"but","pos":"conjunction","ipa":"/bʌt/","gloss":"mas"}]'::jsonb, 'It is small but nice.', 'É pequeno, mas legal.'),
  ('unit-1000-words-a1-42-03', 'lesson-1000-words-a1-42', 3, 'word', 'or', 'ou', '/ɔːr/', NULL, '[]'::jsonb, '[{"surface":"or","pos":"conjunction","ipa":"/ɔːr/","gloss":"ou"}]'::jsonb, 'Tea or coffee?', 'Chá ou café?'),
  ('unit-1000-words-a1-42-04', 'lesson-1000-words-a1-42', 4, 'word', 'so', 'então, por isso', '/soʊ/', NULL, '[]'::jsonb, '[{"surface":"so","pos":"adverb","ipa":"/soʊ/","gloss":"tão"}]'::jsonb, 'It was late, so I left.', 'Estava tarde, então fui embora.'),
  ('unit-1000-words-a1-42-05', 'lesson-1000-words-a1-42', 5, 'word', 'because', 'porque', '/bɪˈkɔːz/', NULL, '[]'::jsonb, '[{"surface":"because","pos":"conjunction","ipa":"/bɪˈkɔːz/","gloss":"porque"}]'::jsonb, 'I stayed because it rained.', 'Fiquei porque choveu.'),
  ('unit-1000-words-a1-42-06', 'lesson-1000-words-a1-42', 6, 'word', 'if', 'se', '/ɪf/', NULL, '[]'::jsonb, '[{"surface":"if","pos":"conjunction","ipa":"/ɪf/","gloss":"se"}]'::jsonb, 'Call me if you need help.', 'Me liga se precisar de ajuda.'),
  ('unit-1000-words-a1-42-07', 'lesson-1000-words-a1-42', 7, 'word', 'when', 'quando', '/wɛn/', NULL, '[]'::jsonb, '[{"surface":"when","pos":"conjunction","ipa":"/wɛn/","gloss":"quando"}]'::jsonb, 'Call me when you arrive.', 'Me liga quando chegar.'),
  ('unit-1000-words-a1-42-08', 'lesson-1000-words-a1-42', 8, 'word', 'while', 'enquanto', '/waɪl/', NULL, '[]'::jsonb, '[{"surface":"while","pos":"noun","ipa":"/waɪl/","gloss":"tempo (a while = um tempo)"}]'::jsonb, 'I read while I wait.', 'Leio enquanto espero.'),
  ('unit-1000-words-a1-42-09', 'lesson-1000-words-a1-42', 9, 'word', 'although', 'embora', '/ɔːlˈðoʊ/', NULL, '[]'::jsonb, '[{"surface":"although","pos":"conjunction","ipa":"/ɔːlˈðoʊ/","gloss":"embora"}]'::jsonb, 'Although it was cold, we went out.', 'Embora estivesse frio, saímos.'),
  ('unit-1000-words-a1-42-10', 'lesson-1000-words-a1-42', 10, 'word', 'however', 'no entanto', '/haʊˈɛvər/', NULL, '[]'::jsonb, '[{"surface":"however","pos":"adverb","ipa":"/haʊˈɛvər/","gloss":"no entanto, mesmo assim"}]'::jsonb, 'It is cheap. However, it is slow.', 'É barato. No entanto, é lento.'),
  ('unit-1000-words-a1-42-11', 'lesson-1000-words-a1-42', 11, 'word', 'also', 'também', '/ˈɔːlsoʊ/', '"Also" vem antes do verbo; "too" no fim da frase.', '[]'::jsonb, '[{"surface":"also","pos":"adverb","ipa":"/ˈɔːlsoʊ/","gloss":"também"}]'::jsonb, 'I also speak Spanish.', 'Também falo espanhol.'),
  ('unit-1000-words-a1-42-12', 'lesson-1000-words-a1-42', 12, 'word', 'too', 'também; demais', '/tuː/', NULL, '[]'::jsonb, '[{"surface":"too","pos":"adverb","ipa":"/tuː/","gloss":"demais"}]'::jsonb, 'I like it too.', 'Eu também gosto.'),
  ('unit-1000-words-a1-42-13', 'lesson-1000-words-a1-42', 13, 'word', 'then', 'então, depois', '/ðɛn/', NULL, '[]'::jsonb, '[{"surface":"then","pos":"adverb","ipa":"/ðɛn/","gloss":"então, depois"}]'::jsonb, 'First eat, then sleep.', 'Primeiro coma, depois durma.'),
  ('unit-1000-words-a1-42-14', 'lesson-1000-words-a1-42', 14, 'word', 'first', 'primeiro', '/fɜːrst/', NULL, '[]'::jsonb, '[{"surface":"first","pos":"adjective","ipa":"/fɜːrst/","gloss":"primeiro"}]'::jsonb, 'First, open the app.', 'Primeiro, abra o aplicativo.'),
  ('unit-1000-words-a1-42-15', 'lesson-1000-words-a1-42', 15, 'word', 'finally', 'por fim', '/ˈfaɪnəli/', NULL, '[]'::jsonb, '[{"surface":"finally","pos":"adverb","ipa":"/ˈfaɪnəli/","gloss":"finalmente"}]'::jsonb, 'Finally, click save.', 'Por fim, clique em salvar.'),
  ('unit-1000-words-a1-42-16', 'lesson-1000-words-a1-42', 16, 'word', 'maybe', 'talvez', '/ˈmeɪbi/', NULL, '[]'::jsonb, '[{"surface":"maybe","pos":"adverb","ipa":"/ˈmeɪbi/","gloss":"talvez"}]'::jsonb, 'Maybe tomorrow.', 'Talvez amanhã.'),
  ('unit-1000-words-a1-42-17', 'lesson-1000-words-a1-42', 17, 'word', 'actually', 'na verdade', '/ˈæktʃuəli/', 'Falso cognato: não é "atualmente".', '[]'::jsonb, '[{"surface":"actually","pos":"adverb","ipa":"/ˈæktʃuəli/","gloss":"na verdade"}]'::jsonb, 'Actually, I disagree.', 'Na verdade, discordo.'),
  ('unit-1000-words-a1-42-18', 'lesson-1000-words-a1-42', 18, 'word', 'anyway', 'enfim, de qualquer forma', '/ˈɛniweɪ/', NULL, '[]'::jsonb, '[{"surface":"anyway","pos":"adverb","ipa":"/ˈɛniweɪ/","gloss":"enfim, de qualquer forma"}]'::jsonb, 'Anyway, see you later.', 'Enfim, até mais.'),
  ('unit-1000-words-a1-42-19', 'lesson-1000-words-a1-42', 19, 'word', 'unless', 'a menos que', '/ənˈlɛs/', NULL, '[]'::jsonb, '[{"surface":"unless","pos":"conjunction","ipa":"/ənˈlɛs/","gloss":"a menos que"}]'::jsonb, 'I will go unless it rains.', 'Vou, a menos que chova.'),
  ('unit-1000-words-a1-42-20', 'lesson-1000-words-a1-42', 20, 'word', 'though', 'mas, porém (no fim)', '/ðoʊ/', 'No fim da frase, "though" = porém.', '[]'::jsonb, '[{"surface":"though","pos":"conjunction","ipa":"/ðoʊ/","gloss":"embora"}]'::jsonb, 'It is expensive. Good, though.', 'É caro. Mas é bom.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-43', 'course-1000-words-a1', 43, 'Palavras de pergunta', 'Quem, o quê, onde, quando, por quê, como.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-43-01', 'lesson-1000-words-a1-43', 1, 'word', 'what', 'o que, qual', '/wʌt/', NULL, '[]'::jsonb, '[{"surface":"what","pos":"pronoun","ipa":"/wʌt/","gloss":"o que, qual"}]'::jsonb, 'What is your name?', 'Qual é o seu nome?'),
  ('unit-1000-words-a1-43-02', 'lesson-1000-words-a1-43', 2, 'word', 'who', 'quem', '/huː/', NULL, '[]'::jsonb, '[{"surface":"who","pos":"pronoun","ipa":"/huː/","gloss":"quem"}]'::jsonb, 'Who is that?', 'Quem é aquele?'),
  ('unit-1000-words-a1-43-03', 'lesson-1000-words-a1-43', 3, 'word', 'where', 'onde', '/wɛr/', NULL, '[]'::jsonb, '[{"surface":"where","pos":"adverb","ipa":"/wɛr/","gloss":"onde"}]'::jsonb, 'Where do you live?', 'Onde você mora?'),
  ('unit-1000-words-a1-43-04', 'lesson-1000-words-a1-43', 4, 'word', 'when', 'quando', '/wɛn/', NULL, '[]'::jsonb, '[{"surface":"when","pos":"conjunction","ipa":"/wɛn/","gloss":"quando"}]'::jsonb, 'When is your birthday?', 'Quando é seu aniversário?'),
  ('unit-1000-words-a1-43-05', 'lesson-1000-words-a1-43', 5, 'word', 'why', 'por que', '/waɪ/', 'Resposta: "because…".', '[]'::jsonb, '[{"surface":"why","pos":"adverb","ipa":"/waɪ/","gloss":"por que"}]'::jsonb, 'Why are you late?', 'Por que você está atrasado?'),
  ('unit-1000-words-a1-43-06', 'lesson-1000-words-a1-43', 6, 'word', 'how', 'como', '/haʊ/', NULL, '[]'::jsonb, '[{"surface":"how","pos":"adverb","ipa":"/haʊ/","gloss":"como"}]'::jsonb, 'How are you?', 'Como vai?'),
  ('unit-1000-words-a1-43-07', 'lesson-1000-words-a1-43', 7, 'word', 'which', 'qual (entre opções)', '/wɪtʃ/', '"Which" = entre opções definidas; "what" = em aberto.', '[]'::jsonb, '[{"surface":"which","pos":"determiner","ipa":"/wɪtʃ/","gloss":"qual"}]'::jsonb, 'Which one do you want?', 'Qual você quer?'),
  ('unit-1000-words-a1-43-08', 'lesson-1000-words-a1-43', 8, 'word', 'whose', 'de quem', '/huːz/', NULL, '[]'::jsonb, '[{"surface":"whose","pos":"pronoun","ipa":"/huːz/","gloss":"de quem"}]'::jsonb, 'Whose phone is this?', 'De quem é este celular?'),
  ('unit-1000-words-a1-43-09', 'lesson-1000-words-a1-43', 9, 'word', 'much', 'quanto (incontável)', '/mʌtʃ/', '"How much" para preço e incontáveis.', '[]'::jsonb, '[{"surface":"much","pos":"adverb","ipa":"/mʌtʃ/","gloss":"quanto (how much)"}]'::jsonb, 'How much is it?', 'Quanto custa?'),
  ('unit-1000-words-a1-43-10', 'lesson-1000-words-a1-43', 10, 'word', 'many', 'quantos (contável)', '/ˈmɛni/', NULL, '[]'::jsonb, '[{"surface":"many","pos":"determiner","ipa":"/ˈmɛni/","gloss":"muitos (how many)"}]'::jsonb, 'How many people are coming?', 'Quantas pessoas vêm?'),
  ('unit-1000-words-a1-43-11', 'lesson-1000-words-a1-43', 11, 'word', 'long', 'quanto tempo', '/lɔːŋ/', NULL, '[]'::jsonb, '[{"surface":"long","pos":"adjective","ipa":"/lɔːŋ/","gloss":"longo, muito (tempo)"}]'::jsonb, 'How long is the movie?', 'Quanto tempo dura o filme?'),
  ('unit-1000-words-a1-43-12', 'lesson-1000-words-a1-43', 12, 'word', 'often', 'com que frequência', '/ˈɔːfən/', NULL, '[]'::jsonb, '[{"surface":"often","pos":"adverb","ipa":"/ˈɔːfən/","gloss":"frequentemente"}]'::jsonb, 'How often do you run?', 'Com que frequência você corre?'),
  ('unit-1000-words-a1-43-13', 'lesson-1000-words-a1-43', 13, 'word', 'far', 'quão longe', '/fɑːr/', NULL, '[]'::jsonb, '[{"surface":"far","pos":"adjective","ipa":"/fɑːr/","gloss":"longe"}]'::jsonb, 'How far is the beach?', 'Quão longe fica a praia?'),
  ('unit-1000-words-a1-43-14', 'lesson-1000-words-a1-43', 14, 'word', 'old', 'quantos anos', '/oʊld/', NULL, '[]'::jsonb, '[{"surface":"old","pos":"adjective","ipa":"/oʊld/","gloss":"velho; de idade"}]'::jsonb, 'How old are you?', 'Quantos anos você tem?'),
  ('unit-1000-words-a1-43-15', 'lesson-1000-words-a1-43', 15, 'word', 'kind', 'tipo', '/kaɪnd/', NULL, '[]'::jsonb, '[{"surface":"kind","pos":"adjective","ipa":"/kaɪnd/","gloss":"gentil"}]'::jsonb, 'What kind of music do you like?', 'Que tipo de música você gosta?'),
  ('unit-1000-words-a1-43-16', 'lesson-1000-words-a1-43', 16, 'word', 'time', 'que horas', '/taɪm/', NULL, '[]'::jsonb, '[{"surface":"time","pos":"noun","ipa":"/taɪm/","gloss":"vez; hora"}]'::jsonb, 'What time is it?', 'Que horas são?'),
  ('unit-1000-words-a1-43-17', 'lesson-1000-words-a1-43', 17, 'word', 'mean', 'significar', '/miːn/', NULL, '[]'::jsonb, '[{"surface":"mean","pos":"verb","ipa":"/miːn/","gloss":"significar, querer dizer"}]'::jsonb, 'What does this mean?', 'O que isso significa?'),
  ('unit-1000-words-a1-43-18', 'lesson-1000-words-a1-43', 18, 'word', 'about', 'que tal', '/əˈbaʊt/', '"What about…?" = que tal…?', '[]'::jsonb, '[{"surface":"about","pos":"preposition","ipa":"/əˈbaʊt/","gloss":"sobre"}]'::jsonb, 'What about pizza?', 'Que tal pizza?'),
  ('unit-1000-words-a1-43-19', 'lesson-1000-words-a1-43', 19, 'word', 'else', 'mais', '/ɛls/', NULL, '[]'::jsonb, '[{"surface":"else","pos":"adverb","ipa":"/ɛls/","gloss":"mais, outro"}]'::jsonb, 'What else?', 'O que mais?'),
  ('unit-1000-words-a1-43-20', 'lesson-1000-words-a1-43', 20, 'word', 'come', 'como assim', '/kʌm/', '"How come?" = por quê? (informal).', '[]'::jsonb, '[{"surface":"come","pos":"verb","ipa":"/kʌm/","gloss":"vir; vindo"}]'::jsonb, 'How come?', 'Como assim?')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-44', 'course-1000-words-a1', 44, 'Quantidades', 'Muito, pouco, algum, nenhum.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-44-01', 'lesson-1000-words-a1-44', 1, 'word', 'some', 'algum, um pouco', '/sʌm/', '"Some" em afirmativas e ofertas.', '[]'::jsonb, '[{"surface":"some","pos":"determiner","ipa":"/sʌm/","gloss":"algumas"}]'::jsonb, 'I need some water.', 'Preciso de um pouco de água.'),
  ('unit-1000-words-a1-44-02', 'lesson-1000-words-a1-44', 2, 'word', 'any', 'algum, nenhum', '/ˈɛni/', '"Any" em perguntas e negativas.', '[]'::jsonb, '[{"surface":"any","pos":"determiner","ipa":"/ˈɛni/","gloss":"algum, alguma"}]'::jsonb, 'Do you have any questions?', 'Vocês têm alguma pergunta?'),
  ('unit-1000-words-a1-44-03', 'lesson-1000-words-a1-44', 3, 'word', 'many', 'muitos (contável)', '/ˈmɛni/', NULL, '[]'::jsonb, '[{"surface":"many","pos":"determiner","ipa":"/ˈmɛni/","gloss":"muitos (how many)"}]'::jsonb, 'There are many people here.', 'Tem muita gente aqui.'),
  ('unit-1000-words-a1-44-04', 'lesson-1000-words-a1-44', 4, 'word', 'much', 'muito (incontável)', '/mʌtʃ/', NULL, '[]'::jsonb, '[{"surface":"much","pos":"adverb","ipa":"/mʌtʃ/","gloss":"quanto (how much)"}]'::jsonb, 'I don''t have much time.', 'Não tenho muito tempo.'),
  ('unit-1000-words-a1-44-05', 'lesson-1000-words-a1-44', 5, 'word', 'lot', 'muito (a lot of)', '/lɑːt/', '"A lot of" serve para contável e incontável.', '[]'::jsonb, '[{"surface":"lot","pos":"noun","ipa":"/lɑːt/","gloss":"muito (a lot)"}]'::jsonb, 'I have a lot of work.', 'Tenho muito trabalho.'),
  ('unit-1000-words-a1-44-06', 'lesson-1000-words-a1-44', 6, 'word', 'few', 'poucos (contável)', '/fjuː/', '"A few" = alguns; "few" = poucos (negativo).', '[]'::jsonb, '[{"surface":"few","pos":"determiner","ipa":"/fjuː/","gloss":"poucos"}]'::jsonb, 'I have a few friends here.', 'Tenho alguns amigos aqui.'),
  ('unit-1000-words-a1-44-07', 'lesson-1000-words-a1-44', 7, 'word', 'little', 'pouco (incontável)', '/ˈlɪtəl/', NULL, '[]'::jsonb, '[{"surface":"little","pos":"adjective","ipa":"/ˈlɪtəl/","gloss":"pouco, pequeno"}]'::jsonb, 'I speak a little English.', 'Falo um pouco de inglês.'),
  ('unit-1000-words-a1-44-08', 'lesson-1000-words-a1-44', 8, 'word', 'enough', 'suficiente', '/ɪˈnʌf/', NULL, '[]'::jsonb, '[{"surface":"enough","pos":"adverb","ipa":"/ɪˈnʌf/","gloss":"o bastante"}]'::jsonb, 'Do we have enough money?', 'Temos dinheiro suficiente?'),
  ('unit-1000-words-a1-44-09', 'lesson-1000-words-a1-44', 9, 'word', 'all', 'todos, tudo', '/ɔːl/', NULL, '[]'::jsonb, '[{"surface":"all","pos":"determiner","ipa":"/ɔːl/","gloss":"tudo, todos"}]'::jsonb, 'All my friends came.', 'Todos os meus amigos vieram.'),
  ('unit-1000-words-a1-44-10', 'lesson-1000-words-a1-44', 10, 'word', 'every', 'cada, todo', '/ˈɛvri/', '"Every" + singular: "every day".', '[]'::jsonb, '[{"surface":"every","pos":"determiner","ipa":"/ˈɛvri/","gloss":"todo, cada"}]'::jsonb, 'I run every day.', 'Corro todo dia.'),
  ('unit-1000-words-a1-44-11', 'lesson-1000-words-a1-44', 11, 'word', 'each', 'cada', '/iːtʃ/', NULL, '[]'::jsonb, '[{"surface":"each","pos":"determiner","ipa":"/iːtʃ/","gloss":"cada"}]'::jsonb, 'Each room has a bathroom.', 'Cada quarto tem banheiro.'),
  ('unit-1000-words-a1-44-12', 'lesson-1000-words-a1-44', 12, 'word', 'both', 'ambos', '/boʊθ/', NULL, '[]'::jsonb, '[{"surface":"both","pos":"determiner","ipa":"/boʊθ/","gloss":"ambos"}]'::jsonb, 'Both of them are doctors.', 'Os dois são médicos.'),
  ('unit-1000-words-a1-44-13', 'lesson-1000-words-a1-44', 13, 'word', 'none', 'nenhum', '/nʌn/', NULL, '[]'::jsonb, '[{"surface":"none","pos":"pronoun","ipa":"/nʌn/","gloss":"nenhum"}]'::jsonb, 'None of us knew.', 'Nenhum de nós sabia.'),
  ('unit-1000-words-a1-44-14', 'lesson-1000-words-a1-44', 14, 'word', 'more', 'mais', '/mɔːr/', NULL, '[]'::jsonb, '[{"surface":"more","pos":"determiner","ipa":"/mɔːr/","gloss":"mais"}]'::jsonb, 'I need more time.', 'Preciso de mais tempo.'),
  ('unit-1000-words-a1-44-15', 'lesson-1000-words-a1-44', 15, 'word', 'less', 'menos (incontável)', '/lɛs/', 'Com contáveis, o correto formal é "fewer".', '[]'::jsonb, '[{"surface":"less","pos":"determiner","ipa":"/lɛs/","gloss":"menos"}]'::jsonb, 'Eat less sugar.', 'Coma menos açúcar.'),
  ('unit-1000-words-a1-44-16', 'lesson-1000-words-a1-44', 16, 'word', 'most', 'a maioria', '/moʊst/', NULL, '[]'::jsonb, '[{"surface":"most","pos":"determiner","ipa":"/moʊst/","gloss":"o máximo, a maioria"}]'::jsonb, 'Most people agree.', 'A maioria das pessoas concorda.'),
  ('unit-1000-words-a1-44-17', 'lesson-1000-words-a1-44', 17, 'word', 'half', 'metade', '/hæf/', NULL, '[]'::jsonb, '[{"surface":"half","pos":"noun","ipa":"/hæf/","gloss":"metade, meio"}]'::jsonb, 'Half of the class was absent.', 'Metade da turma faltou.'),
  ('unit-1000-words-a1-44-18', 'lesson-1000-words-a1-44', 18, 'word', 'dozen', 'dúzia', '/ˈdʌzən/', NULL, '[]'::jsonb, '[{"surface":"dozen","pos":"noun","ipa":"/ˈdʌzən/","gloss":"dúzia"}]'::jsonb, 'A dozen eggs.', 'Uma dúzia de ovos.'),
  ('unit-1000-words-a1-44-19', 'lesson-1000-words-a1-44', 19, 'word', 'several', 'vários', '/ˈsɛvrəl/', NULL, '[]'::jsonb, '[{"surface":"several","pos":"determiner","ipa":"/ˈsɛvrəl/","gloss":"vários"}]'::jsonb, 'I tried several times.', 'Tentei várias vezes.'),
  ('unit-1000-words-a1-44-20', 'lesson-1000-words-a1-44', 20, 'word', 'nothing', 'nada', '/ˈnʌθɪŋ/', NULL, '[]'::jsonb, '[{"surface":"nothing","pos":"pronoun","ipa":"/ˈnʌθɪŋ/","gloss":"nada"}]'::jsonb, 'There is nothing in the fridge.', 'Não tem nada na geladeira.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;
