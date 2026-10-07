# Níveis e sequência de estudo dos cursos

Auditoria editorial de 2026-10-06, Issue [#528](https://github.com/cascaoconcurseiro/linguaflow/issues/528).
Cobertura: **30 cursos, 372 aulas e 4.088 itens efetivos**, após aplicar cronologicamente lotes,
correções, offsets e retiradas. A primeira aula histórica de gírias foi incluída a partir da migration
inicial; ela não aparece em `courses.mjs`. Não foi utilizada apenas a amostra de cinco itens por curso.
A leitura editorial considera todos os textos-alvo e os exemplos das formas verbais; o áudio não foi avaliado.

## Critério e fontes

O [CEFR Companion Volume, Conselho da Europa, 2020](https://rm.coe.int/common-european-framework-of-reference-for-languages-learning-teaching/16809ea0d4)
descreve capacidades em tarefas, não uma lista obrigatória de temas por nível. As escalas de compreensão
oral (p. 48), repertório lexical (p. 131) e adequação sociolinguística (p. 137) orientam a decisão:
situações concretas e apoio forte nos níveis iniciais; informação factual/narrativa no intermediário;
argumentação, registro e interpretação implícita nos níveis superiores. Comprimento ou frequência
de uma palavra, isoladamente, não determinam a dificuldade da aula.

O [English Vocabulary Profile](https://englishprofile.org/?menu=english-vocabulary-profile) distingue
palavras, sentidos, expressões e colocações. Aqui é uma referência metodológica: **não foi feita uma
consulta individual ao EVP para cada palavra**, nem atribuída certificação oficial às aulas.

Como referências de conteúdos em inglês, foram consultados os conjuntos oficiais do British Council:
[A1–A2](https://learnenglish.britishcouncil.org/free-resources/grammar/a1-a2),
[B1–B2](https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2),
[phrasal verbs](https://learnenglish.britishcouncil.org/free-resources/grammar/b1-b2/phrasal-verbs) e
[C1](https://learnenglish.britishcouncil.org/free-resources/grammar/c1).
Os primeiros incluem estruturas básicas e preposições; os intermediários trabalham contrastes temporais,
perfect e phrasal verbs; C1 inclui ênfase e inversão. As faixas agrupadas dessas fontes não dizem
sozinhas se uma aula concreta deve ser B1 ou B2: essa separação é julgamento editorial do LinguaFlow.
Os manuais [A2 Key](https://www.cambridgeenglish.org/Images/610842-a2-key-handbook-for-teachers.pdf) e
[B1 Preliminary](https://www.cambridgeenglish.org/Images/168150-b1-preliminary-teachers-handbook.pdf)
foram consultados como contexto de tarefas e avaliação; não como um currículo universal de gramática.

A classificação considera conjuntamente o texto, o sentido usado, a quantidade de conteúdo novo,
as construções gramaticais e a tarefa de ouvir/digitar. Uma fórmula isolada pode aparecer cedo;
uma aula densa em idiomatismos e sentidos não literais exige preparação. Para conteúdo misto,
o nível da aula considera suas exigências mais difíceis que precisam ser estudadas, não a média
das frases nem o rótulo do curso. Nos cursos de palavras, o alvo avaliado é o item lexical isolado;
um exemplo de apoio não transforma automaticamente a tarefa em produção livre daquele texto.

Estas são **decisões editoriais fundamentadas**, não validação psicométrica, certificação CEFR,
revisão humana de IPA/tradução ou garantia de compreensão do TTS. Precisam ser refinadas com
professor e alunos; especialmente a inferência de sarcasmo depende de contexto e entoação,
e as notas devem preservar interpretações alternativas.

## O que mudou

186 aulas receberam um nível diferente do antigo nível único do curso. As outras foram examinadas
e mantidas. A [planilha integral de decisões](CURRICULO_AULAS.csv) contém uma linha por aula,
com nível anterior, novo nível, ordem, pré-requisitos, quantidade de itens, dois exemplos de evidência
e critério. Esses exemplos documentam a decisão; não representam o tamanho da leitura realizada.

| Conteúdo | Antes | Classificação por aula |
|---|---|---|
| Inglês das Ruas & Gírias Reais | A1 | B1–B2; nenhum capítulo entra no A1 |
| Verbos Essenciais | A1 | B1, após present perfect e passado; cada aula combina vários tempos |
| Primeiras Frases | A1 | A1–A2; was/were e revisão com passado ficam no A2 |
| Vocabulário Essencial por Temas | A1, nome prometia 1000 palavras | A1–B1; 880 itens existentes, sem inventar os 120 faltantes |
| Tempos Verbais em Uso | B1 | A2–B2; contrastes básicos antecipados, contrafactuais e dedução passada depois |
| Preposições e Conectores | B1 | A1–B2; lugar concreto cedo, concessão/contraste discursivo depois |
| Viagem, Rotina, Compras e Saúde | A2 | A2–B1; aulas com perfect, passiva ou maior complexidade deslocadas |
| Vida Social | A2 | A2–B2; convites antes de experiências e reparação diplomática |
| Inglês no Trabalho e Entrevista | B1 | B1–B2; informação factual antes de negociação e diplomacia |
| Gramática Intermediária e Avançada | B2 | B2–C1; clivagem, inversão e futuro perfeito contínuo no C1 |
| Entrelinhas | B2 | B2–C1; sarcasmo e elogio com crítica implícita no C1 |
| Piloto de reduções | A2 | B2, complementar; continua aguardando aceite do áudio |
| Fala Conectada | B2 | A2–B2 por aula, complementar; continua aguardando aceite do áudio |

O catálogo usa uma faixa para cursos mistos; filtros conferem os níveis **realmente presentes** nas aulas.
O campo histórico `course_catalog.level` conserva o nível mais alto da oferta para clientes antigos.
IDs e slugs com `a1`, `b1` etc. são identificadores históricos, não a fonte atual do nível.

## Sequência recomendada

| Ponto de partida | Primeira aula | Progressão no material disponível |
|---|---|---|
| A1 | Primeiras Frases: Eu sou, você é | To be, perguntas/negativas, existência/posse, presente simples, can e instruções; depois lugar, números/horas e vocabulário concreto |
| A2 | Tempos Verbais: Presente simples × contínuo | Was/were, passado simples/contínuo, preposições/agenda, futuro e modais básicos; vocabulário e sobrevivência antes das situações práticas |
| B1 | Tempos Verbais: Present perfect × passado simples | Duração, complementos/preposições, narrativa, condição/passiva/reporte; verbos em contexto antes de phrasal, histórias e trabalho |
| B2 | Tempos Verbais: Terceira condicional | Passivas compostas, dedução passada e modais perfeitos; gramática e vocabulário especializado antes de negociação, idioms e debate |
| C1 | Gramática: Ênfase | Inversão e construções marcadas; registro acadêmico, análise e precisão; por último inferências pragmáticas mais ambíguas |

Ordem e pré-requisitos são definidos por aula em `supabase/content/curriculum.mjs`, independentemente
das categorias da Loja. A recomendação usa a primeira aula pendente do nível atual e verifica os
pré-requisitos; níveis abaixo do ponto de partida escolhido são dispensados. O aluno pode explorar
outros capítulos explicitamente pela Loja, onde vê nível e preparação necessária. A reclassificação
não muda sua configuração de nível, matrícula, sessões, revisões, notas nem aulas concluídas.

Conclusão agora exige todas as aulas centrais disponíveis do nível, em vez do antigo limite de 80%,
para não anunciar um nível seguinte com aulas anteriores pendentes. **Concluir esse conjunto não
equivale a dominar o nível CEFR**; o catálogo não é um currículo completo de todas as habilidades.

| Nível | Aulas auditadas | Aulas centrais na trilha |
|---|---:|---:|
| A1 | 28 | 28 |
| A2 | 88 | 87 |
| B1 | 142 | 139 |
| B2 | 102 | 97 |
| C1 | 12 | 12 |

## Implementação, publicação e continuidade

Fonte editorial: `supabase/content/curriculum.mjs`. Snapshot efetivo:
`scripts/course-content-snapshot.mjs`. Gerador: `scripts/generate-course-curriculum.mjs`;
`--check` verifica drift dos artefatos. O corte desta auditoria é a migration `20261006221000`;
lotes futuros não podem reescrever o SQL histórico desta entrega. Para revisar conteúdo publicado,
crie nova fonte/migration curricular versionada e atualize a auditoria de cobertura, preservando a anterior.

A migration `20261006230000_course_curriculum.sql` acrescenta nível, ordem e pré-requisitos em
`course_lessons`, altera apenas metadados de catálogo/aula e atualiza `rpc_course_catalog` e
`rpc_course_path`. Aulas novas sem auditoria ficam fora da trilha por padrão. A migration recusa
um banco cujo conteúdo diverge do snapshot: 372 aulas, 4.088 unidades, MD5 dos campos editoriais
`d0002890d367706d6d43090022638f99`. O hash não avalia a qualidade pedagógica do conteúdo.

**Ordem de publicação:** CI/replay verde, aplicar a migration numa transação no banco, verificar
metadados e recomendações, então integrar a interface à main. Clientes antigos continuam recebendo
os campos existentes. Aplicar a interface antes da migration quebra a consulta direta da aula,
que passa a pedir o campo `level`. Não misturar publicação de código com evidência de banco atualizado.

Rollback operacional: `supabase/rollback/course_curriculum_528.sql`, numa transação. Restaura
níveis/títulos/descrições anteriores e as RPCs anteriores, mantém as colunas adicionadas e todo
histórico. Se necessário, reverter também o PR da interface. Não apagar cursos ou progresso para
reverter uma classificação.

Perguntas operacionais, verificáveis sem conteúdo pessoal:

1. Quantas aulas por nível estão auditadas e centrais? Agrupar `course_lessons` por `level/is_core`.
2. Entrou conteúdo novo sem decisão editorial? Contar aulas com unidades e `curriculum_order IS NULL`.
3. Existe pré-requisito ausente ou posterior? Expandir `prerequisite_lesson_ids` e comparar com
   `course_lessons.id/curriculum_order`. A RPC anuncia `blocked` quando há pendências sem próxima aula elegível.

Validação comportamental: `tests/sql/course-curriculum-528.sql` no Postgres descartável do CI;
cobre início A1/A2/B1/B2/C1, curso misto, progresso de outra conta, última aula pendente e conteúdo
novo sem auditoria. `tests/course-curriculum-528.test.mjs` verifica cobertura, dependências,
filtro/faixa, ordem e preservação de conteúdo/progresso no SQL. CI não substitui QA autenticado
de produção, escuta do áudio nem avaliação com alunos. O estado publicado e as evidências finais
devem ser registrados na Issue/PR e no handoff.
