# Auditoria de cobertura de tópicos por nível (#548)

Gerado por `npm run content:coverage`; não edite manualmente. Mede o que a trilha publicada cobre em relação a uma lista editorial de 66 tópicos esperados por nível (CEFR, em linha com os repertórios do British Council e do Conselho da Europa citados em CURRICULO_CEFR.md). Heurística por regex sobre as frases publicadas: aponta onde olhar, não cria conteúdo nem substitui decisão pedagógica.

## Resumo

- Coberto por aula dedicada no nível esperado: 51
- Aula dedicada em nível anterior ao esperado: 0; em nível posterior: 0
- Só em contexto (sem aula dedicada, 3+ frases): 10
- Cobertura fina (1 a 2 frases): 1
- Lacuna (nenhuma frase no nível esperado ou depois): 4

## Lacunas e coberturas finas (candidatas a aula nova)

- **A2 · pronomes reflexivos**: fino (frases por nível A1/A2/B1/B2/C1: 0 / 0 / 0 / 1 / 0)
- **B1 · had better / be supposed to**: lacuna
- **B1 · so ... that / such ... that**: lacuna
- **B2 · verbos de relato (suggest, admit, deny + -ing)**: lacuna (frases por nível A1/A2/B1/B2/C1: 0 / 0 / 1 / 0 / 0)
- **B2 · the more ... the more**: lacuna

## Matriz completa

Colunas de frases: contagem em A1 / A2 / B1 / B2 / C1 nas aulas-base (só para tópicos sem aula dedicada).

| Nível esperado | Tópico | Aula dedicada | Frases por nível | Situação |
|---|---|---|---|---|
| A1 | verbo to be | first-sentences-a1-01 (A1) | — | coberto |
| A1 | artigos a/an/the | pedagogy-a1-articles (A1) | — | coberto |
| A1 | plural | pedagogy-a1-plurals (A1) | — | coberto |
| A1 | this/that/these/those | pedagogy-a1-demonstratives (A1) | — | coberto |
| A1 | there is / there are | first-sentences-a1-04 (A1) | — | coberto |
| A1 | possessivos | first-sentences-a1-05 (A1) | — | coberto |
| A1 | presente simples | first-sentences-a1-06 (A1) | — | coberto |
| A1 | can (habilidade e pedido) | first-sentences-a1-08 (A1) | — | coberto |
| A1 | imperativo | first-sentences-a1-09 (A1) | — | coberto |
| A1 | presente contínuo | pedagogy-a1-now (A1) | — | coberto |
| A1 | perguntas com what/where/when/who/how | sequence-a1-wh (A1) | — | coberto |
| A1 | some e any | pedagogy-a1-some-any (A1) | — | coberto |
| A1 | pronomes de objeto | pedagogy-a1-object-pronouns (A1) | — | coberto |
| A1 | preposições de lugar | prepositions-b1-02 (A1) | — | coberto |
| A1 | would like (pedir com educação) | — | 2 / 3 / 4 / 1 / 0 | em contexto |
| A1 | how much / how many | — | 2 / 5 / 3 / 1 / 0 | em contexto |
| A2 | passado simples | pedagogy-a2-past-simple (A2) | — | coberto |
| A2 | was / were | first-sentences-a1-11 (A2) | — | coberto |
| A2 | passado contínuo | tenses-b1-02 (A2) | — | coberto |
| A2 | comparativos | pedagogy-a2-comparatives (A2) | — | coberto |
| A2 | superlativos | pedagogy-a2-superlatives (A2) | — | coberto |
| A2 | contáveis e incontáveis | pedagogy-a2-countability (A2) | — | coberto |
| A2 | too / enough | pedagogy-a2-too-enough (A2) | — | coberto |
| A2 | futuro: will, going to | tenses-b1-05 (A2) | — | coberto |
| A2 | obrigação e conselho (have to, should) | pedagogy-a2-advice-rules (A2) | — | coberto |
| A2 | primeira condicional | pedagogy-a2-simple-conditionals (A2) | — | coberto |
| A2 | verbo + infinitivo/-ing | pedagogy-a2-verb-patterns (A2) | — | coberto |
| A2 | experiências recentes (present perfect básico) | pedagogy-a2-recent-experiences (A2) | — | coberto |
| A2 | as ... as (igualdade) | — | 0 / 0 / 1 / 3 / 0 | em contexto |
| A2 | pronomes reflexivos | — | 0 / 0 / 0 / 1 / 0 | fino |
| A2 | let's / shall we (sugestões) | — | 1 / 4 / 0 / 2 / 0 | em contexto |
| A2 | whose | — | 1 / 1 / 0 / 2 / 0 | em contexto |
| A2 | a lot of / much / many / a few / a little | — | 5 / 26 / 9 / 9 / 0 | em contexto |
| B1 | present perfect × passado simples | tenses-b1-03 (B1) | — | coberto |
| B1 | present perfect contínuo | tenses-b1-04 (B1) | — | coberto |
| B1 | past perfect | tenses-b1-06 (B1) | — | coberto |
| B1 | used to | pedagogy-b1-used-to (B1) | — | coberto |
| B1 | segunda condicional | tenses-b1-08 (B1) | — | coberto |
| B1 | orações relativas simples | pedagogy-b1-simple-relatives (B1) | — | coberto |
| B1 | voz passiva (presente e passado) | tenses-b1-10 (B1) | — | coberto |
| B1 | discurso indireto | tenses-b1-12 (B1) | — | coberto |
| B1 | question tags | sequence-b1-tags (B1) | — | coberto |
| B1 | probabilidade: might, may, must be | pedagogy-b1-probability (B1) | — | coberto |
| B1 | contraste: although, despite, however | pedagogy-b1-reasons-contrast (B1) | — | coberto |
| B1 | be able to | — | 0 / 2 / 1 / 2 / 1 | em contexto |
| B1 | had better / be supposed to | — | 0 / 0 / 0 / 0 / 0 | lacuna |
| B1 | so ... that / such ... that | — | 0 / 0 / 0 / 0 / 0 | lacuna |
| B1 | both / either / neither | — | 0 / 1 / 0 / 1 / 4 | em contexto |
| B1 | gerúndio depois de preposição | — | 0 / 2 / 4 / 9 / 1 | em contexto |
| B2 | terceira condicional | tenses-b1-09 (B2) | — | coberto |
| B2 | condicionais mistos | grammar-b2-02 (B2) | — | coberto |
| B2 | wish e if only | grammar-b2-01 (B2) | — | coberto |
| B2 | passiva em outros tempos | tenses-b1-11 (B2) | — | coberto |
| B2 | causativo (have/get) | grammar-b2-03 (B2) | — | coberto |
| B2 | futuro contínuo e perfeito | pedagogy-b2-future-perfect (B2) | — | coberto |
| B2 | modais no passado (should have) | connected-b2-01 (B2) | — | coberto |
| B2 | gerúndio × infinitivo | grammar-b2-05 (B2) | — | coberto |
| B2 | orações relativas completas | grammar-b2-04 (B2) | — | coberto |
| B2 | verbos de relato (suggest, admit, deny + -ing) | — | 0 / 0 / 1 / 0 / 0 | lacuna |
| B2 | the more ... the more | — | 0 / 0 / 0 / 0 / 0 | lacuna |
| B2 | frases clivadas (it was ... that) | — | 0 / 0 / 1 / 0 / 9 | em contexto |
| C1 | inversão | grammar-b2-07 (C1) | — | coberto |
| C1 | ênfase | grammar-b2-06 (C1) | — | coberto |
| C1 | orações reduzidas (participiais) | pedagogy-c1-participle-clauses (C1) | — | coberto |
| C1 | elipse e substituição | pedagogy-c1-ellipsis (C1) | — | coberto |
| C1 | passivas para relatar | pedagogy-c1-reporting-passives (C1) | — | coberto |
