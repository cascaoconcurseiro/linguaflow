# Etapa 5 — Design system e qualidade transversal

Responsável: Codex, revisão sênior de design system e acessibilidade.
Data: 2026-07-15.

## Decisões

- Tokens compartilhados agora cobrem foco, links com contraste, texto de sucesso, elevação, espaçamento, alvo de toque e duração de movimento; tema escuro possui equivalentes próprios.
- Foco visível é global para controles interativos. Navegação ativa não depende apenas de cor (`aria-current` permanece), tabs usam `aria-selected` e estados assíncronos publicam `aria-busy`/`aria-live`.
- Alvo mínimo de 44 px foi aplicado a chips, letras A–Z, ações, tabs e controles de Configurações da Etapa 4.
- `prefers-reduced-motion` desativa animações/transições e a rolagem de Histórias deixa de ser suave; `forced-colors` preserva a seleção ativa.
- Loading de Home, Cofre e Histórias reserva espaço para reduzir layout shift. Falha e vazio continuam estados diferentes e acionáveis.
- Títulos, introduções, painel de criação, seleção CEFR e explicação do placar deixaram de depender de estilos inline relevantes.

## Limites

Esta etapa não redesenha o Estudo e não altera P0.2, banco, agendamento ou economia. CSS inline legado de recursos fora dos fluxos da Etapa 4 permanece para migração incremental; removê-lo em massa agora elevaria o risco funcional sem benefício proporcional.

## QA

- `npm run test:design-system`
- `npm run test:product-ux`
- `node tests/pedagogy-economy-contract.test.mjs`
- `npm run test:stage3`

Antes da promoção, validar preview autenticado em 320, 375 e 390 px, temas claro/escuro, teclado completo, redução de movimento e alto contraste do sistema.
