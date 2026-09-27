# Prompt da próxima sessão — LinguaFlow

Copie o bloco abaixo:

---
Leia integralmente, nesta ordem:

1. `HANDOFF.md`;
2. `docs/ESTADO_ATUAL_2026-09-21.md`;
3. `MASTER_BLUEPRINT.md`;
4. `CHECKLIST.md`.

Trabalhe em `main`. Não execute planos, auditorias ou briefings datados como backlog; eles são históricos. Confirme o estado atual no código, nos testes e, quando aplicável, na produção.

## Estado atual (2026-09-21 / v3.0.51)

- Auditoria OWASP concluída. XSS em `studyView.js` corrigido (cartão reverso + cloze + escapeHtml duplicada).
- Banco × código 100% alinhado: 25 tabelas, 29 RPCs, 55 migrations — tudo presente.
- Testes: 100% verdes (`test:release`).
- Versão: `3.0.51` em `package.json`, `manifest.json`, `sw.js`.

## Objetivos prioritários da próxima sessão

1. **QA autenticada no navegador**:
   - Abrir a PWA autenticada e confirmar `v3.0.51`.
   - Testar Home, Study, Learn, Progress, Settings, Stories e Reader.
   - Testar service worker com cache antigo.
   - Testar logout, expiração e novo login.

2. **Bug hover de Histórias (Issue #77)**:
   - Reproduzir no navegador autenticado um caso real de "Tradução indisponível".
   - Rastrear hover → token → normalização → vault → translateText → tooltip.
   - Confirmar causa raiz ANTES de editar `storiesView.js`.
   - Criar teste de regressão para o caso reproduzido.

3. **`updateReaderProgress` na UI**:
   - O banco tem `last_read_position`, `reading_percentage`, `is_completed` em `reader_texts`.
   - `db.js` tem o método `updateReaderProgress()` pronto.
   - Falta: chamar o método ao rolar o texto no Reader e exibir progresso na estante.

4. **RLS real com dois usuários**:
   - Confirmar isolamento: usuário A não lê dados de B.
   - Confirmar que RPCs admin são rejeitadas para usuário comum.

## Regras para esta sessão

- Não declarar conclusão a partir de compilação ou teste estático.
- Não declarar RLS validado sem teste real com dois JWTs distintos.
- Não adicionar features antes de resolver os bloqueios acima.
- Se o navegador não estiver autenticado ou a extensão não estiver carregada, registre o bloqueio e não simule o resultado.
- Ao encerrar: atualizar `HANDOFF.md`, `CHECKLIST.md` e este arquivo.

---
