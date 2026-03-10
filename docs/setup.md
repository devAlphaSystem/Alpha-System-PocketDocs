# Setup & Installation Guide

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | ≥ 20.0.0 | [Download](https://nodejs.org/) |
| **npm** | ≥ 10 | Included with Node.js |
| **PocketBase** | ≥ 0.26 | Required only for **external** mode ([Download](https://pocketbase.io/docs/)) |

## Database Modes

PocketDocs supports two ways of running PocketBase:

| Mode | `POCKETBASE_MODE` | Description |
|------|-------------------|-------------|
| **External** (default) | `external` | You download, configure, and run PocketBase yourself. PocketDocs connects to it as a client. |
| **Embedded** | `embedded` | PocketDocs downloads PocketBase automatically, starts it as a child process, creates the superuser, and applies the schema — all on startup. |

Choose **external** when you want full control over PocketBase (custom flags, separate backups, clustering). Choose **embedded** for a zero-setup experience where everything runs from a single `npm start`.

---

## Option A — Embedded Mode (Automatic)

The fastest way to get started. PocketDocs handles everything.

### 1. Clone and Install

```bash
git clone "https://github.com/devAlphaSystem/Alpha-System-PocketDocs.git" pocketdocs
cd pocketdocs
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Set the mode to embedded and provide admin credentials:

```env
POCKETBASE_MODE=embedded

# These credentials will be used to create the PocketBase superuser
POCKETBASE_ADMIN_EMAIL=admin@pocketdocs.local
POCKETBASE_ADMIN_PASSWORD=your-admin-password-here

SESSION_SECRET=<64-character-random-string>
CSRF_SECRET=<64-character-random-string>
```

`POCKETBASE_URL` defaults to `http://127.0.0.1:8090` in embedded mode (override if needed).

To pin a specific PocketBase version instead of downloading the latest:

```env
POCKETBASE_VERSION=0.26.6
```

### 3. Start the Server

```bash
npm start       # Production
npm run dev     # Development (auto-reload)
```

On first start PocketDocs will:
1. Download the correct PocketBase binary for your platform into `data/pocketbase/`
2. Create the superuser account using your `.env` credentials
3. Start the PocketBase process
4. Apply the database schema (`db_schema.json`)
5. Start the Express server

Subsequent starts skip the download and superuser creation (both are idempotent).

### 4. Complete Owner Setup

Open `http://localhost:3000` — you will be redirected to the setup page. Create the owner account (the first application-level user). After setup, the admin panel is available at `/admin`.

---

## Option B — External Mode (Manual PocketBase)

### 1. Set Up PocketBase

Download and run [PocketBase](https://pocketbase.io/docs/):

```bash
# Linux / macOS
./pocketbase serve

# Windows
pocketbase.exe serve
```

PocketBase starts at `http://127.0.0.1:8090` by default. Open the admin UI (`http://127.0.0.1:8090/_/`) and create the first superuser account — you will need these credentials for PocketDocs.

### 2. Clone and Install PocketDocs

```bash
git clone "https://github.com/devAlphaSystem/Alpha-System-PocketDocs.git" pocketdocs
cd pocketdocs
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values. The minimum required variables are:

```env
POCKETBASE_MODE=external
POCKETBASE_URL=http://127.0.0.1:8090
POCKETBASE_ADMIN_EMAIL=admin@pocketdocs.local
POCKETBASE_ADMIN_PASSWORD=your-pocketbase-admin-password

SESSION_SECRET=<64-character-random-string>
CSRF_SECRET=<64-character-random-string>
```

Generate random secrets:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

See [Configuration](configuration.md) for a full reference of all environment variables.

### 4. Start the Server

```bash
# Development (auto-reload on file changes)
npm run dev

# Production
npm start
```

### 5. Complete Owner Setup

Open `http://localhost:3000` — you will be redirected to the setup page. Create the owner account (the first application-level user). After setup, the admin panel is available at `/admin`.

## Developer Onboarding Checklist

- [ ] Clone the repository
- [ ] Install prerequisites: Node.js ≥ 20
- [ ] **Embedded mode:** Set `POCKETBASE_MODE=embedded` in `.env` — PocketBase is handled automatically
- [ ] **External mode:** Install PocketBase ≥ 0.26 and start it
- [ ] Copy `.env.example` to `.env` and configure required variables
- [ ] Install dependencies: `npm install`
- [ ] Start the development server: `npm run dev`
- [ ] Complete owner setup at http://localhost:3000/setup
- [ ] Review architecture overview in docs/architecture.md

## Production Deployment

### Reverse Proxy (nginx)

Place PocketDocs behind a reverse proxy for TLS termination:

```nginx
server {
    listen 443 ssl;
    server_name docs.example.com;

    ssl_certificate     /etc/ssl/certs/docs.example.com.crt;
    ssl_certificate_key /etc/ssl/private/docs.example.com.key;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Set `TRUST_PROXY=1` in `.env` when behind a single proxy. For CDN + proxy chains, use `TRUST_PROXY=2` or a comma-separated list of trusted IPs.

### Process Manager

Use a process manager to keep the server running:

```bash
# Using PM2
npm install -g pm2
pm2 start src/index.js --name pocketdocs
pm2 save
pm2 startup
```

### Environment Checklist

- [ ] `NODE_ENV=production`
- [ ] Strong `SESSION_SECRET` and `CSRF_SECRET` (≥ 32 characters each)
- [ ] `SITE_URL` set to public URL (e.g. `https://docs.example.com`)
- [ ] `COOKIE_DOMAIN` set if using a custom domain
- [ ] PocketBase running and accessible from the server
- [ ] Reverse proxy configured with TLS
- [ ] IP restriction configured (optional — see Settings in admin panel)
- [ ] Log directory writable: `LOG_DIR` (default: `logs/`)

## Troubleshooting

### "Failed to connect to PocketBase"

- **External mode:** Confirm PocketBase is running and reachable at `POCKETBASE_URL`
- **Embedded mode:** Check `data/pocketbase/` for the binary and `pb_data/` for the database files
- Verify `POCKETBASE_ADMIN_EMAIL` and `POCKETBASE_ADMIN_PASSWORD` match a PocketBase superuser account
- Restart PocketDocs — the schema is applied automatically on every startup

### "PocketBase did not become healthy" (Embedded Mode)

- The PocketBase port may already be in use — check with `lsof -i :8090` or `netstat -an | findstr 8090`
- Set a different port via `POCKETBASE_URL=http://127.0.0.1:9090`
- Check `data/pocketbase/` for a corrupted binary — delete it and restart to re-download

### "Unsupported platform" (Embedded Mode)

PocketBase provides binaries for **linux**, **darwin** (macOS), and **windows** on **amd64** and **arm64** architectures. If your platform is not supported, use external mode instead.

### "No owner account — setup required"

This is normal on first launch. Navigate to `http://localhost:3000/setup` and create the owner account.

### Rate Limit Errors (429)

- General requests: default 100 requests per 15-minute window
- Auth requests: default 10 attempts per 15-minute window
- Adjust `RATE_LIMIT_MAX_REQUESTS` / `AUTH_RATE_LIMIT_MAX_REQUESTS` in `.env` if needed

### IP Restriction Locked Out

If you lock yourself out via IP restriction, edit `data/ip-restriction.json` directly:

```json
{
  "enabled": "disable",
  "allowedIps": ""
}
```

Restart the server to apply.

### Static Assets Not Loading

- In development: assets are served without cache (`maxAge: 0`)
- In production: assets are cached for 7 days with ETag. Force a cache clear if assets appear stale after an update
