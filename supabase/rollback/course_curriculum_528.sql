-- Reversão operacional #528: executar numa transação; preserva colunas, conteúdo e histórico.
SET LOCAL lock_timeout='5s';
SET LOCAL statement_timeout='60s';
UPDATE public.course_catalog SET level='A1',title='Inglês das Ruas & Gírias Reais',short_description='Gírias, reduções da fala e expressões que nativos usam de verdade, com o registro e o sentido real de cada uma.',long_description='Frases curtas do cotidiano com gírias frequentes ("what''s up", "my bad", "I''m down"), reduções ("gonna", "wanna", "gotta"), mensagens, dinheiro, cansaço, expressões idiomáticas e como discordar. Cada nota explica o registro (informal ou gíria) e o sentido literal × o real.',updated_at=now() WHERE id='course-street-a1';
UPDATE public.course_catalog SET level='A2',title='Viagem sem Aperto',short_description='Do aeroporto à praia: avião, imigração, hotel e Airbnb, transporte, compras, restaurante, passeios, farmácia e emergências.',long_description='A viagem inteira em situações reais, com o que você diz e o que ouve do outro lado: aeroporto e imigração, táxi, trem e carro alugado, hotel e Airbnb, compras, restaurante, café e bar, passeios e praia, farmácia, direções e emergências. Termina com um capítulo de revisão.',updated_at=now() WHERE id='course-travel-a2';
UPDATE public.course_catalog SET level='B1',title='Inglês no Trabalho',short_description='Reuniões, e-mails, apresentações, feedback, prazos, clientes, entrevista e liderança: o inglês de escritório e trabalho remoto.',long_description='Expressões usadas de verdade no trabalho: conduzir reuniões, escrever e-mails, apresentar resultados, dar feedback, negociar prazos, falar com clientes, fazer entrevista, networking, lidar com conflitos e liderar. Cada nota indica o registro (formal, neutro ou informal).',updated_at=now() WHERE id='course-work-b1';
UPDATE public.course_catalog SET level='A1',title='Primeiras Frases',short_description='Do zero às primeiras frases: apresentar-se, perguntar, negar, pedir, falar da rotina, do que gosta e do passado.',long_description='Monte frases completas desde a primeira aula: verbo "to be", perguntas e negativas, "there is", possessivos, presente simples, "can", imperativo, "like + -ing" e o passado com "was/were". Cada frase vem com a explicação da estrutura.',updated_at=now() WHERE id='course-first-sentences-a1';
UPDATE public.course_catalog SET level='A1',title='1000 Palavras Essenciais',short_description='As palavras mais usadas do inglês, por tema, com significado e frase de exemplo.',long_description='Vocabulário essencial organizado por temas do dia a dia. Você ouve, escreve a palavra e vê como ela aparece numa frase real.',updated_at=now() WHERE id='course-1000-words-a1';
UPDATE public.course_catalog SET level='A1',title='Verbos Essenciais',short_description='Os 100 verbos mais usados em frases separadas por tempo: presente, passado, futuro e present perfect.',long_description='Cada verbo aparece em quatro frases reais, uma por tempo verbal, com a explicação gramatical de cada forma. No fim de cada módulo, você revisa as três formas (base, passado e particípio). São 100 verbos em 10 módulos.',updated_at=now() WHERE id='course-essential-verbs-a1';
UPDATE public.course_catalog SET level='A2',title='Rotina e Vida em Casa',short_description='Acordar, arrumar a casa, cozinhar, hábitos, fim de semana e planos: o inglês da sua rotina.',long_description='Frases do dia a dia em casa com a gramática do nível A2 aplicada: presente simples para hábitos, presente contínuo para o que está acontecendo, passado para contar o fim de semana e "going to" para planos. Cada frase explica a estrutura usada.',updated_at=now() WHERE id='course-routine-a2';
UPDATE public.course_catalog SET level='A2',title='Compras sem Mistério',short_description='Mercado, roupas, pagamento, trocas, compras online e reclamações: tudo que você diz e ouve ao comprar.',long_description='Situações de compra do começo ao fim: achar o produto no mercado, experimentar roupa, pagar, trocar ou devolver, acompanhar uma entrega e reclamar com educação. Cada frase explica a estrutura ou a expressão usada.',updated_at=now() WHERE id='course-shopping-a2';
UPDATE public.course_catalog SET level='A2',title='Saúde e Bem-estar',short_description='Marcar consulta, explicar sintomas, entender a receita, ir ao dentista, cuidar do corpo e lidar com o hospital.',long_description='O inglês que você precisa quando o assunto é saúde: marcar horário, descrever o que sente, entender o que o médico diz, dentista, academia e seguro saúde. Cada frase explica a estrutura ou a expressão usada.',updated_at=now() WHERE id='course-health-a2';
UPDATE public.course_catalog SET level='A2',title='Vida Social',short_description='Conhecer gente, convidar, puxar conversa, elogiar, dar opinião e pedir desculpas com naturalidade.',long_description='As conversas que fazem amizade: apresentar-se e lembrar nomes, convidar e recusar sem ser grosso, conversa fiada, elogios, opiniões e como resolver mal-entendidos. Cada frase explica o registro e a estrutura.',updated_at=now() WHERE id='course-social-a2';
UPDATE public.course_catalog SET level='B1',title='Phrasal Verbs Essenciais',short_description='Os phrasal verbs que nativos mais usam, por verbo-base, em frases reais com o sentido de cada um.',long_description='Phrasal verbs organizados pelo verbo-base (get, take, put, come, go, look, turn, give, make, break, bring, run, set, call, pick). Cada frase explica o sentido real × o literal, o registro e se o phrasal é separável (o objeto pode ir no meio: "turn it off").',updated_at=now() WHERE id='course-phrasal-b1';
UPDATE public.course_catalog SET level='B1',title='Tempos Verbais em Uso',short_description='Os tempos verbais que mais confundem brasileiros, em pares, com a comparação com o português.',long_description='Presente simples × contínuo, passado simples × contínuo, present perfect × passado, present perfect contínuo, futuro (will, going to, presente contínuo) e past perfect. Cada frase explica por que aquele tempo foi usado e como fica em português.',updated_at=now() WHERE id='course-tenses-b1';
UPDATE public.course_catalog SET level='B1',title='Preposições e Conectores',short_description='In, on, at, preposições que acompanham verbos e adjetivos, e os conectores que ligam ideias.',long_description='As preposições que mais confundem brasileiros (in/on/at de tempo e lugar, verbo + preposição, adjetivo + preposição) e os conectores de contraste, causa, consequência e sequência. Cada frase explica a regra e o erro típico.',updated_at=now() WHERE id='course-prepositions-b1';
UPDATE public.course_catalog SET level='B2',title='Expressões Idiomáticas e Fluência',short_description='Idioms que nativos usam de verdade e os recursos que deixam sua fala natural: marcadores, opiniões suaves e histórias.',long_description='Expressões idiomáticas de trabalho, sentimentos, dinheiro e tempo, e as ferramentas de fluência que separam o B1 do B2: marcadores de conversa ("actually", "I mean"), como suavizar opiniões e como contar uma história. Cada nota traz o registro e o sentido literal × o real.',updated_at=now() WHERE id='course-idioms-b2';
UPDATE public.course_catalog SET level='A1',title='Números, Horas e Datas',short_description='Idade, preços, telefone, horas, datas, agenda e medidas: os números em frases do dia a dia.',long_description='Números em uso real: dizer a idade, perguntar preços, passar telefone e soletrar e-mail, dizer as horas, datas e aniversários, marcar compromissos e falar de medidas. Cada frase explica como o número é lido em inglês.',updated_at=now() WHERE id='course-numbers-a1';
UPDATE public.course_catalog SET level='A2',title='Sobrevivência',short_description='Quando o inglês falha: pedir para repetir, soletrar, pedir ajuda, resolver banco, correio, documentos e contas.',long_description='As frases que salvam quando você não entende ou precisa resolver algo prático: pedir para repetir e soletrar, pedir ajuda, falar ao telefone, banco, correios, documentos, objetos perdidos, moradia e contas. Cada frase explica o uso.',updated_at=now() WHERE id='course-survival-a2';
UPDATE public.course_catalog SET level='B1',title='Verbos Modais',short_description='Can, could, should, must, might, would, have to e may: habilidade, permissão, conselho, obrigação e possibilidade.',long_description='Um capítulo por modal, com os sentidos que ele tem na fala real: habilidade, permissão, pedido, conselho, obrigação, proibição, possibilidade e hipótese. Modais não levam "to" nem "s" na terceira pessoa; cada frase mostra isso e compara com o português.',updated_at=now() WHERE id='course-modals-b1';
UPDATE public.course_catalog SET level='B1',title='Entrevista de Emprego',short_description='Responder as perguntas clássicas de entrevista em inglês: apresentação, experiência, pontos fortes, situações, salário e perguntas finais.',long_description='Oito capítulos que seguem a ordem real de uma entrevista: abertura e small talk, falar de si, experiência, pontos fortes e fracos, perguntas de situação (método STAR), motivação, salário e disponibilidade, e perguntas para o entrevistador com o follow-up. As notas explicam o tom e os erros comuns de brasileiros.',updated_at=now() WHERE id='course-interview-b1';
UPDATE public.course_catalog SET level='B1',title='Histórias em Trechos',short_description='Dez contos curtos, trecho por trecho: você ouve, escreve e acompanha a história até o fim.',long_description='Cada capítulo é um conto original dividido em oito trechos. Você pratica compreensão de uma narrativa contínua, tempos do passado, conectores e diálogo. A nota de cada trecho explica a estrutura ou a expressão usada.',updated_at=now() WHERE id='course-stories-b1';
UPDATE public.course_catalog SET level='B2',title='Parágrafos',short_description='Textos completos parágrafo por parágrafo: você ouve e escreve um texto inteiro com começo, meio e fim.',long_description='Dez tipos de texto do dia a dia (apresentação, rotina, cidade, viagem, opinião, e-mail formal, resenha, processo, comparação e planos), cada um em quatro parágrafos. A nota explica a função do parágrafo e os conectores que dão fluidez ao texto.',updated_at=now() WHERE id='course-paragraphs-b2';
UPDATE public.course_catalog SET level='A2',title='Inglês Falado: Reduções',short_description='Piloto: as reduções que as séries usam o tempo todo e quase ninguém ensina (c''mon, gotcha, shoulda, outta).',long_description='Curso piloto sobre a fala real: formas encurtadas como "c''mon", "gotcha", "shoulda", "outta" e "tryna". Cada frase mostra a forma completa, o registro (informal ou gíria) e a armadilha. Você ouve, digita palavra por palavra e vê tradução, IPA e explicação. É um piloto de um capítulo: a continuação depende do áudio e do seu uso.',updated_at=now() WHERE id='course-spoken-reductions-a2';
UPDATE public.course_catalog SET level='B2',title='Gramática B2 em Uso',short_description='Wish, condicionais mistos, causativo, relativas, gerúndio × infinitivo, ênfase, inversão e futuro perfeito.',long_description='Os pontos de gramática que separam o inglês intermediário do avançado, sempre em frases curtas e naturais. Cada nota mostra a regra naquela frase e compara com o português, sem repetir o que o curso de Tempos Verbais do B1 já ensinou.',updated_at=now() WHERE id='course-grammar-b2';
UPDATE public.course_catalog SET level='B2',title='Colocações Naturais',short_description='Make ou do? Heavy rain ou strong rain? As combinações de palavras que o nativo espera ouvir.',long_description='Colocações são pares de palavras que andam juntos: em inglês se faz uma decisão (make), se toma um banho (take) e a chuva é pesada (heavy). Traduzir do português palavra por palavra soa estranho. Cada frase traz a combinação natural e o erro mais comum de quem pensa em português.',updated_at=now() WHERE id='course-collocations-b2';
UPDATE public.course_catalog SET level='B2',title='Reuniões e Negociação',short_description='Conduzir reuniões, discordar com diplomacia, negociar preço e fechar acordos em inglês.',long_description='O inglês de quem decide e negocia: abrir e conduzir reuniões, opinar sem ser ríspido, propor, contrapropor, ceder e fechar um acordo. Cada nota explica o tom da frase (neutro, diplomático, firme) e o que evitar para não soar agressivo.',updated_at=now() WHERE id='course-negotiation-b2';
UPDATE public.course_catalog SET level='B2',title='Argumentar e Debater',short_description='Defender uma ideia, rebater com educação e persuadir: o inglês de quem debate.',long_description='Como sustentar uma opinião, citar evidências, discordar sem ofender, ceder um ponto para ganhar outro e fechar com impacto. Cada frase vem com a função no debate e o tom que ela passa.',updated_at=now() WHERE id='course-debate-b2';
UPDATE public.course_catalog SET level='B2',title='Phrasal Verbs Avançados',short_description='Figure out, put up with, turn down: os phrasal verbs que aparecem em séries, reuniões e conversas reais.',long_description='Dez grupos de phrasal verbs para quem já domina os básicos. Cada frase mostra o sentido na situação e avisa se o verbo é separável ou não, que é o ponto em que mais se erra.',updated_at=now() WHERE id='course-phrasal-adv-b2';
UPDATE public.course_catalog SET level='B2',title='Entrelinhas: Ironia e Subentendidos',short_description='O que o falante realmente quer dizer: ironia, sarcasmo, pedidos indiretos e recusas educadas.',long_description='Em inglês, muita coisa importante não está nas palavras: "not bad" pode ser um grande elogio, "interesting" pode ser uma crítica e "it is a bit cold in here" pode ser um pedido para fechar a janela. Cada frase traz o sentido literal e o sentido real.',updated_at=now() WHERE id='course-subtext-b2';
UPDATE public.course_catalog SET level='C1',title='Registro e Precisão',short_description='Formal ou informal? Cauteloso ou direto? Escolher a palavra e o tom certos em textos e reuniões.',long_description='No C1 o desafio deixa de ser a gramática e passa a ser a escolha: o registro certo para cada situação, a cautela de quem escreve com rigor, a precisão de quem analisa. Cada frase mostra a versão neutra e a versão mais refinada.',updated_at=now() WHERE id='course-register-c1';
UPDATE public.course_catalog SET level='B2',title='Vocabulário por Temas',short_description='Palavras de temas abstratos que aparecem em notícias, debates e provas: meio ambiente, tecnologia, economia, saúde, mídia e relações.',long_description='Seis temas com 20 palavras cada. Você ouve a palavra, escreve e vê o significado com uma frase de exemplo. São as palavras que separam um vocabulário de dia a dia de um vocabulário de quem acompanha notícias e discute ideias.',updated_at=now() WHERE id='course-themes-b2';
UPDATE public.course_catalog SET level='B2',title='Fala Conectada',short_description='Shoulda, gonna, whaddya, kinda e a ligação entre palavras: o inglês falado como ele soa, não como se escreve.',long_description='Na fala rápida as palavras se juntam e se encurtam: "should have" vira "shoulda", "what do you" vira "whaddya", "pick it up" soa como uma palavra só. Cada frase mostra a forma reduzida, a forma completa e quando usar. O áudio é sintetizado a partir do texto escrito; escute com atenção e compare com a fala real de séries e vídeos.',updated_at=now() WHERE id='course-connected-speech-b2';
UPDATE public.course_lessons SET level=NULL,curriculum_order=NULL,is_core=false,prerequisite_lesson_ids='{}';
CREATE OR REPLACE FUNCTION public.rpc_course_catalog()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT coalesce(jsonb_agg(course ORDER BY (course->>'order_index')::INT), '[]'::jsonb)
  FROM (
    SELECT jsonb_build_object(
      'id', c.id, 'slug', c.slug, 'title', c.title, 'short_description', c.short_description,
      'long_description', c.long_description, 'level', c.level, 'category', c.category,
      'track', c.track, 'track_order', c.track_order, 'is_core', c.is_core,
      'order_index', c.order_index, 'created_at', c.created_at,
      'unit_kind', (SELECT mode() WITHIN GROUP (ORDER BY u.kind) FROM public.course_units u
        JOIN public.course_lessons l ON l.id = u.lesson_id WHERE l.course_id = c.id),
      'learners_count', (SELECT count(*) FROM public.user_course_enrollment e WHERE e.course_id = c.id AND e.in_my_courses),
      'my', (
        SELECT jsonb_build_object('in_my_courses', e.in_my_courses, 'percent_completed', e.percent_completed,
          'completed_lessons', e.completed_lessons, 'current_lesson_id', e.current_lesson_id, 'last_studied_at', e.last_studied_at)
        FROM public.user_course_enrollment e WHERE e.course_id = c.id AND e.user_id = auth.uid()
      ),
      'lessons', (
        SELECT coalesce(jsonb_agg(jsonb_build_object(
          'id', l.id, 'chapter_number', l.chapter_number, 'title', l.title, 'description', l.description,
          'unit_count', (SELECT count(*) FROM public.course_units u WHERE u.lesson_id = l.id),
          'my_best_answered', (SELECT max(s.answered_questions) FROM public.course_practice_sessions s
            WHERE s.lesson_id = l.id AND s.user_id = auth.uid())
        ) ORDER BY l.chapter_number), '[]'::jsonb)
        FROM public.course_lessons l
        WHERE l.course_id = c.id AND EXISTS (SELECT 1 FROM public.course_units u WHERE u.lesson_id = l.id)
      )
    ) AS course
    FROM public.course_catalog c
    WHERE c.is_published
  ) t
  WHERE jsonb_array_length(course->'lessons') > 0;
$$;

CREATE OR REPLACE FUNCTION public.rpc_course_path()
RETURNS JSONB
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  WITH me AS (SELECT (select auth.uid()) AS uid),
  levels(level, pos) AS (VALUES ('A1', 1), ('A2', 2), ('B1', 3), ('B2', 4), ('C1', 5)),
  placement AS (
    SELECT l.pos
    FROM public.settings s, me, levels l
    WHERE s.user_id = me.uid AND s.key = 'lf_cefr_level'
      AND upper(trim(both '"' FROM trim(s.value))) = l.level
    LIMIT 1
  ),
  core AS (
    SELECT c.id AS course_id, c.level, c.track, c.track_order, c.order_index, l.id AS lesson_id, l.chapter_number
    FROM public.course_catalog c
    JOIN public.course_lessons l ON l.course_id = c.id
    WHERE c.is_published AND c.is_core AND EXISTS (SELECT 1 FROM public.course_units u WHERE u.lesson_id = l.id)
  ),
  done AS (
    SELECT DISTINCT unnest(e.completed_lessons) AS lesson_id
    FROM public.user_course_enrollment e, me WHERE e.user_id = me.uid
  ),
  per_level AS (
    SELECT lv.level, lv.pos,
      count(c.lesson_id) AS total,
      count(c.lesson_id) FILTER (WHERE c.lesson_id IN (SELECT lesson_id FROM done)) AS completed
    FROM levels lv LEFT JOIN core c ON c.level = lv.level
    GROUP BY lv.level, lv.pos
  ),
  status AS (
    SELECT p.*,
      CASE WHEN p.total = 0 THEN 0 ELSE round(p.completed::NUMERIC * 100 / p.total, 1) END AS percent,
      (p.total > 0 AND p.completed::NUMERIC / p.total >= 0.8) AS is_completed,
      (p.pos < coalesce((SELECT pos FROM placement), 1)) AS skipped_by_placement
    FROM per_level p
  ),
  current_level AS (
    SELECT level, pos FROM status
    WHERE NOT is_completed AND NOT skipped_by_placement AND total > 0
    ORDER BY pos LIMIT 1
  ),
  next_lesson AS (
    SELECT c.course_id, c.lesson_id, c.level
    FROM core c
    WHERE c.lesson_id NOT IN (SELECT lesson_id FROM done)
      AND c.level IN (SELECT level FROM status WHERE NOT skipped_by_placement)
    ORDER BY (SELECT pos FROM levels WHERE level = c.level),
      array_position(ARRAY['fundamentos', 'dia-a-dia', 'viagem', 'gramatica', 'trabalho', 'fluencia'], c.track),
      c.track_order, c.order_index, c.chapter_number
    LIMIT 1
  )
  SELECT jsonb_build_object(
    'placement_level', (SELECT l.level FROM placement p JOIN levels l ON l.pos = p.pos),
    'current_level', coalesce((SELECT level FROM current_level), (SELECT level FROM next_lesson)),
    'levels', (SELECT jsonb_agg(jsonb_build_object('level', level, 'total', total, 'completed', completed,
      'percent', percent, 'is_completed', is_completed, 'skipped', skipped_by_placement) ORDER BY pos) FROM status),
    'next', (SELECT jsonb_build_object('course_id', course_id, 'lesson_id', lesson_id, 'level', level) FROM next_lesson)
  );
$$;
