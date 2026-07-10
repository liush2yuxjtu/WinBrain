# Local FMCG database fixture

Start both application PostgreSQL and customer MySQL databases:

```bash
docker compose -f docker-compose.db.yml up -d
```

The MySQL fixture is available at:

```text
host: 127.0.0.1
port: 3307
user: fmcg_readonly
password: local-fmcg-readonly
database: uat_dws
charset: utf8mb4
```

This account is intentionally limited to `SELECT` and `SHOW VIEW`. The schema includes product, store, customer, daily sales, inventory snapshot, and brand-sales summary objects. All credentials in this document are local-only test fixtures.
