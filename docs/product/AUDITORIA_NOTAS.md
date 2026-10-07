# Auditoria de qualidade das notas (#544)

Gerado por `npm run content:notes`; não edite manualmente. Mede o que é verificável por máquina e **não aprova** qualidade pedagógica: a revisão humana por amostragem (`npm run content:review`) continua pendente. Nenhuma frase foi alterada ou removida.

## Resumo

| Medida | Unidades | % |
|---|---:|---:|
| Total de unidades | 4704 | 100% |
| Com nota de explicação | 3984 | 84.7% |
| Sem nota | 720 | 15.3% |
| Nota curta (< 25 caracteres) | 462 | 9.8% |
| Nota repetida em 5+ unidades (79 textos) | 656 | 13.9% |
| Nota sem nenhuma palavra da frase | 1154 | 24.5% |

## Por tipo de unidade

| Tipo | Unidades | Sem nota | Com estrutura da frase (grupos sintáticos) |
|---|---:|---:|---:|
| slang_idiom | 10 | 0 | 0 (0.0%) |
| sentence | 3234 | 0 | 358 (11.1%) |
| word | 1000 | 720 | 0 (0.0%) |
| verb_forms | 100 | 0 | 0 (0.0%) |
| phrasal | 200 | 0 | 0 (0.0%) |
| story | 80 | 0 | 0 (0.0%) |
| paragraph | 80 | 0 | 0 (0.0%) |

## Notas mais repetidas

- 21x: regular.
- 19x: futuro com "will".
- 8x: use estas fórmulas para pedir ajuda durante uma conversa. “please” torna o pedido educado; “mean” pergunta o significado.
- 8x: “a/an” apresenta um elemento; “the” aponta algo identificado. a escolha entre “a” e “an” depende do som seguinte.
- 8x: use o plural para mais de um elemento. muitos nomes recebem “-s”; “children” e “people” são formas irregulares frequentes.
- 8x: “this/these” indica proximidade; “that/those”, distância. “this/that” acompanha singular; “these/those”, plural.
- 8x: “have/has” expressa posse. com “does/doesn't”, o verbo volta a “have”. “have got” também é comum, sobretudo no inglês britânico.
- 8x: pronomes de objeto recebem a ação ou vêm depois de preposições: “me”, “him”, “her”, “us” e “them”. “you” não muda.
- 8x: o possessivo “'s” indica de quem é algo. “my/your” vem antes do nome; “mine/yours” substitui o nome quando já está claro.
- 8x: adjetivos podem vir depois de “be” ou antes do substantivo. para idade, use “be”, não “have”: “she is twenty”.
- 8x: advérbios como “usually” vêm normalmente antes do verbo principal e depois de “be”. “never” já tem sentido negativo.
- 8x: “some” é comum em afirmações e ofertas; “any”, em perguntas neutras e negativas. nesta aula, aprenda os padrões com comida e objetos.
- 8x: “and” acrescenta informação, “but” contrasta e “because” dá uma razão. use-os para unir ideias curtas que você já conhece.
- 8x: para uma ação em andamento agora, use “am/is/are” + verbo com “-ing”. na pergunta, “am/is/are” vem antes do sujeito.
- 8x: para eventos concluídos, use o passado. em perguntas e negativas com “did/didn't”, o verbo fica na base: “did you go?”.

## Amostras para revisão humana

### Notas curtas
- unit-street-a1-03-02: "That's so cool!" → "cool" = legal, massa.
- unit-street-a1-03-07: "That makes sense." → mostrar que entendeu.
- unit-street-a1-03-08: "Good for you!" → parabenizar alguém.
- unit-street-a1-04-02: "Could you give me a hand?" → "give a hand" = ajudar.
- unit-street-a1-04-06: "Don't worry about it." → tranquilizar alguém.
- unit-street-a1-11-07: "That's not fair." → neutro. "fair" = justo.
- unit-street-a1-12-04: "Thanks, I owe you one." → revisão de favores.
- unit-street-a1-12-05: "You nailed it." → revisão de elogios.
- unit-street-a1-12-07: "No worries, talk soon." → revisão de mensagens.
- unit-street-a1-12-08: "I'm broke this month." → revisão de dinheiro.
- unit-travel-a2-01-02: "Can I have a window seat?" → "aisle seat" = corredor.
- unit-travel-a2-01-07: "Boarding starts in twenty minutes." → aviso comum no portão.

### Notas sem palavra da frase
- unit-street-a1-02-09: "I'm on my way." → frase fixa para avisar que já saiu.
- unit-street-a1-02-10: "Running late, be there in ten." → mensagem curta: o sujeito "i'm" some na fala informal.
- unit-street-a1-03-03: "Tell me about it." → apesar da forma, significa "concordo totalmente".
- unit-street-a1-03-04: "I know, right?" → concordar com empolgação.
- unit-street-a1-03-05: "Fair enough." → aceitar o argumento do outro.
- unit-street-a1-03-06: "I'm not sure about that." → discordar de leve, sem ser grosso.
- unit-street-a1-03-07: "That makes sense." → mostrar que entendeu.
- unit-street-a1-03-08: "Good for you!" → parabenizar alguém.
- unit-street-a1-03-10: "Whatever you want." → deixar a escolha para o outro.
- unit-street-a1-04-03: "Do you mind if I sit here?" → resposta "no" = pode sentar.
- unit-street-a1-04-05: "No problem, anytime." → resposta comum a "thanks".
- unit-street-a1-04-06: "Don't worry about it." → tranquilizar alguém.

## Como usar

Notas repetidas e sem relação com a frase são candidatas a reescrita, por lote, com revisão humana; frases sem grupos sintáticos dependem das Issues #510 e #507. O painel de explicação já mostra palavra por palavra e o foco da aula quando não há estrutura (#544).
