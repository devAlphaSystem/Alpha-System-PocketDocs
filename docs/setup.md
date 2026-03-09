# Setup & Installation Guide

## Prerequisites

| Requirement | Version | Notes |
|-------------|---------|-------|
| **Node.js** | ≥ 20.0.0 | [Download](https://nodejs.org/) |
| **npm** | ≥ 10 | Included with Node.js |
| **PocketBase** | ≥ 0.26 | [Download](https://pocketbase.io/docs/) |

## Step-by-Step Installation

### 1. Set Up PocketBase

Download and run [PocketBase](https://pocketbase.io/docs/):

```bash
# Linux / macOS
./pocketbase serve

# Windows
pocketbase.exe serve
```

PocketBase starts at `http://127.0.0.1:8090` by default. Open the admin UI (`http://127.0.0.1:8090/_/`) and create the first superuser account — you will need these credentials for PocketDocs.

### 2. Import the Database Schema

In the PocketBase admin UI:

1. Go to **Settings → Import collections**
2. Upload `pb_schema.json` from the PocketDocs root directory
3. Confirm the import

This creates the required collections: `users`, `projects`, `versions`, `pages`, and `changelogs`.

### 3. Clone and Install PocketDocs

```bash
git clone "https://github.com/devAlphaSystem/Alpha-System-PocketDocs.git" pocketdocs
cd pocketdocs
npm install
```

### 4. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values. The minimum required variables are:

```env
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

### 5. Start the Server

```bash
# Development (auto-reload on file changes)
npm run dev

# Production
npm start
```

### 6. Complete Owner Setup

Open `http://localhost:3000` — you will be redirected to the setup page. Create the owner account (the first application-level user). After setup, the admin panel is available at `/admin`.

## Developer Onboarding Checklist

- [ ] Clone the repository
- [ ] Install prerequisites: Node.js ≥ 20, PocketBase ≥ 0.26
- [ ] Start PocketBase: `./pocketbase serve`
- [ ] Import `pb_schema.json` via PocketBase admin UI
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

- Confirm PocketBase is running and reachable at `POCKETBASE_URL`
- Verify `POCKETBASE_ADMIN_EMAIL` and `POCKETBASE_ADMIN_PASSWORD` match a PocketBase superuser account
- Ensure the database schema has been imported (`pb_schema.json`)

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
