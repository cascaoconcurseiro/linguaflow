# LinguaFlow — diagnóstico integrado do projeto

Data: 22/09/2026. Issue [#116](https://github.com/cascaoconcurseiro/linguaflow/issues/116). Código examinado: `main` em `3aed6ceba5b470a70f20fa3e6ef07bb26e26fff4`.

## Parecer

O projeto tem uma base aproveitável: captura contextual, revisão espaçada, persistência centralizada e proteções importantes no servidor. Não recomendo reescrever tudo. Recomendo uma etapa de estabilização antes de expandir funcionalidades.

O principal problema encontrado é a integração: partes individualmente elaboradas não concordam sobre os dados que trocam. A UI pode parecer pronta, os contratos locais podem passar e o fluxo real ainda falhar. Há também uma confusão pedagógica entre lembrar vocabulário conhecido e demonstrar competência comunicativa.

**Esta é uma auditoria técnica direcionada, não uma certificação integral de segurança, acessibilidade ou eficácia pedagógica.** Foram lidos código e migrations, consultados metadados do Supabase publicado e executadas provas isoladas. Nenhum dado pessoal foi consultado nas queries, nenhuma migration foi aplicada e nenhuma correção funcional foi publicada nesta etapa. Não foi reproduzida uma sessão real da extensão em YouTube/Max nesta auditoria.

## Achados prioritários

| Prioridade | Achado e evidência | Consequência | Correção proposta |
|---|---|---|---|
| Alta — operação | Banco publicado sem a migration `20260921160000_multimodal_study_and_language_tracking.sql`. Lista remota termina em `20260913123000`; consultas ao catálogo confirmaram ausência de `sessions.language`, `review_log.response_time_ms`, `log_manual_study` e da assinatura de `log_study_time` com idioma. | Cliente envia `p_language` para uma assinatura inexistente. Registro manual também não tem RPC correspondente. | Validar a migration em ambiente isolado, compatibilidade de overloads e clientes antigos; aplicar por rollout controlado e testar RPC de ponta a ponta. Não aplicar cegamente todas as migrations. |
| Alta — privacidade local | Rascunho de fluência usa chave global `lf_fluency_check_draft_v1`; `logout()` não a remove. Prova local salvou resposta sintética, executou logout real e recuperou a resposta. | Outra conta no mesmo navegador/perfil pode receber o rascunho anterior. Não é evidência de vazamento remoto entre contas. | Chave por usuário, limpeza no logout/troca e descarte de rascunhos legados sem dono. Teste A → sair → B. |
| Alta — funcionamento | `buildAttemptRecords()` produz `{clientAttemptId, attempt}`; `submitFluencyCheck()` espera `issueId`, `response`, `assistanceUsed`, `clientSubmissionId`. | Prova com os métodos reais termina em “Identificador de submissão inválido.” antes de qualquer chamada de rede. | Integrar UI ao fluxo de emissão de tarefa → resposta → avaliação do servidor, com IDs estáveis e retomada após falha. |
| Alta — listening | `_startImmersionLog()` usa `sourceLang` das configurações, não idioma do áudio, e grava 10s por amostra. Não mede avanço nem verifica mute, volume ou buffering. | No teste, vídeo mudo ou travado ainda gera registro; áudio simulado em português com preferência inglesa é registrado como `en`. | Máquina de estados baseada em reprodução efetiva e evidência de idioma, com intervalos acumulados e confirmação de gravação. |
| Alta — listening Max | `_sessionSource('max')` retorna `extension`; `getStudyStats()` soma listening somente de `video` e `manual_listening`. | A Max pode ter tempo salvo que não aparece em listening, mesmo depois de corrigir a migration. | Mapeamento único e testado para plataformas; avaliar recuperação histórica sem inventar idioma. |
| Alta — validade pedagógica | `estimateLevelFromHistory()` usa tentativas/qualidade de cards; Home grava `lf_cefr_source='measured'` e altera `lf_cefr_level`. | Cinco palavras, uma por faixa, repetidas dez vezes com qualidade 3, produziram C1 no teste. Isso não demonstra competência C1. | Usar estimativa lexical somente para dificuldade do material. Separar perfil por habilidade e exigir tarefas variadas para qualquer inferência CEFR. |
| Média — métricas | `getStudyStats()` aceita dados de `manual_writing` no armazenamento, mas não soma escrita; “total acumulado” consulta apenas 365 dias. | Totais incompletos e rótulo potencialmente enganoso. Prova com 360s mistos reportou somente 60s. | Incluir todas as atividades do contrato e distinguir total histórico de período; agregar no banco quando necessário. |
| Média — recuperação | Timer atual grava marcador local antes da confirmação e suprime erros com `catch {}`. | Falhas de API ficam invisíveis e intervalos não têm fila confiável de reenvio. | Persistir intervalos com ID, reenvio idempotente e estado visível de sincronização. |

### Referências no código

- Listening: `content/subtitle-engine.js`, `_startImmersionLog` (~309) e `_loadSettings` (~972); `utils/db.js`, `logSession`, `getStudyStats`, `_sessionSource` (~1472–1611).
- Schema: `supabase/migrations/20260921160000_multimodal_study_and_language_tracking.sql`.
- Fluência: `dashboard/js/ui/fluencyCheckView.js`, `buildAttemptRecords` (~286), envio (~467); `utils/db.js`, `submitFluencyTask` (~1853) e `submitFluencyCheck` (~1985).
- Rascunho: `utils/db.js`, `logout` (~312), `get/saveFluencyCheckDraft` (~1935).
- Nível: `dashboard/js/core/levelEstimator.js`; `dashboard/js/ui/homeView.js`, `maybeRecalibrateLevel` (~104).

## Como o listening deveria funcionar

Três conceitos precisam ficar separados: idioma que o aluno quer aprender, idioma do áudio atual e idioma da legenda exibida. Uma legenda inglesa pode acompanhar áudio dublado em português; selecionar inglês nas preferências não comprova exposição ao inglês.

1. Identificar plataforma, vídeo e faixa de áudio selecionada quando a plataforma disponibilizar informação confiável.
2. Registrar a origem da evidência: metadado da faixa, confirmação do usuário ou inferência. Legenda é indício, não prova do áudio. Quando não houver informação confiável, mostrar “Idioma não confirmado”, com confirmação simples por vídeo.
3. Acumular tempo somente durante reprodução elegível. Excluir pausas, buffering, saltos da barra, anúncios identificáveis e mute conforme a regra escolhida. Áudio em segundo plano deve ter uma política explícita, pois pode ser escuta legítima.
4. Separar tempo real de estudo e duração de conteúdo: 10 minutos a 2× são 10 minutos de atividade e aproximadamente 20 de conteúdo. Nunca multiplicar silenciosamente um pelo outro.
5. Gravar intervalos identificáveis no servidor, deduplicar abas e retries e atribuir idioma por intervalo quando a faixa mudar.
6. Mostrar “Contando inglês”, “Pausado”, “Idioma não confirmado” ou “Aguardando sincronização”. O aluno deve entender por que o relógio parou.

Aceite mínimo: áudio EN/legenda PT; áudio PT/legenda EN; mudança de faixa; sem legendas; pausa; mute; buffering; anúncio; seek; velocidade 0,5×/2×; duas janelas; perda de rede; fechamento da aba; virada do dia; login expirado. Os eventos devem explicar tempo aceito/rejeitado e falhas sem registrar frases ou identidade desnecessária.

A detecção automática não pode ser prometida como universal: YouTube/Max podem não expor a mesma informação. Adaptadores por plataforma e confirmação explícita são melhores que atribuir inglês sem evidência.

## Segurança: o que foi realmente verificado

**Pontos favoráveis no banco publicado:** todas as tabelas do schema público consultadas têm RLS habilitada; nenhuma função `SECURITY DEFINER` pública estava executável por `anon`. `admin_config`, `admin_sessions` e `admin_pin_attempts` não concedem leitura/escrita direta aos usuários comuns. `cards` e `user_stats` bloqueiam escrita direta por `authenticated`. O código das Edge Functions revisadas verifica usuário no servidor, limita requisições e tamanho de entrada. Isso mostra trabalho de proteção já existente.

**Avisos reais dos advisors:** proteção contra senhas vazadas desativada; `pg_net` instalado no schema público; 31 funções privilegiadas executáveis por autenticados; seis tabelas com RLS sem policies. Os dois últimos itens não são automaticamente vulnerabilidades: RPCs autenticadas podem ser intencionais, e tabelas privadas sem policies podem estar corretamente fechadas. Não remover permissões ou criar policies indiscriminadamente para deixar um painel “verde”.

- Avaliar habilitação da [proteção contra senhas comprometidas](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), conforme recursos do projeto.
- Revisar o aviso de [extensão no schema público](https://supabase.com/docs/guides/database/database-linter?lint=0014_extension_in_public) respeitando limitações de relocação do pg_net.
- Revisar funções privilegiadas com [orientação do advisor](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), confirmando identidade, propriedade, input, privilégios e exposição por função.
- Corrigir primeiro o rascunho compartilhado entre contas. Logout atualmente remove a sessão local, mas não chama revogação remota; definir política de encerramento de sessões/dispositivos para ações sensíveis.
- Traduções/áudio podem trafegar por provedores externos e pelo fallback AllOrigins em `utils/tts.js`. Explicitar esse fluxo, minimizar conteúdo enviado e considerar remover proxy genérico. Não foi feita uma avaliação jurídica.

Busca limitada por padrões de chaves privadas/tokens no tree atual não encontrou candidatos. Isso não equivale a varredura completa do histórico. `npm audit --omit=dev` não apontou vulnerabilidades conhecidas nas dependências de produção; não cobre scripts remotos, permissões de nuvem, segredos históricos ou lógica do produto.

Ainda faltam testes reais de isolamento A/B para todas as entidades, abuso das RPCs, recuperação de conta, revogação de sessões, backup/restauração, políticas de retenção, exposição de logs e avaliação adversarial dos fluxos de IA. RLS ligada não prova autorização correta.

## Pedagogia e avaliação

O ciclo **encontrar uma frase real → compreender → tentar lembrar → revisar depois → usar em novo contexto** é uma boa direção. O problema é usar uma medida limitada como se representasse o conjunto da aprendizagem.

Separar no produto:

| Medida | O que permite dizer | O que não permite dizer |
|---|---|---|
| Tempo elegível | Houve atividade/exposição nas condições registradas | O aluno compreendeu ou prestou atenção |
| Revisão de cards | Lembrou material já visto, com a ajuda registrada | Consegue entender fala inédita ou conversar |
| Tarefa nova | Demonstrou uma habilidade naquele contexto | Tem nível global confirmado |
| Evidências variadas e repetidas | Permitem estimativa por habilidade com incerteza | Certificação oficial automática |

O check atual reutiliza estímulo fixo com rótulo “Escuta inédita”. Corrigir a integração não basta: selecionar tarefas emitidas pelo servidor, controlar reapresentação, registrar ajuda e separar prática de avaliação. Interação digitada não mede pronúncia nem fluência oral. Respostas abertas avaliadas por IA precisam de amostra revisada por humanos, rubrica e acompanhamento de discordâncias; JSON válido e nota calculada no servidor não garantem julgamento pedagógico válido.

Recomendação: manter avaliação de memória simples, trocar “nível medido” derivado de cards por “estimativa de dificuldade lexical” e construir perfil independente de compreensão, escrita, interação e fala. Acrescentar produção curta e transferência de expressões a situações novas somente após o núcleo estar confiável.

Fundamentação: Nation descreve input, output, estudo deliberado e desenvolvimento de fluência como componentes complementares; o CEFR diferencia recepção, produção, interação e mediação. São referências para orientar o produto, não validação deste algoritmo nem quotas rígidas para cada sessão.

- [Nation, The Four Strands (2007)](https://www.wgtn.ac.nz/lals/resources/paul-nations-resources/paul-nations-publications/publications/documents/2007-Four-strands.pdf)
- [Council of Europe — CEFR e tipos de atividade](https://www.coe.int/en/web/portfolio/the-common-european-framework-of-reference-for-languages-learning-teaching-assessment-cefr-)
- [Karpicke e Roediger — Retrieval for Learning (2008)](https://doi.org/10.1126/science.1152408)

## Engenharia e plano de estabilização

Há fronteira de dados central, agendamento com autoridade no servidor, histórico de migrations e testes reais de motor/SQL. São ativos a preservar. Por outro lado, `subtitle-engine.js` tem 6.055 linhas, `word-popup.js` 2.859, `studyView.js` 2.848 e `db.js` 2.119. O tamanho não prova defeito, mas concentração de captura, player, UI e temporizadores torna regressões mais prováveis.

O teste de navegador versionado em `tests/e2e/smoke.spec.mjs` verifica título e body visível. Não exercita login, captura, nota, sincronização ou listening. `test:study-hours` é baseado em presença de trechos de texto; passou com os defeitos reproduzidos. `test:fluency` também passou com incompatibilidade entre UI e dados. Os gates existentes são úteis, mas precisam de testes de integração que atravessem as fronteiras.

Ordem recomendada:

1. **Banco e privacidade:** rollout compatível de schema, diagnóstico de falha explícito e isolamento local por conta. Aceite: cliente atual e legado funcionam, logout não expõe rascunhos.
2. **Listening confiável:** modelo de idioma/tempo, Max, reconciliação, retry e indicadores. Aceite: matriz de cenários acima automatizada e exercitada na extensão real.
3. **Fluência e métricas honestas:** corrigir contrato, retirar inferência de competência global dos cards, tarefas novas, escrita nos totais e período bem rotulado.
4. **Cobertura do ciclo completo:** salvar frase → aparecer no Cofre → revisar → persistir → recarregar → conferir vencimento. Adicionar sessão expirada, offline e conta B. Publicação deve confirmar compatibilidade do banco, não só build da UI.
5. **Refatoração incremental e expansão:** separar adapters de vídeo, relógio de atividade, sincronização e apresentação; depois adicionar produção guiada e painel de habilidades. Sem reescrita geral.

Não adicionaria agora mais jogos, rankings, dashboards ou um grande tutor de IA. As novas funções mais úteis são pequenas: estado do contador, confirmação de idioma, sincronização recuperável e avaliação que explique sua própria incerteza.

## Provas reproduzíveis e limites

Executado nesta auditoria: `node docs/audits/2026-09-22-probes.mjs`, `npm run test:study-hours`, `npm run test:fluency`, `npm run test:production-security` e auditoria npm de produção. Resultados sintéticos em `2026-09-22-probe-results.json`.

As probes executam métodos reais com dependências isoladas; o teste de timer substitui somente a importação do banco por mock e fornece estados de player sintéticos. Não são testes do navegador/DRM nem comprovação de atendimento a todos os usuários. Nenhum teste intrusivo, alteração de configuração ou escrita no Supabase foi realizado. A falha do schema foi confirmada por catálogo do banco, não por gravação de sessão real.
