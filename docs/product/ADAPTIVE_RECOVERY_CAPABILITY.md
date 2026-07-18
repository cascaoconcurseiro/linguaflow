# Capacidade: recuperação adaptativa por card

## Resultado do usuário

O LinguaFlow identifica quando um card está difícil sem transformar uma simples saída de tela em erro. Após sinais repetidos ou fortes, conduz o aluno por palavra isolada, produção guiada e novo contexto. O card volta ao fluxo normal somente após duas recuperações corretas sem ajuda.

## Contrato funcional

- FSRS permanece como única autoridade para a data da próxima revisão.
- O perfil adaptativo altera a modalidade pedagógica, nunca fabrica reviews.
- Evidências consideradas: erro, abandono após engajamento, tempo de resposta, repetição de áudio e abertura de ajuda.
- Um abandono só é registrado após revelar/interagir por pelo menos cinco segundos.
- Cada evento possui UUID idempotente; reenvio não duplica evidência.
- Perfis e eventos pertencem ao usuário autenticado e são protegidos por RLS.
- Texto estudado, gravações e respostas livres não entram na telemetria adaptativa.

## Progressão

1. Normal: rotação existente de modalidades.
2. Foco na palavra: recordação clássica em unidade mínima.
3. Contexto guiado: builder ou ditado curto, conforme nível e disponibilidade.
4. Contexto variado: prática produtiva antes de retornar à rotação normal.

Cada duas respostas corretas, rápidas e sem ajuda recuam uma etapa. Erro ou abandono eleva a intervenção; demora ou ajuda impedem uma falsa recuperação.

## Limites e falhas

- Falha ao salvar a evidência não bloqueia a revisão FSRS já confirmada.
- Falha ao carregar perfis mantém o modo anterior e não impede estudar.
- Áudio é pré-carregado silenciosamente; cache e chamadas concorrentes compartilham a mesma promessa.
- A primeira execução ainda depende da rede se o áudio não existir em cache, mas o clique deixa de iniciar essa espera na maioria dos cards visíveis.

## Verificação de aceite

- Isolamento entre usuários provado por RLS e teste de contrato.
- Idempotência garantida por `(user_id, client_event_id)`.
- Motor puro coberto em transições 0–3 e recuperação sem ajuda.
- Fluxo completo coberto pelo conjunto `test:release` e verificação no deploy.
