#!/usr/bin/env bash
# Creates the local development database and role. Idempotent.
set -euo pipefail
DB=${DB:-jobrail}
ROLE=${ROLE:-jobrail}
PASS=${PASS:-jobrail}

psql_su() { su postgres -c "psql -v ON_ERROR_STOP=1 $*"; }

psql_su "-tAc \"SELECT 1 FROM pg_roles WHERE rolname='$ROLE'\"" | grep -q 1 \
  || psql_su "-c \"CREATE ROLE $ROLE LOGIN PASSWORD '$PASS' SUPERUSER\""
psql_su "-tAc \"SELECT 1 FROM pg_database WHERE datname='$DB'\"" | grep -q 1 \
  || psql_su "-c \"CREATE DATABASE $DB OWNER $ROLE\""
echo "database ready: postgresql://$ROLE:$PASS@localhost:5432/$DB"
