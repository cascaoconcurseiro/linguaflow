# Comece aqui

## Referências atuais

1. [README principal](../README.md) — produto, instalação e arquitetura.
2. [Arquitetura de dados](ARQUITETURA_DADOS.md) — fonte de verdade e exceções locais.
3. [Backlog atual](BACKLOG_PRODUTO_2026-07-17.md) — trabalho pendente priorizado.
4. [Handoff](../HANDOFF.md) — estado técnico detalhado da sessão de desenvolvimento.
5. [Changelog](CHANGELOG.md) — histórico do projeto.

## Antes de alterar

- Preserve mudanças locais não relacionadas.
- Crie migrations para mudanças persistentes de schema.
- Mantenha RLS e propriedade por `auth.uid()` em dados de usuário.
- Rode `npm run test:release` antes de publicar.
- Sincronize `manifest.json`, `CLIENT_BUILD`, `dashboard.html` e o cache do Service Worker ao mudar a versão.

## Componentes principais

| Caminho | Papel |
| --- | --- |
| `content/` | integração com players, legendas e leitura na página |
| `background/` | service worker da extensão, tradução, cache e mensagens |
| `dashboard/` | PWA e interfaces de estudo |
| `utils/db.js` | fronteira de acesso autenticado ao Supabase |
| `supabase/` | migrations e Edge Functions |
| `tests/` | contratos automatizados e regressões |

Documentos datados em `docs/` são registros históricos, não necessariamente a especificação atual.
