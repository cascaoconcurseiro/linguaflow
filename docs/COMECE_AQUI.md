# Comece aqui

Revisado em 05/09/2026: entrada direta e contratos sem captura de voz.

## Referências atuais

1. [Estado atual](ESTADO_ATUAL_2026-07-29.md) — o que existe, evidência e gates.
2. [README principal](../README.md) — produto, instalação e arquitetura.
3. [Master Blueprint](../MASTER_BLUEPRINT.md) — decisões que devem ser preservadas.
4. [Arquitetura de dados](ARQUITETURA_DADOS.md) — fonte de verdade e exceções locais.
5. [Backlog atual](BACKLOG_PRODUTO_2026-07-17.md) — somente pendências verificadas.
6. [Handoff](../HANDOFF.md) — último trabalho, próximo passo e bloqueios.
7. [Checklist](../CHECKLIST.md) — gates executáveis.
8. [Changelog](../CHANGELOG.md) — histórico de versões atuais.
9. [Política de histórico](HISTORY.md) — material consolidado e recuperação.

## Antes de alterar

- Preserve mudanças locais não relacionadas.
- Crie migrations para mudanças persistentes de schema.
- Mantenha RLS e propriedade por `auth.uid()` em dados de usuário.
- Rode `npm run test:release` antes de publicar.
- Sincronize `manifest.json`, `CLIENT_BUILD`, `dashboard.html` e o cache do Service Worker ao mudar a versão.
- Não chame a rubrica própria de exame oficial CEFR/Cambridge.
- Não transforme teste estático em prova de navegador, áudio ou produção live.

## Componentes principais

| Caminho | Papel |
| --- | --- |
| `content/` | integração com players, legendas e leitura na página |
| `background/` | service worker da extensão, tradução, cache e mensagens |
| `dashboard/` | PWA e interfaces de estudo |
| `utils/db.js` | fronteira de acesso autenticado ao Supabase |
| `supabase/` | migrations e Edge Functions |
| `tests/` | contratos automatizados e regressões |

O diretório de trabalho mantém apenas documentos vigentes. Na dúvida,
prevalecem Estado atual, Blueprint, Checklist, Handoff, contratos ativos e
código; material consolidado pode ser recuperado pelo histórico Git.
