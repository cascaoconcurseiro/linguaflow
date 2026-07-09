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
- [ ] **PWA sem ícone**: `manifest.webmanifest` aponta pra `../icons/icon128.png` e a pasta `icons/` não existe (nem `dashboard/icons/`) — corrigir na Fase 1
- [ ] **Rota `stories` ausente do `vercel.json`** — deep-link/refresh na view de histórias quebra na Vercel; adicionar à lista de rotas
- [ ] Relatório completo de melhorias criado: ver `MELHORIAS.md` (FSRS, Kokoro TTS, modo leitor, exercícios, PWA offline)

## FASE 1 — Limpeza (escopo expandido)
- [x] Remover `dashboard/js/core/db.js` (IndexedDB órfão — grep confirmou zero imports)
- [x] Remover `utils/sync.js`
- [x] Remover `utils/cloud-sync.js` (já quebrado — chamava `db.getAllDecks()` inexistente)
- [x] Remover seção `oauth2`/`drive.appdata` do `manifest.json` + permissão `identity` (também sem uso)
- [x] Remover `bulkUpdateDeck()` de `utils/db.js` e `deck_id: 1` de `content/web-reader.js`
- [x] Confirmar que views não referenciam mais decks (só sobraram comentários/CSS inertes)
- [x] Remover `background/service-worker.js_temp`, `cleanup.py`, `fix_enc_test.py`, `fix_mojibake.js`, `scratch/check.js`, `scratch/diff.txt`
- [x] Resolver `popup/popup.html` → `icon_full.png` (asset foi commitado no backup — resolvido)
- [x] Adicionar `dashboard/js/ui/storiesView.js` ao git (feito no commit de backup)
- [x] `dashboard/js/core/ai.js::explainGrammar()`: MANTIDO — é o padrão de referência pra migração da Fase 2 (único código que chama a Edge Function corretamente)
- [x] Remover condicionais mortas `config.provider !== 'gemini'` do service-worker (4 pontos)
- [x] **PWA**: criada `dashboard/icons/` (16/48/128 + 192/512 gerados por upscale), webmanifest corrigido (`start_url: "/"` — o antigo `./dashboard.html` dava 404 na Vercel; ícones 192+512 destravam o prompt de instalação do Chrome)
- [x] **Rota `stories`** adicionada aos 6 grupos de rewrite do `vercel.json`
- [ ] Teste manual pós-limpeza: extensão e dashboard funcionando (login, salvar palavra, IA contextual), sem erro novo no console — **PENDENTE: usuário**
- [ ] Substituir ícones 192/512 por arte original (os atuais são upscale do 128 — funcionais, mas suaves demais); `icon.png` da raiz tem header PNG corrompido, avaliar remoção

## Correções do feedback do usuário (2026-07-08, sessão 2 — commit f684169)
- [x] **CAUSA RAIZ do "sempre a mesma palavra" e dos dados fake**: saveWord falhava 100% com 400 (colunas inexistentes: ai_chunks/synonyms/antonyms/definition/snapshot) — só 1 palavra existia no banco. Migração aplicada (chunks→ai_chunks + 5 colunas novas incl. category) + saveWord corrigido (aceita chunks/ai_chunks, tags array/string, envia category)
- [x] Botão Sair: chamava `db.signOut()` inexistente → `this.logout()`
- [x] word-popup mostrava "Salvo!" sem checar `result.ok` → agora mostra erro real
- [x] Áudio robótico na web (Vercel): agora toca Google TTS via `<audio>` direto (sem CORS), robótico só como último fallback
- [x] Dark mode: backgrounds hardcoded (white/#f7f9fa) em studyView/library/leagues/stories → tokens do tema; "texto invisível" era título claro em sidebar branca fixa
- [x] Missões diárias: localStorage estático 0/50 → calculadas de xp_today (trigger real), review_log de hoje, palavras de hoje
- [x] CEFR sincronizado: extensão (cefrTargetLevel) ↔ dashboard/IA (lf_cefr_level) espelham nos dois sentidos
- [x] Backfill do Cofre: gravava em w.ai_chunks que o saveWord ignorava → agora aceito; contagem "sem contexto" era 100% fake (coluna não existia)
- [ ] Teste manual: salvar palavras novas num vídeo, estudar (fila deve variar), Sair, dark mode, missões subindo — **PENDENTE: usuário**
- [ ] Gamificação (XP/ligas/streak) é REAL no backend (trigger calculate_xp em review_log) — validar que XP sobe após revisões agora que reviews gravam

## FASE 2 — Migrar IA contextual para proxy seguro (commit a756403)
- [x] `supabase/functions/deepseek-chat/index.ts` v2: validação real de JWT (`supabase.auth.getUser`) — anon key pública agora leva 401
- [x] CORS restrito: `chrome-extension://*`, `*.vercel.app`, localhost — nunca `*`
- [x] Tabela `api_usage_log` + índice criados (migração `create_api_usage_log_rate_limit`, RLS sem policies — só service role)
- [x] Rate-limit 20 req/min por `user_id` na Edge Function (429 acima) + modelo fixo + teto max_tokens 2048
- [x] `getApiConfig()` no service worker migrado: sem `aiApiKey` → Edge Function com token de sessão; TODAS as funções de IA cobertas de uma vez (explicação, chunks, fonética, histórias, classificação, backfill)
- [x] BYOK mantido como override (chave própria → DeepSeek direto, não gasta cota compartilhada)
- [x] Testado: anon key → 401; origem estranha → Allow-Origin null; origem Vercel → ecoada
- [ ] **PENDENTE (usuário)**: adicionar secret `DEEPSEEK_API_KEY` no Supabase (Dashboard → Edge Functions → Secrets) — sem ele o modo compartilhado retorna erro e só BYOK funciona
- [ ] Teste manual: recarregar extensão, sem chave BYOK configurada, clicar palavra → explicação da IA deve vir via Edge Function; simular 21 chamadas num minuto → 429

## FASE 3 — Confirmação final dos 3 fluxos
- [ ] Tradução de legenda funciona com sessão expirada
- [ ] Dicionário de palavra clicada funciona com sessão expirada
- [ ] IA contextual se recupera sozinha via refresh automático (Fase 0) + Edge Function (Fase 2), sem erro visível
- [ ] Fallback BYOK continua funcionando para quem configurou chave própria
