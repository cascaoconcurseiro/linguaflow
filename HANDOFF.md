# Handoff — LinguaFlow

## Última sessão — 2026-09-07

Build local: `3.0.39`. Build `3.0.38` publicado na `main`; terceiro lote em publicação.

## Entregue hoje

- A transição FSRS passou a ser calculada integralmente pela RPC sob bloqueio,
  usando card, categoria e configurações persistidas; `p_state` é ignorado.
- O cliente envia somente identidade da operação, card e qualidade, e aceita o
  card e o snapshot de undo autoritativos devolvidos pelo servidor.
- O manifesto enumera provedores HTTPS e expõe somente os módulos exigidos por
  YouTube, Prime Video, Disney+, Netflix e Max.
- Corrigido match pattern inválido com subcaminho em `web_accessible_resources[1]`
  no Chrome MV3 (`*://*.amazon.com/*`).
- No YouTube, o engine agora força a trilha original (`sourceLang`, padrão `en`)
  no `movie_player` e descarta parâmetros de auto-tradução `tlang=pt` para garantir
  que as legendas sempre venham no idioma original falado.
- Configurações completam ARIA, estados pressionados e anúncios vivos para CEFR,
  voz, velocidade, posicionamento, Kokoro, push e e-mail.
- Contratos focados de FSRS, manifesto, legendas e configurações passaram no build 3.0.39.

- O dicionário do popup possui três provedores com timeout e sempre encerra o
  estado de carregamento; a tradução também degrada para estado visível.
- O proxy de banco da extensão aceita somente métodos públicos enumerados e
  não transporta mais chamadas REST arbitrárias por `_fetch`.
- Configurações associam labels a todos os campos SRS e nomeiam os grupos de
  sotaque e velocidade para tecnologia assistiva.
- Falha ao desfazer preserva a ação para nova tentativa; adiar um card limpa a
  referência de undo anterior.
- Conteúdo persistido é escapado nos modais restantes do Cofre e Histórias.
- Uma migration append-only torna o snapshot de undo autoritativo e estável em
  retry; a aplicação em produção ainda precisa acompanhar a publicação do PR.
- FSRS usa a dificuldade anterior para calcular estabilidade e limites inválidos
  voltam a valores finitos dentro da faixa aceita.
- A fila busca learning, review/mature e novos separadamente, com tópico no
  PostgREST e suporte ao teto configurável de 1.000 revisões.
- A ponte de legendas rejeita origem, navegação, credencial, URL, protocolo,
  tipo ou tamanho incompatível e rotaciona sua credencial em navegação SPA.
- O popup possui diálogo e abas ARIA, foco/Escape/retorno, chips por teclado,
  contraste AA, movimento reduzido e recall acessível.

- A explicação contextual já gerada acompanha o card sem nova chamada de IA;
  o Web Reader também preserva esse campo ao salvar.
- No verso, `Por que significa isso nesta frase?` aparece recolhido logo abaixo
  da tradução, somente quando há explicação salva, com teclado e ARIA corretos.
- Configurações deslocadas de cartões reversos, exercícios variados e áudio
  foram corrigidas; zero cartões novos por dia permanece zero.
- A revisão rápida passou a usar os limites e contadores canônicos do SRS.
- O cálculo de vencimento diário usa o mesmo relógio da transição FSRS.
- Os limites diários de cards novos e revisões agora são validados de forma
  atômica na RPC, inclusive quando duas sessões tentam responder juntas.
- `Difícil` durante learning/relearning repete o passo atual, sem graduação
  acidental; a transição para leech agora é anunciada e explica a suspensão.
- A migration `20260906120000_authoritative_review_daily_limits.sql` foi
  executada com sucesso no banco `main PRODUCTION` pelo SQL Editor.

- O modo `Apenas Original` agora oculta traduções que chegam de forma
  assíncrona para a mesma legenda, eliminando o vazamento visual da tradução.
- A tradução temporária acionada pelo botão `Traduzir` continua visível durante
  o flash configurado e é cancelada quando a legenda original muda.
- Trocar o modo de legenda no painel redesenha imediatamente a legenda ativa.
- A regressão `subtitle-display-mode` passou a integrar o Stage 2 e o release.
- O checkbox `Tradução` do painel lateral agora inicia marcado, coerente com a
  auto-tradução padrão da lista e independente do modo da legenda sobre o vídeo.

- Conteúdo capturado, persistido e retornado pela IA deixou de entrar como HTML
  executável nos fluxos de estudo e jogos. O tutor renderiza o stream como texto.
- A PWA ganhou CSP com scripts inline bloqueados e allowlist compatível com
  YouTube, YouGlish, EPUB, Supabase, fontes e TTS existentes.
- O boot da legenda correlaciona `words` e `cards` para exibir imediatamente os
  estados `new`, `learning`, `review` e `mature` corretos.
- `saveSentence` valida uma allowlist de campos; código e seletores mortos da
  interface antiga de legendas foram removidos.
- Auditor de fiação reconhece imports concatenados, factories de DOM, DOM do host
  e eventos por `postMessage`, com regressão para os falsos positivos encontrados.
- Verificador PowerShell usa Manifest V3, ícones atuais e o gate oficial de release.
- Qualidade de tradução e regressões de conteúdo não confiável agora fazem parte
  de `test:release`.

## Evidência

- Testes novos foram vistos falhando antes das correções e passaram depois.
- Testes focados de segurança, fiação, legenda, estudo, design e Stage 2 passaram.
- Testes focados de contexto, configurações, FSRS e revisão rápida, o release
  completo e o smoke `--allow-dirty` passaram no build `3.0.37`.
- Testes locais não equivalem a QA autenticado, validação visual da CSP publicada
  ou isolamento real entre duas contas.

## Próximo passo concreto

1. Recarregar extensão/PWA no build `3.0.39`, salvar uma palavra depois da
   explicação contextual e abrir `Por que significa isso nesta frase?` no verso.
2. Validar `0` cartões novos/dia, cartões reversos e áudio automático tanto no
   Estudo quanto na revisão rápida da extensão.
3. Testar os limites autoritativos com duas abas simultâneas em sessão real.
4. Recarregar a extensão e validar no YouTube: `Apenas Original`, chegada tardia
   da tradução, flash manual e troca entre os quatro modos.
5. Em produção, confirmar `app.js?v=3.0.39` e verificar no console se CSP não
   bloqueia YouGlish, importação EPUB, YouTube ou o TTS selecionado.
6. Recarregar a extensão e confirmar as cores FSRS no primeiro vídeo, antes de
   abrir o painel lateral.
7. Executar o Check autenticado e confirmar `fluency_skill_profiles` HTTP 200 sem
   `42703`.
8. Validar RLS ao vivo com duas contas independentes.

## Bloqueios e limites

- A migration `20260906130000_review_undo_snapshot_authority.sql` foi aplicada
  com sucesso no banco canônico `main PRODUCTION`.
- A migration `20260907100000_server_authoritative_fsrs.sql` foi aplicada com
  sucesso no banco canônico `main PRODUCTION` via Management API.
- QA autenticado requer sessão real no navegador e recarregamento da extensão.
- O replay PostgreSQL da nova migration está integrado ao gate, mas este host
  não possui uma distribuição WSL para executá-lo localmente.
- O histórico remoto de migrations contém versões antigas ausentes neste
  checkout; `supabase db push` permanece bloqueado até essa deriva ser
  reconciliada. As migrations recentes foram aplicadas isoladamente via SQL/API.
- Leaked Password Protection deve ser revalidado no painel do Supabase.
- Calibração humana e acompanhamento D7/D30/D90 continuam pendentes.
