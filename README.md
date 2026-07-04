# ⚡ LinguaFlow - Aprenda Idiomas Assistindo Vídeos

> **100% Gratuito • 100% Offline • 100% Privado**

Extensão Chrome para aprendizado de idiomas através de vídeos com legendas duplas, dicionário integrado e sistema de repetição espaçada (SRS).

---

## 🎯 Funcionalidades

### 🎬 Legendas Duplas Inteligentes
- ✅ Legenda original (inglês) + Tradução (português)
- ✅ Tradução **instantânea** (< 100ms)
- ✅ Posicionamento otimizado por plataforma
- ✅ Arrastar legendas com mouse
- ✅ Modo blur (tradução borrada até hover)

### 📚 Dicionário Integrado
- ✅ Clique em qualquer palavra para ver definição
- ✅ Pronúncia (IPA) + Áudio nativo
- ✅ Exemplos de uso reais
- ✅ Nível CEFR estimado
- ✅ Frequência da palavra

### 🎴 Sistema SRS (Flashcards)
- ✅ Algoritmo FSRS (Free Spaced Repetition Scheduler)
- ✅ Revisão espaçada inteligente
- ✅ 4 níveis de dificuldade
- ✅ Estatísticas detalhadas
- ✅ Dashboard completo
- ✅ Revisão rápida durante o vídeo (Review Overlay)

### 📖 Biblioteca de Leitura
- ✅ Importe seus próprios textos (colar ou arquivo .txt/.srt/.vtt)
- ✅ Leitura com tradução instantânea, clicando em qualquer palavra
- ✅ Busca local (100% offline) em tudo que você leu ou salvou

### 🎮 Controles por Teclado
- **A** - Legenda anterior
- **S** - Repetir legenda
- **D** - Próxima legenda
- **Q** - Toggle auto-pausa
- **R** - Revisão rápida (Review Overlay)
- **O** - Abrir configurações
- **[ / ]** - Diminuir/aumentar velocidade do vídeo
- **Espaço** - Play/Pause

### 🌐 Plataformas Suportadas
- ✅ YouTube
- ✅ Netflix
- ✅ Prime Video
- ✅ Disney+
- ✅ Max (HBO Max)
- ✅ Sites genéricos com `<video>` + legenda HTML5 nativa (`<track>`) e modo de leitura em qualquer página de texto — clique em "Ativar Nesta Página" no popup da extensão

---

## 🚀 Instalação

### Opção 1: Chrome Web Store (Em Breve)
```
Aguardando aprovação na Chrome Web Store
```

### Opção 2: Instalação Manual

1. **Clone o repositório:**
```bash
git clone https://github.com/seu-usuario/linguaflow.git
cd linguaflow
```

2. **Build (se necessário):**
```bash
npm install
npm run build
```

3. **Carregar no Chrome:**
   - Abrir `chrome://extensions/`
   - Ativar "Modo do desenvolvedor"
   - Clicar em "Carregar sem compactação"
   - Selecionar a pasta do projeto

---

## 📖 Documentação

### Para Usuários
- 📘 [**Guia de Testes**](GUIA_DE_TESTES.md) - Como testar todas as funcionalidades
- 📗 [**Instruções de Build**](INSTRUCOES_BUILD.md) - Como compilar e publicar

### Para Desenvolvedores
- 📕 [**Correções da Auditoria**](CORRECOES_AUDITORIA.md) - Problemas identificados e corrigidos
- 📙 [**Resumo Executivo**](RESUMO_EXECUTIVO.md) - Visão geral completa do projeto

---

## 🎨 Screenshots

### Legendas Duplas
![Legendas Duplas](screenshots/legendas-duplas.png)
*Legenda original em branco + tradução em azul*

### Dicionário Popup
![Dicionário](screenshots/dicionario.png)
*Clique em qualquer palavra para ver definição completa*

### Dashboard
![Dashboard](screenshots/dashboard.png)
*Gerencie seu vocabulário e faça revisões*

### Flashcards
![Flashcards](screenshots/flashcards.png)
*Sistema SRS com algoritmo SuperMemo-2*

---

## 🆚 Comparação com Language Reactor

| Funcionalidade | Language Reactor | LinguaFlow |
|----------------|------------------|------------|
| Legendas Duplas | ✅ | ✅ |
| Tradução Instantânea | ✅ | ✅ |
| Dicionário Integrado | ✅ | ✅ |
| Sistema SRS | ✅ | ✅ |
| Múltiplas Plataformas | ✅ | ✅ |
| Controles por Teclado | ✅ | ✅ |
| **Preço** | **$5/mês** | **GRÁTIS** |
| **Offline** | ❌ | ✅ |
| **Privacidade** | ❌ | ✅ |
| **Open Source** | ❌ | ✅ |

---

## 🔧 Tecnologias

- **Frontend:** Vanilla JavaScript (ES6+)
- **Storage:** IndexedDB
- **APIs:** Google Translate (GTX), Free Dictionary API, Tatoeba
- **Manifest:** V3 (Chrome Extension)
- **Build:** Webpack (opcional)

---

## 📊 Status do Projeto

### ✅ Funcionalidades Implementadas (100%)
- ✅ Legendas duplas em todas as plataformas
- ✅ Tradução instantânea (< 100ms)
- ✅ Dicionário completo com IPA e áudio
- ✅ Sistema SRS com SuperMemo-2
- ✅ Dashboard com estatísticas e Heatmap
- ✅ Exportação para Anki (CSV) ⭐ **NOVO**
- ✅ Modo Shadowing (Treino de Pronúncia) ⭐ **NOVO**
- ✅ Gamificação de Decks (Níveis Bronze/Prata/Ouro) ⭐ **NOVO**
- ✅ Sincronização em tempo real
- ✅ Controles por teclado unificados
- ✅ Painel de configurações profissional

### 🐛 Bugs Conhecidos
Nenhum bug crítico conhecido! 🎉 (Sincronização CC YouTube corrigida).

### 🚀 Próximas Funcionalidades
- [ ] Suporte para mais idiomas (Chinês, Japonês, Coreano)
- [ ] Modo escuro (Dark Mode)
- [ ] Estatísticas avançadas de progresso
- [ ] Integração com Forvo (pronúncia humana)

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Para contribuir:

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

### Diretrizes
- Código modular (ESM)
- Seguir padrão ES6+
- Testar em YouTube e HBO Max (Max)
- Atualizar documentação

---

## 📝 Changelog

### v1.2.0 (04/07/2026)
- ✅ **Biblioteca de Leitura:** nova aba no dashboard para importar textos próprios (colar ou arquivo .txt/.srt/.vtt), com tradução instantânea clicando em qualquer palavra, e busca local (100% offline) em tudo que foi importado ou salvo.
- ✅ **Velocidade de Vídeo:** controle de reprodução (0.25x–2x) com atalhos `[`/`]`, persistente entre sessões.
- ✅ **Sites Genéricos (de verdade):** botão "Ativar Nesta Página" no popup liga legendas duplas em sites com `<video>`+`<track>` nativo e o modo de leitura em páginas de texto, via `activeTab` — sem rodar automaticamente em sites não listados.
- ✅ **N+1 Feed Interativo:** o artigo gerado por IA no dashboard agora tem palavras clicáveis para tradução e salvamento nos flashcards.
- 🔒 **Correção de Segurança:** respostas da IA agora são escapadas antes de renderizar em HTML (previne XSS via prompt injection).
- 🐛 **Correção:** painel de configurações não inicializava mais corretamente devido a um elemento de UI ausente (seletor de cores CEFR).

### v1.1.0 (02/05/2026)
- ✅ **Exportação para Anki:** Botão dedicado no dashboard para exportar vocabulário.
- ✅ **Gamificação:** Sistema de níveis para decks baseado em palavras maduras.
- ✅ **Shadowing Mode:** Prática de repetição ativa no popup de dicionário.
- ✅ **Consolidação Técnica:** Remoção de módulos redundantes e unificação de atalhos.
- ✅ **Sync CC:** Sincronização automática entre botão LinguaFlow e CC nativo do YouTube.

### v1.0.0 (25/04/2026)
- ✅ Lançamento inicial
- ✅ Suporte para YouTube, Netflix, Prime, Disney+, Max
- ✅ Legendas duplas com tradução instantânea
- ✅ Dicionário integrado
- ✅ Sistema SRS completo
- ✅ Dashboard e estatísticas

---

## 📄 Licença

MIT License - Veja [LICENSE](LICENSE) para detalhes.

---

## 🙏 Agradecimentos

- **Free Dictionary API** - Dicionário gratuito
- **Google Translate** - API de tradução
- **Tatoeba** - Exemplos de frases
- **MyMemory** - Tradução de backup
- **SuperMemo** - Algoritmo SRS

---

## 📞 Suporte

### Problemas?
1. Verificar [Guia de Testes](GUIA_DE_TESTES.md)
2. Abrir uma [Issue](https://github.com/seu-usuario/linguaflow/issues)
3. Email: extensao.linguaflow@gmail.com

### Redes Sociais
- Twitter: [@linguaflow](https://twitter.com/linguaflow)
- Discord: [LinguaFlow Community](https://discord.gg/linguaflow)

---

## ⭐ Star History

Se você gostou do projeto, dê uma ⭐!

[![Star History Chart](https://api.star-history.com/svg?repos=seu-usuario/linguaflow&type=Date)](https://star-history.com/#seu-usuario/linguaflow&Date)

---

## 🎯 Roadmap

### Q2 2026
- [ ] Publicar na Chrome Web Store
- [ ] Suporte para Firefox
- [ ] Modo escuro
- [ ] Mais idiomas

### Q3 2026
- [ ] App mobile (React Native)
- [ ] Integração com Anki
- [ ] API pública
- [ ] Comunidade de usuários

### Q4 2026
- [ ] IA para recomendações personalizadas
- [ ] Gamificação
- [ ] Certificados de conclusão
- [ ] Marketplace de conteúdo

---

<div align="center">

**Feito com ❤️ por desenvolvedores que amam idiomas**

[⬆ Voltar ao topo](#-linguaflow---aprenda-idiomas-assistindo-vídeos)

</div>
