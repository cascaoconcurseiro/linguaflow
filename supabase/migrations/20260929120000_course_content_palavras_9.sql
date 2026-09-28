-- Gerado por scripts/generate-course-seed.mjs a partir de supabase/content/. Não editar à mão.

-- Conteúdo original: frases do cotidiano com tradução pt-BR, notas, grupos sintáticos e anotações por palavra.

INSERT INTO public.course_catalog (id, slug, title, short_description, long_description, level, category, order_index, track, track_order, is_core, is_published)
VALUES ('course-1000-words-a1', '1000-essential-words', '1000 Palavras Essenciais', 'As palavras mais usadas do inglês, por tema, com significado e frase de exemplo.', 'Vocabulário essencial organizado por temas do dia a dia. Você ouve, escreve a palavra e vê como ela aparece numa frase real.', 'A1', 'grammar', 11, 'fundamentos', 2, true, true)
ON CONFLICT (id) DO UPDATE SET slug = EXCLUDED.slug, title = EXCLUDED.title, short_description = EXCLUDED.short_description,
  long_description = EXCLUDED.long_description, level = EXCLUDED.level, category = EXCLUDED.category,
  order_index = EXCLUDED.order_index, track = EXCLUDED.track, track_order = EXCLUDED.track_order,
  is_core = EXCLUDED.is_core, is_published = EXCLUDED.is_published, updated_at = now();

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-29', 'course-1000-words-a1', 29, 'Escritório', 'Objetos e rotina do trabalho de escritório.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-29-01', 'lesson-1000-words-a1-29', 1, 'word', 'office', 'escritório', '/ˈɔːfɪs/', NULL, '[]'::jsonb, '[{"surface":"office","pos":"noun","ipa":"/ˈɔːfɪs/","gloss":"escritório, balcão"}]'::jsonb, 'I work in an office downtown.', 'Trabalho num escritório no centro.'),
  ('unit-1000-words-a1-29-02', 'lesson-1000-words-a1-29', 2, 'word', 'desk', 'mesa de trabalho', '/dɛsk/', NULL, '[]'::jsonb, '[{"surface":"desk","pos":"noun","ipa":"/dɛsk/","gloss":"escrivaninha"}]'::jsonb, 'Your package is on my desk.', 'Seu pacote está na minha mesa.'),
  ('unit-1000-words-a1-29-03', 'lesson-1000-words-a1-29', 3, 'word', 'computer', 'computador', '/kəmˈpjuːtər/', NULL, '[]'::jsonb, '[{"surface":"computer","pos":"noun","ipa":"/kəmˈpjuːtər/","gloss":"computador"}]'::jsonb, 'My computer is very slow.', 'Meu computador está muito lento.'),
  ('unit-1000-words-a1-29-04', 'lesson-1000-words-a1-29', 4, 'word', 'printer', 'impressora', '/ˈprɪntər/', NULL, '[]'::jsonb, '[{"surface":"printer","pos":"noun","ipa":"/ˈprɪntər/","gloss":"impressora"}]'::jsonb, 'The printer is out of paper.', 'A impressora está sem papel.'),
  ('unit-1000-words-a1-29-05', 'lesson-1000-words-a1-29', 5, 'word', 'paper', 'papel', '/ˈpeɪpər/', 'Incontável: "a sheet of paper" = uma folha.', '[]'::jsonb, '[{"surface":"paper","pos":"noun","ipa":"/ˈpeɪpər/","gloss":"papel"}]'::jsonb, 'I need a sheet of paper.', 'Preciso de uma folha de papel.'),
  ('unit-1000-words-a1-29-06', 'lesson-1000-words-a1-29', 6, 'word', 'pen', 'caneta', '/pɛn/', NULL, '[]'::jsonb, '[{"surface":"pen","pos":"noun","ipa":"/pɛn/","gloss":"caneta"}]'::jsonb, 'Can I borrow a pen?', 'Posso pegar uma caneta emprestada?'),
  ('unit-1000-words-a1-29-07', 'lesson-1000-words-a1-29', 7, 'word', 'file', 'arquivo', '/faɪl/', NULL, '[]'::jsonb, '[{"surface":"file","pos":"noun","ipa":"/faɪl/","gloss":"arquivo"}]'::jsonb, 'Save the file before you close it.', 'Salve o arquivo antes de fechar.'),
  ('unit-1000-words-a1-29-08', 'lesson-1000-words-a1-29', 8, 'word', 'folder', 'pasta', '/ˈfoʊldər/', NULL, '[]'::jsonb, '[{"surface":"folder","pos":"noun","ipa":"/ˈfoʊldər/","gloss":"pasta"}]'::jsonb, 'Put it in the blue folder.', 'Coloque na pasta azul.'),
  ('unit-1000-words-a1-29-09', 'lesson-1000-words-a1-29', 9, 'word', 'meeting', 'reunião', '/ˈmiːtɪŋ/', NULL, '[]'::jsonb, '[{"surface":"meeting","pos":"noun","ipa":"/ˈmiːtɪŋ/","gloss":"reunião"}]'::jsonb, 'I have a meeting at two.', 'Tenho uma reunião às duas.'),
  ('unit-1000-words-a1-29-10', 'lesson-1000-words-a1-29', 10, 'word', 'colleague', 'colega de trabalho', '/ˈkɑːliːɡ/', NULL, '[]'::jsonb, '[{"surface":"colleague","pos":"noun","ipa":"/ˈkɑːliːɡ/","gloss":"colega de trabalho"}]'::jsonb, 'My colleagues are very helpful.', 'Meus colegas são muito prestativos.'),
  ('unit-1000-words-a1-29-11', 'lesson-1000-words-a1-29', 11, 'word', 'boss', 'chefe', '/bɔːs/', NULL, '[]'::jsonb, '[{"surface":"boss","pos":"noun","ipa":"/bɔːs/","gloss":"chefe"}]'::jsonb, 'My boss is on vacation.', 'Meu chefe está de férias.'),
  ('unit-1000-words-a1-29-12', 'lesson-1000-words-a1-29', 12, 'word', 'deadline', 'prazo', '/ˈdɛdlaɪn/', NULL, '[]'::jsonb, '[{"surface":"deadline","pos":"noun","ipa":"/ˈdɛdlaɪn/","gloss":"prazo"}]'::jsonb, 'The deadline is Friday.', 'O prazo é sexta.'),
  ('unit-1000-words-a1-29-13', 'lesson-1000-words-a1-29', 13, 'word', 'task', 'tarefa', '/tæsk/', NULL, '[]'::jsonb, '[{"surface":"task","pos":"noun","ipa":"/tæsk/","gloss":"tarefa"}]'::jsonb, 'I have three tasks today.', 'Tenho três tarefas hoje.'),
  ('unit-1000-words-a1-29-14', 'lesson-1000-words-a1-29', 14, 'word', 'schedule', 'agenda, cronograma', '/ˈskɛdʒuːl/', NULL, '[]'::jsonb, '[{"surface":"schedule","pos":"noun","ipa":"/ˈskɛdʒuːl/","gloss":"horário, agenda"}]'::jsonb, 'Check my schedule, please.', 'Veja minha agenda, por favor.'),
  ('unit-1000-words-a1-29-15', 'lesson-1000-words-a1-29', 15, 'word', 'break', 'pausa, intervalo', '/breɪk/', NULL, '[]'::jsonb, '[{"surface":"break","pos":"noun","ipa":"/breɪk/","gloss":"pausa, intervalo"}]'::jsonb, 'Let''s take a coffee break.', 'Vamos fazer uma pausa para o café.'),
  ('unit-1000-words-a1-29-16', 'lesson-1000-words-a1-29', 16, 'word', 'report', 'relatório', '/rɪˈpɔːrt/', NULL, '[]'::jsonb, '[{"surface":"report","pos":"verb","ipa":"/rɪˈpɔːrt/","gloss":"registrar, relatar"}]'::jsonb, 'The report is almost ready.', 'O relatório está quase pronto.'),
  ('unit-1000-words-a1-29-17', 'lesson-1000-words-a1-29', 17, 'word', 'salary', 'salário', '/ˈsæləri/', NULL, '[]'::jsonb, '[{"surface":"salary","pos":"noun","ipa":"/ˈsæləri/","gloss":"salário"}]'::jsonb, 'The salary is paid monthly.', 'O salário é pago mensalmente.'),
  ('unit-1000-words-a1-29-18', 'lesson-1000-words-a1-29', 18, 'word', 'contract', 'contrato', '/ˈkɑːntrækt/', NULL, '[]'::jsonb, '[{"surface":"contract","pos":"noun","ipa":"/ˈkɑːntrækt/","gloss":"contrato"}]'::jsonb, 'Please sign the contract.', 'Por favor, assine o contrato.'),
  ('unit-1000-words-a1-29-19', 'lesson-1000-words-a1-29', 19, 'word', 'customer', 'cliente (loja)', '/ˈkʌstəmər/', '"Customer" compra produto; "client" contrata serviço.', '[]'::jsonb, '[{"surface":"customer","pos":"noun","ipa":"/ˈkʌstəmər/","gloss":"cliente"}]'::jsonb, 'The customer is always right.', 'O cliente sempre tem razão.'),
  ('unit-1000-words-a1-29-20', 'lesson-1000-words-a1-29', 20, 'word', 'company', 'empresa', '/ˈkʌmpəni/', '"Work for" + empresa.', '[]'::jsonb, '[{"surface":"company","pos":"noun","ipa":"/ˈkʌmpəni/","gloss":"empresa"}]'::jsonb, 'I work for a big company.', 'Trabalho para uma empresa grande.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-30', 'course-1000-words-a1', 30, 'Tecnologia e internet', 'Celular, computador e vida online.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-30-01', 'lesson-1000-words-a1-30', 1, 'word', 'phone', 'celular, telefone', '/foʊn/', NULL, '[]'::jsonb, '[{"surface":"phone","pos":"noun","ipa":"/foʊn/","gloss":"celular, telefone"}]'::jsonb, 'My phone is on silent.', 'Meu celular está no silencioso.'),
  ('unit-1000-words-a1-30-02', 'lesson-1000-words-a1-30', 2, 'word', 'screen', 'tela', '/skriːn/', NULL, '[]'::jsonb, '[{"surface":"screen","pos":"noun","ipa":"/skriːn/","gloss":"tela"}]'::jsonb, 'The screen is broken.', 'A tela está quebrada.'),
  ('unit-1000-words-a1-30-03', 'lesson-1000-words-a1-30', 3, 'word', 'battery', 'bateria', '/ˈbætəri/', NULL, '[]'::jsonb, '[{"surface":"battery","pos":"noun","ipa":"/ˈbætəri/","gloss":"bateria"}]'::jsonb, 'My battery is low.', 'Minha bateria está fraca.'),
  ('unit-1000-words-a1-30-04', 'lesson-1000-words-a1-30', 4, 'word', 'charger', 'carregador', '/ˈtʃɑːrdʒər/', NULL, '[]'::jsonb, '[{"surface":"charger","pos":"noun","ipa":"/ˈtʃɑːrdʒər/","gloss":"carregador"}]'::jsonb, 'Did you bring the charger?', 'Você trouxe o carregador?'),
  ('unit-1000-words-a1-30-05', 'lesson-1000-words-a1-30', 5, 'word', 'internet', 'internet', '/ˈɪntərnɛt/', '"Down" = fora do ar.', '[]'::jsonb, '[{"surface":"internet","pos":"noun","ipa":"/ˈɪntərnɛt/","gloss":"internet"}]'::jsonb, 'The internet is down.', 'A internet caiu.'),
  ('unit-1000-words-a1-30-06', 'lesson-1000-words-a1-30', 6, 'word', 'wifi', 'wi-fi', '/ˈwaɪfaɪ/', NULL, '[]'::jsonb, '[{"surface":"wifi","pos":"noun","ipa":"/ˈwaɪfaɪ/","gloss":"wi-fi"}]'::jsonb, 'Is there wifi here?', 'Tem wi-fi aqui?'),
  ('unit-1000-words-a1-30-07', 'lesson-1000-words-a1-30', 7, 'word', 'password', 'senha', '/ˈpæswɜːrd/', NULL, '[]'::jsonb, '[{"surface":"password","pos":"noun","ipa":"/ˈpæswɜːrd/","gloss":"senha"}]'::jsonb, 'I forgot my password.', 'Esqueci minha senha.'),
  ('unit-1000-words-a1-30-08', 'lesson-1000-words-a1-30', 8, 'word', 'email', 'e-mail', '/ˈiːmeɪl/', 'Também é verbo: "Email me the file".', '[]'::jsonb, '[{"surface":"email","pos":"noun","ipa":"/ˈiːmeɪl/","gloss":"e-mail"}]'::jsonb, 'Send me an email.', 'Me mande um e-mail.'),
  ('unit-1000-words-a1-30-09', 'lesson-1000-words-a1-30', 9, 'word', 'app', 'aplicativo', '/æp/', NULL, '[]'::jsonb, '[{"surface":"app","pos":"noun","ipa":"/æp/","gloss":"aplicativo"}]'::jsonb, 'Download the app.', 'Baixe o aplicativo.'),
  ('unit-1000-words-a1-30-10', 'lesson-1000-words-a1-30', 10, 'word', 'download', 'baixar', '/ˈdaʊnloʊd/', 'Oposto: "upload" = enviar, subir.', '[]'::jsonb, '[{"surface":"download","pos":"verb","ipa":"/ˈdaʊnloʊd/","gloss":"baixar"}]'::jsonb, 'Download the file first.', 'Baixe o arquivo primeiro.'),
  ('unit-1000-words-a1-30-11', 'lesson-1000-words-a1-30', 11, 'word', 'website', 'site', '/ˈwɛbsaɪt/', NULL, '[]'::jsonb, '[{"surface":"website","pos":"noun","ipa":"/ˈwɛbsaɪt/","gloss":"site"}]'::jsonb, 'Check our website.', 'Veja nosso site.'),
  ('unit-1000-words-a1-30-12', 'lesson-1000-words-a1-30', 12, 'word', 'link', 'link', '/lɪŋk/', NULL, '[]'::jsonb, '[{"surface":"link","pos":"noun","ipa":"/lɪŋk/","gloss":"link"}]'::jsonb, 'Send me the link.', 'Me manda o link.'),
  ('unit-1000-words-a1-30-13', 'lesson-1000-words-a1-30', 13, 'word', 'keyboard', 'teclado', '/ˈkiːbɔːrd/', NULL, '[]'::jsonb, '[{"surface":"keyboard","pos":"noun","ipa":"/ˈkiːbɔːrd/","gloss":"teclado"}]'::jsonb, 'This keyboard is new.', 'Este teclado é novo.'),
  ('unit-1000-words-a1-30-14', 'lesson-1000-words-a1-30', 14, 'word', 'mouse', 'mouse', '/maʊs/', NULL, '[]'::jsonb, '[{"surface":"mouse","pos":"noun","ipa":"/maʊs/","gloss":"rato, camundongo"}]'::jsonb, 'My mouse is not working.', 'Meu mouse não está funcionando.'),
  ('unit-1000-words-a1-30-15', 'lesson-1000-words-a1-30', 15, 'word', 'update', 'atualizar; atualização', '/ʌpˈdeɪt/', NULL, '[]'::jsonb, '[{"surface":"update","pos":"verb","ipa":"/ʌpˈdeɪt/","gloss":"atualizar"}]'::jsonb, 'Update the app.', 'Atualize o aplicativo.'),
  ('unit-1000-words-a1-30-16', 'lesson-1000-words-a1-30', 16, 'word', 'account', 'conta (cadastro)', '/əˈkaʊnt/', 'Conta de restaurante é "check" ou "bill".', '[]'::jsonb, '[{"surface":"account","pos":"noun","ipa":"/əˈkaʊnt/","gloss":"conta (cadastro)"}]'::jsonb, 'Create an account.', 'Crie uma conta.'),
  ('unit-1000-words-a1-30-17', 'lesson-1000-words-a1-30', 17, 'word', 'online', 'on-line', '/ˌɑːnˈlaɪn/', NULL, '[]'::jsonb, '[{"surface":"online","pos":"adverb","ipa":"/ˌɑːnˈlaɪn/","gloss":"na internet"}]'::jsonb, 'I bought it online.', 'Comprei pela internet.'),
  ('unit-1000-words-a1-30-18', 'lesson-1000-words-a1-30', 18, 'word', 'search', 'pesquisar', '/sɜːrtʃ/', NULL, '[]'::jsonb, '[{"surface":"search","pos":"verb","ipa":"/sɜːrtʃ/","gloss":"pesquisar"}]'::jsonb, 'Search for it online.', 'Pesquise na internet.'),
  ('unit-1000-words-a1-30-19', 'lesson-1000-words-a1-30', 19, 'word', 'message', 'mensagem', '/ˈmɛsɪdʒ/', NULL, '[]'::jsonb, '[{"surface":"message","pos":"noun","ipa":"/ˈmɛsɪdʒ/","gloss":"mensagem"}]'::jsonb, 'I sent you a message.', 'Te mandei uma mensagem.'),
  ('unit-1000-words-a1-30-20', 'lesson-1000-words-a1-30', 20, 'word', 'camera', 'câmera', '/ˈkæmərə/', NULL, '[]'::jsonb, '[{"surface":"camera","pos":"noun","ipa":"/ˈkæmərə/","gloss":"câmera"}]'::jsonb, 'Turn on your camera.', 'Ligue sua câmera.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-31', 'course-1000-words-a1', 31, 'Dinheiro', 'Pagar, economizar e falar de preços.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-31-01', 'lesson-1000-words-a1-31', 1, 'word', 'money', 'dinheiro', '/ˈmʌni/', 'Incontável: "much money", nunca "moneys".', '[]'::jsonb, '[{"surface":"money","pos":"noun","ipa":"/ˈmʌni/","gloss":"dinheiro"}]'::jsonb, 'I need more money.', 'Preciso de mais dinheiro.'),
  ('unit-1000-words-a1-31-02', 'lesson-1000-words-a1-31', 2, 'word', 'cash', 'dinheiro vivo', '/kæʃ/', NULL, '[]'::jsonb, '[{"surface":"cash","pos":"noun","ipa":"/kæʃ/","gloss":"dinheiro vivo"}]'::jsonb, 'Do you accept cash?', 'Vocês aceitam dinheiro?'),
  ('unit-1000-words-a1-31-03', 'lesson-1000-words-a1-31', 3, 'word', 'coin', 'moeda', '/kɔɪn/', NULL, '[]'::jsonb, '[{"surface":"coin","pos":"noun","ipa":"/kɔɪn/","gloss":"moeda"}]'::jsonb, 'I have some coins.', 'Tenho algumas moedas.'),
  ('unit-1000-words-a1-31-04', 'lesson-1000-words-a1-31', 4, 'word', 'bill', 'nota; conta', '/bɪl/', 'EUA: "bill" = nota de dinheiro e conta a pagar.', '[]'::jsonb, '[{"surface":"bill","pos":"noun","ipa":"/bɪl/","gloss":"conta"}]'::jsonb, 'A twenty dollar bill.', 'Uma nota de vinte dólares.'),
  ('unit-1000-words-a1-31-05', 'lesson-1000-words-a1-31', 5, 'word', 'price', 'preço', '/praɪs/', NULL, '[]'::jsonb, '[{"surface":"price","pos":"noun","ipa":"/praɪs/","gloss":"preço"}]'::jsonb, 'What is the price?', 'Qual é o preço?'),
  ('unit-1000-words-a1-31-06', 'lesson-1000-words-a1-31', 6, 'word', 'cheap', 'barato', '/tʃiːp/', NULL, '[]'::jsonb, '[{"surface":"cheap","pos":"adjective","ipa":"/tʃiːp/","gloss":"barato"}]'::jsonb, 'This shirt was cheap.', 'Esta camisa foi barata.'),
  ('unit-1000-words-a1-31-07', 'lesson-1000-words-a1-31', 7, 'word', 'expensive', 'caro', '/ɪkˈspɛnsɪv/', NULL, '[]'::jsonb, '[{"surface":"expensive","pos":"adjective","ipa":"/ɪkˈspɛnsɪv/","gloss":"caro"}]'::jsonb, 'London is expensive.', 'Londres é cara.'),
  ('unit-1000-words-a1-31-08', 'lesson-1000-words-a1-31', 8, 'word', 'bank', 'banco', '/bæŋk/', NULL, '[]'::jsonb, '[{"surface":"bank","pos":"noun","ipa":"/bæŋk/","gloss":"banco"}]'::jsonb, 'I need to go to the bank.', 'Preciso ir ao banco.'),
  ('unit-1000-words-a1-31-09', 'lesson-1000-words-a1-31', 9, 'word', 'card', 'cartão', '/kɑːrd/', NULL, '[]'::jsonb, '[{"surface":"card","pos":"noun","ipa":"/kɑːrd/","gloss":"cartão"}]'::jsonb, 'Can I pay by card?', 'Posso pagar no cartão?'),
  ('unit-1000-words-a1-31-10', 'lesson-1000-words-a1-31', 10, 'word', 'change', 'troco', '/tʃeɪndʒ/', NULL, '[]'::jsonb, '[{"surface":"change","pos":"verb","ipa":"/tʃeɪndʒ/","gloss":"trocar"}]'::jsonb, 'Keep the change.', 'Fique com o troco.'),
  ('unit-1000-words-a1-31-11', 'lesson-1000-words-a1-31', 11, 'word', 'save', 'economizar, guardar', '/seɪv/', '"Save" também é salvar (arquivo, vida).', '[]'::jsonb, '[{"surface":"save","pos":"verb","ipa":"/seɪv/","gloss":"economizar, salvar"}]'::jsonb, 'I save money every month.', 'Guardo dinheiro todo mês.'),
  ('unit-1000-words-a1-31-12', 'lesson-1000-words-a1-31', 12, 'word', 'spend', 'gastar', '/spɛnd/', NULL, '[]'::jsonb, '[{"surface":"spend","pos":"verb","ipa":"/spɛnd/","gloss":"gastar, passar (tempo)"}]'::jsonb, 'Don''t spend too much.', 'Não gaste demais.'),
  ('unit-1000-words-a1-31-13', 'lesson-1000-words-a1-31', 13, 'word', 'borrow', 'pegar emprestado', '/ˈbɑːroʊ/', '"Borrow" = pegar emprestado; "lend" = emprestar.', '[]'::jsonb, '[{"surface":"borrow","pos":"verb","ipa":"/ˈbɑːroʊ/","gloss":"pegar emprestado"}]'::jsonb, 'Can I borrow ten dollars?', 'Posso pegar dez dólares emprestado?'),
  ('unit-1000-words-a1-31-14', 'lesson-1000-words-a1-31', 14, 'word', 'lend', 'emprestar', '/lɛnd/', NULL, '[]'::jsonb, '[{"surface":"lend","pos":"verb","ipa":"/lɛnd/","gloss":"emprestar"}]'::jsonb, 'Can you lend me some money?', 'Você me empresta um dinheiro?'),
  ('unit-1000-words-a1-31-15', 'lesson-1000-words-a1-31', 15, 'word', 'owe', 'dever', '/oʊ/', NULL, '[]'::jsonb, '[{"surface":"owe","pos":"verb","ipa":"/oʊ/","gloss":"dever"}]'::jsonb, 'I owe you twenty dollars.', 'Te devo vinte dólares.'),
  ('unit-1000-words-a1-31-16', 'lesson-1000-words-a1-31', 16, 'word', 'tax', 'imposto', '/tæks/', 'Nos EUA o imposto costuma ser somado no caixa.', '[]'::jsonb, '[{"surface":"tax","pos":"noun","ipa":"/tæks/","gloss":"imposto"}]'::jsonb, 'Is tax included?', 'O imposto está incluído?'),
  ('unit-1000-words-a1-31-17', 'lesson-1000-words-a1-31', 17, 'word', 'discount', 'desconto', '/ˈdɪskaʊnt/', NULL, '[]'::jsonb, '[{"surface":"discount","pos":"noun","ipa":"/ˈdɪskaʊnt/","gloss":"desconto"}]'::jsonb, 'Is there a discount?', 'Tem desconto?'),
  ('unit-1000-words-a1-31-18', 'lesson-1000-words-a1-31', 18, 'word', 'receipt', 'recibo', '/rɪˈsiːt/', NULL, '[]'::jsonb, '[{"surface":"receipt","pos":"noun","ipa":"/rɪˈsiːt/","gloss":"recibo"}]'::jsonb, 'Can I have the receipt?', 'Pode me dar o recibo?'),
  ('unit-1000-words-a1-31-19', 'lesson-1000-words-a1-31', 19, 'word', 'salary', 'salário', '/ˈsæləri/', '"Raise" = aumento.', '[]'::jsonb, '[{"surface":"salary","pos":"noun","ipa":"/ˈsæləri/","gloss":"salário"}]'::jsonb, 'I got a raise in my salary.', 'Tive aumento no salário.'),
  ('unit-1000-words-a1-31-20', 'lesson-1000-words-a1-31', 20, 'word', 'budget', 'orçamento', '/ˈbʌdʒɪt/', NULL, '[]'::jsonb, '[{"surface":"budget","pos":"noun","ipa":"/ˈbʌdʒɪt/","gloss":"orçamento"}]'::jsonb, 'We are on a tight budget.', 'Estamos com o orçamento apertado.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-32', 'course-1000-words-a1', 32, 'Saúde e sintomas', 'Dizer o que sente e entender o médico.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-32-01', 'lesson-1000-words-a1-32', 1, 'word', 'sick', 'doente', '/sɪk/', '"Sick" também é enjoado.', '[]'::jsonb, '[{"surface":"sick","pos":"adjective","ipa":"/sɪk/","gloss":"doente, enjoado"}]'::jsonb, 'I feel sick.', 'Estou me sentindo mal.'),
  ('unit-1000-words-a1-32-02', 'lesson-1000-words-a1-32', 2, 'word', 'pain', 'dor', '/peɪn/', NULL, '[]'::jsonb, '[{"surface":"pain","pos":"noun","ipa":"/peɪn/","gloss":"dor"}]'::jsonb, 'I have a pain in my back.', 'Estou com dor nas costas.'),
  ('unit-1000-words-a1-32-03', 'lesson-1000-words-a1-32', 3, 'word', 'headache', 'dor de cabeça', '/ˈhɛdeɪk/', NULL, '[]'::jsonb, '[{"surface":"headache","pos":"noun","ipa":"/ˈhɛdeɪk/","gloss":"dor de cabeça"}]'::jsonb, 'I have a headache.', 'Estou com dor de cabeça.'),
  ('unit-1000-words-a1-32-04', 'lesson-1000-words-a1-32', 4, 'word', 'fever', 'febre', '/ˈfiːvər/', NULL, '[]'::jsonb, '[{"surface":"fever","pos":"noun","ipa":"/ˈfiːvər/","gloss":"febre"}]'::jsonb, 'She has a high fever.', 'Ela está com febre alta.'),
  ('unit-1000-words-a1-32-05', 'lesson-1000-words-a1-32', 5, 'word', 'cough', 'tosse', '/kɔːf/', NULL, '[]'::jsonb, '[{"surface":"cough","pos":"noun","ipa":"/kɔːf/","gloss":"tosse"}]'::jsonb, 'I have a bad cough.', 'Estou com uma tosse forte.'),
  ('unit-1000-words-a1-32-06', 'lesson-1000-words-a1-32', 6, 'word', 'cold', 'resfriado', '/koʊld/', '"Catch a cold" = pegar um resfriado.', '[]'::jsonb, '[{"surface":"cold","pos":"noun","ipa":"/koʊld/","gloss":"resfriado; frio"}]'::jsonb, 'I caught a cold.', 'Peguei um resfriado.'),
  ('unit-1000-words-a1-32-07', 'lesson-1000-words-a1-32', 7, 'word', 'flu', 'gripe', '/fluː/', NULL, '[]'::jsonb, '[{"surface":"flu","pos":"noun","ipa":"/fluː/","gloss":"gripe"}]'::jsonb, 'I think I have the flu.', 'Acho que estou com gripe.'),
  ('unit-1000-words-a1-32-08', 'lesson-1000-words-a1-32', 8, 'word', 'allergy', 'alergia', '/ˈælərdʒi/', NULL, '[]'::jsonb, '[{"surface":"allergy","pos":"noun","ipa":"/ˈælərdʒi/","gloss":"alergia"}]'::jsonb, 'I have a peanut allergy.', 'Tenho alergia a amendoim.'),
  ('unit-1000-words-a1-32-09', 'lesson-1000-words-a1-32', 9, 'word', 'medicine', 'remédio', '/ˈmɛdɪsən/', NULL, '[]'::jsonb, '[{"surface":"medicine","pos":"noun","ipa":"/ˈmɛdɪsən/","gloss":"remédio"}]'::jsonb, 'Take your medicine.', 'Tome seu remédio.'),
  ('unit-1000-words-a1-32-10', 'lesson-1000-words-a1-32', 10, 'word', 'pill', 'comprimido', '/pɪl/', NULL, '[]'::jsonb, '[{"surface":"pill","pos":"noun","ipa":"/pɪl/","gloss":"comprimido"}]'::jsonb, 'Take one pill a day.', 'Tome um comprimido por dia.'),
  ('unit-1000-words-a1-32-11', 'lesson-1000-words-a1-32', 11, 'word', 'doctor', 'médico', '/ˈdɑːktər/', NULL, '[]'::jsonb, '[{"surface":"doctor","pos":"noun","ipa":"/ˈdɑːktər/","gloss":"médico"}]'::jsonb, 'You should see a doctor.', 'Você deveria ir ao médico.'),
  ('unit-1000-words-a1-32-12', 'lesson-1000-words-a1-32', 12, 'word', 'nurse', 'enfermeiro', '/nɜːrs/', NULL, '[]'::jsonb, '[{"surface":"nurse","pos":"noun","ipa":"/nɜːrs/","gloss":"enfermeiro"}]'::jsonb, 'The nurse will call you.', 'A enfermeira vai te chamar.'),
  ('unit-1000-words-a1-32-13', 'lesson-1000-words-a1-32', 13, 'word', 'hospital', 'hospital', '/ˈhɑːspɪtəl/', NULL, '[]'::jsonb, '[{"surface":"hospital","pos":"noun","ipa":"/ˈhɑːspɪtəl/","gloss":"hospital"}]'::jsonb, 'He is in the hospital.', 'Ele está no hospital.'),
  ('unit-1000-words-a1-32-14', 'lesson-1000-words-a1-32', 14, 'word', 'pharmacy', 'farmácia', '/ˈfɑːrməsi/', NULL, '[]'::jsonb, '[{"surface":"pharmacy","pos":"noun","ipa":"/ˈfɑːrməsi/","gloss":"farmácia"}]'::jsonb, 'Is there a pharmacy nearby?', 'Tem farmácia por perto?'),
  ('unit-1000-words-a1-32-15', 'lesson-1000-words-a1-32', 15, 'word', 'hurt', 'doer, machucar', '/hɜːrt/', NULL, '[]'::jsonb, '[{"surface":"hurt","pos":"verb","ipa":"/hɜːrt/","gloss":"doer, machucar"}]'::jsonb, 'My knee hurts.', 'Meu joelho dói.'),
  ('unit-1000-words-a1-32-16', 'lesson-1000-words-a1-32', 16, 'word', 'tired', 'cansado', '/ˈtaɪərd/', NULL, '[]'::jsonb, '[{"surface":"tired","pos":"adjective","ipa":"/ˈtaɪərd/","gloss":"cansado"}]'::jsonb, 'I am always tired.', 'Estou sempre cansado.'),
  ('unit-1000-words-a1-32-17', 'lesson-1000-words-a1-32', 17, 'word', 'dizzy', 'tonto', '/ˈdɪzi/', NULL, '[]'::jsonb, '[{"surface":"dizzy","pos":"adjective","ipa":"/ˈdɪzi/","gloss":"tonto"}]'::jsonb, 'I feel dizzy.', 'Estou tonto.'),
  ('unit-1000-words-a1-32-18', 'lesson-1000-words-a1-32', 18, 'word', 'healthy', 'saudável', '/ˈhɛlθi/', NULL, '[]'::jsonb, '[{"surface":"healthy","pos":"adjective","ipa":"/ˈhɛlθi/","gloss":"saudável"}]'::jsonb, 'Eat healthy food.', 'Coma comida saudável.'),
  ('unit-1000-words-a1-32-19', 'lesson-1000-words-a1-32', 19, 'word', 'rest', 'descansar; descanso', '/rɛst/', NULL, '[]'::jsonb, '[{"surface":"rest","pos":"verb","ipa":"/rɛst/","gloss":"descansar"}]'::jsonb, 'You need to rest.', 'Você precisa descansar.'),
  ('unit-1000-words-a1-32-20', 'lesson-1000-words-a1-32', 20, 'word', 'appointment', 'consulta', '/əˈpɔɪntmənt/', NULL, '[]'::jsonb, '[{"surface":"appointment","pos":"noun","ipa":"/əˈpɔɪntmənt/","gloss":"consulta, horário marcado"}]'::jsonb, 'I have a doctor''s appointment.', 'Tenho consulta médica.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-33', 'course-1000-words-a1', 33, 'Música e cinema', 'Filmes, séries, shows e música.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-33-01', 'lesson-1000-words-a1-33', 1, 'word', 'music', 'música', '/ˈmjuːzɪk/', NULL, '[]'::jsonb, '[{"surface":"music","pos":"noun","ipa":"/ˈmjuːzɪk/","gloss":"música"}]'::jsonb, 'What kind of music do you like?', 'Que tipo de música você gosta?'),
  ('unit-1000-words-a1-33-02', 'lesson-1000-words-a1-33', 2, 'word', 'song', 'canção, música', '/sɔːŋ/', '"Song" é uma canção; "music" é a música em geral.', '[]'::jsonb, '[{"surface":"song","pos":"noun","ipa":"/sɔːŋ/","gloss":"canção, música"}]'::jsonb, 'This is my favorite song.', 'Esta é minha música favorita.'),
  ('unit-1000-words-a1-33-03', 'lesson-1000-words-a1-33', 3, 'word', 'singer', 'cantor', '/ˈsɪŋər/', NULL, '[]'::jsonb, '[{"surface":"singer","pos":"noun","ipa":"/ˈsɪŋər/","gloss":"cantor"}]'::jsonb, 'She is a famous singer.', 'Ela é uma cantora famosa.'),
  ('unit-1000-words-a1-33-04', 'lesson-1000-words-a1-33', 4, 'word', 'band', 'banda', '/bænd/', NULL, '[]'::jsonb, '[{"surface":"band","pos":"noun","ipa":"/bænd/","gloss":"banda"}]'::jsonb, 'My brother plays in a band.', 'Meu irmão toca numa banda.'),
  ('unit-1000-words-a1-33-05', 'lesson-1000-words-a1-33', 5, 'word', 'concert', 'show', '/ˈkɑːnsərt/', NULL, '[]'::jsonb, '[{"surface":"concert","pos":"noun","ipa":"/ˈkɑːnsərt/","gloss":"show"}]'::jsonb, 'We went to a concert.', 'Fomos a um show.'),
  ('unit-1000-words-a1-33-06', 'lesson-1000-words-a1-33', 6, 'word', 'guitar', 'violão, guitarra', '/ɡɪˈtɑːr/', NULL, '[]'::jsonb, '[{"surface":"guitar","pos":"noun","ipa":"/ɡɪˈtɑːr/","gloss":"violão, guitarra"}]'::jsonb, 'I play the guitar.', 'Toco violão.'),
  ('unit-1000-words-a1-33-07', 'lesson-1000-words-a1-33', 7, 'word', 'drums', 'bateria (instrumento)', '/drʌmz/', NULL, '[]'::jsonb, '[{"surface":"drums","pos":"noun","ipa":"/drʌmz/","gloss":"bateria (instrumento)"}]'::jsonb, 'He plays the drums.', 'Ele toca bateria.'),
  ('unit-1000-words-a1-33-08', 'lesson-1000-words-a1-33', 8, 'word', 'movie', 'filme', '/ˈmuːvi/', NULL, '[]'::jsonb, '[{"surface":"movie","pos":"noun","ipa":"/ˈmuːvi/","gloss":"filme"}]'::jsonb, 'Let''s watch a movie.', 'Vamos ver um filme.'),
  ('unit-1000-words-a1-33-09', 'lesson-1000-words-a1-33', 9, 'word', 'series', 'série', '/ˈsɪriːz/', NULL, '[]'::jsonb, '[{"surface":"series","pos":"noun","ipa":"/ˈsɪriːz/","gloss":"série"}]'::jsonb, 'This series is great.', 'Esta série é ótima.'),
  ('unit-1000-words-a1-33-10', 'lesson-1000-words-a1-33', 10, 'word', 'episode', 'episódio', '/ˈɛpɪsoʊd/', NULL, '[]'::jsonb, '[{"surface":"episode","pos":"noun","ipa":"/ˈɛpɪsoʊd/","gloss":"episódio"}]'::jsonb, 'One more episode!', 'Só mais um episódio!'),
  ('unit-1000-words-a1-33-11', 'lesson-1000-words-a1-33', 11, 'word', 'actor', 'ator', '/ˈæktər/', NULL, '[]'::jsonb, '[{"surface":"actor","pos":"noun","ipa":"/ˈæktər/","gloss":"ator"}]'::jsonb, 'He is my favorite actor.', 'Ele é meu ator favorito.'),
  ('unit-1000-words-a1-33-12', 'lesson-1000-words-a1-33', 12, 'word', 'theater', 'cinema, teatro', '/ˈθiːətər/', 'EUA: "movie theater"; Reino Unido: "cinema".', '[]'::jsonb, '[{"surface":"theater","pos":"noun","ipa":"/ˈθiːətər/","gloss":"cinema, teatro"}]'::jsonb, 'The movie theater is full.', 'O cinema está lotado.'),
  ('unit-1000-words-a1-33-13', 'lesson-1000-words-a1-33', 13, 'word', 'ticket', 'ingresso', '/ˈtɪkɪt/', NULL, '[]'::jsonb, '[{"surface":"ticket","pos":"noun","ipa":"/ˈtɪkɪt/","gloss":"passagem, bilhete"}]'::jsonb, 'Two tickets, please.', 'Dois ingressos, por favor.'),
  ('unit-1000-words-a1-33-14', 'lesson-1000-words-a1-33', 14, 'word', 'scene', 'cena', '/siːn/', NULL, '[]'::jsonb, '[{"surface":"scene","pos":"noun","ipa":"/siːn/","gloss":"cena"}]'::jsonb, 'That scene was amazing.', 'Aquela cena foi incrível.'),
  ('unit-1000-words-a1-33-15', 'lesson-1000-words-a1-33', 15, 'word', 'ending', 'final', '/ˈɛndɪŋ/', NULL, '[]'::jsonb, '[{"surface":"ending","pos":"noun","ipa":"/ˈɛndɪŋ/","gloss":"final"}]'::jsonb, 'I loved the ending.', 'Adorei o final.'),
  ('unit-1000-words-a1-33-16', 'lesson-1000-words-a1-33', 16, 'word', 'subtitles', 'legendas', '/ˈsʌbtaɪtəlz/', NULL, '[]'::jsonb, '[{"surface":"subtitles","pos":"noun","ipa":"/ˈsʌbtaɪtəlz/","gloss":"legendas"}]'::jsonb, 'Turn on the subtitles.', 'Liga as legendas.'),
  ('unit-1000-words-a1-33-17', 'lesson-1000-words-a1-33', 17, 'word', 'album', 'álbum', '/ˈælbəm/', NULL, '[]'::jsonb, '[{"surface":"album","pos":"noun","ipa":"/ˈælbəm/","gloss":"álbum"}]'::jsonb, 'Their new album is out.', 'O álbum novo deles saiu.'),
  ('unit-1000-words-a1-33-18', 'lesson-1000-words-a1-33', 18, 'word', 'dance', 'dançar', '/dæns/', NULL, '[]'::jsonb, '[{"surface":"dance","pos":"verb","ipa":"/dæns/","gloss":"dançar"}]'::jsonb, 'Do you like to dance?', 'Você gosta de dançar?'),
  ('unit-1000-words-a1-33-19', 'lesson-1000-words-a1-33', 19, 'word', 'listen', 'escutar', '/ˈlɪsən/', 'Sempre "listen to" + algo.', '[]'::jsonb, '[{"surface":"listen","pos":"verb","ipa":"/ˈlɪsən/","gloss":"escutar"}]'::jsonb, 'Listen to this song.', 'Escuta esta música.'),
  ('unit-1000-words-a1-33-20', 'lesson-1000-words-a1-33', 20, 'word', 'watch', 'assistir', '/wɑːtʃ/', NULL, '[]'::jsonb, '[{"surface":"watch","pos":"noun","ipa":"/wɑːtʃ/","gloss":"relógio de pulso"}]'::jsonb, 'I watch a lot of movies.', 'Assisto a muitos filmes.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;

INSERT INTO public.course_lessons (id, course_id, chapter_number, title, description)
VALUES ('lesson-1000-words-a1-34', 'course-1000-words-a1', 34, 'Viagem', 'Palavras essenciais para viajar.')
ON CONFLICT (id) DO UPDATE SET chapter_number = EXCLUDED.chapter_number, title = EXCLUDED.title, description = EXCLUDED.description;

INSERT INTO public.course_units (id, lesson_id, order_index, kind, text, translation_pt, ipa, explanation_note, syntax_groups, annotations, example_en, example_pt)
VALUES
  ('unit-1000-words-a1-34-01', 'lesson-1000-words-a1-34', 1, 'word', 'trip', 'viagem', '/trɪp/', '"Trip" = viagem específica; "travel" = o ato de viajar.', '[]'::jsonb, '[{"surface":"trip","pos":"noun","ipa":"/trɪp/","gloss":"viagem"}]'::jsonb, 'How was your trip?', 'Como foi sua viagem?'),
  ('unit-1000-words-a1-34-02', 'lesson-1000-words-a1-34', 2, 'word', 'travel', 'viajar', '/ˈtrævəl/', NULL, '[]'::jsonb, '[{"surface":"travel","pos":"verb","ipa":"/ˈtrævəl/","gloss":"viajar"}]'::jsonb, 'I love to travel.', 'Adoro viajar.'),
  ('unit-1000-words-a1-34-03', 'lesson-1000-words-a1-34', 3, 'word', 'passport', 'passaporte', '/ˈpæspɔːrt/', NULL, '[]'::jsonb, '[{"surface":"passport","pos":"noun","ipa":"/ˈpæspɔːrt/","gloss":"passaporte"}]'::jsonb, 'Don''t forget your passport.', 'Não esqueça o passaporte.'),
  ('unit-1000-words-a1-34-04', 'lesson-1000-words-a1-34', 4, 'word', 'visa', 'visto', '/ˈviːzə/', NULL, '[]'::jsonb, '[{"surface":"visa","pos":"noun","ipa":"/ˈviːzə/","gloss":"visto"}]'::jsonb, 'Do I need a visa?', 'Preciso de visto?'),
  ('unit-1000-words-a1-34-05', 'lesson-1000-words-a1-34', 5, 'word', 'luggage', 'bagagem', '/ˈlʌɡɪdʒ/', 'Incontável: "a piece of luggage" = uma mala.', '[]'::jsonb, '[{"surface":"luggage","pos":"noun","ipa":"/ˈlʌɡɪdʒ/","gloss":"bagagem"}]'::jsonb, 'Where is my luggage?', 'Cadê minha bagagem?'),
  ('unit-1000-words-a1-34-06', 'lesson-1000-words-a1-34', 6, 'word', 'suitcase', 'mala', '/ˈsuːtkeɪs/', NULL, '[]'::jsonb, '[{"surface":"suitcase","pos":"noun","ipa":"/ˈsuːtkeɪs/","gloss":"mala"}]'::jsonb, 'My suitcase is heavy.', 'Minha mala está pesada.'),
  ('unit-1000-words-a1-34-07', 'lesson-1000-words-a1-34', 7, 'word', 'flight', 'voo', '/flaɪt/', NULL, '[]'::jsonb, '[{"surface":"flight","pos":"noun","ipa":"/flaɪt/","gloss":"voo"}]'::jsonb, 'My flight is at noon.', 'Meu voo é ao meio-dia.'),
  ('unit-1000-words-a1-34-08', 'lesson-1000-words-a1-34', 8, 'word', 'airport', 'aeroporto', '/ˈɛrpɔːrt/', NULL, '[]'::jsonb, '[{"surface":"airport","pos":"noun","ipa":"/ˈɛrpɔːrt/","gloss":"aeroporto"}]'::jsonb, 'Take me to the airport.', 'Me leve ao aeroporto.'),
  ('unit-1000-words-a1-34-09', 'lesson-1000-words-a1-34', 9, 'word', 'gate', 'portão de embarque', '/ɡeɪt/', NULL, '[]'::jsonb, '[{"surface":"gate","pos":"noun","ipa":"/ɡeɪt/","gloss":"portão"}]'::jsonb, 'Go to gate twelve.', 'Vá ao portão doze.'),
  ('unit-1000-words-a1-34-10', 'lesson-1000-words-a1-34', 10, 'word', 'hotel', 'hotel', '/hoʊˈtɛl/', NULL, '[]'::jsonb, '[{"surface":"hotel","pos":"noun","ipa":"/hoʊˈtɛl/","gloss":"hotel"}]'::jsonb, 'The hotel is near the beach.', 'O hotel fica perto da praia.'),
  ('unit-1000-words-a1-34-11', 'lesson-1000-words-a1-34', 11, 'word', 'reservation', 'reserva', '/ˌrɛzərˈveɪʃən/', NULL, '[]'::jsonb, '[{"surface":"reservation","pos":"noun","ipa":"/ˌrɛzərˈveɪʃən/","gloss":"reserva"}]'::jsonb, 'I have a reservation.', 'Tenho uma reserva.'),
  ('unit-1000-words-a1-34-12', 'lesson-1000-words-a1-34', 12, 'word', 'map', 'mapa', '/mæp/', NULL, '[]'::jsonb, '[{"surface":"map","pos":"noun","ipa":"/mæp/","gloss":"mapa"}]'::jsonb, 'Can I have a map?', 'Pode me dar um mapa?'),
  ('unit-1000-words-a1-34-13', 'lesson-1000-words-a1-34', 13, 'word', 'tourist', 'turista', '/ˈtʊrɪst/', NULL, '[]'::jsonb, '[{"surface":"tourist","pos":"noun","ipa":"/ˈtʊrɪst/","gloss":"turista"}]'::jsonb, 'This place is full of tourists.', 'Este lugar está cheio de turistas.'),
  ('unit-1000-words-a1-34-14', 'lesson-1000-words-a1-34', 14, 'word', 'guide', 'guia', '/ɡaɪd/', NULL, '[]'::jsonb, '[{"surface":"guide","pos":"noun","ipa":"/ɡaɪd/","gloss":"guia"}]'::jsonb, 'The guide speaks English.', 'O guia fala inglês.'),
  ('unit-1000-words-a1-34-15', 'lesson-1000-words-a1-34', 15, 'word', 'souvenir', 'lembrancinha', '/ˌsuːvəˈnɪr/', NULL, '[]'::jsonb, '[{"surface":"souvenir","pos":"noun","ipa":"/ˌsuːvəˈnɪr/","gloss":"lembrancinha"}]'::jsonb, 'I bought a souvenir.', 'Comprei uma lembrancinha.'),
  ('unit-1000-words-a1-34-16', 'lesson-1000-words-a1-34', 16, 'word', 'beach', 'praia', '/biːtʃ/', NULL, '[]'::jsonb, '[{"surface":"beach","pos":"noun","ipa":"/biːtʃ/","gloss":"praia"}]'::jsonb, 'Let''s go to the beach.', 'Vamos à praia.'),
  ('unit-1000-words-a1-34-17', 'lesson-1000-words-a1-34', 17, 'word', 'abroad', 'no exterior', '/əˈbrɔːd/', 'Sem "to": "go abroad".', '[]'::jsonb, '[{"surface":"abroad","pos":"adverb","ipa":"/əˈbrɔːd/","gloss":"no exterior"}]'::jsonb, 'She lives abroad.', 'Ela mora no exterior.'),
  ('unit-1000-words-a1-34-18', 'lesson-1000-words-a1-34', 18, 'word', 'vacation', 'férias', '/veɪˈkeɪʃən/', 'Reino Unido: "holiday".', '[]'::jsonb, '[{"surface":"vacation","pos":"noun","ipa":"/veɪˈkeɪʃən/","gloss":"férias"}]'::jsonb, 'I''m on vacation.', 'Estou de férias.'),
  ('unit-1000-words-a1-34-19', 'lesson-1000-words-a1-34', 19, 'word', 'delay', 'atraso', '/dɪˈleɪ/', NULL, '[]'::jsonb, '[{"surface":"delay","pos":"noun","ipa":"/dɪˈleɪ/","gloss":"atraso"}]'::jsonb, 'There is a two hour delay.', 'Tem um atraso de duas horas.'),
  ('unit-1000-words-a1-34-20', 'lesson-1000-words-a1-34', 20, 'word', 'backpack', 'mochila', '/ˈbækpæk/', NULL, '[]'::jsonb, '[{"surface":"backpack","pos":"noun","ipa":"/ˈbækpæk/","gloss":"mochila"}]'::jsonb, 'I travel with just a backpack.', 'Viajo só com uma mochila.')
ON CONFLICT (id) DO UPDATE SET order_index = EXCLUDED.order_index, text = EXCLUDED.text, translation_pt = EXCLUDED.translation_pt,
  ipa = EXCLUDED.ipa, explanation_note = EXCLUDED.explanation_note, syntax_groups = EXCLUDED.syntax_groups,
  annotations = EXCLUDED.annotations,
  kind = EXCLUDED.kind, example_en = EXCLUDED.example_en, example_pt = EXCLUDED.example_pt;
