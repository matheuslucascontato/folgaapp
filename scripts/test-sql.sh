#!/usr/bin/env bash
set -euo pipefail
# Container descartável, somente fixtures fictícias, sem porta exposta.
container=folga-sql-test
for i in $(seq 1 30); do
 if docker exec "$container" pg_isready -U postgres >/dev/null 2>&1; then break; fi
 sleep 1
done
docker exec "$container" psql -U postgres -v ON_ERROR_STOP=1 -c 'DROP DATABASE IF EXISTS folga_test WITH (FORCE)' >/dev/null
docker exec "$container" psql -U postgres -v ON_ERROR_STOP=1 -c 'CREATE DATABASE folga_test' >/dev/null
docker exec -i "$container" psql -U postgres -d folga_test -v ON_ERROR_STOP=1 -q < tests/sql/bootstrap.sql
for migration in supabase/migrations/*.sql; do
 docker exec -i "$container" psql -U postgres -d folga_test -v ON_ERROR_STOP=1 -q < "$migration"
done
docker exec -i "$container" psql -U postgres -d folga_test -v ON_ERROR_STOP=1 -q < tests/sql/invariants.sql

printf "Migrations, RLS SQL, referências, rollback e cascatas: passaram.\n"
