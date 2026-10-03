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

## Limites conhecidos

- Não há interface gráfica de edição: exige um backend de escrita para administradores, com
  auditoria, e uma decisão sobre revisão humana. Está fora do escopo atual.
- O verificador garante formato, IPA válido, léxico e imutabilidade; **não** garante que a
  tradução está boa.
