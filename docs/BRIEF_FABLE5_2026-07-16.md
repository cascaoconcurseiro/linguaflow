# Brief de execução — Fable 5

**Data:** 2026-07-16 · **Planejador:** Claude · **Executor:** Fable 5
**Regra:** executar na ordem. Não explorar o repo além dos arquivos citados. Não pedir plano de volta — o plano é este.

---

## 0. Decisões fechadas (não reabrir)

1. O produto é **uma cadeia**, não um portfólio: assistir → capturar → **recuperar em 15s** → revisar → **reencontrar**. O que não está nessa cadeia sai da navegação principal.
2. **Congelado até 50 usuários reais:** P0.3, ligas, novos jogos, otimizador FSRS, karaokê. Não tocar.
3. **Não tocar:** `content/subtitle-engine.js`, `content/engine/*`, migrations existentes, RPCs P0.2b.
4. Sem migration nova em nenhuma onda deste brief. Tudo usa colunas/RPCs que já existem.
5. Cor de marca ≠ cor de feedback. Verde/vermelho **só** para acerto/lapso. Marca = âmbar.
6. Emoji não é ícone. Proibido emoji em Hoje, Estudo e overlay da extensão.

---

## 1. Ondas — ordem obrigatória

### W1 — Primeira recuperação de 15s (a onda mais importante)

**Problema:** salvar cria um card que nunca é estudado. O plano do Codex previu a microetapa e ela não existe em código.

**Onde:** `content/word-popup.js` (o momento é dentro do vídeo, não no site).

**Contrato:**
- Depois de salvar com sucesso, o popup **transforma-se** (não abre outro) em uma pergunta única: a frase capturada com a palavra oculta + 3 chips de sentido.
- 1 chip correto = tradução da palavra salva. 2 distratores = traduções de outras palavras já salvas do usuário (fallback: dicionário local).
- Sem cronômetro. `Pular` sempre visível e sem culpa.
- Acerto/erro → feedback de 1s → popup fecha. O vídeo nunca é bloqueado.
- Resultado grava tentativa pela RPC de review já existente. Erro não é lapso: é a introdução do card.
- Falha de rede: fecha silencioso, card permanece salvo.

**Aceite:** `tests/first-recall.test.mjs` — (a) 3 chips sempre, 1 correto; (b) pular não grava tentativa; (c) falha de rede não perde o save; (d) popup não reabre após fechar.

---

### W2 — Ditado justo + rotação de habilidade

**Onde:** `dashboard/js/ui/studyView.js`.

**2.1 — Ditado (`renderDictation`, ~L863; `exerciseFinish`, L778)**
Hoje: string exata. Um typo em `receive` → força `Errei` → lapso FSRS. Isso mede teclado, não audição.

- Distância de Levenshtein entre `normalizeAnswer(input)` e `normalizeAnswer(context)`.
- `0` → correto. `≤ 2` **ou** `≤ 10%` do comprimento → **`quase`**. Acima → errado.
- `quase`: mostra diff por palavra (só a palavra divergente marcada), libera `Difícil` e `Bom`. **Nunca força `Errei`.**
- Errado de verdade: só `Errei`, como hoje.

**2.2 — Seleção de exercício (~L664-686)**
Hoje é `Math.random()`, enquanto o doc promete adaptação por habilidade. Trocar por **rotação determinística por encontro** — garante cobertura das 3 habilidades, é testável e não precisa de coluna nova:

```
graduated && isWeakCard  → produção (builder, senão dictation)
graduated                → [classic, builder, dictation, reverse][card.reps % 4]
                           (se a modalidade não couber no wordCount, cai para a próxima do ciclo)
new/learning             → classic
```

**2.3** — `renderBuilder` (~L812): `sort(() => 0.5 - Math.random())` é embaralhamento enviesado e às vezes entrega a frase pronta. Trocar por Fisher-Yates + rejeitar permutação idêntica à original.

**2.4** — Atualizar `docs/PLANO_MESTRE_PRODUTO_REAL_2026-07-14.md` §5: "vetor de habilidades" vira **"rotação por encontro (P1: vetor real)"**. Doc não promete o que o código não faz.

**Aceite:** `tests/study-exercise.test.mjs` — typo único nunca produz lapso; 4 encontros do mesmo card cobrem 4 modalidades; builder nunca nasce ordenado.

---

### W3 — Reencontro (o diferencial)

**Onde:** novo `content/known-word-marker.js`, chamado por `content/index.js`. **Zero alteração em `subtitle-engine.js`** — usar `MutationObserver` no overlay root já existente.

**Contrato:**
- Ao renderizar uma cue, palavras que o usuário já salvou recebem sublinhado âmbar 1px (`text-decoration-thickness:1px`), sem caixa, sem badge, sem animação.
- Hover/clique → o popup normal já existente, com uma linha a mais no topo: `Você salvou isto · <fonte original>`.
- Lista de palavras vem do cache já carregado no content script. Nenhuma requisição nova por cue.
- Matching por lowercase + lemma simples (plural `-s`, `-ed`, `-ing`). Falso positivo é aceitável; requisição extra não é.
- Registra ocorrência via RPC de evento existente, com dedupe por `(palavra, vídeo, dia)`.

**Aceite:** `tests/known-word-marker.test.mjs` — marca sem tocar no engine; troca de cue não vaza listener; 200 cues não geram requisição de rede.

---

### W4 — Navegação: 7 abas → 3

**Onde:** `dashboard/js/core/app.js`, `dashboard/dashboard.html`, `dashboard/js/ui/homeView.js`.

| Destino | Contém |
|---|---|
| **Hoje** | uma recomendação, um botão |
| **Biblioteca** | fontes (vídeos/histórias/textos) + palavras + prática (jogos, histórias) |
| **Você** | progresso, estatísticas, conquistas, configurações |

- Rotas antigas continuam funcionando por redirect. **Nenhuma view é deletada** — só sai da barra.
- Ligas: rota viva, fora da navegação, atrás de flag `lf_leagues_enabled` (default off).

**Hoje — reescrita completa de `homeView.js`:**
- **Acima da dobra: só isso.** Uma frase de estado (`12 revisões esperando`) + **um** botão primário. Nada mais.
- Os 4 stat cards (Revisar/Maduras/XP/Ofensiva) **saem** de Hoje e vão para Você.
- Ordem da recomendação: (1) revisões vencidas → (2) frases capturadas sem primeira recuperação → (3) continuar fonte → (4) prática.
- Banner de ofensiva em risco: **deletado**. Num SRS a carga diária é ditada pelo passado; ameaçar perda num dia de 80 cards ensina o aluno a clicar "Bom" mentindo — exatamente o que o contrato pedagógico diz combater.
- Streak vira **"dias com evidência"**, sem fogo, sem ameaça, sem banner. Só um número em Você.
- `professorTip` e diagnóstico: descem para uma linha secundária abaixo do botão, sem `<details>` aninhado.

**Aceite:** `tests/home-single-action.test.mjs` — exatamente 1 `.btn-primary` renderizado em Hoje; zero `stat-card`; barra de navegação com 3 itens.

---

### W5 — Sistema visual real

**Onde:** `dashboard/css/globals.css` + as 3 telas da espinha (Hoje, Estudo, overlay). O resto herda e fica para depois.

**Tokens (substituir a paleta atual):**
```css
--bg:#0B0D10; --surface:#14171C; --surface-2:#1C2027; --border:#2A2F38;
--text:#E8EAED; --text-muted:#9AA0A6;
--brand:#FFB020;                    /* marca, ação, foco — só isso */
--correct:#3DD68C; --lapse:#FF5C5C; /* SÓ evidência. Nunca em botão de navegação */
--radius:12px;
--s1:4px --s2:8px --s3:12px --s4:16px --s5:24px --s6:32px;
--fs-caption:13px --fs-body:15px --fs-lead:18px --fs-title:24px --fs-hero:32px;
```
- **Peso máximo 700.** Todo `font-weight:800/900` sai — é o que faz o app ler como brinquedo.
- Uma família tipográfica. Frase do card = `--fs-hero`, é o maior elemento da tela.
- Movimento: 120ms ease-out. Celebração **só** quando há evidência real (acerto de recuperação). Nunca em navegação, nunca em save.
- Tema claro continua existindo via `prefers-color-scheme`; escuro é o default.

**Despoluição:** em `homeView.js` e `studyView.js`, todo `style="..."` inline vira classe. Não fazer isso nas outras views agora.

**Aceite:** `tests/design-tokens.test.mjs` — nenhum hex literal em `homeView.js`/`studyView.js`; nenhum `font-weight` > 700; `--correct`/`--lapse` não aparecem fora de contexto de feedback.

---

### W6 — Overlay da extensão sob a mesma direção

**Onde:** `content/max-player-ui.js`, `content/review-overlay.js`.

- O dock lateral vertical **sai**. Vira uma fileira de controles que aparece **junto com os controles nativos do player** e some com eles. Se o usuário escondeu a UI do player, ele quer o filme, não a nossa barra.
- Overlay de revisão: adotar tokens da W5. O gradiente azul-escuro atual (`#0f172a → #1e293b`) sai.
- Manter `bottom: 137px` como fallback medido; não perseguir pixel na HBO.

**Aceite:** `tests/max-player-ui.test.mjs` estendido — dock invisível quando controles nativos estão ocultos.

---

## 2. Não fazer

- Migration nova. Tabela nova. Coluna nova.
- Mexer em ligas, XP competitivo, cap ou ledger.
- Deletar view, rota ou funcionalidade — só tirar da navegação.
- Redesenhar Biblioteca/Stories/Reader/Config nesta rodada.
- Adicionar exercício, jogo ou modalidade nova.

## 3. Protocolo por onda

1. Implementar → 2. Teste de aceite verde → 3. Regressão (`npm run test:release`) → 4. Commit único com prefixo da onda (`W1: ...`) → 5. Atualizar `CHECKLIST.md` e `HANDOFF.md` → 6. Parar e reportar. **Não emendar duas ondas no mesmo commit.**

CI remoto está bloqueado por faturamento do GitHub — evidência é local até o dono regularizar. Não fingir que o gate rodou.

## 4. O que só o dono pode fazer (bloqueia a Fase 0 do plano mestre)

Cinco pessoas reais assistindo série com a extensão ligada, sem ajuda, sob observação silenciosa. Nenhuma onda deste brief substitui isso.
