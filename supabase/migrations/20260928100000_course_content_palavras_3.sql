-- Gerado por scripts/generate-course-seed.mjs a partir de supabase/content/. Não editar à mão.

-- Conteúdo original: frases do cotidiano com tradução pt-BR, notas, grupos sintáticos e anotações por palavra.

INSERT INTO public.course_catalog (id, slug, title, short_description, long_description, level, category, order_index, track, track_order, is_core, is_published)
VALUES ('course-1000-words-a1', '1000-essential-words', '1000 Palavras Essenciais', 'As palavras mais usadas do inglês, por tema, com significado e frase de exemplo.', 'Vocabulário essencial organizado por temas do dia a dia. Você ouve, escreve a palavra e vê como ela aparece numa frase real.', 'A1', 'grammar', 11, 'fundamentos', 2, true, true)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description, level = EXCLUDED.level, category = EXCLUDED.category,
  order_index = EXCLUDED.order_index, track = EXCLUDED.track, track_order = EXCLUDED.track_order,
  is_core = EXCLUDED.is_core, is_published = EXCLUDED.is_published, updated_at = now();

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-08', 'course-1000-words-a1', 8, 'Corpo humano', 'Partes do corpo para descrever pessoas e dizer onde dói.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-08-01', 'lesson-1000-words-a1-08', 1, 'word', 'head', 'cabeça', '/hɛd/', '"My + parte do corpo + hurts" = está doendo.', '[]'::jsonb, '[{"surface":"head","pos":"noun","ipa":"/hɛd/","gloss":"cabeça"}]'::jsonb, 'My head hurts.', 'Minha cabeça dói.'),
  ('unit-1000-words-a1-08-02', 'lesson-1000-words-a1-08', 2, 'word', 'hair', 'cabelo', '/hɛr/', 'Incontável: "hair is", nunca "hairs" para o cabelo todo.', '[]'::jsonb, '[{"surface":"hair","pos":"noun","ipa":"/hɛr/","gloss":"cabelo"}]'::jsonb, 'She has long hair.', 'Ela tem cabelo comprido.'),
  ('unit-1000-words-a1-08-03', 'lesson-1000-words-a1-08', 3, 'word', 'face', 'rosto', '/feɪs/', NULL, '[]'::jsonb, '[{"surface":"face","pos":"noun","ipa":"/feɪs/","gloss":"rosto"}]'::jsonb, 'Wash your face.', 'Lave o rosto.'),
  ('unit-1000-words-a1-08-04', 'lesson-1000-words-a1-08', 4, 'word', 'eye', 'olho', '/aɪ/', 'Pronúncia igual à letra "I": /aɪ/.', '[]'::jsonb, '[{"surface":"eye","pos":"noun","ipa":"/aɪ/","gloss":"olho"}]'::jsonb, 'He has blue eyes.', 'Ele tem olhos azuis.'),
  ('unit-1000-words-a1-08-05', 'lesson-1000-words-a1-08', 5, 'word', 'ear', 'orelha, ouvido', '/ɪr/', NULL, '[]'::jsonb, '[{"surface":"ear","pos":"noun","ipa":"/ɪr/","gloss":"orelha, ouvido"}]'::jsonb, 'I have an ear infection.', 'Estou com infecção no ouvido.'),
  ('unit-1000-words-a1-08-06', 'lesson-1000-words-a1-08', 6, 'word', 'nose', 'nariz', '/noʊz/', '"Runny nose" = nariz escorrendo.', '[]'::jsonb, '[{"surface":"nose","pos":"noun","ipa":"/noʊz/","gloss":"nariz"}]'::jsonb, 'My nose is running.', 'Meu nariz está escorrendo.'),
  ('unit-1000-words-a1-08-07', 'lesson-1000-words-a1-08', 7, 'word', 'mouth', 'boca', '/maʊθ/', NULL, '[]'::jsonb, '[{"surface":"mouth","pos":"noun","ipa":"/maʊθ/","gloss":"boca"}]'::jsonb, 'Open your mouth, please.', 'Abra a boca, por favor.'),
  ('unit-1000-words-a1-08-08', 'lesson-1000-words-a1-08', 8, 'word', 'tooth', 'dente', '/tuːθ/', 'Plural irregular: "teeth".', '[]'::jsonb, '[{"surface":"tooth","pos":"noun","ipa":"/tuːθ/","gloss":"dente"}]'::jsonb, 'I have a broken tooth.', 'Estou com um dente quebrado.'),
  ('unit-1000-words-a1-08-09', 'lesson-1000-words-a1-08', 9, 'word', 'neck', 'pescoço', '/nɛk/', NULL, '[]'::jsonb, '[{"surface":"neck","pos":"noun","ipa":"/nɛk/","gloss":"pescoço"}]'::jsonb, 'My neck is stiff.', 'Meu pescoço está duro.'),
  ('unit-1000-words-a1-08-10', 'lesson-1000-words-a1-08', 10, 'word', 'shoulder', 'ombro', '/ˈʃoʊldər/', NULL, '[]'::jsonb, '[{"surface":"shoulder","pos":"noun","ipa":"/ˈʃoʊldər/","gloss":"ombro"}]'::jsonb, 'I hurt my shoulder.', 'Machuquei o ombro.'),
  ('unit-1000-words-a1-08-11', 'lesson-1000-words-a1-08', 11, 'word', 'arm', 'braço', '/ɑːrm/', 'Com partes do corpo o inglês usa possessivo: "her arm", não "the arm".', '[]'::jsonb, '[{"surface":"arm","pos":"noun","ipa":"/ɑːrm/","gloss":"braço"}]'::jsonb, 'She broke her arm.', 'Ela quebrou o braço.'),
  ('unit-1000-words-a1-08-12', 'lesson-1000-words-a1-08', 12, 'word', 'hand', 'mão', '/hænd/', NULL, '[]'::jsonb, '[{"surface":"hand","pos":"noun","ipa":"/hænd/","gloss":"mão"}]'::jsonb, 'Raise your hand.', 'Levante a mão.'),
  ('unit-1000-words-a1-08-13', 'lesson-1000-words-a1-08', 13, 'word', 'finger', 'dedo (da mão)', '/ˈfɪŋɡər/', 'Dedo do pé é "toe".', '[]'::jsonb, '[{"surface":"finger","pos":"noun","ipa":"/ˈfɪŋɡər/","gloss":"dedo (da mão)"}]'::jsonb, 'I cut my finger.', 'Cortei o dedo.'),
  ('unit-1000-words-a1-08-14', 'lesson-1000-words-a1-08', 14, 'word', 'back', 'costas', '/bæk/', 'Singular em inglês: "my back hurts".', '[]'::jsonb, '[{"surface":"back","pos":"noun","ipa":"/bæk/","gloss":"costas"}]'::jsonb, 'My back hurts.', 'Minhas costas doem.'),
  ('unit-1000-words-a1-08-15', 'lesson-1000-words-a1-08', 15, 'word', 'stomach', 'estômago, barriga', '/ˈstʌmək/', 'O "ch" soa como "k": /ˈstʌmək/.', '[]'::jsonb, '[{"surface":"stomach","pos":"noun","ipa":"/ˈstʌmək/","gloss":"estômago, barriga"}]'::jsonb, 'I have a stomachache.', 'Estou com dor de barriga.'),
  ('unit-1000-words-a1-08-16', 'lesson-1000-words-a1-08', 16, 'word', 'leg', 'perna', '/lɛɡ/', NULL, '[]'::jsonb, '[{"surface":"leg","pos":"noun","ipa":"/lɛɡ/","gloss":"perna"}]'::jsonb, 'My legs are tired.', 'Minhas pernas estão cansadas.'),
  ('unit-1000-words-a1-08-17', 'lesson-1000-words-a1-08', 17, 'word', 'knee', 'joelho', '/niː/', 'O "k" é mudo: /niː/.', '[]'::jsonb, '[{"surface":"knee","pos":"noun","ipa":"/niː/","gloss":"joelho"}]'::jsonb, 'He hurt his knee playing soccer.', 'Ele machucou o joelho jogando futebol.'),
  ('unit-1000-words-a1-08-18', 'lesson-1000-words-a1-08', 18, 'word', 'foot', 'pé', '/fʊt/', 'Plural irregular: "feet".', '[]'::jsonb, '[{"surface":"foot","pos":"noun","ipa":"/fʊt/","gloss":"pé"}]'::jsonb, 'I walked on foot.', 'Fui a pé.'),
  ('unit-1000-words-a1-08-19', 'lesson-1000-words-a1-08', 19, 'word', 'heart', 'coração', '/hɑːrt/', NULL, '[]'::jsonb, '[{"surface":"heart","pos":"noun","ipa":"/hɑːrt/","gloss":"coração"}]'::jsonb, 'Your heart is beating fast.', 'Seu coração está batendo rápido.'),
  ('unit-1000-words-a1-08-20', 'lesson-1000-words-a1-08', 20, 'word', 'skin', 'pele', '/skɪn/', NULL, '[]'::jsonb, '[{"surface":"skin","pos":"noun","ipa":"/skɪn/","gloss":"pele"}]'::jsonb, 'Use sunscreen on your skin.', 'Use protetor na pele.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-09', 'course-1000-words-a1', 9, 'Roupas e acessórios', 'O que vestir e como falar de roupas.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-09-01', 'lesson-1000-words-a1-09', 1, 'word', 'clothes', 'roupas', '/kloʊðz/', 'Sempre plural; o "th" quase some na fala: /kloʊz/.', '[]'::jsonb, '[{"surface":"clothes","pos":"noun","ipa":"/kloʊðz/","gloss":"roupas"}]'::jsonb, 'I need new clothes.', 'Preciso de roupas novas.'),
  ('unit-1000-words-a1-09-02', 'lesson-1000-words-a1-09', 2, 'word', 'shirt', 'camisa', '/ʃɜːrt/', '"Wear" = usar/vestir; "put on" = colocar.', '[]'::jsonb, '[{"surface":"shirt","pos":"noun","ipa":"/ʃɜːrt/","gloss":"camisa"}]'::jsonb, 'He wears a white shirt to work.', 'Ele usa camisa branca no trabalho.'),
  ('unit-1000-words-a1-09-03', 'lesson-1000-words-a1-09', 3, 'word', 't-shirt', 'camiseta', '/ˈtiːʃɜːrt/', NULL, '[]'::jsonb, '[{"surface":"t-shirt","pos":"noun","ipa":"/ˈtiːʃɜːrt/","gloss":"camiseta"}]'::jsonb, 'I bought a t-shirt.', 'Comprei uma camiseta.'),
  ('unit-1000-words-a1-09-04', 'lesson-1000-words-a1-09', 4, 'word', 'pants', 'calça', '/pænts/', 'EUA: "pants"; no Reino Unido "pants" é cueca e calça é "trousers". Sempre plural.', '[]'::jsonb, '[{"surface":"pants","pos":"noun","ipa":"/pænts/","gloss":"calça"}]'::jsonb, 'These pants are too long.', 'Esta calça está comprida demais.'),
  ('unit-1000-words-a1-09-05', 'lesson-1000-words-a1-09', 5, 'word', 'jeans', 'calça jeans', '/dʒiːnz/', 'Plural: "my jeans are…".', '[]'::jsonb, '[{"surface":"jeans","pos":"noun","ipa":"/dʒiːnz/","gloss":"calça jeans"}]'::jsonb, 'I always wear jeans.', 'Eu sempre uso jeans.'),
  ('unit-1000-words-a1-09-06', 'lesson-1000-words-a1-09', 6, 'word', 'shorts', 'bermuda, short', '/ʃɔːrts/', NULL, '[]'::jsonb, '[{"surface":"shorts","pos":"noun","ipa":"/ʃɔːrts/","gloss":"bermuda, short"}]'::jsonb, 'It''s hot, wear shorts.', 'Está quente, use bermuda.'),
  ('unit-1000-words-a1-09-07', 'lesson-1000-words-a1-09', 7, 'word', 'dress', 'vestido', '/drɛs/', 'Como verbo, "dress" = vestir-se.', '[]'::jsonb, '[{"surface":"dress","pos":"noun","ipa":"/drɛs/","gloss":"vestido"}]'::jsonb, 'She wore a red dress.', 'Ela usou um vestido vermelho.'),
  ('unit-1000-words-a1-09-08', 'lesson-1000-words-a1-09', 8, 'word', 'skirt', 'saia', '/skɜːrt/', NULL, '[]'::jsonb, '[{"surface":"skirt","pos":"noun","ipa":"/skɜːrt/","gloss":"saia"}]'::jsonb, 'The skirt is too short.', 'A saia está curta demais.'),
  ('unit-1000-words-a1-09-09', 'lesson-1000-words-a1-09', 9, 'word', 'sweater', 'suéter, blusa de frio', '/ˈswɛtər/', NULL, '[]'::jsonb, '[{"surface":"sweater","pos":"noun","ipa":"/ˈswɛtər/","gloss":"suéter, blusa de frio"}]'::jsonb, 'Take a sweater, it gets cold.', 'Leve uma blusa, esfria.'),
  ('unit-1000-words-a1-09-10', 'lesson-1000-words-a1-09', 10, 'word', 'coat', 'casaco', '/koʊt/', NULL, '[]'::jsonb, '[{"surface":"coat","pos":"noun","ipa":"/koʊt/","gloss":"casaco"}]'::jsonb, 'Put on your coat.', 'Coloque o casaco.'),
  ('unit-1000-words-a1-09-11', 'lesson-1000-words-a1-09', 11, 'word', 'jacket', 'jaqueta', '/ˈdʒækɪt/', NULL, '[]'::jsonb, '[{"surface":"jacket","pos":"noun","ipa":"/ˈdʒækɪt/","gloss":"jaqueta"}]'::jsonb, 'This jacket is waterproof.', 'Esta jaqueta é impermeável.'),
  ('unit-1000-words-a1-09-12', 'lesson-1000-words-a1-09', 12, 'word', 'socks', 'meias', '/sɑːks/', NULL, '[]'::jsonb, '[{"surface":"socks","pos":"noun","ipa":"/sɑːks/","gloss":"meias"}]'::jsonb, 'I need clean socks.', 'Preciso de meias limpas.'),
  ('unit-1000-words-a1-09-13', 'lesson-1000-words-a1-09', 13, 'word', 'shoes', 'sapatos', '/ʃuːz/', NULL, '[]'::jsonb, '[{"surface":"shoes","pos":"noun","ipa":"/ʃuːz/","gloss":"sapatos"}]'::jsonb, 'Take off your shoes, please.', 'Tire os sapatos, por favor.'),
  ('unit-1000-words-a1-09-14', 'lesson-1000-words-a1-09', 14, 'word', 'sneakers', 'tênis', '/ˈsniːkərz/', '"Tennis" é o esporte; o calçado é "sneakers" (EUA) ou "trainers" (Reino Unido).', '[]'::jsonb, '[{"surface":"sneakers","pos":"noun","ipa":"/ˈsniːkərz/","gloss":"tênis"}]'::jsonb, 'I run in these sneakers.', 'Eu corro com estes tênis.'),
  ('unit-1000-words-a1-09-15', 'lesson-1000-words-a1-09', 15, 'word', 'boots', 'botas', '/buːts/', NULL, '[]'::jsonb, '[{"surface":"boots","pos":"noun","ipa":"/buːts/","gloss":"botas"}]'::jsonb, 'Wear boots in the snow.', 'Use botas na neve.'),
  ('unit-1000-words-a1-09-16', 'lesson-1000-words-a1-09', 16, 'word', 'hat', 'chapéu, boné', '/hæt/', 'Boné também é "cap".', '[]'::jsonb, '[{"surface":"hat","pos":"noun","ipa":"/hæt/","gloss":"chapéu, boné"}]'::jsonb, 'Don''t forget your hat.', 'Não esqueça o chapéu.'),
  ('unit-1000-words-a1-09-17', 'lesson-1000-words-a1-09', 17, 'word', 'scarf', 'cachecol, lenço', '/skɑːrf/', NULL, '[]'::jsonb, '[{"surface":"scarf","pos":"noun","ipa":"/skɑːrf/","gloss":"cachecol, lenço"}]'::jsonb, 'She has a wool scarf.', 'Ela tem um cachecol de lã.'),
  ('unit-1000-words-a1-09-18', 'lesson-1000-words-a1-09', 18, 'word', 'gloves', 'luvas', '/ɡlʌvz/', NULL, '[]'::jsonb, '[{"surface":"gloves","pos":"noun","ipa":"/ɡlʌvz/","gloss":"luvas"}]'::jsonb, 'My hands are cold, where are my gloves?', 'Minhas mãos estão frias, cadê minhas luvas?'),
  ('unit-1000-words-a1-09-19', 'lesson-1000-words-a1-09', 19, 'word', 'pajamas', 'pijama', '/pəˈdʒɑːməz/', 'Sempre plural. Reino Unido: "pyjamas".', '[]'::jsonb, '[{"surface":"pajamas","pos":"noun","ipa":"/pəˈdʒɑːməz/","gloss":"pijama"}]'::jsonb, 'The kids are in their pajamas.', 'As crianças estão de pijama.'),
  ('unit-1000-words-a1-09-20', 'lesson-1000-words-a1-09', 20, 'word', 'ring', 'anel', '/rɪŋ/', NULL, '[]'::jsonb, '[{"surface":"ring","pos":"noun","ipa":"/rɪŋ/","gloss":"anel"}]'::jsonb, 'He gave her a ring.', 'Ele deu um anel para ela.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-10', 'course-1000-words-a1', 10, 'Casa e cômodos', 'Cômodos, móveis e onde as coisas ficam.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-10-01', 'lesson-1000-words-a1-10', 1, 'word', 'house', 'casa', '/haʊs/', '"House" = o prédio; "home" = o lar ("I''m at home").', '[]'::jsonb, '[{"surface":"house","pos":"noun","ipa":"/haʊs/","gloss":"casa"}]'::jsonb, 'They live in a big house.', 'Eles moram numa casa grande.'),
  ('unit-1000-words-a1-10-02', 'lesson-1000-words-a1-10', 2, 'word', 'apartment', 'apartamento', '/əˈpɑːrtmənt/', 'Reino Unido: "flat".', '[]'::jsonb, '[{"surface":"apartment","pos":"noun","ipa":"/əˈpɑːrtmənt/","gloss":"apartamento"}]'::jsonb, 'My apartment is small.', 'Meu apartamento é pequeno.'),
  ('unit-1000-words-a1-10-03', 'lesson-1000-words-a1-10', 3, 'word', 'room', 'cômodo, quarto', '/ruːm/', NULL, '[]'::jsonb, '[{"surface":"room","pos":"noun","ipa":"/ruːm/","gloss":"cômodo, quarto"}]'::jsonb, 'How many rooms does it have?', 'Quantos cômodos tem?'),
  ('unit-1000-words-a1-10-04', 'lesson-1000-words-a1-10', 4, 'word', 'kitchen', 'cozinha', '/ˈkɪtʃən/', NULL, '[]'::jsonb, '[{"surface":"kitchen","pos":"noun","ipa":"/ˈkɪtʃən/","gloss":"cozinha"}]'::jsonb, 'Dinner is in the kitchen.', 'O jantar está na cozinha.'),
  ('unit-1000-words-a1-10-05', 'lesson-1000-words-a1-10', 5, 'word', 'bedroom', 'quarto', '/ˈbɛdruːm/', NULL, '[]'::jsonb, '[{"surface":"bedroom","pos":"noun","ipa":"/ˈbɛdruːm/","gloss":"quarto"}]'::jsonb, 'The apartment has two bedrooms.', 'O apartamento tem dois quartos.'),
  ('unit-1000-words-a1-10-06', 'lesson-1000-words-a1-10', 6, 'word', 'bathroom', 'banheiro', '/ˈbæθruːm/', 'Em lugares públicos nos EUA também se diz "restroom".', '[]'::jsonb, '[{"surface":"bathroom","pos":"noun","ipa":"/ˈbæθruːm/","gloss":"banheiro"}]'::jsonb, 'Where is the bathroom?', 'Onde fica o banheiro?'),
  ('unit-1000-words-a1-10-07', 'lesson-1000-words-a1-10', 7, 'word', 'living room', 'sala de estar', '/ˈlɪvɪŋ ruːm/', NULL, '[]'::jsonb, '[{"surface":"living","pos":"adjective","ipa":"/ˈlɪvɪŋ/","gloss":"de estar"},{"surface":"room","pos":"noun","ipa":"/ruːm/","gloss":"cômodo, quarto"}]'::jsonb, 'We watch TV in the living room.', 'Vemos TV na sala.'),
  ('unit-1000-words-a1-10-08', 'lesson-1000-words-a1-10', 8, 'word', 'window', 'janela', '/ˈwɪndoʊ/', NULL, '[]'::jsonb, '[{"surface":"window","pos":"noun","ipa":"/ˈwɪndoʊ/","gloss":"janela"}]'::jsonb, 'Can you open the window?', 'Pode abrir a janela?'),
  ('unit-1000-words-a1-10-09', 'lesson-1000-words-a1-10', 9, 'word', 'door', 'porta', '/dɔːr/', NULL, '[]'::jsonb, '[{"surface":"door","pos":"noun","ipa":"/dɔːr/","gloss":"porta"}]'::jsonb, 'Close the door, please.', 'Feche a porta, por favor.'),
  ('unit-1000-words-a1-10-10', 'lesson-1000-words-a1-10', 10, 'word', 'wall', 'parede', '/wɔːl/', NULL, '[]'::jsonb, '[{"surface":"wall","pos":"noun","ipa":"/wɔːl/","gloss":"parede"}]'::jsonb, 'The walls are white.', 'As paredes são brancas.'),
  ('unit-1000-words-a1-10-11', 'lesson-1000-words-a1-10', 11, 'word', 'floor', 'chão, andar', '/flɔːr/', NULL, '[]'::jsonb, '[{"surface":"floor","pos":"noun","ipa":"/flɔːr/","gloss":"andar; chão"}]'::jsonb, 'Don''t leave your shoes on the floor.', 'Não deixe os sapatos no chão.'),
  ('unit-1000-words-a1-10-12', 'lesson-1000-words-a1-10', 12, 'word', 'stairs', 'escada', '/stɛrz/', 'Plural. Escada de mão é "ladder".', '[]'::jsonb, '[{"surface":"stairs","pos":"noun","ipa":"/stɛrz/","gloss":"escada"}]'::jsonb, 'Take the stairs.', 'Vá pela escada.'),
  ('unit-1000-words-a1-10-13', 'lesson-1000-words-a1-10', 13, 'word', 'garden', 'jardim', '/ˈɡɑːrdən/', 'EUA também usa "yard" para o quintal.', '[]'::jsonb, '[{"surface":"garden","pos":"noun","ipa":"/ˈɡɑːrdən/","gloss":"jardim"}]'::jsonb, 'We have a small garden.', 'Temos um jardim pequeno.'),
  ('unit-1000-words-a1-10-14', 'lesson-1000-words-a1-10', 14, 'word', 'garage', 'garagem', '/ɡəˈrɑːʒ/', NULL, '[]'::jsonb, '[{"surface":"garage","pos":"noun","ipa":"/ɡəˈrɑːʒ/","gloss":"garagem"}]'::jsonb, 'The car is in the garage.', 'O carro está na garagem.'),
  ('unit-1000-words-a1-10-15', 'lesson-1000-words-a1-10', 15, 'word', 'sofa', 'sofá', '/ˈsoʊfə/', 'Também "couch".', '[]'::jsonb, '[{"surface":"sofa","pos":"noun","ipa":"/ˈsoʊfə/","gloss":"sofá"}]'::jsonb, 'Sit on the sofa.', 'Sente no sofá.'),
  ('unit-1000-words-a1-10-16', 'lesson-1000-words-a1-10', 16, 'word', 'lamp', 'luminária', '/læmp/', NULL, '[]'::jsonb, '[{"surface":"lamp","pos":"noun","ipa":"/læmp/","gloss":"luminária"}]'::jsonb, 'Turn on the lamp.', 'Acenda a luminária.'),
  ('unit-1000-words-a1-10-17', 'lesson-1000-words-a1-10', 17, 'word', 'fridge', 'geladeira', '/frɪdʒ/', 'Forma curta de "refrigerator".', '[]'::jsonb, '[{"surface":"fridge","pos":"noun","ipa":"/frɪdʒ/","gloss":"geladeira"}]'::jsonb, 'The milk is in the fridge.', 'O leite está na geladeira.'),
  ('unit-1000-words-a1-10-18', 'lesson-1000-words-a1-10', 18, 'word', 'stove', 'fogão', '/stoʊv/', NULL, '[]'::jsonb, '[{"surface":"stove","pos":"noun","ipa":"/stoʊv/","gloss":"fogão"}]'::jsonb, 'Don''t touch the stove, it''s hot.', 'Não toque no fogão, está quente.'),
  ('unit-1000-words-a1-10-19', 'lesson-1000-words-a1-10', 19, 'word', 'sink', 'pia', '/sɪŋk/', NULL, '[]'::jsonb, '[{"surface":"sink","pos":"noun","ipa":"/sɪŋk/","gloss":"pia"}]'::jsonb, 'Put the dishes in the sink.', 'Coloque a louça na pia.'),
  ('unit-1000-words-a1-10-20', 'lesson-1000-words-a1-10', 20, 'word', 'neighbor', 'vizinho', '/ˈneɪbər/', 'Reino Unido: "neighbour".', '[]'::jsonb, '[{"surface":"neighbor","pos":"noun","ipa":"/ˈneɪbər/","gloss":"vizinho"}]'::jsonb, 'Our neighbors are very nice.', 'Nossos vizinhos são muito legais.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;
