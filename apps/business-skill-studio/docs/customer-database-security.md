# Customer database security runbook

## Credential handling

- Never commit production customer credentials.
- Rotate a password immediately after it is pasted into chat, an issue, a PR, or a log.
- Use a unique account per company and environment.
- Grant only `SELECT` and `SHOW VIEW` when possible.
- Store `DATA_SOURCE_ENCRYPTION_KEY` in the deployment secret manager and rotate it under a planned re-encryption procedure.

## Network controls

Production blocks private, loopback, link-local, multicast, and reserved addresses by default. Configure `DATA_SOURCE_ALLOWED_HOST_SUFFIXES` for known customer endpoints. Enable `ALLOW_PRIVATE_DATA_SOURCE_HOSTS=true` only in trusted network deployments or local development.

## Detection behavior

The detector executes fixed read-only statements only:

- `SELECT 1`
- server/database/charset metadata
- `SHOW GRANTS FOR CURRENT_USER`
- `information_schema.TABLES`
- `information_schema.COLUMNS`

The application does not expose arbitrary SQL execution.

## Incident response

When credentials are disclosed:

1. Disable or rotate the disclosed password at the database provider.
2. Review connection and audit logs for the disclosed account.
3. Replace the value in WinBrain settings after rotation.
4. Run the connection test again and confirm read-only grants.
5. Remove the secret from other systems where possible, but treat repository or chat history as permanently disclosed.
