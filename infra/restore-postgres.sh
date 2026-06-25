#!/usr/bin/env bash
# Restaure une base PostgreSQL à partir d'un dump produit par backup-postgres.sh.
#
# Usage : ./restore-postgres.sh <database> <fichier.sql.gz>
# Exemple : ./restore-postgres.sh atd_jobs /opt/adopte-ton-dev/backups/daily/atd_jobs_2026-06-24.sql.gz
#
# ⚠️ Écrase entièrement la base cible (DROP + recréation des objets via le
# dump). Arrêter au préalable les services qui écrivent sur cette base
# (docker compose -f infra/docker-compose.prod.yml stop <service>) pour éviter
# toute écriture concurrente pendant la restauration.

set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONTAINER="atd-postgres"

if [ $# -ne 2 ]; then
  echo "Usage: $0 <database> <fichier.sql.gz>" >&2
  exit 1
fi

DB_NAME="$1"
DUMP_FILE="$2"

if [ -f "$INFRA_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$INFRA_DIR/.env"
  set +a
fi
POSTGRES_USER="${POSTGRES_USER:-atd}"

if [ ! -f "$DUMP_FILE" ]; then
  echo "Fichier introuvable : $DUMP_FILE" >&2
  exit 1
fi

read -rp "Restaurer '$DB_NAME' depuis $DUMP_FILE ? Cette base sera écrasée. [y/N] " confirm
if [ "$confirm" != "y" ]; then
  echo "Annulé."
  exit 0
fi

echo "[restore] suppression et recréation de $DB_NAME…"
docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
docker exec "$CONTAINER" psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE \"$DB_NAME\";"

echo "[restore] import du dump…"
gunzip -c "$DUMP_FILE" | docker exec -i "$CONTAINER" psql -U "$POSTGRES_USER" -d "$DB_NAME"

echo "[restore] terminé : $(date)"
