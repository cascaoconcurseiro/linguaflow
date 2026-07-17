# Backlog de produto — o que FALTA depois da auditoria e das Fases 1-6

**Data:** 2026-07-17 (noite) · **Fonte:** auditoria completa + planos suspensos (W-ondas) reconciliados com o que foi executado.
**Regra de leitura:** tudo que estava nas Fases 1-6 está FEITO e não aparece aqui. Isto é o que sobrou — separado por natureza, com esforço estimado (P = 1 sessão · M = 1-2 sessões · G = várias).

---

## A. Pedagogia — as peças do ciclo de aprendizagem que ainda não existem

Estas eram as ondas centrais dos planos suspensos. A auditoria matou as que já existiam (W3/reencontro, metade da W4); **estas sobreviveram à auditoria e continuam valendo**:

| # | O quê | Por quê | Esforço |
|---|---|---|---|
| A1 | **Primeira recuperação de 15s pós-save (W1)** — depois de salvar no popup, uma pergunta única (frase com lacuna + 3 sentidos) antes de fechar | É o buraco por onde todo app de mineração vaza: salvar sem recuperar cria cemitério de cards. Desenho técnico já pronto na §4b.4 da auditoria (fila local `lf_pending_first_recall_v1` casada com a fila de save que já existe) | M |
| A2 | **Ditado justo (W2.1)** — Levenshtein com faixa "quase": typo de 1-2 letras libera Difícil/Bom em vez de forçar Errei | Hoje `recieve` vira lapso no FSRS — o app pune o teclado como se fosse a audição. É o bug pedagógico mais barato de consertar que resta | P |
| A3 | **Rotação de habilidade (W2.2)** — trocar o `Math.random()` da escolha de exercício por rotação `reps % 4` + trava de ditado longo para A1/A2 | Garante cobertura das 4 modalidades; aleatório pode dar ditado 3x seguidas e nunca produção | P |
| A4 | **Histórias calibradas por nível (W5)** — tamanho/estruturas por banda (A1: 90-130 palavras, frase ≤8… C2: livre), verificação pós-geração com a `cefr-wordlist.json`, selo `pedido B1 · medido B2` | Hoje A1 e C2 recebem os mesmos "200-300 palavras" — o A1 desiste achando que o problema é ele. A variedade foi consertada (17/07); a calibração NÃO | M |
| A5 | **Aquisição de "palavras conhecidas" no vídeo (§4b.1)** — hoje `known_words` = 0 e o único caminho é o Leitor; o evento `LF_WORD_KNOWN` não tem emissor | Destrava DUAS features já construídas e cegas: o degrau `lf-known` do gradiente da legenda e o score de compreensão do episódio (§4d.1). Um botão "já sei" no popup resolve | P |
| A6 | **Nível medido, não declarado (W6.1)** — `levelEstimator` sobre `review_log` + `cefr-wordlist`: banda mais alta com ≥10 tentativas e ≥70% retenção; após 50 tentativas, substitui o teste | O placement vira cold-start honesto; o app para de carregar uma etiqueta de 4 minutos pra sempre | M |
| A7 | **Teto do cofre (W7)** — `lf_vault_cap` (default 300), cofre cheio = palavra nova espera vaga, "aposentar" card dominado libera | A resposta ao motivo nº 1 de abandono em SRS (a dívida infinita). Nenhum concorrente tem coragem. Zero migration — é settings + suspend que já existem | M |
| A8 | **Evidência pedagógica na tentativa (W0)** — `modality`/`latency_ms`/`helped` no `evidence jsonb` via parâmetro novo na RPC `record_card_review` | O `evidence` registra contabilidade com precisão de banco e ZERO pedagogia. Sem isso, "sistema que se adapta ao aluno" é impossível. **Única pendência que exige migration** (expand-only, 1 parâmetro) | M |
| A9 | **Otimizador FSRS (W8.2)** — Edge Function mensal recalculando os 17 pesos do histórico; piso de 400 revisões | Diferença entre FSRS e *sabor* FSRS. Só faz sentido DEPOIS de haver volume de revisões real | G |

## B. Limpezas e dívidas pequenas que sobraram da auditoria

| # | O quê | Ref | Esforço |
|---|---|---|---|
| B1 | Remover o campo BYOK ("cole sua chave sk-…") das Configurações + ramo em `getApiConfig()` — **aprovado e liberado desde a W6.4, nunca executado**; a Edge Function com rate-limit é o caminho único | §4b.2/§4b.3 | P |
| B2 | Shuffle enviesado no `renderBuilder` do Estudo (`sort(0.5-rnd)`) — mesmo conserto já feito no gameView | W2.3 | P |
| B3 | ~160 linhas mortas dentro de `_processYtSub` + guards defensivos `lf-save-btn`/`lf-btn-loop`/`lf-hbo-switch` — deixados de propósito na Fase 5 (risco > ganho sem sessão dedicada) | §4d.11 | P |
| B4 | Mina do `getStats`: CEFR adivinhado por TAMANHO da palavra quando `words.level` é nulo — a wordlist real está no disco ao lado | §3.6 | P |
| B5 | Régua de frequência do popup diz "top-5k" com 835 palavras no arquivo | §4d.2 | P |
| B6 | `saveWord` upsert ainda SOBRESCREVE contexto por baixo (a guarda da Fase 2.3 protege só o popup; web-reader/histórias re-salvando ainda apagam a cena original). Solução real: "adicionar novo contexto" em vez de substituir | §3.5 | M |
| B7 | Export Anki TSV sem `stability/difficulty/due` (a "porta destrancada", W8.1). Nuance descoberta na auditoria: o backup JSON completo JÁ exporta o estado FSRS — falta só no formato Anki | W8.1 | P |
| B8 | UI de "Marcar como lida" das histórias ainda promete XP — verificar: a revogação da RPC legada no P0.3 provavelmente já matou o prêmio por baixo, sobrou a promessa na tela | W5.4 | P |

## C. Decisões de produto grandes (não são bugs — são apostas; exigem o dono)

| # | O quê | Estado |
|---|---|---|
| C1 | **Sistema visual (W10)** — escuro, marca âmbar, verde/vermelho SÓ para evidência, peso ≤700, frase como herói | Não iniciado. É a tese "sua marca é a moldura do vídeo, não um mascote" |
| C2 | **Dock da Max acompanhando controles nativos (W11)** — o dock vertical funciona; a mudança é estética/filosófica | §4q.3 registrou como decisão, não bug |
| C3 | **Navegação 7→3 (W9)** — o Codex JÁ fez metade em main (hubs Aprender/Progresso, liga rebaixada a "opcional" com copy honesta). Falta decidir se vai até o fim (Hoje = 1 frase + 1 botão; stat cards para "Você") | Parcial |
| C4 | **Shadowing com a voz do ATOR** (ator→você→ator alternado usando `video_start_ms/end_ms`) — a Fase 3 entregou a variante com TTS+SpeechRecognition; a versão com o áudio original do vídeo é outra feature, mais rica | Não iniciado |

## D. Pendências que só o dono pode cumprir (nenhuma é código)

1. **Testes manuais** das Fases 2, 3, 4 + histórias — roteiros no CHECKLIST. Agora em PRODUÇÃO.
2. **1 clique:** `https://linguaflow.vercel.app/` resolve? Senão, trocar a URL do e-mail (agora é 1 push).
3. **GitHub Actions** travado por billing — CI remoto continua morto até regularizar.
4. **Usar o app de verdade** — a Fase 0 do plano mestre (5 pessoas reais observadas) segue sendo a única coisa que nenhuma sessão de IA pode entregar. E o dado da auditoria não mudou: quem mais precisa assistir uma série com a extensão ligada é o dono.

---

## Recomendação de ordem (se a equipe decidir)

**Rodada 1 (barata, alto impacto):** A2 + A3 + B1 + B2 + B7 + B8 — uma sessão, fecha o ditado injusto, a rotação, o BYOK e a porta destrancada.
**Rodada 2 (o ciclo):** A5 (destrava 2 features prontas) → A1 (primeira recuperação) → A4 (histórias calibradas).
**Rodada 3 (inteligência):** A8 (evidência) → A6 (nível medido) → A7 (teto).
**Depois:** C1-C4 com decisão do dono; A9 quando houver volume.
