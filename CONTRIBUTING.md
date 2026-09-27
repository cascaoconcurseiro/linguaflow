# Guia de Contribuição — LinguaFlow

Obrigado pelo interesse em contribuir com o **LinguaFlow**! Este documento orienta sobre o fluxo de desenvolvimento, padrões de engenharia e como submeter melhorias.

---

## 🚀 Como Começar

### Pré-requisitos
- Node.js 18+ (recomendado 20+)
- Google Chrome (para testes com a extensão Manifest V3)
- Git configurado

### Setup Local
```bash
# 1. Clone o repositório
git clone https://github.com/cascaoconcurseiro/linguaflow.git
cd linguaflow

# 2. Instale as dependências
npm install

# 3. Execute a suíte de testes completa
npm test
```

---

## 🏛️ Diretrizes de Engenharia

O LinguaFlow opera sob princípios rígidos de integridade pedagógica e arquitetural:

1. **Autoridade Server-Side**: O banco Supabase com Row Level Security (RLS) é a única autoridade para cálculo de repetição FSRS v4.5 e pontuação de XP. O cliente nunca grava dados diretamente ou calcula estabilidade/dificuldade sem passar pelas RPCs seguras.
2. **Vanilla JS & Módulos ES**: O dashboard PWA e a extensão utilizam JavaScript nativo e CSS modular sem dependência de transpiladores (Webpack/Babel). Mantenha o código limpo, legível e aderente aos padrões da web.
3. **Segurança por Padrão**: Toda entrada da web ou de IA deve ser sanitizada. Segredos de API residem exclusivamente nas Edge Functions do Supabase; nunca no cliente ou no repositório.
4. **Respeito ao Usuário**: Respeite `prefers-reduced-motion`, garanta alvos de toque mínimos de 44px e acessibilidade por teclado em todas as interfaces.

Para detalhes completos de fluxos e contratos, consulte [docs/ARQUITETURA.md](docs/ARQUITETURA.md).

---

## 🌿 Fluxo Git e Branches

- **Branch Principal**: `main` é a branch de produção estável.
- **Branches de Trabalho**: Crie branches a partir de `main` com nomes semânticos:
  - `feat/nome-da-funcionalidade`
  - `fix/descricao-do-bug`
  - `docs/atualizacao-documentacao`
  - `refactor/modulo-alvo`

### Padrão de Commits
Adotamos [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: adiciona suporte a atalhos customizáveis`
- `fix: normaliza pontuação em fragmentos de legendas`
- `docs: documenta fluxo de sincronização offline`
- `test: adiciona contratos para expiração de sessão`

---

## 🧪 Testes Automatizados

Nenhum código é mesclado sem passar por 100% da suíte de testes:

```bash
# Suíte completa e release smoke gate
npm test

# Testes específicos por domínio
npm run test:fsrs     # Agendador FSRS v4.5 e integridade matemática
npm run test:ext      # Extensão Chrome, legendas e injeção
npm run test:ui       # Componentes de interface e acessibilidade
npm run test:db       # Contratos de banco e RLS
```

---

## 📬 Submissão de Pull Requests

1. Abra uma **Issue** no GitHub antes de iniciar grandes alterações para alinhar o escopo.
2. Certifique-se de que `npm test` passa localmente com working tree limpa.
3. Abra o Pull Request apontando para `main`.
4. Preencha o template de PR referenciando a issue correspondente (`Closes #123` ou `Refs #123`).
5. Aguarde a validação do CI do GitHub Actions (`release.yml`).
