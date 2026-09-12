# Fonte de verdade e segurança

**Atualizado em:** 2026-09-05
**Status:** referência ativa; detalhes operacionais datados permanecem
identificados abaixo.

## Estado atual

O Supabase é a fonte de verdade de todo conteúdo e progresso pertencente ao
usuário: palavras, frases, cards/FSRS, revisões, XP, ligas, sessões, histórias,
configurações pedagógicas, eventos de aprendizagem, desfazer revisão e textos
do Reader, eventos adaptativos e evidência comunicativa.

Preferências estritamente visuais ou do dispositivo (tema, voz e visibilidade
de legenda) continuam locais. Traduções, dicionário, áudio e legendas são caches
descartáveis. `lf_reader_texts` permanece apenas como cópia local e mecanismo de
migração; depois do login, a estante exibida vem de `public.reader_texts`.

## IA e sessões

As funções `deepseek-chat` e `fluency-assessment` usam exclusivamente DeepSeek,
validam identidade e aplicam cota individual. Respostas usam
`Cache-Control: private, no-store`; não há captura de voz do aluno.
A publicação dessas funções foi registrada em 04/09; o frontend exige
publicação própria. PWA e extensão mantêm sessões independentes.

## Correções de dados anteriores

- `reader_texts` tem RLS e políticas separadas de SELECT/INSERT/UPDATE/DELETE,
  todas vinculadas a `auth.uid()`.
- textos antigos do `localStorage` migram de forma idempotente após autenticação;
  o cache só é substituído depois da confirmação do banco.
- `log_study_time` soma segundos com `INSERT ... ON CONFLICT DO UPDATE`, evitando
  perda de tempo quando duas abas gravam simultaneamente.
- sessões registram `source`: `extension`, `pwa`, `video`, `review` ou `reader`.
- estatísticas somam todas as origens do dia; não escolhem apenas a primeira.

## Auditoria de segurança

- Todas as RPCs `SECURITY DEFINER` acessíveis a `authenticated` foram enumeradas.
  Elas têm grant explícito (não herdado de `PUBLIC`) e verificam `auth.uid()`.
  Os avisos do advisor são mantidos como revisão consciente porque essas RPCs são
  fronteiras atômicas intencionais do produto.
- `log_study_time` usa `search_path` vazio, limita 1–300 segundos por chamada,
  valida data/origem e não pode ser chamada por `anon`.
- `pg_net` continua registrado em `public` porque a versão instalada não é
  relocável. As funções ficam no schema `net`; recriar a extensão interromperia
  os crons de push/e-mail sem reduzir uma superfície prática do Data API.
- A proteção contra senhas vazadas depende de configuração no painel Supabase
  Auth e não pode ser ativada por migration SQL. Deve permanecer como única ação
  operacional pendente até uma sessão autenticada no painel estar disponível.

## Fluência e dados privados — atualização de 29/07

- o catálogo privado possui 32 tarefas A1–B2;
- material público e resposta/rubrica privada são separados;
- submissões usam ownership, expiração e UUID idempotente;
- somente avaliação `server` ou `human` pode fortalecer
  `fluency_skill_profiles`;
- áudio é enviado como evidência transitória para fala e não é persistido;
- a Edge Function `fluency-assessment` foi registrada como `ACTIVE`, com JWT;
- smoke autenticado completo no navegador continua pendente.

## Documentação histórica

Documentos antigos ficam em `docs/archived/`. Não se removem registros apenas
por tamanho: a exclusão exige duplicidade comprovada ou substituição por uma
decisão atual rastreável. O README e este documento são as referências atuais;
arquivos arquivados não descrevem o comportamento vigente.
