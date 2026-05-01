# 📚 LinguaFlow - Índice Principal

Bem-vindo ao LinguaFlow! Este arquivo orienta você sobre a estrutura do projeto.

## 🚀 Comece Aqui

👉 **[docs/README.md](docs/README.md)** - Documentação principal

## 📁 Estrutura do Projeto

```
linguaflow/
├── INDEX.md                     ← Você está aqui
├── README.md                    ← Informações gerais do projeto
├── manifest.json                ← Configuração da extensão Chrome
│
├── docs/                        ← 📚 DOCUMENTAÇÃO PRINCIPAL
│   ├── README.md               ← Ponto de entrada da documentação
│   ├── COMECE_AQUI.md          ← Guia de início rápido
│   ├── SISTEMA_ATUAL.md        ← Referência técnica
│   ├── BACKUP_PROTOCOL.md      ← Protocolo de backup
│   ├── GUIA_RAPIDO.md          ← Atalhos rápidos
│   ├── CHANGELOG.md            ← Histórico de mudanças
│   ├── RESUMO_SESSAO.md        ← Resumo da sessão
│   ├── PROXIMAS_TAREFAS.md     ← Roadmap
│   ├── CONCLUSAO.md            ← Conclusão
│   ├── INDICE.md               ← Índice de documentação
│   └── archived/               ← Documentos antigos (91 arquivos)
│
├── backups/                     ← 💾 BACKUPS DE VERSÕES
│   └── v1.0-stable-hbo-working/
│       ├── README.md
│       ├── content/hbo-inject.js
│       ├── manifest.json
│       └── docs/
│
├── content/                     ← 🎬 CÓDIGO PRINCIPAL
│   ├── boot.js                 ← Ponto de entrada
│   ├── subtitle-engine.js      ← Motor de legendas
│   ├── hbo-inject.js           ← HBO XHR intercept
│   ├── settings-panel.js       ← Painel de configurações
│   ├── video-controls.js
│   ├── word-popup.js
│   ├── youtube-hook.js
│   ├── immersion-mode.js
│   └── index.js
│
├── background/                  ← 🔧 SERVICE WORKER
│   └── service-worker.js
│
├── popup/                       ← 🎨 INTERFACE DO POPUP
│   └── popup.html
│
├── dashboard/                   ← 📊 DASHBOARD
│   └── (arquivos do dashboard)
│
├── utils/                       ← 🛠️ UTILITÁRIOS
│   ├── db.js                   ← IndexedDB
│   ├── translator.js           ← Tradução
│   ├── subtitle-parsers.js
│   └── ...
│
├── tests/                       ← 🧪 TESTES (13 arquivos)
│   ├── test-*.html
│   ├── fix-*.py
│   └── ...
│
├── scripts/                     ← 📝 SCRIPTS (2 arquivos)
│   ├── verificar.ps1
│   └── verificar.sh
│
├── icons/                       ← 🎯 ÍCONES
│   ├── icon16.png
│   ├── icon48.png
│   ├── icon128.png
│   └── icon.png
│
└── dist/                        ← 📦 BUILD (gerado automaticamente)
```

## 📖 Documentação

### Para Novos Desenvolvedores
1. Leia: **[docs/README.md](docs/README.md)**
2. Leia: **[docs/COMECE_AQUI.md](docs/COMECE_AQUI.md)**
3. Leia: **[docs/SISTEMA_ATUAL.md](docs/SISTEMA_ATUAL.md)**

### Para Fazer Mudanças
1. Leia: **[docs/BACKUP_PROTOCOL.md](docs/BACKUP_PROTOCOL.md)**
2. Crie backup em: `backups/v1.X-[descrição]/`
3. Documente no: **[docs/CHANGELOG.md](docs/CHANGELOG.md)**

### Para Atalhos Rápidos
→ **[docs/GUIA_RAPIDO.md](docs/GUIA_RAPIDO.md)**

### Para Histórico
→ **[docs/CHANGELOG.md](docs/CHANGELOG.md)**

### Para Roadmap
→ **[docs/PROXIMAS_TAREFAS.md](docs/PROXIMAS_TAREFAS.md)**

## ✅ Status do Sistema

```
✅ HBO Max - Legendas funcionando
✅ HBO Max - Tradução funcionando
✅ HBO Max - Posicionamento correto
✅ YouTube - Legendas funcionando
✅ YouTube - Tradução funcionando
✅ Documentação completa
✅ Backup system implementado
⏳ Netflix - Próxima tarefa
⏳ Disney+ - Próxima tarefa
⏳ Prime Video - Próxima tarefa
```

## 🔐 Regra Imutável

**ANTES DE QUALQUER MUDANÇA NO CÓDIGO:**

```
1. Criar backup da versão original
2. Documentar a mudança no CHANGELOG.md
3. Testar em HBO Max e YouTube
4. Só depois considerar completo
```

## 🎯 Arquivos Importantes

| Arquivo | Descrição |
|---------|-----------|
| `manifest.json` | Configuração da extensão Chrome |
| `content/subtitle-engine.js` | Motor principal de legendas |
| `content/hbo-inject.js` | HBO XHR intercept |
| `docs/CHANGELOG.md` | Histórico de mudanças |
| `docs/BACKUP_PROTOCOL.md` | Protocolo de backup |
| `backups/v1.0-stable-hbo-working/` | Versão estável |

## 📞 Suporte

Se você tiver dúvidas:

1. Procure em: **[docs/INDICE.md](docs/INDICE.md)**
2. Leia o documento relevante
3. Se ainda tiver dúvidas, verifique: **[docs/GUIA_RAPIDO.md](docs/GUIA_RAPIDO.md)** → Problemas Comuns

## 🎉 Bem-vindo!

O sistema LinguaFlow está funcionando perfeitamente e pronto para expansão!

---

**Última atualização**: 29/04/2026  
**Status**: ✅ Completo  
**Versão**: 1.0 - HBO Max Working
