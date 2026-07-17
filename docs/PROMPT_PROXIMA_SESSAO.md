# Prompt da próxima sessão — auditoria LinguaFlow

Copie o bloco abaixo inteiro como primeira mensagem da sessão nova.

---

Você está retomando uma auditoria de código interrompida por limite de contexto. **Não comece a trabalhar antes de ler `docs/AUDITORIA_REAL_2026-07-16.md` na íntegra** — ele é a fonte de verdade, tem a seção "COMO CONTINUAR" no topo e a tabela de cobertura §0.

## Contexto

O LinguaFlow é uma extensão de navegador + web app para aprender inglês com legendas de vídeo (YouTube/HBO/Netflix) + SRS com FSRS-4.5. O dono, Wesley, pediu uma auditoria de agência: ver **tudo**, sem trabalhar no escuro.

A sessão anterior (Claude) escreveu dois planos de execução **baseados em grep e amostragem**, e depois provou, lendo o código de verdade, que **oito afirmações suas estavam erradas** — inclusive vender como "o diferencial do produto" uma feature que já estava construída e melhor do que a proposta. Os planos foram suspensos. Esta sessão existe para terminar a leitura que deveria ter sido feita antes.

## Missão

Ler **as ~11.500 linhas restantes** e registrar cada achado em `docs/AUDITORIA_REAL_2026-07-16.md`, atualizando a tabela §0 conforme avança.

**Fila, nesta ordem:**

1. `content/subtitle-engine.js` **120-4314** (o construtor 1-120 e `_updateSubtitleColors` já foram lidos)
2. `content/settings-panel.js` (906) — painel de config paralelo ao do site, nunca auditado
3. `content/web-reader.js` (387)
4. `content/word-popup.js` — faltam **233-530, 830-1090, 1550-2111**
5. `background/service-worker.js` — faltam **480-540, 880-fim**
6. `dashboard/js/core/app.js` (517)
7. As 9 views em `dashboard/js/ui/` (~6.400) — só há trechos lidos
8. `utils/*` (tts, translator, video-utils, pronunciation, exclusive-playback…)
9. Edge Functions restantes (tts, url-import, push-reminder, email-reengagement)

## Regras de método — inegociáveis

Cada uma nasceu de um erro real da sessão anterior:

1. **Ler o arquivo inteiro. Nunca grep + conclusão.** Grep responde o que você pergunta e esconde o que você não pensou em perguntar. Foi assim que o `word-popup.js` ficou invisível por quatro mensagens.
2. **Nunca afirmar sobre schema a partir de migration.** A sessão anterior leu a migration baseline e afirmou que `review_log` tinha 4 colunas; o banco vivo tem 16. Consultar sempre: MCP Supabase, projeto `qnutoswrufznztoznlql`, **somente leitura** (`list_tables`, `execute_sql` com SELECT, `get_advisors`). Nunca `apply_migration`, nunca escrita.
3. **Nunca citar documento de terceiro como se fosse verificação.** "1 usuário, 6 cards" veio de um doc do Codex de 14/07 e foi repetido como fato; o real era 3 contas, 20 cards, 55 revisões.
4. **Antes de propor qualquer feature, procurar se já existe.** A onda "W3 — reencontro na legenda" foi inventada inteira em cima de `subtitle-engine.js:240`, que já colore a legenda em 6 níveis pelo estado real do FSRS. Este é o erro mais caro do projeto até agora.
5. **Registrar no arquivo antes de virar conversa.** O contexto some; o arquivo não.
6. **Separar "verificado" de "hipótese" em toda frase.** Se não leu, dizer que não leu.

## Não faça

- **Não execute `docs/PLANO_FLUENCIA_FABLE5_2026-07-16.md`** — está suspenso, com aviso no topo. Só pode ser reescrito quando a §0 chegar a 100%.
- Não escreva um plano novo antes de terminar a leitura.
- Não altere código nesta fase. É auditoria.
- Não toque em: `DEEPSEEK_API_KEY` (Supabase Secrets), migrations aplicadas, RPCs do P0.2b.

## O que já está estabelecido (não re-derivar)

- **Erros corrigidos:** §1 da auditoria (8 itens).
- **Bugs reais achados, com linha:** §3 — conversor de fonética PT-BR destrói o par ship/sheep (`ɪ→i→í` em cascata); `context_sentence` pode ser salvo picotado com `...`; o estado "já salvo" se autodestrói em 2s e o re-save apaga a cena original; `isNew` sempre false; duas contabilidades de XP em paralelo.
- **Banco verificado (16/07):** 3 contas, 1 pessoa revisando, 20 words, 20 cards, 55 review_log (7 com evento), 0 known_words, 0 sentences, 0 words com `explanation`, 5 words com vídeo.
- **Já existe e ninguém documentou:** gradiente de 6 cores por estado FSRS na legenda; centro de comando A/S/D/Q/L/O/C/Espaço; `repeatSubtitle()` (shadowing) na tecla `S`; `autoPause` na `Q`; 30 falsos cognatos curados à mão; Edge Function de IA com rate-limit 20/min e JWT validado; FSRS-4.5 com paridade real de Anki.

## A hipótese que a leitura precisa testar

A sessão anterior terminou com esta suspeita, e ela vale mais que qualquer feature nova:

> **O problema do LinguaFlow talvez não seja "falta feature" nem "falta motor". É que ninguém sabe o que ele já faz** — nem o dono, nem o Codex, nem a IA que audita. Um app com oito atalhos de teclado que nenhum documento menciona é um app que nem o dono consegue usar inteiro.

Se a leitura confirmar isso, o entregável do projeto muda: antes de construir qualquer coisa, alguém precisa **inventariar e revelar** o que já existe.

## Como reportar

Ao terminar (ou quando o contexto apertar): atualizar §0, escrever os achados, atualizar `HANDOFF.md` com o próximo arquivo da fila. Nunca encerrar sem deixar o próximo passo concreto no arquivo.
