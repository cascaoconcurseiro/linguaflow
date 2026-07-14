# Plano Mestre de Produto Real — LinguaFlow

**Data:** 2026-07-14

**Responsável pela consolidação:** Codex

**Escopo:** produto, ciência da aprendizagem, UX, design, economia, dados, infraestrutura, segurança e operação.
**Status:** direção estratégica para substituir a evolução por acúmulo de funcionalidades.

## 1. Veredito executivo

O LinguaFlow tem um diferencial legítimo — aprender a partir do momento exato de um vídeo real e transformar esse contexto em memória de longo prazo — mas o aplicativo ainda se comporta como uma coleção de módulos: vídeo, cards, jogos, histórias, leitor, XP, ligas e estatísticas. As partes existem; o sistema que decide como elas trabalham juntas ainda não existe.

O problema não é principalmente visual. É de produto:

- a navegação apresenta ferramentas, não uma jornada;
- XP mede atividade mais do que aprendizagem;
- jogos podem ser repetidos sem produzir nova evidência de domínio;
- o conteúdo salvo vira um card, mas ainda não vira uma progressão linguística coerente;
- “palavra”, “frase”, “ocorrência no vídeo”, “significado” e “habilidade” estão misturados;
- o usuário precisa escolher entre muitas áreas quando o produto deveria recomendar o próximo passo;
- a interface foi sendo ampliada por blocos, sem hierarquia global nem sistema visual de produto;
- faltam eventos e métricas para distinguir uso, retenção, domínio e transferência para conteúdo real.

Portanto, a próxima fase não deve ser “reorganizar Home/Cofre/Stories”. Deve ser reconstruir o produto ao redor de um único ciclo de aprendizagem mensurável.

## 2. A promessa do produto

> **Entenda uma frase real hoje. Reconheça-a amanhã. Use-a sem ajuda depois.**

O LinguaFlow não deve competir com o Duolingo pela quantidade de exercícios nem com o Anki pela quantidade de opções. Deve ser o melhor sistema para transformar conteúdo que a pessoa realmente quer assistir em compreensão auditiva, vocabulário contextual e produção duradoura.

O diferencial não é “YouTube + Anki na mesma tela”. É preservar a cadeia completa:

1. **Encontrar:** o usuário assiste a conteúdo real.
2. **Perceber:** uma frase relevante é identificada no tempo exato.
3. **Entender:** sentido, som, chunks, gramática e intenção são explicados no contexto.
4. **Codificar:** o usuário faz uma primeira recuperação ativa, não apenas salva.
5. **Revisar:** o SRS agenda a próxima evidência necessária.
6. **Produzir:** o usuário reconstrói, dita ou fala a frase em contexto semelhante.
7. **Reencontrar:** o sistema mostra a expressão em outros vídeos/textos.
8. **Dominar:** a habilidade só sobe quando há evidências diferentes e espaçadas.

Toda funcionalidade deve ocupar um lugar nessa cadeia. Se não ocupar, deve ser removida da navegação principal, incorporada a outro fluxo ou descontinuada.

## 3. A métrica que governa o produto

### Métrica norte

**Unidades linguísticas dominadas e retidas por semana**, com evidência espaçada de listening e recuperação ativa.

Uma unidade não é “uma palavra salva”. É um significado ou chunk em contexto, ligado a uma ocorrência real. “Domínio” não pode depender de XP nem de um clique em Fácil. Deve combinar, no mínimo:

- reconhecimento auditivo;
- recuperação de sentido;
- reconstrução ou produção;
- intervalo temporal;
- ocorrência em mais de um contexto, quando disponível.

### Métricas de resultado

- retenção observada em 7 e 30 dias;
- frases reconhecidas sem legenda;
- itens recuperados por produção, não só reconhecimento;
- taxa de compreensão antes/depois de um trecho;
- backlog de revisões e taxa de recuperação;
- tempo até o primeiro “momento mágico” (capturar → entender → acertar depois);
- sessões semanais com evidência real de aprendizagem.

### Guardrails

- proporção de XP gerado por repetição do mesmo conteúdo;
- respostas rápidas demais para serem leitura/recuperação real;
- taxa de abandono por tipo de exercício;
- acúmulo de cards novos acima da capacidade de revisão;
- erros de sincronização, duplicações e gravações idempotentes;
- latência até áudio/vídeo utilizável;
- uso de ajuda antes da primeira tentativa.

## 4. Economia e anti-farm

### Estado verificado

O servidor limita `game_match` a 40 XP/dia, mas `record_learning_event(p_type, p_amount)` recebe do cliente o tipo e a quantidade. Não há um ledger detalhado de tentativa com item, exercício, resultado, latência, dificuldade, repetição e chave idempotente. O teto reduz o farm total, mas não transforma atividade em evidência confiável.

Outros problemas confirmados no código:

- jogos enviam somente a quantidade agregada de acertos, sem identificar item ou habilidade;
- o quiz de história protege repetição apenas no estado em memória da tela;
- marcar uma história como lida pode gerar XP sem prova de compreensão;
- reprodução passiva de vídeo pode sustentar XP/streak;
- revisões recompensam mais XP quando o próprio usuário escolhe uma nota mais alta;
- a RPC de revisão não exige que o card esteja vencido para conceder XP;
- o estado FSRS seguinte é calculado no cliente e aceito pelo servidor;
- a missão “ganhar XP” usa XP para liberar mais XP, criando incentivo circular;
- “palavras salvas” é tratada como progresso, embora possa apenas aumentar dívida de revisão.
- a missão semanal aceita um limiar informado pelo cliente, em vez de usar uma regra imutável do servidor;
- sessões de vídeo usam leitura seguida de atualização periódica, sem incremento atômico/idempotente entre abas;
- criação de card faz consulta e inserção separadas, sem unicidade `(user_id, word_id)` no banco.

### Nova regra econômica

**XP é consequência de aprendizagem qualificada, nunca o objetivo da interação.**

- Repetir livremente continua permitido, mas não gera XP infinito.
- A primeira tentativa qualificada de um item por janela pode gerar valor integral.
- Tentativas repetidas do mesmo item têm retorno decrescente até zero.
- Conteúdo novo, revisão vencida e produção valem mais que reconhecimento imediato.
- Assistir/reproduzir sem responder não gera XP de domínio.
- Ajuda, dica ou revelação reduzem a recompensa, mas não impedem aprender.
- Erro no SRS não é punição: é dado para agendamento.
- Liga usa apenas **XP qualificado**, não XP bruto de qualquer atividade.
- Jogos treinam fraquezas selecionadas pelo sistema; não são uma máquina paralela de pontos.

### Modelo mínimo de evento

Cada tentativa precisa registrar no servidor:

- `event_id` idempotente;
- usuário, sessão e dispositivo;
- item linguístico e ocorrência contextual;
- tipo de exercício e habilidade testada;
- resposta, acerto, ajuda e latência;
- estado anterior e posterior de domínio;
- XP calculado pelo servidor e motivo;
- versão das regras/economia.

O cliente pode informar a resposta, mas não deve escolher seu próprio XP. O servidor valida propriedade, janela, duplicidade, limites e regras.

## 5. Modelo de aprendizagem

### Separar entidades que hoje estão comprimidas

- **Fonte:** vídeo, episódio, página, história ou texto.
- **Ocorrência:** trecho com início/fim, legenda, áudio e contexto.
- **Item linguístico:** lemma, chunk ou construção.
- **Sentido:** significado específico naquele contexto.
- **Item de aprendizagem:** o que o usuário decidiu aprender.
- **Tentativa:** evidência observável em um exercício.
- **Estado de domínio:** estimativa por habilidade.
- **Card/SRS:** agenda de recuperação, não a identidade inteira do conhecimento.

Isso permite que “run”, “running” e “ran” se relacionem sem apagar sentidos diferentes; e permite que a mesma expressão seja reencontrada em dois vídeos, fortalecendo domínio sem criar cards duplicados.

### Vetor de habilidades

Cada item deve poder evoluir separadamente em:

- perceber o som;
- compreender no contexto;
- recordar o significado;
- reconstruir a forma;
- produzir em contexto novo;
- pronunciar, quando essa modalidade estiver habilitada.

O usuário não precisa ver números complexos. A interface pode mostrar estados humanos: **Novo → Reconhecendo → Lembrando → Usando → Dominado**.

### Relação com o FSRS

O FSRS continua como motor da memória, mas deve agendar uma unidade coerente e receber tentativas semanticamente válidas. Jogos livres não devem alterar o agendamento principal sem evidência comparável. Prática extra pode atualizar domínio auxiliar e alimentar recomendações.

## 6. A experiência central redesenhada

### Hoje

A Home deixa de ser dashboard de números e vira um treinador diário com uma única recomendação principal.

Ordem padrão:

1. **Revisões essenciais:** proteger memória já adquirida.
2. **Imersão:** continuar um vídeo/fonte relevante.
3. **Fixação:** trabalhar 3–5 frases descobertas recentemente.
4. **Produção:** exercício curto a partir de uma fraqueza real.

O usuário pode explorar livremente, mas não precisa montar sozinho o próprio plano.

### Sessão de vídeo

- Retomar exatamente de onde parou.
- Legenda e controles não cobrem o conteúdo.
- Um clique captura a ocorrência completa: frase, timestamps, áudio/clip, fonte e sentido.
- Salvar é otimista e imediato; enriquecimento e sincronização acontecem em segundo plano, com estado visível.
- Antes de criar outro card igual, o sistema detecta item/sentido existente e oferece “adicionar novo contexto”.
- Replay do trecho respeita início/fim, pré-buffer e pausa final.
- O usuário pode comparar “com legenda / sem legenda / velocidade reduzida”.

### Primeiro aprendizado após salvar

Salvar não encerra o fluxo. Uma microetapa de 15–30 segundos pede uma recuperação simples. Isso cria a primeira evidência e reduz o cemitério de cards nunca estudados.

### Revisão

- Frente limpa, uma tarefa por vez.
- A modalidade muda conforme a habilidade que precisa ser fortalecida.
- A resposta aparece antes de recursos auxiliares.
- Tutor surge contextualmente após erro, dúvida ou solicitação; não como painel permanente.
- Vídeo é prova contextual, não decoração lateral.
- “Explorar” continua disponível, mas não compete com a ação principal.
- A nota SRS representa lembrança; exercícios objetivos usam resultado observado e depois permitem autopercepção quando necessário.

### Prática/jogos

“Jogos” vira **Treino**. O sistema explica o propósito: “Você confunde estas três expressões ao ouvir”.

- sessão curta com início, objetivo e fim;
- seleção baseada em fraqueza e variedade, não aleatória;
- tentativas repetidas são permitidas;
- XP depende de evidência nova, espaçamento e dificuldade;
- resultado mostra o que melhorou e o próximo passo;
- diversão vem de ritmo, feedback e progressão, não de farming.

## 7. Nova arquitetura da informação

### Navegação principal móvel

1. **Hoje** — plano e retomada.
2. **Imersão** — vídeos, leitor e histórias como fontes.
3. **Revisar** — fila SRS e prática direcionada.
4. **Progresso** — domínio, retenção e metas.
5. **Perfil/Mais** — configurações, ligas, dados e ajuda.

### O que deixa de ser destino principal

- **Cofre:** vira biblioteca pesquisável dentro de Revisar/Imersão, não uma finalidade em si.
- **Jogos:** viram modalidades de Treino.
- **Ligas:** permanecem sociais, mas subordinadas a Progresso e XP qualificado.
- **Estatísticas:** viram Progresso com explicações acionáveis.
- **Configurações avançadas:** ficam em Perfil; opções FSRS avançadas usam divulgação progressiva.
- **Histórias e Leitor:** viram tipos de fonte em Imersão.

## 8. Design e linguagem de interação

### Princípios

- Uma tela, uma decisão principal.
- Informação aparece quando muda a decisão do usuário.
- Detalhe avançado é progressivo, nunca removido.
- Estados vazios ensinam a próxima ação.
- Feedback descreve aprendizagem: “reconheceu sem legenda”, não apenas “+10 XP”.
- Movimento sinaliza causa e progresso; não é confete permanente.
- Mascote/personagem, se adotado, deve atuar como treinador e explicar decisões do sistema.

### Sistema visual

Criar tokens e componentes únicos para:

- cor semântica, tipografia, espaçamento, elevação e movimento;
- botão primário/secundário/perigoso;
- card de tarefa, card de conteúdo e card de dado;
- estados de áudio/vídeo/sincronização;
- feedback correto/incorreto/ajuda;
- navegação, sheets e modais;
- desktop, tablet e mobile com os mesmos contratos.

Não se deve desenhar cada tela isoladamente com CSS embutido. A identidade precisa nascer do sistema e ser validada com snapshots nas larguras críticas.

## 9. Personalização real

O onboarding deve captar:

- objetivo (compreender vídeos, viagem, trabalho, prova, conversação);
- nível estimado e confiança;
- interesses e fontes preferidas;
- tempo disponível;
- preferência de legenda/áudio;
- tolerância a digitação e fala.

A personalização deve mudar o plano, o tipo de exercício, o ritmo de novos itens e as recomendações de conteúdo. Trocar apenas texto, meta de XP ou cor não é personalização.

## 10. Infraestrutura e dados necessários

### Estado real consultado em 2026-07-14

- projeto Supabase saudável;
- 1 usuário em `user_stats`;
- 6 palavras e 6 cards;
- 47 revisões em 6 cards;
- 2 histórias;
- 27.263 registros em `translation_cache`;
- 0 `known_words`, 0 `sentences`, 0 assinaturas push;
- 1 erro registrado em `client_errors`;
- RLS habilitado nas tabelas públicas listadas.

Esses números indicam protótipo funcional com dados reais, mas ainda sem volume para validar retenção, dificuldade, funil ou economia.

### Lacunas

- ledger de eventos de aprendizagem;
- tentativas e respostas por modalidade;
- modelo de fontes/ocorrências/sentidos;
- estado de domínio por habilidade;
- idempotência e validação server-side para eventos não-SRS;
- funil de onboarding e primeiro valor;
- feature flags e versão das regras;
- observabilidade de latência e falhas por jornada;
- política de retenção/agregação para cache e telemetria;
- testes E2E autenticados nas jornadas críticas.

### Dívida estrutural do frontend

As views são arquivos monolíticos com grande volume de HTML e estilos inline. Home, Study, Stories e Settings mantêm regras de produto, acesso a dados, markup, estilos e efeitos no mesmo módulo. Isso não exige uma troca imediata de framework, mas exige separar progressivamente:

- domínio e regras;
- consultas/projeções por jornada;
- estado de sessão;
- componentes visuais;
- telemetria;
- efeitos de mídia.

A Home atualmente consulta e combina dados demais para construir um painel. O plano diário deve vir de uma projeção/RPC própria (`get_today_plan` ou equivalente), com carregamento secundário sob demanda.

### Segurança verificada

Os advisors do Supabase sinalizam funções `SECURITY DEFINER` executáveis por usuários autenticados, incluindo `record_learning_event`, `ensure_user_stats`, `claim_weekly_quest` e outras. Algumas podem ser intencionais, mas cada uma deve passar por revisão de propriedade, parâmetros, privilégios e abuso. A proteção contra senhas vazadas também está desabilitada. Nenhuma mudança foi aplicada nesta auditoria.

Também foi confirmado no schema versionado que `user_stats` possui política de leitura ampla e o leaderboard solicita `select=*`. Como a tabela acumulou timezone, contadores e preferências internas, ranking público deve usar uma projeção mínima separada. RLS e privilégios de tabela são camadas distintas e precisam ser revisados em conjunto.

### Offline, concorrência e operação

- apenas o salvamento de palavra da extensão possui outbox; revisão, jogo, história e sessão não têm fila persistente;
- a outbox existente não possui backoff/jitter, dead-letter ou estado compreensível para o usuário;
- sincronização multiaba/multidispositivo não usa versão base do card;
- rate limits das Edge Functions usam contagem seguida de inserção e podem falhar sob concorrência;
- CI não executa todos os testes existentes de áudio, vídeo, foco e migrations reais;
- não há E2E autenticado obrigatório no preview;
- headers de segurança, Web Vitals, release SHA e alertas de produção não estão configurados de forma verificável no repositório.

## 11. Roadmap por dependência

### Fase 0 — Congelar o acúmulo e medir

- declarar a promessa e a métrica norte;
- mapear jornadas e inventário de funcionalidades;
- definir taxonomia de eventos;
- instrumentar funil e erros;
- criar feature flags;
- estabelecer baseline de performance e acessibilidade.
- observar pelo menos 5 sessões reais e entrevistar 6–8 alunos do público-alvo;
- comparar iniciante, intermediário e usuário experiente de Anki;
- validar um protótipo do ciclo central antes de refazer todas as telas.

**Gate:** conseguimos explicar o próximo passo do usuário e medir se ele ocorreu.

### Fase 1 — Integridade da aprendizagem e economia

- criar ledger idempotente de tentativas;
- XP calculado no servidor;
- retorno decrescente e regras por evidência;
- separar treino livre de revisão SRS;
- revisar RPCs `SECURITY DEFINER` e políticas;
- validar ligas e missões usando XP qualificado.
- mover cálculo/validação do próximo estado FSRS para a transação do servidor;
- exigir versão base e elegibilidade do card para XP competitivo;
- tornar sessão de vídeo incremental, atômica e idempotente;
- impor unicidade de card por usuário/item e corrigir a missão semanal;
- separar projeção pública de leaderboard dos dados privados.

**Gate:** repetir o mesmo jogo não altera progresso competitivo indefinidamente.

### Fase 2 — Modelo contextual

- fonte, ocorrência, item, sentido e item de aprendizagem;
- deduplicação por item/sentido com múltiplos contextos;
- clips confiáveis e lifecycle de processamento;
- migração compatível dos 6 cards atuais.

**Gate:** salvar a mesma expressão em outro vídeo enriquece o aprendizado sem criar lixo.

### Fase 3 — Hoje e plano adaptativo

- Home treinador;
- fila diária por memória, imersão, fixação e produção;
- onboarding baseado em objetivo/tempo/interesse;
- controle de carga de cards novos.

**Gate:** um usuário novo entende o que fazer sem conhecer Anki ou explorar sete abas.

### Fase 4 — Laboratório vídeo + revisão multimodal

- captura imediata e sincronização em segundo plano;
- replay de clip robusto;
- modalidades listening, recall, builder e produção;
- tutor contextual;
- resultado de sessão baseado em domínio.

**Gate:** a cadeia capturar → entender → revisar → reconhecer funciona ponta a ponta em mobile e desktop.

### Fase 5 — Imersão e biblioteca

- vídeos, histórias e leitor em uma mesma arquitetura de fontes;
- retomada, descoberta e agrupamento por fonte;
- reencontro de itens em novos contextos;
- biblioteca como ferramenta, não depósito.

**Gate:** conteúdo consumido alimenta automaticamente o plano de aprendizagem.

### Fase 6 — Progresso, social e motivação

- progresso linguístico explicável;
- conquistas por capacidade, não volume vazio;
- ligas com XP qualificado;
- missões que equilibram revisão, input e produção;
- streak com regras transparentes e recuperação saudável.

**Gate:** incentivos não competem com aprendizagem nem premiam atalhos.

### Fase 7 — Sistema visual e refinamento

- componentes e tokens consolidados;
- eliminar CSS/estilos por tela;
- conteúdo, microcopy, som e movimento coerentes;
- QA visual automatizado e autenticado;
- performance budgets.

**Gate:** o app parece um único produto em todas as superfícies.

## 12. O que não fazer agora

- não adicionar mais um minijogo antes do ledger de aprendizagem;
- não criar uma trilha linear falsa para conteúdo dinâmico;
- não premiar erro/velocidade de forma que distorça o FSRS;
- não colocar mais cards informativos na Home;
- não migrar de framework só por estética;
- não esconder problemas sistêmicos com animações;
- não promover uma grande reformulação diretamente para produção.

## 13. Primeira entrega recomendada

A primeira implementação deve ser a **Fundação de Evidência**, não uma nova tela:

1. especificar eventos e regras de XP;
2. criar ledger idempotente no Supabase;
3. registrar tentativas dos três treinos atuais;
4. calcular XP no servidor com retorno decrescente;
5. criar `review_card_v2` com lock, versão, due e FSRS server-side;
6. criar painel interno simples para auditar eventos;
7. migrar missões/ligas para XP qualificado;
8. testar falsificação, replay, duplicação, offline, multiaba e concorrência.

Em paralelo, produto e design podem prototipar a nova jornada “Hoje → Imersão → Fixação → Revisão”, mas ela só deve virar interface definitiva quando os objetos e eventos que a sustentam estiverem definidos.

## 14. Critério de decisão contínua

Para toda proposta futura, responder:

1. Qual habilidade linguística muda?
2. Que evidência prova essa mudança?
3. Onde entra no ciclo central?
4. Que comportamento indesejado pode incentivar?
5. Como será medida?
6. O que será removido ou simplificado em troca?

Se essas respostas não existirem, a proposta ainda é uma ideia, não uma decisão de produto.
