# Handoff — LinguaFlow

## Última sessão — 2026-09-05

Build local: `3.0.34`. Branch de integração e publicação: `main`.

## Entregue hoje

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
- O release completo com `--allow-dirty` passou no build `3.0.34`.
- Testes locais não equivalem a QA autenticado, validação visual da CSP publicada
  ou isolamento real entre duas contas.

## Próximo passo concreto

1. Em produção, confirmar `app.js?v=3.0.34` e verificar no console se CSP não
   bloqueia YouGlish, importação EPUB, YouTube ou o TTS selecionado.
2. Recarregar a extensão e confirmar as cores FSRS no primeiro vídeo, antes de
   abrir o painel lateral.
3. Executar o Check autenticado e confirmar `fluency_skill_profiles` HTTP 200 sem
   `42703`.
4. Validar RLS ao vivo com duas contas independentes.

## Bloqueios e limites

- QA autenticado requer sessão real no navegador e recarregamento da extensão.
- Leaked Password Protection deve ser revalidado no painel do Supabase.
- Calibração humana e acompanhamento D7/D30/D90 continuam pendentes.
