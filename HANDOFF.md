# Handoff — LinguaFlow

## Última sessão — 2026-09-05

Build local: `3.0.35`. Branch de integração e publicação: `main`.

## Entregue hoje

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
- O release completo e o smoke com `--allow-dirty` passaram no build `3.0.35`.
- Testes locais não equivalem a QA autenticado, validação visual da CSP publicada
  ou isolamento real entre duas contas.

## Próximo passo concreto

1. Recarregar a extensão e validar no YouTube: `Apenas Original`, chegada tardia
   da tradução, flash manual e troca entre os quatro modos.
2. Em produção, confirmar `app.js?v=3.0.35` e verificar no console se CSP não
   bloqueia YouGlish, importação EPUB, YouTube ou o TTS selecionado.
3. Recarregar a extensão e confirmar as cores FSRS no primeiro vídeo, antes de
   abrir o painel lateral.
4. Executar o Check autenticado e confirmar `fluency_skill_profiles` HTTP 200 sem
   `42703`.
5. Validar RLS ao vivo com duas contas independentes.

## Bloqueios e limites

- QA autenticado requer sessão real no navegador e recarregamento da extensão.
- Leaked Password Protection deve ser revalidado no painel do Supabase.
- Calibração humana e acompanhamento D7/D30/D90 continuam pendentes.
