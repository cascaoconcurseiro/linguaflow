# Prompt da próxima sessão — LinguaFlow

> **ATUALIZADO 17/07 (noite).** A versão anterior deste arquivo pedia para "continuar a auditoria" — isso JÁ ACABOU. Auditoria lida (~95%+ do código de superfície), e TODAS as fases de execução (1-6) foram concluídas. Não recomece nada.

Copie o bloco abaixo como primeira mensagem da sessão nova.

---

Leia primeiro, nesta ordem: `HANDOFF.md` (topo), depois a seção "Auditoria real" do `CHECKLIST.md`. O documento canônico de achados é `docs/AUDITORIA_REAL_2026-07-16.md` (seções § anotadas com ✅ quando executadas).

## Estado (17/07, noite)

- **Fases 1-6 concluídas** na branch `docs/code-audit-2026-07-16`: 13 bugs corrigidos, shadowing religado (mic + score + diff), histórias com variedade obrigatória, 7 decisões de produto executadas, 3 arquivos órfãos apagados (a engine real `content/subtitle-engine.js` está intacta), leitura de borda completa com zero bug funcional.
- `test:release` verde em todos os ~30 commits.

## O que REALMENTE falta (não invente trabalho novo)

1. **Merge para `main`** — pendência do DONO (o classificador de permissões desta ferramenta bloqueia mutação de main pela sessão): `git push origin docs/code-audit-2026-07-16:main` (fast-forward limpo, conferido).
2. **Testes manuais do dono** — roteiros prontos no CHECKLIST (Fases 2, 3, 4 + histórias). Nada é "entregue" sem eles.
3. **Verificação de 1 clique:** `https://linguaflow.vercel.app/` resolve? Se não, corrigir a URL do e-mail de reengajamento (§4q.2).
4. Dívidas conscientes, baixa prioridade: ~160 linhas mortas em `_processYtSub` (§4d.11), guards defensivos `lf-save-btn`/`lf-btn-loop`/`lf-hbo-switch`, GitHub Actions travado por billing.

## Regras que continuam valendo

- Ler arquivo inteiro antes de afirmar; nunca schema por migration (banco vivo: projeto Supabase `qnutoswrufznztoznlql`, somente leitura); nunca propor feature sem procurar se já existe; registrar achados na auditoria ANTES de conversar; sessões paralelas ativas — `git status` antes de commitar, commitar só os próprios arquivos.
- Protocolo de documentação por item: `[x]` no CHECKLIST com data → entrada no HANDOFF → anotar a § da auditoria.
- Planos antigos `BRIEF_FABLE5*` e `PLANO_FLUENCIA*` estão SUSPENSOS — não executar.

## Se o dono pedir "o que fazer agora"

Depois do merge + testes manuais, o próximo capítulo não é dívida técnica — é USO: recarregar a extensão, assistir série de verdade, capturar frases, e observar onde o fluxo real range. Os achados de uso valem mais que qualquer nova rodada de auditoria.
