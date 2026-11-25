#!/usr/bin/env bash
# Adatbázistesztek helyi PostgreSQL-en: titkosság (RLS) és egyidejű foglalás.
# Használat: PGUSER=postgres scripts/test-db.sh
set -euo pipefail
cd "$(dirname "$0")/.."
DB="${TEST_DB:-ajandoki_test}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)

dropdb --if-exists "$DB" >/dev/null
createdb "$DB"
"${PSQL[@]}" -d "$DB" -f supabase/tests/_supabase_stub.sql >/dev/null
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -d "$DB" -f "$f" >/dev/null; done

echo "== Titkossági tesztek"
"${PSQL[@]}" -d "$DB" -f supabase/tests/privacy.test.sql

echo "== Egyidejű foglalási teszt (50 párhuzamos kérés ugyanarra a tételre)"
dropdb --if-exists "${DB}_c" >/dev/null
createdb "${DB}_c"
"${PSQL[@]}" -d "${DB}_c" -f supabase/tests/_supabase_stub.sql >/dev/null
for f in supabase/migrations/*.sql; do "${PSQL[@]}" -d "${DB}_c" -f "$f" >/dev/null; done
ITEM=$("${PSQL[@]}" -d "${DB}_c" -At -f supabase/tests/concurrency.setup.sql | tail -1)
seq 1 50 | xargs -P 50 -I{} "${PSQL[@]}" -d "${DB}_c" -At -c \
  "select set_config('request.jwt.claim.sub', (select id::text from profiles where display_name = 'giver{}'), false); set role authenticated; select reserve_item('$ITEM');" \
  2>&1 | grep -E '^(ok|unavailable|not_found)$' | sort | uniq -c > /tmp/ajandoki_conc.txt
cat /tmp/ajandoki_conc.txt
OK=$(awk '$2=="ok"{print $1}' /tmp/ajandoki_conc.txt)
UNAV=$(awk '$2=="unavailable"{print $1}' /tmp/ajandoki_conc.txt)
ACTIVE=$("${PSQL[@]}" -d "${DB}_c" -At -c "select count(*) from reservations where status='reserved'")
if [[ "${OK:-0}" == "1" && "${UNAV:-0}" == "49" && "$ACTIVE" == "1" ]]; then
  echo "OK: pontosan 1 sikeres foglalás, 49 elutasítva"
else
  echo "FAIL: ok=${OK:-0} unavailable=${UNAV:-0} active=$ACTIVE"; exit 1
fi
dropdb "${DB}_c"
