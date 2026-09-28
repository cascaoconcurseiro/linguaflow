-- Gerado por scripts/generate-course-seed.mjs a partir de supabase/content/. Não editar à mão.

-- Conteúdo original: frases do cotidiano com tradução pt-BR, notas, grupos sintáticos e anotações por palavra.

INSERT INTO public.course_catalog (id, slug, title, short_description, long_description, level, category, order_index, track, track_order, is_core, is_published)
VALUES ('course-1000-words-a1', '1000-essential-words', '1000 Palavras Essenciais', 'As palavras mais usadas do inglês, por tema, com significado e frase de exemplo.', 'Vocabulário essencial organizado por temas do dia a dia. Você ouve, escreve a palavra e vê como ela aparece numa frase real.', 'A1', 'grammar', 11, 'fundamentos', 2, true, true)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description, level = EXCLUDED.level, category = EXCLUDED.category,
  order_index = EXCLUDED.order_index, track = EXCLUDED.track, track_order = EXCLUDED.track_order,
  is_core = EXCLUDED.is_core, is_published = EXCLUDED.is_published, updated_at = now();

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-35', 'course-1000-words-a1', 35, 'Verbos de ação 1: movimento', 'Verbos do corpo e do movimento.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-35-01', 'lesson-1000-words-a1-35', 1, 'word', 'walk', 'andar', '/wɔːk/', NULL, '[]'::jsonb, '[{"surface":"walk","pos":"noun","ipa":"/wɔːk/","gloss":"caminhada; andar"}]'::jsonb, 'We walk to school.', 'Vamos a pé para a escola.'),
  ('unit-1000-words-a1-35-02', 'lesson-1000-words-a1-35', 2, 'word', 'run', 'correr', '/rʌn/', NULL, '[]'::jsonb, '[{"surface":"run","pos":"verb","ipa":"/rʌn/","gloss":"correr; administrar"}]'::jsonb, 'I run every morning.', 'Corro toda manhã.'),
  ('unit-1000-words-a1-35-03', 'lesson-1000-words-a1-35', 3, 'word', 'jump', 'pular', '/dʒʌmp/', NULL, '[]'::jsonb, '[{"surface":"jump","pos":"verb","ipa":"/dʒʌmp/","gloss":"pular"}]'::jsonb, 'The kids jump on the bed.', 'As crianças pulam na cama.'),
  ('unit-1000-words-a1-35-04', 'lesson-1000-words-a1-35', 4, 'word', 'sit', 'sentar', '/sɪt/', NULL, '[]'::jsonb, '[{"surface":"sit","pos":"verb","ipa":"/sɪt/","gloss":"sentar"}]'::jsonb, 'Sit here, please.', 'Sente aqui, por favor.'),
  ('unit-1000-words-a1-35-05', 'lesson-1000-words-a1-35', 5, 'word', 'stand', 'ficar de pé', '/stænd/', NULL, '[]'::jsonb, '[{"surface":"stand","pos":"verb","ipa":"/stænd/","gloss":"ficar de pé; suportar"}]'::jsonb, 'Please stand up.', 'Por favor, levante-se.'),
  ('unit-1000-words-a1-35-06', 'lesson-1000-words-a1-35', 6, 'word', 'climb', 'escalar, subir', '/klaɪm/', 'O "b" é mudo: /klaɪm/.', '[]'::jsonb, '[{"surface":"climb","pos":"verb","ipa":"/klaɪm/","gloss":"escalar, subir"}]'::jsonb, 'We climbed the hill.', 'Subimos o morro.'),
  ('unit-1000-words-a1-35-07', 'lesson-1000-words-a1-35', 7, 'word', 'dance', 'dançar', '/dæns/', NULL, '[]'::jsonb, '[{"surface":"dance","pos":"verb","ipa":"/dæns/","gloss":"dançar"}]'::jsonb, 'Let''s dance!', 'Vamos dançar!'),
  ('unit-1000-words-a1-35-08', 'lesson-1000-words-a1-35', 8, 'word', 'swim', 'nadar', '/swɪm/', NULL, '[]'::jsonb, '[{"surface":"swim","pos":"verb","ipa":"/swɪm/","gloss":"nadar"}]'::jsonb, 'Can you swim?', 'Você sabe nadar?'),
  ('unit-1000-words-a1-35-09', 'lesson-1000-words-a1-35', 9, 'word', 'push', 'empurrar', '/pʊʃ/', 'Em portas: "push" = empurre; "pull" = puxe.', '[]'::jsonb, '[{"surface":"push","pos":"verb","ipa":"/pʊʃ/","gloss":"adiar, empurrar"}]'::jsonb, 'Push the door.', 'Empurre a porta.'),
  ('unit-1000-words-a1-35-10', 'lesson-1000-words-a1-35', 10, 'word', 'pull', 'puxar', '/pʊl/', NULL, '[]'::jsonb, '[{"surface":"pull","pos":"verb","ipa":"/pʊl/","gloss":"puxar"}]'::jsonb, 'Pull the rope.', 'Puxe a corda.'),
  ('unit-1000-words-a1-35-11', 'lesson-1000-words-a1-35', 11, 'word', 'carry', 'carregar', '/ˈkæri/', NULL, '[]'::jsonb, '[{"surface":"carry","pos":"verb","ipa":"/ˈkæri/","gloss":"carregar"}]'::jsonb, 'Can you carry this box?', 'Pode carregar esta caixa?'),
  ('unit-1000-words-a1-35-12', 'lesson-1000-words-a1-35', 12, 'word', 'throw', 'jogar, arremessar', '/θroʊ/', NULL, '[]'::jsonb, '[{"surface":"throw","pos":"verb","ipa":"/θroʊ/","gloss":"jogar, arremessar"}]'::jsonb, 'Throw me the ball.', 'Joga a bola para mim.'),
  ('unit-1000-words-a1-35-13', 'lesson-1000-words-a1-35', 13, 'word', 'catch', 'pegar (no ar)', '/kætʃ/', NULL, '[]'::jsonb, '[{"surface":"catch","pos":"verb","ipa":"/kætʃ/","gloss":"pegar, apanhar"}]'::jsonb, 'Catch!', 'Pega!'),
  ('unit-1000-words-a1-35-14', 'lesson-1000-words-a1-35', 14, 'word', 'turn', 'virar', '/tɜːrn/', NULL, '[]'::jsonb, '[{"surface":"turn","pos":"verb","ipa":"/tɜːrn/","gloss":"ligar (turn on)"}]'::jsonb, 'Turn right here.', 'Vire à direita aqui.'),
  ('unit-1000-words-a1-35-15', 'lesson-1000-words-a1-35', 15, 'word', 'fall', 'cair', '/fɔːl/', NULL, '[]'::jsonb, '[{"surface":"fall","pos":"noun","ipa":"/fɔːl/","gloss":"outono"}]'::jsonb, 'Don''t fall!', 'Não caia!'),
  ('unit-1000-words-a1-35-16', 'lesson-1000-words-a1-35', 16, 'word', 'lie', 'deitar-se', '/laɪ/', '"Lie" também é mentir, com outro passado: "lied".', '[]'::jsonb, '[{"surface":"lie","pos":"verb","ipa":"/laɪ/","gloss":"deitar-se; mentir"}]'::jsonb, 'Lie down and relax.', 'Deite e relaxe.'),
  ('unit-1000-words-a1-35-17', 'lesson-1000-words-a1-35', 17, 'word', 'hurry', 'apressar-se', '/ˈhɜːri/', NULL, '[]'::jsonb, '[{"surface":"hurry","pos":"noun","ipa":"/ˈhɜːri/","gloss":"pressa"}]'::jsonb, 'Hurry up!', 'Anda logo!'),
  ('unit-1000-words-a1-35-18', 'lesson-1000-words-a1-35', 18, 'word', 'arrive', 'chegar', '/əˈraɪv/', NULL, '[]'::jsonb, '[{"surface":"arrive","pos":"verb","ipa":"/əˈraɪv/","gloss":"chegar"}]'::jsonb, 'What time do you arrive?', 'Que horas você chega?'),
  ('unit-1000-words-a1-35-19', 'lesson-1000-words-a1-35', 19, 'word', 'leave', 'sair, partir', '/liːv/', NULL, '[]'::jsonb, '[{"surface":"leave","pos":"verb","ipa":"/liːv/","gloss":"deixar"}]'::jsonb, 'We leave at six.', 'Saímos às seis.'),
  ('unit-1000-words-a1-35-20', 'lesson-1000-words-a1-35', 20, 'word', 'return', 'voltar', '/rɪˈtɜːrn/', NULL, '[]'::jsonb, '[{"surface":"return","pos":"adjective","ipa":"/rɪˈtɜːrn/","gloss":"de volta"}]'::jsonb, 'I will return on Monday.', 'Volto na segunda.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-36', 'course-1000-words-a1', 36, 'Verbos de ação 2: casa e dia a dia', 'Verbos das tarefas diárias.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-36-01', 'lesson-1000-words-a1-36', 1, 'word', 'wake', 'acordar', '/weɪk/', NULL, '[]'::jsonb, '[{"surface":"wake","pos":"verb","ipa":"/weɪk/","gloss":"acordar"}]'::jsonb, 'I wake up at seven.', 'Acordo às sete.'),
  ('unit-1000-words-a1-36-02', 'lesson-1000-words-a1-36', 2, 'word', 'wash', 'lavar', '/wɑːʃ/', NULL, '[]'::jsonb, '[{"surface":"wash","pos":"verb","ipa":"/wɑːʃ/","gloss":"lavar"}]'::jsonb, 'Wash your hands.', 'Lave as mãos.'),
  ('unit-1000-words-a1-36-03', 'lesson-1000-words-a1-36', 3, 'word', 'clean', 'limpar', '/kliːn/', NULL, '[]'::jsonb, '[{"surface":"clean","pos":"verb","ipa":"/kliːn/","gloss":"limpar"}]'::jsonb, 'I clean the house on Saturday.', 'Limpo a casa no sábado.'),
  ('unit-1000-words-a1-36-04', 'lesson-1000-words-a1-36', 4, 'word', 'cook', 'cozinhar', '/kʊk/', NULL, '[]'::jsonb, '[{"surface":"cook","pos":"noun","ipa":"/kʊk/","gloss":"cozinheiro"}]'::jsonb, 'He cooks very well.', 'Ele cozinha muito bem.'),
  ('unit-1000-words-a1-36-05', 'lesson-1000-words-a1-36', 5, 'word', 'open', 'abrir', '/ˈoʊpən/', NULL, '[]'::jsonb, '[{"surface":"open","pos":"verb","ipa":"/ˈoʊpən/","gloss":"abrir"}]'::jsonb, 'Open the window.', 'Abra a janela.'),
  ('unit-1000-words-a1-36-06', 'lesson-1000-words-a1-36', 6, 'word', 'close', 'fechar', '/kloʊz/', NULL, '[]'::jsonb, '[{"surface":"close","pos":"verb","ipa":"/kloʊz/","gloss":"fechar"}]'::jsonb, 'Close the door.', 'Feche a porta.'),
  ('unit-1000-words-a1-36-07', 'lesson-1000-words-a1-36', 7, 'word', 'fix', 'consertar', '/fɪks/', NULL, '[]'::jsonb, '[{"surface":"fix","pos":"verb","ipa":"/fɪks/","gloss":"consertar"}]'::jsonb, 'Can you fix my bike?', 'Pode consertar minha bicicleta?'),
  ('unit-1000-words-a1-36-08', 'lesson-1000-words-a1-36', 8, 'word', 'break', 'quebrar', '/breɪk/', NULL, '[]'::jsonb, '[{"surface":"break","pos":"noun","ipa":"/breɪk/","gloss":"pausa, intervalo"}]'::jsonb, 'Don''t break it.', 'Não quebre.'),
  ('unit-1000-words-a1-36-09', 'lesson-1000-words-a1-36', 9, 'word', 'build', 'construir', '/bɪld/', NULL, '[]'::jsonb, '[{"surface":"build","pos":"verb","ipa":"/bɪld/","gloss":"construir"}]'::jsonb, 'They build houses.', 'Eles constroem casas.'),
  ('unit-1000-words-a1-36-10', 'lesson-1000-words-a1-36', 10, 'word', 'cut', 'cortar', '/kʌt/', NULL, '[]'::jsonb, '[{"surface":"cut","pos":"verb","ipa":"/kʌt/","gloss":"cortar"}]'::jsonb, 'Cut the bread.', 'Corte o pão.'),
  ('unit-1000-words-a1-36-11', 'lesson-1000-words-a1-36', 11, 'word', 'fill', 'encher, preencher', '/fɪl/', NULL, '[]'::jsonb, '[{"surface":"fill","pos":"verb","ipa":"/fɪl/","gloss":"preencher; obturar"}]'::jsonb, 'Fill the glass.', 'Encha o copo.'),
  ('unit-1000-words-a1-36-12', 'lesson-1000-words-a1-36', 12, 'word', 'empty', 'esvaziar', '/ˈɛmpti/', NULL, '[]'::jsonb, '[{"surface":"empty","pos":"adjective","ipa":"/ˈɛmpti/","gloss":"vazio"}]'::jsonb, 'Empty the trash.', 'Esvazie o lixo.'),
  ('unit-1000-words-a1-36-13', 'lesson-1000-words-a1-36', 13, 'word', 'hang', 'pendurar', '/hæŋ/', NULL, '[]'::jsonb, '[{"surface":"hang","pos":"verb","ipa":"/hæŋ/","gloss":"pendurar"}]'::jsonb, 'Hang your coat here.', 'Pendure o casaco aqui.'),
  ('unit-1000-words-a1-36-14', 'lesson-1000-words-a1-36', 14, 'word', 'plug', 'ligar na tomada', '/plʌɡ/', NULL, '[]'::jsonb, '[{"surface":"plug","pos":"verb","ipa":"/plʌɡ/","gloss":"ligar na tomada"}]'::jsonb, 'Plug in the charger.', 'Coloque o carregador na tomada.'),
  ('unit-1000-words-a1-36-15', 'lesson-1000-words-a1-36', 15, 'word', 'switch', 'ligar, trocar', '/swɪtʃ/', '"Switch on/off" = ligar/desligar.', '[]'::jsonb, '[{"surface":"switch","pos":"verb","ipa":"/swɪtʃ/","gloss":"trocar"}]'::jsonb, 'Switch off the TV.', 'Desligue a TV.'),
  ('unit-1000-words-a1-36-16', 'lesson-1000-words-a1-36', 16, 'word', 'pack', 'fazer a mala', '/pæk/', NULL, '[]'::jsonb, '[{"surface":"pack","pos":"verb","ipa":"/pæk/","gloss":"fazer a mala, empacotar"}]'::jsonb, 'I need to pack.', 'Preciso fazer a mala.'),
  ('unit-1000-words-a1-36-17', 'lesson-1000-words-a1-36', 17, 'word', 'fold', 'dobrar', '/foʊld/', NULL, '[]'::jsonb, '[{"surface":"fold","pos":"verb","ipa":"/foʊld/","gloss":"dobrar"}]'::jsonb, 'Fold the clothes.', 'Dobre as roupas.'),
  ('unit-1000-words-a1-36-18', 'lesson-1000-words-a1-36', 18, 'word', 'sweep', 'varrer', '/swiːp/', NULL, '[]'::jsonb, '[{"surface":"sweep","pos":"verb","ipa":"/swiːp/","gloss":"varrer"}]'::jsonb, 'Sweep the floor.', 'Varra o chão.'),
  ('unit-1000-words-a1-36-19', 'lesson-1000-words-a1-36', 19, 'word', 'feed', 'alimentar', '/fiːd/', NULL, '[]'::jsonb, '[{"surface":"feed","pos":"verb","ipa":"/fiːd/","gloss":"alimentar"}]'::jsonb, 'Feed the cat.', 'Dê comida ao gato.'),
  ('unit-1000-words-a1-36-20', 'lesson-1000-words-a1-36', 20, 'word', 'water', 'regar', '/ˈwɔːtər/', NULL, '[]'::jsonb, '[{"surface":"water","pos":"noun","ipa":"/ˈwɔːtər/","gloss":"água"}]'::jsonb, 'Water the plants.', 'Regue as plantas.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-37', 'course-1000-words-a1', 37, 'Verbos de ação 3: comunicação e mente', 'Falar, pensar e sentir.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-37-01', 'lesson-1000-words-a1-37', 1, 'word', 'say', 'dizer', '/seɪ/', NULL, '[]'::jsonb, '[{"surface":"say","pos":"verb","ipa":"/seɪ/","gloss":"dizer"}]'::jsonb, 'What did you say?', 'O que você disse?'),
  ('unit-1000-words-a1-37-02', 'lesson-1000-words-a1-37', 2, 'word', 'tell', 'contar, dizer a alguém', '/tɛl/', '"Tell" leva a pessoa; "say" não: "say something to me".', '[]'::jsonb, '[{"surface":"tell","pos":"verb","ipa":"/tɛl/","gloss":"contar, dizer"}]'::jsonb, 'Tell me a story.', 'Me conte uma história.'),
  ('unit-1000-words-a1-37-03', 'lesson-1000-words-a1-37', 3, 'word', 'ask', 'perguntar, pedir', '/æsk/', NULL, '[]'::jsonb, '[{"surface":"ask","pos":"verb","ipa":"/æsk/","gloss":"perguntar, pedir"}]'::jsonb, 'Ask the teacher.', 'Pergunte ao professor.'),
  ('unit-1000-words-a1-37-04', 'lesson-1000-words-a1-37', 4, 'word', 'answer', 'responder', '/ˈænsər/', NULL, '[]'::jsonb, '[{"surface":"answer","pos":"noun","ipa":"/ˈænsər/","gloss":"resposta"}]'::jsonb, 'Answer the phone.', 'Atenda o telefone.'),
  ('unit-1000-words-a1-37-05', 'lesson-1000-words-a1-37', 5, 'word', 'explain', 'explicar', '/ɪkˈspleɪn/', '"Explain to me", nunca "explain me".', '[]'::jsonb, '[{"surface":"explain","pos":"verb","ipa":"/ɪkˈspleɪn/","gloss":"explicar"}]'::jsonb, 'Can you explain it?', 'Pode explicar?'),
  ('unit-1000-words-a1-37-06', 'lesson-1000-words-a1-37', 6, 'word', 'talk', 'conversar', '/tɔːk/', NULL, '[]'::jsonb, '[{"surface":"talk","pos":"verb","ipa":"/tɔːk/","gloss":"falar"}]'::jsonb, 'Let''s talk later.', 'Vamos conversar depois.'),
  ('unit-1000-words-a1-37-07', 'lesson-1000-words-a1-37', 7, 'word', 'call', 'ligar', '/kɔːl/', NULL, '[]'::jsonb, '[{"surface":"call","pos":"noun","ipa":"/kɔːl/","gloss":"chamada, call"}]'::jsonb, 'Call me tonight.', 'Me ligue hoje à noite.'),
  ('unit-1000-words-a1-37-08', 'lesson-1000-words-a1-37', 8, 'word', 'shout', 'gritar', '/ʃaʊt/', NULL, '[]'::jsonb, '[{"surface":"shout","pos":"verb","ipa":"/ʃaʊt/","gloss":"gritar"}]'::jsonb, 'Don''t shout!', 'Não grite!'),
  ('unit-1000-words-a1-37-09', 'lesson-1000-words-a1-37', 9, 'word', 'whisper', 'sussurrar', '/ˈwɪspər/', NULL, '[]'::jsonb, '[{"surface":"whisper","pos":"verb","ipa":"/ˈwɪspər/","gloss":"sussurrar"}]'::jsonb, 'She whispered a secret.', 'Ela sussurrou um segredo.'),
  ('unit-1000-words-a1-37-10', 'lesson-1000-words-a1-37', 10, 'word', 'think', 'pensar, achar', '/θɪŋk/', NULL, '[]'::jsonb, '[{"surface":"think","pos":"verb","ipa":"/θɪŋk/","gloss":"achar, pensar"}]'::jsonb, 'I think so.', 'Acho que sim.'),
  ('unit-1000-words-a1-37-11', 'lesson-1000-words-a1-37', 11, 'word', 'know', 'saber, conhecer', '/noʊ/', NULL, '[]'::jsonb, '[{"surface":"know","pos":"verb","ipa":"/noʊ/","gloss":"saber"}]'::jsonb, 'I know the answer.', 'Sei a resposta.'),
  ('unit-1000-words-a1-37-12', 'lesson-1000-words-a1-37', 12, 'word', 'believe', 'acreditar', '/bɪˈliːv/', NULL, '[]'::jsonb, '[{"surface":"believe","pos":"verb","ipa":"/bɪˈliːv/","gloss":"acreditar"}]'::jsonb, 'I believe you.', 'Acredito em você.'),
  ('unit-1000-words-a1-37-13', 'lesson-1000-words-a1-37', 13, 'word', 'guess', 'adivinhar, achar', '/ɡɛs/', '"I guess" = acho que (informal).', '[]'::jsonb, '[{"surface":"guess","pos":"verb","ipa":"/ɡɛs/","gloss":"adivinhar, achar"}]'::jsonb, 'Guess what!', 'Adivinha!'),
  ('unit-1000-words-a1-37-14', 'lesson-1000-words-a1-37', 14, 'word', 'remember', 'lembrar', '/rɪˈmɛmbər/', NULL, '[]'::jsonb, '[{"surface":"remember","pos":"verb","ipa":"/rɪˈmɛmbər/","gloss":"lembrar"}]'::jsonb, 'Remember to call.', 'Lembre de ligar.'),
  ('unit-1000-words-a1-37-15', 'lesson-1000-words-a1-37', 15, 'word', 'forget', 'esquecer', '/fərˈɡɛt/', NULL, '[]'::jsonb, '[{"surface":"forget","pos":"verb","ipa":"/fərˈɡɛt/","gloss":"esquecer"}]'::jsonb, 'Don''t forget.', 'Não esqueça.'),
  ('unit-1000-words-a1-37-16', 'lesson-1000-words-a1-37', 16, 'word', 'decide', 'decidir', '/dɪˈsaɪd/', NULL, '[]'::jsonb, '[{"surface":"decide","pos":"verb","ipa":"/dɪˈsaɪd/","gloss":"decidir"}]'::jsonb, 'You decide.', 'Você decide.'),
  ('unit-1000-words-a1-37-17', 'lesson-1000-words-a1-37', 17, 'word', 'agree', 'concordar', '/əˈɡriː/', NULL, '[]'::jsonb, '[{"surface":"agree","pos":"verb","ipa":"/əˈɡriː/","gloss":"concordar"}]'::jsonb, 'I agree.', 'Concordo.'),
  ('unit-1000-words-a1-37-18', 'lesson-1000-words-a1-37', 18, 'word', 'hope', 'esperar (ter esperança)', '/hoʊp/', NULL, '[]'::jsonb, '[{"surface":"hope","pos":"verb","ipa":"/hoʊp/","gloss":"esperar (ter esperança)"}]'::jsonb, 'I hope so.', 'Espero que sim.'),
  ('unit-1000-words-a1-37-19', 'lesson-1000-words-a1-37', 19, 'word', 'wish', 'desejar', '/wɪʃ/', NULL, '[]'::jsonb, '[{"surface":"wish","pos":"verb","ipa":"/wɪʃ/","gloss":"desejar"}]'::jsonb, 'I wish you luck.', 'Te desejo sorte.'),
  ('unit-1000-words-a1-37-20', 'lesson-1000-words-a1-37', 20, 'word', 'promise', 'prometer', '/ˈprɑːmɪs/', NULL, '[]'::jsonb, '[{"surface":"promise","pos":"verb","ipa":"/ˈprɑːmɪs/","gloss":"prometer"}]'::jsonb, 'I promise.', 'Prometo.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-38', 'course-1000-words-a1', 38, 'Adjetivos opostos 1', 'Pares de adjetivos do dia a dia.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-38-01', 'lesson-1000-words-a1-38', 1, 'word', 'good', 'bom', '/ɡʊd/', 'Oposto: "bad".', '[]'::jsonb, '[{"surface":"good","pos":"adjective","ipa":"/ɡʊd/","gloss":"bom"}]'::jsonb, 'This is a good idea.', 'Esta é uma boa ideia.'),
  ('unit-1000-words-a1-38-02', 'lesson-1000-words-a1-38', 2, 'word', 'bad', 'ruim', '/bæd/', NULL, '[]'::jsonb, '[{"surface":"bad","pos":"adjective","ipa":"/bæd/","gloss":"ruim"}]'::jsonb, 'The weather is bad.', 'O tempo está ruim.'),
  ('unit-1000-words-a1-38-03', 'lesson-1000-words-a1-38', 3, 'word', 'new', 'novo', '/nuː/', 'Oposto: "old".', '[]'::jsonb, '[{"surface":"new","pos":"adjective","ipa":"/nuː/","gloss":"novo"}]'::jsonb, 'I have a new phone.', 'Tenho um celular novo.'),
  ('unit-1000-words-a1-38-04', 'lesson-1000-words-a1-38', 4, 'word', 'old', 'velho', '/oʊld/', NULL, '[]'::jsonb, '[{"surface":"old","pos":"adjective","ipa":"/oʊld/","gloss":"velho; de idade"}]'::jsonb, 'This is an old house.', 'Esta é uma casa velha.'),
  ('unit-1000-words-a1-38-05', 'lesson-1000-words-a1-38', 5, 'word', 'hot', 'quente', '/hɑːt/', 'Oposto: "cold".', '[]'::jsonb, '[{"surface":"hot","pos":"adjective","ipa":"/hɑːt/","gloss":"quente"}]'::jsonb, 'The coffee is hot.', 'O café está quente.'),
  ('unit-1000-words-a1-38-06', 'lesson-1000-words-a1-38', 6, 'word', 'cold', 'frio', '/koʊld/', NULL, '[]'::jsonb, '[{"surface":"cold","pos":"noun","ipa":"/koʊld/","gloss":"resfriado; frio"}]'::jsonb, 'The water is cold.', 'A água está fria.'),
  ('unit-1000-words-a1-38-07', 'lesson-1000-words-a1-38', 7, 'word', 'easy', 'fácil', '/ˈiːzi/', 'Oposto: "difficult" ou "hard".', '[]'::jsonb, '[{"surface":"easy","pos":"adjective","ipa":"/ˈiːzi/","gloss":"fácil, tranquilo"}]'::jsonb, 'The test was easy.', 'A prova foi fácil.'),
  ('unit-1000-words-a1-38-08', 'lesson-1000-words-a1-38', 8, 'word', 'difficult', 'difícil', '/ˈdɪfɪkəlt/', NULL, '[]'::jsonb, '[{"surface":"difficult","pos":"adjective","ipa":"/ˈdɪfɪkəlt/","gloss":"difícil"}]'::jsonb, 'English is not difficult.', 'Inglês não é difícil.'),
  ('unit-1000-words-a1-38-09', 'lesson-1000-words-a1-38', 9, 'word', 'fast', 'rápido', '/fæst/', 'Oposto: "slow".', '[]'::jsonb, '[{"surface":"fast","pos":"adverb","ipa":"/fæst/","gloss":"rápido"}]'::jsonb, 'This car is fast.', 'Este carro é rápido.'),
  ('unit-1000-words-a1-38-10', 'lesson-1000-words-a1-38', 10, 'word', 'slow', 'lento', '/sloʊ/', NULL, '[]'::jsonb, '[{"surface":"slow","pos":"adjective","ipa":"/sloʊ/","gloss":"lento"}]'::jsonb, 'The internet is slow.', 'A internet está lenta.'),
  ('unit-1000-words-a1-38-11', 'lesson-1000-words-a1-38', 11, 'word', 'open', 'aberto', '/ˈoʊpən/', 'Oposto: "closed".', '[]'::jsonb, '[{"surface":"open","pos":"verb","ipa":"/ˈoʊpən/","gloss":"abrir"}]'::jsonb, 'The store is open.', 'A loja está aberta.'),
  ('unit-1000-words-a1-38-12', 'lesson-1000-words-a1-38', 12, 'word', 'closed', 'fechado', '/kloʊzd/', NULL, '[]'::jsonb, '[{"surface":"closed","pos":"verb","ipa":"/kloʊzd/","gloss":"fechou, fechado"}]'::jsonb, 'The bank is closed.', 'O banco está fechado.'),
  ('unit-1000-words-a1-38-13', 'lesson-1000-words-a1-38', 13, 'word', 'full', 'cheio', '/fʊl/', 'Oposto: "empty".', '[]'::jsonb, '[{"surface":"full","pos":"adjective","ipa":"/fʊl/","gloss":"cheio"}]'::jsonb, 'The bus is full.', 'O ônibus está cheio.'),
  ('unit-1000-words-a1-38-14', 'lesson-1000-words-a1-38', 14, 'word', 'empty', 'vazio', '/ˈɛmpti/', NULL, '[]'::jsonb, '[{"surface":"empty","pos":"adjective","ipa":"/ˈɛmpti/","gloss":"vazio"}]'::jsonb, 'The room is empty.', 'A sala está vazia.'),
  ('unit-1000-words-a1-38-15', 'lesson-1000-words-a1-38', 15, 'word', 'clean', 'limpo', '/kliːn/', 'Oposto: "dirty".', '[]'::jsonb, '[{"surface":"clean","pos":"verb","ipa":"/kliːn/","gloss":"limpar"}]'::jsonb, 'The kitchen is clean.', 'A cozinha está limpa.'),
  ('unit-1000-words-a1-38-16', 'lesson-1000-words-a1-38', 16, 'word', 'dirty', 'sujo', '/ˈdɜːrti/', NULL, '[]'::jsonb, '[{"surface":"dirty","pos":"adjective","ipa":"/ˈdɜːrti/","gloss":"sujo"}]'::jsonb, 'My shoes are dirty.', 'Meus sapatos estão sujos.'),
  ('unit-1000-words-a1-38-17', 'lesson-1000-words-a1-38', 17, 'word', 'early', 'cedo', '/ˈɜːrli/', 'Oposto: "late".', '[]'::jsonb, '[{"surface":"early","pos":"adverb","ipa":"/ˈɜːrli/","gloss":"cedo"}]'::jsonb, 'I got up early.', 'Levantei cedo.'),
  ('unit-1000-words-a1-38-18', 'lesson-1000-words-a1-38', 18, 'word', 'late', 'tarde, atrasado', '/leɪt/', NULL, '[]'::jsonb, '[{"surface":"late","pos":"adjective","ipa":"/leɪt/","gloss":"atrasado"}]'::jsonb, 'It is late.', 'Está tarde.'),
  ('unit-1000-words-a1-38-19', 'lesson-1000-words-a1-38', 19, 'word', 'right', 'certo', '/raɪt/', 'Oposto: "wrong".', '[]'::jsonb, '[{"surface":"right","pos":"adverb","ipa":"/raɪt/","gloss":"bem; né? (right?)"}]'::jsonb, 'You are right.', 'Você tem razão.'),
  ('unit-1000-words-a1-38-20', 'lesson-1000-words-a1-38', 20, 'word', 'wrong', 'errado', '/rɔːŋ/', NULL, '[]'::jsonb, '[{"surface":"wrong","pos":"adjective","ipa":"/rɔːŋ/","gloss":"errado"}]'::jsonb, 'That is the wrong answer.', 'Essa é a resposta errada.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-39', 'course-1000-words-a1', 39, 'Adjetivos opostos 2', 'Mais pares para descrever o mundo.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-39-01', 'lesson-1000-words-a1-39', 1, 'word', 'rich', 'rico', '/rɪtʃ/', 'Oposto: "poor".', '[]'::jsonb, '[{"surface":"rich","pos":"adjective","ipa":"/rɪtʃ/","gloss":"rico"}]'::jsonb, 'He is very rich.', 'Ele é muito rico.'),
  ('unit-1000-words-a1-39-02', 'lesson-1000-words-a1-39', 2, 'word', 'poor', 'pobre', '/pʊr/', NULL, '[]'::jsonb, '[{"surface":"poor","pos":"adjective","ipa":"/pʊr/","gloss":"pobre"}]'::jsonb, 'The area is poor.', 'A região é pobre.'),
  ('unit-1000-words-a1-39-03', 'lesson-1000-words-a1-39', 3, 'word', 'strong', 'forte', '/strɔːŋ/', 'Oposto: "weak".', '[]'::jsonb, '[{"surface":"strong","pos":"adjective","ipa":"/strɔːŋ/","gloss":"forte"}]'::jsonb, 'This coffee is strong.', 'Este café está forte.'),
  ('unit-1000-words-a1-39-04', 'lesson-1000-words-a1-39', 4, 'word', 'weak', 'fraco', '/wiːk/', NULL, '[]'::jsonb, '[{"surface":"weak","pos":"adjective","ipa":"/wiːk/","gloss":"fraco"}]'::jsonb, 'The signal is weak.', 'O sinal está fraco.'),
  ('unit-1000-words-a1-39-05', 'lesson-1000-words-a1-39', 5, 'word', 'loud', 'alto (som)', '/laʊd/', 'Oposto: "quiet". Som alto é "loud", não "high".', '[]'::jsonb, '[{"surface":"loud","pos":"adjective","ipa":"/laʊd/","gloss":"alto (som)"}]'::jsonb, 'The music is too loud.', 'A música está alta demais.'),
  ('unit-1000-words-a1-39-06', 'lesson-1000-words-a1-39', 6, 'word', 'quiet', 'silencioso', '/ˈkwaɪət/', NULL, '[]'::jsonb, '[{"surface":"quiet","pos":"adjective","ipa":"/ˈkwaɪət/","gloss":"quieto"}]'::jsonb, 'The library is quiet.', 'A biblioteca é silenciosa.'),
  ('unit-1000-words-a1-39-07', 'lesson-1000-words-a1-39', 7, 'word', 'safe', 'seguro', '/seɪf/', 'Oposto: "dangerous".', '[]'::jsonb, '[{"surface":"safe","pos":"adjective","ipa":"/seɪf/","gloss":"seguro"}]'::jsonb, 'This area is safe.', 'Esta região é segura.'),
  ('unit-1000-words-a1-39-08', 'lesson-1000-words-a1-39', 8, 'word', 'dangerous', 'perigoso', '/ˈdeɪndʒərəs/', NULL, '[]'::jsonb, '[{"surface":"dangerous","pos":"adjective","ipa":"/ˈdeɪndʒərəs/","gloss":"perigoso"}]'::jsonb, 'That road is dangerous.', 'Aquela estrada é perigosa.'),
  ('unit-1000-words-a1-39-09', 'lesson-1000-words-a1-39', 9, 'word', 'true', 'verdadeiro', '/truː/', 'Oposto: "false".', '[]'::jsonb, '[{"surface":"true","pos":"adjective","ipa":"/truː/","gloss":"verdadeiro"}]'::jsonb, 'Is it true?', 'É verdade?'),
  ('unit-1000-words-a1-39-10', 'lesson-1000-words-a1-39', 10, 'word', 'false', 'falso', '/fɔːls/', NULL, '[]'::jsonb, '[{"surface":"false","pos":"adjective","ipa":"/fɔːls/","gloss":"falso"}]'::jsonb, 'That is false.', 'Isso é falso.'),
  ('unit-1000-words-a1-39-11', 'lesson-1000-words-a1-39', 11, 'word', 'same', 'mesmo, igual', '/seɪm/', 'Oposto: "different".', '[]'::jsonb, '[{"surface":"same","pos":"adjective","ipa":"/seɪm/","gloss":"mesmo"}]'::jsonb, 'We have the same car.', 'Temos o mesmo carro.'),
  ('unit-1000-words-a1-39-12', 'lesson-1000-words-a1-39', 12, 'word', 'different', 'diferente', '/ˈdɪfərənt/', NULL, '[]'::jsonb, '[{"surface":"different","pos":"adjective","ipa":"/ˈdɪfərənt/","gloss":"diferente"}]'::jsonb, 'This one is different.', 'Este é diferente.'),
  ('unit-1000-words-a1-39-13', 'lesson-1000-words-a1-39', 13, 'word', 'hard', 'duro, difícil', '/hɑːrd/', 'Oposto: "soft".', '[]'::jsonb, '[{"surface":"hard","pos":"adjective","ipa":"/hɑːrd/","gloss":"duro, difícil"}]'::jsonb, 'The bed is too hard.', 'A cama está dura demais.'),
  ('unit-1000-words-a1-39-14', 'lesson-1000-words-a1-39', 14, 'word', 'soft', 'macio, suave', '/sɔːft/', NULL, '[]'::jsonb, '[{"surface":"soft","pos":"adjective","ipa":"/sɔːft/","gloss":"macio"}]'::jsonb, 'The pillow is soft.', 'O travesseiro é macio.'),
  ('unit-1000-words-a1-39-15', 'lesson-1000-words-a1-39', 15, 'word', 'wet', 'molhado', '/wɛt/', 'Oposto: "dry".', '[]'::jsonb, '[{"surface":"wet","pos":"adjective","ipa":"/wɛt/","gloss":"molhado"}]'::jsonb, 'My shoes are wet.', 'Meus sapatos estão molhados.'),
  ('unit-1000-words-a1-39-16', 'lesson-1000-words-a1-39', 16, 'word', 'dry', 'seco', '/draɪ/', NULL, '[]'::jsonb, '[{"surface":"dry","pos":"verb","ipa":"/draɪ/","gloss":"secar; seco"}]'::jsonb, 'The towel is dry.', 'A toalha está seca.'),
  ('unit-1000-words-a1-39-17', 'lesson-1000-words-a1-39', 17, 'word', 'busy', 'ocupado', '/ˈbɪzi/', 'Oposto: "free".', '[]'::jsonb, '[{"surface":"busy","pos":"adjective","ipa":"/ˈbɪzi/","gloss":"ocupado"}]'::jsonb, 'I am busy today.', 'Estou ocupado hoje.'),
  ('unit-1000-words-a1-39-18', 'lesson-1000-words-a1-39', 18, 'word', 'free', 'livre; grátis', '/friː/', '"Free" também é grátis.', '[]'::jsonb, '[{"surface":"free","pos":"adjective","ipa":"/friː/","gloss":"livre, disponível"}]'::jsonb, 'Are you free tonight?', 'Você está livre hoje à noite?'),
  ('unit-1000-words-a1-39-19', 'lesson-1000-words-a1-39', 19, 'word', 'happy', 'feliz', '/ˈhæpi/', 'Oposto: "sad".', '[]'::jsonb, '[{"surface":"happy","pos":"adjective","ipa":"/ˈhæpi/","gloss":"feliz"}]'::jsonb, 'I am so happy.', 'Estou muito feliz.'),
  ('unit-1000-words-a1-39-20', 'lesson-1000-words-a1-39', 20, 'word', 'sad', 'triste', '/sæd/', NULL, '[]'::jsonb, '[{"surface":"sad","pos":"adjective","ipa":"/sæd/","gloss":"triste"}]'::jsonb, 'Why are you sad?', 'Por que você está triste?')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-40', 'course-1000-words-a1', 40, 'Advérbios de tempo e frequência', 'Quando e com que frequência.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-40-01', 'lesson-1000-words-a1-40', 1, 'word', 'always', 'sempre', '/ˈɔːlweɪz/', 'Vem antes do verbo principal e depois de "to be".', '[]'::jsonb, '[{"surface":"always","pos":"adverb","ipa":"/ˈɔːlweɪz/","gloss":"sempre"}]'::jsonb, 'I always drink coffee.', 'Sempre tomo café.'),
  ('unit-1000-words-a1-40-02', 'lesson-1000-words-a1-40', 2, 'word', 'usually', 'geralmente', '/ˈjuːʒuəli/', NULL, '[]'::jsonb, '[{"surface":"usually","pos":"adverb","ipa":"/ˈjuːʒuəli/","gloss":"geralmente"}]'::jsonb, 'I usually walk to work.', 'Geralmente vou a pé ao trabalho.'),
  ('unit-1000-words-a1-40-03', 'lesson-1000-words-a1-40', 3, 'word', 'often', 'com frequência', '/ˈɔːfən/', NULL, '[]'::jsonb, '[{"surface":"often","pos":"adverb","ipa":"/ˈɔːfən/","gloss":"frequentemente"}]'::jsonb, 'We often eat out.', 'Comemos fora com frequência.'),
  ('unit-1000-words-a1-40-04', 'lesson-1000-words-a1-40', 4, 'word', 'sometimes', 'às vezes', '/ˈsʌmtaɪmz/', NULL, '[]'::jsonb, '[{"surface":"sometimes","pos":"adverb","ipa":"/ˈsʌmtaɪmz/","gloss":"às vezes"}]'::jsonb, 'Sometimes I work late.', 'Às vezes trabalho até tarde.'),
  ('unit-1000-words-a1-40-05', 'lesson-1000-words-a1-40', 5, 'word', 'rarely', 'raramente', '/ˈrɛrli/', NULL, '[]'::jsonb, '[{"surface":"rarely","pos":"adverb","ipa":"/ˈrɛrli/","gloss":"raramente"}]'::jsonb, 'I rarely watch TV.', 'Raramente assisto TV.'),
  ('unit-1000-words-a1-40-06', 'lesson-1000-words-a1-40', 6, 'word', 'never', 'nunca', '/ˈnɛvər/', 'Já é negativo: o verbo fica afirmativo.', '[]'::jsonb, '[{"surface":"never","pos":"adverb","ipa":"/ˈnɛvər/","gloss":"nunca"}]'::jsonb, 'I never smoke.', 'Nunca fumo.'),
  ('unit-1000-words-a1-40-07', 'lesson-1000-words-a1-40', 7, 'word', 'now', 'agora', '/naʊ/', NULL, '[]'::jsonb, '[{"surface":"now","pos":"adverb","ipa":"/naʊ/","gloss":"agora"}]'::jsonb, 'I am busy now.', 'Estou ocupado agora.'),
  ('unit-1000-words-a1-40-08', 'lesson-1000-words-a1-40', 8, 'word', 'today', 'hoje', '/təˈdeɪ/', NULL, '[]'::jsonb, '[{"surface":"today","pos":"adverb","ipa":"/təˈdeɪ/","gloss":"hoje"}]'::jsonb, 'What''s the date today?', 'Que dia é hoje?'),
  ('unit-1000-words-a1-40-09', 'lesson-1000-words-a1-40', 9, 'word', 'tomorrow', 'amanhã', '/təˈmɑːroʊ/', NULL, '[]'::jsonb, '[{"surface":"tomorrow","pos":"adverb","ipa":"/təˈmɑːroʊ/","gloss":"amanhã"}]'::jsonb, 'See you tomorrow.', 'Até amanhã.'),
  ('unit-1000-words-a1-40-10', 'lesson-1000-words-a1-40', 10, 'word', 'yesterday', 'ontem', '/ˈjɛstərdeɪ/', NULL, '[]'::jsonb, '[{"surface":"yesterday","pos":"adverb","ipa":"/ˈjɛstərdeɪ/","gloss":"ontem"}]'::jsonb, 'I called you yesterday.', 'Te liguei ontem.'),
  ('unit-1000-words-a1-40-11', 'lesson-1000-words-a1-40', 11, 'word', 'soon', 'logo, em breve', '/suːn/', NULL, '[]'::jsonb, '[{"surface":"soon","pos":"adverb","ipa":"/suːn/","gloss":"logo"}]'::jsonb, 'See you soon.', 'Até logo.'),
  ('unit-1000-words-a1-40-12', 'lesson-1000-words-a1-40', 12, 'word', 'later', 'mais tarde', '/ˈleɪtər/', NULL, '[]'::jsonb, '[{"surface":"later","pos":"adverb","ipa":"/ˈleɪtər/","gloss":"mais tarde"}]'::jsonb, 'Call me later.', 'Me liga mais tarde.'),
  ('unit-1000-words-a1-40-13', 'lesson-1000-words-a1-40', 13, 'word', 'already', 'já', '/ɔːlˈrɛdi/', NULL, '[]'::jsonb, '[{"surface":"already","pos":"adverb","ipa":"/ɔːlˈrɛdi/","gloss":"já"}]'::jsonb, 'I have already eaten.', 'Já comi.'),
  ('unit-1000-words-a1-40-14', 'lesson-1000-words-a1-40', 14, 'word', 'yet', 'ainda; já (pergunta)', '/jɛt/', 'Negativa: "not yet" = ainda não.', '[]'::jsonb, '[{"surface":"yet","pos":"adverb","ipa":"/jɛt/","gloss":"ainda"}]'::jsonb, 'Have you finished yet?', 'Você já terminou?'),
  ('unit-1000-words-a1-40-15', 'lesson-1000-words-a1-40', 15, 'word', 'still', 'ainda', '/stɪl/', NULL, '[]'::jsonb, '[{"surface":"still","pos":"adverb","ipa":"/stɪl/","gloss":"ainda"}]'::jsonb, 'I still live here.', 'Ainda moro aqui.'),
  ('unit-1000-words-a1-40-16', 'lesson-1000-words-a1-40', 16, 'word', 'again', 'de novo', '/əˈɡɛn/', NULL, '[]'::jsonb, '[{"surface":"again","pos":"adverb","ipa":"/əˈɡɛn/","gloss":"de novo"}]'::jsonb, 'Say it again.', 'Diga de novo.'),
  ('unit-1000-words-a1-40-17', 'lesson-1000-words-a1-40', 17, 'word', 'once', 'uma vez', '/wʌns/', NULL, '[]'::jsonb, '[{"surface":"once","pos":"adverb","ipa":"/wʌns/","gloss":"uma vez"}]'::jsonb, 'I have been there once.', 'Já estive lá uma vez.'),
  ('unit-1000-words-a1-40-18', 'lesson-1000-words-a1-40', 18, 'word', 'twice', 'duas vezes', '/twaɪs/', NULL, '[]'::jsonb, '[{"surface":"twice","pos":"adverb","ipa":"/twaɪs/","gloss":"duas vezes"}]'::jsonb, 'I brush my teeth twice a day.', 'Escovo os dentes duas vezes por dia.'),
  ('unit-1000-words-a1-40-19', 'lesson-1000-words-a1-40', 19, 'word', 'recently', 'recentemente', '/ˈriːsəntli/', NULL, '[]'::jsonb, '[{"surface":"recently","pos":"adverb","ipa":"/ˈriːsəntli/","gloss":"recentemente"}]'::jsonb, 'I moved here recently.', 'Me mudei para cá recentemente.'),
  ('unit-1000-words-a1-40-20', 'lesson-1000-words-a1-40', 20, 'word', 'ago', 'atrás (tempo)', '/əˈɡoʊ/', '"Ago" vem depois do período: "two days ago".', '[]'::jsonb, '[{"surface":"ago","pos":"adverb","ipa":"/əˈɡoʊ/","gloss":"atrás (tempo)"}]'::jsonb, 'I arrived two days ago.', 'Cheguei há dois dias.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;
