#!/usr/bin/env bash
# Validação REPRODUTÍVEL das migrations num Postgres efêmero (critério P0 do
# livro de execução): sobe um cluster limpo, aplica o shim do auth, roda TODAS
# as migrations em ordem e executa um smoke test do Learning Engine.
# Uso: bash tests/db/validate-migrations.sh [dir_de_trabalho]
set -euo pipefail

if [ -z "${PGBIN:-}" ]; then
  if command -v pg_config >/dev/null 2>&1; then
    PGBIN="$(pg_config --bindir)"
  else
    PGBIN="$(find /usr/lib/postgresql -mindepth 2 -maxdepth 2 -type d -name bin 2>/dev/null | sort -V | tail -n 1)"
  fi
fi
if [ -z "$PGBIN" ] || [ ! -x "$PGBIN/initdb" ]; then
  echo "Postgres initdb não encontrado; defina PGBIN para executar o replay." >&2
  exit 1
fi
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WORK="${1:-$(mktemp -d /tmp/lf-migrate-XXXX)}"
PGDATA="$WORK/pgdata"
SOCK="$WORK"
PORT=54329
DB=linguaflow_test

run_pg() { # roda como usuário postgres (o postgres não roda como root)
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

cleanup() { run_pg "$PGBIN/pg_ctl" -D "$PGDATA" stop -m immediate >/dev/null 2>&1 || true; }
trap cleanup EXIT

mkdir -p "$PGDATA"
if [ "$(id -u)" = "0" ]; then chown -R postgres:postgres "$WORK"; fi

echo "── initdb (cluster efêmero em $WORK)"
run_pg "$PGBIN/initdb" -D "$PGDATA" -A trust -E UTF8 >/dev/null
run_pg "$PGBIN/pg_ctl" -D "$PGDATA" -o "-p $PORT -k $SOCK -c listen_addresses=''" -l "$WORK/pg.log" start >/dev/null
run_pg "$PGBIN/createdb" -h "$SOCK" -p "$PORT" "$DB"

PSQL=("$PGBIN/psql" -h "$SOCK" -p "$PORT" -d "$DB" -v ON_ERROR_STOP=1 -q)

echo "── shim do auth (schema auth + roles do Supabase)"
run_pg "${PSQL[@]}" -f "$ROOT/tests/db/auth_shim.sql"

echo "── aplicando migrations em ordem"
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "   • $(basename "$f")"
  run_pg "${PSQL[@]}" -f "$f"
done

echo "── smoke test do Learning Engine"
run_pg "${PSQL[@]}" <<'SQL'
-- Usuário de teste: o trigger handle_new_user deve criar o user_stats
INSERT INTO auth.users (id, email) VALUES ('00000000-0000-4000-8000-000000000001', 'smoke@test.dev');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', false);

DO $$
DECLARE
  r jsonb; xp int; st int;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.user_stats WHERE user_id = auth.uid()) THEN
    RAISE EXCEPTION 'handle_new_user não criou user_stats';
  END IF;

  -- Fuso + evento de jogo via portão único
  PERFORM public.set_user_timezone('America/Sao_Paulo');
  r := public.record_learning_event('game_match', 8);
  IF COALESCE((r->>'xp_awarded')::int, 0) <= 0 THEN
    RAISE EXCEPTION 'record_learning_event não creditou XP: %', r;
  END IF;

  SELECT xp_today, streak INTO xp, st FROM public.user_stats WHERE user_id = auth.uid();
  IF xp <= 0 OR st < 1 THEN
    RAISE EXCEPTION 'user_stats não refletiu o evento (xp=%, streak=%)', xp, st;
  END IF;

  -- Cap diário anti-farm precisa travar em algum momento
  PERFORM public.record_learning_event('game_match', 10);
  PERFORM public.record_learning_event('game_match', 10);
  r := public.record_learning_event('game_match', 10);
  IF COALESCE((r->>'capped')::boolean, false) IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'cap diário do game_match não travou: %', r;
  END IF;

  -- Rollover de liga executa sem erro
  PERFORM public.run_league_rollover();

  RAISE NOTICE 'SMOKE OK: xp_today=%, streak=%', xp, st;
END $$;
SQL

echo "── contratos SQL da Fundação de Evidência"
run_pg "${PSQL[@]}" -f "$ROOT/tests/db/evidence-foundation.sql"

echo "── contratos SQL do portão privado P0.1"
run_pg "${PSQL[@]}" -f "$ROOT/tests/db/evidence-commit-p0-1.sql"

echo "── concorrência real do portão privado P0.1"
bash "$ROOT/tests/db/evidence-commit-concurrency.sh" "$PGBIN/psql" "$PORT" "$SOCK" "$DB"

echo "── contrato transacional de revisão P0.2A"
run_pg "${PSQL[@]}" -f "$ROOT/tests/db/card-review-p0-2a.sql"

echo "── concorrência real de revisão P0.2A"
node "$ROOT/tests/db/card-review-p0-2a-concurrency.mjs" "$PGBIN/psql" "$PORT" "$DB" "$SOCK"

echo "── isolamento e permissões de cards P0.2B"
run_pg "${PSQL[@]}" -f "$ROOT/tests/db/card-permissions-p0-2b.sql"

echo "✅ Migrations reproduzíveis + gates comportamentais P0.1/P0.2 passaram."
