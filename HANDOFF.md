# Handoff — LinguaFlow

## Última sessão — 2026-09-06

Build local: `3.0.36`. Branch de integração e publicação: `main`.

## Entregue hoje

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
  completo e o smoke `--allow-dirty` passaram no build `3.0.36`.
- Testes locais não equivalem a QA autenticado, validação visual da CSP publicada
  ou isolamento real entre duas contas.

## Próximo passo concreto

1. Recarregar extensão/PWA no build `3.0.36`, salvar uma palavra depois da
   explicação contextual e abrir `Por que significa isso nesta frase?` no verso.
2. Validar `0` cartões novos/dia, cartões reversos e áudio automático tanto no
   Estudo quanto na revisão rápida da extensão.
3. Confirmar no Supabase que a migration
   `20260906120000_authoritative_review_daily_limits.sql` foi aplicada e testar
   os limites com duas abas simultâneas.
4. Recarregar a extensão e validar no YouTube: `Apenas Original`, chegada tardia
   da tradução, flash manual e troca entre os quatro modos.
5. Em produção, confirmar `app.js?v=3.0.36` e verificar no console se CSP não
   bloqueia YouGlish, importação EPUB, YouTube ou o TTS selecionado.
6. Recarregar a extensão e confirmar as cores FSRS no primeiro vídeo, antes de
   abrir o painel lateral.
7. Executar o Check autenticado e confirmar `fluency_skill_profiles` HTTP 200 sem
   `42703`.
8. Validar RLS ao vivo com duas contas independentes.

## Bloqueios e limites

- QA autenticado requer sessão real no navegador e recarregamento da extensão.
- O replay PostgreSQL da nova migration está integrado ao gate, mas este host
  não possui uma distribuição WSL para executá-lo localmente.
- Leaked Password Protection deve ser revalidado no painel do Supabase.
- Calibração humana e acompanhamento D7/D30/D90 continuam pendentes.
