# Centralized Password Vault with Local Agent Sync

This repository implements the documented architecture using:

- FastAPI for all backend API logic
- PostgreSQL for credential and workflow data storage
- Next.js + TypeScript for all frontend workflows
- Python for operational scripting

## Implemented Scope

- Phase 1: Core Vault
  - Encrypted credential storage using AES-256-GCM envelope encryption
  - JWT authentication and RBAC (`admin`, `engineer`, `auditor`)
  - Agent and target server inventory APIs
  - Centralized audit logs
- Phase 2: Local Agent (MVP)
  - Outbound sync to vault (no inbound network dependency)
  - Reads current passwords from a site-local JSON file
  - Pushes password updates to the central vault for assigned servers
- Phase 3: Password Tracking
  - Central encrypted password inventory per server/account
  - Admin-approved engineer access requests
  - Sync freshness and source tracking (`admin` or `agent`)
- Phase 4: UI Integration
  - Next.js login page
  - Engineer access request workflow
  - Admin approval and inventory management workflow
  - Approved password reveal directly from the vault

## Architecture

- `services/vault`: FastAPI API service and access-expiry worker
- `services/agent`: Local agent daemon for isolated network sync
- `services/frontend`: Next.js TypeScript web UI
- `infrastructure/vagrant`: Optional VM lab topology
- `scripts`: Python operational scripts

## Backend Folder Structure

The backend now follows a layered structure with separation of concerns:

```text
services/vault/app/
  api/
    deps.py
    v1/
      router.py
      endpoints/
        auth.py
        admin.py
        access.py
        agent.py
        audit.py
  bootstrap/
    seed.py
  core/
    config.py
    security.py
  db/
    migrations.py
    session.py
  domain/
    models.py
    schemas.py
  services/
    audit_service.py
    encryption_service.py
    password_service.py
    tracking_service.py
  workers/
    rotation_worker.py
  main.py
```

This structure is the active runtime structure for backend code.

## Security Design Implemented

- Data at rest: AES-256-GCM envelope encryption
- Data in transit: HTTPS/WSS ready (TLS termination at ingress/reverse proxy)
- AuthN/AuthZ: JWT RBAC for users, bearer token for agent identity
- Access model: JIT access requests with approval workflow
- Audit: user actions, agent actions, access requests, password sync events
- Secret handling: plaintext only in memory during execution/reveal

## Database Configuration

The stack is configured for PostgreSQL credentials:

- username: `postgres`
- password: `Postgres`
- database: `vault`

Default `DATABASE_URL` in `.env.example`:

`postgresql+psycopg://postgres:Postgres@localhost:5432/vault`

If you use Docker Compose, the vault containers automatically use
`postgresql+psycopg://postgres:Postgres@postgres:5432/vault`.

## Quick Start With Docker Compose

1. Copy environment file.

```bash
cd /home/thapson/Projects/vault-system
cp .env.example .env
```

2. Create the agent password source file.

```bash
mkdir -p data
cat > data/passwords.json <<'EOF'
{}
EOF
```

3. Start services.

```bash
docker compose up --build -d
```

4. Open endpoints.

- Frontend UI: http://localhost:3000/login
- FastAPI docs: http://localhost:8000/docs
- Health endpoint: http://localhost:8000/healthz

## Running Against Your Host-Installed PostgreSQL

If you want to use your already installed PostgreSQL directly:

1. Ensure DB `vault` exists and credentials are valid (`postgres` / `Postgres`).
  Create it once if missing:

```bash
PGPASSWORD=Postgres psql -h 127.0.0.1 -U postgres -d postgres -c "CREATE DATABASE vault;"
```

2. Keep `DATABASE_URL` in `.env` pointing to localhost.
3. Run schema migrations from the backend virtualenv:

```bash
cd services/vault
./.venv/bin/alembic upgrade head
```

4. Run vault service directly:

```bash
cd services/vault
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000
```

5. Run worker and agent in separate terminals:

```bash
cd services/vault
python3 -m app.workers.rotation_worker
```

```bash
cd services/agent
python3 -m agent.main
```

6. Run frontend:

```bash
cd services/frontend
npm install
npm run dev
```

## Seeded Accounts

- `admin` / `ChangeMeStrong!`
- `engineer` / `EngineerChangeMe!123`
- `auditor` / `AuditorChangeMe!123`

Update these immediately outside lab testing.

## End-to-End Workflow

1. As admin in UI:
   - create or use bootstrap agent
   - register target server
   - create tracked credential

2. Update the agent JSON file with the vault credential IDs and current passwords.

```json
{
  "credential-id-from-vault": "current-password"
}
```

3. As engineer in UI:
   - submit access request

4. As admin in UI:
   - approve request

5. Agent syncs assigned credentials from the JSON file into the vault.

6. As engineer in UI:
   - reveal the current password once approved

## API Highlights

- `POST /api/v1/auth/login`
- `POST /api/v1/admin/agents`
- `POST /api/v1/admin/servers`
- `POST /api/v1/admin/credentials`
- `PUT /api/v1/admin/credentials/{credential_id}/password`
- `GET /api/v1/agent/credentials`
- `POST /api/v1/agent/credentials/{credential_id}/sync`
- `POST /api/v1/access-requests/`
- `POST /api/v1/access-requests/{request_id}/approve`
- `POST /api/v1/access-requests/{request_id}/reveal`

## Swagger Authentication

In Swagger UI (`/docs`), use these steps:

1. Run `POST /api/v1/auth/login` with JSON body to get `access_token`.
2. Click `Authorize`.
3. In `UserBearerAuth`, paste only the token value (without `Bearer ` prefix).
4. Execute protected endpoints.

## Development Commands

```bash
make copy-env
make up
make logs
make test
make down
```

## Alembic Commands

```bash
cd services/vault
./.venv/bin/alembic upgrade head
./.venv/bin/alembic current
./.venv/bin/alembic history
```

## Production Hardening Next Steps

- Enforce TLS and mTLS certificate-based agent auth
- Replace static secrets with managed secret backend
- Add schema migrations (Alembic)
- Add CI checks for backend tests and frontend lint/build
- Protect the agent password source file with strict filesystem permissions
