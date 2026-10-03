# Público e promessa

> **Status: proposta (Issue #427).** Foi escrita a partir do que o código já entrega e do que o
> README já afirma. A decisão final é do dono do produto: se mudar, atualize este arquivo e a
> tela "Primeiros passos" (`dashboard/js/ui/firstSteps.js`).

## Para quem

Adultos brasileiros que **já assistem coisas em inglês** (séries, YouTube, filmes) e sentem que
entendem só uma parte — nível A2 a B2. Não é para quem quer um curso do zero nem um certificado.

## Promessa (uma frase)

> Entenda o que você assiste em inglês e não esqueça mais as palavras.

## O caminho principal (o que a pessoa faz primeiro, e por quê)

| Passo | O que acontece | Por que é o primeiro |
| --- | --- | --- |
| 1. Instalar a extensão | LinguaFlow passa a existir dentro do player | Sem ela não há legenda clicável: é o diferencial |
| 2. Abrir um vídeo e ligar o botão LF | Legenda com tradução e palavras clicáveis | O aluno vive o valor em minutos, no conteúdo que já gosta |
| 3. Clicar numa palavra e salvar | A frase real do vídeo vira um cartão | É o momento "aha": a palavra tem contexto e memória |
| 4. Voltar para revisar | A revisão espaçada traz a palavra na hora certa | É aqui que "não esquecer" acontece (retenção) |

## O que é apoio (não é a porta de entrada)

- **Histórias e leitor:** fonte alternativa de frases quando não há vídeo à mão.
- **Cursos:** prática dirigida de escuta e digitação para quem quer estrutura.
- **Check de fluência:** medida de progresso, não um exame oficial.
- **Ligas, ofensiva e XP:** reforço de hábito; nunca bloqueiam o aprendizado livre.
- **Administração:** operação interna.

## Como saberemos se a promessa se cumpre

O funil de uso (Issue #426, Visão geral do admin) mede: abriu player → ligou o LF → salvou uma
palavra → fez uma revisão. A meta inicial a validar com usuários reais é **a maioria dos novos
usuários salvar a primeira palavra no mesmo dia**. Os números só existem para quem fez login.

## O que ainda depende de pessoas, não de código

- Conferir com 5 a 10 usuários do público acima se a promessa é entendida.
- Decidir a distribuição da extensão (loja do Chrome × download direto). Hoje o link do passo 1
  aponta para a última release no GitHub.
