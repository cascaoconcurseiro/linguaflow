# Sistema LinguaFlow - Referência Rápida

## Status Atual: ✅ HBO Max Funcionando Perfeitamente

### Plataformas Suportadas

| Plataforma | Status | Legendas | Tradução | Posicionamento |
|-----------|--------|----------|----------|----------------|
| YouTube | ✅ | ✅ | ✅ | ✅ |
| HBO Max / Max.com | ✅ | ✅ | ✅ | ✅ |
| Netflix | ⏳ | ⏳ | ⏳ | ⏳ |
| Disney+ | ⏳ | ⏳ | ⏳ | ⏳ |
| Prime Video | ⏳ | ⏳ | ⏳ | ⏳ |

## Arquitetura Principal

### 1. **content/boot.js**
- Ponto de entrada para todas as plataformas
- Carrega `subtitle-engine.js` e `settings-panel.js`
- Inicializa o sistema

### 2. **content/subtitle-engine.js** (Motor Principal)
- Detecta plataforma automaticamente
- Gerencia legendas (YouTube e HBO)
- Controla tradução
- Posiciona legendas na tela
- Salva palavras no banco de dados

**Métodos Principais:**
- `init()` - Inicializa o motor
- `onSubtitle(cue)` - Processa legenda (usa `this._currentCue`)
- `_injectSubtitleUI()` - Cria UI de legendas
- `_syncXhrCues()` - Sincroniza legendas HBO

### 3. **content/hbo-inject.js** (HBO XHR Intercept)
- Injetado com `world: "MAIN"` no manifest
- Intercepta requisições XHR de legendas VTT
- Dispara evento `LF_HBO_SUB` com dados VTT
- Bypass de Content Security Policy (CSP)

### 4. **content/settings-panel.js**
- Painel de configurações
- Controla velocidade de tradução
- Ajusta posicionamento de legendas
- Salva preferências no banco

### 5. **utils/db.js**
- IndexedDB para armazenamento local
- Salva palavras aprendidas
- Salva configurações do usuário
- Sem sincronização com servidor (100% offline)

## Como Funciona HBO Max

### Fluxo de Legendas HBO

```
1. Usuário abre vídeo no HBO Max
   ↓
2. hbo-inject.js intercepta XHR de legendas VTT
   ↓
3. Dispara evento LF_HBO_SUB com dados VTT
   ↓
4. subtitle-engine.js recebe evento
   ↓
5. Parseia VTT e popula this.xhrCues
   ↓
6. Sincroniza com tempo do vídeo (sync loop)
   ↓
7. Exibe legenda na tela (position: fixed, bottom: 120px)
   ↓
8. Usuário clica "Traduzir" ou legenda é traduzida automaticamente
```

### Posicionamento HBO

- **Tipo**: `position: fixed` (não absolute)
- **Bottom**: `120px` (acima da barra de controle)
- **Left**: `50%` com `transform: translateX(-50%)`
- **Z-index**: `2147483640` (acima de tudo)
- **Razão**: Evita conflito com barra de controle do player

### Tradução HBO

- Usa `this._currentCue` (referência de objeto)
- Não usa `indexOf()` (não funciona com HBO)
- Botão "Traduzir" inline com legenda original
- Tradução aparece abaixo da legenda original

## Regras Imutáveis

### ⚠️ Antes de Qualquer Mudança

1. **Criar Backup**
   ```
   backups/v1.X-[descrição-mudança]/
   ```

2. **Documentar no CHANGELOG.md**
   - Data e hora
   - Arquivo(s) modificado(s)
   - O que mudou e por quê
   - Status (em progresso / completo)

3. **Testar em Ambas Plataformas**
   - HBO Max
   - YouTube

4. **Verificar Console**
   - Sem erros críticos
   - Legendas aparecem
   - Tradução funciona
   - Posicionamento correto

### Estrutura de Pastas

```
linguaflow/
├── content/
│   ├── boot.js
│   ├── subtitle-engine.js
│   ├── hbo-inject.js
│   ├── settings-panel.js
│   └── ...
├── utils/
│   ├── db.js
│   ├── translator.js
│   └── ...
├── docs/
│   ├── CHANGELOG.md (Histórico de mudanças)
│   ├── BACKUP_PROTOCOL.md (Como fazer backup)
│   ├── SISTEMA_ATUAL.md (Este arquivo)
│   └── ...
├── backups/
│   ├── v1.0-stable-hbo-working/ (Versão estável)
│   ├── v1.1-[descrição]/ (Próximas versões)
│   └── ...
├── manifest.json
└── ...
```

## Checklist de Mudanças

Antes de considerar uma mudança completa:

- [ ] Backup criado em `backups/v1.X-[descrição]/`
- [ ] CHANGELOG.md atualizado com descrição
- [ ] Testado em HBO Max
- [ ] Testado em YouTube
- [ ] Sem erros no console
- [ ] Legendas aparecem corretamente
- [ ] Tradução funciona
- [ ] Posicionamento está correto
- [ ] Botão "Traduzir" funciona
- [ ] Palavras são salvas no banco

## Troubleshooting Rápido

### Legendas não aparecem no HBO
- Verificar se `hbo-inject.js` está registrado no manifest com `world: "MAIN"`
- Verificar se evento `LF_HBO_SUB` está sendo disparado (console)
- Verificar se VTT está sendo parseado corretamente

### Tradução não funciona
- Verificar se `this._currentCue` está sendo setado
- Verificar se `onSubtitle()` está sendo chamado
- Verificar se API de tradução está respondendo

### Legendas em posição errada
- HBO: Deve estar em `position: fixed` com `bottom: 120px`
- YouTube: Deve estar em `position: absolute` dentro do player
- Verificar se ResizeObserver está ativo

### Extensão não carrega
- Recarregar extensão no Chrome (chrome://extensions)
- Verificar se manifest.json está válido
- Verificar console do background service worker

## Próximas Tarefas

- [ ] Suporte para Netflix
- [ ] Suporte para Disney+
- [ ] Suporte para Prime Video
- [ ] Melhorar performance do sync loop
- [ ] Adicionar mais idiomas de tradução
- [ ] Integração com Anki
