# Auditoria geral — LinguaFlow

**Data:** 2026-09-09
**Base:** build `3.0.42` em validação sobre a `main`

## Escopo e método

A revisão cobriu extensão Chrome MV3, PWA, rotas e interfaces, motor de legendas, tradução, contexto e exportações, FSRS e adaptação, Supabase/RLS, Edge Functions, notificações, migrations, acessibilidade, infraestrutura, dependências, testes e documentação. A equipe combinou inspeção de fluxo, busca de sinks e fronteiras, revisão de concorrência e contratos automatizados.

Os testes existentes foram tratados como evidência parcial: muitos são contratos estáticos e não exercitam DOM real, Chrome, provedores externos ou duas sessões autenticadas. Por isso, cada conclusão abaixo separa correção comprovada em código de homologação ainda necessária.

## Achados corrigidos nos builds 3.0.41–3.0.42

| Severidade | Falha confirmada | Correção e efeito |
|---|---|---|
| Alta | Traduções persistidas entravam no HTML do jogo e da barra lateral sem escape. | Valores passam por escape antes de atributos/HTML; atualizações assíncronas usam `textContent`. |
| Alta | Título e cues podiam gerar HTML executável no PDF/Anki; CSV aceitava fórmulas ativas. | Exportações escapam HTML e neutralizam os quatro prefixos ativos de planilha. |
| Alta | A estratégia por viewport não atendia ao requisito de ver toda a lista traduzida desde o início. | A extensão solicita a trilha completa e traduz todas as cues com no máximo 12 workers, atualizando cada linha progressivamente. |
| Alta | `sourceLang` e `uiTheme` eram gravados, mas omitidos da leitura do painel. | A hidratação inclui as duas preferências; tradução permanece `true` quando ausente. |
| Alta | Execuções concorrentes podiam enviar Push/e-mail mais de uma vez antes de atualizar o timestamp. | Claims atômicos no Postgres reservam o destinatário por 15 minutos; Resend recebe chave idempotente estável. |
| Média | Reutilizar `client_event_id` com outro payload retornava o resultado anterior como se fosse retry válido. | A RPC compara o evento normalizado e responde `23505 idempotency_conflict` quando o significado diverge. |
| Média | Exportação Anki principal perdia explicação e mnemônico já persistidos. | O verso inclui contexto pedagógico e dica existentes, sem nova chamada de IA. |
| Média | Modais de Histórias e Cofre não continham foco nem o devolviam ao acionador. | Diálogo nomeado, foco inicial, Escape, Tab/Shift+Tab e restauração de foco. |
| Média | Menus e rotas tinham navegação/foco incompletos; carregamento não era anunciado. | Setas, Home/End, título por rota, status live e foco programático foram adicionados. |
| Média | Resultado de jogos desaparecia por redirecionamento temporizado. | O resultado recebe foco e permanece até o usuário acionar “Voltar ao início”. |
| Média | Histórico de Histórias aninhava botões dentro de um elemento com papel de botão. | O acionador principal virou botão real independente; ações por ícone ganharam nomes acessíveis. |

## Backend e integridade

A migration `20260909100000_notification_claims_and_adaptive_idempotency.sql` é append-only. As quatro RPCs de claim/finalização removem execução de `public`, `anon` e `authenticated` e concedem somente a `service_role`. Claims expirados podem ser retomados após 15 minutos; conclusão entregue grava o timestamp e limpa a chave. A RPC adaptativa continua exigindo `auth.uid()` e propriedade do card antes de registrar sinais.

O claim de Push fornece proteção de concorrência, não garantia matemática de exactly-once: Web Push não expõe chave idempotente. Se o provedor aceitar o envio e a conexão falhar antes da confirmação, uma repetição após o lease pode duplicar a mensagem. O e-mail tem camada adicional pela chave do Resend.

## Segurança e infraestrutura verificadas

- `npm audit --omit=dev`: nenhuma vulnerabilidade conhecida no snapshot.
- Produção pública respondeu com HSTS, CSP, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, Referrer-Policy e Permissions-Policy.
- O workflow live de isolamento RLS consultado estava verde no commit anterior.
- Chaves privadas permanecem nas Edge Functions; RPCs privilegiadas validam identidade ou são limitadas a `service_role`.

Essas verificações não cobrem comprometimento futuro de CDN, segurança interna dos provedores, todas as tabelas RLS nem opções do painel Supabase.

## Riscos residuais priorizados

| Prioridade | Risco | Próxima ação verificável |
|---|---|---|
| P1 | Dependências remotas de fflate, Kokoro e YouGlish executam no origin autenticado. | Autocustodiar artefatos versionados ou isolar o widget; registrar hash/licença e fallback. |
| P1 | QA autenticado da extensão, áudio, Anki e duas contas ainda não foi executado neste lote. | Recarregar 3.0.42 no Chrome e seguir a matriz de homologação abaixo. |
| P2 | Busca de cue ativa faz filtro linear por frame. | Medir vídeo longo e implementar índice temporal com teste de cues sobrepostos. |
| P2 | Actions e dependências externas fixadas por tag podem mudar sem revisão local. | Fixar actions por SHA e automatizar atualização controlada. |
| P2 | Nonce da ponte MAIN world é observável pela página hospedeira. | Reduzir comandos e payloads aceitos; tratar a página como origem não confiável. |
| P2 | CORS aceita origens de extensão e previews Vercel amplos, embora JWT seja obrigatório. | Manter inventário explícito de origins de produção quando os IDs/hosts estabilizarem. |
| P3 | Leaked Password Protection depende do plano/configuração do Auth. | Conferir e ativar no painel compatível. |

## Matriz de homologação manual

1. Chrome/YouTube: idioma original como legenda inicial; tradução marcada por padrão; alternância original/tradução/dupla; troca de vídeo sem resultado tardio.
2. Vídeo longo: abrir a barra lateral no início e confirmar que todas as linhas começam a preencher sem depender da rolagem, mantendo no máximo 12 traduções em voo.
3. Flashcard: salvar expressão com frase, explicação e mnemônico; abrir o verso e revelar o contexto; repetir após recarregar sem nova requisição de IA.
4. Anki: importar TSV com HTML, tabulação, acentos e texto iniciado por fórmula; verificar frente, verso, explicação, dica e tags.
5. Teclado/leitor de tela: navegar menus, Histórias, editor do Cofre e jogos; confirmar foco, Escape, Tab e anúncios de carregamento/resultado.
6. Backend: disparar duas invocações concorrentes dos lembretes e conferir um claim por destino; testar retry idêntico e conflito adaptativo divergente.
7. Duas contas: confirmar isolamento de palavras, cards, preferências, histórias, sessões e eventos; o workflow atual não substitui essa matriz inteira.

## Evidência de publicação

- `npm run test:release -- --allow-dirty` passou no diff final.
- Os dois gates obrigatórios do PR #37 e o preview Vercel ficaram verdes.
- O dry-run listou somente `20260909100000`; ela foi aplicada e o dry-run posterior confirmou o banco atualizado.
- `push-reminder` e `email-reengagement` foram publicadas depois da migration.
- O PR #37 foi integrado por squash em `45ac0f9`.

O código web e o backend deste lote estão publicados. Isso não prova que a extensão foi recarregada nem que Chrome, áudio, Anki e duas contas reais executaram toda a matriz manual.
