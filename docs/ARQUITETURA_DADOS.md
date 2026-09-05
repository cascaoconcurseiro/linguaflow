# Arquitetura de dados e fonte de verdade

## Regra

Para dados de conta e progresso, o Supabase deve ser a fonte de verdade. Cópias locais podem acelerar a interface ou permitir contingência offline, mas devem ser descartáveis e nunca sobrescrever dados mais recentes do servidor sem uma política explícita de reconciliação.

## Fonte atual por domínio

| Domínio | Fonte de verdade | Uso local |
| --- | --- | --- |
| Sessão autenticada | Supabase Auth | token persistido para reabrir a sessão |
| Palavras, frases e cards | Supabase Postgres | caches de leitura e fila de escrita offline |
| Revisões e estado FSRS | RPCs/Postgres | estado transitório da sessão atual |
| XP, ofensiva e liga | eventos, ledger e `user_stats` no Postgres | apresentação temporária |
| Estatísticas | `review_log`, `sessions`, `cards` e `user_stats` | nenhum número decorativo; cache é invalidado ao abrir |
| Histórias salvas | tabela `stories` | espelho limitado para fallback offline |
| Configurações pedagógicas | tabela `settings` | estado de formulário durante a tela atual |
| Textos do Web Reader | tabela `reader_texts` com RLS | cache local e migração idempotente de textos antigos |
| Evidência de fluência | tarefas privadas, submissões e `fluency_skill_profiles` | rascunho local; sem captura ou envio de voz do aluno |
| Perfil adaptativo | eventos e perfis owner-only por RPC | último modo útil durante falha de leitura |
| Tema, voz e legenda visível | dispositivo/navegador | preferências locais intencionais por enquanto |
| Traduções e dicionário | serviços externos + cache | cache descartável com validade |

## Sincronização do Reader

Na Home, `onboarding_v1` é uma preferência legada opcional. Uma meta válida é
preservada; ausência, registro inválido ou falha de leitura usa 20 revisões
somente na apresentação. Entrar não grava conclusão nem estima nível.

O Professor retorna tradução, explicação e `pronunciation_pt` numa chamada
autenticada. O popup prioriza a pronúncia já salva e mantém resultados ligados
ao contexto aberto. Sessões da extensão (`chrome.storage.local`) e da PWA
(`localStorage`) são independentes; nenhum token é transportado na URL de login.

Ao abrir o Reader autenticado, textos antigos de `lf_reader_texts` são enviados
uma vez para `reader_texts`. A estante passa a ser reconstruída a partir do
Supabase e a cópia local é apenas contingência de leitura. Inclusões e exclusões
só são confirmadas na interface depois da gravação no servidor.

O tempo de estudo é somado pela RPC atômica `log_study_time`, separado por
origem (`extension`, `pwa`, `video`, `review` ou `reader`). As estatísticas somam
todas as origens, sempre sob o usuário autenticado.

## O que não deve ir ao banco como verdade

- posição momentânea de scroll;
- estado aberto/fechado de menus;
- URLs temporárias de legenda;
- cache de tradução/dicionário;
- locks contra contagem duplicada entre abas;
- áudio temporário e estado de reprodução.
- respostas livres e gravações transitórias do Check de comunicação.

Esses estados são técnicos ou específicos do dispositivo. Sincronizá-los aumentaria custo e conflitos sem melhorar a continuidade do aprendizado.

## Autoridade de fluência

`learning_task_attempts` não altera cards, FSRS, XP, ofensiva ou liga. O cliente
pode registrar atividade não autoritativa, mas somente
`commit_fluency_assessment` pode atualizar o perfil por habilidade. Respostas,
gabaritos e rubricas privadas não são expostos como tabela pública do cliente.
