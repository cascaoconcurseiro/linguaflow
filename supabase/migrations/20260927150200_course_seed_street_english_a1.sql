-- ============================================================================
-- Conteúdo inicial: curso "Inglês das Ruas & Gírias Reais" (A1), lição 1.
-- 10 frases com tradução pt-BR, IPA da frase, notas de uso, grupos
-- sintáticos e anotações por palavra. O catálogo só lista o que existe aqui.
-- Idempotente: reaplicar atualiza o conteúdo sem duplicar.
-- ============================================================================

INSERT INTO public.course_catalog (id, slug, title, short_description, long_description, level, category, order_index, is_published)
VALUES (
  'course-street-a1',
  'street-english-slang-a1',
  'Inglês das Ruas & Gírias Reais',
  'Cumprimentos, despedidas e desculpas do jeito que nativos falam: contrações e gírias do dia a dia.',
  'Frases curtas do cotidiano com gírias frequentes ("what''s up", "my bad", "hit me up") e reduções da fala ("gonna", "gotta"). Você ouve, digita palavra por palavra e vê tradução, IPA e explicação de cada expressão.',
  'A1',
  'street-slang',
  1,
  true
)
ON CONFLICT (id) DO UPDATE SET
  slug = EXCLUDED.slug,
  title = EXCLUDED.title,
  short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description,
  level = EXCLUDED.level,
  category = EXCLUDED.category,
  order_index = EXCLUDED.order_index,
  is_published = EXCLUDED.is_published,
  updated_at = now();

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES (
  'lesson-street-a1-01',
  'course-street-a1',
  1,
  'Cumprimentos, chegadas e saídas',
  'Como cumprimentar, avisar que vai embora e pedir desculpas sem soar formal demais.'
)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations)
VALUES
  ('unit-street-a1-01-01', 'lesson-street-a1-01', 1, 'slang_idiom', 'Hey, what''s up? Long time no see!', 'E aí, beleza? Quanto tempo não te vejo!', '/heɪ wʌts ʌp lɔːŋ taɪm noʊ siː/', '"What''s up" é o cumprimento mais comum do inglês moderno. "Long time no see" é uma expressão consagrada.',
   '[{"start":0,"end":4,"role":"discourse_marker","surface":"Hey,"},{"start":5,"end":15,"role":"predicate_verb","surface":"what''s up?"},{"start":16,"end":33,"role":"discourse_marker","surface":"Long time no see!"}]'::jsonb,
   '[{"surface":"Hey","lemma":"hey","pos":"INTJ","ipa":"/heɪ/","gloss":"E aí"},{"surface":"what''s","lemma":"what","pos":"PRON","ipa":"/wʌts/","gloss":"o que é"},{"surface":"up","lemma":"up","pos":"ADV","ipa":"/ʌp/","gloss":"rolando"},{"surface":"Long","lemma":"long","pos":"ADJ","ipa":"/lɔːŋ/","gloss":"longo"},{"surface":"time","lemma":"time","pos":"NOUN","ipa":"/taɪm/","gloss":"tempo"},{"surface":"no","lemma":"no","pos":"ADV","ipa":"/noʊ/","gloss":"não"},{"surface":"see","lemma":"see","pos":"VERB","ipa":"/siː/","gloss":"ver"}]'::jsonb),
  ('unit-street-a1-01-02', 'lesson-street-a1-01', 2, 'slang_idiom', 'I''m gonna bounce, catch you later!', 'Tô vazando, te vejo mais tarde!', '/aɪm ˈɡənə baʊns kætʃ jə ˈleɪtər/', '"Bounce" nas ruas significa ir embora ou vazar. "Catch you later" é o "até mais" informal.',
   '[{"start":0,"end":3,"role":"subject","surface":"I''m"},{"start":4,"end":16,"role":"predicate_verb","surface":"gonna bounce,"},{"start":17,"end":34,"role":"discourse_marker","surface":"catch you later!"}]'::jsonb,
   '[{"surface":"I''m","lemma":"be","pos":"AUX","ipa":"/aɪm/","gloss":"Eu estou"},{"surface":"gonna","lemma":"going to","pos":"VERB","ipa":"/ˈɡənə/","gloss":"vou"},{"surface":"bounce","lemma":"bounce","pos":"VERB","ipa":"/baʊns/","gloss":"vazar / ir embora"},{"surface":"catch","lemma":"catch","pos":"VERB","ipa":"/kætʃ/","gloss":"pegar / ver"},{"surface":"you","lemma":"you","pos":"PRON","ipa":"/jə/","gloss":"você"},{"surface":"later","lemma":"late","pos":"ADV","ipa":"/ˈleɪtər/","gloss":"mais tarde"}]'::jsonb),
  ('unit-street-a1-01-03', 'lesson-street-a1-01', 3, 'slang_idiom', 'Honestly, I''m down to hang out tonight.', 'Sinceramente, tô a fim de dar um rolê hoje à noite.', '/ˈɑːnɪstli aɪm daʊn tə hæŋ aʊt təˈnaɪt/', '"I''m down" significa "eu topo / tô dentro". "Hang out" é passar tempo junto.',
   '[{"start":0,"end":9,"role":"adverbial","surface":"Honestly,"},{"start":10,"end":13,"role":"subject","surface":"I''m"},{"start":14,"end":18,"role":"predicate_adj","surface":"down"},{"start":19,"end":39,"role":"direct_object","surface":"to hang out tonight."}]'::jsonb,
   '[{"surface":"Honestly","lemma":"honestly","pos":"ADV","ipa":"/ˈɑːnɪstli/","gloss":"Sinceramente"},{"surface":"I''m","lemma":"be","pos":"AUX","ipa":"/aɪm/","gloss":"Eu estou"},{"surface":"down","lemma":"down","pos":"ADJ","ipa":"/daʊn/","gloss":"afim / topo"},{"surface":"to","lemma":"to","pos":"PART","ipa":"/tə/","gloss":"de"},{"surface":"hang","lemma":"hang","pos":"VERB","ipa":"/hæŋ/","gloss":"passar tempo"},{"surface":"out","lemma":"out","pos":"ADP","ipa":"/aʊt/","gloss":"fora / rolê"},{"surface":"tonight","lemma":"tonight","pos":"NOUN","ipa":"/təˈnaɪt/","gloss":"hoje à noite"}]'::jsonb),
  ('unit-street-a1-01-04', 'lesson-street-a1-01', 4, 'slang_idiom', 'My bad! I didn''t mean to cut you off.', 'Foi mal! Não tive a intenção de te interromper.', '/maɪ bæd aɪ ˈdɪdənt miːn tə kʌt jə ɔːf/', '"My bad" é a gíria perfeita para "foi mal". "Cut someone off" é interromper a fala de alguém.',
   '[{"start":0,"end":7,"role":"discourse_marker","surface":"My bad!"},{"start":8,"end":9,"role":"subject","surface":"I"},{"start":10,"end":22,"role":"predicate_verb","surface":"didn''t mean"},{"start":23,"end":37,"role":"direct_object","surface":"to cut you off."}]'::jsonb,
   '[{"surface":"My","lemma":"my","pos":"PRON","ipa":"/maɪ/","gloss":"Meu"},{"surface":"bad","lemma":"bad","pos":"NOUN","ipa":"/bæd/","gloss":"erro / foi mal"},{"surface":"I","lemma":"I","pos":"PRON","ipa":"/aɪ/","gloss":"Eu"},{"surface":"didn''t","lemma":"do","pos":"AUX","ipa":"/ˈdɪdənt/","gloss":"não"},{"surface":"mean","lemma":"mean","pos":"VERB","ipa":"/miːn/","gloss":"pretendia"},{"surface":"to","lemma":"to","pos":"PART","ipa":"/tə/","gloss":"de"},{"surface":"cut","lemma":"cut","pos":"VERB","ipa":"/kʌt/","gloss":"cortar"},{"surface":"you","lemma":"you","pos":"PRON","ipa":"/jə/","gloss":"você"},{"surface":"off","lemma":"off","pos":"ADP","ipa":"/ɔːf/","gloss":"fora"}]'::jsonb),
  ('unit-street-a1-01-05', 'lesson-street-a1-01', 5, 'slang_idiom', 'Hit me up as soon as you get home, alright?', 'Me dá um toque assim que chegar em casa, beleza?', '/hɪt mi ʌp æz suːn æz jə ɡɛt hoʊm ɔːlˈraɪt/', '"Hit me up" significa ligar, mandar mensagem ou dar um toque.',
   '[{"start":0,"end":10,"role":"predicate_verb","surface":"Hit me up"},{"start":11,"end":33,"role":"adverbial","surface":"as soon as you get home,"},{"start":34,"end":42,"role":"discourse_marker","surface":"alright?"}]'::jsonb,
   '[{"surface":"Hit","lemma":"hit","pos":"VERB","ipa":"/hɪt/","gloss":"Dar toque"},{"surface":"me","lemma":"I","pos":"PRON","ipa":"/mi/","gloss":"me"},{"surface":"up","lemma":"up","pos":"ADP","ipa":"/ʌp/","gloss":"acima"},{"surface":"as","lemma":"as","pos":"ADP","ipa":"/æz/","gloss":"tão"},{"surface":"soon","lemma":"soon","pos":"ADV","ipa":"/suːn/","gloss":"logo"},{"surface":"as","lemma":"as","pos":"SCONJ","ipa":"/æz/","gloss":"quanto"},{"surface":"you","lemma":"you","pos":"PRON","ipa":"/jə/","gloss":"você"},{"surface":"get","lemma":"get","pos":"VERB","ipa":"/ɡɛt/","gloss":"chegar"},{"surface":"home","lemma":"home","pos":"NOUN","ipa":"/hoʊm/","gloss":"em casa"},{"surface":"alright","lemma":"alright","pos":"ADJ","ipa":"/ɔːlˈraɪt/","gloss":"beleza"}]'::jsonb),
  ('unit-street-a1-01-06', 'lesson-street-a1-01', 6, 'slang_idiom', 'No worries, it''s really not a big deal.', 'Relaxa, não é nada de mais.', '/noʊ ˈwɜːriz ɪts ˈriːəli nɑːt ə bɪɡ diːl/', '"No worries" e "not a big deal" indicam que a situação é irrelevante e não há motivo para estresse.',
   '[{"start":0,"end":10,"role":"discourse_marker","surface":"No worries,"},{"start":11,"end":15,"role":"subject","surface":"it''s"},{"start":16,"end":39,"role":"predicate_adj","surface":"really not a big deal."}]'::jsonb,
   '[{"surface":"No","lemma":"no","pos":"DET","ipa":"/noʊ/","gloss":"Sem"},{"surface":"worries","lemma":"worry","pos":"NOUN","ipa":"/ˈwɜːriz/","gloss":"preocupações"},{"surface":"it''s","lemma":"be","pos":"AUX","ipa":"/ɪts/","gloss":"é"},{"surface":"really","lemma":"really","pos":"ADV","ipa":"/ˈriːəli/","gloss":"realmente"},{"surface":"not","lemma":"not","pos":"PART","ipa":"/nɑːt/","gloss":"não"},{"surface":"a","lemma":"a","pos":"DET","ipa":"/ə/","gloss":"um"},{"surface":"big","lemma":"big","pos":"ADJ","ipa":"/bɪɡ/","gloss":"grande"},{"surface":"deal","lemma":"deal","pos":"NOUN","ipa":"/diːl/","gloss":"negócio / coisa"}]'::jsonb),
  ('unit-street-a1-01-07', 'lesson-street-a1-01', 7, 'slang_idiom', 'I gotta head out before it starts raining.', 'Preciso me mandar antes que comece a chover.', '/aɪ ˈɡɑːtə hɛd aʊt bɪˈfɔːr ɪt stɑːrts ˈreɪnɪŋ/', '"Gotta" é redução de "got to". "Head out" significa partir ou se mandar.',
   '[{"start":0,"end":1,"role":"subject","surface":"I"},{"start":2,"end":16,"role":"predicate_verb","surface":"gotta head out"},{"start":17,"end":42,"role":"adverbial","surface":"before it starts raining."}]'::jsonb,
   '[{"surface":"I","lemma":"I","pos":"PRON","ipa":"/aɪ/","gloss":"Eu"},{"surface":"gotta","lemma":"have got to","pos":"VERB","ipa":"/ˈɡɑːtə/","gloss":"tenho que"},{"surface":"head","lemma":"head","pos":"VERB","ipa":"/hɛd/","gloss":"ir"},{"surface":"out","lemma":"out","pos":"ADP","ipa":"/aʊt/","gloss":"fora / se mandar"},{"surface":"before","lemma":"before","pos":"SCONJ","ipa":"/bɪˈfɔːr/","gloss":"antes que"},{"surface":"it","lemma":"it","pos":"PRON","ipa":"/ɪt/","gloss":"o tempo"},{"surface":"starts","lemma":"start","pos":"VERB","ipa":"/stɑːrts/","gloss":"comece"},{"surface":"raining","lemma":"rain","pos":"VERB","ipa":"/ˈreɪnɪŋ/","gloss":"chover"}]'::jsonb),
  ('unit-street-a1-01-08', 'lesson-street-a1-01', 8, 'slang_idiom', 'Cut him some slack, he''s having a rough day.', 'Dá um desconto pra ele, ele tá tendo um dia puxado.', '/kʌt hɪm səm slæk hiːz ˈhævɪŋ ə rʌf deɪ/', '"Cut someone slack" significa ter paciência ou dar um desconto.',
   '[{"start":0,"end":18,"role":"predicate_verb","surface":"Cut him some slack,"},{"start":19,"end":23,"role":"subject","surface":"he''s"},{"start":24,"end":44,"role":"predicate_verb","surface":"having a rough day."}]'::jsonb,
   '[{"surface":"Cut","lemma":"cut","pos":"VERB","ipa":"/kʌt/","gloss":"Dar"},{"surface":"him","lemma":"he","pos":"PRON","ipa":"/hɪm/","gloss":"ele"},{"surface":"some","lemma":"some","pos":"DET","ipa":"/səm/","gloss":"alguma"},{"surface":"slack","lemma":"slack","pos":"NOUN","ipa":"/slæk/","gloss":"folga / desconto"},{"surface":"he''s","lemma":"be","pos":"AUX","ipa":"/hiːz/","gloss":"ele está"},{"surface":"having","lemma":"have","pos":"VERB","ipa":"/ˈhævɪŋ/","gloss":"tendo"},{"surface":"a","lemma":"a","pos":"DET","ipa":"/ə/","gloss":"um"},{"surface":"rough","lemma":"rough","pos":"ADJ","ipa":"/rʌf/","gloss":"difícil / puxado"},{"surface":"day","lemma":"day","pos":"NOUN","ipa":"/deɪ/","gloss":"dia"}]'::jsonb),
  ('unit-street-a1-01-09', 'lesson-street-a1-01', 9, 'slang_idiom', 'Can you give me a heads up when you''re ready?', 'Você pode me dar um toque quando tiver pronto?', '/kæn jə ɡɪv mi ə hɛdz ʌp wɛn jər ˈrɛdi/', '"A heads up" é um aviso prévio ou toque antecipado.',
   '[{"start":0,"end":7,"role":"subject","surface":"Can you"},{"start":8,"end":28,"role":"predicate_verb","surface":"give me a heads up"},{"start":29,"end":47,"role":"adverbial","surface":"when you''re ready?"}]'::jsonb,
   '[{"surface":"Can","lemma":"can","pos":"AUX","ipa":"/kæn/","gloss":"Pode"},{"surface":"you","lemma":"you","pos":"PRON","ipa":"/jə/","gloss":"você"},{"surface":"give","lemma":"give","pos":"VERB","ipa":"/ɡɪv/","gloss":"dar"},{"surface":"me","lemma":"I","pos":"PRON","ipa":"/mi/","gloss":"me"},{"surface":"a","lemma":"a","pos":"DET","ipa":"/ə/","gloss":"um"},{"surface":"heads","lemma":"head","pos":"NOUN","ipa":"/hɛdz/","gloss":"cabeças"},{"surface":"up","lemma":"up","pos":"ADP","ipa":"/ʌp/","gloss":"aviso prévio"},{"surface":"when","lemma":"when","pos":"SCONJ","ipa":"/wɛn/","gloss":"quando"},{"surface":"you''re","lemma":"be","pos":"AUX","ipa":"/jər/","gloss":"você estiver"},{"surface":"ready","lemma":"ready","pos":"ADJ","ipa":"/ˈrɛdi/","gloss":"pronto"}]'::jsonb),
  ('unit-street-a1-01-10', 'lesson-street-a1-01', 10, 'slang_idiom', 'Let''s call it a day, I''m completely wiped out.', 'Bora encerrar por hoje, tô completamente morto de cansaço.', '/lɛts kɔːl ɪt ə deɪ aɪm kəmˈpliːtli waɪpt aʊt/', '"Call it a day" significa encerrar o expediente ou estudo. "Wiped out" significa exausto.',
   '[{"start":0,"end":20,"role":"predicate_verb","surface":"Let''s call it a day,"},{"start":21,"end":24,"role":"subject","surface":"I''m"},{"start":25,"end":46,"role":"predicate_adj","surface":"completely wiped out."}]'::jsonb,
   '[{"surface":"Let''s","lemma":"let","pos":"VERB","ipa":"/lɛts/","gloss":"Vamos"},{"surface":"call","lemma":"call","pos":"VERB","ipa":"/kɔːl/","gloss":"chamar"},{"surface":"it","lemma":"it","pos":"PRON","ipa":"/ɪt/","gloss":"isso"},{"surface":"a","lemma":"a","pos":"DET","ipa":"/ə/","gloss":"um"},{"surface":"day","lemma":"day","pos":"NOUN","ipa":"/deɪ/","gloss":"dia"},{"surface":"I''m","lemma":"be","pos":"AUX","ipa":"/aɪm/","gloss":"Eu estou"},{"surface":"completely","lemma":"completely","pos":"ADV","ipa":"/kəmˈpliːtli/","gloss":"completamente"},{"surface":"wiped","lemma":"wipe","pos":"VERB","ipa":"/waɪpt/","gloss":"apagado"},{"surface":"out","lemma":"out","pos":"ADP","ipa":"/aʊt/","gloss":"exausto"}]'::jsonb)
ON CONFLICT (id) DO UPDATE SET
  order_index = EXCLUDED.order_index,
  kind = EXCLUDED.kind,
  text = EXCLUDED.text,
  translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa,
  explanation_note = EXCLUDED.explanation_note,
  syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations;
