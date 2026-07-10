#!/usr/bin/env bash
set -euo pipefail

readonly_user="${UAT_MYSQL_READONLY_USER:?UAT_MYSQL_READONLY_USER is required}"
readonly_password="${UAT_MYSQL_READONLY_PASSWORD:?UAT_MYSQL_READONLY_PASSWORD is required}"
database_name="${MYSQL_DATABASE:-uat_dws}"

if [[ ! "$readonly_user" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "UAT_MYSQL_READONLY_USER may contain only letters, numbers, and underscores" >&2
  exit 1
fi

if [[ ! "$database_name" =~ ^[A-Za-z0-9_]+$ ]]; then
  echo "MYSQL_DATABASE may contain only letters, numbers, and underscores" >&2
  exit 1
fi

escaped_password=${readonly_password//\\/\\\\}
escaped_password=${escaped_password//\'/\'\'}

mysql --protocol=socket -uroot -p"$MYSQL_ROOT_PASSWORD" <<SQL
CREATE USER IF NOT EXISTS '${readonly_user}'@'%' IDENTIFIED BY '${escaped_password}';
ALTER USER '${readonly_user}'@'%' IDENTIFIED BY '${escaped_password}';
REVOKE ALL PRIVILEGES, GRANT OPTION FROM '${readonly_user}'@'%';
GRANT SELECT, SHOW VIEW ON \`${database_name}\`.* TO '${readonly_user}'@'%';
FLUSH PRIVILEGES;
SQL
