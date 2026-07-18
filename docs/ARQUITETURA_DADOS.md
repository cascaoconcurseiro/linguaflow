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
| Textos do Web Reader | **localStorage** | única cópia atual — não sincroniza entre dispositivos |
| Tema, voz e legenda visível | dispositivo/navegador | preferências locais intencionais por enquanto |
| Traduções e dicionário | serviços externos + cache | cache descartável com validade |

## Exceção prioritária

Os textos adicionados diretamente ao Web Reader ainda existem somente no navegador. Isso significa que podem desaparecer ao limpar dados e não aparecem em outro dispositivo. Para cumprir fonte única em todo conteúdo do usuário, é necessário criar uma tabela autenticada para documentos do Reader, migrar os textos locais uma vez e manter fallback somente leitura quando estiver offline.

## O que não deve ir ao banco como verdade

- posição momentânea de scroll;
- estado aberto/fechado de menus;
- URLs temporárias de legenda;
- cache de tradução/dicionário;
- locks contra contagem duplicada entre abas;
- áudio temporário e estado de reprodução.

Esses estados são técnicos ou específicos do dispositivo. Sincronizá-los aumentaria custo e conflitos sem melhorar a continuidade do aprendizado.
