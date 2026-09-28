-- Gerado por scripts/generate-course-seed.mjs a partir de supabase/content/. Não editar à mão.

-- Conteúdo original: frases do cotidiano com tradução pt-BR, notas, grupos sintáticos e anotações por palavra.

INSERT INTO public.course_catalog (id, slug, title, short_description, long_description, level, category, order_index, track, track_order, is_core, is_published)
VALUES ('course-1000-words-a1', '1000-essential-words', '1000 Palavras Essenciais', 'As palavras mais usadas do inglês, por tema, com significado e frase de exemplo.', 'Vocabulário essencial organizado por temas do dia a dia. Você ouve, escreve a palavra e vê como ela aparece numa frase real.', 'A1', 'grammar', 11, 'fundamentos', 2, true, true)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description, level = EXCLUDED.level, category = EXCLUDED.category,
  order_index = EXCLUDED.order_index, track = EXCLUDED.track, track_order = EXCLUDED.track_order,
  is_core = EXCLUDED.is_core, is_published = EXCLUDED.is_published, updated_at = now();

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-11', 'course-1000-words-a1', 11, 'Comida básica e refeições', 'O que se come no dia a dia e as refeições do dia.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-11-01', 'lesson-1000-words-a1-11', 1, 'word', 'breakfast', 'café da manhã', '/ˈbrɛkfəst/', '"Have breakfast/lunch/dinner" = tomar café, almoçar, jantar.', '[]'::jsonb, '[{"surface":"breakfast","pos":"noun","ipa":"/ˈbrɛkfəst/","gloss":"café da manhã"}]'::jsonb, 'I have breakfast at seven.', 'Tomo café da manhã às sete.'),
  ('unit-1000-words-a1-11-02', 'lesson-1000-words-a1-11', 2, 'word', 'lunch', 'almoço', '/lʌntʃ/', NULL, '[]'::jsonb, '[{"surface":"lunch","pos":"noun","ipa":"/lʌntʃ/","gloss":"almoço"}]'::jsonb, 'Let''s have lunch together.', 'Vamos almoçar juntos.'),
  ('unit-1000-words-a1-11-03', 'lesson-1000-words-a1-11', 3, 'word', 'dinner', 'jantar', '/ˈdɪnər/', NULL, '[]'::jsonb, '[{"surface":"dinner","pos":"noun","ipa":"/ˈdɪnər/","gloss":"jantar"}]'::jsonb, 'Dinner is ready.', 'O jantar está pronto.'),
  ('unit-1000-words-a1-11-04', 'lesson-1000-words-a1-11', 4, 'word', 'snack', 'lanche', '/snæk/', NULL, '[]'::jsonb, '[{"surface":"snack","pos":"noun","ipa":"/snæk/","gloss":"lanche"}]'::jsonb, 'I need a snack.', 'Preciso de um lanche.'),
  ('unit-1000-words-a1-11-05', 'lesson-1000-words-a1-11', 5, 'word', 'bread', 'pão', '/brɛd/', 'Incontável: "some bread", "a loaf of bread" (um pão inteiro).', '[]'::jsonb, '[{"surface":"bread","pos":"noun","ipa":"/brɛd/","gloss":"pão"}]'::jsonb, 'I buy fresh bread every day.', 'Compro pão fresco todo dia.'),
  ('unit-1000-words-a1-11-06', 'lesson-1000-words-a1-11', 6, 'word', 'rice', 'arroz', '/raɪs/', 'Incontável: "rice is".', '[]'::jsonb, '[{"surface":"rice","pos":"noun","ipa":"/raɪs/","gloss":"arroz"}]'::jsonb, 'Rice and beans, please.', 'Arroz e feijão, por favor.'),
  ('unit-1000-words-a1-11-07', 'lesson-1000-words-a1-11', 7, 'word', 'beans', 'feijão', '/biːnz/', 'Plural em inglês: "beans are".', '[]'::jsonb, '[{"surface":"beans","pos":"noun","ipa":"/biːnz/","gloss":"feijão"}]'::jsonb, 'Brazilians eat a lot of beans.', 'Brasileiros comem muito feijão.'),
  ('unit-1000-words-a1-11-08', 'lesson-1000-words-a1-11', 8, 'word', 'egg', 'ovo', '/ɛɡ/', NULL, '[]'::jsonb, '[{"surface":"egg","pos":"noun","ipa":"/ɛɡ/","gloss":"ovo"}]'::jsonb, 'I want two fried eggs.', 'Quero dois ovos fritos.'),
  ('unit-1000-words-a1-11-09', 'lesson-1000-words-a1-11', 9, 'word', 'meat', 'carne', '/miːt/', NULL, '[]'::jsonb, '[{"surface":"meat","pos":"noun","ipa":"/miːt/","gloss":"carne"}]'::jsonb, 'I don''t eat meat.', 'Eu não como carne.'),
  ('unit-1000-words-a1-11-10', 'lesson-1000-words-a1-11', 10, 'word', 'beef', 'carne de boi', '/biːf/', 'O animal é "cow"; a carne é "beef". Porco: "pig" / "pork".', '[]'::jsonb, '[{"surface":"beef","pos":"noun","ipa":"/biːf/","gloss":"carne de boi"}]'::jsonb, 'The beef is very tender.', 'A carne está muito macia.'),
  ('unit-1000-words-a1-11-11', 'lesson-1000-words-a1-11', 11, 'word', 'chicken', 'frango', '/ˈtʃɪkən/', NULL, '[]'::jsonb, '[{"surface":"chicken","pos":"noun","ipa":"/ˈtʃɪkən/","gloss":"frango"}]'::jsonb, 'Grilled chicken with salad.', 'Frango grelhado com salada.'),
  ('unit-1000-words-a1-11-12', 'lesson-1000-words-a1-11', 12, 'word', 'fish', 'peixe', '/fɪʃ/', 'Plural geralmente igual: "two fish".', '[]'::jsonb, '[{"surface":"fish","pos":"noun","ipa":"/fɪʃ/","gloss":"peixe"}]'::jsonb, 'The fish is fresh today.', 'O peixe está fresco hoje.'),
  ('unit-1000-words-a1-11-13', 'lesson-1000-words-a1-11', 13, 'word', 'cheese', 'queijo', '/tʃiːz/', NULL, '[]'::jsonb, '[{"surface":"cheese","pos":"noun","ipa":"/tʃiːz/","gloss":"queijo"}]'::jsonb, 'A cheese sandwich, please.', 'Um sanduíche de queijo, por favor.'),
  ('unit-1000-words-a1-11-14', 'lesson-1000-words-a1-11', 14, 'word', 'butter', 'manteiga', '/ˈbʌtər/', NULL, '[]'::jsonb, '[{"surface":"butter","pos":"noun","ipa":"/ˈbʌtər/","gloss":"manteiga"}]'::jsonb, 'Bread and butter.', 'Pão com manteiga.'),
  ('unit-1000-words-a1-11-15', 'lesson-1000-words-a1-11', 15, 'word', 'sugar', 'açúcar', '/ˈʃʊɡər/', 'O "s" soa "sh": /ˈʃʊɡər/.', '[]'::jsonb, '[{"surface":"sugar","pos":"noun","ipa":"/ˈʃʊɡər/","gloss":"açúcar"}]'::jsonb, 'No sugar, thanks.', 'Sem açúcar, obrigado.'),
  ('unit-1000-words-a1-11-16', 'lesson-1000-words-a1-11', 16, 'word', 'salt', 'sal', '/sɔːlt/', NULL, '[]'::jsonb, '[{"surface":"salt","pos":"noun","ipa":"/sɔːlt/","gloss":"sal"}]'::jsonb, 'Can you pass the salt?', 'Pode passar o sal?'),
  ('unit-1000-words-a1-11-17', 'lesson-1000-words-a1-11', 17, 'word', 'pepper', 'pimenta', '/ˈpɛpər/', '"Bell pepper" = pimentão.', '[]'::jsonb, '[{"surface":"pepper","pos":"noun","ipa":"/ˈpɛpər/","gloss":"pimenta; pimentão"}]'::jsonb, 'Salt and pepper.', 'Sal e pimenta.'),
  ('unit-1000-words-a1-11-18', 'lesson-1000-words-a1-11', 18, 'word', 'oil', 'óleo, azeite', '/ɔɪl/', 'Azeite de oliva = "olive oil".', '[]'::jsonb, '[{"surface":"oil","pos":"noun","ipa":"/ɔɪl/","gloss":"óleo, azeite"}]'::jsonb, 'Olive oil, please.', 'Azeite, por favor.'),
  ('unit-1000-words-a1-11-19', 'lesson-1000-words-a1-11', 19, 'word', 'soup', 'sopa', '/suːp/', NULL, '[]'::jsonb, '[{"surface":"soup","pos":"noun","ipa":"/suːp/","gloss":"sopa"}]'::jsonb, 'The soup is too hot.', 'A sopa está quente demais.'),
  ('unit-1000-words-a1-11-20', 'lesson-1000-words-a1-11', 20, 'word', 'sandwich', 'sanduíche', '/ˈsænwɪtʃ/', 'O "d" some na fala: /ˈsænwɪtʃ/.', '[]'::jsonb, '[{"surface":"sandwich","pos":"noun","ipa":"/ˈsænwɪtʃ/","gloss":"sanduíche"}]'::jsonb, 'I made a sandwich.', 'Fiz um sanduíche.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-12', 'course-1000-words-a1', 12, 'Frutas, legumes e verduras', 'Feira, mercado e salada.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-12-01', 'lesson-1000-words-a1-12', 1, 'word', 'fruit', 'fruta', '/fruːt/', 'Geralmente incontável: "some fruit".', '[]'::jsonb, '[{"surface":"fruit","pos":"noun","ipa":"/fruːt/","gloss":"fruta"}]'::jsonb, 'I eat fruit every day.', 'Como fruta todo dia.'),
  ('unit-1000-words-a1-12-02', 'lesson-1000-words-a1-12', 2, 'word', 'vegetables', 'legumes, verduras', '/ˈvɛdʒtəbəlz/', 'Pronúncia com 3 sílabas: VEJ-tuh-buls.', '[]'::jsonb, '[{"surface":"vegetables","pos":"noun","ipa":"/ˈvɛdʒtəbəlz/","gloss":"legumes, verduras"}]'::jsonb, 'Eat your vegetables.', 'Coma seus legumes.'),
  ('unit-1000-words-a1-12-03', 'lesson-1000-words-a1-12', 3, 'word', 'apple', 'maçã', '/ˈæpəl/', 'Começa com vogal: "an apple".', '[]'::jsonb, '[{"surface":"apple","pos":"noun","ipa":"/ˈæpəl/","gloss":"maçã"}]'::jsonb, 'An apple a day.', 'Uma maçã por dia.'),
  ('unit-1000-words-a1-12-04', 'lesson-1000-words-a1-12', 4, 'word', 'banana', 'banana', '/bəˈnænə/', NULL, '[]'::jsonb, '[{"surface":"banana","pos":"noun","ipa":"/bəˈnænə/","gloss":"banana"}]'::jsonb, 'Bananas are cheap here.', 'Banana é barata aqui.'),
  ('unit-1000-words-a1-12-05', 'lesson-1000-words-a1-12', 5, 'word', 'orange', 'laranja', '/ˈɔːrɪndʒ/', NULL, '[]'::jsonb, '[{"surface":"orange","pos":"adjective","ipa":"/ˈɔːrɪndʒ/","gloss":"laranja"}]'::jsonb, 'Fresh orange juice.', 'Suco de laranja natural.'),
  ('unit-1000-words-a1-12-06', 'lesson-1000-words-a1-12', 6, 'word', 'grapes', 'uvas', '/ɡreɪps/', NULL, '[]'::jsonb, '[{"surface":"grapes","pos":"noun","ipa":"/ɡreɪps/","gloss":"uvas"}]'::jsonb, 'A bunch of grapes.', 'Um cacho de uvas.'),
  ('unit-1000-words-a1-12-07', 'lesson-1000-words-a1-12', 7, 'word', 'strawberry', 'morango', '/ˈstrɔːbɛri/', NULL, '[]'::jsonb, '[{"surface":"strawberry","pos":"noun","ipa":"/ˈstrɔːbɛri/","gloss":"morango"}]'::jsonb, 'Strawberry ice cream.', 'Sorvete de morango.'),
  ('unit-1000-words-a1-12-08', 'lesson-1000-words-a1-12', 8, 'word', 'lemon', 'limão-siciliano', '/ˈlɛmən/', 'O limão verde comum no Brasil é "lime".', '[]'::jsonb, '[{"surface":"lemon","pos":"noun","ipa":"/ˈlɛmən/","gloss":"limão-siciliano"}]'::jsonb, 'Tea with lemon.', 'Chá com limão.'),
  ('unit-1000-words-a1-12-09', 'lesson-1000-words-a1-12', 9, 'word', 'lime', 'limão (taiti)', '/laɪm/', NULL, '[]'::jsonb, '[{"surface":"lime","pos":"noun","ipa":"/laɪm/","gloss":"limão (taiti)"}]'::jsonb, 'Add some lime juice.', 'Coloque um pouco de suco de limão.'),
  ('unit-1000-words-a1-12-10', 'lesson-1000-words-a1-12', 10, 'word', 'pineapple', 'abacaxi', '/ˈpaɪnæpəl/', NULL, '[]'::jsonb, '[{"surface":"pineapple","pos":"noun","ipa":"/ˈpaɪnæpəl/","gloss":"abacaxi"}]'::jsonb, 'Pineapple on pizza?', 'Abacaxi na pizza?'),
  ('unit-1000-words-a1-12-11', 'lesson-1000-words-a1-12', 11, 'word', 'watermelon', 'melancia', '/ˈwɔːtərmɛlən/', NULL, '[]'::jsonb, '[{"surface":"watermelon","pos":"noun","ipa":"/ˈwɔːtərmɛlən/","gloss":"melancia"}]'::jsonb, 'Watermelon is perfect in summer.', 'Melancia é perfeita no verão.'),
  ('unit-1000-words-a1-12-12', 'lesson-1000-words-a1-12', 12, 'word', 'mango', 'manga', '/ˈmæŋɡoʊ/', NULL, '[]'::jsonb, '[{"surface":"mango","pos":"noun","ipa":"/ˈmæŋɡoʊ/","gloss":"manga"}]'::jsonb, 'This mango is sweet.', 'Esta manga está doce.'),
  ('unit-1000-words-a1-12-13', 'lesson-1000-words-a1-12', 13, 'word', 'avocado', 'abacate', '/ˌævəˈkɑːdoʊ/', 'Nos EUA abacate é salgado: guacamole, torrada.', '[]'::jsonb, '[{"surface":"avocado","pos":"noun","ipa":"/ˌævəˈkɑːdoʊ/","gloss":"abacate"}]'::jsonb, 'Avocado toast.', 'Torrada com abacate.'),
  ('unit-1000-words-a1-12-14', 'lesson-1000-words-a1-12', 14, 'word', 'tomato', 'tomate', '/təˈmeɪtoʊ/', 'Plural: "tomatoes".', '[]'::jsonb, '[{"surface":"tomato","pos":"noun","ipa":"/təˈmeɪtoʊ/","gloss":"tomate"}]'::jsonb, 'Tomato sauce.', 'Molho de tomate.'),
  ('unit-1000-words-a1-12-15', 'lesson-1000-words-a1-12', 15, 'word', 'potato', 'batata', '/pəˈteɪtoʊ/', 'Plural: "potatoes".', '[]'::jsonb, '[{"surface":"potato","pos":"noun","ipa":"/pəˈteɪtoʊ/","gloss":"batata"}]'::jsonb, 'Mashed potatoes.', 'Purê de batata.'),
  ('unit-1000-words-a1-12-16', 'lesson-1000-words-a1-12', 16, 'word', 'onion', 'cebola', '/ˈʌnjən/', NULL, '[]'::jsonb, '[{"surface":"onion","pos":"noun","ipa":"/ˈʌnjən/","gloss":"cebola"}]'::jsonb, 'No onions, please.', 'Sem cebola, por favor.'),
  ('unit-1000-words-a1-12-17', 'lesson-1000-words-a1-12', 17, 'word', 'garlic', 'alho', '/ˈɡɑːrlɪk/', NULL, '[]'::jsonb, '[{"surface":"garlic","pos":"noun","ipa":"/ˈɡɑːrlɪk/","gloss":"alho"}]'::jsonb, 'Garlic bread.', 'Pão de alho.'),
  ('unit-1000-words-a1-12-18', 'lesson-1000-words-a1-12', 18, 'word', 'carrot', 'cenoura', '/ˈkærət/', NULL, '[]'::jsonb, '[{"surface":"carrot","pos":"noun","ipa":"/ˈkærət/","gloss":"cenoura"}]'::jsonb, 'Carrot cake.', 'Bolo de cenoura.'),
  ('unit-1000-words-a1-12-19', 'lesson-1000-words-a1-12', 19, 'word', 'lettuce', 'alface', '/ˈlɛtɪs/', 'Pronúncia /ˈlɛtɪs/, não "let-uce".', '[]'::jsonb, '[{"surface":"lettuce","pos":"noun","ipa":"/ˈlɛtɪs/","gloss":"alface"}]'::jsonb, 'Lettuce and tomato salad.', 'Salada de alface e tomate.'),
  ('unit-1000-words-a1-12-20', 'lesson-1000-words-a1-12', 20, 'word', 'corn', 'milho', '/kɔːrn/', '"Popcorn" = pipoca.', '[]'::jsonb, '[{"surface":"corn","pos":"noun","ipa":"/kɔːrn/","gloss":"milho"}]'::jsonb, 'Corn on the cob.', 'Milho na espiga.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-13', 'course-1000-words-a1', 13, 'Bebidas, sabores e mesa', 'Beber, descrever o sabor e os talheres.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-13-01', 'lesson-1000-words-a1-13', 1, 'word', 'water', 'água', '/ˈwɔːtər/', NULL, '[]'::jsonb, '[{"surface":"water","pos":"noun","ipa":"/ˈwɔːtər/","gloss":"água"}]'::jsonb, 'A glass of water, please.', 'Um copo de água, por favor.'),
  ('unit-1000-words-a1-13-02', 'lesson-1000-words-a1-13', 2, 'word', 'juice', 'suco', '/dʒuːs/', NULL, '[]'::jsonb, '[{"surface":"juice","pos":"noun","ipa":"/dʒuːs/","gloss":"suco"}]'::jsonb, 'Orange juice, no ice.', 'Suco de laranja, sem gelo.'),
  ('unit-1000-words-a1-13-03', 'lesson-1000-words-a1-13', 3, 'word', 'coffee', 'café', '/ˈkɔːfi/', NULL, '[]'::jsonb, '[{"surface":"coffee","pos":"noun","ipa":"/ˈkɔːfi/","gloss":"café"}]'::jsonb, 'I drink coffee every morning.', 'Tomo café toda manhã.'),
  ('unit-1000-words-a1-13-04', 'lesson-1000-words-a1-13', 4, 'word', 'tea', 'chá', '/tiː/', NULL, '[]'::jsonb, '[{"surface":"tea","pos":"noun","ipa":"/tiː/","gloss":"chá"}]'::jsonb, 'Green tea, please.', 'Chá verde, por favor.'),
  ('unit-1000-words-a1-13-05', 'lesson-1000-words-a1-13', 5, 'word', 'milk', 'leite', '/mɪlk/', NULL, '[]'::jsonb, '[{"surface":"milk","pos":"noun","ipa":"/mɪlk/","gloss":"leite"}]'::jsonb, 'Coffee with milk.', 'Café com leite.'),
  ('unit-1000-words-a1-13-06', 'lesson-1000-words-a1-13', 6, 'word', 'beer', 'cerveja', '/bɪr/', NULL, '[]'::jsonb, '[{"surface":"beer","pos":"noun","ipa":"/bɪr/","gloss":"cerveja"}]'::jsonb, 'A cold beer, please.', 'Uma cerveja gelada, por favor.'),
  ('unit-1000-words-a1-13-07', 'lesson-1000-words-a1-13', 7, 'word', 'soda', 'refrigerante', '/ˈsoʊdə/', 'Nos EUA varia por região: soda, pop, coke.', '[]'::jsonb, '[{"surface":"soda","pos":"noun","ipa":"/ˈsoʊdə/","gloss":"refrigerante"}]'::jsonb, 'Do you have soda?', 'Vocês têm refrigerante?'),
  ('unit-1000-words-a1-13-08', 'lesson-1000-words-a1-13', 8, 'word', 'ice', 'gelo', '/aɪs/', NULL, '[]'::jsonb, '[{"surface":"ice","pos":"noun","ipa":"/aɪs/","gloss":"gelo"}]'::jsonb, 'No ice, please.', 'Sem gelo, por favor.'),
  ('unit-1000-words-a1-13-09', 'lesson-1000-words-a1-13', 9, 'word', 'hungry', 'com fome', '/ˈhʌŋɡri/', 'Inglês usa "to be": "I am hungry", não "I have hunger".', '[]'::jsonb, '[{"surface":"hungry","pos":"adjective","ipa":"/ˈhʌŋɡri/","gloss":"com fome"}]'::jsonb, 'I''m hungry.', 'Estou com fome.'),
  ('unit-1000-words-a1-13-10', 'lesson-1000-words-a1-13', 10, 'word', 'thirsty', 'com sede', '/ˈθɜːrsti/', NULL, '[]'::jsonb, '[{"surface":"thirsty","pos":"adjective","ipa":"/ˈθɜːrsti/","gloss":"com sede"}]'::jsonb, 'I''m thirsty.', 'Estou com sede.'),
  ('unit-1000-words-a1-13-11', 'lesson-1000-words-a1-13', 11, 'word', 'sweet', 'doce', '/swiːt/', NULL, '[]'::jsonb, '[{"surface":"sweet","pos":"adjective","ipa":"/swiːt/","gloss":"doce"}]'::jsonb, 'This cake is too sweet.', 'Este bolo está doce demais.'),
  ('unit-1000-words-a1-13-12', 'lesson-1000-words-a1-13', 12, 'word', 'salty', 'salgado', '/ˈsɔːlti/', NULL, '[]'::jsonb, '[{"surface":"salty","pos":"adjective","ipa":"/ˈsɔːlti/","gloss":"salgado"}]'::jsonb, 'The fries are salty.', 'As batatas estão salgadas.'),
  ('unit-1000-words-a1-13-13', 'lesson-1000-words-a1-13', 13, 'word', 'sour', 'azedo', '/ˈsaʊər/', NULL, '[]'::jsonb, '[{"surface":"sour","pos":"adjective","ipa":"/ˈsaʊər/","gloss":"azedo"}]'::jsonb, 'The milk is sour.', 'O leite está azedo.'),
  ('unit-1000-words-a1-13-14', 'lesson-1000-words-a1-13', 14, 'word', 'bitter', 'amargo', '/ˈbɪtər/', NULL, '[]'::jsonb, '[{"surface":"bitter","pos":"adjective","ipa":"/ˈbɪtər/","gloss":"amargo"}]'::jsonb, 'Black coffee is bitter.', 'Café puro é amargo.'),
  ('unit-1000-words-a1-13-15', 'lesson-1000-words-a1-13', 15, 'word', 'spicy', 'apimentado', '/ˈspaɪsi/', '"Hot" também significa picante: "hot sauce".', '[]'::jsonb, '[{"surface":"spicy","pos":"adjective","ipa":"/ˈspaɪsi/","gloss":"apimentado, picante"}]'::jsonb, 'Is it spicy?', 'É apimentado?'),
  ('unit-1000-words-a1-13-16', 'lesson-1000-words-a1-13', 16, 'word', 'delicious', 'delicioso', '/dɪˈlɪʃəs/', NULL, '[]'::jsonb, '[{"surface":"delicious","pos":"adjective","ipa":"/dɪˈlɪʃəs/","gloss":"delicioso"}]'::jsonb, 'The food was delicious.', 'A comida estava deliciosa.'),
  ('unit-1000-words-a1-13-17', 'lesson-1000-words-a1-13', 17, 'word', 'cup', 'xícara', '/kʌp/', '"Cup" = xícara; "glass" = copo de vidro; "mug" = caneca.', '[]'::jsonb, '[{"surface":"cup","pos":"noun","ipa":"/kʌp/","gloss":"xícara"}]'::jsonb, 'A cup of coffee.', 'Uma xícara de café.'),
  ('unit-1000-words-a1-13-18', 'lesson-1000-words-a1-13', 18, 'word', 'plate', 'prato', '/pleɪt/', '"Plate" = o objeto; "dish" = o prato de comida.', '[]'::jsonb, '[{"surface":"plate","pos":"noun","ipa":"/pleɪt/","gloss":"prato"}]'::jsonb, 'Can I have another plate?', 'Pode me dar outro prato?'),
  ('unit-1000-words-a1-13-19', 'lesson-1000-words-a1-13', 19, 'word', 'fork', 'garfo', '/fɔːrk/', NULL, '[]'::jsonb, '[{"surface":"fork","pos":"noun","ipa":"/fɔːrk/","gloss":"garfo"}]'::jsonb, 'I need a fork.', 'Preciso de um garfo.'),
  ('unit-1000-words-a1-13-20', 'lesson-1000-words-a1-13', 20, 'word', 'knife', 'faca', '/naɪf/', 'O "k" é mudo: /naɪf/. Plural: "knives".', '[]'::jsonb, '[{"surface":"knife","pos":"noun","ipa":"/naɪf/","gloss":"faca"}]'::jsonb, 'This knife is sharp.', 'Esta faca está afiada.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;
