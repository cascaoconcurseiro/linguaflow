# Etapa 4 — Arquitetura de experiência

Responsável: Codex, frente sênior de produto, UX, design e fluxo.
Data: 2026-07-15.

## Objetivo

Transformar o aplicativo de uma coleção de recursos em uma jornada de aprendizagem por vídeo e repetição espaçada. O poder do Anki continua disponível, mas aparece conforme a intenção do usuário; a orientação diária do Duolingo é usada sem fazer XP substituir evidência de aprendizagem.

## Decisões entregues

- **Home:** ordem Hoje → Missões → Insights → Conquistas. “Continuar seu plano” é a ação dominante; prática livre é secundária e competição fica recolhida.
- **Cofre:** busca sempre visível; tipos em chips; estado e A–Z em “Mais filtros”; editar, suspender e excluir ficam no menu contextual de cada frase.
- **Histórias:** “Criar” e “Ler” são modos separados. Histórico tem vazio acionável e itens abertos por clique ou teclado.
- **Configurações:** os controles foram preservados e agrupados em Seu aprendizado, Memória, Som e lembretes, Dados e conta e Avançado. Apenas o primeiro abre inicialmente.
- **Mobile:** navegação fixa com Início, Conteúdo, Cofre e Mais. Leitor, ligas, progresso, configurações, tema e saída ficam no menu Mais; o modo foco continua sem navegação concorrente.
- **Estados:** Home e Cofre distinguem carregamento de falha; o Cofre oferece retry sem representar indisponibilidade como coleção vazia, e vazio por filtro oferece limpeza imediata. Histórias anuncia o carregamento do histórico e oferece criação no primeiro uso.
- **Economia:** missões não pagam uma segunda recompensa pelas mesmas revisões; metas de “ganhar XP” e “salvar palavras” foram removidas; jogos repetíveis são prática livre sem XP, ofensiva ou liga.

## Regras de design

1. Uma CTA primária por contexto.
2. Recursos raros ou destrutivos entram por divulgação progressiva.
3. Estado do SRS é chamado de estado da memória, não de domínio do idioma.
4. Alvos têm no mínimo 40–44 px; foco, `aria-current`, tabs semânticas e Escape fazem parte do contrato.
5. Breakpoints explícitos cobrem 320, 340, 375 e 390 px, com safe area inferior.

## Preservação funcional

Nenhum ID usado pelos listeners foi removido. Os painéis de Configurações são movidos no DOM antes da ligação de eventos; Cofre mantém editar, suspender, excluir e revisar tópico; Histórias mantém geração, leitura, TTS, quiz e salvamento.

## Verificação

`npm run test:product-ux` valida hierarquia, divulgação progressiva, semântica de navegação, teclado e breakpoints. A aprovação final ainda exige teste visual autenticado no preview nas larguras 320, 375 e 390 px.
