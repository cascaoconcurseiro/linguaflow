# Contrato de fluência A1–B2 — LinguaFlow

Data: 2026-07-28
Status: contrato canônico da fundação; geração inédita e avaliação autoritativa ainda não implementadas.

## 1. Promessa verificável

O LinguaFlow deve ajudar a pessoa a compreender e usar o idioma em situações reais. Retenção de cartões, tempo de uso, XP, ofensiva e posição na liga não são evidência suficiente de fluência.

O produto só pode apresentar progresso comunicativo quando houver amostras válidas de desempenho em tarefas com objetivo, destinatário, nível-alvo, limite de ajuda e rubrica conhecidos. Uma tentativa nunca certifica um nível.

## 2. O que o check observa

| Habilidade | Evidência mínima | Contaminação a evitar |
|---|---|---|
| Escuta inédita | Compreender uma mensagem ainda não vista e cumprir uma tarefa sobre ela | legenda, tradução, transcrição anterior |
| Fala espontânea | Responder sem roteiro, repetição ou frase-modelo | leitura em voz alta apresentada como fala livre |
| Escrita funcional | Produzir uma mensagem para objetivo e destinatário definidos | copiar ou adaptar texto fornecido |
| Interação | Reagir, esclarecer e sustentar mais de um turno | pergunta única sem reação ao interlocutor |

Leitura, fala preparada e mediação podem ser adicionadas depois, mas não substituem as quatro evidências centrais.

## 3. Descritores operacionais A1–B2

Os descritores executáveis estão em `dashboard/js/core/fluencyCheck.js`. Eles traduzem o princípio CEFR de “o que a pessoa consegue fazer” para famílias de tarefa:

- A1: necessidades imediatas, informação pessoal e trocas muito apoiadas;
- A2: situações previsíveis, rotinas, pedidos e mensagens simples;
- B1: relatos conectados, explicações e conversa sobre temas familiares;
- B2: argumentos, posições, negociação de significado e ajuste ao destinatário.

O nível observado nunca pode ser superior ao nível-alvo da tarefa.

## 4. Rubrica comum

Cada dimensão recebe valor inteiro de 0 a 3:

- 0 — não produz evidência utilizável ou não cumpre a função comunicativa;
- 1 — cumpre parcialmente, com ruptura frequente ou dependência de apoio;
- 2 — cumpre o essencial do descritor-alvo de modo compreensível;
- 3 — cumpre com segurança e margem acima do mínimo do descritor-alvo.

Dimensões centrais:

- conclusão da tarefa;
- compreensibilidade;
- fluidez;
- controle linguístico;
- alcance lexical, quando aplicável.

Uma tentativa atende ao nível-alvo somente quando:

1. é válida e não excede o limite de ajuda;
2. nenhuma dimensão crítica recebe 0;
3. conclusão da tarefa recebe ao menos 2;
4. a mediana das dimensões é ao menos 2.

## 5. Força da evidência

O produto comunica força, não certeza falsa:

| Estado | Regra mínima |
|---|---|
| `sem_evidencia` | nenhuma tentativa válida |
| `amostra_inicial` | ao menos uma tentativa válida |
| `provavel` | ao menos três tentativas válidas, em dois dias e duas famílias de tarefa |
| `consistente` | ao menos seis tentativas ao longo de 21 dias; quatro das cinco mais recentes atendem ao alvo, incluindo a última |

O estado é calculado por habilidade e nível-alvo. Evidência inválida permanece auditável, mas não fortalece a conclusão.

## 6. Relação com o método existente

O ciclo de aprendizagem passa a ter quatro funções distintas:

1. **Encontrar e compreender** — conteúdo real, legenda, popup e explicação contextual;
2. **Consolidar** — recuperação espaçada pelo FSRS;
3. **Transferir** — tarefas novas de escuta, produção e interação;
4. **Verificar** — check semanal com estímulos inéditos e rubrica estável.

FSRS decide quando revisar uma memória. O check de comunicação decide se existe evidência de uso. Nenhuma tabela, RPC ou pontuação de uma função pode atualizar silenciosamente a outra.

## 7. Autoridade, segurança e privacidade

- Registros enviados pelo cliente são sempre `evaluation_authority = 'client'` e `authoritative = false`.
- Uma avaliação autoritativa exigirá função server-side ou revisão humana em uma etapa posterior.
- `learning_task_attempts` é append-only para o cliente e separada de cards, reviews, XP, ofensiva, missões e liga.
- Repetir o mesmo `client_attempt_id` com conteúdo diferente gera `idempotency_conflict`.
- O cliente autenticado lê somente as próprias tentativas e escreve apenas pela RPC estreita.
- O banco aceita somente metadados de evidência em lista permitida; não guarda áudio, transcrição, resposta livre, segredo ou texto bruto.
- Horários declarados pelo cliente fora da janela operacional são rejeitados.

## 8. Sequência de entrega

### Corte 1 — fundação local

- contrato A1–B2 e motor puro;
- migration expand-only e RPC não autoritativa;
- rota interna acessível em Progresso;
- linguagem explícita de que ainda não existe atribuição de nível.

### Corte 2 — tarefas válidas

- catálogo versionado de tarefas por nível e habilidade;
- estímulos inéditos entregues pelo servidor;
- cronômetro, limites de replay e registro de ajuda;
- uma tarefa por tela, com teclado, leitor de tela e estados de erro completos.

### Corte 3 — avaliação

- avaliador server-side versionado;
- calibração humana e conjunto de respostas-âncora;
- explicação por dimensão, sem nota única opaca;
- auditoria de viés, estabilidade e falsos positivos.

### Corte 4 — plano adaptativo

- usar lacunas verificadas para escolher produção, interação e conteúdo;
- recomendar prática sem alterar FSRS indevidamente;
- mostrar evolução por habilidade e força da evidência;
- medir transferência para tarefas inéditas em D7, D30 e D90.

## 9. Portões de lançamento

O check não pode atribuir nível enquanto qualquer item abaixo estiver ausente:

- estímulo inédito controlado no servidor;
- identidade e versão da tarefa;
- limite de assistência observável;
- avaliador autoritativo versionado;
- rubrica explicável;
- repetição em dias e famílias diferentes;
- teste de isolamento entre usuários;
- política de retenção e exclusão dos dados;
- validação de acessibilidade em mobile, tablet e desktop.
