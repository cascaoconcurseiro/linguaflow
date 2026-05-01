# 🚀 Próximas Tarefas - LinguaFlow

## Status Atual: ✅ HBO Max + YouTube Funcionando

O sistema está estável e pronto para expansão. Todas as futuras mudanças devem seguir o protocolo de backup.

## 📋 Tarefas Prioritárias

### 1. Suporte para Netflix (Prioridade Alta)
**Status**: ⏳ Não iniciado

**O que fazer**:
1. Criar pasta: `backups/v1.1-netflix-support/`
2. Copiar arquivos atuais para backup
3. Documentar no CHANGELOG.md
4. Analisar como Netflix carrega legendas
5. Implementar suporte similar ao HBO
6. Testar em Netflix
7. Atualizar CHANGELOG.md com status ✅

**Arquivos a modificar**:
- `content/subtitle-engine.js` - Adicionar detecção Netflix
- `content/netflix-inject.js` - Novo arquivo para Netflix XHR intercept
- `manifest.json` - Registrar netflix-inject.js

### 2. Suporte para Disney+ (Prioridade Alta)
**Status**: ⏳ Não iniciado

**O que fazer**:
1. Criar pasta: `backups/v1.2-disney-support/`
2. Copiar arquivos atuais para backup
3. Documentar no CHANGELOG.md
4. Analisar como Disney+ carrega legendas
5. Implementar suporte similar ao HBO
6. Testar em Disney+
7. Atualizar CHANGELOG.md com status ✅

### 3. Suporte para Prime Video (Prioridade Média)
**Status**: ⏳ Não iniciado

**O que fazer**:
1. Criar pasta: `backups/v1.3-prime-support/`
2. Copiar arquivos atuais para backup
3. Documentar no CHANGELOG.md
4. Analisar como Prime Video carrega legendas
5. Implementar suporte similar ao HBO
6. Testar em Prime Video
7. Atualizar CHANGELOG.md com status ✅

## 🔧 Melhorias Técnicas

### 1. Performance do Sync Loop (Prioridade Média)
**Status**: ⏳ Não iniciado

**O que fazer**:
- Otimizar `_syncXhrCues()` para reduzir CPU
- Implementar debounce para ResizeObserver
- Melhorar performance em vídeos longos

### 2. Suporte para Mais Idiomas (Prioridade Baixa)
**Status**: ⏳ Não iniciado

**O que fazer**:
- Adicionar suporte para mais idiomas de tradução
- Integrar com Google Translate API
- Adicionar suporte para tradução offline

### 3. Integração com Anki (Prioridade Baixa)
**Status**: ⏳ Não iniciado

**O que fazer**:
- Exportar palavras aprendidas para Anki
- Sincronizar com Anki Desktop
- Adicionar suporte para Anki Web

## 📝 Protocolo para Cada Tarefa

Quando você começar uma tarefa:

1. **Criar Backup**
   ```
   backups/v1.X-[descrição-tarefa]/
   ```

2. **Documentar no CHANGELOG.md**
   ```markdown
   #### [Descrição da Tarefa]
   - **Arquivo**: `arquivo.js`
   - **Data**: DD/MM/YYYY
   - **O que mudou**: Descrição
   - **Por quê**: Razão
   - **Status**: ⏳ Em progresso
   ```

3. **Fazer a Mudança**
   - Modificar arquivo(s)
   - Testar em todas as plataformas

4. **Atualizar CHANGELOG.md**
   ```markdown
   - **Status**: ✅ Funcionando
   ```

## ✅ Checklist para Cada Tarefa

Antes de considerar uma tarefa completa:

- [ ] Backup criado em `backups/v1.X-[descrição]/`
- [ ] CHANGELOG.md atualizado com descrição
- [ ] Código modificado e testado
- [ ] Testado em todas as plataformas relevantes
- [ ] Sem erros no console
- [ ] Legendas aparecem corretamente
- [ ] Tradução funciona
- [ ] Posicionamento está correto
- [ ] CHANGELOG.md atualizado com status ✅

## 🎯 Roadmap Sugerido

### Fase 1: Expansão de Plataformas (Próximas 2-3 semanas)
1. Netflix (v1.1)
2. Disney+ (v1.2)
3. Prime Video (v1.3)

### Fase 2: Otimizações (Próximas 1-2 semanas)
1. Performance do sync loop
2. Melhorias de UI
3. Suporte para mais idiomas

### Fase 3: Integrações (Próximas 2-4 semanas)
1. Integração com Anki
2. Sincronização com servidor
3. Suporte para mais plataformas

## 📞 Suporte

Se você tiver dúvidas:

1. Leia `docs/SISTEMA_ATUAL.md` - Referência técnica
2. Leia `docs/BACKUP_PROTOCOL.md` - Como fazer backup
3. Leia `docs/CHANGELOG.md` - Histórico de mudanças
4. Leia `docs/GUIA_RAPIDO.md` - Atalhos rápidos

## 🔐 Regra Imutável

**ANTES DE QUALQUER MUDANÇA:**
1. ✅ Criar backup
2. ✅ Documentar no CHANGELOG.md
3. ✅ Testar em todas as plataformas
4. ✅ Só depois considerar completo

---

**Última atualização**: 29/04/2026  
**Status**: ✅ Pronto para próximas tarefas  
**Versão Atual**: 1.0 - HBO Max Working
