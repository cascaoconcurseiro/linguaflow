# Auditoria de sequência pedagógica (#544)

Gerado por `npm run content:audit`; não edite manualmente. O teste `tests/course-sequence-audit-544.test.mjs` falha se surgir violação sem exceção declarada ou exceção obsoleta.

## O que verifica

Para cada frase das 233 aulas-base de A1 a B2 (C1 fica fora: sem blocos de gramática comparáveis), procura estruturas que a trilha só ensina depois. Estrutura (aula que a ensina): can / can't (first-sentences-a1-08); do / does / don't (first-sentences-a1-06); there is / there are (first-sentences-a1-04); presente contínuo (pedagogy-a1-now); was / were (first-sentences-a1-11); did / didn't (pedagogy-a2-past-simple); will / going to (tenses-b1-05); could (modals-b1-02); should / have to / must (pedagogy-a2-advice-rules); if (condicional) (pedagogy-a2-simple-conditionals); comparativo (pedagogy-a2-comparatives); present perfect (pedagogy-a2-recent-experiences); used to (pedagogy-b1-used-to).

É heurística por expressão regular: acusa candidatos e não mede qualidade pedagógica nem substitui revisão humana. Estruturas de leitura (passiva, relativas, discurso indireto) não são verificadas.

## Resultado

21 frases em 15 combinações aula/estrutura. Sem exceção declarada: 0. Nenhuma frase foi alterada ou removida: as exceções são fórmulas de sobrevivência ("Can you repeat that?") ou molduras de exemplo ("There is a cup on the table") cuja aula-alvo depende da aula marcada, então reordenar criaria pré-requisito circular. Se algum item deixar de ser aceitável, a correção é uma migration append-only que ajuste `curriculum_order`, nunca editar a #535 publicada.

| Nível | Aula | Estrutura | Ensinada em | Frases | Exemplo | Situação |
|---|---|---|---|---:|---|---|
| A1 | pedagogy-a1-clarify | can / can't | first-sentences-a1-08 | 2 | Can you say that again? | fórmula de sobrevivência ensinada como bloco, sem análise gramatical |
| A1 | pedagogy-a1-clarify | do / does / don't | first-sentences-a1-06 | 3 | I don't understand. | fórmula de sobrevivência ensinada como bloco, sem análise gramatical |
| A1 | sequence-a1-m1 | can / can't | first-sentences-a1-08 | 1 | Sorry, can you repeat that? | fórmula de sobrevivência ensinada como bloco, sem análise gramatical |
| A1 | pedagogy-a1-articles | there is / there are | first-sentences-a1-04 | 1 | There is a cup on the table. | estrutura aparece como moldura do exemplo; a aula que a ensina depende desta (pré-requisito circular) |
| A1 | pedagogy-a1-plurals | there is / there are | first-sentences-a1-04 | 2 | There are three chairs. | estrutura aparece como moldura do exemplo; a aula que a ensina depende desta (pré-requisito circular) |
| A1 | numbers-a1-03 | can / can't | first-sentences-a1-08 | 2 | Can you repeat that, please? | fórmula de sobrevivência ensinada como bloco, sem análise gramatical |
| A1 | numbers-a1-02 | can / can't | first-sentences-a1-08 | 1 | Can you give me a discount? | fórmula de sobrevivência ensinada como bloco, sem análise gramatical |
| A1 | numbers-a1-02 | do / does / don't | first-sentences-a1-06 | 1 | Do you have change for twenty? | fórmula de sobrevivência ensinada como bloco, sem análise gramatical |
| A1 | numbers-a1-02 | will / going to | tenses-b1-05 | 1 | That will be twelve dollars, please. | fórmula de sobrevivência ensinada como bloco, sem análise gramatical |
| A1 | numbers-a1-02 | was / were | first-sentences-a1-11 | 1 | It was half price. | fórmula de sobrevivência ensinada como bloco, sem análise gramatical |
| A1 | pedagogy-a1-object-pronouns | can / can't | first-sentences-a1-08 | 2 | Can you call her? | fórmula de sobrevivência ensinada como bloco, sem análise gramatical |
| A1 | pedagogy-a1-basic-connectors | can / can't | first-sentences-a1-08 | 1 | I can swim, but I can't drive. | fórmula de sobrevivência ensinada como bloco, sem análise gramatical |
| A1 | first-sentences-a1-08 | could | modals-b1-02 | 1 | Could you help me, please? | fórmula de sobrevivência ensinada como bloco, sem análise gramatical |
| A2 | prepositions-b1-01 | will / going to | tenses-b1-05 | 1 | I will call you in ten minutes. | estrutura aparece como moldura do exemplo; a aula que a ensina depende desta (pré-requisito circular) |
| A2 | social-a2-02 | should / have to / must | pedagogy-a2-advice-rules | 1 | Should I bring anything? | fórmula de sobrevivência ensinada como bloco, sem análise gramatical |
