# LinguaFlow

Extensão Chrome e PWA para aprender inglês com vídeos, leitura, histórias e revisão espaçada. O progresso autenticado é sincronizado pelo Supabase entre computador e celular.

[Abrir o aplicativo](https://linguaflow-web-tau.vercel.app) · [Reportar problema](https://github.com/cascaoconcurseiro/linguaflow/issues)

## O que existe hoje

- Primeiro acesso direto ao dashboard, sem guia obrigatório ou teste inicial imposto.
- Legendas interativas em YouTube, Netflix, Max, Disney+ e Prime Video.
- Tradução, contexto, pronúncia, classificação CEFR e salvamento de palavras e expressões.
- Cofre de vocabulário com busca, filtros e estados de aprendizagem.
- Revisão espaçada baseada em FSRS, com etapas de aprendizagem e desfazer seguro.
- Treino de escuta, reconhecimento e reconstrução de frases, sem captura de voz do aluno.
- Histórias geradas no nível do aluno e Web Reader para textos próprios.
- Placement opcional nas configurações e Check de comunicação A1–B2 com evidência separada de
  cards, XP e liga.
- PWA instalável no celular e dashboard responsivo no computador.
- Estatísticas baseadas em revisões e sessões gravadas para o usuário autenticado.
- XP e ofensiva registrados no servidor com eventos deduplicados.
- Tema claro/escuro, áudio natural com fallback e funcionamento parcial offline.

O LinguaFlow é gratuito para o usuário, mas recursos de tradução, áudio e geração dependem de serviços externos gratuitos ou configurados no servidor. Portanto, o produto não é “100% offline”.

## Fonte dos dados

O Supabase é a fonte de verdade para vocabulário, cards, revisões, progresso competitivo, histórias, textos do Reader, sessões e preferências pedagógicas. Armazenamento local é usado para sessão, cache, preferências específicas do dispositivo e contingência offline.

A situação completa e as exceções conhecidas estão em [Arquitetura de dados](docs/ARQUITETURA_DADOS.md).

## Arquitetura

| Camada | Responsabilidade |
| --- | --- |
| Extensão MV3 | Integração com players, legendas, Web Reader e captura de contexto |
| PWA Vanilla JS | Dashboard, revisão, biblioteca, histórias, treino e estatísticas |
| Supabase | Auth, Postgres com RLS, Edge Functions, eventos e sincronização |
| Vercel | Hospedagem do PWA e rotas estáticas |

Não há etapa de build para carregar a extensão. O projeto usa módulos JavaScript nativos.

## Instalação para desenvolvimento

```bash
git clone https://github.com/cascaoconcurseiro/linguaflow.git
cd linguaflow
npm install
npm run test:release
```

Para testar a extensão:

1. Abra `chrome://extensions`.
2. Ative o modo do desenvolvedor.
3. Escolha **Carregar sem compactação**.
4. Selecione a raiz deste repositório.

O PWA publicado está em [linguaflow-web-tau.vercel.app](https://linguaflow-web-tau.vercel.app).

## Testes

```bash
npm run test:release
```

A suíte cobre motor FSRS, concorrência de áudio e vídeo, autenticação,
fronteiras de dados, estatísticas, UX, segurança das escritas, fluência e
contratos das migrations. Ela não substitui QA autenticado no Chrome, áudio
ouvido ou validação live.

`npm run test:p1-c` cobre entrada direta e cancelamento da Home;
`npm run test:ai-routing` cobre contexto, pronúncia e login da extensão.

## Estado do projeto

O produto está em desenvolvimento ativo no build `3.0.33`. Os contratos
automatizados estão verdes; o gate atual é validar no navegador autenticado o
primeiro acesso sem guia, o Check de comunicação, a voz natural e o Professor
na extensão recarregada. Validação local em 05/09/2026: release completo e
qualidade de tradução passaram; `npm audit --omit=dev --audit-level=high`
retornou zero vulnerabilidades conhecidas. A rubrica de
fluência é própria e alinhada a descritores CEFR; não é exame oficial nem
certificação Cambridge.

Veja [Estado atual](docs/ESTADO_ATUAL_2026-07-29.md),
[Comece aqui](docs/COMECE_AQUI.md),
[Backlog atual](docs/BACKLOG_PRODUTO_2026-07-17.md) e
[Changelog](CHANGELOG.md). Planos e auditorias consolidados são tratados pela
[política de histórico](docs/HISTORY.md).

## Privacidade e segurança

- Dados por usuário protegidos por RLS no Supabase.
- Chaves privadas ficam no servidor; a extensão contém apenas credenciais públicas apropriadas ao cliente.
- O conteúdo estudado não é colocado no ledger competitivo de XP.
- Relatórios de erro armazenam metadados limitados, sem mensagem ou conteúdo sensível.
- IA exclusivamente DeepSeek por Edge Functions autenticadas, com cota por usuário.
- PWA e extensão usam a mesma conta, mas mantêm sessões independentes. O popup
  oferece login próprio e retoma o contexto aberto após autenticação.

## Licença

[MIT](LICENSE)
