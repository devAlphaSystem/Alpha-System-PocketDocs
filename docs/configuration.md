# Configuration Reference

## Environment Variables

All environment variables are validated at startup via Zod. Invalid values cause the server to exit with a descriptive error. Copy `.env.example` to `.env` and configure.

### Server

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `NODE_ENV` | `development` \| `production` \| `test` | `production` | No | Application environment. Controls secure cookies, static asset caching, and error detail verbosity. |
| `PORT` | integer (1–65535) | `3000` | No | HTTP server port. |
| `HOST` | string | `0.0.0.0` | No | Bind address. Use `127.0.0.1` to restrict to localhost. |
| `TRUST_PROXY` | string | `1` | No | Express `trust proxy` setting. Determines how `X-Forwarded-For` headers are interpreted. See [Trust Proxy](#trust-proxy) below. |

### PocketBase

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `POCKETBASE_URL` | URL | — | **Yes** | PocketBase server URL (e.g. `http://127.0.0.1:8090`). |
| `POCKETBASE_ADMIN_EMAIL` | email | — | **Yes** | PocketBase superuser email for admin API access. |
| `POCKETBASE_ADMIN_PASSWORD` | string (min 8) | — | **Yes** | PocketBase superuser password. |

### Security

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `SESSION_SECRET` | string (min 32) | — | **Yes** | Secret key for signing session data. Must be at least 32 characters. |
| `CSRF_SECRET` | string (min 32) | — | **Yes** | Secret key for HMAC-SHA256 CSRF token signing. Must be at least 32 characters. |
| `COOKIE_DOMAIN` | string | — | No | Cookie domain scope. Set when running on a custom domain (e.g. `.example.com`). Leave empty for localhost. |

### Logging

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `LOG_LEVEL` | `error` \| `warn` \| `info` \| `http` \| `debug` | `info` | No | Minimum log level. `debug` is verbose; `error` is minimal. |
| `LOG_DIR` | string | `logs` | No | Directory for log file output. Created automatically if it does not exist. |

### Rate Limiting

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `RATE_LIMIT_WINDOW_MS` | integer | `900000` | No | General rate limit window in milliseconds (default: 15 minutes). |
| `RATE_LIMIT_MAX_REQUESTS` | integer | `100` | No | Maximum requests per window for general routes. |
| `AUTH_RATE_LIMIT_WINDOW_MS` | integer | `900000` | No | Auth rate limit window in milliseconds. |
| `AUTH_RATE_LIMIT_MAX_REQUESTS` | integer | `10` | No | Maximum login/register attempts per window. |

### Site

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `SITE_NAME` | string | `PocketDocs` | No | Public site name displayed in the header and page titles. |
| `SITE_URL` | URL | `http://localhost:3000` | No | Public base URL. Used for generating canonical links. Set to your production URL in deployment. |

### GitHub Integration

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `GITHUB_TOKEN` | string | — | No | GitHub personal access token for the import feature. Without this, GitHub integration is disabled. Requires `repo` scope for private repositories or no scope for public-only access. |

---

## Trust Proxy

The `TRUST_PROXY` variable controls how Express reads the client IP from proxy headers. This directly affects rate limiting, IP restriction, and request logging.

| Value | Meaning |
|-------|---------|
| `1` | Trust the first proxy (e.g. a single nginx reverse proxy) |
| `2` | Trust two proxies (e.g. CDN + nginx) |
| `true` | Trust all proxies (use only in fully trusted networks) |
| `false` | Do not trust any proxy headers |
| `127.0.0.1,10.0.0.0/8` | Trust specific proxy IPs (comma-separated) |

**Recommendation:** Set to `1` for a single reverse proxy. Set to the exact proxy count or IP list for more complex setups.

---

## Runtime Configuration Files

These JSON files in the `data/` directory are read at startup and updated from the admin settings panel.

### `data/site-settings.json`

Controls the public home page hero section.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `heroWord1` | string | `"Alpha"` | First rotating word in hero heading |
| `heroWord2` | string | `"System"` | Second rotating word in hero heading |
| `heroSubtitle` | string | `"Most of the time I don't know what I'm doing."` | Subtitle text below the hero heading |

**Example:**
```json
{
  "heroWord1": "Alpha",
  "heroWord2": "System",
  "heroSubtitle": "Most of the time I don't know what I'm doing."
}
```

### `data/ip-restriction.json`

Controls IP-based access restriction for admin and auth routes.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `"enable"` \| `"disable"` | `"enable"` | Whether IP restriction is active |
| `allowedIps` | string | `""` | Newline-separated list of allowed IP addresses |

**Example:**
```json
{
  "enabled": "enable",
  "allowedIps": "127.0.0.1\n192.168.1.100"
}
```

When enabled, only listed IPs can access `/auth/*` and `/admin/*` routes. All other IPs receive a 403 response.

**Recovery:** If you lock yourself out, edit `data/ip-restriction.json` directly, set `enabled` to `"disable"`, and restart the server.

---

## Database Schema

The PocketBase schema is defined in `pb_schema.json`. Import it through the PocketBase admin UI on first setup.

### Collections

| Collection | Type | Purpose |
|------------|------|---------|
| `users` | Auth | Application users with roles (owner, admin, editor) |
| `projects` | Base | Documentation projects |
| `versions` | Base | Project versions with ordering |
| `pages` | Base | Documentation pages with nested hierarchy |
| `changelogs` | Base | Per-version changelogs |
| `_superusers` | System Auth | PocketBase admin accounts |

See [Architecture Overview](architecture.md#database-schema-er-diagram) for the full ER diagram and constraint details.

---

## Cookies

| Cookie | Purpose | Options |
|--------|---------|---------|
| `pd_auth` | JWT authentication token from PocketBase | httpOnly, secure (production), sameSite: strict, 7-day expiry |
| `pd_csrf` | CSRF double-submit token | httpOnly, secure (production), sameSite: strict |
| `pd_theme` | User theme preference (light/dark) | Client-accessible |

---

## Constants

Defined in `src/config/constants.js`. These are compile-time values and cannot be changed via environment variables.

| Constant | Value | Description |
|----------|-------|-------------|
| `SLUG_PATTERN` | `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` | Valid slug format |
| `MAX_SLUG_LENGTH` | 120 | Maximum slug characters |
| `MAX_TITLE_LENGTH` | 200 | Maximum title characters |
| `MAX_DESCRIPTION_LENGTH` | 500 | Maximum description characters |
| `MAX_CONTENT_LENGTH` | 500,000 | Maximum page/changelog content characters |
| `MAX_LABEL_LENGTH` | 100 | Maximum version label characters |
| `PAGINATION.DEFAULT_PER_PAGE` | 30 | Items per page |
| `PAGINATION.MAX_PER_PAGE` | 100 | Maximum items per page |
