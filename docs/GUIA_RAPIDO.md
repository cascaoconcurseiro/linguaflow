# 📖 Guia Rápido - LinguaFlow

## 🎯 Objetivo
Proteger o sistema HBO Max funcionando perfeitamente através de backup automático e documentação de mudanças.

## ⚡ Atalhos Rápidos

### Quero entender o sistema
```
docs/SISTEMA_ATUAL.md
```

### Quero fazer uma mudança
```
1. Leia: docs/BACKUP_PROTOCOL.md
2. Crie backup em: backups/v1.X-[descrição]/
3. Documente em: docs/CHANGELOG.md
4. Faça a mudança
5. Teste em HBO Max e YouTube
```

### Quero ver o histórico
```
docs/CHANGELOG.md
```

### Quero fazer rollback
```
1. Copie arquivo de: backups/v1.0-stable-hbo-working/
2. Recarregue extensão no Chrome
3. Teste novamente
```

## 🔧 Arquivos Principais

| Arquivo | Função | Modificar? |
|---------|--------|-----------|
| `content/subtitle-engine.js` | Motor de legendas | ⚠️ Com backup |
| `content/hbo-inject.js` | HBO XHR intercept | ⚠️ Com backup |
| `manifest.json` | Configuração | ⚠️ Com backup |
| `docs/CHANGELOG.md` | Histórico | ✅ Sempre |
| `docs/BACKUP_PROTOCOL.md` | Protocolo | ✅ Se necessário |

## 📋 Checklist Rápido

Antes de fazer qualquer mudança:

```
☐ Backup criado?
☐ CHANGELOG.md atualizado?
☐ Testado em HBO Max?
☐ Testado em YouTube?
☐ Sem erros no console?
☐ Legendas aparecem?
☐ Tradução funciona?
☐ Posicionamento correto?
```

## 🚀 Próximas Mudanças

Se você quer adicionar suporte para Netflix, Disney+ ou Prime Video:

1. Crie pasta: `backups/v1.1-netflix-support/`
2. Copie arquivos atuais para backup
3. Documente no CHANGELOG.md
4. Faça as mudanças
5. Teste em todas as plataformas
6. Atualize CHANGELOG.md com status ✅

## 🆘 Problemas Comuns

### Legendas não aparecem
- Verificar console (F12)
- Verificar se `hbo-inject.js` está ativo
- Verificar se evento `LF_HBO_SUB` está sendo disparado

### Tradução não funciona
- Verificar se `this._currentCue` está setado
- Verificar se API de tradução está respondendo
- Verificar console para erros

### Extensão não carrega
- Recarregar em chrome://extensions
- Verificar manifest.json
- Verificar console do background

## 📞 Suporte

Todos os documentos estão em `docs/`:
- `COMECE_AQUI.md` - Início rápido
- `SISTEMA_ATUAL.md` - Referência técnica
- `BACKUP_PROTOCOL.md` - Como fazer backup
- `CHANGELOG.md` - Histórico de mudanças
- `GUIA_RAPIDO.md` - Este arquivo

---

**Versão**: 1.0  
**Status**: ✅ Estável  
**Última atualização**: 29/04/2026
