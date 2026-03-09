# API Reference

All endpoints are served by the Express application. Admin endpoints require authentication (cookie-based). Public endpoints are unauthenticated.

## Conventions

- **Content-Type**: `application/x-www-form-urlencoded` for form submissions, `application/json` for API responses
- **Authentication**: Cookie `pd_auth` containing a PocketBase JWT token
- **CSRF**: State-changing requests (POST/PUT/DELETE) require a `_csrf` field in the body or `x-csrf-token` header, matching the signed `pd_csrf` cookie
- **Validation errors** return HTTP 400 with field-level details
- **Slugs** must match `^[a-z0-9]+(?:-[a-z0-9]+)*$` (lowercase alphanumeric with hyphens)

## Error Response Format

All errors follow a consistent envelope:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Human-readable description",
    "details": [
      { "field": "slug", "code": "INVALID_FORMAT", "message": "Invalid slug format" }
    ],
    "requestId": "uuid-v4"
  }
}
```

| HTTP Status | Error Code | Meaning |
|-------------|-----------|---------|
| 400 | `VALIDATION_ERROR` | Invalid input |
| 401 | `AUTHENTICATION_ERROR` | Not logged in or token expired |
| 403 | `AUTHORIZATION_ERROR` | Insufficient role/permissions |
| 403 | `CSRF_ERROR` | CSRF token mismatch |
| 403 | `IP_RESTRICTED` | Client IP not in allowlist |
| 404 | `NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Duplicate resource (e.g. slug already taken) |
| 422 | `DOMAIN_ERROR` | Business rule violation |
| 429 | `RATE_LIMITED` | Too many requests |
| 500 | `INTERNAL_ERROR` | Unexpected server error |
| 502 | `EXTERNAL_SERVICE_ERROR` | Upstream service failure (e.g. GitHub API) |

---

## Health Check

### `GET /health`

Returns server health status and PocketBase connectivity.

**Auth:** None

**Response (200 — healthy):**
```json
{
  "status": "healthy",
  "uptime_s": 3600,
  "memory": {
    "rss_mb": 85,
    "heap_used_mb": 42,
    "heap_total_mb": 64
  }
}
```

**Response (503 — unhealthy):**
```json
{
  "status": "unhealthy",
  "uptime_s": 3600,
  "checks": { "pocketbase": "unreachable" }
}
```

---

## Setup

### `GET /setup`

Renders the owner registration form. Redirects to `/auth/login` if owner already exists.

**Auth:** None

### `POST /setup`

Creates the initial owner account. Only available when no owner exists.

**Rate limit:** Auth limiter (10 requests / 15 min)

**Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | 2–100 characters |
| `email` | string | Yes | Valid email, max 255 |
| `password` | string | Yes | 8–256 characters |
| `passwordConfirm` | string | Yes | Must match `password` |
| `_csrf` | string | Yes | CSRF token |

**Success:** Sets `pd_auth` cookie, redirects to `/admin`

**Errors:** 400 (validation), 409 (owner already exists)

---

## Authentication

### `GET /auth/login`

Renders the login form. IP-restricted.

**Auth:** None

### `POST /auth/login`

Authenticates a user with email and password.

**Rate limit:** Auth limiter (10 requests / 15 min)  
**IP restriction:** Yes

**Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email, max 255 |
| `password` | string | Yes | 8–256 characters |
| `_csrf` | string | Yes | CSRF token |

**Success:** Sets `pd_auth` cookie (httpOnly, secure in production, sameSite: strict, 7-day expiry), redirects to `/admin`

**Errors:** 400 (validation), 401 (invalid credentials)

### `POST /auth/logout`

Clears the auth session.

**Auth:** None (cookie is cleared regardless)

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `_csrf` | string | Yes |

**Success:** Clears `pd_auth` cookie, redirects to `/auth/login`

---

## Projects

All project routes require authentication and IP restriction. Routes under `/admin/projects`.

### `GET /admin/projects`

Lists all projects accessible to the current user, paginated.

**Auth:** Required  
**Roles:** All

**Query:**

| Param | Type | Default | Constraints |
|-------|------|---------|-------------|
| `page` | integer | 1 | ≥ 1 |

**Response:** Renders project list page. Owners and admins see all projects; editors see only assigned projects.

### `GET /admin/projects/create`

Renders the project creation form.

**Auth:** Required  
**Roles:** Admin, Owner

### `POST /admin/projects/create`

Creates a new project.

**Auth:** Required  
**Roles:** Admin, Owner  
**CSRF:** Yes

**Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | 1–200 characters |
| `slug` | string | Yes | 1–120 characters, slug pattern |
| `description` | string | No | Max 500 characters |
| `visibility` | string | No | `public` or `private` (default: `private`) |
| `_csrf` | string | Yes | CSRF token |

**Success:** Redirects to `/admin/projects/:projectId`

**Errors:** 400 (validation), 409 (slug taken)

### `GET /admin/projects/:projectId`

Shows project details and its versions.

**Auth:** Required  
**Roles:** Owner, Admin, Editor (with project access)

### `GET /admin/projects/:projectId/edit`

Renders the project edit form.

**Auth:** Required  
**Roles:** Admin, Owner

### `POST /admin/projects/:projectId`

Updates project metadata.

**Auth:** Required  
**Roles:** Admin, Owner  
**CSRF:** Yes

**Body:** Same fields as create (all optional — partial update).

**Success:** Redirects to `/admin/projects/:projectId`

### `POST /admin/projects/:projectId/delete`

Deletes a project and all its versions, pages, and changelogs.

**Auth:** Required  
**Roles:** Admin, Owner  
**CSRF:** Yes

**Success:** Redirects to `/admin/projects`

---

## Versions

All version routes require authentication and project access. Routes under `/admin/projects/:projectId/versions`.

### `GET /admin/projects/:projectId/versions`

Redirects to the parent project page.

### `GET /admin/projects/:projectId/versions/create`

Renders the version creation form, showing existing versions for cloning.

**Auth:** Required  
**Roles:** Admin, Owner

### `POST /admin/projects/:projectId/versions`

Creates a new version for the project.

**Auth:** Required  
**Roles:** Admin, Owner  
**CSRF:** Yes

**Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `label` | string | Yes | 1–100 characters |
| `is_public` | boolean | No | Default: `false` |
| `clone_from` | string | No | Version ID to clone pages from (max 15 chars) |
| `_csrf` | string | Yes | CSRF token |

**Success:** Redirects to `/admin/projects/:projectId`

### `GET /admin/projects/:projectId/versions/:versionId/edit`

Renders the version edit form.

**Auth:** Required  
**Roles:** All (with project access)

### `POST /admin/projects/:projectId/versions/:versionId`

Updates a version.

**Auth:** Required  
**Roles:** Admin, Editor, Owner  
**CSRF:** Yes

**Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `label` | string | No | 1–100 characters |
| `is_public` | boolean | No | — |
| `order` | integer | No | ≥ 0 |
| `_csrf` | string | Yes | CSRF token |

**Success:** Redirects to project page

### `POST /admin/projects/:projectId/versions/:versionId/delete`

Deletes a version and all its pages and changelog.

**Auth:** Required  
**Roles:** Admin, Owner  
**CSRF:** Yes

**Success:** Redirects to project page

---

## Pages

All page routes require authentication and project access. Routes under `/admin/projects/:projectId/versions/:versionId/pages`.

### `GET /admin/projects/:projectId/versions/:versionId/pages`

Lists all pages for the version, displayed as a nested tree.

**Auth:** Required  
**Roles:** All (with project access)

### `GET /admin/projects/:projectId/versions/:versionId/pages/new`

Renders the page editor for creating a new page.

**Auth:** Required  
**Roles:** Admin, Owner

### `POST /admin/projects/:projectId/versions/:versionId/pages`

Creates a new page.

**Auth:** Required  
**Roles:** Admin, Owner  
**CSRF:** Yes

**Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `title` | string | Yes | 1–200 characters |
| `slug` | string | Yes | 1–120 characters, slug pattern |
| `content` | string | No | Max 500,000 characters |
| `parent` | string | No | Page ID (max 15 chars), empty string for root |
| `icon` | string | No | Max 50 characters |
| `_csrf` | string | Yes | CSRF token |

**Success:** Redirects to page editor

### `GET /admin/projects/:projectId/versions/:versionId/pages/:pageId`

Renders the page editor with existing content.

**Auth:** Required  
**Roles:** All (with project access)

### `POST /admin/projects/:projectId/versions/:versionId/pages/:pageId`

Updates an existing page.

**Auth:** Required  
**Roles:** Admin, Editor, Owner  
**CSRF:** Yes

**Body:** Same fields as create (all optional — partial update). Also accepts `order` (integer, ≥ 0).

**Success:** Redirects to page editor

### `POST /admin/projects/:projectId/versions/:versionId/pages/:pageId/delete`

Deletes a page.

**Auth:** Required  
**Roles:** Admin, Owner  
**CSRF:** Yes

**Success:** Redirects to pages list

### `POST /admin/projects/:projectId/versions/:versionId/pages/preview`

Returns rendered Markdown as HTML (for live editor preview).

**Auth:** Required  
**Roles:** All (with project access)

**Body:**

| Field | Type | Required |
|-------|------|----------|
| `content` | string | Yes |

**Response (JSON):**
```json
{
  "html": "<h1>Rendered Markdown</h1><p>Content here...</p>"
}
```

### `POST /admin/projects/:projectId/versions/:versionId/pages/reorder`

Reorders pages and updates parent relationships.

**Auth:** Required  
**Roles:** Admin, Editor, Owner  
**CSRF:** Yes

**Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `pages` | array | Yes | Min 1 item |
| `pages[].id` | string | Yes | 1–15 characters |
| `pages[].order` | integer | Yes | ≥ 0 |
| `pages[].parent` | string | No | Page ID or empty string |
| `_csrf` | string | Yes | CSRF token |

**Success:** JSON `{ success: true }`

---

## Changelogs

Routes under `/admin/projects/:projectId/versions/:versionId/changelog`.

### `GET /admin/projects/:projectId/versions/:versionId/changelog`

Renders the changelog editor for the version.

**Auth:** Required  
**Roles:** All (with project access)

### `POST /admin/projects/:projectId/versions/:versionId/changelog`

Creates or updates the changelog for the version (upsert).

**Auth:** Required  
**Roles:** Admin, Owner  
**CSRF:** Yes

**Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `content` | string | Yes | 1–500,000 characters |
| `published_at` | string | No | Date string or empty |
| `_csrf` | string | Yes | CSRF token |

**Success:** Redirects to changelog editor

### `POST /admin/projects/:projectId/versions/:versionId/changelog/preview`

Returns rendered Markdown as HTML.

**Auth:** Required  
**Roles:** All (with project access)

**Body / Response:** Same as page preview.

---

## Users

All user routes require Owner role. Routes under `/admin/users`.

### `GET /admin/users`

Lists all users, paginated.

**Auth:** Required  
**Roles:** Owner

**Query:**

| Param | Type | Default |
|-------|------|---------|
| `page` | integer | 1 |

### `GET /admin/users/:id/edit`

Re-renders the users list with the specified user loaded for editing (modal).

**Auth:** Required  
**Roles:** Owner

**Query:**

| Param | Type | Default |
|-------|------|---------|
| `page` | integer | 1 |

### `POST /admin/users/create`

Creates a new user.

**Auth:** Required  
**Roles:** Owner  
**CSRF:** Yes

**Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | 2–100 characters |
| `email` | string | Yes | Valid email, max 255 |
| `password` | string | Yes | 8–256 characters |
| `passwordConfirm` | string | Yes | Must match `password` |
| `role` | string | Yes | `admin` or `editor` |
| `_csrf` | string | Yes | CSRF token |

**Success:** Redirects to users list

**Errors:** 400 (validation), 409 (email taken)

### `POST /admin/users/:id/update`

Updates an existing user.

**Auth:** Required  
**Roles:** Owner  
**CSRF:** Yes

**Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `name` | string | Yes | 2–100 characters |
| `email` | string | Yes | Valid email, max 255 |
| `role` | string | Yes | `admin` or `editor` |
| `password` | string | No | 8–256 characters if provided |
| `passwordConfirm` | string | No | Must match `password` if provided |
| `_csrf` | string | Yes | CSRF token |

### `POST /admin/users/:id/delete`

Deletes a user. Cannot delete yourself.

**Auth:** Required  
**Roles:** Owner  
**CSRF:** Yes

**Success:** Redirects to users list

---

## Settings

Routes under `/admin/settings`.

### `GET /admin/settings`

Renders the settings page with current site settings and IP restriction configuration.

**Auth:** Required  
**Roles:** Admin, Owner

### `POST /admin/settings`

Updates site settings and (optionally) IP restriction rules.

**Auth:** Required  
**Roles:** Admin (site settings only), Owner (site settings + IP restriction)  
**CSRF:** Yes

**Body:**

| Field | Type | Required | Constraints | Notes |
|-------|------|----------|-------------|-------|
| `heroWord1` | string | Yes | 1–50 characters | Home page hero word 1 |
| `heroWord2` | string | Yes | 1–50 characters | Home page hero word 2 |
| `heroSubtitle` | string | No | Max 300 characters | Home page subtitle |
| `enabled` | string | No | `enable` or `disable` | IP restriction toggle (Owner only) |
| `allowedIps` | string | No | Max 5,000 characters | Newline-separated IP allowlist (Owner only) |
| `_csrf` | string | Yes | CSRF token | |

**Success:** Redirects to settings page

---

## GitHub Integration

Routes under `/admin/github`. Requires Admin or Owner role. All routes require a configured `GITHUB_TOKEN` environment variable.

### `GET /admin/github/repos`

Lists GitHub repositories accessible with the configured token.

**Auth:** Required  
**Roles:** Admin, Owner

**Query:**

| Param | Type | Default |
|-------|------|---------|
| `page` | integer | 1 |

**Response (JSON):**
```json
[
  {
    "full_name": "owner/repo",
    "description": "Repository description",
    "html_url": "https://github.com/owner/repo",
    "default_branch": "main"
  }
]
```

### `GET /admin/github/repo-info`

Fetches metadata for a specific repository by URL.

**Auth:** Required  
**Roles:** Admin, Owner

**Query:**

| Param | Type | Required |
|-------|------|----------|
| `url` | string | Yes |

**Response (JSON):** GitHub repository object

### `GET /admin/github/repos/:owner/:repo/tags`

Lists tags for a repository.

**Auth:** Required  
**Roles:** Admin, Owner

**Query:**

| Param | Type | Default |
|-------|------|---------|
| `page` | integer | 1 |

**Response (JSON):** Array of tag objects

### `GET /admin/github/repos/:owner/:repo/commits`

Lists commits for a repository.

**Auth:** Required  
**Roles:** Admin, Owner

**Query:**

| Param | Type | Default |
|-------|------|---------|
| `page` | integer | 1 |

**Response (JSON):** Array of commit objects

### `GET /admin/github/repos/:owner/:repo/docs-check`

Checks whether a `docs/` directory exists at the given ref.

**Auth:** Required  
**Roles:** Admin, Owner

**Query:**

| Param | Type | Default |
|-------|------|---------|
| `ref` | string | `HEAD` |

**Response (JSON):** Directory tree or error

### `POST /admin/github/import`

Imports documentation from a GitHub repository. Creates a project and versions from selected refs.

**Auth:** Required  
**Roles:** Admin, Owner  
**CSRF:** Yes

**Body:**

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `repoUrl` | string | Yes | Valid GitHub repository URL |
| `projectName` | string | Yes | 1–200 characters |
| `projectSlug` | string | Yes | 1–120 characters, slug pattern |
| `visibility` | string | No | `public` or `private` (default: `private`) |
| `refs` | array | Yes | Array of ref strings (tags, branches, commits) |
| `_csrf` | string | Yes | CSRF token |

**Success:** Redirects to the created project

**Process:** For each ref, the importer fetches the `docs/` directory tree, reads all `.md` files, extracts titles and slugs from filenames, preserves directory hierarchy as parent-child page relationships, and creates pages with the Markdown content.

---

## Public Routes

### `GET /`

Home page showing all public projects.

**Auth:** None

### `GET /docs/:projectSlug`

Project landing page. Redirects to the first public version's first page.

**Auth:** None

### `GET /docs/:projectSlug/:versionSlug`

Version page. Redirects to the first page of the version, or to the changelog if no pages exist.

**Auth:** None

### `GET /docs/:projectSlug/:versionSlug/:pageSlug`

Renders a documentation page with:
- Rendered Markdown content
- Sidebar navigation (page tree)
- Table of contents (extracted from headings)
- Previous/next page links
- Version switcher

**Auth:** None

### `GET /docs/:projectSlug/:versionSlug/changelog`

Renders the version's changelog (if published).

**Auth:** None

### `GET /api/search`

Full-text search across public documentation pages.

**Auth:** None

**Query:**

| Param | Type | Required | Constraints |
|-------|------|----------|-------------|
| `q` | string | Yes | Min 2 characters (after sanitization) |
| `project` | string | No | Project ID to scope search |
| `version` | string | No | Version ID to scope search |

**Response (JSON):**
```json
{
  "results": [
    {
      "id": "abc123def456789",
      "title": "Getting Started",
      "slug": "getting-started",
      "versionLabel": "v1.0",
      "versionSlug": "v1-0"
    }
  ]
}
```

---

## Rate Limits

| Scope | Window | Max Requests | Applies To |
|-------|--------|-------------|------------|
| General | 15 minutes | 100 (configurable) | All routes |
| Auth | 15 minutes | 10 (configurable) | `/auth/*`, `/setup` |

Rate-limited responses return HTTP 429:

```json
{
  "error": {
    "code": "RATE_LIMITED",
    "message": "Too many requests. Please try again later."
  }
}
```
