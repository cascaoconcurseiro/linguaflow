#!/usr/bin/env bash
set -euo pipefail

PSQL_BIN="$1"
PORT="$2"
SOCK="$3"
DB="$4"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

pids=()

for i in $(seq 1 20); do
  event_id=$(printf '32000000-0000-4000-8000-%012d' "$i")
  "$PSQL_BIN" -X -v ON_ERROR_STOP=1 -h "$SOCK" -p "$PORT" -d "$DB" -Atqc "
    SELECT private.commit_qualified_learning_event(
      'dddddddd-dddd-4ddd-8ddd-dddddddddddd', '$event_id',
      'practice_item_completed', 'practice_item', 'concurrent-card', NULL,
      'concurrent:semantic', 'concurrent:reward', 'system', 'test-v1',
      '{\"correct\":true}'::jsonb, true, 'first_eligible_attempt',
      'practice_item', 2, true, 20
    ) ->> 'outcome';
  " >"$TMP/same-$i.out" 2>"$TMP/same-$i.err" &
  pids+=("$!")
done

for i in $(seq 1 20); do
  if ! wait "${pids[$((i - 1))]}"; then cat "$TMP/same-$i.err" >&2; exit 1; fi
  grep -Eq '^(accepted|duplicate)$' "$TMP/same-$i.out"
done

"$PSQL_BIN" -X -v ON_ERROR_STOP=1 -h "$SOCK" -p "$PORT" -d "$DB" -Atqc "
DO \$\$
DECLARE events integer; ledgers integer; total integer;
BEGIN
  SELECT count(*) INTO events FROM public.learning_events
   WHERE user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  SELECT count(*) INTO ledgers FROM public.xp_ledger
   WHERE user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  SELECT xp_total INTO total FROM public.user_stats
   WHERE user_id = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  IF events <> 1 OR ledgers <> 1 OR total <> 2 THEN
    RAISE EXCEPTION 'concorrência divergiu: events %, ledgers %, total %', events, ledgers, total;
  END IF;
END \$\$;
"

pids=()
for i in $(seq 1 20); do
  event_id=$(printf '33000000-0000-4000-8000-%012d' "$i")
  "$PSQL_BIN" -X -v ON_ERROR_STOP=1 -h "$SOCK" -p "$PORT" -d "$DB" -Atqc "
    SELECT private.commit_qualified_learning_event(
      'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '$event_id',
      'practice_item_completed', 'practice_item', 'cap-card-$i', NULL,
      'cap:semantic:$i', 'cap:reward:$i', 'system', 'test-v1',
      '{\"correct\":true}'::jsonb, true, 'first_eligible_attempt',
      'practice_item', 2, true, 20
    ) ->> 'outcome';
  " >"$TMP/cap-$i.out" 2>"$TMP/cap-$i.err" &
  pids+=("$!")
done

for i in $(seq 1 20); do
  if ! wait "${pids[$((i - 1))]}"; then cat "$TMP/cap-$i.err" >&2; exit 1; fi
  grep -Eq '^accepted$' "$TMP/cap-$i.out"
done

"$PSQL_BIN" -X -v ON_ERROR_STOP=1 -h "$SOCK" -p "$PORT" -d "$DB" -Atqc "
DO \$\$
DECLARE events integer; ledgers integer; total integer;
BEGIN
  SELECT count(*) INTO events FROM public.learning_events
   WHERE user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  SELECT count(*) INTO ledgers FROM public.xp_ledger
   WHERE user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  SELECT xp_total INTO total FROM public.user_stats
   WHERE user_id = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  IF events <> 20 OR ledgers <> 10 OR total <> 20 THEN
    RAISE EXCEPTION 'cap concorrente divergiu: events %, ledgers %, total %', events, ledgers, total;
  END IF;
END \$\$;
"

echo "EVIDENCE COMMIT P0.1 CONCURRENCY + CAP OK"
