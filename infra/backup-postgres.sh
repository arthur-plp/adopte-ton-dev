#!/usr/bin/env bash
# Sauvegarde quotidienne des bases PostgreSQL (DB-per-service — cf. CLAUDE.md §31.2).
#
# Installation sur le VPS (une seule fois) :
#   chmod +x /opt/adopte-ton-dev/infra/backup-postgres.sh
#   crontab -e
#   0 3 * * * /opt/adopte-ton-dev/infra/backup-postgres.sh >> /var/log/atd-backup.log 2>&1
#
# Rétention : 7 sauvegardes quotidiennes + 4 hebdomadaires (snapshot du dimanche),
# stockées hors conteneur dans BACKUP_DIR (volume/disque dédié, pas le volume
# Docker de postgres lui-même). Restauration : voir restore-postgres.sh.

set -euo pipefail

INFRA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/opt/adopte-ton-dev/backups}"
CONTAINER="atd-postgres"
DATABASES=(atd_users atd_jobs atd_applications atd_messaging atd_notifications atd_payment atd_email)

# En prod, les identifiants viennent de infra/.env ; en dev (docker-compose.yml),
# ils sont en dur dans le compose, on retombe donc sur les valeurs par défaut.
if [ -f "$INFRA_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$INFRA_DIR/.env"
  set +a
fi
POSTGRES_USER="${POSTGRES_USER:-atd}"

DAILY_DIR="$BACKUP_DIR/daily"
WEEKLY_DIR="$BACKUP_DIR/weekly"
mkdir -p "$DAILY_DIR" "$WEEKLY_DIR"

TIMESTAMP="$(date +%Y-%m-%d)"

for db in "${DATABASES[@]}"; do
  DEST="$DAILY_DIR/${db}_${TIMESTAMP}.sql.gz"
  echo "[backup] $db -> $DEST"
  docker exec "$CONTAINER" pg_dump -U "$POSTGRES_USER" "$db" | gzip > "$DEST"
done

# Snapshot hebdomadaire le dimanche (%u : 1=lundi … 7=dimanche)
if [ "$(date +%u)" -eq 7 ]; then
  for db in "${DATABASES[@]}"; do
    cp "$DAILY_DIR/${db}_${TIMESTAMP}.sql.gz" "$WEEKLY_DIR/${db}_${TIMESTAMP}.sql.gz"
  done
  echo "[backup] snapshot hebdomadaire copié"
fi

# Purge : 7 jours pour le quotidien, 28 jours (4 semaines) pour l'hebdomadaire
find "$DAILY_DIR" -name "*.sql.gz" -mtime +7 -delete
find "$WEEKLY_DIR" -name "*.sql.gz" -mtime +28 -delete

echo "[backup] terminé : $(date)"
