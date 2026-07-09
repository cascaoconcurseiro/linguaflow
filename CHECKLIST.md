# Checklist — LinguaFlow

## Diagnóstico e planejamento
- [x] Revisão multi-especialista do estado atual do repositório (diff completo, 22 arquivos modificados + 8 untracked)
- [x] Confirmar causa raiz do bug de sessão (falta refresh de token) por grep no repo inteiro
- [x] Confirmar arquitetura real da IA contextual (BYOK direto, não via Edge Function) e decidir migração com o usuário
- [x] Confirmar com o usuário que remoção de decks é intencional (cards substituem decks)
- [x] Criar MASTER_BLUEPRINT.md / CHECKLIST.md / HANDOFF.md

## FASE 0 — Refresh de token (prioridade máxima)
- [x] Capturar `refresh_token` e calcular `expires_at` em `login()` (`utils/db.js`)
- [x] Capturar `refresh_token` e calcular `expires_at` em `signUp()` (`utils/db.js`)
- [x] Criar `_refreshTokenIfNeeded()` em `utils/db.js` (com mutex contra refresh duplo — Supabase rotaciona o refresh_token)
- [x] Chamar `_refreshTokenIfNeeded()` no início de `_getToken()` (cobre SW e web direto; proxy delega pro SW)
- [x] Tratar falha de refresh (refresh_token também expirado) como logout explícito + eventos `lf_auth_expired`/`AUTH_EXPIRED`
- [x] Falha de REDE no refresh não desloga (mantém sessão — offline não pode destruir login)
- [x] Testado em Node com mocks: 6 cenários (válida, concorrência 5x→1 refresh, legada, refresh morto→logout, offline→preserva, login salva formato novo)
- [ ] Teste manual no navegador: recarregar extensão, logar de novo (sessões antigas são legadas, sem refresh_token), editar `expires_at` no chrome.storage e confirmar refresh no Network — **PENDENTE: precisa do usuário**

## Bugs encontrados durante a Fase 0 (revisão da equipe)
- [x] `chrome.storage.local.set` não era aguardado no login — chamada logo após podia não ver o token (corrigido via `_saveSession` await)
- [x] Timeout do proxy (5s) ficaria apertado com refresh na frente da chamada (corrigido → 10s)
- [ ] `_fetch()` engole TODOS os erros no catch e retorna `null` — chamador não distingue "lista vazia" de "erro de rede/servidor". Views podem mostrar "nenhuma palavra" quando na verdade a chamada falhou. Corrigir na Fase 1 ou 2 (mudança de contrato, precisa cuidado)
- [ ] Condicionais mortas `config.provider !== 'gemini'` no service-worker (resíduo do cleanup.py) — remover na Fase 1
- [ ] `dashboard/newtab.js` usa `lfDb` — confirmar se newtab está declarado no manifest e funcional (visto de passagem, não inspecionado)

## FASE 1 — Limpeza (escopo expandido)
- [ ] Remover `dashboard/js/core/db.js` (IndexedDB órfão)
- [ ] Remover `utils/sync.js`
- [ ] Remover `utils/cloud-sync.js` (já quebrado — chama `db.getAllDecks()` inexistente)
- [ ] Remover seção `oauth2`/`drive.appdata` do `manifest.json`
- [ ] Remover `bulkUpdateDeck()` e referências residuais a `deck_id` em `utils/db.js`
- [ ] Confirmar que `studyView.js`/`homeView.js` não referenciam mais decks
- [ ] Remover `background/service-worker.js_temp`, `cleanup.py`, `fix_enc_test.py`, `fix_mojibake.js`, `scratch/check.js`, `scratch/diff.txt`
- [ ] Resolver `popup/popup.html` → `icon_full.png` (commitar asset ou reverter para `icon128.png`)
- [ ] Adicionar `dashboard/js/ui/storiesView.js` ao git (feature legítima, já importada em `app.js`)
- [ ] Decidir destino de `dashboard/js/core/ai.js::explainGrammar()` (código morto — remover ou reativar)
- [ ] Extensão e dashboard continuam funcionando normalmente após limpeza (login, salvar palavra, IA contextual), sem erro novo no console

## FASE 2 — Migrar IA contextual para proxy seguro
- [ ] Corrigir `supabase/functions/deepseek-chat/index.ts`: validação real de JWT (`supabase.auth.getUser`)
- [ ] Corrigir CORS: origem da extensão + domínio Vercel, nunca `*`
- [ ] Criar tabela `api_usage_log` + índice (SQL em `D:\Downloads\prompt-linguaflow-arquitetura.md`)
- [ ] Implementar rate-limit por `user_id` na Edge Function (retornar 429 acima do limite)
- [ ] Migrar `explainWordWithAI` (`background/service-worker.js`) para chamar Edge Function com `access_token` da sessão
- [ ] Migrar `generateChunksWithAI` (`background/service-worker.js`) para o mesmo padrão
- [ ] Migrar `getPTPhoneticWithAI` (`background/service-worker.js`) para o mesmo padrão
- [ ] Manter BYOK (`aiApiKey`) como override opcional (se setado, usa direto; senão usa Edge Function)
- [ ] Testar: token inválido/expirado → 401; origem não permitida → bloqueado; excesso de requisições → 429

## FASE 3 — Confirmação final dos 3 fluxos
- [ ] Tradução de legenda funciona com sessão expirada
- [ ] Dicionário de palavra clicada funciona com sessão expirada
- [ ] IA contextual se recupera sozinha via refresh automático (Fase 0) + Edge Function (Fase 2), sem erro visível
- [ ] Fallback BYOK continua funcionando para quem configurou chave própria
