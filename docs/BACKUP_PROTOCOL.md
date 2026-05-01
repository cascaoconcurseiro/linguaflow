# Protocolo de Backup - LinguaFlow

## Regra Imutável ⚠️

**ANTES DE QUALQUER MUDANÇA NO CÓDIGO:**
1. Criar backup da versão original
2. Documentar a mudança no CHANGELOG.md
3. Testar a mudança
4. Só depois considerar completo

## Estrutura de Backups

```
backups/
├── v1.0-stable-hbo-working/     (Estado inicial estável)
│   ├── content/
│   ├── background/
│   ├── manifest.json
│   └── README.md
├── v1.1-[descrição-mudança]/    (Próximas versões)
└── ...
```

## Procedimento de Backup

### Antes de Mudar um Arquivo

1. **Identificar arquivo a mudar**: ex. `content/subtitle-engine.js`

2. **Criar pasta de backup**:
   ```
   backups/v1.X-[descrição-mudança]/
   ```

3. **Copiar arquivo original**:
   ```
   backups/v1.X-[descrição-mudança]/content/subtitle-engine.js
   ```

4. **Documentar no CHANGELOG.md**:
   - Data e hora
   - Arquivo(s) modificado(s)
   - O que mudou
   - Por quê mudou
   - Status (em progresso / completo)

5. **Fazer a mudança**

6. **Testar em HBO Max e YouTube**

7. **Atualizar CHANGELOG.md** com status ✅ Funcionando

### Exemplo de Entrada no CHANGELOG

```markdown
#### Mudança: [Descrição]
- **Arquivo**: `content/arquivo.js`
- **Data**: DD/MM/YYYY
- **O que mudou**: Descrição clara da mudança
- **Por quê**: Razão da mudança
- **Solução**: Como foi resolvido
- **Backup**: `backups/v1.X-[descrição]/`
- **Status**: ✅ Funcionando / ⏳ Em progresso
```

## Versões Atuais

### v1.0 - Stable HBO Working (29/04/2026)
- HBO XHR Interception funcionando
- Tradução de legendas funcionando
- Posicionamento correto (acima da barra de controle)
- Backup em: `backups/v1.0-stable-hbo-working/`

## Rollback (Se Necessário)

Se uma mudança quebrar algo:

1. Copiar arquivo de `backups/v1.X-[descrição]/` para `content/`
2. Recarregar extensão no Chrome
3. Testar novamente
4. Documentar o rollback no CHANGELOG.md

## Checklist Antes de Commitar

- [ ] Backup criado em `backups/v1.X-[descrição]/`
- [ ] CHANGELOG.md atualizado
- [ ] Testado em HBO Max
- [ ] Testado em YouTube
- [ ] Sem erros no console
- [ ] Legendas aparecem corretamente
- [ ] Tradução funciona
- [ ] Posicionamento está correto
