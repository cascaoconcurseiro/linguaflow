# LinguaFlow — Relatório de Melhorias (revisão da equipe, 2026-07-08)

Objetivo: reunir o melhor de **Anki + LingQ + Duolingo + Language Reactor**, estudável em qualquer lugar, mantendo a stack 100% gratuita (Vercel + GitHub + Supabase).

---

## 1. Prioridade máxima — trocar o algoritmo SRS por FSRS (o "coração do Anki")

O agendador atual em `utils/db.js` (linhas ~500-660) é um SM-2 caseiro (ease_factor 2.5, graduating interval etc.) — o algoritmo que o próprio Anki **abandonou**. O Anki moderno usa **FSRS**, que reduz em ~20-30% a quantidade de revisões para a mesma retenção.

- **[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)** (open-spaced-repetition): TypeScript/JS puro, MIT, ESM/CommonJS/UMD, mantido ativamente, usado em produção por vários apps. Roda 100% client-side — zero custo de servidor.
- Migração viável: as colunas atuais (`interval`, `ease_factor`, `due_date`) podem coexistir com os campos FSRS (`stability`, `difficulty`) durante a transição; cartões existentes são convertíveis.
- Bônus: FSRS permite "retenção desejada" configurável (ex.: 90%) — vira um slider nas configurações, feature que nem o LingQ tem.

## 2. Vozes neurais gratuitas — recomendação técnica

Hoje: MP3 do dicionário → Google Translate TTS (endpoint gtx não-oficial) → sem fallback. Funciona, mas o gtx corta textos longos, não tem escolha de voz e pode quebrar sem aviso.

| Opção | Qualidade | Custo | Risco | Veredito |
|---|---|---|---|---|
| **[kokoro-js / Kokoro-82M](https://github.com/eduardolat/kokoro-web)** (roda no navegador via WebGPU/WASM, modelo ~82MB baixado 1x e cacheado em IndexedDB) | Supera Google WaveNet/Amazon Polly em testes cegos; Apache 2.0 | Zero (client-side) | Baixo — modelo é seu pra sempre | **RECOMENDADO** para dashboard/PWA e leitura de histórias/frases |
| **[edge-tts](https://github.com/rany2/edge-tts)** (vozes neurais do Microsoft Edge, ~200 vozes/50 línguas; port JS: [@edge-tts/universal](https://jsr.io/@edge-tts/universal), [andresayac/edge-tts](https://github.com/andresayac/edge-tts)) via função serverless na Vercel | Excelente | Zero | Médio — API não-oficial, Microsoft já quebrou em 2024 (header Sec-MS-Token); funcional em 2026 | Bom como **fallback server-side** para palavras curtas na extensão |
| Google gtx (atual) | Boa | Zero | Médio (não-oficial) | Manter como terceiro fallback |
| Web Speech API do Edge/Chrome | Variável (no Edge as vozes "Natural" são neurais de graça) | Zero | Baixo | Fallback final (hoje desativado no código) |

**Arquitetura sugerida (cadeia de fallback):** MP3 dicionário → Kokoro local (se WebGPU/WASM disponível) → edge-tts via Vercel function → gtx atual. Referências prontas: [HeadTTS](https://github.com/met4citizen/HeadTTS) (Kokoro no navegador com timestamps — útil para karaokê de legenda estilo Language Reactor) e [kokoro-web](https://github.com/eduardolat/kokoro-web) (API OpenAI-compatible self-hosted).

**Atenção:** Kokoro tem inglês excelente e português razoável; para a voz PT-BR das traduções, manter gtx/edge-tts.

## 3. Dashboard — gaps vs. os 4 apps de referência

### Do Anki (estudo sério)
- **FSRS** (item 1) — o maior gap.
- **Undo na revisão** — errou o botão, perdeu o card. Anki tem Ctrl+Z; guardar último estado do card em memória resolve.
- **Estatísticas de retenção reais**: retenção por dia/semana, previsão de carga futura ("amanhã: 37 cards"). Os dados já existem em `review_logs`.
- **Cartões reversos** (PT→EN além de EN→PT) — dobra o valor de cada palavra salva.

### Do LingQ (input compreensível)
- **Modo Leitor**: o storiesView é o embrião — falta importar QUALQUER texto (colar/URL/epub) com palavras clicáveis e status por cor (novo/aprendendo/conhecido). Inspiração open-source: [Learning with Texts](https://github.com/edoreld/learning-with-texts), [fluent-reader](https://github.com/nramos0/fluent-reader) (TS+Rust), [VocabSieve](https://github.com/FreeLanguageTools/vocabsieve) (sentence mining).
- **Contador de "palavras conhecidas"** como métrica central de progresso (o número que vicia no LingQ). A tabela `words` + `markAsKnown` já dão o dado.
- **Lemmatização**: "run/runs/running" deveriam contar como a mesma palavra — a lib [compromise](https://github.com/spencermountain/compromise) (NLP client-side, MIT) resolve para inglês.

### Do Duolingo (retenção/hábito)
- Já tem: XP, ligas, streak, heatmap. Faltam:
- **Meta diária configurável + lembrete** (notification API no PWA / chrome.notifications na extensão — `srs-reminder` já existe no SW, só não vira notificação visível).
- **Exercícios variados no estudo**: hoje é flashcard; adicionar "monte a frase" (as `ai_chunks` já dão o material), "complete a lacuna" (cloze das context_sentences), e "escute e escreva" (TTS já existe).
- **Streak freeze** — perdoa 1 dia perdido; barato de implementar e retém usuário.

### Do Language Reactor (vídeo)
- **Legenda dupla já existe.** Faltam: **auto-pause por frase** (já tem `sel-autopause`? confirmar wiring), **replay da última frase (tecla ←)**, **navegação frase-a-frase**, e **modo karaokê** (highlight palavra-a-palavra — o HeadTTS acima dá timestamps).
- **Exportar frase do vídeo com áudio** pro card (sentence mining) — o snapshot já é salvo; falta o clipe de áudio.

## 4. Estudar em qualquer lugar (mobile)

O PWA está 80% pronto e é o caminho certo (evita loja de apps, funciona em iOS/Android):
- `dashboard/manifest.webmanifest` + `dashboard/sw.js` já existem e são registrados no modo web.
- **BUG: o webmanifest aponta para `../icons/icon128.png` e a pasta `icons/` NÃO EXISTE** (nem na raiz nem em `dashboard/`). O `vercel.json` até tem rewrite para `/icons/` → `/dashboard/icons/`, também inexistente. Resultado: PWA instala sem ícone. Corrigir na Fase 1.
- **BUG: rota `stories` ausente do `vercel.json`** (lista `login|home|library|study|leagues|settings|game`) — deep-link/refresh na view de histórias deve quebrar na Vercel.
- Falta: cache offline real no `sw.js` para estudar sem internet (cache dos cards devidos do dia + assets) e sync ao voltar — o Supabase REST torna isso viável com uma fila simples em IndexedDB.

## 5. Projetos GitHub que mais agregariam (resumo)

1. **[ts-fsrs](https://github.com/open-spaced-repetition/ts-fsrs)** — agendador FSRS (item 1). Maior impacto/esforço do relatório.
2. **[kokoro-web / kokoro-js](https://github.com/eduardolat/kokoro-web)** + **[HeadTTS](https://github.com/met4citizen/HeadTTS)** — vozes neurais gratuitas offline + timestamps pra karaokê.
3. **[compromise](https://github.com/spencermountain/compromise)** — lemmatização client-side pra contagem de palavras conhecidas estilo LingQ.
4. **[@edge-tts/universal](https://jsr.io/@edge-tts/universal)** — fallback TTS server-side numa função Vercel.
5. **[Tatoeba](https://tatoeba.org)** (dados CC) — banco de frases-exemplo com tradução PT pra enriquecer cards sem custo de IA.
6. Inspiração de UX (não dependência): [fluent-reader](https://github.com/nramos0/fluent-reader), [Learning with Texts](https://github.com/edoreld/learning-with-texts), [VocabSieve](https://github.com/FreeLanguageTools/vocabsieve), [awesome-language-learning](https://github.com/Vuizur/awesome-language-learning).

## 6. Ordem sugerida (depois das Fases 1-3 do CHECKLIST)

1. Corrigir bugs do PWA (ícones + rota stories + cache offline básico) — destrava "estudar em qualquer lugar".
2. FSRS via ts-fsrs — maior ganho de aprendizado por esforço.
3. Cadeia TTS com Kokoro — qualidade de áudio de app pago, custo zero.
4. Exercícios variados no studyView (cloze/montar frase/ditado) — usa dados que já existem.
5. Modo Leitor (LingQ-style) — evolução natural do storiesView.
6. Palavras conhecidas + lemmatização — métrica central de progresso.
