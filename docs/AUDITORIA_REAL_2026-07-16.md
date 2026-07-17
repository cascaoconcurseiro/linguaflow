# Auditoria real — leitura integral (2026-07-16)

**Método:** leitura de arquivo inteiro + consulta ao banco de produção `qnutoswrufznztoznlql`. Sem grep, sem amostragem, sem citar documento de terceiro como se fosse verificação.

**Estado:** EM ANDAMENTO. Ver §0 para o que já foi lido e o que falta.

> ## ⛔ AVISO CRÍTICO DE MÉTODO (17/07, após o commit) — esta auditoria foi feita contra uma branch desatualizada
>
> Todo este documento foi escrito lendo `codex/extension-current`, uma cópia local **parada em 15/07 14:28**. `origin/main` recebeu **20 commits reais** no dia seguinte (16/07, rollout de produção P0.3) que esta branch nunca teve — entre eles mudanças em `app.js`, `homeView.js`, `leaguesView.js`, `libraryView.js`, `readerView.js`, `settingsView.js`, `statsView.js`, `storiesView.js`, `studyView.js` (274 linhas!), `utils/db.js` (45 linhas removidas), e **quatro views inteiras que não existem nesta cópia**: `learnView.js`, `progressView.js`, `readingHub.js`, `viewState.js`.
>
> **Prova concreta de que isso já invalidou um achado:** a §4n.1 (bug da "Zona de Rebaixamento" em ligas de 6-9 membros) **não existe em `main`** — o bloco inteiro foi removido lá, junto com uma mudança de produto (a liga virou "opcional", com aviso de que XP não mede domínio).
>
> **Atualização (17/07): reconciliação parcial concluída — ver §4o.** A extensão inteira (`content/*`, `background/service-worker.js`, a maioria de `utils/*`) está **fora** da lista de arquivos que mudaram entre a divergência e `main` — todo achado nesses arquivos (§2, §3, §4b-§4e, §4g.1 o achado principal, §4h, §4j) segue válido sem reconferir. Do dashboard, os arquivos de maior risco (`studyView.js`, `storiesView.js`, `libraryView.js`, `settingsView.js`, `utils/db.js`) foram reconferidos — resultado na §4o. `app.js`, `gameView.js`, `homeView.js`, `readerView.js` mudaram mas não foram reconferidos em detalhe. `statsView.js`, `loginView.js` e os arquivos novos (`learnView.js`, `progressView.js`, `readingHub.js`, `viewState.js`) nunca foram auditados.

---

## COMO CONTINUAR (leia isto primeiro)

Você está retomando uma auditoria interrompida por limite de contexto. Regras:

1. **Este arquivo é a fonte de verdade, não a memória de ninguém.** Todo achado novo entra aqui **antes** de virar conversa.
2. **Ler arquivo inteiro. Nunca grep + conclusão.** Todos os 8 erros da §1 nasceram de grep, de ler a migration em vez do banco, ou de citar documento de terceiro como verificação.
3. **Nunca afirmar sobre schema a partir de migration.** Consultar o banco vivo: projeto `qnutoswrufznztoznlql` (MCP Supabase, somente leitura).
4. **Antes de propor qualquer feature, procurar se já existe.** A W3 inteira foi inventada em cima de código que já estava pronto (§4c).
5. Atualizar a tabela de cobertura §0 a cada arquivo terminado.

7. **Rodar a auditoria de fiação ANTES de ler (§4h).** `node scratchpad/wiring-audit.js` — 8 segundos, aponta módulos órfãos, DOM morto e eventos órfãos. **Ela aponta, não conclui:** todo achado precisa de verificação dirigida (buscar o nome do arquivo como string solta, ou ler o trecho). Ela tem falsos positivos conhecidos (§4h.5): imports por concatenação, `postMessage`, e DOM de terceiro.

6. **A §0 não é confiável como inventário.** Ela foi escrita de memória: faltavam **14 arquivos** e o total estava ~4.000 linhas subestimado (§4d.9). Antes de confiar na fila, rodar `wc -l` e conferir. Um dos ausentes (`review-overlay.js`) era o melhor código do projeto.

**Próximo arquivo na fila:** `content/subtitle-engine.js` **linhas 2.400-4.314** — parar em [`_cleanSubtitleText` (3309)](../content/subtitle-engine.js:3309), que decide o §4d.11 (entidades HTML tipo `don&#39;t` chegando ao card) e o §4d.8 (`cefrColorsEnabled` respeitado ou não no `renderDual`). Também confirmar os chamadores de `toggleLoop()` (§4d.12).

Depois, **nesta ordem** (revisada — os 3 primeiros mudaram por causa da §4f):
1. `content/settings-panel.js` (906) — decide o §4d.7: se o painel oferece "Somente Tradução"/antecipação 2.0s, o app finge aceitar uma escolha que reverte sozinha.
2. `content/max-player-ui.js` (228) + `content/engine/subtitle-fetcher.js` (111) — ausentes da §0; o `subtitle-fetcher` duplica `_cleanSubtitleText`/`_processYtSub` do engine (suspeita de motor paralelo).
3. `utils/exclusive-playback` — decide o §4e.4 (TTS por cima do vídeo).
4. `content/word-popup.js` (233-530, 830-1090, 1550-2111), `background/service-worker.js` (480-540, 880-fim), `content/web-reader.js`, `dashboard/js/core/app.js`, as 9 views, `utils/*`, demais Edge Functions.

**O plano `PLANO_FLUENCIA_FABLE5_2026-07-16.md` está SUSPENSO** e não deve ser executado. Ele só pode ser reescrito quando a cobertura da §0 chegar a 100%.

---

## 0. Cobertura

| Arquivo | Linhas | Lido |
|---|---:|---|
| `utils/db.js` | 1.519 | ✅ integral |
| `dashboard/js/core/placement.js` | 275 | ✅ integral |
| `dashboard/js/core/ai.js` | 320 | ✅ integral |
| `dashboard/js/core/sessionQueue.js` | 72 | ✅ integral |
| `dashboard/js/core/achievements.js` | 42 | ✅ integral |
| `dashboard/js/core/videoContext.js` | 112 | ✅ integral |
| Banco de produção (schema + dados + advisors) | — | ✅ |
| `content/word-popup.js` | 2.111 | 🟡 ~50% (1-233, 530-830, 1055-1550) |
| `background/service-worker.js` | ~1.300 | 🟡 ~60% (1-480, 540-880) |
| `supabase/functions/deepseek-chat` | ~120 | ✅ integral |
| `content/subtitle-engine.js` | 4.314 | 🟡 ~56% (1-2.400 integral) — falta 2.400-4.314 |
| `content/settings-panel.js` | 906 | 🟡 só o mapa de chaves |
| `content/web-reader.js` | 387 | ❌ |
| `dashboard/js/ui/*` (9 views) | ~6.400 | 🟡 só trechos |
| `dashboard/js/core/app.js` | 517 | ❌ |
| `utils/*` (tts, translator, video-utils, pronunciation…) | ~600 | ❌ |
| Demais Edge Functions (tts, url-import, push, email) | ~430 | ❌ |
| **`content/review-overlay.js`** | **289** | ✅ integral — ausente da §0 original (§4e) |
| **`content/index.js`** | **75** | ✅ integral — ausente da §0 original (§4e) |
| `content/boot.js` + `manifest.json` (cadeia de carga) | — | ✅ verificado (§4e.1) |
| `content/max-player-ui.js` | 228 | ❌ ausente da §0 original |
| `content/engine/subtitle-fetcher.js` | 111 | ❌ ausente da §0 original |
| `content/youtube-hook.js` | 110 | ❌ ausente da §0 original |
| `dashboard/js/core/tts.js` | 342 | ❌ ausente da §0 original |
| `dashboard/js/core/ytPlayer.js` | 251 | ❌ ausente da §0 original |
| `dashboard/sw.js` | 122 | ❌ ausente da §0 original |
| `dashboard/js/core/epub.js` | 103 | ❌ ausente da §0 original |
| `dashboard/js/core/statsEngine.js` | 87 | ❌ ausente da §0 original |
| `utils/phrasal-verbs.js` | 141 | ❌ ausente da §0 original |
| `utils/subtitle-parsers.js` | 132 | ❌ ausente da §0 original |
| `popup/popup.js` | 111 | ❌ ausente da §0 original |
| `utils/lemma.js` | 88 | ❌ ausente da §0 original |

**Total real: 23.373 linhas** (`wc -l`, todos os `.js`/`.ts` fora de `node_modules` e `tests`) — não "~19.500", que era estimativa não medida (§4d.9).

### 0.1 Medição por arquivo (16/07, tarde) — substitui toda estimativa acima

Contado por script, com status explícito por arquivo. **Regra nova: nenhum percentual de cobertura entra aqui sem sair deste script.**

```
TOTAL : 23.429   (contagem por linhas; wc -l dá 23.373 — diferença = newline final)
LIDO  :  7.198   (31%)
FALTA : 16.231   (69%)   em 46 arquivos abertos
```

**Parciais** (linhas restantes): `subtitle-engine.js` **1.915** · `word-popup.js` **1.052** · `service-worker.js` **587** · **`studyView.js` ~610** (lido 1-1.310 na §4g; falta 1.310-1.920, majoritariamente CSS).

> **Atualização pós-§4g:** `studyView.js` saiu de "nunca aberto" para ~68% lido. Os 4 achados da §4g vieram daí. **Lido: ~8.500 de 23.429 (~36%).**

> **Atualização pós-§4i/§4j (leitura em lote paralela):** `storiesView.js` 1-670 (§4i), `settings-panel.js` **integral** (907, §4j), `subtitle-engine.js` até 3.400, `word-popup.js` até 2.060, `service-worker.js` **integral** (1.467, §4j). **Lido: 12.672 de 23.558 (54%).**

> **Atualização pós-§4k (segunda leitura em lote):** `homeView.js`, `gameView.js`, `app.js`, `libraryView.js` — **todos integrais** (3.166 linhas). **Lido: 15.438 de 23.558 (66%).**

> **Atualização pós-§4l/§4m (terceira e quarta leituras em lote):** `subtitle-engine.js` **100% completo** (4.314) · `readerView.js`, `web-reader.js`, `settingsView.js` **integrais** · fim de `storiesView.js`. **Lido: 18.665 de 23.558 (79%).**

> **Atualização pós-§4n:** `leaguesView.js` **integral** (255) — última view de peso da cópia velha. **Lido: 18.920 de 23.558 (80%) na cópia antiga.**

> **Atualização pós-PR/§4o (17/07) — mudança de fronteira, não só de número.** A cópia auditada (`codex/extension-current`) ficou parada em 15/07; `main` seguiu 20 commits à frente no dia seguinte. A auditoria foi trazida para cima de `main` via cherry-pick e **reconciliada** (§4o): a extensão inteira (`content/*`, `background/service-worker.js`) não mudou entre as duas — todo achado ali segue válido sem reconferir. Do dashboard, `studyView.js`, `storiesView.js`, `libraryView.js`, `settingsView.js` e `utils/db.js` foram reconferidos contra `main` (§4o.2-§4o.4): a maioria sobrevive, dois problemas sérios (§3.7 XP duplo, §4d.6 XP passivo) já foram corrigidos **na raiz, por permissão de banco**, e uma policy de RLS que eu nem tinha visto (`user_stats` público) foi fechada junto. **A fronteira real de cobertura agora não são as ~4.600 linhas que faltavam na cópia velha — são os arquivos que `main` mudou e eu não reconferi em detalhe (`app.js`, `gameView.js`, `homeView.js`, `readerView.js`, §4o.5) e os que nunca foram auditados em lugar nenhum: `statsView.js`, `loginView.js`, e quatro views inteiras que só existem em `main` (`learnView.js`, `progressView.js`, `readingHub.js`, `viewState.js`, §4o.6).**

**Nunca abertos, ≥100 linhas:** `homeView.js` 1.004 · `settings-panel.js` 907 · `gameView.js` 661 · `libraryView.js` 583 · `app.js` 518 · `readerView.js` 412 · `web-reader.js` 388 · `core/tts.js` 343 · `url-import` 304 · `utils/tts.js` 296 · `leaguesView.js` 255 · `ytPlayer.js` 252 · `max-player-ui.js` 229 · `statsView.js` 195 · `translator.js` 170 · `pronunciation.js` 149 · `phrasal-verbs.js` 142 · `subtitle-parsers.js` 133 · `loginView.js` 130 · `dashboard/sw.js` 123 · `subtitle-fetcher.js` 112 · `popup.js` 112 · `youtube-hook.js` 111 · `functions/tts` 107 · `epub.js` 104.

**Nunca abertos, <100 linhas (10 arquivos, 366 linhas):** `video-utils.js` 98 · `lemma.js` 89 · `statsEngine.js` 88 · `email-reengagement` 87 · `push-reminder` 79 · **`engine/video-adapter.js` 62** · **`hbo-inject.js` 62** · **`offline-dict.js` 58** · **`exclusive-playback.js` 55** · **`local-day.js` 49** · **`site-boundary.js` 36** · **`tatoeba.js` 31** · `injector.js` 24 · `html.js` 10 · `expressions-db.js` 7.

> Os 8 em **negrito** não estavam nem na §0 original nem na minha correção do §4d.9 — a lista de omitidos era ela própria incompleta. Total de arquivos que a §0 desconhecia: **22**, não 14.

**Lido: 7.198 de 23.429 (31%).**

---

## 1. Erros meus, corrigidos

| Eu afirmei | Verdade | Como descobri |
|---|---|---|
| `review_log` guarda só `card_id, quality, date, ts` | Tem **16 colunas**, incluindo `card_before jsonb`, `card_after jsonb`, `learning_event_id`, `xp_awarded`, `previous_status`, `eligibility_reason` | Li a migration *baseline* e afirmei sobre o schema atual. Schema vivo consultado. |
| `evidence jsonb` está vazio | Payload rico e versionado (`schema_version: 2`) com `card_before`, `card_after`, `_reward`, `dedupe_key`, `cap_used_before` | Consulta aos 7 registros reais |
| 1 usuário, 6 cards, 47 revisões | **3 contas, 20 words, 20 cards, 55 review_log, 3 stories** — e 1 só pessoa revisou | Repeti número do doc do Codex (14/07) como se fosse meu |
| "Você não usa seu próprio app" | Última palavra salva **hoje 17:38**; 55 revisões entre 09/07 e 15/07 | Injusto. Fonte de segunda mão. |
| O popup não avisa que a palavra já foi salva | **Avisa** — [word-popup.js:704](../content/word-popup.js:704) troca o botão para `✅ Salvo nos Flashcards` | Nunca abri o arquivo |
| A W1 pode gravar a tentativa pela RPC de review | **Impossível como escrito** — ver §2.1 | Nunca abri o arquivo |
| Card duplicado ao salvar de novo | Não duplica — `on_conflict=user_id,word,lang` | Leitura do `db.js` |
| `known_words = 0` derruba a W6.2 ("94% deste episódio") | **Não derruba.** A tela existe (`renderStats`) e é ponderada por token: dá peso cheio a `mature`/`review` e meio a `learning`. Sem `known_words` ela perde **um degrau**, não a métrica | §4d.1 — leitura de `subtitle-engine.js:2119` |
| O centro de comando tem 8 teclas | **Nove** — falta o `R` (revisão de SRS sobre o vídeo). Subcontei no mesmo parágrafo em que acusava a falta de documentação | §4e.1 — `content/index.js:41` |
| O projeto tem ~19.500 linhas; li ~8.000 | **23.373 linhas.** O número nunca foi medido, e a §0 omitia 14 arquivos | §4d.9 — `wc -l` |
| (erro #10, cometido **nesta sessão**) "lido ~10.300 de 23.373 (~44%)" | **7.198 lidas — 31%. Faltam 16.231.** Eu corrigi o denominador e **herdei o numerador**: peguei o "~8.000" não medido da sessão anterior e somei o meu por cima. O "~8.000" contava "trechos" das 6.400 linhas de views como cobertura | §0 — contagem por arquivo, com status explícito |
| "Da W4 só falta a gravação da voz" (§4c) | **A gravação da voz também já existe.** `utils/pronunciation.js` exporta `pronunciationLab` com `SpeechRecognition` + `getUserMedia` — e **zero importadores**. Falta um `import`, não código | §4g.1 |
| "A W4 valeria para 1 card em 4" (§2.3) | **20 de 20 words têm `video_url`.** Medi `video_start_ms` e nunca medi `video_url`; tratei nulo como impossível sem abrir o código que já reconstrói janela aproximada | §4g.4 — banco + `studyView.js:1145` |

---

## 2. Achados que derrubam ondas do plano

### 2.1 🔴 A W1 é impossível como especificada

[word-popup.js:1129](../content/word-popup.js:1129):

```js
const result = await chrome.runtime.sendMessage({ type: 'QUEUE_WORD_SAVE', payload });
```

O popup **não chama `db.saveWord()`**. Ele enfileira no service worker (fila local-first) e a sincronização com o Postgres acontece depois, em segundo plano. No instante do save **não existe `word_id`, não existe card, não existe nada para uma tentativa apontar**.

A W1 (primeira recuperação de 15s gravando pela RPC de review) não tem onde ancorar. Ou a microetapa grava numa fila local que só vira evidência depois do sync, ou ela precisa esperar o sync (o que mata os 15s). **A onda precisa ser reprojetada, não ajustada.**

### 2.2 🔴 `known_words` = 0 → a métrica LingQ não tem substrato

Tabela vazia em produção. `markAsKnown()` existe, o engine carrega a lista em todo vídeo e ela é sempre zero. Não há fluxo que marque palavra como conhecida.

Derruba a proposta "você conhece 94% deste episódio" (W6.2): antes da tela, é preciso um fluxo que produza o dado. E hoje o popup mostra `knownAtLevel/allLevel` ([word-popup.js:605](../content/word-popup.js:605)) onde `allLevel` é **a wordlist inteira** daquela banda — com 20 palavras salvas, o usuário lê algo como `3/850 B1`. É um número desmotivador e sem significado.

### 2.3 ~~🟡 `words_with_video` = 5 de 20 (25%)~~ — **REVOGADA (ver §4g.4)**

> ⛔ **Esta seção estava errada e foi mantida só como registro do erro #11.**
> O texto original: *"Só um quarto das capturas tem `video_start_ms`. A W4 (shadowing com a voz do ator) valeria para 1 card em 4."*
>
> **A verdade (banco, 16/07): 20 de 20 words têm `video_url`.** Os 5 são só os que têm *bounds exatos*. `studyView.js:1145` **já reconstrói uma janela aproximada** para os outros 15 e a rotula como aproximada na UI. Cobertura real do clipe: **10/20 com player em loop embutido** (os do YouTube) e **20/20 com o link no ponto salvo**.
>
> Eu nunca medi `video_url`. Medi `video_start_ms`, tratei nulo como "impossível", e não abri o código que já tratava o caso.

---

## 3. Bugs reais encontrados na leitura

### 3.1 🔴 A fonética brasileira erra justamente a distinção que mais importa — ✅ CORRIGIDO (17/07, Fase 2: passada única; provado por teste — ship/sheep, sit/seat, full/fool agora distintos)

[word-popup.js:1244](../content/word-popup.js:1244) — `_convertIPAtoPT` aplica o mapa em sequência sobre a mesma string, então **a saída de uma regra vira entrada da próxima**:

```js
ɪ: 'i',   // posição 14
i: 'í',   // posição 15  ← recebe o 'i' que a regra anterior acabou de criar
```

Resultado: todo `ɪ` vira **`í`**. `sit` (/sɪt/) sai como **"sít"** — que um brasileiro lê como *seat*. O mesmo com `ʊ → u → ú`.

O par ship/sheep é **a** dificuldade clássica do brasileiro em inglês, e o conversor de fonética destrói exatamente essa distinção em toda palavra. Correção: aplicar as substituições numa única passada (regex alternado com callback), nunca encadeadas.

### 3.2 🔴 O contexto salvo pode ser um trecho picotado — ✅ CORRIGIDO (17/07, Fase 2: `_sentenceContaining()` + `saveContext`; a tela trunca, o card recebe a frase completa)

[word-popup.js:562](../content/word-popup.js:562): `this.context = this._truncateContext(this.word, this.context)` — e [1116](../content/word-popup.js:1116) salva esse `this.context` como `context_sentence`.

`_truncateContext` corta em ~80 caracteres, pegando ±5 palavras ao redor do termo e **prefixando/sufixando `...`**. Então o card pode nascer com `"... snippet com reticências ..."`. Isso contamina: a frente do card, o exercício "montar frase" (chips com `...`), o ditado e o TTS.

### 3.3 🔴 O estado "já salvo" se autodestrói em 2 segundos — ✅ CORRIGIDO (17/07, Fase 2: botão fica desabilitado com title explicativo; reset de 2s removido)

[word-popup.js:1140](../content/word-popup.js:1140): depois de salvar, o botão volta para `+ Salvar nos Flashcards` e reabilita. Na abertura, [704](../content/word-popup.js:704) mostra corretamente `✅ Salvo`. Ou seja: o app sabe, mostra, e 2s depois esquece e convida a salvar de novo — o que dispara o upsert e **sobrescreve `context_sentence`, `video_url` e os bounds da primeira captura**. Perda de dado silenciosa.

### 3.4 🟡 `isNew` está sempre errado — ✅ CORRIGIDO (17/07, Fase 1)

[db.js:404](../utils/db.js:404):

```js
let card = await this.getCardByWordId(savedWord.id);
if (!card) card = await this._fetch('rpc/create_card_for_word', {...});
return { ok: true, id: savedWord.id, isNew: !card };
```

Depois do `if`, `card` sempre existe → `!card` é **sempre false**.

### 3.5 🟡 `saveWord` sobrescreve o contexto anterior

`on_conflict=user_id,word,lang` + `resolution=merge-duplicates` → salvar `give up` de outra série **apaga** a cena original (`context_sentence`, `video_url`, `video_title`, `video_start_ms`, `video_end_ms`). Não duplica; perde.

### 3.6 🟡 Mina no `getStats`: CEFR por tamanho de palavra

[db.js:718](../utils/db.js:718): sem `words.level`, o nível é adivinhado por `word.length` (`<=3 → A1`, `<=5 → A2`…). Hoje não explode (20/20 têm `level`), mas a `cefr-wordlist.json` está no disco ao lado.

### 3.7 🟡 Duas contabilidades rodando ao mesmo tempo

`logSession()` ([db.js:1256](../utils/db.js:1256)) chama `recordEvent('video_session')` → `record_learning_event` — o caminho **legado**, que escreve direto em `user_stats`. O ledger novo (`learning_events`) tem 7 registros, todos `card_reviewed`; 48 das 55 revisões não têm evento.

Consequência viva: **assistir vídeo passivamente ainda gera XP**, contra o contrato pedagógico do próprio Codex. É a neutralização de escritores legados (P0.3) que não aconteceu.

### 3.8 🟢 Chave duplicada e race menores

- `_falseFriends` define `eventually` duas vezes ([41](../content/word-popup.js:41) e [59](../content/word-popup.js:59)).
- O check de "já salvo" ([699](../content/word-popup.js:699)) é uma IIFE sem guarda de geração: clicar palavra A e logo B pode rotular o botão de B com a resposta de A.
- Clicar num sinônimo abre `showForWord(word, '', null)` — **sem contexto**; salvar dali cria card sem frase.

---

## 4. Banco de produção — estado real (16/07/2026)

| Métrica | Valor |
|---|---:|
| Contas | 3 |
| Pessoas que já revisaram | **1** |
| words / cards | 20 / 20 |
| review_log | 55 (09/07 → 15/07) |
| …com `learning_event_id` | **7** |
| …com `xp_awarded > 0` | 17 |
| learning_events | 7 (todos `card_reviewed`) |
| words com `explanation` | **0** |
| **words com `video_url`** | **20 de 20** (medido em 16/07 tarde — §4g.4) |
| words com `video_start_ms` (bounds exatos) | 5 |
| words com URL de YouTube (player embutido possível) | 10 |
| words com `ai_chunks` | 20 |
| words com `mnemonic` | 2 |
| known_words | **0** |
| sentences | **0** (tabela morta) |
| stories | 3 |
| translation_cache | 5.000 |

**Advisors:** as 15 funções `SECURITY DEFINER` expostas ao `authenticated` **não são bug** — são o desenho do P0.2b (RPCs estreitas no lugar de PATCH direto). Reais: `pg_net` no schema `public` e **proteção de senha vazada desativada** (1 clique no painel).

---

## 4c. 🔴🔴 O ERRO MAIOR DA MINHA AUDITORIA — a W3 já existe

Eu vendi a W3 ("Reencontro na legenda") como **"o diferencial"**, **"a razão de existir do produto"**, e disse que estava *"na Fase 5 do plano, atrás de liga e ledger"*. Propus criar `content/known-word-marker.js` com um `MutationObserver`.

**Está construído. Funcionando. Há tempo.**

[subtitle-engine.js:240](../content/subtitle-engine.js:240) — `_updateSubtitleColors()`:

```js
const words = this.shadowContainer.querySelectorAll('.lf-word');
words.forEach((el) => {
  const w = el.dataset.word?.toLowerCase();
  el.classList.remove('lf-new','lf-learning','lf-review','lf-mature','lf-known','lf-saved');
  if (this.knownWords.has(w)) el.classList.add('lf-known');
  else if (this.savedWords.has(w)) {
    const status = this.savedWords.get(w);
    const classMap = { new:'lf-saved', learning:'lf-learning', review:'lf-review', mature:'lf-mature' };
    el.classList.add(classMap[status] || 'lf-saved');
  } else el.classList.add('lf-new');
});
```

Com CSS real ([1107-1120](../content/subtitle-engine.js:1107)): `.lf-known { color: var(--lf-color-known, #86EFAC); } /* verde claro — já sei */`.

Não é só "marca a palavra salva". **É um gradiente de 5 níveis pelo estado real do FSRS** — `new` → `saved` → `learning` → `review` → `mature` → `known`. É o gradiente do LingQ, aplicado na legenda de vídeo ao vivo, que nem o LingQ tem. Roda em todo `_loadSavedWords()` e em todo `LF_SETTINGS_CHANGED`.

**A W3 morre. Não há nada para construir.** O que existe é uma única falha: `knownWords` está sempre vazio (§4b.1), então o degrau `lf-known` nunca acende. O resto funciona.

Isso não é um detalhe. É a onda que eu apresentei como o coração do produto, e eu a inventei sem abrir o arquivo.

### Outras coisas que eu propus e que já existem

| Eu propus | Já existe |
|---|---|
| Replay "só esse trecho" | [`repeatSubtitle()`](../content/subtitle-engine.js:602) — **atalho `S`, com a notificação "🔄 Repetindo (Shadowing)"** |
| Auto-pause em palavra nova | `autoPause` — atalho `Q`, config real |
| Gradiente de exposição estilo LingQ | `.lf-new/-saved/-learning/-review/-mature/-known` |
| Navegação frase a frase | `prevSubtitle()`/`nextSubtitle()` — atalhos `A`/`D` |
| Cores CEFR na legenda | `cefrColorsEnabled` + `cefrColorA1..C2` |

Há um **centro de comando completo estilo Language Reactor** (`A`,`S`,`D`,`Q`,`L`,`O`,`C`,`Espaço`) que eu nunca mencionei em nenhum documento. Da W4 (shadowing), portanto, **só falta a gravação da voz** — o replay do trecho já está pronto e mapeado numa tecla.

> **Correção (§4e.1):** são **nove** teclas, não oito. Faltou o `R` — que abre uma revisão de SRS completa por cima do vídeo (`content/review-overlay.js`, 289 linhas, arquivo que a §0 nem listava). Eu subcontei o centro de comando **no mesmo parágrafo em que denunciava que ninguém o documenta.** É a prova mais limpa da hipótese: mesmo depois de descobrir o problema, eu continuei cometendo-o.
>
> **Correção (§4d.4 e §4e.3):** o centro de comando não está íntegro. `C` e `O` disparam duas vezes no YouTube; `Espaço` tem dois donos durante a revisão; e responder um card com `1`-`4` no YouTube salta o vídeo. **Três das nove teclas colidem.**

---

## 4d. Terceira leva — `subtitle-engine.js` 120-2400 (leitura integral)

### 4d.1 🔴🔴 A W6.2 também já existe — "score de compreensão deste episódio"

Segundo erro do mesmo tipo do 4c, e o mais grave depois dele. Eu escrevi na §2.2 que a tela "você conhece 94% deste episódio" precisava ser construída e que `known_words = 0` derrubava a onda.

**A tela existe.** [subtitle-engine.js:2119-2160](../content/subtitle-engine.js:2119) — `renderStats()`, na aba **Words** do painel lateral (tecla `L`):

```js
let totalTokens = 0, understoodTokens = 0;
freqMap.forEach((freq, w) => {
  totalTokens += freq;
  if (knownWords.has(w) || savedWords.get(w) === 'mature' || savedWords.get(w) === 'review') {
    understoodTokens += freq;
  } else if (savedWords.get(w) === 'learning') {
    understoodTokens += Math.round(freq * 0.5);
  }
});
const comprehension = Math.round((understoodTokens / totalTokens) * 100);
```

Renderizado como número de 36px com barra de progresso e rótulo: **Fluente ≥95% / Compreensão alta ≥80% / Intermediário ≥60% / Desafio**.

E é **melhor** do que eu propus: é ponderado por frequência de token (não por tipo), e não depende de `known_words` — dá peso cheio a `mature`/`review` e meio peso a `learning`, tudo vindo do estado real do FSRS. Ou seja: **com `known_words = 0` a métrica ainda funciona**, contra o que eu afirmei na §2.2.

**Correção da §2.2:** `known_words = 0` não derruba a W6.2. Ela degrada um degrau da métrica (`cKnown` fica sempre 0), não a impede. A tela está pronta e alimentada.

Junto dela, na mesma aba, também já existem:
- contagem de **phrasal verbs** do episódio (via `expressionsDB`);
- 6 barras de progresso por estado FSRS (novas / salvas / aprendendo / revisando / dominadas / conhecidas);
- **chips de palavra por banda de frequência**, coloridos pelo estado FSRS, e **clicar no chip salta o vídeo para a cena onde a palavra aparece** ([2357](../content/subtitle-engine.js:2357));
- busca no script, auto-scroll, follow, export **PDF / CSV / Anki**.

Nenhuma linha disso está em qualquer documento do projeto.

### 4d.2 🔴 A régua de frequência diz "top-5k" e tem 835 palavras

[subtitle-engine.js:2080](../content/subtitle-engine.js:2080). Verificado por contagem, não por leitura:

```
TOP5K entries declared : 835
TOP5K unique entries   : 832   (duplicadas: hold, drive, led)
bands built            : 50    (for s=1; s<=5000; s+=100)
bands reachable        :  9
```

Consequências reais:
1. A UI mostra **"Top-5k frequência: X / Y"** e **"Fora do top-5k"**. Uma palavra de rank real 1.500 é rotulada "fora do top-5k" — ela está no top-5k. O rótulo mente.
2. 41 das 50 bandas são inalcançáveis (rank máximo possível = 832). Só existem as faixas `1–100` … `801–900`.
3. Pior: o `stopWords` ([2110](../content/subtitle-engine.js:1910)) remove ~150 das palavras **mais frequentes** do `freqMap` *antes* da contagem — e essas mesmas palavras estão no TOP5K. Então `inTop5k` é calculado sobre um conjunto do qual o topo real foi deliberadamente excluído. A razão `inTop5k / totalUnique` não mede o que o rótulo promete.

Não é lista truncada por acidente: é a lista Fry-1000 clássica com o nome errado.

### 4d.3 🔴 Abrir o painel lateral altera as cores da legenda — ✅ CORRIGIDO (17/07, Fase 2: palavra sem card entra como new; painel agora REFINA as cores com status real + repinta)

Duas fontes de verdade para o mesmo `this.savedWords`:

- [`_loadSavedWords()`:224](../content/subtitle-engine.js:224) — `words.forEach(w => this.savedWords.set(w.word, w.status || 'new'))`. Usa `words.status`, e **todo mundo entra no mapa** (fallback `'new'`).
- [`_createSubtitlePanel()`:2260-2267](../content/subtitle-engine.js:2260) — reconstrói o mapa do zero a partir de `cards.status`, e **só insere quem tem card**:

```js
const freshSaved = new Map();
words.forEach((w) => {
  const status = cardStatus[w.id];
  if (status) freshSaved.set(w.word.toLowerCase(), status);   // sem card → sumiu
});
this.savedWords = freshSaved;   // ← sobrescreve o mapa global do engine
```

Abrir a aba Words (tecla `L`) sobrescreve o mapa que colore a legenda. Toda palavra salva **sem card** cai fora do mapa e volta a ser pintada como `lf-new` (branca, "nunca vista") na legenda ao vivo. O usuário abre o painel e o vídeo "esquece" palavras que ele salvou.

### 4d.4 🔴 As teclas `C` e `O` estão registradas duas vezes no YouTube — ✅ CORRIGIDO (17/07, Fase 1: listener duplicado removido; `KeyC` global clica o switch injetado)

Dois listeners independentes de `keydown`, ambos ativos no YouTube:

- [`_setupKeyboardShortcuts()`:579-584](../content/subtitle-engine.js:579) — `case 'KeyC': this.toggleSubtitles()` e `case 'KeyO': dispatch('LF_TOGGLE_SETTINGS')`.
- [`_injectYouTubeControls()`:1445-1449](../content/subtitle-engine.js:1445) — `if (e.key === 'c') switchWrapper.click(); if (e.key === 'o') btnSettings.click();` → que chamam **as mesmas duas ações**.

O guard `_kbAttached` protege o segundo listener contra si mesmo, mas **não existe guard entre os dois**. No YouTube — a plataforma principal — apertar `C` alterna a legenda duas vezes e `O` alterna as configurações duas vezes. O "Centro de Comando unificado (A, S, D, Q, L, O, C, Espaço)" que o próprio `console.debug` anuncia na [597](../content/subtitle-engine.js:597) tem **2 das 8 teclas quebradas justamente no YouTube**.

Isso reforça a hipótese central: ninguém sabe que os atalhos existem — inclusive porque metade deles não funciona onde o app mais roda, e ninguém notou.

### 4d.5 🔴 Arrastar a legenda para de funcionar após a primeira navegação SPA — ✅ CORRIGIDO (17/07, Fase 2: causa exata eram closures da 1ª injeção presos nos listeners de janela; estado movido para this._drag e host resolvido ao vivo)

[`_injectSubtitleUI()`:1243-1259](../content/subtitle-engine.js:1243): os listeners de `mousemove`/`mouseup` são presos em `window` **uma única vez** (`_dragEventsAttached`), mas fecham sobre o `host` e o `isDragging` **daquela chamada**.

`_onUrlChange()` ([703](../content/subtitle-engine.js:703)) chama `_injectSubtitleUI()` de novo → novo `host`, novo `wrap`, novo `isDragging`. O `mousedown` do novo wrap seta o **novo** `isDragging`; o `mousemove` global continua lendo o **antigo** (sempre `false`) e movendo o **antigo host** (já removido do DOM).

**E é pior do que "após navegar".** `_injectSubtitleUI()` é chamada **duas vezes já no primeiro carregamento**: em `init()` ([509](../content/subtitle-engine.js:509)) e de novo em `_waitForVideo()` ([2960](../content/subtitle-engine.js:2960)) para `youtube` e `max`. Como a função começa com `document.getElementById('linguaflow-subtitle-host')?.remove()`, o host da 1ª chamada é destruído — e é **exatamente esse** que os listeners de drag capturaram.

Resultado: no YouTube e na Max, **arrastar a legenda nunca funciona**, desde o primeiro segundo. Não é regressão de navegação; é o fluxo normal. Um recurso de UI inteiro (reposicionar a legenda com o mouse, com persistência em `subtitleBottom`) que está no código, tem CSS de `grab`/`grabbing`, e nunca respondeu.

### 4d.6 🔴 A fonte concreta do XP passivo (fecha a §3.7)

A §3.7 identificou que `logSession()` escreve pelo caminho legado. **Aqui está quem chama:** [`_startImmersionLog()`:200-215](../content/subtitle-engine.js:200):

```js
this._setManagedInterval(async () => {
  if (this.videoElement && !this.videoElement.paused) {
    const { last_lf_immersion } = await chrome.storage.local.get('last_lf_immersion');
    if (last_lf_immersion && Date.now() - last_lf_immersion < 9000) return;  // dedupe entre abas
    await chrome.storage.local.set({ last_lf_immersion: Date.now() });
    const { db } = await import('../utils/db.js');
    await db.logSession(10, this.platform);
  }
}, 10000);
```

A cada 10s de vídeo **tocando** — sem nenhuma interação, sem legenda ativa, sem clique — grava sessão pelo caminho legado que escreve direto em `user_stats`. Deixar o vídeo rolando sozinho gera progresso. É o contrato pedagógico do Codex violado por um `setInterval`, e a dedupe de 9s prova que alguém já se preocupou com contagem dupla entre abas — mas não com a contagem em si.

### 4d.7 🟡 Duas configurações que a UI oferece e o engine reescreve silenciosamente — ✅ EXECUTADO (17/07, Fase 4: migrações forçadas removidas; prova: sel-mode OFERECE "Apenas Tradução")

[`_loadSettings()`](../content/subtitle-engine.js:778), **em toda carga de página**:

```js
let anticipation = await db.getSetting('translationAnticipation');
if (anticipation === 2 || anticipation === -2) { anticipation = 0; await db.setSetting('translationAnticipation', 0); }   // 785-789

let mode = await db.getSetting('subtitleMode');
if (mode === 'translated') { mode = 'bilingual'; await db.setSetting('subtitleMode', 'bilingual'); }                       // 816-823
```

Não é leitura com fallback — é **escrita corretiva no banco do usuário**. Quem escolher "Somente Tradução" ou antecipação de 2.0s tem a escolha revertida no próximo carregamento, com um `console.debug` como única explicação ("para evitar confusão"). Foi migração de valor legado que ficou permanente. Verificar na §4e se o painel ainda oferece essas opções — se oferece, é uma opção que o app finge aceitar.

### 4d.8 🟡 `cefrColorsEnabled` é lido e nunca respeitado no colorizador

[`_loadSettings()`:840-852](../content/subtitle-engine.js:840) carrega `cefrColorsEnabled` em `this.cefrColorsEnabled`, e monta `this.cefrColors` **sempre** (objeto sempre truthy, mesmo com todos os valores `undefined`).

[`_updateSubtitleColors()`:242](../content/subtitle-engine.js:242) testa `if (this.cefrColors)` — o objeto — **não** a flag. As variáveis CSS `--cefr-*` são aplicadas mesmo com a feature desligada. (Se a flag é honrada em outro ponto, é no render das classes `lf-cefr-*`, ainda não lido — marcar como **hipótese** até ler o `renderDual`.)

### 4d.9 🔴 Erro meu, #9: o denominador da própria auditoria estava errado

A §0 dizia "~19.500 linhas" e "lido ~8.000". Esse número nunca foi medido — foi estimado. Contagem real (`wc -l`, todos os `.js`/`.ts` fora de `node_modules` e `tests`): **23.373 linhas**.

Pior que o total: a §0 **não lista 14 arquivos que existem**, entre eles um que pode ser outro caso 4c:

| Arquivo ausente da §0 | Linhas |
|---|---:|
| **`content/review-overlay.js`** | **289** |
| `content/max-player-ui.js` | 228 |
| `content/engine/subtitle-fetcher.js` | 111 |
| `content/youtube-hook.js` | 110 |
| `content/index.js` | 75 |
| `dashboard/js/core/tts.js` | 342 |
| `dashboard/js/core/ytPlayer.js` | 251 |
| `dashboard/sw.js` | 122 |
| `dashboard/js/core/epub.js` | 103 |
| `dashboard/js/core/statsEngine.js` | 87 |
| `utils/phrasal-verbs.js` | 141 |
| `utils/subtitle-parsers.js` | 132 |
| `popup/popup.js` | 111 |
| `utils/lemma.js` | 88 |

`review-overlay.js` sugere **revisão de cards dentro do vídeo** — exatamente o tipo de feature que a sessão anterior propôs como nova. **Hipótese, não verificado** — o arquivo ainda não foi lido. Entrou no topo da fila.

A §0 foi corrigida para 23.373 e os 14 arquivos foram acrescentados.

### 4d.10 🟡 `_renderVideoWordPrep()` é 80 linhas mortas chamadas de 5 lugares

[2447-2529](../content/subtitle-engine.js:2447). Primeira linha útil:

```js
const box = document.getElementById('lf-video-words');
if (!box) return;
```

`lf-video-words` **não é criado em lugar nenhum do repositório** — verificado por busca do literal em todos os `.js`/`.html`: a única ocorrência é essa leitura. A função é chamada de [479](../content/subtitle-engine.js:479), [2630](../content/subtitle-engine.js:2630), [3087](../content/subtitle-engine.js:3087), [3122](../content/subtitle-engine.js:3122) e de `content/engine/subtitle-fetcher.js:61` — e **sempre retorna no `if (!box)`**.

Era uma tela de "prepare as 14 palavras mais frequentes antes de assistir", com chips que saltam para a cena. Provavelmente morreu junto com o `_injectFloatingButton()` (§4d.9). A feature está inteira no arquivo, sem container.

### 4d.11 🟡 ~160 linhas mortas dentro de `_processYtSub`, e as entidades HTML não são decodificadas

[2645-2943](../content/subtitle-engine.js:2645). Declarados dentro da função e **nunca chamados**:
- `const l = { _a: 4, _b: 14, ... _k: 4 }` — 11 constantes ofuscadas, zero usos;
- `decodeHtml()` ([2660](../content/subtitle-engine.js:2660)) — **definida e nunca chamada**;
- `D` ([2680](../content/subtitle-engine.js:2680)) — 4 conjuntos de stopwords (en/es/de/fr, ~150 palavras) e `detectLang()` ([2839](../content/subtitle-engine.js:2839)) que os consome — **`detectLang` nunca é chamada**.

É a marca de uma "cópia EXATA do V5" (o próprio comentário admite) trazida sem poda.

O `decodeHtml` morto tem consequência possível: a legenda do YouTube vem com entidades (`&#39;`, `&amp;`). O texto só passa por `_cleanSubtitleText` ([3309](../content/subtitle-engine.js:3309)) — **ainda não lido**. Se ele não decodificar, palavras como `don&#39;t` chegam assim na legenda e no clique→popup→card. **Hipótese; confirmar ao ler a linha 3309.**

### 4d.12 🟢 Código morto confirmado no engine (soma-se ao 4b.6)

Lido, não grepado:
- `_injectDeckSelector()` ([1466](../content/subtitle-engine.js:1466)), `_injectFloatingButton()` ([1471](../content/subtitle-engine.js:1471)), `_injectNavigationControls()` ([1476](../content/subtitle-engine.js:1476)), `_createNavButton()` ([1480](../content/subtitle-engine.js:1480)) — **quatro stubs vazios**, todos ainda chamados no `init()`.
- `gotoPreviousCue()` ([1484](../content/subtitle-engine.js:1484)) e `gotoNextCue()` ([1517](../content/subtitle-engine.js:1517)) — duplicatas piores de `prevSubtitle()`/`nextSubtitle()` (sem busca binária). Nenhum atalho aponta para elas.
- `toggleLoop()` ([1538](../content/subtitle-engine.js:1538)) — mexe em `#lf-btn-loop`, botão que os stubs acima deixaram de criar. Usa `setInterval` **não gerenciado** (`_loopInterval`), fora do `_setManagedInterval` — se algum caminho o ativar, ele vaza no `destroy()`. Confirmar chamadores na leitura restante.

---

## 4e. `content/review-overlay.js` (289) + `content/index.js` (75) — leitura integral

Os dois arquivos que a §0 não listava. O primeiro é o melhor código do projeto e ninguém sabe que ele existe.

### 4e.1 🔴🔴 Existe um nono atalho — `R` — e uma revisão de SRS dentro do vídeo

A §4c listou o "centro de comando" como `A/S/D/Q/L/O/C/Espaço` — **oito** teclas. São **nove**. [index.js:41-54](../content/index.js:41):

```js
// Review Overlay — revisão rápida durante vídeos (tecla R)
const { ReviewOverlay } = await import(chrome.runtime.getURL('content/review-overlay.js'));
const reviewOverlay = new ReviewOverlay();
await reviewOverlay.init();
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') { ...; reviewOverlay.toggle(); }
});
```

**Cadeia de carga verificada, não suposta:** `manifest.json` → `content_scripts.js: ["content/boot.js"]` (document_idle, nos 8 domínios) → `boot.js` faz `import(chrome.runtime.getURL("content/index.js"))` → `index.js` instancia o `ReviewOverlay`. **Está em produção, em todos os sites suportados.**

O que a tecla `R` abre ([review-overlay.js](../content/review-overlay.js)): um card por vez, canto inferior direito, sobre o vídeo. Espaço revela, `1 Errei / 2 Difícil / 3 Bom / 4 Fácil`, `Esc` fecha. TTS toca a palavra sozinho ao mostrar o card ([200](../content/review-overlay.js:200)).

**É o arquivo mais bem construído que li até agora** — e por uma margem grande:
- `logReview` com `operationId` idempotente e `_pendingReview` preservado entre tentativas ([212-217](../content/review-overlay.js:212));
- trata `outcome === 'ineligible'` com mensagem específica por `eligibilityReason` (`not_due`, `new_daily_limit`, `suspended`, `stale_card_state`) — **é o contrato do P0.2b honrado de verdade**, incluindo a frase "a prática livre continua disponível no app, sem alterar o placar" ([244](../content/review-overlay.js:244));
- distingue `offline` / `auth` / `retryable` e só descarta o id quando o 4xx **prova** que nada foi aceito ([267](../content/review-overlay.js:267)), com o raciocínio escrito no comentário;
- exige `result.persisted` — não confia no otimismo ([224](../content/review-overlay.js:224));
- a11y real: `aria-live="polite"`, `aria-busy`, `aria-label`, botões `disabled` durante a gravação.

Compare com a §3.3 (o popup que esquece que salvou em 2s) e a §3.7 (duas contabilidades). **O projeto não tem um problema de capacidade de engenharia. Tem um problema de que a boa engenharia já feita está invisível.**

### 4e.2 🔴 Responder um card no YouTube faz o vídeo pular para 10%/20%/30%/40% — ✅ CORRIGIDO (17/07, Fase 1: preventDefault+stopPropagation em fase de captura)

[review-overlay.js:126-131](../content/review-overlay.js:126):

```js
if (actionsVisible) {
  if (e.key === '1') this._answer(1);
  else if (e.key === '2') this._answer(2);
  else if (e.key === '3') this._answer(3);
  else if (e.key === '4') this._answer(4);
}
```

**Sem `preventDefault()`, sem `stopPropagation()`** — ao contrário do ramo do Espaço logo acima ([122](../content/review-overlay.js:122)), que tem.

No YouTube, os dígitos `1`-`9` são atalho nativo: saltar para aquele percentual do vídeo. Então avaliar um card com o teclado — o fluxo que a UI ensina em letras garrafais (`1-Errei 2-Difícil 3-Bom 4-Fácil`) — **grava a revisão e joga o vídeo para outro ponto do episódio**. Clicar no botão com o mouse funciona; usar o atalho anunciado destrói a sessão de vídeo.

Uma linha de correção. Mas explica por que uma feature dessa qualidade pode estar em produção sem ninguém usar: quem tentou uma vez, no YouTube, viu o vídeo saltar e concluiu que estava quebrada.

### 4e.3 🟡 O Espaço tem dois donos durante a revisão — ✅ CORRIGIDO (17/07, junto com §4e.2: o handler do overlay foi para a fase de captura, que roda antes do listener bubble do engine)

`ReviewOverlay._keyHandler` ([121](../content/review-overlay.js:121)) e `SubtitleEngine._setupKeyboardShortcuts` ([585](../content/subtitle-engine.js:585)) escutam `keydown` no **mesmo `document`**, ambos tratam Espaço, ambos chamam `preventDefault()` — e nenhum sabe do outro.

Com o overlay aberto, apertar Espaço para revelar a resposta **também dá play/pause no vídeo**. Não há checagem de `_lfReviewVisible` no engine nem `stopImmediatePropagation()` no overlay. Some-se ao §4d.4 (`C` e `O` duplicados no YouTube): **três das nove teclas do "centro de comando" colidem**, e a colisão só aparece quando duas features boas rodam juntas.

### 4e.4 🟡 O TTS do card toca por cima do áudio do vídeo

[review-overlay.js:200](../content/review-overlay.js:200): `if (this._tts) this._tts.play(word.word, 'en-US');` no `_render()`, sem pausar o vídeo e sem consultar nada.

O overlay foi desenhado explicitamente para **não** interromper o vídeo (cabeçalho do arquivo: "sem interromper o vídeo") — então a palavra é falada em cima do diálogo do episódio. Existe um `utils/exclusive-playback` na fila de leitura, o que sugere que o projeto já tem uma solução para exatamente isso e este arquivo não a usa. **Hipótese — `exclusive-playback` ainda não foi lido.**

### 4e.5 🟡 `destroy()` nunca é chamado; `_currentCard` nunca é declarado

- `ReviewOverlay.destroy()` ([285](../content/review-overlay.js:285)) remove o `keydown` e o host. **Nenhum chamador no repositório.** O `index.js` também não guarda a instância fora do closure (ao contrário de `window.__lfSettingsPanel` e `window.__lfMaxPlayerUI`) — então nem manualmente dá para destruir.
- `this._currentCard` é lido em `_answer()` e escrito em `_render()`, mas não existe no `constructor` ([8-19](../content/review-overlay.js:8)) — que declara todos os outros nove campos. Sem efeito prático (é `undefined` e o guard `!this._currentCard` cobre), mas é o rastro de uma revisão que não passou aqui.

### 4e.6 🟢 `index.js` tem guarda de dupla inicialização, e ela funciona

[65-73](../content/index.js:65): `window.__LF_INITIALIZED__` protege contra o boot rodar duas vezes na mesma aba. Vale registrar o que está certo: é a razão de o engine não ser instanciado em duplicidade apesar do `boot.js` ser reinjetado em navegação SPA.

---

## 4b. Segunda leva (service worker, Edge Function, engine)

### 4b.1 🔴 "Palavras conhecidas" é um fantasma no app inteiro

Quatro fatos que só aparecem juntos:

1. `known_words` = **0 linhas** em produção.
2. `markAsKnown()` tem **um único chamador**: [readerView.js:379](../dashboard/js/ui/readerView.js:379) — o Leitor de texto. **Não existe como marcar "eu já sei" assistindo vídeo.**
3. `subtitle-engine.js:73` escuta `LF_WORD_KNOWN` — e **ninguém no repositório dispara esse evento**. Listener órfão. `this.knownWords` nunca pode ser preenchido na extensão.
4. Mesmo assim, o popup exibe `knownAtLevel/allLevel` ([word-popup.js:605](../content/word-popup.js:605)), onde `allLevel` é a wordlist **inteira** daquela banda. Com 20 palavras salvas, o usuário lê `3/850 B1`.

A feature é referenciada no popup, no engine, no selo das histórias — e não tem dado nem caminho de aquisição. **Derruba a W6.2 ("você conhece 94% deste episódio"): antes da tela, é preciso existir a ação.**

### 4b.2 🟢 O rate-limit da Edge Function existe — W6.4 está liberada

`supabase/functions/deepseek-chat/index.ts`, lido integralmente:

- valida JWT de verdade (`admin.auth.getUser(token)`) — não aceita só o header;
- **rate-limit de 20/min por usuário** via `api_usage_log`;
- CORS restrito (extensão + `*.vercel.app` + localhost), nunca `*`;
- modelo fixo e `max_tokens` com teto de 2048 — o cliente não dita custo.

É um proxy bem construído. **O bloqueio que eu tinha posto na W6.4 está resolvido: pode remover o BYOK com segurança.**

### 4b.3 🔴 Eu errei de novo: o BYOK está em UM lugar, não três

[service-worker.js:713](../background/service-worker.js:713) — `getApiConfig()` é o gargalo único. As referências a `config.apiKey` nas linhas 512/527 **usam** essa função, não são caminhos paralelos. Remover o BYOK = remover as linhas 714-729 e a seção da UI. Bem mais simples do que eu disse.

### 4b.4 🔴 A W1 tem agora um desenho possível

[service-worker.js:115](../background/service-worker.js:115) e [569](../background/service-worker.js:569): `QUEUE_WORD_SAVE` → `enqueueWordSave()` grava em `chrome.storage.local` sob a chave `lf_pending_word_saves_v1`, com id `${lang}:${word}`, e responde na hora. `syncPendingWordSaves()` roda logo depois (e a cada 1 min pelo alarme `word-save-sync`), chama `db.saveWord(payload)` e só então existe `result.id`.

**Portanto a primeira recuperação deve seguir o mesmo padrão, não lutar contra ele:**

1. A microetapa roda no popup e grava o resultado numa fila local `lf_pending_first_recall_v1`, com **o mesmo id** `${lang}:${word}`.
2. `syncPendingWordSaves()`, depois de obter `result.id`, drena a fila de recall e posta a tentativa.
3. Se o save falhar, a tentativa espera junto — nunca fica órfã.

Isso reaproveita retry, dedupe e o alarme que já existem. **A W1 deixa de ser impossível e passa a ser uma extensão natural da fila local-first.**

### 4b.5 🟡 O popup já pausa o vídeo

[word-popup.js:722](../content/word-popup.js:722): ao abrir, se o vídeo está tocando, ele pausa e marca `_wasPlayingBefore`. Meu contrato da W1 dizia "o vídeo nunca é pausado por nós" — **escrito em ignorância**. O app já pausa, e isso é bom: os 15 segundos acontecem com o vídeo parado, sem correria.

### 4b.6 🟡 Código morto no engine

`subtitle-engine.js` declara e **nunca usa**:
- `maxWordsPerVideo = 15` e `maxWordsPerDay = 30` — alguém já pensou num teto de captura e abandonou. Não conflita com a W7 (teto de acervo), mas mostra que a ideia já passou por aqui;
- `cefrAutoSave = false`.

`service-worker.js:163,166` lista `createDeck` e `deleteDeck` em `writeMethods` — métodos que **não existem mais** no `db` (decks foram removidos). E a tabela `settings` de produção ainda tem uma linha `decks`.

### 4b.7 🟡 Configurações órfãs em produção

A tabela `settings` real contém `lf_srs_ease`, `lf_srs_min_interval`, `lf_srs_penalty`, `lf_srs_suspend` — **nenhuma dessas está em `baseKeys` de `getSRSSettings()`**. São da era SM-2: a tela gravava, o motor lia outras chaves. O `db.js` já documenta o bug; as linhas órfãs continuam lá.

### 4b.8 🟡 O nível CEFR sincroniza só num sentido — ✅ JÁ CORRIGIDO em main por sessão paralela (verificado 17/07: settingsView grava as duas chaves em Promise.all)

[settings-panel.js:215-219](../content/settings-panel.js:215): mudar o nível **no painel da extensão** grava `cefrTargetLevel` **e** espelha em `lf_cefr_level`. Mas a tela de Configurações do site grava **só** `lf_cefr_level`.

Consequência: mudar seu nível no site **não atualiza** o `cefrTargetLevel` que o engine usa para colorir a legenda. Duas chaves, um espelho de mão única.

### 4b.9 🟢 Anti-pattern presente no código, ausente no banco

[service-worker.js:818](../background/service-worker.js:818): `getPTPhoneticWithAI` cacheia em `db.setSetting('pt_phonetic_' + palavra, ...)` — usa o k/v de `settings` como cache, exatamente o que o `db.js` proíbe por comentário ("CACHE DE TRADUÇÃO — tabela própria, NUNCA mais dentro de settings"). **Verificado em produção: zero linhas `pt_phonetic_*`.** A bomba existe, não detonou.

### 4b.10 🟢 O que já existe e eu propus como novidade

- **`autoPause`** ([subtitle-engine.js:40](../content/subtitle-engine.js:40)) — a "mineração com pausa automática" que sugeri já é uma configuração real.
- **Cores CEFR na legenda** (`cefrColorsEnabled`, `cefrColorA1..C2`) — o gradiente de exposição estilo LingQ existe em alguma forma.
- **Falsos cognatos** ([word-popup.js:39](../content/word-popup.js:39)): 30 pares curados à mão para brasileiros (`actually`, `pretend`, `library`, `exquisite`…). É exatamente o "gosto humano" que eu disse que faltava no app. Existe, e é bom.

---

## 4g. `dashboard/js/ui/studyView.js` 1-560 + `utils/pronunciation.js` — a W4 é o quarto caso

### 4g.1 🔴🔴🔴 O app manda o aluno falar em voz alta. O microfone existe. Ninguém ligou os dois. — ✅ RELIGADO (17/07, Fase 3: primeiro import do pronunciationLab; mic por clique, score+diff no overlay, stop() em troca de card/rota)

**Este é o achado da auditoria.** Três fatos verificados que só significam algo juntos:

**1.** [studyView.js:241-248](../dashboard/js/ui/studyView.js:241) — existe um `<!-- Shadowing Engine Overlay -->`:

```html
<div id="shadowing-overlay" class="hidden" ...>
  <div style="font-size: 24px;">⏳</div>
  <div style="font-size: 18px; font-weight: 800;">Sua vez... Fale em voz alta!</div>
  <div ...><div id="shadowing-progress" style="transition: width 3s linear;"></div></div>
</div>
```

Ele é disparado de verdade — [playCurrentAudio():950-963](../dashboard/js/ui/studyView.js:950): quando o TTS termina de falar a frase, o overlay aparece, a barra corre por **3 segundos** e some. É tudo que ele faz. **Ele não escuta.** É um cronômetro com uma frase de incentivo.

**2.** [`utils/pronunciation.js`](../utils/pronunciation.js) — 148 linhas — exporta `pronunciationLab`, com **reconhecimento de fala real**:

```js
export const pronunciationLab = {
  ...
  if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) { ... }
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  this.recognition = new SpeechRecognition();
  ...
  await navigator.mediaDevices.getUserMedia({ audio: true });
```

**3.** **`pronunciationLab` não é importado em lugar nenhum.** Verificado: busca por `pronunciation` em todo o repo (`.js` + `.html`, fora de `node_modules`) devolve **8 ocorrências, todas da coluna `pronunciation_pt`** — que é outra coisa (a string de fonética PT-BR do §3.1). **Zero importadores do módulo.** Ele é um órfão completo, como o listener `LF_WORD_KNOWN` do §4b.1.

> **O app pede "Fale em voz alta!", conta 3 segundos, e desiste — enquanto o código que ouviria a voz está pronto, num arquivo que ninguém importa.**

**Correção da §4c:** eu escrevi *"Da W4 (shadowing), portanto, só falta a gravação da voz — o replay do trecho já está pronto"*. **Errado de novo.** A gravação da voz **também já está pronta**. O que falta da W4 não é código: é **um `import`**. É a §4f na sua forma mais pura — não falta motor, falta fiação.

### 4g.2 🔴 A W4 tem quatro peças. Todas construídas. Nenhuma conectada. — ✅ TRATADO (17/07, Fase 3: cores do diff com fallback --color-primary/--color-danger)

| Peça da W4 (shadowing) | Estado real | Onde |
|---|---|---|
| Replay do trecho na legenda | ✅ pronto, atalho `S` | `subtitle-engine.js:602` |
| Replay do clipe de vídeo no card de estudo | ✅ pronto | `studyView.js:6` importa `playClip`, `replayClip`, `setClipLoop` de `core/ytPlayer.js` |
| Prompt de shadowing ("sua vez, fale") | ✅ pronto (3s, sem escutar) | `studyView.js:241` + `:950` |
| **Gravação/avaliação da voz** | ✅ **pronto e órfão** | `utils/pronunciation.js` — **0 importadores** |

**A W4 sai de "1 card em 4, e falta gravar a voz" (§2.3) para "está inteira no disco, desconectada".** A ressalva do §2.3 (só 5 de 20 words têm `video_start_ms`) atinge **apenas a 2ª linha** — o clipe do vídeo. As outras três não dependem de bounds de vídeo.

### 4g.3 🟢 O `studyView` é um motor de estudo com paridade de Anki muito além do documentado

Lido 1-560 de 1.920. O que já existe, e que nenhum documento do projeto menciona:

- **Cotas diárias reais** ([139-140](../dashboard/js/ui/studyView.js:139)): `newPerDay` e `maxRevPerDay` descontando `getTodayCounts()`, com a regra correta de que a cota de revisão **não pode esconder card novo** e que `learning` sempre continua na sessão ([151-159](../dashboard/js/ui/studyView.js:151)).
- **Learning steps que voltam dentro da sessão** (`pendingLearning`) + **tela de espera com countdown real** ([527-558](../dashboard/js/ui/studyView.js:527)), com a decisão pedagógica escrita no comentário: *"Nunca antecipamos automaticamente um step: encurtar 10 min para alguns segundos destrói justamente o espaçamento que ele representa."*
- **Interleaving guiado por diagnóstico** ([164-170](../dashboard/js/ui/studyView.js:164)): busca a categoria com retenção < 80% (mín. 5 revisões) e a prioriza na fila.
- **Paridade "Custom Study" do Anki** ([119-130](../dashboard/js/ui/studyView.js:119)): `weakOnly` revisa leech/fracas **ignorando de propósito** cota diária e `due_date`, com o porquê no comentário.
- **Revisar por tópico** (`params.category`, Onda 2.2), **Undo** estilo Anki (tecla `Z`), **Bury** ("deixar pra amanhã").
- **Cards reversos PT→EN** (`lf_reverse_cards`), **exercícios variados** (montar frase / ditado, ON por padrão).
- **Tutor de gramática por IA** inline, que só responde quando perguntado ([271](../dashboard/js/ui/studyView.js:271)).
- **YouGlish** ("ver nativos falando esta palavra"), **Tatoeba** ("frases de falantes reais"), **chunks por IA**, **mnemônico sob demanda** ("💡 Me dá um truque pra lembrar").
- **Trecho original do vídeo dentro do card** (`video-resource-section`, `study-yt-mount`).
- a11y de verdade: `role="main"`, `aria-live`, `sr-only`, `aria-label` descritivo em cada botão de nota, e `prefers-reduced-motion` desligando as animações ([1872](../dashboard/js/ui/studyView.js:1872)).
- Higiene de ciclo de vida séria: `studyViewGeneration`, `scheduleStudyTask` com guarda de geração, `audioUiToken`, `cardMutationPromise` para não deixar refetch ressuscitar card durante escrita ([99-104](../dashboard/js/ui/studyView.js:99)).

**Isto não é um app que "falta feature".** É um app cujo motor de estudo tem paridade de Anki, tutor de IA, YouGlish, Tatoeba e clipe de vídeo — e cujo dono foi convencido (por mim, no plano suspenso) de que precisava construir shadowing.

### 4g.4 🔴 Erro meu, #11: a §2.3 mediu certo e concluiu errado — o clipe vale para 20 de 20, não 5

A §2.3 dizia: *"`words_with_video` = 5 de 20 (25%). A W4 (shadowing com a voz do ator) valeria para 1 card em 4."*

**O número estava certo. A conclusão, não.** Consulta ao banco vivo (16/07, somente leitura):

| Métrica | Valor |
|---|---:|
| `words` | 20 |
| com **`video_url`** | **20** ← *a §2.3 nunca mediu isto* |
| com `video_start_ms` (bounds exatos) | 5 |
| com URL de **YouTube** (player embutido possível) | **10** |
| com `ai_chunks` | 20 |
| com `mnemonic` | 2 |

**Todas as 20 palavras têm vídeo de origem.** O que 15 delas não têm é o *bounds exato* — e [studyView.js:1145-1150](../dashboard/js/ui/studyView.js:1145) **já trata exatamente esse caso**, com o porquê escrito:

```js
// Cards antigos salvaram o momento do clique (geralmente perto do fim da
// legenda), não os bounds da cue. Para eles reconstruímos uma janela curta
// para trás e a marcamos como aproximada. Cards novos usam start/end exatos.
const clipStart = hasExactBounds ? vctx.start : Math.max(0, vctx.start - estimatedDuration);
```

E a janela estimada vem do tamanho da frase (`phraseWords / 2.4 + 0.8`, teto de 14s). O card antigo **não perde o clipe** — ele ganha um trecho aproximado, **rotulado como aproximado na UI**: *"Card antigo: trecho reconstruído aproximadamente · repetição contínua"* ([1162](../dashboard/js/ui/studyView.js:1162)).

Eu tratei `video_start_ms IS NULL` como "não dá para fazer W4". O código já tinha resolvido isso antes de eu escrever o plano. **Cobertura real do clipe: 10/20 com player embutido em loop (os do YouTube) e 20/20 com pelo menos o link no ponto salvo** — não "1 em 4".

*(Ressalva honesta: assumo que `getVideoContext` extrai `start` da URL quando `video_start_ms` é nulo — é o que explica 20/20 terem `video_url` e o código usar `vctx.start` sem bounds. `core/videoContext.js` foi lido pela sessão anterior, não por mim. **Marcar como hipótese até eu ler as 112 linhas.**)*

### 4g.5 🟢 O card de estudo é um estúdio de shadowing — menos a voz

[renderReveal():1137-1220](../dashboard/js/ui/studyView.js:1137) — o "Trecho original 🎬" dentro do card:

- **"▶ Ouvir em loop (N s)"** — carrega o trecho no ponto exato e **repete a frase continuamente** (`setClipLoop(true)`), com o número de segundos no próprio botão;
- **"↻ Do início"** — reinicia o trecho;
- toggle play/pause com `aria-pressed` e `aria-busy` corretos, e `role="status"` narrando o estado ("Repetindo somente esta frase" / "Pausado no trecho");
- **degradação graciosa**: sem `videoId` extraível (DRM, Netflix, Max) cai para o link externo no ponto salvo, sem quebrar ([1221-1228](../dashboard/js/ui/studyView.js:1221));
- player YouTube **único e reutilizável** (Onda 2.5): trocar de card faz `cueVideoById`, nunca recria o iframe ([1135](../dashboard/js/ui/studyView.js:1135)).

Ou seja: **o aluno já pode ouvir o ator dizendo a frase, em loop, dentro do flashcard.** A W4 que eu propus como "shadowing com a voz do ator" existe — com loop, com a11y e com fallback. Falta só o app **escutar de volta** (§4g.1), e o módulo que escuta está pronto e órfão.

### 4g.6 🟢 Os rótulos dos botões de nota mostram o intervalo real do FSRS

[updateGradeLabels():711-727](../dashboard/js/ui/studyView.js:711) chama `lfDb.predictNextState(clean, g, category)` para as 4 notas e escreve o intervalo real em cada botão. Com dois cuidados que revelam maturidade:

- o comentário diz o motivo: *"os rótulos fixos antigos ('Bom = 3 dias') mentiam pro aluno"*;
- **o estado previsto é o que será persistido no clique** ([719-721](../dashboard/js/ui/studyView.js:719)): *"Assim o intervalo visível e o salvo são o mesmo valor, sem um segundo sorteio."* — evita o clássico bug de prever com um roll e salvar com outro;
- se a previsão falhar, o rótulo fica em `…` — *"melhor que mentir"* ([726](../dashboard/js/ui/studyView.js:726)).

E existe **perfil de SRS por categoria** (`predictNextState(..., category)`, Onda 9).

### 4g.7 🟢 Quatro tipos de exercício, com uma decisão de linguista escrita no código

[loadNextCard():662-686](../dashboard/js/ui/studyView.js:662):

- **classic** (cloze — a palavra sai borrada na frase), **reverse** (PT→EN), **builder** (word bank estilo Duolingo), **dictation** (escute e escreva);
- exercício variado **só para cards graduados** — *"card novo aprende primeiro no modo clássico, produção vem depois, como no Anki/Duolingo"*;
- e a regra que mais me impressionou ([671-674](../dashboard/js/ui/studyView.js:671)):

```js
// PALAVRA FRACA → exercício de PRODUÇÃO (decisão do linguista: produzir
// fixa mais que reconhecer — é o tratamento certo pra leech em formação).
if (isWeakCard(card) && (canBuild || canDictate)) card._mode = canBuild ? 'builder' : 'dictation';
```

O `exerciseFinish()` ([778-802](../dashboard/js/ui/studyView.js:778)) fecha o desenho: **erro só oferece "Errei"; acerto oferece Difícil/Bom/Fácil** — a verificação é objetiva, mas a autoavaliação continua do aluno, e *"a sessão nunca avança por timeout"*.

### 4g.8 🟡 Um bug antigo documentado no próprio código — ✅ EXECUTADO (17/07, Fase 4: fallback morto removido; sem container real, não renderiza)

[489-491](../dashboard/js/ui/studyView.js:489): *"BUG antigo: escrevia em `#app-view`, que não existe → caía no `<body>` e destruía o app inteiro."* Corrigido, mas `renderWaitingScreen` ([528](../dashboard/js/ui/studyView.js:528)) usa `studyContainer || document.body` — **sem o fallback `#app-view` do irmão**. Se `studyContainer` for null, escreve no `<body>` e reproduz exatamente o bug que o comentário diz ter matado. **Hipótese** — depende de `studyContainer` poder ser null aqui; não rastreei todos os caminhos.

### 4g.9 🟡 O comentário diz Ctrl+Z; o código aceita Z sozinho — ✅ CORRIGIDO (17/07, Fase 1; a linha real era 426, não 377)

[377](../dashboard/js/ui/studyView.js:377): comentário *"Ctrl+Z / tecla Z"*, código `if ((e.code === 'KeyZ') && !e.shiftKey)` — **não testa `ctrlKey`**. Apertar `z` sozinho desfaz a última revisão. Combina com o texto do botão ("Desfazer última (Z)"), então provavelmente é o código que está certo e o comentário que envelheceu.

---

## 4i. `dashboard/js/ui/storiesView.js` 1-670 — o quinto caso, e a terceira métrica LingQ

### 4i.1 🔴🔴 "Reencontro" existe pela terceira vez — agora como narrativa gerada

A W3 que eu inventei chamava-se *"Reencontro na legenda"*. Já achei o reencontro na legenda (§4c). Aqui está ele **de novo**, num terceiro lugar — [`getReencounterWords()`:21-39](../dashboard/js/ui/storiesView.js:21):

```js
// Palavras pro REENCONTRO na história (Marco 3): fracas primeiro (3+ lapsos/
// leech), depois as em aprendizado mais recentes — até 8.
const weak = cards.filter(c => !c.suspended && ((c.lapses || 0) >= 3 || c.is_leech))
  .sort((a, b) => (b.lapses || 0) - (a.lapses || 0)).map(nameOf);
const inProgress = cards.filter(c => !c.suspended && (c.status === 'learning' || c.status === 'review'))
  .sort((a, b) => new Date(b.last_review || 0) - new Date(a.last_review || 0)).map(nameOf);
return [...new Set([...weak, ...inProgress])].slice(0, 8);
```

Essas 8 palavras são passadas para a geração da história. **A IA escreve uma história sob medida para reencontrar exatamente as palavras que a sua memória está perdendo**, priorizando leech e lapsos. Isso não é "reencontro"; é reencontro *narrativo*, dirigido pelo estado do FSRS. Nem o LingQ tem.

O projeto chama de "Marco 3" e nenhum documento do plano menciona.

### 4i.2 🔴 A métrica LingQ existe pela terceira vez (depois: **quarta**, ver §4l.3) — e a §2.2 fica ainda mais insustentável

[storiesView.js:111](../dashboard/js/ui/storiesView.js:111):

```html
<span id="story-known-badge" ... title="Percentual de palavras desta história que você já conhece (métrica LingQ)"></span>
```

Placar da "métrica LingQ que precisa ser construída" (§2.2): **implementada 3 vezes** — `renderStats()` no painel da legenda (§4d.1), este selo nas Histórias, e o `knownAtLevel/allLevel` no popup (§2.2, o único ruim dos três).

E o gradiente de exposição também está aqui pela terceira vez ([184-185](../dashboard/js/ui/storiesView.js:184)):

```css
.story-word.saved { border-bottom: 2px dashed #ffc800; ... } /* aprendendo (LingQ amarelo) */
.story-word.known { color: var(--color-primary); }           /* conhecida */
```

### 4i.3 🟢 O quiz de compreensão é melhor do que qualquer coisa que eu teria proposto

[`generateQuiz()`:324-358](../dashboard/js/ui/storiesView.js:324) + [`renderQuiz()`:360-444](../dashboard/js/ui/storiesView.js:360). Perguntas geradas **da própria história**, e cada detalhe é uma decisão:

- **3 a 5 perguntas, sorteadas** — *"Onda 8: era sempre exatamente 3 — agora varia, pra não ficar previsível"*;
- **5 aspectos de compreensão** sorteados por quiz: fatos, intenções/sentimentos, causa e efeito, **inferência apoiada pelo texto**, vocabulário em contexto;
- **anti-repetição real**: manda as últimas 9 perguntas usadas no prompt com *"Não repita nem parafraseie"*;
- **embaralha as opções depois de receber da IA** ([355-356](../dashboard/js/ui/storiesView.js:355)) e recalcula o índice da resposta — mata o viés de posição do LLM;
- **esconde o texto durante o quiz** ([365-368](../dashboard/js/ui/storiesView.js:365)): *"o texto ficava visível embaixo do quiz o tempo todo — dava pra rolar e colar a resposta em vez de responder de memória. Agora esconde por padrão; reler é uma escolha consciente (botão), não um vazamento."* — **isso é desenho de avaliação, não de UI**;
- `normalizeQuiz()` valida 4 opções distintas, índice de resposta válido, sem pergunta duplicada — e o comentário ([315-319](../dashboard/js/ui/storiesView.js:315)) documenta o mesmo bug tendo escapado **duas vezes** (`=== 3`, depois `<= 5`) antes de virar `slice(0,5)` antes da checagem.

### 4i.4 🟢 XP com cap no banco, idempotência e degradação — nas Histórias

- `db.recordEvent('story_quiz', correct)` — só se acertou ≥1, e **uma vez por história** (`storyQuizScored`), com rollback da flag se a chamada falhar ([428-437](../dashboard/js/ui/storiesView.js:428));
- `db.recordEvent('story_read')` — cap 3/dia no banco, e a UI **diz** quando o cap foi atingido em vez de fingir que deu XP ([476](../dashboard/js/ui/storiesView.js:476));
- história salva **no banco primeiro** — *"história = tokens gastos, nunca pode se perder; sincroniza entre dispositivos. Local fica como espelho offline"* ([604-605](../dashboard/js/ui/storiesView.js:604));
- TTS da história inteira com **chunker** para contornar *"the 15-second speech synthesis bug in Chromium"* ([286](../dashboard/js/ui/storiesView.js:286));
- tooltip de palavra no **hover E no foco** (teclado), mostrando *só a tradução da palavra, nunca a frase* — decisão pedagógica explícita ([542-543](../dashboard/js/ui/storiesView.js:542)).

> **Nota para a §3.7 (não re-litigar sem ler):** `storiesView` usa `db.recordEvent('story_quiz'|'story_read')` e os comentários chamam isso de *"XP real via Learning Engine, cap diário no banco"* — enquanto a §3.7 classificou `recordEvent` como **o caminho legado**. Uma das duas leituras está errada, ou `recordEvent` roteia por dentro. **Resolver lendo `db.recordEvent` antes de afirmar qualquer coisa.**
>
> Dado de produção relacionado: `learning_events` = 7, **todos `card_reviewed`**. Logo **nenhum `story_quiz` ou `story_read` jamais disparou em produção** — coerente com 3 histórias e 1 pessoa usando. A feature nunca foi exercida.

### 4i.5 🟡 Dois bugs antigos documentados no próprio arquivo

- [585-586](../dashboard/js/ui/storiesView.js:585): *"BUG antigo: usava `chrome.storage` — no SITE não existe, então o histórico nunca salvava."* Corrigido com bifurcação `isExtension`.
- [315-319](../dashboard/js/ui/storiesView.js:315): o bug do tamanho do quiz, que escapou duas vezes.

O padrão se repete: **o código conhece seus próprios erros passados melhor do que qualquer documento do projeto.** Os comentários deste repositório são o único registro histórico honesto que existe aqui — e não estão em lugar nenhum que um humano leia.

---

## 4j. Leitura em lote (paralela): fim da legenda, fim do popup, painel de configurações inteiro, fim do service worker

Quatro arquivos numa só leva, cada achado verificado individualmente antes de entrar aqui (busca dirigida, não confiança no lote).

### 4j.1 🔴 Confirmado: `_cleanSubtitleText` não decodifica entidades HTML — a hipótese da §4d.11 vira fato

[subtitle-engine.js:3309-3317](../content/subtitle-engine.js:3309), lido por completo:

```js
_cleanSubtitleText(text) {
  if (!text) return '';
  return text
    .replace(/\[.*?\]/g, '')   // Remove [Music], [Laughter]
    .replace(/\(.*?\)/g, '')   // Remove (shouting)
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
```

Trata **só** `&nbsp;`. Nenhum `&amp;`, `&#39;`, `&quot;`. E `decodeHtml()` — definida em `_processYtSub` — segue **confirmada morta**: a única ocorrência do nome no arquivo inteiro é a própria definição. `_parseVTT` (o parser de HBO/Max, [2534](../content/subtitle-engine.js:2534)) também só remove tags `<...>`, sem decodificar entidade nenhuma.

**Toda legenda de VTT/HTML com entidade chega intacta** à legenda na tela, ao clique, ao popup e ao `context_sentence` salvo no card. `don&#39;t` vira card com `don&#39;t` escrito literalmente. Constatado, não hipótese.

### 4j.2 🔴🔴 Um recurso de acessibilidade inteiro está escondido com `display:none` — e continua rodando por baixo — ✅ EXECUTADO (17/07, Fase 4: display:none removido, seletor visível)

`content/settings-panel.js` lido **por completo** (907 linhas). No HTML do painel, a seção de paleta de cores:

```html
<div class="group" style="display:none;">
  <label>Paleta de Cores Semântica</label>
  <select id="sel-palette">
    <option value="Vibrant">Vibrante (Cores Vivas)</option>
    <option value="Pastel">Pastel (Suave)</option>
    <option value="Colorblind">Acessibilidade (Daltônicos)</option>
  </select>
</div>
```

**`display:none` no `<div>` inteiro** — o usuário nunca vê essa opção. E o código que ela controlaria está vivo e correto, em [`_applyToEngine()`:889-895](../content/settings-panel.js:889):

```js
if (this.cfg.colorPalette === 'Pastel') {
  colKnown = '#bbf7d0'; colSaved = '#bae6fd';
} else if (this.cfg.colorPalette === 'Colorblind') {
  colKnown = '#60a5fa'; colSaved = '#fb923c'; // Azul/Laranja para daltônicos verem que já sabem
}
```

**Um modo de cores para daltônicos foi implementado, testado o suficiente para ter comentário explicando a escolha de cor, e depois escondido atrás de `display:none` sem remover a lógica.** Ninguém com daltonismo consegue ativá-lo — a única porta de entrada é um `<select>` que a própria extensão esconde de si mesma. Esta é a descoberta mais grave para a skill `accessibility-champion` até agora: não é ausência de a11y, é a11y construída e depois trancada.

### 4j.3 🟡 O único lugar que documenta os atalhos está incompleto — e corrige a §4e.1 — ✅ CORRIGIDO (17/07, Fase 1: `C` e `Espaço` adicionados à grade)

`settings-panel.js` tem a única lista de atalhos do projeto voltada ao usuário ([772-788](../content/settings-panel.js:772)):

```
Fala Anterior A · Repetir Fala S · Próxima Fala D · Auto-Pausa Q ·
Revisão Rápida R · Painel Lateral L · Configurações O
```

**Correção da §4e.1:** eu escrevi *"nenhum documento menciona"* a tecla `R`. **Errado — esta lista menciona.** O app documenta a si mesmo; o que falta é documentação **externa** (planos, HANDOFF, README). Corrijo: `R` está documentado, só que atrás de um painel que abre com `O`, numa extensão que a maioria não sabe ter atalho para abrir.

E a lista, mesmo documentando `R`, **está incompleta**: faltam `C` (toggle legenda) e `Espaço` (play/pause) — dois dos nove atalhos reais do `_setupKeyboardShortcuts`. Nem o inventário interno do próprio app está completo.

### 4j.4 🟡 `blurSubtitles`: configuração sem controle, mas com guard — não quebra, só está presa — ✅ EXECUTADO (17/07, Fase 4: sel-blur criado; desfoca a legenda ORIGINAL, treino de escuta)

`readAllSettings()` ainda lê `blurSubtitles` do banco, `this.cfg.blurSubtitles` ainda existe, `_applyToEngine()` ainda aplica em `engine.blurSubtitles`. **Mas não há `id="sel-blur"` em lugar nenhum do `_html()`** — confirma o achado da varredura de fiação (§4h.3). Diferente do `#app-view` (§4h.3, que quebra), aqui o código é defensivo: `const selBlur = s.getElementById('sel-blur'); if (selBlur) selBlur.value = ...` — não lança erro, só nunca executa. **A configuração ficou congelada no valor que tinha quando a UI foi removida**, e ninguém pode mudá-la de novo.

### 4j.5 🔴 O backfill automático de frases pode ser enganado pelo próprio bug da §3.2

[service-worker.js:1423-1464](../background/service-worker.js:1423) — `backfillMissingSentences()`: roda 10s depois do SW subir, encontra palavras sem `context_sentence` ou sem `ai_chunks`, e gera via IA, **respeitando a frase original se ela for boa**:

```js
const hasGoodVideoContext = w.context_sentence && w.context_sentence !== w.word
  && w.context_sentence.split(' ').length > 2;
if (!hasGoodVideoContext) w.context_sentence = chunks[0].eng;
```

O guard é `> 2 palavras`. **A §3.2 mostrou que `_truncateContext` pode salvar `"... palavra ao redor ..."`** — que depois do `split(' ')` tem bem mais que 2 tokens (as reticências contam como token). **`hasGoodVideoContext` avalia isso como "boa" e nunca substitui.** O próprio mecanismo de correção automática do projeto é enganado pelo bug que deveria corrigir — a frase picotada com `...` sobrevive para sempre, protegida pelo safety net que existia para evitar exatamente esse tipo de dado ruim.

### 4j.6 🟡 `getReencounterWordsSW` — a mesma lógica da §4i.1, duplicada de propósito

[service-worker.js:1240-1256](../background/service-worker.js:1240): função **idêntica** a `getReencounterWords()` do `storiesView.js` (§4i.1), com o comentário *"Onda 1.4 — paridade com a web"*. Não é o padrão de reinvenção cega da §4f/§4i — é duplicação **deliberada** porque a extensão e o site não compartilham módulos ES facilmente. Ainda é risco: se a regra de priorização mudar num lado (ex.: pesar `is_leech` diferente), o outro lado diverge sem aviso. Baixa severidade, registrado por precaução.

### 4j.7 🟡 `lf_auto_backup` — escrito, nunca lido — ✅ EXECUTADO (17/07, Fase 4: alarme+função removidos, dados órfãos limpos)

[service-worker.js:1375-1382](../background/service-worker.js:1375) — `runAutoBackup()` salva todas as `words` (não cards, não reviews) em `chrome.storage.local` sob `lf_auto_backup` + `lf_auto_backup_date`. **Busca no repo inteiro: a chave só aparece nesta linha, a que escreve.** Não existe import, não existe tela de restore, não existe leitura em lugar nenhum. Backup fantasma — existe no disco do usuário e não serve para nada hoje.

### 4j.8 🟢 Contraexemplo: `LF_WORD_SAVED` é fiação que funciona

Para calibrar a regra 1 (nem tudo é desconexão): `word-popup.js` dispara `LF_WORD_SAVED` ao salvar, e `subtitle-engine.js:69` **escuta de verdade** — é assim que a legenda recolore a palavra instantaneamente após salvar, sem esperar o sync com o servidor. Confirmado via grep dirigido. Registrado para não deixar a auditoria parecer que tudo no projeto está desconectado — a maioria da fiação funciona; os achados são os pontos que não.

### 4j.9 🟢 `max-player-ui.js` não é totalmente órfão — só parte dele

Correção de precisão sobre a varredura (§4h.5, mais um caso): o script apontou `isMaxHost` e `computeMaxOverlayLayout` como símbolos órfãos de `max-player-ui.js`. **Confirmado que são.** Mas `computeMaxPopupLayout` (nome parecido, função diferente) **é importado e usado de verdade** em `word-popup.js:3` e `:1580`, para posicionar o popup de palavra sobre a legenda no HBO Max. O arquivo tem uma função viva e duas mortas coabitando — não é o mesmo caso do `content/engine/` (§4h.2), que está morto por inteiro.

---

## 4k. Leitura em lote: `homeView.js`, `gameView.js`, `app.js`, `libraryView.js` — todos integrais

Quatro arquivos completos (3.166 linhas). Menos "já existe" nesta leva, mais duas coisas: um bug real duplicado, e uma peça de engenharia que ninguém documentou.

### 4k.1 🟡 O guard frágil da §4j.5 está em 2 lugares, não em 1 — confirmado por grep, não suposição

Verifiquei antes de escrever: `hasGoodVideoContext` aparece em exatamente **duas** implementações independentes, byte a byte idênticas:

```js
const hasGoodVideoContext = w.context_sentence && w.context_sentence !== w.word && w.context_sentence.split(' ').length > 2;
```

- [service-worker.js:1445](../background/service-worker.js:1445) — backfill automático em segundo plano.
- [libraryView.js:294](../dashboard/js/ui/libraryView.js:294) — botão manual "✨ Gerar agora" no Cofre, visível quando há palavras sem contexto de IA.

**As duas** herdam a mesma vulnerabilidade da §4j.5: uma frase truncada pelo `_truncateContext` (`"... palavra ..."`) tem mais de 2 tokens depois do `split`, então **as duas** avaliam como "boa" e nunca a substituem. O usuário pode clicar em "Gerar agora" no Cofre pensando que vai consertar a frase picotada — e ela sobrevive, porque o botão herda o mesmo bug do robô que ele estava tentando contornar.

### 4k.2 🟢 `new_per_day` — verificado como corretamente ligado (não é bug)

Antes de escrever, testei a hipótese de que a chave que o onboarding grava (`new_per_day`, `homeView.js:188`) poderia divergir da que o `studyView` lê (`srs.newPerDay`). **Não diverge.** `db.js:835` — `getSRSSettings()` — mapeia explicitamente `newPerDay: Number(map.new_per_day ?? 20)`. A meta diária escolhida no onboarding chega de verdade à cota de cards novos da sessão de estudo. Registrado para não deixar a auditoria parecer que toda hipótese vira bug — esta não virou.

### 4k.3 🟢 `app.js` — um sistema de guarda contra renderização obsoleta que ninguém documentou

`renderRouteView()` usa **`Proxy`** para blindar cada render contra ser sobrescrito por um mais recente ([364-468](../dashboard/js/core/app.js:364)):

- cada navegação recebe uma `renderEpoch` monotônica;
- `createGuardedContainer()` envolve o container num `Proxy` que **intercepta todo método de mutação de DOM** (`append`, `innerHTML` via `set`, `insertAdjacentHTML`...) e lança `AbortError` se a renderização não for mais a atual;
- `createGuardedApp()` faz o mesmo para `navigate`, `showToast`, `onLeaveView` — uma view antiga não consegue navegar ou mostrar toast por engano;
- `onLeaveView(fn)` — o hook que `gameView.js` usa para fechar `AudioContext` ao trocar de rota (§4k.4).

Isso é o mesmo problema que o `subtitle-engine.js` resolve com `_navigationEpoch`/`AbortController` (§4d, várias seções) — **resolvido de novo, de forma mais rigorosa (via Proxy), no dashboard**. Duas soluções independentes para "não deixar código antigo escrever por cima do atual", em duas partes do projeto que não se citam. Mais um caso do padrão da §4f, só que em infraestrutura, não em feature.

### 4k.4 🟢 `gameView.js` — três minijogos, e o comentário mais honesto do projeto sobre si mesmo

Arquivo lido por inteiro. É o único que abertamente descreve sua própria história de bugs no cabeçalho: *"a auditoria de UX apontou que esta tela tinha uma paleta escura própria... parecia outro produto"*, e resolve cada um com precisão — `AudioContext` vazando ao sair pela nav bar (corrigido com `app.onLeaveView`), contador de combo que zerava a cada rodada porque vivia no closure errado (corrigido com `state` externo), token vazio no "Monte a Frase" quando a frase tinha espaço antes da pontuação (`"I like cats !"` → chip fantasma).

"Monte a Frase" **reaproveita a mecânica exata** do `renderBuilder()` do `studyView` — reuso real, não reinvenção. Registrado como contraponto à §4f: nem toda peça nova do projeto repete o que já existe; esta foi construída citando de propósito de onde veio.

### 4k.5 🟡 O editor do Cofre pode consertar a frase truncada da §3.2 — mas nada avisa o usuário que ela está quebrada

`libraryView.js` tem um editor completo (`openWordEditor`, [323-391](../dashboard/js/ui/libraryView.js:323)): tradução, frase de contexto, categoria, nível — sem tocar no histórico do FSRS. **É a ferramenta que resolveria manualmente o bug da §3.2** (context_sentence com `"..."`). Mas não há nenhum sinal visual na lista do Cofre indicando "esta frase está truncada" — o usuário só descobre abrindo o editor e lendo. A ferramenta de correção existe; o gatilho para usá-la não.

---

## 4l. Leitura em lote: fim do `subtitle-engine.js`, `readerView.js`, fim do `storiesView.js`, `web-reader.js`

`subtitle-engine.js` está **100% lido** — 4.314 linhas, terminado. Mais três arquivos integrais (887 linhas). Duas hipóteses antigas resolvidas, um bug atual (não histórico) encontrado.

### 4l.1 🟢 Resolvido: `cefrColorsEnabled` **é** respeitado — a hipótese da §4d.8 não vira bug

[_createWordSpan():3723](../content/subtitle-engine.js:3723) — o ponto que decide se uma palavra ganha classe CEFR:

```js
if (this.cefrColorsEnabled && !wordStatus && this.cefrList) {
  const level = this.cefrList[text.toLowerCase()];
  if (level && ...) cefrClass = ' lf-cefr-' + level;
}
```

Testa a **flag**, não só a presença do objeto. A §4d.8 apontou que `_updateSubtitleColors()` seta as variáveis CSS `--cefr-*` mesmo com a flag desligada — verdade, mas **inofensivo**: sem a flag, nenhuma palavra recebe a classe `.lf-cefr-*`, então a variável CSS não tem em quem pegar. **Fechado como não-bug.**

### 4l.2 🟡 O conserto de apóstrofo existe — mas só no lugar que não precisa dele

Achado que refina a §4j.1. `_makeClickable():3639-3644` normaliza entidades **antes de desenhar a legenda na tela**:

```js
const normalized = text.replace(/&#39;/g, "'").replace(/&apos;/g, "'")
  .replace(/’/g, "'").replace(/‘/g, "'");
```

Isso deixa a legenda visível correta. **Mas essa normalização não alimenta `cue.text`** — é recalculada a cada render, só para construir os spans clicáveis. O texto que vira `context_sentence` no card sai de `_cleanSubtitleText()` (§4j.1), que **não** tem esse tratamento. Resultado: quem olha só a tela vê `don't` certo; o card salvo pode guardar `don&#39;t`. É um conserto que existe, no lugar errado da cadeia — o tipo de coisa que faz alguém auditando por amostragem (ver a legenda funcionar) concluir "está tratado" quando não está.

### 4l.3 🟢 A régua de 4 estágios estilo LingQ existe pela **quarta** vez — corrige a contagem da §4i.2

`readerView.js` (Modo Leitor, texto colado/EPUB/URL) usa o **mesmo gradiente de 4 estágios** que a legenda, agora por **família de lemma** (`utils/lemma.js` — `run/running/ran` contam como uma palavra):

```
knownLemmas / reviewLemmas / learningLemmas → rw-known / rw-review / rw-learning / rw-new
```

**Correção da §4i.2:** eu tinha contado 3 implementações do gradiente LingQ (legenda, Histórias, popup). **São 4** — faltava o Leitor. E é aqui, não em outro lugar, que fica **o único chamador de `markAsKnown()`** que a §4b.1 identificou lá atrás — confirmado de novo, agora lendo o arquivo inteiro: `rdp-known` → `lfDb.markAsKnown(w, 'en')` ([readerView.js:379](../dashboard/js/ui/readerView.js:379)).

### 4l.4 🔴 Bug atual, não histórico: o toast de sucesso do popup das Histórias mostra `âœ…` em vez de `✅` — ✅ CORRIGIDO (17/07, Fase 1)

[storiesView.js:982](../dashboard/js/ui/storiesView.js:982), texto literal no código-fonte:

```js
app.showToast('Expressão salva no Cofre! âœ…', 'success');
```

`âœ…` é o mojibake clássico de UTF-8 mal decodificado — **não é comentário sobre um bug passado, é o bug rodando agora**, toda vez que alguém salva uma palavra clicando numa história. Diferente de todos os outros achados desta seção (que são comentários documentando conserto), este emoji quebrado está ativo na tela do usuário hoje.

### 4l.5 🟢 Confirmado por leitura: `#lf-reveal-context` é código morto real, não falso positivo do script

A §4h.3 apontou (por varredura) que `#lf-reveal-context`/`#lf-context-trans` são lidos e nunca criados em `storiesView.js`. Lendo o trecho: [937-946](../dashboard/js/ui/storiesView.js:937) tem um **segundo** handler para "revelar tradução da frase", anexado por `getElementById`, logo depois de um **primeiro** handler funcional que já faz a mesma coisa com um botão criado via `document.createElement` sem id ([920-935](../dashboard/js/ui/storiesView.js:920)). É a versão antiga da feature, substituída por uma nova que não usa mais ids fixos — a chamada velha ficou, protegida pelo `?.` para não quebrar. Confirma a varredura ponto a ponto.

### 4l.6 🟢 `web-reader.js` — uma quarta superfície de leitura, e ela não duplica nada

Arquivo completo. Roda em **qualquer site**, exceto os domínios de vídeo e o próprio LinguaFlow (barreira dupla: `manifest.json` exclui + `utils/site-boundary.js` confirma em runtime — **`site-boundary.js` estava na lista de "nunca aberto"; confirmado aqui como vivo e usado**). Duplo-clique ou seleção de texto → popup com tradução (offline dict primeiro, Google Translate GTX como fallback) → `QUEUE_WORD_SAVE`, a mesma fila local-first do popup de vídeo (§4b.4).

**Isto fecha o mapa de superfícies de captura do projeto: são quatro, não uma.** Legenda de vídeo (`subtitle-engine`), Leitor do dashboard (texto colado/EPUB/URL), Histórias (texto gerado por IA), e **qualquer página da internet** (`web-reader.js`). As quatro alimentam a mesma tabela `words`, e nenhuma reinventa a lógica de salvar — todas passam pelo mesmo `QUEUE_WORD_SAVE` ou `db.saveWord`. Ao contrário do padrão da §4f (a mesma ideia construída 3-4 vezes em paralelo), aqui é **uma ideia, quatro entradas, um caminho de saída** — a arquitetura certa. Vale como contraponto final: o projeto sabe reusar quando quer.

`utils/offline-dict.js` (58 linhas, estava em "nunca aberto") também confirmado vivo: é a primeira tentativa de tradução antes do Google Translate, aqui neste arquivo.

---

## 4m. `settingsView.js` — integral (1.118 linhas, a maior tela do dashboard)

### 4m.1 🟢 A §4b.7 está corrigida — o próprio código confirma, com data implícita

[settingsView.js:244-245](../dashboard/js/ui/settingsView.js:244), comentário no topo da função:

> *"TODAS as chaves aqui são as MESMAS que o motor lê em `getSRSSettings()`. (Bug da auditoria: a tela salvava `lf_srs_*` e o motor lia outras chaves — o usuário mexia, via 'Salvo ✅' e nada mudava.)"*

Isso é exatamente o bug que a §4b.7 flagrou no banco de produção (linhas órfãs `lf_srs_ease`, `lf_srs_min_interval`, `lf_srs_penalty`, `lf_srs_suspend`, da era SM-2). **A tela atual já está corrigida** — grava `graduating_interval`, `max_interval`, `learning_steps` etc., as mesmas chaves que `db.js:getSRSSettings()` lê. As linhas órfãs no banco são resíduo de antes do conserto, não um bug ativo. Fecha a §4b.7 como histórico, não corrente.

### 4m.2 🟢 Existe um backup real e completo — resolve a leitura isolada da §4j.7

`btn-backup-json`/`btn-restore-json` ([839-961](../dashboard/js/ui/settingsView.js:839)): exporta `words`, `cards`, `review_log` (3.650 dias) e `user_stats` para um `.json` baixável, com versão e timestamp. A restauração é sofisticada — re-salva palavras por upsert, depois **casa o card antigo com a palavra nova pelo texto** (`word|lang`) e restaura o estado FSRS completo (status, interval, ease, lapses, stability, difficulty, due_date...) via `restoreCardState`. Explica textualmente por que `review_log` não é restaurado (ids de card mudam entre contas).

**Isto não é o `lf_auto_backup` do service worker (§4j.7).** São dois mecanismos diferentes: o do SW é silencioso, só-extensão, escreve em `chrome.storage.local` e nunca é lido por ninguém — genuinamente morto. **Este aqui funciona, é visível, tem UI de progresso e cobre até o estado do FSRS.** A §4j.7 continua válida (o backup silencioso é fantasma), mas não deve ser lida como "o projeto não tem backup" — tem, e é bom. Só tem dois, e um deles não serve pra nada.

### 4m.3 🟢 Mais três capacidades que nenhum documento do projeto menciona

- **Voz neural offline (Kokoro)** ([963-1005](../dashboard/js/ui/settingsView.js:963)): baixa um modelo de ~90MB no navegador, funciona sem internet depois, com barra de progresso real via evento customizado `lf_kokoro_progress` que `utils/tts.js` dispara. Só no site, não na extensão.
- **Web Push real** ([1007-1066](../dashboard/js/ui/settingsView.js:1007)): assinatura VAPID de verdade no push service do navegador, chave pública vinda do servidor (`getPushPublicKey`), opt-in explícito. Confirma que `supabase/functions/push-reminder` (ainda não lida) está genuinamente conectada ao frontend.
- **Resumo semanal por e-mail** ([1068-1095](../dashboard/js/ui/settingsView.js:1068)): opt-in, um RPC por troca (`setEmailOptIn`). Confirma que `supabase/functions/email-reengagement` (ainda não lida) também está conectada.
- **Perfis de SRS por categoria** ([657-725](../dashboard/js/ui/settingsView.js:657)): sobrescreve retenção/steps/graduação só para `idiom`/`slang`/`phrasal`, com fallback pro valor global — paridade real com presets de baralho do Anki.

Nenhuma dessas quatro coisas apareceu em nenhum plano, PRD ou handoff lido até agora. É a mesma assinatura do resto da auditoria: a distância entre o que o LinguaFlow **faz** e o que qualquer documento **diz que ele faz** continua sendo o maior problema do projeto.

---

## 4n. `dashboard/js/ui/leaguesView.js` — integral (255 linhas), a única view do dashboard que faltava

### 4n.1 🔴 Bug real: para ligas com 6 a 9 membros, quem está no top 5 aparece rotulado como "Zona de Rebaixamento"

[199-214](../dashboard/js/ui/leaguesView.js:199): a lista é renderizada com dois "cortes" de HTML injetados no meio do `.map()`, para dividir visualmente o mesmo `<div class="leaderboard">` em três segmentos (promoção / neutro / rebaixamento) sem fechar e reabrir a div externa do template:

```js
let borderHtml = '';
if (index === 4) borderHtml = '</div><div class="leaderboard" ...>';                          // fim do top 5
if (index === allEntries.length - 6) borderHtml = '</div><div class="demotion-zone">Zona de Rebaixamento</div><div class="leaderboard" ...>'; // início do bottom 5
```

Os dois `if` são independentes, e o **segundo sobrescreve o primeiro** quando os índices coincidem. O corte de promoção é sempre no índice 4 (fixo); o de rebaixamento depende do tamanho da lista (`N - 6`). Rastreei à mão para `N` de 6 a 11:

| N (total de membros) | Onde o corte de rebaixamento cai | Efeito |
|---:|---|---|
| 6 | logo após o **rank 1** | ranks 2, 3, 4, 5 (todo o top 5 exceto o 1º) aparecem sob "Zona de Rebaixamento" |
| 7 | após o rank 2 | ranks 3, 4, 5 sob "Zona de Rebaixamento" |
| 8 | após o rank 3 | ranks 4, 5 sob "Zona de Rebaixamento" |
| 9 | após o rank 4 | só o **rank 5** sob "Zona de Rebaixamento" |
| 10 | coincide com o corte de promoção (`4 = 10-6`) — o `if` do rebaixamento sobrescreve o da promoção | **correto por coincidência**: label de rebaixamento cai exatamente entre rank 5 e rank 6 |
| ≥ 11 | `N-6 > 4`, os dois cortes ficam na ordem certa | **correto** |

**Para `N` entre 6 e 9, alguém que está no top 5 — a quem o próprio cabeçalho da tela diz "Top 5 avançam para a próxima liga" — vê seu nome listado visualmente sob "Zona de Rebaixamento".** Pior em ligas pequenas: com 6 membros, é 4 das 5 pessoas promovidas que veem o rótulo errado.

**Impacto hoje: dormente.** `getLeaderboard()` só traz usuários reais (o comentário no código confirma que os "bots fantasmas" foram removidos de propósito — [36-37](../dashboard/js/ui/leaguesView.js:36)), e o banco de produção tem 3 contas ao todo (§4). Nenhuma liga real chega perto de 6 membros hoje. **Mas é um bug de lógica genuíno, não hipotético** — ele dispara sozinho assim que qualquer liga crescer para 6-9 participantes semanais, e ninguém vai precisar mudar uma linha de código para acioná-lo.

### 4n.2 🟢 O resto do arquivo está limpo — rollover real, sem dados falsos, countdown correto

- `maybeLeagueRollover()` é a rede de segurança lazy de um `pg_cron` que roda toda segunda 00:05 UTC — idempotente, comentário explica que substituiu um botão antigo de "Simular Fim da Semana" (removido).
- Sem bots fantasmas: só usuários reais no ranking, decisão registrada no comentário como escolha deliberada de honestidade.
- Countdown até a próxima segunda usa `Date.UTC` corretamente, sem risco de fuso horário.

---

## 4o. Reconciliação contra `origin/main` (17/07) — o que sobrevive, o que já foi corrigido

Depois do PR trazer esta auditoria para cima de `main`, comparei os achados de maior risco contra o código real de produção (`git diff 13212d3 origin/main -- <arquivo>` + grep dirigido no checkout). **Resultado: a maioria sobrevive intacta, e dois problemas sérios já foram corrigidos — bem — antes mesmo de eu terminar de escrever sobre eles.**

### 4o.1 🟢 A extensão inteira está fora da lista de arquivos que mudaram

`git diff --stat 13212d3 origin/main` não lista **nenhum** arquivo de `content/*`, `background/service-worker.js`, nem a maior parte de `utils/*` (inclusive os 4 órfãos confirmados pela varredura de fiação). **Isso valida sem reconferir**: §2, §3 (exceto §3.7, ver 4o.3), §4b, §4c, §4d inteira, §4e inteira, §4g.1 (o achado principal — confirmado byte a byte, ver 4o.2), §4h inteira, §4j inteira. É a maior parte do documento.

### 4o.2 🟢 O achado principal (W4/shadowing órfã) sobrevive palavra por palavra

`playCurrentAudio()` em `studyView.js` — mesmo com o arquivo tendo mudado 274 linhas no total — está **idêntico** ao trecho citado na §4g.1: o overlay "Sua vez... Fale em voz alta!" ainda só conta 3 segundos, `pronunciationLab` continua com **zero importadores** em todo o `main`. A distância entre o LinguaFlow que existe e o prometido continua sendo, literalmente, um `import`.

### 4o.3 🟢🟢 A §3.7 (XP duplo) não só foi corrigida — foi corrigida na raiz, no banco

Esta é a melhor notícia da reconciliação. Duas migrations novas (`20260716124439_expand_safe_leaderboard_p0_3.sql`, `..._contract_user_stats_and_legacy_xp_p0_3.sql`) fecham o problema que a §3.7 e a §4d.6 apontaram — não com um ajuste no cliente, mas **revogando a permissão no Postgres**:

```sql
-- Eventos declarados pelo navegador não são evidência competitiva.
REVOKE ALL ON FUNCTION public.record_learning_event(text, integer)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.claim_weekly_quest(integer)
  FROM PUBLIC, anon, authenticated, service_role;
```

`db.recordEvent()` — a função que eu chamei de "caminho legado" — **não existe mais em `utils/db.js`**, e `grep -rn ".recordEvent(" --include=*.js .` não bate em lugar nenhum do repo. Não é código morto que sobrou: a RPC que ele chamava está **revogada de todos os papéis**, inclusive `service_role`. Ninguém consegue reintroduzir esse caminho por acidente.

Fecha também a §4d.6 (o XP passivo por assistir vídeo): `logSession()` em `main` não credita mais XP nenhum por tempo assistido — o bloco de `blocksCrossed`/`recordEvent('video_session', ...)` foi deletado, substituído pelo comentário: *"Tempo assistido continua sendo métrica de atividade. Ele não concede XP: duração enviada pelo cliente não é evidência competitiva verificável."*

**Bônus que eu não tinha encontrado:** a migration também fecha uma policy de RLS que deixava `user_stats` legível por **qualquer usuário autenticado** (`"Anyone can read user_stats"`) — trocada por leitura restrita à própria linha, com o placar coletivo passando exclusivamente pela nova `rpc/get_leaderboard` (SECURITY DEFINER, projeção mínima: username, avatar, xp da semana, sem nenhum outro dado da conta). Isso não estava na minha auditoria — encontrei ao verificar o contexto da correção.

E a §4i.4 (a dúvida que registrei sobre `recordEvent` ser "legado" ou "real" no `storiesView`) está resolvida: `story_quiz`/`story_read` **não dão XP nenhum agora**, com o texto explícito na tela — *"Prática de compreensão — sem alterar XP, ofensiva ou liga."* — e — *"Leitura concluída. Esta marca não altera XP, ofensiva ou liga."* Meu instinto de não decidir sem ler estava certo: a resposta não era "legado vs. real", era "vai deixar de dar XP".

### 4o.4 🟢 Confirmados válidos em `main`, sem alteração relevante

- **§4n.1** (bug da Zona de Rebaixamento) — confirmado removido, como já provado antes do PR.
- **§4h.3 / §4g.8** (`#app-view` assimétrico) — `renderWaitingScreen` em `studyView.js` continua com `studyContainer || document.body`, sem o fallback de três níveis que `renderSessionComplete` tem. Bug ainda vivo.
- **§4k.1** (guard `hasGoodVideoContext` duplicado) — continua em exatamente 2 lugares (`service-worker.js` inalterado, `libraryView.js:296`). Ainda vulnerável ao bug de truncamento da §3.2.
- **§4i.1** (reencontro narrativo) — `getReencounterWords()` intacta em `storiesView.js`.
- **§4l.4** (mojibake `âœ…`) — **ainda ativo**, linha 989 de `storiesView.js` em `main`. Não foi corrigido.
- **§4l.5** (`lf-reveal-context` código morto) — ainda lá, linhas 946-950.
- **§4m.1** (comentário confirmando o fix da §4b.7) — ainda no código.
- **§4m.2** (backup/restore real) — `btn-backup-json`/`btn-restore-json` intactos.
- **§4i.2/§4l.3** (gradiente LingQ 4×) — sobrevive, com uma nuance: o título do selo `story-known-badge` ganhou uma ressalva nova — *"Estimativa que combina termos marcados por você e itens com memória estável; não mede compreensão."* — sinal de que alguém já vinha suavizando a mesma preocupação que a auditoria levantaria.

### 4o.5 🟡 Ainda não reconferidos em detalhe (mudaram, mas não abri o diff completo)

`app.js` (126 linhas, §4k.3 — o Proxy de renderização), `gameView.js` (190 linhas, §4k.4), `homeView.js` (176 linhas, §4k), `readerView.js` (83 linhas, §4b.1/§4l.3 além do já confirmado por grep). Nenhum indício de que estejam quebrados — o padrão desta reconciliação é "sobrevive ou foi corrigido para melhor" — mas não têm o mesmo nível de verificação dos demais.

### 4o.6 ❌ Nunca auditados, nem na branch velha nem em `main`

`statsView.js`, `loginView.js`, e quatro views **inteiras** que só existem em `main`: `learnView.js`, `progressView.js`, `readingHub.js`, `viewState.js` (~158 linhas somadas, conteúdo desconhecido). Dado o padrão da sessão — toda view nova revelou algo —, estas são a fronteira real da cobertura agora, não os ~20% que faltavam ler na cópia velha.

---

## 4p. Seis arquivos novos (§4o.6, resolvidos) + os dois motores de TTS — integrais, contra `main`

### 4p.1 🟢 As 4 views novas + `statsView.js` + `loginView.js`: zero achados — primeira vez na sessão

`learnView.js`, `progressView.js`, `readingHub.js`, `viewState.js`, `statsView.js`, `loginView.js` — 503 linhas, todas lidas por inteiro. **Nenhum bug, nenhuma reinvenção, nenhuma desconexão.** É o oposto do padrão que motivou a §4f: um refactor de produto real e coerente.

- `learnView.js`/`progressView.js` são hubs finos (menu, não motor) que agrupam rotas existentes — "Aprender" (histórias/leitor/jogo) e "Progresso" (estatísticas como primário, liga como opcional). Corresponde ao commit `feat: separate practice progress and competition`.
- `readingHub.js` é um cabeçalho compartilhado entre Histórias e Leitor — **verificado como realmente importado pelos dois** (`storiesView.js`, `readerView.js`), não órfão.
- `viewState.js` — componente de loading/vazio/erro com a11y de verdade (`role`, `aria-live` por tipo, `escapeHtml`) — **importado em 8 arquivos**, praticamente todo o dashboard (`app.js`, `gameView.js`, `homeView.js`, `libraryView.js`, `readerView.js`, `settingsView.js`, `statsView.js`, `storiesView.js`). É o contra-exemplo mais forte da §4f: quando o time decidiu compartilhar um componente, ele *foi* compartilhado, de verdade, quase universalmente.
- `statsView.js` mantém a mesma disciplina de linguagem das outras telas revistas: *"Tempo e volume mostram atividade — não comprovam domínio do idioma."* — o mesmo texto-espírito que já apareceu em `leaguesView.js` e `storiesView.js` (§4o.4). Não é coincidência — é uma reescrita de linguagem de produto aplicada consistentemente (commit `feat: standardize product language and view states`).
- `app.js` já tem `learn`/`progress` no mapa de rotas — roteamento novo integrado corretamente, confirmado por leitura direta (fecha uma ponta da §4o.5).

### 4p.2 🔴 Código morto real, agora num método privado: `_playWebSpeech()` em `utils/tts.js` — ✅ EXECUTADO (17/07, Fase 4: religado como último recurso, com token do ExclusivePlayback; a função tinha zero chamadores)

`utils/tts.js` (o motor de TTS da **extensão** — diferente de `dashboard/js/core/tts.js`, o do site) tem um método de 118 linhas **inteiramente inatingível**:

```js
async _playWebSpeech(text, lang, rate = 1.0) {
    return false;
    if (this.voices.length === 0) { ... // 118 linhas nunca executadas
```

Confirmado **duplamente morto**: `grep -n "_playWebSpeech" utils/tts.js` só bate na própria definição — nenhum chamador em lugar nenhum, nem dentro da própria classe. O comentário em `.play()` explica a intenção: *"Prioridade 3 removida: Sem fallback para voz robótica (Web Speech API)."* Alguém desligou o fallback com um `return false` no topo em vez de apagar o método — o mesmo padrão dos stubs vazios do `subtitle-engine.js` (§4d.12), agora com um algoritmo de seleção de voz elaborado (lista de vozes preferidas, filtro anti-robótico) apodrecendo sem nunca rodar.

**Isso é mais do que estética: cria uma assimetria de confiabilidade real entre extensão e site.** `dashboard/js/core/tts.js` (site) mantém `_fallbackTTS()` para Web Speech como último recurso — se o Google TTS falhar, ainda sai *algum* áudio, mesmo robótico. `utils/tts.js` (extensão) **não tem mais esse último recurso**: se o Google TTS falhar na extensão, o áudio simplesmente não toca — silêncio, sem fallback nenhum. Mesma funcionalidade ("ouvir a palavra"), dois níveis de robustez diferentes, dependendo de onde o usuário está.

### 4p.3 🟡 Dependência de terceiro não documentada: `api.allorigins.win`

[utils/tts.js:107](../utils/tts.js:107) — quando não é extensão e a URL do Google TTS ainda não está em cache, o código usa um proxy CORS gratuito de terceiro (`api.allorigins.win`) para buscar o áudio. Única ocorrência no projeto inteiro. Não é crítico (é um último recurso atrás de outros caminhos), mas é uma dependência externa e não documentada — se o serviço cair ou limitar taxa, a reprodução de áudio nesse caminho específico degrada sem aviso.

---

## 4h. Auditoria de fiação — o método que a §4f implica

**A §4f diz que o problema é fiação: partes boas que não se conhecem. Fiação é um grafo. Grafo se calcula.** Em vez de ler 15.000 linhas procurando desconexão, dá para prová-la mecanicamente.

**Isto não viola a regra 1.** A regra proíbe *grep + conclusão sobre comportamento*. Aqui não se conclui nada sobre o que o código faz: prova-se **ausência de ligação** — símbolo exportado sem importador, id lido sem criador, evento escutado sem emissor. É a mesma prova que derrubou `lf-video-words` (§4d.10), `pronunciationLab` (§4g.1) e `LF_WORD_KNOWN` (§4b.1) — só que como varredura, não como sorte.

Script: `scratchpad/wiring-audit.js`. Roda em ~8 segundos sobre os 46 arquivos.

### 4h.1 🔴 Quatro módulos órfãos — 453 linhas que não rodam

**Cada um verificado individualmente** (busca pelo nome do arquivo em todo o repo, `.js`/`.html`/`.json`), porque o script sozinho não é confiável (§4h.5):

| Módulo | Linhas | Referências ao nome do arquivo |
|---|---:|---|
| `utils/pronunciation.js` | 148 | **zero** — o `SpeechRecognition` do §4g.1 |
| `utils/subtitle-parsers.js` | 132 | **zero** |
| `content/engine/subtitle-fetcher.js` | 111 | **zero** |
| `content/engine/video-adapter.js` | 62 | **zero** |

### 4h.2 🔴 `content/engine/` inteiro está morto — e o handoff do Codex o trata como sagrado

Os dois arquivos de `content/engine/` (173 linhas) não são importados por ninguém. A cadeia real é `manifest` → `boot.js` → `index.js` → `subtitle-engine.js`. **`content/engine/` não participa.**

E o `HANDOFF.md` (Codex, 15/07) diz:

> *"`content/subtitle-engine.js` e `content/engine/*` não foram modificados. Captura, parsing, cues, sincronização, tradução e mecânica permanecem exatamente como no original."*

O escopo foi preservado com cuidado **num diretório que não roda**. E o `subtitle-fetcher.js` duplica `_cleanSubtitleText` e o processamento de cues do `subtitle-engine.js` — é uma refatoração começada e abandonada, que ficou parecendo o motor. Some-se ao §4d.11 (a "cópia EXATA do V5" trazida sem poda): **o projeto tem pelo menos duas gerações de motor de legenda coabitando, e a morta é a que o handoff protege.**

### 4h.3 🔴 Quinze ids lidos e nunca criados — e um confirma o §4g.8

Dos 15, três são falso positivo (§4h.5). Os reais, por arquivo:

- **`subtitle-engine.js` (9):** `#lf-deck-host`, `#lf-btn-loop`, `#lf-btn-panel`, `#lf-video-words`, `#lf-save-btn`, `#lf-hbo-switch`, `#lf-float-btn`, `#lf-float-panel-btn`, `#lf-nav-controls`. É o rastro dos stubs vazios do §4d.12 — o botão flutuante, os controles de navegação e o seletor de decks foram removidos, e o código que fala com eles ficou.
- **`content/settings-panel.js`: `#sel-blur`** — o painel de configurações lê um seletor de *blur* que não existe. Arquivo ainda não lido (907 linhas); entra na fila com uma pista concreta.
- **`storiesView.js`: `#lf-reveal-context` e `#lf-context-trans`** — uma feature de revelar contexto/tradução nas Histórias, lendo dois elementos que ninguém cria. Arquivo não lido (1.064 linhas).
- **`studyView.js`: `#app-view`** — **confirma o §4g.8 de hipótese para fato.** O comentário na [studyView.js:489](../dashboard/js/ui/studyView.js:489) diz que o bug antigo era escrever em `#app-view`, "que não existe". **Ele realmente não existe.** Logo, em `renderSessionComplete`, a cadeia `studyContainer || getElementById('app-view') || document.body` cai direto no `<body>` se `studyContainer` for null — e `renderWaitingScreen` ([528](../dashboard/js/ui/studyView.js:528)) **nem tem o degrau do meio**: é `studyContainer || document.body`. O bug que o comentário diz ter matado continua alcançável nos dois caminhos.

### 4h.4 🟢 `LF_WORD_KNOWN` confirmado por varredura

O §4b.1 afirmou, por leitura, que ninguém dispara `LF_WORD_KNOWN`. A varredura confirma: **é o único evento `LF_*`/`lf_*` escutado e nunca emitido em todo o projeto.** Um listener órfão, exatamente um.

### 4h.5 ⚠️ Os limites do método — três falsos positivos encontrados, e por quê

**Registrar isto é obrigatório, senão o script vira a próxima fonte de afirmação não verificada.** O script errou em três lugares, e eu só descobri porque conferi um a um:

1. **`utils/phrasal-verbs.js` — acusado de órfão, é importado 4×.** O `word-popup.js` faz `import(BASE + 'phrasal-verbs.js')` — **concatenação**, que o regex de import literal não pega. *(Ficou o alerta: qualquer módulo carregado por caminho montado em runtime é invisível para a varredura. Foi por isso que revalidei os 4 restantes buscando o nome do arquivo como string solta — aí `phrasal-verbs` apareceu e `pronunciation` não.)*
2. **`LF_HBO_SUB`, `LF_SUBTITLE_HOOK`, `LF_PLAYER_STATE`, `LF_YT_SUB_TOGGLE` — acusados de "emitidos e nunca escutados", são todos escutados.** Chegam por `postMessage` e são tratados dentro de um `window.addEventListener('message', ...)` que testa `e.data.type` ([subtitle-engine.js:439-500](../content/subtitle-engine.js:439)). O script procura o nome do evento no `addEventListener`, e nunca vai achar. **A seção "emitidos e nunca escutados" do script é inútil para `postMessage` e deve ser ignorada.**
3. **`#movie_player`** — é o player do YouTube, criado pelo YouTube. O script só conhece ids criados pelo nosso código; DOM de terceiro sempre aparece como "morto".

**Conclusão de método:** a varredura **aponta**, não conclui. Todo achado dela precisa de uma verificação dirigida (uma busca pelo nome como string, ou a leitura do trecho). O que ela dá é enorme mesmo assim: em 8 segundos ela apontou 4 módulos órfãos, 12 ids mortos e confirmou o §4g.8 — trabalho que me custou horas de leitura para os 3 primeiros casos.

---

## 4f. A hipótese central — CONFIRMADA, e a causa não é a que eu supus

A sessão anterior suspeitou: *"o problema não é falta de feature nem de motor; é que ninguém sabe o que o app já faz"*. A leitura de ~2.400 linhas do engine + os 364 do `review-overlay`/`index` **confirma**, e acrescenta um mecanismo que a suspeita não tinha.

**O placar de features que eu propus construir e que já existiam subiu para quatro** — em 31% do código lido:

| Onda que eu propus | Onde já estava |
|---|---|
| W3 — reencontro na legenda | `_updateSubtitleColors()` — gradiente de 6 níveis por estado FSRS (§4c) |
| W6.2 — "você conhece 94% deste episódio" | `renderStats()` — score ponderado por token, com rótulo Fluente/Alta/Intermediário/Desafio (§4d.1) |
| Revisão rápida sem sair do vídeo | `ReviewOverlay` — tecla `R`, 289 linhas, o melhor código do projeto (§4e.1) |
| **W4 — shadowing com gravação de voz** | **As 4 peças existem.** Overlay "Fale em voz alta!" + `pronunciationLab` com `SpeechRecognition`/`getUserMedia` — **e zero importadores** (§4g.1) |
| **W3 outra vez — "reencontro"** | `getReencounterWords()` — a IA escreve uma **história sob medida** para reencontrar suas palavras leech/fracas, dirigida pelo FSRS (§4i.1) |

**A taxa não caiu: 5 achados em ~9.400 linhas (1 a cada ~1.900).** O 4º veio nas primeiras 560 linhas do primeiro arquivo do dashboard; o 5º, nas primeiras 40 do segundo.

**E o placar por conceito é pior que o placar por onda:**

| Conceito que eu propus como novo | Vezes que já está implementado |
|---|---:|
| Gradiente de exposição estilo LingQ | **3** — legenda (§4c), Histórias (§4i.2), popup |
| "% deste conteúdo que você conhece" | **3** — `renderStats` (§4d.1), selo das Histórias (§4i.2), popup (§2.2) |
| Reencontro dirigido pela memória | **2** — legenda ao vivo (§4c), história gerada (§4i.1) |

Não há sinal de saturação. Há sinal de que **o projeto implementou as mesmas boas ideias três vezes, em três lugares, sem que ninguém soubesse das outras duas** — o que é a §4f (partes que não se conhecem) na camada de produto, não na de código.

**Mas "ninguém sabe" é sintoma, não causa.** A leitura mostra a causa, e ela é mecânica:

> **As features estão invisíveis porque estão quebradas na superfície, e estão quebradas porque foram construídas isoladas umas das outras.**

**O caso mais limpo é o §4g.1:** o app mostra "Sua vez... Fale em voz alta!", conta 3 segundos e desiste — enquanto `utils/pronunciation.js`, com `SpeechRecognition` e `getUserMedia` escritos e prontos, não é importado por ninguém. **A distância entre o LinguaFlow que existe e o LinguaFlow prometido é, literalmente, um `import`.**

Nenhum dos bugs de superfície é de lógica difícil. Todos nascem de **duas partes boas que não se conhecem**:

- `C`/`O` disparam 2× — `_setupKeyboardShortcuts` e `_injectYouTubeControls` registram as mesmas teclas sem saber um do outro (§4d.4).
- `1`-`4` saltam o vídeo — o `ReviewOverlay` não sabe que roda dentro do YouTube (§4e.2).
- `Espaço` faz duas coisas — engine e overlay não sabem um do outro (§4e.3).
- Arrastar a legenda nunca funciona — `init()` e `_waitForVideo()` chamam `_injectSubtitleUI()` sem saber um do outro (§4d.5).
- Abrir o painel apaga cores da legenda — `_loadSavedWords()` e `_createSubtitlePanel()` mantêm o mesmo mapa a partir de fontes diferentes (§4d.3).
- `_renderVideoWordPrep()` roda 80 linhas para nada — a feature não sabe que seu container foi deletado (§4d.10).
- A régua diz "top-5k" com 835 palavras — o rótulo não sabe o que a lista é (§4d.2).

**Isso reordena o entregável.** "Inventariar e revelar o que já existe" (a conclusão anterior) é necessário mas **insuficiente**: revelar a tecla `R` hoje entrega ao usuário uma feature que salta o vídeo dele. Documentar o centro de comando hoje documenta três teclas que colidem.

A ordem correta passa a ser:

1. **Consertar a superfície** dos 3 recursos que já existem e estão a uma linha de funcionar (§4e.2 `preventDefault`, §4d.4 guard de teclado, §4d.5 closure do drag). Custo: horas.
2. **Só então inventariar e revelar** — aí a revelação entrega algo que funciona.
3. **Depois** reescrever o plano de ondas, com a W3, a W6.2 e a revisão-no-vídeo riscadas da lista de "construir" e movidas para "consertar e mostrar".

**O LinguaFlow não precisa de features novas. Precisa de integração e de um `preventDefault`.**

---

## 4q. Fase 6 — leitura dos arquivos de borda (17/07, sessão de execução)

**Lidos integralmente nesta leva:** `utils/translator.js` (170) · `popup/popup.js` (112) · `content/youtube-hook.js` (111) · `dashboard/sw.js` (123) · `dashboard/js/core/ytPlayer.js` (252) · `dashboard/js/core/epub.js` (104) · `content/max-player-ui.js` (229) · Edge Functions `tts` (107), `push-reminder` (78), `email-reengagement` (86), `url-import` (304). Também relidas (duplicando §4-anteriores da sessão paralela, por segurança): as 6 views novas de `main` + `statsView`/`loginView`.

### 4q.1 🟢 Veredito geral: este canto do código é BOM

Nenhum bug funcional encontrado em ~1.700 linhas. Destaques de qualidade real:
- `ytPlayer.js`: máquina de estados exemplar (requestId + playbackCycle + boundaryHandled; callbacks velhos não cancelam monitores novos).
- `url-import`: proteção SSRF séria — resolve A/AAAA por conta própria, expande IPv6 (inclusive IPv4-mapped), valida CADA hop de redirect, e documenta com honestidade o risco residual de DNS rebinding.
- `push-reminder`/`email-reengagement`: comparação de segredo em tempo constante, throttle por assinatura (20h) e por semana, limpeza de subscriptions mortas (404/410), degradação graciosa sem provedor.
- `dashboard/sw.js`: network-first para código com o incidente real documentado no comentário (JS velho + HTML novo → INSERT direto 403).
- `translator.js`: dedupe de requests em voo, cache em 2 níveis + dicionário offline, timeouts com AbortController.

### 4q.2 🟡 O e-mail de reengajamento aponta para um domínio possivelmente inexistente

[email-reengagement/index.ts](../supabase/functions/email-reengagement/index.ts): o botão "Estudar agora" leva a `https://linguaflow.vercel.app/study`. O site oficial é `https://linguaflow-web-tau.vercel.app/` (`utils/site-boundary.js:1`). O alias `linguaflow.vercel.app` está na lista de hosts reconhecidos do site-boundary, mas **não há prova de que o alias exista no projeto Vercel** — se não existir, todo e-mail enviado terá um botão 404. **Verificação de 1 clique do dono:** abrir `https://linguaflow.vercel.app/`. Se não resolver, trocar a URL do e-mail para a oficial.

### 4q.3 🟢 Notas menores (não-bugs, registrar e seguir)

- `epub.js` carrega `fflate` de CDN (jsdelivr) em runtime — única dependência externa de script do dashboard; falha graciosa com mensagem. Aceitável; lembrar se um dia houver CSP estrita no site.
- `max-player-ui.js`: limpo e acessível (toolbar com aria, reduced-motion). O dock vertical à direita segue existindo — trocá-lo por controles que acompanham os nativos é DECISÃO DE PRODUTO (era a W11 do plano suspenso), não bug.
- `youtube-hook.js` intercepta fetch+XHR no main world com padrões amplos (`.vtt`, `subtitles`) — funciona; sem vazamento aparente (posta só para a própria janela).
- Edge `tts`: mesmo padrão de segurança do deepseek-chat (JWT real + 60/min + teto de 300 chars).

### 4q.4 Estado da Fase 6 após esta leva

- ✅ Item "ler pela primeira vez" do CHECKLIST: **completo**.
- ⏳ Falta: reconferir `app.js`/`gameView.js`/`homeView.js`/`readerView.js` linha a linha contra `main` (§4o.5) e o rabo de CSS do `studyView.js` (~610 linhas, baixo risco).
- ⏸️ `content/engine/*` órfãos: ler somente se a Fase 5 decidir manter.

## 5. O que fica de pé do diagnóstico anterior

**A tese central sobrevive e ficou mais precisa.** O `evidence` real contém `quality`, `card_before`, `card_after`, `_reward`, `dedupe_key`, `cap_used_before`.

E não contém: **modalidade, latência, ajuda.** Nada.

O app registra a transição contábil com precisão de banco e não registra uma linha sobre *como* o aluno foi testado. O sistema nervoso existe — está cabeado para a contabilidade, não para a pedagogia. `record_card_review(p_card_id, p_quality, p_state, p_client_review_id)` não tem por onde receber isso.

**`words.explanation` = 0 de 20** também sobrevive: a IA escreve a explicação no momento da captura ([word-popup.js:1359](../content/word-popup.js:1359)), a tela mostra, e ninguém salva. A coluna existe.
