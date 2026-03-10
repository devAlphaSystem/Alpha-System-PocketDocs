# PocketDocs

Self-hosted documentation platform with versioning, powered by [PocketBase](https://pocketbase.io/).

PocketDocs lets teams create, organize, and publish documentation for multiple projects with either versioned or simple docs mode, nested page trees, changelogs, and full-text search. The admin panel provides a Markdown editor with live preview, role-based access control, and optional GitHub import to bootstrap docs from existing repositories.

PocketDocs supports two database modes:
- External mode: connect to your own PocketBase instance.
- Embedded mode: PocketDocs downloads and manages PocketBase automatically.

## Features

- **Flexible project modes** — choose versioned docs (release history) or simple docs (single stream)
- **Nested page tree** — drag-and-drop ordering with parent-child hierarchy
- **Markdown editor** — EasyMDE with syntax-highlighted live preview
- **Mermaid diagrams** — native rendering of Mermaid diagram blocks in published docs
- **Full-text search** — instant search across all public pages
- **Role-based access** — Owner, Admin, and Editor roles with granular permissions
- **GitHub import** — import Markdown docs directly from GitHub repos (tags, branches, commits)
- **Changelogs** — per-version changelog with optional publish date
- **Public & private projects** — control visibility per project
- **IP restriction** — restrict admin access to specific IP addresses
- **Theming** — built-in light/dark mode toggle
- **Keyboard shortcuts** — Ctrl+S / Cmd+S saves the current admin form from anywhere on the page
- **Self-hosted** — runs on your infrastructure; data stays with you

## Project Modes

- **Versioned mode** — classic release-based docs with multiple versions, version switcher, and per-version changelog
- **Simple mode** — single-stream docs without versioned public URLs; optimized for internal/team knowledge bases
- Simple-mode projects still store one internal default version for data consistency, but public links use `/docs/:projectSlug/:pageSlug`

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js ≥ 20 |
| Framework | Express 5 |
| Database | [PocketBase](https://pocketbase.io/) (external or embedded mode) |
| Templating | EJS + express-ejs-layouts |
| Markdown | Marked + highlight.js + sanitize-html + Mermaid |
| Validation | Zod |
| Logging | Winston + daily-rotate-file |
| Auth | Cookie-based JWT via PocketBase |

## Quick Start

### Embedded Mode (Automatic)

```bash
# 1. Clone and install
git clone "https://github.com/devAlphaSystem/Alpha-System-PocketDocs.git" pocketdocs && cd pocketdocs
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set POCKETBASE_MODE=embedded, admin credentials, and secrets

# 3. Start PocketDocs (PocketBase auto-installs and starts)
npm run dev
```

Open `http://localhost:3000` — you will be redirected to the owner setup page on first launch.

### External Mode (Manual PocketBase)

```bash
# 1. Start PocketBase in a separate terminal
./pocketbase serve

# 2. Configure environment
cp .env.example .env
# Edit .env — set POCKETBASE_MODE=external, POCKETBASE_URL, admin credentials, and secrets

# 3. Start PocketDocs (schema is applied automatically on startup)
npm run dev
```

## Project Structure

```
pocketdocs/
├── src/
│   ├── index.js              # Express app setup & server entry point
│   ├── config/               # Environment variables & constants
│   ├── errors/               # AppError hierarchy & error handling
│   ├── lib/                  # Shared utilities (markdown, logging, PocketBase client)
│   ├── middleware/            # Express middleware (auth, CSRF, rate limiting, etc.)
│   └── modules/              # Feature modules (controller / service / validation)
│       ├── auth/             # Login & logout
│       ├── changelogs/       # Version changelogs
│       ├── github/           # GitHub repo import
│       ├── pages/            # Documentation pages
│       ├── projects/         # Project management
│       ├── public/           # Public-facing routes & search API
│       ├── settings/         # Site settings & IP restriction
│       ├── setup/            # Initial owner registration
│       ├── users/            # User management
│       └── versions/         # Version management
├── views/                    # EJS templates (admin + public layouts)
├── public/                   # Static assets (CSS, JS, images)
├── data/                     # Runtime configuration files (site settings, IP rules)
├── db_schema.json            # Safe PocketBase schema (applied automatically on startup)
└── .env.example              # Environment variable template
```

## Documentation

| Document | Description |
|----------|-------------|
| [Setup & Installation](docs/setup.md) | Prerequisites, detailed install steps, troubleshooting |
| [Architecture Overview](docs/architecture.md) | System design, data flow, component responsibilities |
| [API Reference](docs/api.md) | All endpoints with request/response examples |
| [Configuration](docs/configuration.md) | Environment variables & runtime config files |

## Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Start production server |
| `npm run dev` | Start with nodemon (auto-reload) |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run format:check` | Check formatting without writing |

## License

[MIT](LICENSE) © 2026 devAlphaSystem
