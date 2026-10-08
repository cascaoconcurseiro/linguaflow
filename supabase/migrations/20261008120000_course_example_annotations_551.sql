-- #551: palavra por palavra também na frase de exemplo (etapa 2 das palavras e formas verbais).
-- Coluna derivada: example_annotations tem o mesmo formato de annotations (surface, pos, ipa, gloss), na ordem da frase.
-- Dicionário = anotações já publicadas (sentido mais frequente de cada palavra) + 150 palavras que só aparecem em exemplos.
-- Não altera textos, traduções, IPA, notas, anotações nem progresso. Rollback: supabase/rollback/course_example_annotations_551.sql. Tabelas temporárias com DROP explícito (o replay do CI roda cada arquivo em autocommit).
ALTER TABLE public.course_units ADD COLUMN IF NOT EXISTS example_annotations jsonb;

CREATE TEMP TABLE _extra_551(w text PRIMARY KEY, pos text, ipa text, gloss text);
INSERT INTO _extra_551(w, pos, ipa, gloss) VALUES
    ('absent','adjective','/ˈæbsənt/','ausente'),('absorb','verb','/əbˈzɔːrb/','absorver'),('age','noun','/eɪdʒ/','idade'),
    ('animals','noun','/ˈænɪməlz/','animais'),('anxiety','noun','/æŋˈzaɪəti/','ansiedade'),('areas','noun','/ˈɛriəz/','áreas'),
    ('arrives','verb','/əˈraɪvz/','chega'),('article','noun','/ˈɑːrtɪkəl/','artigo, matéria'),('attracts','verb','/əˈtrækts/','atrai'),
    ('bakes','verb','/beɪks/','assa'),('bananas','noun','/bəˈnænəz/','bananas'),('banks','noun','/bæŋks/','bancos'),
    ('beating','verb','/ˈbiːtɪŋ/','batendo'),('bees','noun','/biːz/','abelhas'),('blocking','verb','/ˈblɑːkɪŋ/','bloqueando'),
    ('blocks','noun','/blɑːks/','quarteirões'),('brand','noun','/brænd/','marca'),('brazilians','noun','/brəˈzɪliənz/','brasileiros'),
    ('cakes','noun','/keɪks/','bolos'),('chickens','noun','/ˈtʃɪkɪnz/','galinhas'),('chile','proper noun','/ˈtʃɪli/','Chile'),
    ('classes','noun','/ˈklæsɪz/','aulas'),('cob','noun','/kɑːb/','espiga'),('coins','noun','/kɔɪnz/','moedas'),
    ('colors','noun','/ˈkʌlərz/','cores'),('countries','noun','/ˈkʌntriz/','países'),('country','noun','/ˈkʌntri/','país'),
    ('court','noun','/kɔːrt/','tribunal'),('cows','noun','/kaʊz/','vacas'),('cream','noun','/kriːm/','creme'),
    ('dad','noun','/dæd/','pai'),('damage','verb','/ˈdæmɪdʒ/','danificar'),('danger','noun','/ˈdeɪndʒər/','perigo'),
    ('decides','verb','/dɪˈsaɪdz/','decide'),('destroyed','verb','/dɪˈstrɔɪd/','destruiu'),('destroying','verb','/dɪˈstrɔɪɪŋ/','destruindo'),
    ('devices','noun','/dɪˈvaɪsɪz/','aparelhos'),('diet','noun','/ˈdaɪət/','dieta, alimentação'),('diseases','noun','/dɪˈziːzɪz/','doenças'),
    ('distributed','verb','/dɪˈstrɪbjuːtɪd/','distribuída'),('doctor''s','noun','/ˈdɑːktərz/','do médico'),('dollar','noun','/ˈdɑːlər/','dólar'),
    ('ducks','noun','/dʌks/','patos'),('earth','proper noun','/ɜːrθ/','Terra'),('economic','adjective','/ˌɛkəˈnɑːmɪk/','econômico'),
    ('electric','adjective','/ɪˈlɛktrɪk/','elétrico'),('entered','verb','/ˈɛntərd/','entrou em'),('equally','adverb','/ˈiːkwəli/','igualmente'),
    ('essential','adjective','/ɪˈsɛnʃəl/','essencial'),('everyday','adjective','/ˈɛvrideɪ/','do dia a dia'),('failed','verb','/feɪld/','reprovou em'),
    ('farm','noun','/fɑːrm/','fazenda'),('farmers','noun','/ˈfɑːrmərz/','agricultores'),('foggy','adjective','/ˈfɑːɡi/','embaçado'),
    ('forest','noun','/ˈfɔːrɪst/','floresta'),('fried','adjective','/fraɪd/','frito'),('friendship','noun','/ˈfrɛndʃɪp/','amizade'),
    ('fuel','noun','/ˈfjuːəl/','combustível'),('fuels','noun','/ˈfjuːəlz/','combustíveis'),('government','noun','/ˈɡʌvərnmənt/','governo'),
    ('halloween','proper noun','/ˌhæləˈwiːn/','Halloween'),('holds','verb','/hoʊldz/','comporta'),('holiday','noun','/ˈhɑːlədeɪ/','feriado'),
    ('homes','noun','/hoʊmz/','casas'),('illnesses','noun','/ˈɪlnəsɪz/','doenças'),('interviewed','verb','/ˈɪntərvjuːd/','entrevistou'),
    ('itself','pronoun','/ɪtˈsɛlf/','si mesmo, sozinho'),('label','noun','/ˈleɪbəl/','rótulo'),('lake','noun','/leɪk/','lago'),
    ('land','noun','/lænd/','terreno, terra'),('lay','verb','/leɪ/','põem'),('legs','noun','/lɛɡz/','pernas'),
    ('limits','verb','/ˈlɪmɪts/','limita'),('loves','verb','/lʌvz/','ama, adora'),('marriage','noun','/ˈmærɪdʒ/','casamento'),
    ('mashed','adjective','/mæʃt/','amassado, em purê'),('materials','noun','/məˈtɪriəlz/','materiais'),('messages','noun','/ˈmɛsɪdʒɪz/','mensagens'),
    ('millions','noun','/ˈmɪljənz/','milhões'),('misleading','adjective','/mɪsˈliːdɪŋ/','enganoso'),('monkeys','noun','/ˈmʌŋkiz/','macacos'),
    ('negotiate','verb','/nɪˈɡoʊʃieɪt/','negociar'),('newspaper','noun','/ˈnuːzpeɪpər/','jornal'),('nights','noun','/naɪts/','noites'),
    ('olive','noun','/ˈɑːlɪv/','de oliva'),('overnight','adverb','/ˌoʊvərˈnaɪt/','da noite para o dia'),('owes','verb','/oʊz/','deve'),
    ('pages','noun','/ˈpeɪdʒɪz/','páginas'),('paragraphs','noun','/ˈpærəɡræfs/','parágrafos'),('peanut','noun','/ˈpiːnʌt/','amendoim'),
    ('pets','noun','/pɛts/','animais de estimação'),('planet','noun','/ˈplænɪt/','planeta'),('plays','verb','/pleɪz/','joga, toca'),
    ('potatoes','noun','/pəˈteɪtoʊz/','batatas'),('power','noun','/ˈpaʊər/','energia, poder'),('prevents','verb','/prɪˈvɛnts/','previne'),
    ('projects','noun','/ˈprɑːdʒɛkts/','projetos'),('promoted','verb','/prəˈmoʊtɪd/','promoveu'),('protects','verb','/prəˈtɛkts/','protege'),
    ('raising','verb','/ˈreɪzɪŋ/','criar'),('raw','adjective','/rɔː/','cru, bruto'),('regular','adjective','/ˈrɛɡjələr/','regular'),
    ('relationship','noun','/rɪˈleɪʃənʃɪp/','relacionamento'),('resource','noun','/ˈriːsɔːrs/','recurso'),('rides','verb','/raɪdz/','anda de, cavalga'),
    ('rises','verb','/ˈraɪzɪz/','nasce, sobe'),('ruin','verb','/ˈruːɪn/','arruinar'),('sauce','noun','/sɔːs/','molho'),
    ('scientists','noun','/ˈsaɪəntɪsts/','cientistas'),('shapes','verb','/ʃeɪps/','molda'),('sharing','verb','/ˈʃɛrɪŋ/','compartilhar'),
    ('sharks','noun','/ʃɑːrks/','tubarões'),('shaves','verb','/ʃeɪvz/','se barbeia'),('sheet','noun','/ʃiːt/','folha'),
    ('sisters','noun','/ˈsɪstərz/','irmãs'),('skilled','adjective','/skɪld/','qualificado'),('skills','noun','/skɪlz/','habilidades'),
    ('sleeps','verb','/sliːps/','dorme'),('slowed','verb','/sloʊd/','desacelerou'),('softer','adjective','/ˈsɔːftər/','mais macio'),
    ('solar','adjective','/ˈsoʊlər/','solar'),('spending','verb','/ˈspɛndɪŋ/','gastando'),('spiders','noun','/ˈspaɪdərz/','aranhas'),
    ('stadium','noun','/ˈsteɪdiəm/','estádio'),('staff','noun','/stæf/','equipe'),('state','noun','/steɪt/','Estado'),
    ('stiff','adjective','/stɪf/','rígido, duro'),('stomachache','noun','/ˈstʌməkeɪk/','dor de estômago'),('stored','verb','/stɔːrd/','armazenados'),
    ('students','noun','/ˈstuːdənts/','alunos'),('suffers','verb','/ˈsʌfərz/','sofre'),('temperature','noun','/ˈtɛmprətʃər/','temperatura'),
    ('tender','adjective','/ˈtɛndər/','macio, tenro'),('today''s','adjective','/təˈdeɪz/','de hoje'),('trees','noun','/triːz/','árvores'),
    ('tv','noun','/ˌtiːˈviː/','TV'),('updates','verb','/ʌpˈdeɪts/','se atualiza'),('users','noun','/ˈjuːzərz/','usuários'),
    ('uses','verb','/ˈjuːzɪz/','usa'),('vase','noun','/veɪs/','vaso'),('verbs','noun','/vɜːrbz/','verbos'),
    ('walls','noun','/wɔːlz/','paredes'),('warms','verb','/wɔːrmz/','aquece'),('waterproof','adjective','/ˈwɔːtərpruːf/','impermeável'),
    ('wears','verb','/wɛrz/','veste, usa'),('weekly','adjective','/ˈwiːkli/','semanal'),('whispered','verb','/ˈwɪspərd/','sussurrou'),
    ('witnesses','noun','/ˈwɪtnəsɪz/','testemunhas'),('wool','noun','/wʊl/','lã'),('wore','verb','/wɔːr/','vestia, usava'),
    ('writes','verb','/raɪts/','escreve'),('york','proper noun','/jɔːrk/','York');

CREATE TEMP TABLE _dict_551 AS
SELECT DISTINCT ON (w) w, pos, ipa, gloss FROM (
  SELECT lower(a->>'surface') AS w, a->>'pos' AS pos, a->>'ipa' AS ipa, a->>'gloss' AS gloss, 1 AS pri, count(*) AS c
  FROM public.course_units u, jsonb_array_elements(u.annotations) a GROUP BY 1, 2, 3, 4
  UNION ALL SELECT w, pos, ipa, gloss, 2, 0 FROM _extra_551
) x ORDER BY w, pri, c DESC, gloss;

CREATE TEMP TABLE _tok_551 AS
SELECT u.id, t.ord, regexp_replace(t.tok, '^[^A-Za-z]+|[^A-Za-z'']+$', '', 'g') AS surface
FROM public.course_units u, regexp_split_to_table(trim(u.example_en), '\s+') WITH ORDINALITY AS t(tok, ord)
WHERE u.example_en IS NOT NULL AND trim(u.example_en) <> '';

DO $guard$
DECLARE missing text;
BEGIN
  SELECT string_agg(DISTINCT t.surface, ', ') INTO missing
  FROM _tok_551 t LEFT JOIN _dict_551 d ON d.w = lower(t.surface) WHERE t.surface <> '' AND d.w IS NULL;
  IF missing IS NOT NULL THEN RAISE EXCEPTION 'palavras do exemplo sem dicionário: %', missing; END IF;
END
$guard$;

UPDATE public.course_units u SET example_annotations = built.annotations
FROM (
  SELECT t.id, jsonb_agg(jsonb_build_object('surface', t.surface, 'pos', d.pos, 'ipa', d.ipa, 'gloss', d.gloss) ORDER BY t.ord) AS annotations
  FROM _tok_551 t JOIN _dict_551 d ON d.w = lower(t.surface) WHERE t.surface <> '' GROUP BY t.id
) built WHERE built.id = u.id;

DROP TABLE _tok_551, _dict_551, _extra_551;
