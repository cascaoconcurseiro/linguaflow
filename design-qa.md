# Issue #114 — QA da direção editorial clara

## Escopo e referência

Direção escolhida: imagem 1 branca/editorial (fundo marfim, texto azul-marinho, leitura serifada, destaque azul e avaliação suave). Comparação visual realizada com a imagem e o navegador lado a lado na sessão. Implementação adaptada ao conteúdo e controles reais; não é uma reprodução pixel a pixel. Shell, Hoje, Aprender, Progresso, Cofre, Histórias, Leitor e Configurações recebem os tokens compartilhados. Revisão recebe composição específica e avaliação fixa.

## Evidência realizada

- Navegador real, fixture local com módulos de produção e dados demonstrativos: Hoje → Revisar → Revelar → Sair; Aprender → Histórias → Ler → abrir história; Cofre com duas frases.
- Desktop 1363×936: hierarquia, fonte carregada, destaque da palavra, tradução, painel lateral e quatro avaliações visíveis. Corrigido contraste do CTA principal após inspeção.
- Viewport de conteúdo 390×844 em iframe: revelar resposta e quatro avaliações visíveis; frase e tradução quebram sem corte horizontal. Isso não equivale a teste em aparelho real.
- `npm run test:release`: contratos e suites passaram; smoke inicialmente falhou por árvore suja e nome de cache divergente. Cache corrigido; `node tests/release-smoke.mjs --allow-dirty` passou.
- `test:human-interface`, `test:study-focus`, `test:focus-shell`, `test:p0-b`: passaram.
- CSS inclui foco, alvos mínimos, safe area e prefers-reduced-motion. Estes itens foram inspecionados em código; leitor de tela/reduced motion não foram exercitados em dispositivo.

## Limitações / bloqueios antes de produção

- Validar preview autenticado, incluindo gravação de nota, falha/retry, áudio, vídeos YouTube/Max, geração de histórias, preferências e conteúdo longo.
- Tema escuro preservado para quem já o escolheu; QA visual completa do tema ainda pendente.
- Configurações, detalhes de Progresso, formulários, modais e estados raros não receberam QA visual exaustiva.
- Fixture falha fechada para operações não simuladas. Não prova autenticação, RLS, APIs ou persistência; avisos de operações bloqueadas são esperados.
- Rail de vídeo aparece somente com fonte reconhecida. Fixture usada não valida player real. Pronúncia e controles existentes foram preservados, diferindo da imagem conceitual.
- Extensão MV3 e instalação offline não testadas visualmente. Sem alterações de schema ou regras de agendamento.

## Reprodução e rollback

`npm ci && npm run dev`, abrir `http://localhost:4173/`. Revisão: `/?view=study`. Mobile: `/?mobile=1` (iframe 390×844). Prévia local sem credenciais e sem gravações externas. Não publicar este servidor de testes.

Rollback: reverter o commit da Issue #114. Nenhuma migração. Manter PR em rascunho até QA autenticada e aprovação visual.

## Perguntas operacionais

Usar telemetria de revisão existente, sem eventos novos ou PII: a sessão começa? A revelação permite avaliar? A nota recebe confirmação ou erro recuperável? O abandono da sessão muda após a alteração? Comparar antes/depois somente após rollout autorizado.
