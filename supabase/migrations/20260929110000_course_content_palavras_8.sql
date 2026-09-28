-- Gerado por scripts/generate-course-seed.mjs a partir de supabase/content/. Não editar à mão.

-- Conteúdo original: frases do cotidiano com tradução pt-BR, notas, grupos sintáticos e anotações por palavra.

INSERT INTO public.course_catalog (id, slug, title, short_description, long_description, level, category, order_index, track, track_order, is_core, is_published)
VALUES ('course-1000-words-a1', '1000-essential-words', '1000 Palavras Essenciais', 'As palavras mais usadas do inglês, por tema, com significado e frase de exemplo.', 'Vocabulário essencial organizado por temas do dia a dia. Você ouve, escreve a palavra e vê como ela aparece numa frase real.', 'A1', 'grammar', 11, 'fundamentos', 2, true, true)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description, level = EXCLUDED.level, category = EXCLUDED.category,
  order_index = EXCLUDED.order_index, track = EXCLUDED.track, track_order = EXCLUDED.track_order,
  is_core = EXCLUDED.is_core, is_published = EXCLUDED.is_published, updated_at = now();

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-23', 'course-1000-words-a1', 23, 'Formas e tamanhos', 'Descrever forma, tamanho e medida.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-23-01', 'lesson-1000-words-a1-23', 1, 'word', 'big', 'grande', '/bɪɡ/', '"Big" é o mais comum; "large" é mais formal (tamanhos de roupa, bebida).', '[]'::jsonb, '[{"surface":"big","pos":"adjective","ipa":"/bɪɡ/","gloss":"grande"}]'::jsonb, 'That is a big house.', 'Aquela é uma casa grande.'),
  ('unit-1000-words-a1-23-02', 'lesson-1000-words-a1-23', 2, 'word', 'small', 'pequeno', '/smɔːl/', NULL, '[]'::jsonb, '[{"surface":"small","pos":"adjective","ipa":"/smɔːl/","gloss":"pequeno"}]'::jsonb, 'I want a small coffee.', 'Quero um café pequeno.'),
  ('unit-1000-words-a1-23-03', 'lesson-1000-words-a1-23', 3, 'word', 'tall', 'alto (pessoa, prédio)', '/tɔːl/', '"Tall" para pessoas e prédios; "high" para montanhas e altura do chão.', '[]'::jsonb, '[{"surface":"tall","pos":"adjective","ipa":"/tɔːl/","gloss":"alto"}]'::jsonb, 'He is very tall.', 'Ele é muito alto.'),
  ('unit-1000-words-a1-23-04', 'lesson-1000-words-a1-23', 4, 'word', 'short', 'baixo; curto', '/ʃɔːrt/', 'Pessoa baixa = "short"; cabelo curto = "short hair".', '[]'::jsonb, '[{"surface":"short","pos":"adjective","ipa":"/ʃɔːrt/","gloss":"curto"}]'::jsonb, 'She has short hair.', 'Ela tem cabelo curto.'),
  ('unit-1000-words-a1-23-05', 'lesson-1000-words-a1-23', 5, 'word', 'long', 'comprido, longo', '/lɔːŋ/', NULL, '[]'::jsonb, '[{"surface":"long","pos":"adjective","ipa":"/lɔːŋ/","gloss":"longo, muito (tempo)"}]'::jsonb, 'It was a long day.', 'Foi um dia longo.'),
  ('unit-1000-words-a1-23-06', 'lesson-1000-words-a1-23', 6, 'word', 'wide', 'largo', '/waɪd/', NULL, '[]'::jsonb, '[{"surface":"wide","pos":"adverb","ipa":"/waɪd/","gloss":"bem aberto, largo"}]'::jsonb, 'The street is very wide.', 'A rua é muito larga.'),
  ('unit-1000-words-a1-23-07', 'lesson-1000-words-a1-23', 7, 'word', 'narrow', 'estreito', '/ˈnæroʊ/', NULL, '[]'::jsonb, '[{"surface":"narrow","pos":"adjective","ipa":"/ˈnæroʊ/","gloss":"estreito"}]'::jsonb, 'This road is too narrow.', 'Esta rua é estreita demais.'),
  ('unit-1000-words-a1-23-08', 'lesson-1000-words-a1-23', 8, 'word', 'round', 'redondo', '/raʊnd/', NULL, '[]'::jsonb, '[{"surface":"round","pos":"adjective","ipa":"/raʊnd/","gloss":"redondo; ida e volta"}]'::jsonb, 'We have a round table.', 'Temos uma mesa redonda.'),
  ('unit-1000-words-a1-23-09', 'lesson-1000-words-a1-23', 9, 'word', 'square', 'quadrado', '/skwɛr/', NULL, '[]'::jsonb, '[{"surface":"square","pos":"noun","ipa":"/skwɛr/","gloss":"praça"}]'::jsonb, 'The box is square.', 'A caixa é quadrada.'),
  ('unit-1000-words-a1-23-10', 'lesson-1000-words-a1-23', 10, 'word', 'flat', 'plano; apartamento (UK)', '/flæt/', 'No Reino Unido "flat" também é apartamento.', '[]'::jsonb, '[{"surface":"flat","pos":"adjective","ipa":"/flæt/","gloss":"plano; apartamento (UK)"}]'::jsonb, 'The land here is flat.', 'O terreno aqui é plano.'),
  ('unit-1000-words-a1-23-11', 'lesson-1000-words-a1-23', 11, 'word', 'heavy', 'pesado', '/ˈhɛvi/', NULL, '[]'::jsonb, '[{"surface":"heavy","pos":"adjective","ipa":"/ˈhɛvi/","gloss":"pesado"}]'::jsonb, 'This bag is heavy.', 'Esta bolsa está pesada.'),
  ('unit-1000-words-a1-23-12', 'lesson-1000-words-a1-23', 12, 'word', 'light', 'leve', '/laɪt/', '"Light" também é claro (cor) e luz.', '[]'::jsonb, '[{"surface":"light","pos":"adjective","ipa":"/laɪt/","gloss":"claro"}]'::jsonb, 'The laptop is very light.', 'O notebook é bem leve.'),
  ('unit-1000-words-a1-23-13', 'lesson-1000-words-a1-23', 13, 'word', 'thick', 'grosso', '/θɪk/', NULL, '[]'::jsonb, '[{"surface":"thick","pos":"adjective","ipa":"/θɪk/","gloss":"grosso"}]'::jsonb, 'I need a thick blanket.', 'Preciso de um cobertor grosso.'),
  ('unit-1000-words-a1-23-14', 'lesson-1000-words-a1-23', 14, 'word', 'thin', 'fino, magro', '/θɪn/', NULL, '[]'::jsonb, '[{"surface":"thin","pos":"adjective","ipa":"/θɪn/","gloss":"fino, magro"}]'::jsonb, 'The walls are thin.', 'As paredes são finas.'),
  ('unit-1000-words-a1-23-15', 'lesson-1000-words-a1-23', 15, 'word', 'huge', 'enorme', '/hjuːdʒ/', NULL, '[]'::jsonb, '[{"surface":"huge","pos":"adjective","ipa":"/hjuːdʒ/","gloss":"enorme"}]'::jsonb, 'The stadium is huge.', 'O estádio é enorme.'),
  ('unit-1000-words-a1-23-16', 'lesson-1000-words-a1-23', 16, 'word', 'tiny', 'minúsculo', '/ˈtaɪni/', NULL, '[]'::jsonb, '[{"surface":"tiny","pos":"adjective","ipa":"/ˈtaɪni/","gloss":"minúsculo"}]'::jsonb, 'The kitchen is tiny.', 'A cozinha é minúscula.'),
  ('unit-1000-words-a1-23-17', 'lesson-1000-words-a1-23', 17, 'word', 'size', 'tamanho', '/saɪz/', NULL, '[]'::jsonb, '[{"surface":"size","pos":"noun","ipa":"/saɪz/","gloss":"tamanho"}]'::jsonb, 'What size do you need?', 'De que tamanho você precisa?'),
  ('unit-1000-words-a1-23-18', 'lesson-1000-words-a1-23', 18, 'word', 'shape', 'forma', '/ʃeɪp/', NULL, '[]'::jsonb, '[{"surface":"shape","pos":"noun","ipa":"/ʃeɪp/","gloss":"forma"}]'::jsonb, 'I like the shape of this vase.', 'Gosto da forma deste vaso.'),
  ('unit-1000-words-a1-23-19', 'lesson-1000-words-a1-23', 19, 'word', 'half', 'metade', '/hæf/', NULL, '[]'::jsonb, '[{"surface":"half","pos":"noun","ipa":"/hæf/","gloss":"metade, meio"}]'::jsonb, 'Cut it in half.', 'Corte ao meio.'),
  ('unit-1000-words-a1-23-20', 'lesson-1000-words-a1-23', 20, 'word', 'empty', 'vazio', '/ˈɛmpti/', 'Oposto: "full" (cheio).', '[]'::jsonb, '[{"surface":"empty","pos":"adjective","ipa":"/ˈɛmpti/","gloss":"vazio"}]'::jsonb, 'The fridge is empty.', 'A geladeira está vazia.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-24', 'course-1000-words-a1', 24, 'Aparência', 'Descrever pessoas: cabelo, corpo, idade.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-24-01', 'lesson-1000-words-a1-24', 1, 'word', 'beautiful', 'bonito, lindo', '/ˈbjuːtɪfəl/', NULL, '[]'::jsonb, '[{"surface":"beautiful","pos":"adjective","ipa":"/ˈbjuːtɪfəl/","gloss":"bonito, lindo"}]'::jsonb, 'What a beautiful day!', 'Que dia lindo!'),
  ('unit-1000-words-a1-24-02', 'lesson-1000-words-a1-24', 2, 'word', 'pretty', 'bonita', '/ˈprɪti/', '"Pretty" também é advérbio: "pretty good" = bem bom.', '[]'::jsonb, '[{"surface":"pretty","pos":"adverb","ipa":"/ˈprɪti/","gloss":"bem, bastante"}]'::jsonb, 'She has a pretty smile.', 'Ela tem um sorriso bonito.'),
  ('unit-1000-words-a1-24-03', 'lesson-1000-words-a1-24', 3, 'word', 'handsome', 'bonito (homem)', '/ˈhænsəm/', NULL, '[]'::jsonb, '[{"surface":"handsome","pos":"adjective","ipa":"/ˈhænsəm/","gloss":"bonito (homem)"}]'::jsonb, 'He is a handsome man.', 'Ele é um homem bonito.'),
  ('unit-1000-words-a1-24-04', 'lesson-1000-words-a1-24', 4, 'word', 'ugly', 'feio', '/ˈʌɡli/', NULL, '[]'::jsonb, '[{"surface":"ugly","pos":"adjective","ipa":"/ˈʌɡli/","gloss":"feio"}]'::jsonb, 'That building is ugly.', 'Aquele prédio é feio.'),
  ('unit-1000-words-a1-24-05', 'lesson-1000-words-a1-24', 5, 'word', 'young', 'jovem', '/jʌŋ/', NULL, '[]'::jsonb, '[{"surface":"young","pos":"adjective","ipa":"/jʌŋ/","gloss":"jovem"}]'::jsonb, 'She looks young for her age.', 'Ela parece jovem para a idade.'),
  ('unit-1000-words-a1-24-06', 'lesson-1000-words-a1-24', 6, 'word', 'old', 'velho, idoso', '/oʊld/', 'Para pessoas, "elderly" é mais educado.', '[]'::jsonb, '[{"surface":"old","pos":"adjective","ipa":"/oʊld/","gloss":"velho; de idade"}]'::jsonb, 'My dog is getting old.', 'Meu cachorro está ficando velho.'),
  ('unit-1000-words-a1-24-07', 'lesson-1000-words-a1-24', 7, 'word', 'blond', 'loiro', '/blɑːnd/', NULL, '[]'::jsonb, '[{"surface":"blond","pos":"adjective","ipa":"/blɑːnd/","gloss":"loiro"}]'::jsonb, 'He has blond hair.', 'Ele tem cabelo loiro.'),
  ('unit-1000-words-a1-24-08', 'lesson-1000-words-a1-24', 8, 'word', 'curly', 'cacheado', '/ˈkɜːrli/', 'Liso = "straight"; ondulado = "wavy".', '[]'::jsonb, '[{"surface":"curly","pos":"adjective","ipa":"/ˈkɜːrli/","gloss":"cacheado"}]'::jsonb, 'Her hair is curly.', 'O cabelo dela é cacheado.'),
  ('unit-1000-words-a1-24-09', 'lesson-1000-words-a1-24', 9, 'word', 'bald', 'careca', '/bɔːld/', NULL, '[]'::jsonb, '[{"surface":"bald","pos":"adjective","ipa":"/bɔːld/","gloss":"careca"}]'::jsonb, 'My father is bald.', 'Meu pai é careca.'),
  ('unit-1000-words-a1-24-10', 'lesson-1000-words-a1-24', 10, 'word', 'beard', 'barba', '/bɪrd/', NULL, '[]'::jsonb, '[{"surface":"beard","pos":"noun","ipa":"/bɪrd/","gloss":"barba"}]'::jsonb, 'He grew a beard.', 'Ele deixou a barba crescer.'),
  ('unit-1000-words-a1-24-11', 'lesson-1000-words-a1-24', 11, 'word', 'slim', 'magro (elogio)', '/slɪm/', '"Slim" é elogioso; "skinny" pode soar negativo.', '[]'::jsonb, '[{"surface":"slim","pos":"adjective","ipa":"/slɪm/","gloss":"magro"}]'::jsonb, 'She is tall and slim.', 'Ela é alta e magra.'),
  ('unit-1000-words-a1-24-12', 'lesson-1000-words-a1-24', 12, 'word', 'overweight', 'acima do peso', '/ˌoʊvərˈweɪt/', 'Mais neutro e educado que "fat".', '[]'::jsonb, '[{"surface":"overweight","pos":"adjective","ipa":"/ˌoʊvərˈweɪt/","gloss":"acima do peso"}]'::jsonb, 'The doctor said I am overweight.', 'O médico disse que estou acima do peso.'),
  ('unit-1000-words-a1-24-13', 'lesson-1000-words-a1-24', 13, 'word', 'glasses', 'óculos', '/ˈɡlæsɪz/', NULL, '[]'::jsonb, '[{"surface":"glasses","pos":"noun","ipa":"/ˈɡlæsɪz/","gloss":"óculos"}]'::jsonb, 'She wears glasses.', 'Ela usa óculos.'),
  ('unit-1000-words-a1-24-14', 'lesson-1000-words-a1-24', 14, 'word', 'tattoo', 'tatuagem', '/tæˈtuː/', NULL, '[]'::jsonb, '[{"surface":"tattoo","pos":"noun","ipa":"/tæˈtuː/","gloss":"tatuagem"}]'::jsonb, 'He has a tattoo on his arm.', 'Ele tem uma tatuagem no braço.'),
  ('unit-1000-words-a1-24-15', 'lesson-1000-words-a1-24', 15, 'word', 'eyes', 'olhos', '/aɪz/', NULL, '[]'::jsonb, '[{"surface":"eyes","pos":"noun","ipa":"/aɪz/","gloss":"olhos"}]'::jsonb, 'She has green eyes.', 'Ela tem olhos verdes.'),
  ('unit-1000-words-a1-24-16', 'lesson-1000-words-a1-24', 16, 'word', 'smile', 'sorriso', '/smaɪl/', NULL, '[]'::jsonb, '[{"surface":"smile","pos":"noun","ipa":"/smaɪl/","gloss":"sorriso"}]'::jsonb, 'I love your smile.', 'Adoro seu sorriso.'),
  ('unit-1000-words-a1-24-17', 'lesson-1000-words-a1-24', 17, 'word', 'height', 'altura', '/haɪt/', NULL, '[]'::jsonb, '[{"surface":"height","pos":"noun","ipa":"/haɪt/","gloss":"altura"}]'::jsonb, 'What is your height?', 'Qual é a sua altura?'),
  ('unit-1000-words-a1-24-18', 'lesson-1000-words-a1-24', 18, 'word', 'look', 'parecer; aparência', '/lʊk/', '"Look like" + substantivo = parecer com: "You look like your dad".', '[]'::jsonb, '[{"surface":"look","pos":"noun","ipa":"/lʊk/","gloss":"olhada"}]'::jsonb, 'You look tired.', 'Você parece cansado.'),
  ('unit-1000-words-a1-24-19', 'lesson-1000-words-a1-24', 19, 'word', 'similar', 'parecido', '/ˈsɪmələr/', NULL, '[]'::jsonb, '[{"surface":"similar","pos":"adjective","ipa":"/ˈsɪmələr/","gloss":"parecido"}]'::jsonb, 'They look very similar.', 'Eles são muito parecidos.'),
  ('unit-1000-words-a1-24-20', 'lesson-1000-words-a1-24', 20, 'word', 'cute', 'fofo', '/kjuːt/', NULL, '[]'::jsonb, '[{"surface":"cute","pos":"adjective","ipa":"/kjuːt/","gloss":"fofo"}]'::jsonb, 'What a cute baby!', 'Que bebê fofo!')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-25', 'course-1000-words-a1', 25, 'Personalidade', 'Como as pessoas são.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-25-01', 'lesson-1000-words-a1-25', 1, 'word', 'friendly', 'simpático', '/ˈfrɛndli/', 'Parece advérbio por causa do "-ly", mas é adjetivo.', '[]'::jsonb, '[{"surface":"friendly","pos":"adjective","ipa":"/ˈfrɛndli/","gloss":"simpático"}]'::jsonb, 'The staff is very friendly.', 'A equipe é muito simpática.'),
  ('unit-1000-words-a1-25-02', 'lesson-1000-words-a1-25', 2, 'word', 'kind', 'gentil', '/kaɪnd/', NULL, '[]'::jsonb, '[{"surface":"kind","pos":"adjective","ipa":"/kaɪnd/","gloss":"gentil"}]'::jsonb, 'That is very kind of you.', 'Muita gentileza sua.'),
  ('unit-1000-words-a1-25-03', 'lesson-1000-words-a1-25', 3, 'word', 'funny', 'engraçado', '/ˈfʌni/', NULL, '[]'::jsonb, '[{"surface":"funny","pos":"adjective","ipa":"/ˈfʌni/","gloss":"engraçado"}]'::jsonb, 'My uncle is really funny.', 'Meu tio é muito engraçado.'),
  ('unit-1000-words-a1-25-04', 'lesson-1000-words-a1-25', 4, 'word', 'shy', 'tímido', '/ʃaɪ/', NULL, '[]'::jsonb, '[{"surface":"shy","pos":"adjective","ipa":"/ʃaɪ/","gloss":"tímido"}]'::jsonb, 'He is shy at first.', 'Ele é tímido no começo.'),
  ('unit-1000-words-a1-25-05', 'lesson-1000-words-a1-25', 5, 'word', 'lazy', 'preguiçoso', '/ˈleɪzi/', NULL, '[]'::jsonb, '[{"surface":"lazy","pos":"adjective","ipa":"/ˈleɪzi/","gloss":"preguiçoso"}]'::jsonb, 'Don''t be lazy.', 'Não seja preguiçoso.'),
  ('unit-1000-words-a1-25-06', 'lesson-1000-words-a1-25', 6, 'word', 'smart', 'inteligente', '/smɑːrt/', 'EUA: "smart" = inteligente; no Reino Unido também é "elegante".', '[]'::jsonb, '[{"surface":"smart","pos":"adjective","ipa":"/smɑːrt/","gloss":"inteligente"}]'::jsonb, 'She is a smart student.', 'Ela é uma aluna inteligente.'),
  ('unit-1000-words-a1-25-07', 'lesson-1000-words-a1-25', 7, 'word', 'honest', 'honesto, sincero', '/ˈɑːnɪst/', 'O "h" é mudo: "an honest man".', '[]'::jsonb, '[{"surface":"honest","pos":"adjective","ipa":"/ˈɑːnɪst/","gloss":"sincero, honesto"}]'::jsonb, 'Be honest with me.', 'Seja sincero comigo.'),
  ('unit-1000-words-a1-25-08', 'lesson-1000-words-a1-25', 8, 'word', 'patient', 'paciente', '/ˈpeɪʃənt/', NULL, '[]'::jsonb, '[{"surface":"patient","pos":"adjective","ipa":"/ˈpeɪʃənt/","gloss":"paciente"}]'::jsonb, 'Teachers need to be patient.', 'Professores precisam ser pacientes.'),
  ('unit-1000-words-a1-25-09', 'lesson-1000-words-a1-25', 9, 'word', 'rude', 'grosso, mal-educado', '/ruːd/', NULL, '[]'::jsonb, '[{"surface":"rude","pos":"adjective","ipa":"/ruːd/","gloss":"grosso, mal-educado"}]'::jsonb, 'That was rude.', 'Isso foi grosseiro.'),
  ('unit-1000-words-a1-25-10', 'lesson-1000-words-a1-25', 10, 'word', 'polite', 'educado', '/pəˈlaɪt/', 'Falso cognato: "polite" = educado, não "polido".', '[]'::jsonb, '[{"surface":"polite","pos":"adjective","ipa":"/pəˈlaɪt/","gloss":"educado"}]'::jsonb, 'Always be polite.', 'Seja sempre educado.'),
  ('unit-1000-words-a1-25-11', 'lesson-1000-words-a1-25', 11, 'word', 'generous', 'generoso', '/ˈdʒɛnərəs/', NULL, '[]'::jsonb, '[{"surface":"generous","pos":"adjective","ipa":"/ˈdʒɛnərəs/","gloss":"generoso"}]'::jsonb, 'My grandmother is very generous.', 'Minha avó é muito generosa.'),
  ('unit-1000-words-a1-25-12', 'lesson-1000-words-a1-25', 12, 'word', 'selfish', 'egoísta', '/ˈsɛlfɪʃ/', NULL, '[]'::jsonb, '[{"surface":"selfish","pos":"adjective","ipa":"/ˈsɛlfɪʃ/","gloss":"egoísta"}]'::jsonb, 'Don''t be selfish.', 'Não seja egoísta.'),
  ('unit-1000-words-a1-25-13', 'lesson-1000-words-a1-25', 13, 'word', 'brave', 'corajoso', '/breɪv/', NULL, '[]'::jsonb, '[{"surface":"brave","pos":"adjective","ipa":"/breɪv/","gloss":"corajoso"}]'::jsonb, 'You were very brave.', 'Você foi muito corajoso.'),
  ('unit-1000-words-a1-25-14', 'lesson-1000-words-a1-25', 14, 'word', 'quiet', 'quieto, calado', '/ˈkwaɪət/', 'Não confunda com "quite" (bastante).', '[]'::jsonb, '[{"surface":"quiet","pos":"adjective","ipa":"/ˈkwaɪət/","gloss":"quieto"}]'::jsonb, 'He is a quiet person.', 'Ele é uma pessoa quieta.'),
  ('unit-1000-words-a1-25-15', 'lesson-1000-words-a1-25', 15, 'word', 'outgoing', 'extrovertido', '/ˈaʊtɡoʊɪŋ/', NULL, '[]'::jsonb, '[{"surface":"outgoing","pos":"adjective","ipa":"/ˈaʊtɡoʊɪŋ/","gloss":"extrovertido"}]'::jsonb, 'She is very outgoing.', 'Ela é muito extrovertida.'),
  ('unit-1000-words-a1-25-16', 'lesson-1000-words-a1-25', 16, 'word', 'hardworking', 'trabalhador', '/ˌhɑːrdˈwɜːrkɪŋ/', NULL, '[]'::jsonb, '[{"surface":"hardworking","pos":"adjective","ipa":"/ˌhɑːrdˈwɜːrkɪŋ/","gloss":"trabalhador"}]'::jsonb, 'He is honest and hardworking.', 'Ele é honesto e trabalhador.'),
  ('unit-1000-words-a1-25-17', 'lesson-1000-words-a1-25', 17, 'word', 'stubborn', 'teimoso', '/ˈstʌbərn/', NULL, '[]'::jsonb, '[{"surface":"stubborn","pos":"adjective","ipa":"/ˈstʌbərn/","gloss":"teimoso"}]'::jsonb, 'My brother is stubborn.', 'Meu irmão é teimoso.'),
  ('unit-1000-words-a1-25-18', 'lesson-1000-words-a1-25', 18, 'word', 'sensible', 'sensato', '/ˈsɛnsəbəl/', 'Falso cognato: "sensible" = sensato; sensível = "sensitive".', '[]'::jsonb, '[{"surface":"sensible","pos":"adjective","ipa":"/ˈsɛnsəbəl/","gloss":"sensato"}]'::jsonb, 'That is a sensible idea.', 'É uma ideia sensata.'),
  ('unit-1000-words-a1-25-19', 'lesson-1000-words-a1-25', 19, 'word', 'reliable', 'confiável', '/rɪˈlaɪəbəl/', NULL, '[]'::jsonb, '[{"surface":"reliable","pos":"adjective","ipa":"/rɪˈlaɪəbəl/","gloss":"confiável"}]'::jsonb, 'I need a reliable car.', 'Preciso de um carro confiável.'),
  ('unit-1000-words-a1-25-20', 'lesson-1000-words-a1-25', 20, 'word', 'nice', 'legal, gentil', '/naɪs/', NULL, '[]'::jsonb, '[{"surface":"nice","pos":"adjective","ipa":"/naɪs/","gloss":"prazer; legal"}]'::jsonb, 'Your parents are really nice.', 'Seus pais são muito legais.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-26', 'course-1000-words-a1', 26, 'Móveis e objetos da casa', 'O que tem em cada cômodo.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-26-01', 'lesson-1000-words-a1-26', 1, 'word', 'bed', 'cama', '/bɛd/', NULL, '[]'::jsonb, '[{"surface":"bed","pos":"noun","ipa":"/bɛd/","gloss":"cama"}]'::jsonb, 'I make my bed every day.', 'Arrumo a cama todo dia.'),
  ('unit-1000-words-a1-26-02', 'lesson-1000-words-a1-26', 2, 'word', 'chair', 'cadeira', '/tʃɛr/', NULL, '[]'::jsonb, '[{"surface":"chair","pos":"noun","ipa":"/tʃɛr/","gloss":"cadeira"}]'::jsonb, 'Pull up a chair.', 'Puxa uma cadeira.'),
  ('unit-1000-words-a1-26-03', 'lesson-1000-words-a1-26', 3, 'word', 'table', 'mesa', '/ˈteɪbəl/', NULL, '[]'::jsonb, '[{"surface":"table","pos":"noun","ipa":"/ˈteɪbəl/","gloss":"mesa"}]'::jsonb, 'Dinner is on the table.', 'O jantar está na mesa.'),
  ('unit-1000-words-a1-26-04', 'lesson-1000-words-a1-26', 4, 'word', 'desk', 'escrivaninha', '/dɛsk/', '"Desk" = mesa de trabalho; "table" = mesa de refeição.', '[]'::jsonb, '[{"surface":"desk","pos":"noun","ipa":"/dɛsk/","gloss":"escrivaninha"}]'::jsonb, 'I work at my desk.', 'Trabalho na minha escrivaninha.'),
  ('unit-1000-words-a1-26-05', 'lesson-1000-words-a1-26', 5, 'word', 'sofa', 'sofá', '/ˈsoʊfə/', NULL, '[]'::jsonb, '[{"surface":"sofa","pos":"noun","ipa":"/ˈsoʊfə/","gloss":"sofá"}]'::jsonb, 'The cat sleeps on the sofa.', 'O gato dorme no sofá.'),
  ('unit-1000-words-a1-26-06', 'lesson-1000-words-a1-26', 6, 'word', 'closet', 'armário, closet', '/ˈklɑːzɪt/', 'Reino Unido: "wardrobe".', '[]'::jsonb, '[{"surface":"closet","pos":"noun","ipa":"/ˈklɑːzɪt/","gloss":"armário, closet"}]'::jsonb, 'My clothes are in the closet.', 'Minhas roupas estão no armário.'),
  ('unit-1000-words-a1-26-07', 'lesson-1000-words-a1-26', 7, 'word', 'shelf', 'prateleira', '/ʃɛlf/', 'Plural: "shelves".', '[]'::jsonb, '[{"surface":"shelf","pos":"noun","ipa":"/ʃɛlf/","gloss":"prateleira"}]'::jsonb, 'Put it on the top shelf.', 'Coloque na prateleira de cima.'),
  ('unit-1000-words-a1-26-08', 'lesson-1000-words-a1-26', 8, 'word', 'mirror', 'espelho', '/ˈmɪrər/', NULL, '[]'::jsonb, '[{"surface":"mirror","pos":"noun","ipa":"/ˈmɪrər/","gloss":"espelho"}]'::jsonb, 'Look in the mirror.', 'Olhe no espelho.'),
  ('unit-1000-words-a1-26-09', 'lesson-1000-words-a1-26', 9, 'word', 'carpet', 'tapete, carpete', '/ˈkɑːrpɪt/', NULL, '[]'::jsonb, '[{"surface":"carpet","pos":"noun","ipa":"/ˈkɑːrpɪt/","gloss":"tapete, carpete"}]'::jsonb, 'We have a new carpet.', 'Temos um tapete novo.'),
  ('unit-1000-words-a1-26-10', 'lesson-1000-words-a1-26', 10, 'word', 'curtains', 'cortinas', '/ˈkɜːrtənz/', NULL, '[]'::jsonb, '[{"surface":"curtains","pos":"noun","ipa":"/ˈkɜːrtənz/","gloss":"cortinas"}]'::jsonb, 'Close the curtains, please.', 'Feche as cortinas, por favor.'),
  ('unit-1000-words-a1-26-11', 'lesson-1000-words-a1-26', 11, 'word', 'lamp', 'luminária', '/læmp/', NULL, '[]'::jsonb, '[{"surface":"lamp","pos":"noun","ipa":"/læmp/","gloss":"luminária"}]'::jsonb, 'Turn on the lamp.', 'Acenda a luminária.'),
  ('unit-1000-words-a1-26-12', 'lesson-1000-words-a1-26', 12, 'word', 'pillow', 'travesseiro', '/ˈpɪloʊ/', NULL, '[]'::jsonb, '[{"surface":"pillow","pos":"noun","ipa":"/ˈpɪloʊ/","gloss":"travesseiro"}]'::jsonb, 'I need a softer pillow.', 'Preciso de um travesseiro mais macio.'),
  ('unit-1000-words-a1-26-13', 'lesson-1000-words-a1-26', 13, 'word', 'blanket', 'cobertor', '/ˈblæŋkɪt/', NULL, '[]'::jsonb, '[{"surface":"blanket","pos":"noun","ipa":"/ˈblæŋkɪt/","gloss":"cobertor"}]'::jsonb, 'It is cold, take a blanket.', 'Está frio, pegue um cobertor.'),
  ('unit-1000-words-a1-26-14', 'lesson-1000-words-a1-26', 14, 'word', 'drawer', 'gaveta', '/drɔːr/', NULL, '[]'::jsonb, '[{"surface":"drawer","pos":"noun","ipa":"/drɔːr/","gloss":"gaveta"}]'::jsonb, 'The keys are in the drawer.', 'As chaves estão na gaveta.'),
  ('unit-1000-words-a1-26-15', 'lesson-1000-words-a1-26', 15, 'word', 'door', 'porta', '/dɔːr/', NULL, '[]'::jsonb, '[{"surface":"door","pos":"noun","ipa":"/dɔːr/","gloss":"porta"}]'::jsonb, 'Close the door behind you.', 'Feche a porta ao sair.'),
  ('unit-1000-words-a1-26-16', 'lesson-1000-words-a1-26', 16, 'word', 'window', 'janela', '/ˈwɪndoʊ/', NULL, '[]'::jsonb, '[{"surface":"window","pos":"noun","ipa":"/ˈwɪndoʊ/","gloss":"janela"}]'::jsonb, 'Open the window, it is hot.', 'Abra a janela, está quente.'),
  ('unit-1000-words-a1-26-17', 'lesson-1000-words-a1-26', 17, 'word', 'light', 'luz', '/laɪt/', NULL, '[]'::jsonb, '[{"surface":"light","pos":"adjective","ipa":"/laɪt/","gloss":"claro"}]'::jsonb, 'Turn off the light.', 'Apague a luz.'),
  ('unit-1000-words-a1-26-18', 'lesson-1000-words-a1-26', 18, 'word', 'fan', 'ventilador', '/fæn/', '"Fan" também é fã.', '[]'::jsonb, '[{"surface":"fan","pos":"noun","ipa":"/fæn/","gloss":"fã"}]'::jsonb, 'Turn on the fan.', 'Liga o ventilador.'),
  ('unit-1000-words-a1-26-19', 'lesson-1000-words-a1-26', 19, 'word', 'clock', 'relógio (de parede)', '/klɑːk/', NULL, '[]'::jsonb, '[{"surface":"clock","pos":"noun","ipa":"/klɑːk/","gloss":"relógio (de parede)"}]'::jsonb, 'The clock is fast.', 'O relógio está adiantado.'),
  ('unit-1000-words-a1-26-20', 'lesson-1000-words-a1-26', 20, 'word', 'furniture', 'móveis', '/ˈfɜːrnɪtʃər/', 'Incontável: "a piece of furniture" = um móvel.', '[]'::jsonb, '[{"surface":"furniture","pos":"noun","ipa":"/ˈfɜːrnɪtʃər/","gloss":"móveis"}]'::jsonb, 'We bought new furniture.', 'Compramos móveis novos.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-27', 'course-1000-words-a1', 27, 'Cozinha e utensílios', 'Objetos e verbos da cozinha.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-27-01', 'lesson-1000-words-a1-27', 1, 'word', 'kitchen', 'cozinha', '/ˈkɪtʃən/', NULL, '[]'::jsonb, '[{"surface":"kitchen","pos":"noun","ipa":"/ˈkɪtʃən/","gloss":"cozinha"}]'::jsonb, 'Dinner is in the kitchen.', 'O jantar está na cozinha.'),
  ('unit-1000-words-a1-27-02', 'lesson-1000-words-a1-27', 2, 'word', 'fridge', 'geladeira', '/frɪdʒ/', NULL, '[]'::jsonb, '[{"surface":"fridge","pos":"noun","ipa":"/frɪdʒ/","gloss":"geladeira"}]'::jsonb, 'Put the milk in the fridge.', 'Coloque o leite na geladeira.'),
  ('unit-1000-words-a1-27-03', 'lesson-1000-words-a1-27', 3, 'word', 'freezer', 'congelador', '/ˈfriːzər/', NULL, '[]'::jsonb, '[{"surface":"freezer","pos":"noun","ipa":"/ˈfriːzər/","gloss":"congelador"}]'::jsonb, 'The ice cream is in the freezer.', 'O sorvete está no congelador.'),
  ('unit-1000-words-a1-27-04', 'lesson-1000-words-a1-27', 4, 'word', 'stove', 'fogão', '/stoʊv/', NULL, '[]'::jsonb, '[{"surface":"stove","pos":"noun","ipa":"/stoʊv/","gloss":"fogão"}]'::jsonb, 'The soup is on the stove.', 'A sopa está no fogão.'),
  ('unit-1000-words-a1-27-05', 'lesson-1000-words-a1-27', 5, 'word', 'oven', 'forno', '/ˈʌvən/', NULL, '[]'::jsonb, '[{"surface":"oven","pos":"noun","ipa":"/ˈʌvən/","gloss":"forno"}]'::jsonb, 'Bake it in the oven.', 'Asse no forno.'),
  ('unit-1000-words-a1-27-06', 'lesson-1000-words-a1-27', 6, 'word', 'microwave', 'micro-ondas', '/ˈmaɪkrəweɪv/', NULL, '[]'::jsonb, '[{"surface":"microwave","pos":"noun","ipa":"/ˈmaɪkrəweɪv/","gloss":"micro-ondas"}]'::jsonb, 'Heat it in the microwave.', 'Esquenta no micro-ondas.'),
  ('unit-1000-words-a1-27-07', 'lesson-1000-words-a1-27', 7, 'word', 'pan', 'frigideira, panela', '/pæn/', NULL, '[]'::jsonb, '[{"surface":"pan","pos":"noun","ipa":"/pæn/","gloss":"frigideira"}]'::jsonb, 'Heat the oil in a pan.', 'Esquente o óleo na frigideira.'),
  ('unit-1000-words-a1-27-08', 'lesson-1000-words-a1-27', 8, 'word', 'pot', 'panela funda', '/pɑːt/', NULL, '[]'::jsonb, '[{"surface":"pot","pos":"noun","ipa":"/pɑːt/","gloss":"panela"}]'::jsonb, 'Boil water in a big pot.', 'Ferva água numa panela grande.'),
  ('unit-1000-words-a1-27-09', 'lesson-1000-words-a1-27', 9, 'word', 'plate', 'prato', '/pleɪt/', NULL, '[]'::jsonb, '[{"surface":"plate","pos":"noun","ipa":"/pleɪt/","gloss":"prato"}]'::jsonb, 'Pass me a plate.', 'Me passa um prato.'),
  ('unit-1000-words-a1-27-10', 'lesson-1000-words-a1-27', 10, 'word', 'bowl', 'tigela', '/boʊl/', NULL, '[]'::jsonb, '[{"surface":"bowl","pos":"noun","ipa":"/boʊl/","gloss":"tigela"}]'::jsonb, 'A bowl of soup, please.', 'Uma tigela de sopa, por favor.'),
  ('unit-1000-words-a1-27-11', 'lesson-1000-words-a1-27', 11, 'word', 'cup', 'xícara', '/kʌp/', NULL, '[]'::jsonb, '[{"surface":"cup","pos":"noun","ipa":"/kʌp/","gloss":"xícara"}]'::jsonb, 'A cup of tea?', 'Uma xícara de chá?'),
  ('unit-1000-words-a1-27-12', 'lesson-1000-words-a1-27', 12, 'word', 'glass', 'copo', '/ɡlæs/', NULL, '[]'::jsonb, '[{"surface":"glass","pos":"noun","ipa":"/ɡlæs/","gloss":"taça, copo"}]'::jsonb, 'A glass of water.', 'Um copo de água.'),
  ('unit-1000-words-a1-27-13', 'lesson-1000-words-a1-27', 13, 'word', 'fork', 'garfo', '/fɔːrk/', NULL, '[]'::jsonb, '[{"surface":"fork","pos":"noun","ipa":"/fɔːrk/","gloss":"garfo"}]'::jsonb, 'I need a fork.', 'Preciso de um garfo.'),
  ('unit-1000-words-a1-27-14', 'lesson-1000-words-a1-27', 14, 'word', 'knife', 'faca', '/naɪf/', NULL, '[]'::jsonb, '[{"surface":"knife","pos":"noun","ipa":"/naɪf/","gloss":"faca"}]'::jsonb, 'Be careful with the knife.', 'Cuidado com a faca.'),
  ('unit-1000-words-a1-27-15', 'lesson-1000-words-a1-27', 15, 'word', 'spoon', 'colher', '/spuːn/', NULL, '[]'::jsonb, '[{"surface":"spoon","pos":"noun","ipa":"/spuːn/","gloss":"colher"}]'::jsonb, 'A spoon of sugar.', 'Uma colher de açúcar.'),
  ('unit-1000-words-a1-27-16', 'lesson-1000-words-a1-27', 16, 'word', 'napkin', 'guardanapo', '/ˈnæpkɪn/', NULL, '[]'::jsonb, '[{"surface":"napkin","pos":"noun","ipa":"/ˈnæpkɪn/","gloss":"guardanapo"}]'::jsonb, 'Can I have a napkin?', 'Pode me dar um guardanapo?'),
  ('unit-1000-words-a1-27-17', 'lesson-1000-words-a1-27', 17, 'word', 'sink', 'pia', '/sɪŋk/', NULL, '[]'::jsonb, '[{"surface":"sink","pos":"noun","ipa":"/sɪŋk/","gloss":"pia"}]'::jsonb, 'The dishes are in the sink.', 'A louça está na pia.'),
  ('unit-1000-words-a1-27-18', 'lesson-1000-words-a1-27', 18, 'word', 'cook', 'cozinhar', '/kʊk/', '"Cook" também é cozinheiro.', '[]'::jsonb, '[{"surface":"cook","pos":"noun","ipa":"/kʊk/","gloss":"cozinheiro"}]'::jsonb, 'I cook dinner every night.', 'Faço o jantar toda noite.'),
  ('unit-1000-words-a1-27-19', 'lesson-1000-words-a1-27', 19, 'word', 'bake', 'assar', '/beɪk/', '"Bake" = assar no forno (bolo, pão).', '[]'::jsonb, '[{"surface":"bake","pos":"verb","ipa":"/beɪk/","gloss":"assar"}]'::jsonb, 'She bakes bread on Sundays.', 'Ela faz pão aos domingos.'),
  ('unit-1000-words-a1-27-20', 'lesson-1000-words-a1-27', 20, 'word', 'fry', 'fritar', '/fraɪ/', NULL, '[]'::jsonb, '[{"surface":"fry","pos":"verb","ipa":"/fraɪ/","gloss":"fritar"}]'::jsonb, 'Fry the eggs for two minutes.', 'Frite os ovos por dois minutos.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-28', 'course-1000-words-a1', 28, 'Banheiro e higiene', 'Objetos do banheiro e cuidados pessoais.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-28-01', 'lesson-1000-words-a1-28', 1, 'word', 'bathroom', 'banheiro', '/ˈbæθruːm/', NULL, '[]'::jsonb, '[{"surface":"bathroom","pos":"noun","ipa":"/ˈbæθruːm/","gloss":"banheiro"}]'::jsonb, 'Where is the bathroom?', 'Onde fica o banheiro?'),
  ('unit-1000-words-a1-28-02', 'lesson-1000-words-a1-28', 2, 'word', 'shower', 'chuveiro, banho', '/ˈʃaʊər/', NULL, '[]'::jsonb, '[{"surface":"shower","pos":"noun","ipa":"/ˈʃaʊər/","gloss":"banho de chuveiro"}]'::jsonb, 'I take a shower every morning.', 'Tomo banho toda manhã.'),
  ('unit-1000-words-a1-28-03', 'lesson-1000-words-a1-28', 3, 'word', 'bathtub', 'banheira', '/ˈbæθtʌb/', NULL, '[]'::jsonb, '[{"surface":"bathtub","pos":"noun","ipa":"/ˈbæθtʌb/","gloss":"banheira"}]'::jsonb, 'The hotel room has a bathtub.', 'O quarto do hotel tem banheira.'),
  ('unit-1000-words-a1-28-04', 'lesson-1000-words-a1-28', 4, 'word', 'toilet', 'vaso sanitário; banheiro', '/ˈtɔɪlət/', 'No Reino Unido "toilet" também é o banheiro.', '[]'::jsonb, '[{"surface":"toilet","pos":"noun","ipa":"/ˈtɔɪlət/","gloss":"vaso sanitário"}]'::jsonb, 'The toilet is broken.', 'O vaso está quebrado.'),
  ('unit-1000-words-a1-28-05', 'lesson-1000-words-a1-28', 5, 'word', 'towel', 'toalha', '/ˈtaʊəl/', NULL, '[]'::jsonb, '[{"surface":"towel","pos":"noun","ipa":"/ˈtaʊəl/","gloss":"toalha"}]'::jsonb, 'Can I have a clean towel?', 'Pode me dar uma toalha limpa?'),
  ('unit-1000-words-a1-28-06', 'lesson-1000-words-a1-28', 6, 'word', 'soap', 'sabonete', '/soʊp/', NULL, '[]'::jsonb, '[{"surface":"soap","pos":"noun","ipa":"/soʊp/","gloss":"sabonete"}]'::jsonb, 'We need more soap.', 'Precisamos de mais sabonete.'),
  ('unit-1000-words-a1-28-07', 'lesson-1000-words-a1-28', 7, 'word', 'shampoo', 'xampu', '/ʃæmˈpuː/', NULL, '[]'::jsonb, '[{"surface":"shampoo","pos":"noun","ipa":"/ʃæmˈpuː/","gloss":"xampu"}]'::jsonb, 'This shampoo smells good.', 'Este xampu tem cheiro bom.'),
  ('unit-1000-words-a1-28-08', 'lesson-1000-words-a1-28', 8, 'word', 'toothbrush', 'escova de dentes', '/ˈtuːθbrʌʃ/', NULL, '[]'::jsonb, '[{"surface":"toothbrush","pos":"noun","ipa":"/ˈtuːθbrʌʃ/","gloss":"escova de dentes"}]'::jsonb, 'I forgot my toothbrush.', 'Esqueci a escova de dentes.'),
  ('unit-1000-words-a1-28-09', 'lesson-1000-words-a1-28', 9, 'word', 'toothpaste', 'pasta de dente', '/ˈtuːθpeɪst/', NULL, '[]'::jsonb, '[{"surface":"toothpaste","pos":"noun","ipa":"/ˈtuːθpeɪst/","gloss":"pasta de dente"}]'::jsonb, 'We are out of toothpaste.', 'Acabou a pasta de dente.'),
  ('unit-1000-words-a1-28-10', 'lesson-1000-words-a1-28', 10, 'word', 'comb', 'pente', '/koʊm/', 'O "b" é mudo: /koʊm/.', '[]'::jsonb, '[{"surface":"comb","pos":"noun","ipa":"/koʊm/","gloss":"pente"}]'::jsonb, 'Do you have a comb?', 'Você tem um pente?'),
  ('unit-1000-words-a1-28-11', 'lesson-1000-words-a1-28', 11, 'word', 'brush', 'escova', '/brʌʃ/', NULL, '[]'::jsonb, '[{"surface":"brush","pos":"verb","ipa":"/brʌʃ/","gloss":"escovar"}]'::jsonb, 'I need a hair brush.', 'Preciso de uma escova de cabelo.'),
  ('unit-1000-words-a1-28-12', 'lesson-1000-words-a1-28', 12, 'word', 'razor', 'barbeador, lâmina', '/ˈreɪzər/', NULL, '[]'::jsonb, '[{"surface":"razor","pos":"noun","ipa":"/ˈreɪzər/","gloss":"barbeador"}]'::jsonb, 'He uses an electric razor.', 'Ele usa barbeador elétrico.'),
  ('unit-1000-words-a1-28-13', 'lesson-1000-words-a1-28', 13, 'word', 'deodorant', 'desodorante', '/diˈoʊdərənt/', NULL, '[]'::jsonb, '[{"surface":"deodorant","pos":"noun","ipa":"/diˈoʊdərənt/","gloss":"desodorante"}]'::jsonb, 'Don''t forget your deodorant.', 'Não esqueça o desodorante.'),
  ('unit-1000-words-a1-28-14', 'lesson-1000-words-a1-28', 14, 'word', 'mirror', 'espelho', '/ˈmɪrər/', NULL, '[]'::jsonb, '[{"surface":"mirror","pos":"noun","ipa":"/ˈmɪrər/","gloss":"espelho"}]'::jsonb, 'The bathroom mirror is foggy.', 'O espelho do banheiro está embaçado.'),
  ('unit-1000-words-a1-28-15', 'lesson-1000-words-a1-28', 15, 'word', 'tissues', 'lenços de papel', '/ˈtɪʃuːz/', NULL, '[]'::jsonb, '[{"surface":"tissues","pos":"noun","ipa":"/ˈtɪʃuːz/","gloss":"lenços de papel"}]'::jsonb, 'A box of tissues, please.', 'Uma caixa de lenços, por favor.'),
  ('unit-1000-words-a1-28-16', 'lesson-1000-words-a1-28', 16, 'word', 'wash', 'lavar', '/wɑːʃ/', NULL, '[]'::jsonb, '[{"surface":"wash","pos":"verb","ipa":"/wɑːʃ/","gloss":"lavar"}]'::jsonb, 'Wash your hands.', 'Lave as mãos.'),
  ('unit-1000-words-a1-28-17', 'lesson-1000-words-a1-28', 17, 'word', 'dry', 'secar; seco', '/draɪ/', NULL, '[]'::jsonb, '[{"surface":"dry","pos":"verb","ipa":"/draɪ/","gloss":"secar; seco"}]'::jsonb, 'Dry your hair.', 'Seque o cabelo.'),
  ('unit-1000-words-a1-28-18', 'lesson-1000-words-a1-28', 18, 'word', 'brush', 'escovar', '/brʌʃ/', '"Brush" é escova e escovar.', '[]'::jsonb, '[{"surface":"brush","pos":"verb","ipa":"/brʌʃ/","gloss":"escovar"}]'::jsonb, 'Brush your teeth before bed.', 'Escove os dentes antes de dormir.'),
  ('unit-1000-words-a1-28-19', 'lesson-1000-words-a1-28', 19, 'word', 'shave', 'barbear-se', '/ʃeɪv/', NULL, '[]'::jsonb, '[{"surface":"shave","pos":"verb","ipa":"/ʃeɪv/","gloss":"barbear-se"}]'::jsonb, 'He shaves every morning.', 'Ele faz a barba toda manhã.'),
  ('unit-1000-words-a1-28-20', 'lesson-1000-words-a1-28', 20, 'word', 'clean', 'limpo; limpar', '/kliːn/', 'Oposto: "dirty" (sujo).', '[]'::jsonb, '[{"surface":"clean","pos":"verb","ipa":"/kliːn/","gloss":"limpar"}]'::jsonb, 'The towels are clean.', 'As toalhas estão limpas.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;
