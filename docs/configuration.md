# Configuration Reference

## Environment Variables

Core application environment variables are validated at startup via Zod. Invalid values cause the server to exit with a descriptive error. The embedded PocketBase manager additionally reads its optional fixed-port setting. Copy `.env.example` to `.env` and configure.

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
| `POCKETBASE_MODE` | `external` \| `embedded` | `external` | No | `external`: you manage PocketBase yourself. `embedded`: PocketDocs downloads, starts, and manages PocketBase automatically. |
| `POCKETBASE_URL` | URL | — | **Yes** (external) | URL of the PocketBase instance managed outside PocketDocs. Embedded mode selects its own loopback URL. |
| `POCKETBASE_PORT` | integer | Automatically selected from 8090–8190 | No | (Embedded only) Fixed port for the managed PocketBase process. |
| `POCKETBASE_ADMIN_EMAIL` | email | — | **Yes** | PocketBase superuser email. In embedded mode, used to create the superuser. |
| `POCKETBASE_ADMIN_PASSWORD` | string (min 8) | — | **Yes** | PocketBase superuser password. In embedded mode, used to create the superuser. |
| `POCKETBASE_VERSION` | string | — | No | (Embedded only) Pin a specific PocketBase version (e.g. `0.26.6`). Leave empty to download the latest release. |

In embedded mode, PocketDocs enables the PocketBase Batch Web API during startup with at least 150 requests per transaction and a minimum timeout of 3 seconds. Existing higher limits are preserved. In external mode, enable and size the Batch Web API directly in the PocketBase application settings.

### Security

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `CSRF_SECRET` | string (min 32) | — | **Yes** | Secret key for HMAC-SHA256 CSRF token signing. Must be at least 32 characters. |

### Logging

| Variable | Type | Default | Required | Description |
|----------|------|---------|----------|-------------|
| `LOG_LEVEL` | `error` \| `warn` \| `info` \| `http` \| `debug` | `info` | No | Minimum log level. `debug` is verbose; `error` is minimal. |

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
| `SITE_NAME` | string | `PocketDocs` | No | Application name used by admin/auth/error page titles and the admin footer. Public homepage branding is configured through `site_settings`. |
| `SITE_URL` | URL | `http://localhost:3000` | No | Public base URL. Used for generating canonical links. Set to your production URL in deployment. |

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

## Runtime Configuration

### PocketBase `site_settings` collection

Public branding is stored in PocketBase, with one record per setting. PocketDocs creates missing records with the defaults below after applying the database schema.

| Record key | Field | Default | Description |
|------------|-------|---------|-------------|
| `title` | `value` | `Pocket**Docs**` | Required homepage title, up to 200 characters |
| `subtitle` | `value` | `Beautiful, **self-hosted** documentation for your *projects*.` | Homepage subtitle, up to 300 characters |
| `icon` | `icon` | No uploaded file | Default icon for public pages; the bundled `/img/pd-logo.svg` is used when absent |

Title and subtitle support sanitized inline Markdown: bold, italic, strikethrough, links, line breaks, and inline code. Images, raw HTML, and block elements are discarded. The title controls the homepage hero, public homepage header, and homepage browser title; the footer remains branded as PocketDocs.

The icon can be a PNG, JPEG, WebP, or safe SVG file up to 256 KB. SVG uploads cannot contain scripts, embedded HTML, animation, external resources, event handlers, or inline styles. The selected icon is served from the same origin through `/site-icon` and `/favicon.ico` and is used by the public homepage header and hero as well as the browser tab. A project logo still takes precedence for that project's favicon.

Admins and owners can update public branding from **Settings → Application**. Only owners can update the IP restriction settings on the same page.

The legacy `data/site-settings.json` file is no longer read or migrated automatically. After upgrading from a file-backed release, reapply any custom homepage branding from **Settings → Application**.

### File-backed runtime configuration

The IP restriction JSON file in `data/` is read at startup and updated from the admin settings panel.

### `data/ip-restriction.json`

Controls IP-based access restriction for admin and auth routes.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | `"enable"` \| `"disable"` | `"disable"` | Whether IP restriction is active |
| `allowedIps` | string | `"127.0.0.1"` | Newline-separated list of allowed IP addresses |

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

The PocketBase schema is defined in `db_schema.json` and applied automatically every time PocketDocs starts. Missing collections are created and existing ones are verified — no manual steps are needed.

### Collections

| Collection | Type | Purpose |
|------------|------|---------|
| `users` | Auth | Application users with roles (owner, admin, editor) |
| `projects` | Base | Documentation projects (visibility + mode) |
| `versions` | Base | Project versions with ordering |
| `pages` | Base | Documents, Frequently Asked Questions, and Troubleshooting pages with nested hierarchy |
| `changelogs` | Base | Per-version changelogs |
| `site_settings` | Base | One record per public title, subtitle, and site-icon setting |
| `_superusers` | System Auth | PocketBase admin accounts |

See [Architecture Overview](architecture.md#database-schema-er-diagram) for the full ER diagram and constraint details.

---

## Browser State

### Cookies

| Cookie | Purpose | Options |
|--------|---------|---------|
| `pd_auth` | JWT authentication token from PocketBase | httpOnly, secure (production), sameSite: strict, 7-day expiry |
| `pd_csrf` | Random seed used to validate signed CSRF form/header tokens | httpOnly, secure (production), sameSite: strict |
| `pd_download` | Short-lived download handshake token for ZIP exports | httpOnly: false, secure (production), sameSite: strict, 60-second expiry |

### Local Storage

The `pd_theme` key is stored in `localStorage` with the user's `light`, `dark`, or `auto` color-scheme preference. It is not a cookie and is not sent to the server.

---

## Constants

Defined in `src/config/constants.js`. These are compile-time values and cannot be changed via environment variables.

| Constant | Value | Description |
|----------|-------|-------------|
| `SLUG_PATTERN` | `/^[a-z0-9]+(?:-[a-z0-9]+)*$/` | Valid slug format |
| `MAX_SLUG_LENGTH` | 120 | Maximum slug characters |
| `MAX_TITLE_LENGTH` | 200 | Maximum title characters |
| `MAX_PAGE_TITLE_LENGTH` | 45 | Maximum page title characters, including Markdown imports |
| `MAX_DESCRIPTION_LENGTH` | 500 | Maximum description characters |
| `MAX_CONTENT_LENGTH` | 500,000 | Maximum page/changelog content characters |
| `MAX_LABEL_LENGTH` | 100 | Maximum version label characters |
| `PROJECT_MODE.VERSIONED` | `versioned` | Project uses versioned public routes and release history |
| `PROJECT_MODE.NON_VERSIONED` | `non_versioned` | Project uses one internal version for Documents, FAQ, and Troubleshooting |
| `PAGE_SECTIONS.DOCUMENTS` | `documents` | Documents section value |
| `PAGE_SECTIONS.FAQ` | `faq` | Frequently Asked Questions section value |
| `PAGE_SECTIONS.TROUBLESHOOTING` | `troubleshooting` | Troubleshooting section value |
| `PAGINATION.DEFAULT_PAGE` | 1 | Initial page number for paginated queries |
| `PAGINATION.DEFAULT_PER_PAGE` | 25 | Default items per project, version, and content-page query |
