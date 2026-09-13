# Handoff — LinguaFlow

## Última sessão

**Data:** 2026-09-13

**Estado encontrado:**

- A referência vigente é `docs/ESTADO_ATUAL_2026-09-12.md`, com a versão 3.0.46 descrita como estável e a QA manual dos fluxos críticos ainda relevante.
- O worktree já contém alterações não commitadas no fluxo administrativo (`adminView.js`, RPCs administrativas e arquivos relacionados); elas devem ser preservadas e não pertencem à investigação de Histórias.
- Esta sessão começou investigando o erro visível “Tradução indisponível” ao passar o mouse nas palavras de Histórias.

## Próximo passo

**Arquivo:** fluxo de renderização da tela de Histórias a localizar no `dashboard/`

**Ação:** reproduzir no navegador autenticado e rastrear o valor da palavra/frase desde o evento de hover até o serviço de tradução antes de editar.

## Bloqueios

- Nenhum bloqueio confirmado; a causa do erro ainda precisa ser reproduzida.
