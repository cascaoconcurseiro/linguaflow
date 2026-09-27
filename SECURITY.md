# Política de Segurança — LinguaFlow

A segurança e a privacidade dos dados de aprendizagem dos nossos usuários são prioridades fundamentais no **LinguaFlow**.

---

## 🔒 Versões Suportadas

Apenas a versão ativa mais recente recebe patches de segurança:

| Versão | Suportada |
|---|---|
| 3.0.x | :white_check_mark: Sim |
| < 3.0.0 | :x: Não |

---

## 🛡️ Diretrizes de Arquitetura de Segurança

1. **Row Level Security (RLS)**: 100% das tabelas que armazenam dados de usuários operam com RLS estrito no Supabase PostgreSQL. Nenhuma leitura ou escrita pública é permitida fora de tabelas exclusivamente de catálogo.
2. **Segredos e Chaves de API**: Nenhuma chave de API privada (Gemini, DeepSeek, OpenAI, Supabase Service Role) reside no cliente web ou na extensão Chrome. Todas as chamadas de IA passam por Supabase Edge Functions autenticadas via JWT.
3. **Isolamento de Sessão**: A extensão (`chrome.storage.local`) e a PWA operam com isolamento estrito. Tokens de autenticação nunca são expostos em parâmetros de URL ou compartilhados abertamente entre domínios.
4. **Sanitização de Dados**: Entradas de legendas de terceiros e respostas de IA são sanitizadas contra injeção de código (XSS) antes da renderização no DOM.

---

## 🚨 Como Reportar uma Vulnerabilidade

Se você identificou uma potencial vulnerabilidade de segurança:

1. **Não abra uma Issue pública** para falhas de segurança críticas.
2. Utilize a funcionalidade de **[Advisories Privados de Segurança do GitHub](https://github.com/cascaoconcurseiro/linguaflow/security/advisories/new)** do repositório.
3. Forneça detalhes de reprodução passo a passo, impacto estimado e, se possível, uma sugestão de correção.

Nossa equipe revisará o relatório prontamente e disponibilizará a correção na versão mais recente.
