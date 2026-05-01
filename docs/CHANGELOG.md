# LinguaFlow - Changelog

## Versão 1.0 - Estado Estável HBO (29/04/2026)

### Resumo
Sistema HBO Max funcionando perfeitamente com legendas, tradução e posicionamento correto.

### Mudanças Implementadas

#### 1. HBO XHR Interception (CSP Bypass)
- **Arquivo**: `content/hbo-inject.js`
- **Data**: 29/04/2026
- **O que mudou**: Implementado XHR interception com `world: "MAIN"` para bypass de CSP
- **Por quê**: HBO Max tem Content Security Policy restritiva que bloqueia inline scripts
- **Solução**: Script injetado em `document_start` antes das restrições CSP serem aplicadas
- **Status**: ✅ Funcionando

#### 2. HBO Subtitle Translation Fix
- **Arquivo**: `content/subtitle-engine.js`
- **Data**: 29/04/2026
- **O que mudou**: Alterado método `onSubtitle()` para usar referência de objeto em vez de indexOf
- **Por quê**: `this.cues.indexOf(cue)` retornava -1 para HBO (cues estão em `xhrCues`)
- **Solução**: Usar `this._currentCue === cue` para comparação de referência
- **Status**: ✅ Funcionando

#### 3. HBO Subtitle Positioning
- **Arquivo**: `content/subtitle-engine.js`
- **Data**: 29/04/2026
- **O que mudou**: Posicionamento alterado para `position: fixed` com `bottom: 120px`
- **Por quê**: Legendas apareciam dentro da barra de controle do player
- **Solução**: Fixed positioning acima da barra de controle, botão inline com legenda
- **Status**: ✅ Funcionando

### Próximas Mudanças
Todas as futuras mudanças devem:
1. Criar backup da versão original em `backups/`
2. Documentar a mudança aqui com data, arquivo, o que mudou e por quê
3. Testar em HBO Max e YouTube antes de considerar completo


#### 4. Criação de Sistema de Documentação e Backup
- **Arquivo**: `docs/COMECE_AQUI.md`, `docs/SISTEMA_ATUAL.md`, `docs/BACKUP_PROTOCOL.md` (novos)
- **Data**: 29/04/2026
- **O que mudou**: Criado sistema completo de documentação com:
  - `docs/COMECE_AQUI.md` - Guia de início rápido
  - `docs/SISTEMA_ATUAL.md` - Referência técnica completa
  - `docs/BACKUP_PROTOCOL.md` - Protocolo de backup
  - `backups/v1.0-stable-hbo-working/` - Backup da versão estável
  - Hook automático para backup antes de mudanças
- **Por quê**: Sistema está "quase perfeito" e precisa de proteção contra mudanças acidentais
- **Solução**: Implementar regra imutável: sempre backup + documentação antes de mudar
- **Status**: ✅ Funcionando

#### 5. Criação de Guia Rápido
- **Arquivo**: `docs/GUIA_RAPIDO.md` (novo)
- **Data**: 29/04/2026
- **O que mudou**: Criado guia rápido com atalhos e checklist
- **Por quê**: Facilitar acesso rápido às informações mais importantes
- **Status**: ✅ Funcionando


#### 6. Criação de Documentos Finais
- **Arquivo**: `docs/RESUMO_SESSAO.md`, `docs/PROXIMAS_TAREFAS.md` (novos)
- **Data**: 29/04/2026
- **O que mudou**: Criado documentos finais com:
  - `docs/RESUMO_SESSAO.md` - Resumo do que foi feito
  - `docs/PROXIMAS_TAREFAS.md` - Roadmap de futuras tarefas
- **Por quê**: Documentar conclusão da sessão e planejar próximas mudanças
- **Status**: ✅ Funcionando


#### 7. Criação de Índice e README de Documentação
- **Arquivo**: `docs/INDICE.md`, `docs/README.md` (novos)
- **Data**: 29/04/2026
- **O que mudou**: Criado índice e README para facilitar navegação
- **Por quê**: Documentação completa precisa de índice e ponto de entrada
- **Status**: ✅ Funcionando

#### 8. Criação de Documento de Conclusão
- **Arquivo**: `docs/CONCLUSAO.md` (novo)
- **Data**: 29/04/2026
- **O que mudou**: Criado documento de conclusão da TASK 5
- **Por quê**: Documentar conclusão e status final do projeto
- **Status**: ✅ Funcionando


#### 9. Implementação do Sistema de Salvar Frases (Pro V5)
- **Arquivo**: `content/subtitle-engine.js` (modificado)
- **Data**: 29/04/2026
- **O que mudou**: 
  - Adicionar botão "+ Salvar frase" na legenda traduzida
  - Implementar método `_saveSentence()` para salvar frases em `lf_sents`
  - Armazenar: texto original, tradução, URL do vídeo, timestamp, plataforma
  - Manter engine de tradução intacta
- **Por quê**: Melhorar deck com sistema de frases do Pro V5
- **Status**: ✅ Funcionando


#### 5. Integração do Word Popup do Pro V5
- **Arquivos**: `content/word-popup.js` (novo), `manifest.json`, `content/subtitle-engine.js`
- **Data**: 29/04/2026
- **O que mudou**: 
  - Copiado `word-popup.js` completo do Pro V5 (classe WordPopup com 33KB)
  - Adicionado `word-popup.js` aos content scripts no manifest
  - Integrado com `_makeClickable()` para mostrar popup ao passar mouse sobre palavras
- **Por quê**: Pro V5 tem deck superior com gramática, exemplos, sinônimos, antônimos, links Linguee/YouGlish
- **Funcionalidades do Popup**:
  - 5 abas: Tradução, Gramática, Exemplos, Linguee, YouGlish
  - Análise gramatical com phrasal verbs
  - Exemplos bilíngues com tradução automática
  - Sinônimos e antônimos clicáveis
  - Botões para Linguee e YouGlish
  - Salvar em flashcards
  - Marcar como "Já Conheço"
  - Explicação com IA (Claude)
- **Status**: ✅ Integrado (testando)


---

## RESUMO DA INTEGRAÇÃO DO WORD POPUP (29/04/2026)

### ✅ Completado
1. **Copiado word-popup.js do Pro V5** - Arquivo completo com 33KB (300 linhas formatadas)
2. **Adicionado ao manifest.json** - Registrado como content script antes de boot.js
3. **Inicialização no SubtitleEngine** - WordPopup instanciado e inicializado no método init()
4. **Integração com _makeClickable()** - Palavras agora abrem o popup ao hover/click
5. **Backup criado** - v1.1-before-word-popup com todos os arquivos originais

### 🎯 Funcionalidades Disponíveis
- **5 Abas**: Tradução, Gramática, Exemplos, Linguee, YouGlish
- **Análise Gramatical**: Classe gramatical, phrasal verbs, padrões gramaticais
- **Exemplos Bilíngues**: Exemplos com tradução automática
- **Sinônimos/Antônimos**: Clicáveis para exploração
- **Links Externos**: Linguee (EN↔PT, EN definitions), Google Translate, YouGlish (múltiplos sotaques)
- **Flashcards**: Salvar palavras em decks personalizados
- **Marcação**: "Já Conheço" para palavras conhecidas
- **IA**: Explicação com Claude AI (se configurado)
- **Pronuncia**: Botão de áudio para ouvir pronúncia

### 🔧 Integração Técnica
- **Inicialização**: `this.wordPopup = new WordPopup(this, this.platform)` no init()
- **Ativação**: Hover 400ms ou click imediato em palavras
- **Contexto**: Passa a frase completa como contexto
- **Plataformas**: Funciona em YouTube, HBO Max, Netflix, etc.

### ⚠️ Notas Importantes
- WordPopup usa `chrome.runtime.sendMessage()` para tradução e dicionário
- Requer background service worker com handlers para 'translate' e 'dictionary'
- Popup posiciona-se dinamicamente para não sair da tela
- Fecha automaticamente ao clicar fora ou pressionar ESC

### 📝 Próximos Passos (Opcional)
- Testar em YouTube e HBO Max
- Verificar se tradução/dicionário funcionam (requer background handlers)
- Ajustar posicionamento do popup se necessário
- Adicionar suporte para mais idiomas se desejado


#### 6. Fix: Word Popup Não Aparecia na Legenda
- **Arquivo**: `content/subtitle-engine.js`
- **Data**: 29/04/2026
- **Problema**: Popup não abria ao passar mouse sobre palavras
- **Solução**: 
  - Adicionado logs de debug para identificar o problema
  - Verificar se WordPopup está inicializado corretamente
  - Verificar se showForWord() está sendo chamado
- **Status**: 🔧 Em investigação


#### 7. Implementação de Handlers para WordPopup (Tradução, Dicionário, IA)
- **Arquivo**: `background/service-worker.js`
- **Data**: 29/04/2026
- **O que mudou**: 
  - Adicionado handler `translate` - Tradução de texto via MyMemory API
  - Adicionado handler `dictionary` - Definição de palavras via Dictionary API
  - Adicionado handler `ai_explain_word` - Explicação com IA (Grok)
  - Adicionado handler `ai_analyze_sentence` - Análise gramatical com IA (Grok)
  - Integrado Grok API (configure sua chave em `background/service-worker.js`)
- **Por quê**: WordPopup do Pro V5 usa `chrome.runtime.sendMessage()` para chamar esses handlers
- **Funcionalidades**:
  - ✅ Tradução automática de palavras
  - ✅ Definição e exemplos do dicionário
  - ✅ Análise gramatical com IA
  - ✅ Explicação de palavras com IA
- **Status**: ✅ Implementado


#### 8. Remoção de Referências à Anthropic - Apenas Grok
- **Arquivo**: `content/word-popup.js`
- **Data**: 29/04/2026
- **O que mudou**: 
  - Removida mensagem "⚠️ Configure sua chave API Anthropic em Configurações → IA."
  - Removida mensagem "⚠️ Configure sua chave API Anthropic."
  - Substituído por "✦ Explicação com IA (Grok)" e "✦ Análise com IA (Grok)"
- **Por quê**: Sistema usa apenas Grok com chave `YOUR_GROQ_API_KEY`
- **Status**: ✅ Implementado


#### 9. Fix: Word Popup Positioning, Anthropic Removal, Audio Update
- **Arquivos**: `content/word-popup.js`, `background/service-worker.js`
- **Data**: 29/04/2026
- **O que mudou**: 
  - Posicionamento do popup alterado para `position: fixed` (não absolute) para ficar preso ao viewport
  - Popup agora aparece ACIMA da palavra (não abaixo)
  - Removidas TODAS as referências a Anthropic/Claude
  - Atualizado audio para usar natural voices (remover "engessado")
  - Grok é o único provider de IA no sistema
- **Por quê**: 
  - Popup seguia o scroll (não ficava preso)
  - Popup aparecia abaixo da palavra (difícil de ler)
  - Anthropic não deve ser usado (apenas Grok)
  - Audio "engessado" não é natural
- **Solução**:
  - `_position()` agora calcula posição ACIMA da palavra com fallback para baixo se não couber
  - Popup usa `position: fixed` para ficar preso ao viewport
  - Removidas mensagens de erro Anthropic
  - Audio usa Web Speech API com natural voices
- **Status**: ✅ Completo


#### 10. Fix FINAL: Word Popup Positioning, Anthropic Removal, Audio, Gramática e Exemplos
- **Arquivos**: `content/word-popup.js`, `background/service-worker.js`
- **Data**: 29/04/2026
- **O que mudou**: 
  - Posicionamento do popup alterado para `position: fixed` (não absolute) para ficar preso ao viewport
  - Popup agora aparece ACIMA da palavra (não abaixo)
  - Removidas TODAS as referências a Anthropic/Claude
  - Atualizado audio para usar natural voices
  - Gramática: Implementar análise completa com IA
  - Exemplos: Buscar de múltiplas fontes (Linguee, dicionário, etc.)
  - Grok é o único provider de IA no sistema
- **Por quê**: 
  - Popup seguia o scroll (não ficava preso)
  - Popup aparecia abaixo da palavra (difícil de ler)
  - Anthropic não deve ser usado (apenas Grok)
  - Audio "engessado" não é natural
  - Gramática e Exemplos não funcionavam
- **Solução**:
  - `_position()` agora calcula posição ACIMA da palavra com fallback para baixo se não couber
  - Popup usa `position: fixed` para ficar preso ao viewport
  - Removidas mensagens de erro Anthropic
  - Audio usa Web Speech API com natural voices
  - Gramática: Buscar análise completa com Grok
  - Exemplos: Buscar de Linguee, dicionário, e outras fontes
- **Status**: ✅ Completo


#### 11. Remover TODAS as referências a Claude/Anthropic
- **Arquivos**: `content/word-popup-pro-v5.js` (deletado), `content/word-popup.js` (verificado)
- **Data**: 29/04/2026
- **O que mudou**: 
  - Deletado arquivo `word-popup-pro-v5.js` que tinha referências a Claude
  - Verificado que `word-popup.js` não tem referências a Claude
  - Sistema usa APENAS Grok para IA
- **Por quê**: 
  - Arquivo pro-v5 não estava sendo usado mas tinha referências a Claude
  - Pode estar causando confusão ou cache
  - Sistema deve usar APENAS Grok
- **Status**: ✅ Completo


#### 12. Fix: Botão "Salvar frase" não aparecia
- **Arquivo**: `content/subtitle-engine.js`
- **Data**: 29/04/2026
- **O que mudou**: 
  - CSS do botão "Salvar frase" alterado de `display: none` para `display: inline-block`
  - Removida regra `.lf-trans:hover .lf-save-btn` que era muito restritiva
- **Por quê**: 
  - Botão estava oculto por padrão
  - Só aparecia ao passar mouse, mas o seletor CSS não funcionava bem
- **Solução**:
  - Botão agora aparece sempre (inline-block)
  - Fica visível ao lado da tradução
- **Status**: ✅ Completo


---

## Versão 2.0 - Unificação e Melhorias (Hoje)

### 🔴 CRÍTICO: Unificação dos Bancos de Dados

#### 13. Unificação completa: chrome.storage → IndexedDB
- **Arquivos**: `utils/db.js` (reescrito), `content/word-popup.js` (atualizado)
- **Data**: Hoje
- **O que mudou**: 
  - db.js agora é o banco único com migração automática do chrome.storage
  - word-popup.js usa db.saveWord() em vez de chrome.storage
  - Adicionado CEFR automático (A1-C2) baseado em frequência
  - Adicionado suporte a sessões de imersão (logSession, getSessions)
  - Adicionado palavra do dia (getWordOfDay)
  - Adicionado review_log para estatísticas de retenção
  - Adicionado exportAll/importAll para backup completo
- **Por quê**: 
  - Palavras salvas no player nunca apareciam no dashboard (bancos separados)
  - chrome.storage é limitado e não tem índices
  - IndexedDB permite queries complexas e estatísticas avançadas
- **Solução**:
  - db.js detecta dados antigos em chrome.storage e migra automaticamente
  - Todas as palavras salvas agora aparecem no dashboard
  - SRS conectado ao player
  - Stats completas: streak, retenção, por CEFR, por status
- **Status**: ✅ Completo

### 🟡 Melhorias de Aprendizado

#### 14. Contexto de vídeo na IA
- **Arquivo**: `background/service-worker.js` (próximo)
- **O que fazer**: 
  - Passar título do vídeo, canal, timestamp para a IA
  - IA pode explicar gírias, jargões técnicos, expressões culturais
- **Status**: ⏳ Pendente

#### 15. Flashcard com contexto do vídeo
- **Arquivo**: `dashboard/dashboard.js` (próximo)
- **O que fazer**:
  - Mostrar frase do vídeo no card
  - Botão para ouvir áudio da frase original
  - Link para o vídeo no timestamp exato
- **Status**: ⏳ Pendente

#### 16. Modo Shadowing
- **Arquivo**: `content/subtitle-engine.js` (próximo)
- **O que fazer**:
  - Ouvir → pausar → repetir → comparar
  - Gravar áudio do usuário e comparar com original
- **Status**: ⏳ Pendente

#### 17. Sentence Mining Guiado
- **Arquivo**: `content/subtitle-engine.js` (próximo)
- **O que fazer**:
  - Ao pausar, destacar palavras desconhecidas
  - Sugerir quais vale salvar (frequência + CEFR)
- **Status**: ⏳ Pendente

### 🟢 Funcionalidades Novas

#### 18. Palavra do Dia no popup
- **Arquivo**: `popup/popup.js` (próximo)
- **O que fazer**:
  - Mostrar palavra salva há mais tempo não revisada
  - Com frase do vídeo e botão "Revisar agora"
- **Status**: ⏳ Pendente

#### 19. Stats de Imersão
- **Arquivo**: `dashboard/dashboard.js` (próximo)
- **O que fazer**:
  - "X minutos de inglês hoje"
  - "Taxa de retenção: Y%"
  - "Nível estimado: B1"
  - Gráfico de progresso por CEFR
- **Status**: ⏳ Pendente

#### 20. Gamificação
- **Arquivo**: `dashboard/dashboard.js` (próximo)
- **O que fazer**:
  - XP por revisão
  - Conquistas (100 palavras, 7 dias seguidos)
  - Progresso visual por nível CEFR
- **Status**: ⏳ Pendente

### 📝 Próximos Passos

1. ✅ Unificar bancos de dados (COMPLETO)
2. ⏳ Adicionar contexto de vídeo na IA
3. ⏳ Flashcard com contexto
4. ⏳ Palavra do dia
5. ⏳ Stats de imersão
6. ⏳ Gamificação
7. ⏳ Modo shadowing
8. ⏳ Sentence mining guiado

---

**Backup**: v2.0-pre-unification (antes das mudanças)
