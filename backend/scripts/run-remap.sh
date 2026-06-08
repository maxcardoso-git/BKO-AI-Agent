#!/usr/bin/env bash
# ============================================================================
# run-remap.sh — roda o remap-modalidade-tipologia.sql contra o Postgres do BKO
# ============================================================================
#
# Descobre sozinho:
#   - as credenciais do banco a partir do backend/.env (DB_USER/PASS/NAME/HOST/PORT)
#   - o container do Postgres via `docker ps`
# e executa o SQL. Se nao achar container, tenta `psql` no host.
#
# USO (de qualquer pasta):
#   bash BKO-AI-Agent/backend/scripts/run-remap.sh
#   # ou, dentro de backend/:  bash scripts/run-remap.sh
#
# Idempotente e transacional — pode rodar mais de uma vez sem dano.
# ============================================================================

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SQL_FILE="$SCRIPT_DIR/remap-modalidade-tipologia.sql"
ENV_FILE="$SCRIPT_DIR/../.env"

[[ -f "$SQL_FILE" ]] || { echo "ERRO: SQL nao encontrado: $SQL_FILE" >&2; exit 1; }
[[ -f "$ENV_FILE" ]] || { echo "ERRO: .env nao encontrado: $ENV_FILE" >&2; exit 1; }

# Carrega apenas as DB_* (sem eval, tolerante a caracteres especiais na senha)
DB_USER=""; DB_PASS=""; DB_NAME=""; DB_HOST=""; DB_PORT=""
while IFS='=' read -r key val; do
  case "$key" in
    DB_USER) DB_USER="$val" ;;
    DB_PASS) DB_PASS="$val" ;;
    DB_NAME) DB_NAME="$val" ;;
    DB_HOST) DB_HOST="$val" ;;
    DB_PORT) DB_PORT="$val" ;;
  esac
done < <(grep -E '^DB_(USER|PASS|NAME|HOST|PORT)=' "$ENV_FILE")

[[ -n "$DB_USER" ]] || { echo "ERRO: DB_USER ausente no .env" >&2; exit 1; }
[[ -n "$DB_NAME" ]] || { echo "ERRO: DB_NAME ausente no .env" >&2; exit 1; }

echo "DB: $DB_NAME | User: $DB_USER"

# Acha o container do Postgres (prefere um cujo nome cita 'bko')
CONTAINER="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -iE 'bko.*postgres|postgres.*bko' | head -1 || true)"
[[ -n "$CONTAINER" ]] || CONTAINER="$(docker ps --format '{{.Names}}' 2>/dev/null | grep -i postgres | head -1 || true)"

if [[ -n "$CONTAINER" ]]; then
  echo "Container Postgres: $CONTAINER"
  echo "Rodando o re-map..."
  docker exec -i -e PGPASSWORD="$DB_PASS" "$CONTAINER" \
    psql -U "$DB_USER" -d "$DB_NAME" < "$SQL_FILE"
else
  echo "Nenhum container Postgres encontrado — tentando psql no host..."
  command -v psql >/dev/null 2>&1 || { echo "ERRO: sem container e sem psql no host." >&2; exit 1; }
  PGPASSWORD="$DB_PASS" psql -h "${DB_HOST:-localhost}" -p "${DB_PORT:-5432}" \
    -U "$DB_USER" -d "$DB_NAME" -f "$SQL_FILE"
fi

echo ""
echo "Concluido. Na distribuicao final acima, a tipologia 'Outros' deve estar zerada."
