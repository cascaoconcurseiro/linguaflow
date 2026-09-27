# Plano: curso completo (estilo YouType) e página Progresso só com estatísticas

Estado em 2026-09-27. Checklist vivo na Issue épica do GitHub; este documento registra as decisões.

## Objetivo

1. **Cursos**: um curso de inglês completo e gratuito, do A1 ao B2, com trilhas por situação (dia a dia, viagem, trabalho), vocabulário essencial (1000 palavras), verbos essenciais, phrasal verbs, tempos verbais e histórias; progressão guiada por nível; player e navegação com as mesmas funções do YouType.
2. **Progresso**: a página vira só estatísticas de todo o sistema (vídeo, leitura, revisão FSRS, cursos, escuta, histórias), bem mais completas que hoje.

Referência de funções: mapeamento do YouType feito na sessão logada do usuário (Início, Meus cursos, Loja, página do curso, preparo com modos e configurações, player, cadernos, análise, ranking). Reproduzimos **funções e fluxos**, com conteúdo, visual e código próprios.

## Mesa de especialistas

- **UX Architect**: trilha recomendada visível ("comece aqui → próximo"), página do curso com capítulos e progresso, retomada em 1 clique, estados de carregando/vazio/erro em todas as telas. Risco: catálogo grande sem ordem vira paralisia de escolha.
- **Design Execution**: identidade do LinguaFlow (sem cópia de cores/ícones do YouType); hierarquia editorial; componentes do player com todos os estados (hover, foco, desabilitado, erro, acerto).
- **Motion**: animações só com função — sacudir a palavra errada, confirmar acerto, pulso do combo, transição entre frases, barra de progresso; tudo com `prefers-reduced-motion` e a opção "Reduzir movimento". Risco: animação ornamental atrasa o estudo.
- **Pedagogia/Conteúdo**: progressão A1→B2; unidades de tipos diferentes (palavra, frase, verbo em 3 formas, phrasal verb, trecho de história); cada frase com tradução natural, IPA, nota de uso e estrutura. Risco: gerar 2.000+ itens sem validação = erros de IPA/tradução publicados.
- **Postgres Performance**: estatísticas e análise por RPC com janelas de data e índices; nada de varrer `review_log` inteiro a cada abertura. Risco: página Progresso lenta com histórico grande.
- **Supabase Specialist**: escrita só por RPC autoritativa; RLS de leitura própria; migrations append-only; conteúdo idempotente (`ON CONFLICT`).
- **Full-stack Integrator**: um repositório por domínio (`utils/db/courses-repo.js`, novo `stats-repo.js`); o player é o mesmo para lição, revisão e erros.
- **Accessibility Champion**: teclado em tudo (atalhos com `e.code` + `e.key` para ABNT2), foco visível, rótulos, `aria-live` nos feedbacks, tabelas equivalentes aos gráficos, mapa de calor navegável.
- **Infra**: cache revalidando por ETag (já corrigido no #213); migrations validadas no replay local antes de produção.

## Conflitos e decisões

- **Escala × qualidade do conteúdo** (Pedagogia × Produto): gerar tudo de uma vez é rápido e arriscado. → Conteúdo nasce em arquivos-fonte (`supabase/content/`), passa pelo gerador que **falha** com palavra fora do léxico, IPA inválido ou grupo sintático inexistente; cursos só são publicados quando completos. Listas de frequência/CEFR já existentes (`utils/frequency-en.json`, `utils/cefr-wordlist.json`) guiam a seleção das 1000 palavras.
- **Travar capítulos × liberdade** (UX × Pedagogia): trava rígida frustra quem já sabe. → Trava suave: o próximo capítulo recomendado fica em destaque; qualquer capítulo pode ser aberto; o teste de nivelamento existente define o ponto de partida; "nível concluído" ao terminar 80% dos cursos centrais do nível.
- **Paridade com YouType × anti-padrões do AGENTS.md**: o YouType tem pet de IA e paywall. → Pet fica fora (gamificação decorativa); tudo gratuito.
- **Progresso: remover tudo × rotas existentes**: a página hoje só aponta para Check de comunicação, Estatísticas e Liga. → Progresso passa a ser as estatísticas completas. Liga sai da navegação (o ranking dos Cursos a substitui); o Check de comunicação vira um link discreto no fim das estatísticas. *Confirmado pelo usuário em 2026-09-27.*
- **Volume de migrations**: milhares de linhas de seed. → Uma migration de conteúdo por curso, gerada e verificada por teste (a migration tem de ser idêntica à saída do gerador).

## Catálogo alvo (19 cursos, ~2.600 itens)

| Trilha | Curso | Nível | Capítulos × itens |
| --- | --- | --- | --- |
| Fundamentos | Primeiras Frases (montar frases do zero) | A1 | 12 × 10 |
| Fundamentos | 1000 Palavras Essenciais (por tema, com frase de exemplo) | A1–A2 | 50 × 20 |
| Fundamentos | Verbos Essenciais (100 verbos: base, passado, particípio em frase) | A1–A2 | 10 × 10 |
| Fundamentos | Números, Horas e Datas | A1 | 6 × 10 |
| Dia a dia | Inglês das Ruas & Gírias Reais | A1–A2 | 12 × 10 |
| Dia a dia | Rotina e Casa | A1 | 10 × 10 |
| Dia a dia | Compras e Serviços | A2 | 8 × 10 |
| Dia a dia | Saúde e Emergências | A2 | 8 × 10 |
| Dia a dia | Amizades e Vida Social | B1 | 10 × 10 |
| Viagem | Inglês de Sobrevivência | A1 | 10 × 10 |
| Viagem | Viagem sem Aperto (aeroporto → volta pra casa) | A2 | 12 × 10 |
| Gramática em uso | Os Tempos Verbais na Prática | A2–B1 | 12 × 10 |
| Gramática em uso | Phrasal Verbs Essenciais | B1 | 20 × 10 |
| Gramática em uso | Preposições e Conectores | A2–B1 | 8 × 10 |
| Trabalho | Inglês no Trabalho | B1 | 10 × 10 |
| Trabalho | Entrevista de Emprego | B1–B2 | 6 × 10 |
| Fluência | Histórias Curtas (narrativa contínua) | A2–B1 | 20 × 8 |
| Fluência | Expressões Idiomáticas | B2 | 10 × 10 |
| Fluência | Parágrafos e Opinião | B2 | 10 × 8 |

Tipos de unidade: `sentence`, `word` (digita a palavra; mostra significado e frase de exemplo), `verb_forms`, `phrasal`, `story`.

## Checklist (ordem de execução por dependência)

**Fase 0 — terminar a base já construída (branch `codex/course-platform`)**
- [ ] `npm test` completo verde; teste SQL dos cursos atualizado e verde no banco local
- [ ] QA no navegador de todas as seções e do player (teclado, celular 375 px, tema escuro, movimento reduzido)
- [ ] Issue + PR, CI verde, migrations `20260927180000` e `…180100` em produção, merge, conferência em produção

**Fase 1 — Progresso = estatísticas completas**
- [ ] `rpc_system_stats(p_days)` com tempo por fonte, sequência atual/recorde, mapa de calor de todas as fontes, palavras por estado, retenção FSRS e previsão, cursos, leitura, histórias e escuta
- [ ] `utils/db/stats-repo.js` + nova `progressView.js` (filtros de período, comparação com período anterior, gráficos com tabela acessível)
- [ ] Remover os cartões atuais; Liga fora da navegação; link do Check de comunicação no rodapé
- [ ] Testes de contrato + SQL + QA visual

**Fase 2 — modelo de progressão e tipos de unidade**
- [ ] Migration: `course_catalog.track`, `track_order`, `is_core`; `course_units.kind` com `word`, `verb_forms`, `phrasal`, `story`; `word_meta` (significado, exemplo)
- [ ] RPC de trilha: próximo capítulo recomendado, nível concluído, ponto de partida pelo nivelamento
- [ ] Player: modos para `word` e `verb_forms`; Início e Loja organizados por trilha

**Fase 3 — conteúdo (curso a curso, cada um com gerador + teste)**
- [ ] Fundamentos: Primeiras Frases, 1000 Palavras (50 capítulos), Verbos Essenciais, Números/Horas/Datas
- [ ] Dia a dia e Viagem (completar Ruas, Viagem; criar Rotina, Compras, Saúde, Social, Sobrevivência)
- [ ] Gramática em uso: Tempos Verbais, Phrasal Verbs (200), Preposições e Conectores
- [ ] Trabalho e Fluência: Trabalho, Entrevista, Histórias, Idiomas, Parágrafos

**Fase 4 — design, animação e paridade fina**
- [ ] Auditoria lado a lado com o YouType (cada tela/estado) e lista de diferenças
- [ ] Animações funcionais (erro, acerto, combo, transição, progresso) com movimento reduzido
- [ ] Revisão de acessibilidade (WCAG AA) e Playwright do fluxo principal

## Como medir

- Taxa de lições iniciadas que terminam salvas; frases com mais erros por lição (revisar conteúdo); uso de dica; retorno em 7 dias.
- Página Progresso: tempo de carregamento p95 da RPC abaixo de 500 ms.
