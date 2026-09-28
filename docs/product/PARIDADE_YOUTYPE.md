# Paridade funcional com o YouType (/learn)

Auditoria feita em 2026-09-27 na sessão do próprio usuário (Chrome já logado; a
senha nunca foi digitada). Reproduzimos **funções e fluxos**, não conteúdo,
código, áudio ou marca do YouType. Áudio: voz neural do LinguaFlow (Edge TTS).

| Tela do YouType | Função observada | LinguaFlow | Estado |
|---|---|---|---|
| `/learn` (Home) | Continuar curso com progresso do capítulo; semana com check-in diário; revisão do dia; hoje / semana / total / dias de estudo; estudados recentemente; "View analysis" | Cursos › Início: trilha por nível + "Fazer agora", continuar, semana, revisão do dia, métricas, recentes, link para Análise | Pronto |
| `/courses` (loja) | Catálogo por nível e tema, busca, filtros, "My courses" | Loja de cursos: agrupada por trilha, busca, filtro de nível, ordenação, + Meus cursos | Pronto |
| `/courses/<curso>` | Lista de capítulos com progresso e "próximo" | Página do curso com progresso por capítulo e selo "Próximo" | Pronto |
| `…/prepare` | Escolher dificuldade (fácil/médio/difícil) e ajustes antes de começar | Modal de preparo: 3 modos com descrição, lembra o último, configurações | Pronto |
| `/practice…?difficulty=&mode=audio` | Ouvir e digitar; dica por palavra; mostrar resposta com análise; pular; anterior; repetir áudio; velocidade; leituras; atalhos; pausa; tema escuro; pontos, combo e tempo | Player: todas essas ações, atalhos Ctrl+' / Ctrl+Shift+; / Ctrl+; / Esc, velocidade 0,5–2×, leituras 1–8, tema, pontos, combo, tempo, sessão incompleta salva | Pronto |
| `/my-courses` | Cursos em andamento | Meus cursos | Pronto |
| `/review` | Revisão espaçada das frases | Revisão | Pronto |
| `/mistakes` | Caderno de erros e treino | Erros (com treino) | Pronto |
| `/vocabulary` | Vocabulário salvo | Vocabulário | Pronto |
| `/notes` | Anotações por frase | Notas | Pronto |
| Análise e ranking | Estatísticas de estudo e classificação | Análise (mapa de calor) e Ranking | Pronto |
| Catálogo | Dezenas de cursos (viagem, 600 palavras, histórias, etc.) com muitos capítulos | 6 cursos publicados; mapa em `MAPA_DE_CONTEUDO.md` | **Em andamento (Fase 3)** |
| Pet de IA | Mascote decorativo | Fora de escopo (gamificação decorativa, ver AGENTS.md) | Excluído |
| Planos pagos | Capítulos pagos | Tudo gratuito (política do projeto) | Excluído |

Pendências de paridade (Fase 4): auditoria visual lado a lado de cada estado,
animações funcionais de acerto/erro/combo com `prefers-reduced-motion`, trocar o
`confirm()` nativo de "Sair da prática" por diálogo próprio, e restaurar a rota
de Cursos ao recarregar a página.
