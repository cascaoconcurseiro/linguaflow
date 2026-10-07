# Como criar ou corrigir conteúdo dos cursos

O conteúdo vive em `supabase/content/batches/<lote>.mjs` e vira uma migration SQL **append-only**
(`supabase/migrations/…_course_content_<lote>.sql`). Migration publicada não se edita.

## Fluxo para um lote novo

1. Copie um lote parecido de `supabase/content/batches/` e ajuste cursos, capítulos e frases.
   Cada unidade que não é palavra precisa de **nota gramatical** (aparece em "Mostrar resposta").
2. Valide: `npm run content:check -- <lote>`.
   - Erro de "fora do léxico": o comando já imprime as palavras no formato do `LEXICON`.
     Preencha classe gramatical, **IPA** e glosa. O IPA é validado pelo projeto, mas **a revisão
     humana de tradução e pronúncia continua obrigatória**.
3. Gere a migration: `node scripts/generate-course-seed.mjs <lote> supabase/migrations/<AAAAMMDDHHMMSS>_course_content_<lote>.sql`
   (o carimbo precisa ser posterior ao da última migration).
4. Rode `npm run content:check`: todos os lotes devem estar `ok`.
5. Abra Issue e PR (regra do `AGENTS.md`).

## Corrigir uma frase já publicada

Não edite a migration nem o lote antigo (o teste `tests/content-check.test.mjs` reprova). Crie um
lote novo que reaproveite o `id` da unidade (o `ON CONFLICT … DO UPDATE` a atualiza) e gere uma
migration nova. Para retirar uma unidade, use `retireUnits` no curso do lote novo.

## Classificação e ordem pedagógica

O nível de um lote antigo não define mais o nível de todas as suas aulas. Consulte
[CURRICULO_CEFR.md](CURRICULO_CEFR.md) e a auditoria por aula [CURRICULO_AULAS.csv](CURRICULO_AULAS.csv).
Novas aulas não entram automaticamente na trilha: exigem nível, ordem e pré-requisitos revisados
em uma fonte curricular versionada e migration append-only. Não edite `curriculum.mjs` nem o SQL
da auditoria #528 depois de publicados; uma revisão gera nova versão. O gerador dessa auditoria
tem corte histórico para não incorporar lotes futuros à migration antiga.
O estado efetivo está em `curriculum-current.mjs`: o aceite do áudio em 2026-10-07 (#503/#505)
promove somente as nove aulas revisadas, preservando a fonte histórica #528. O relatório CSV
reflete esse estado efetivo; o SQL e o rollback históricos continuam imutáveis.

## Limites da validação

- Não há interface gráfica de edição: exige um backend de escrita para administradores, com
  auditoria, e uma decisão sobre revisão humana. Está fora do escopo atual.
- O verificador garante formato, IPA válido, léxico e imutabilidade; **não** garante que a
  tradução está boa.

## Revisão humana por amostragem

O verificador não sabe se uma tradução está boa. Para a revisão que só uma pessoa faz:

1. `npm run content:review -- --per-course 5 --seed revisao-1 --out amostra.csv` gera uma planilha (abre no Excel
   com acentos corretos). A mesma semente devolve as mesmas linhas; mude a semente para outra rodada.
2. O revisor preenche `status_revisao` (aprovado / corrigir) e `correcao_sugerida`.
3. Cada correção vira um lote novo (ver "Corrigir uma frase já publicada"). Exemplo real: `correcoes-1`
   corrigiu a nota de "ninety", achada já na primeira amostra.
