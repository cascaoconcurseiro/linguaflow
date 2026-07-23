-- idx_usage_user_endpoint_time já possui a mesma chave e ordenação. Manter os
-- dois aumenta custo de INSERT e armazenamento sem melhorar o plano da quota.
drop index if exists public.api_usage_log_user_endpoint_created_idx;
