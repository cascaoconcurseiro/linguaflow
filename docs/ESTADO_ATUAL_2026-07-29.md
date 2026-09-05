# Estado atual — LinguaFlow

**Atualizado em:** 2026-09-05  
**Código de referência:** correções de setembro na `main`; SHA em `git log -1`  
**Build web/extensão:** `3.0.34`

Este é o ponto de entrada canônico para saber o que existe, o que foi
verificado e o que ainda falta. Planos e auditorias superados foram removidos
do diretório de trabalho depois da consolidação; quando necessários, os
documentos versionados podem ser recuperados pelo histórico Git.

## Produto entregue

O LinguaFlow combina uma extensão Chrome MV3 e uma PWA:

- legendas interativas em YouTube, Netflix, Max, Disney+ e Prime Video;
- popup contextual com tradução, explicação, pronúncia, CEFR e salvamento;
- primeira recuperação curta após o salvamento;
- Cofre com busca, filtros, estados FSRS, teto configurável e aposentadoria;
- revisão FSRS-4.5 com learning/relearning steps, bury, suspend, undo e modos
  clássico, builder, ditado e reverso;
- prática livre separada de FSRS, XP, ofensiva e liga;
- Histórias calibradas por nível, quiz sem texto visível por padrão e Reader
  para texto, URL e EPUB;
- entrada direta sem guia, placement opcional e recalibração pelo histórico;
- marcação de palavras conhecidas no popup e no Reader;
- backup JSON, restauração, exportação CSV e exportação Anki acompanhada do
  estado de agendamento;
- TTS natural com cache e Web Speech somente como último fallback;
- lembretes da extensão e Push da PWA;
- Check de comunicação A1–B2 com escuta inédita, escrita funcional e interação,
  sem captura de voz nem comprovação automática de fala espontânea;
- Professor DeepSeek autenticado, com tradução, explicação e pronúncia BR na
  mesma resposta, preservando pronúncia salva e oferecendo login da extensão.

## Contratos que governam o produto

1. Supabase/Postgres é a fonte de verdade de conta, progresso e conteúdo do
   usuário. Estado visual, cache e reprodução permanecem locais.
2. `utils/db.js` é a fronteira única de dados para PWA e extensão.
3. Cards/FSRS medem memória; não certificam fluência.
4. XP, ofensiva e liga não podem ser alimentados por prática livre ou atividade
   passiva.
5. Evidência comunicativa vive em domínio separado e só se torna autoritativa
   por avaliação server-side ou humana.
6. Uma tentativa isolada nunca certifica nível.
7. “CEFR/Cambridge” descreve alinhamento de princípios e descritores; o
   LinguaFlow não é exame oficial nem certificado por essas instituições.

## Fluência: estado técnico

O corte técnico está integrado:

- catálogo privado versionado com 32 tarefas A1–B2;
- emissão de material público sem expor resposta/rubrica privada;
- submissão idempotente e owner-only;
- Edge Function `fluency-assessment` com JWT, quota, limite de payload e
  timeout;
- commit autoritativo em `fluency_skill_profiles`;
- UI acessível na rota `fluency-check`;
- retomada e recomendação periódica na Home;
- migrations e Edge Function registradas como aplicadas no Supabase canônico
  `qnutoswrufznztoznlql` em 2026-07-29.

Isso prova integração técnica, não validade científica. Ainda faltam:

- smoke autenticado no navegador do build `3.0.34`;
- jornada completa sem captura de voz;
- calibração com respostas-âncora avaliadas por humanos;
- concordância entre avaliadores, análise de falsos positivos e viés;
- repetição longitudinal em D7, D30 e D90.

## Evidência automatizada atual

Em 2026-09-05:

- `npm run test:engine`: 38 testes verdes;
- `npm run test:fluency`: todos os contratos de catálogo, autoridade, Edge,
  cliente e UX verdes;
- `npm run test:release -- --allow-dirty`: verde;
- entrada direta em cinco estados de preferências e cancelamento em duas fases;
- contratos de contexto, dicionário, pronúncia e login da extensão;
- auditoria das dependências: zero vulnerabilidades conhecidas;
- release smoke: JavaScript parseado, build `3.0.33` consistente,
  migrations não vazias e manifest MV3 válido.

Esses gates validam contratos do software. Eles não substituem Chrome real,
sessão autenticada, áudio ouvido, dados live ou estudo com usuários.

## Próximos gates, em ordem

1. Confirmar no navegador autenticado `app.js?v=3.0.34` e leitura
   `fluency_skill_profiles` com HTTP 200, sem `42703`.
2. Confirmar entrada direta com conta nova e executar o Check sem captura de voz.
3. Ouvir a etapa de escuta e confirmar a mesma voz natural das demais
   superfícies.
4. Testar tradução contextual de palavra ambígua da captura até o card.
5. Construir conjunto de respostas-âncora e protocolo de calibração humana.
6. Observar pelo menos cinco usuários reais e medir transferência e retenção.
7. Só depois priorizar TTS offline, refatoração dos módulos grandes ou novas
   modalidades.

## Limpeza de produção

Em 29/07, o repositório foi reduzido ao conjunto vigente:

- removidos CSS de popup não carregado e wordlist sem consumidor;
- removidos planos, auditorias e changelog duplicado já consolidados;
- removidos cache de ferramenta, pasta temporária vazia e snapshots locais
  ignorados;
- preservados ícones duplicados porque atendem empacotamentos distintos da
  extensão e da PWA;
- preservados migrations, testes, dados linguísticos consumidos, configuração
  local e metadados de desenvolvimento.

A política de recuperação está em [`HISTORY.md`](HISTORY.md).

## O que não executar a partir de planos antigos

Não reimplementar como pendência:

- `utils/fsrs.js`, removido;
- seed de fluência, atualmente preenchido;
- placement opcional nas configurações; não reintroduzir onboarding obrigatório;
- `known_words`, já conectado;
- primeira recuperação, ditado justo, rotação e cartão reverso, já entregues;
- teto do Cofre e aposentadoria, já entregues;
- quiz escondendo texto, já corrigido;
- lembrete visível, já implementado;
- backup/exportação do estado FSRS, já implementados.
