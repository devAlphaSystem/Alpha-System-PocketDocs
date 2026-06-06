# PocketDocs

Self-hosted documentation platform with versioning, powered by [PocketBase](https://pocketbase.io/).

PocketDocs lets teams create, organize, and publish documentation and Knowledge Base content for multiple projects with versioned or Non-Versioned modes, nested page trees, changelogs, and full-text search. The admin panel provides a Markdown editor with live preview and role-based access control.

PocketDocs supports two database modes:
- External mode: connect to your own PocketBase instance.
- Embedded mode: PocketDocs downloads and manages PocketBase automatically.

## Features

- **Flexible project modes** — choose versioned or Non-Versioned projects
- **Nested page tree** — drag-and-drop ordering with parent-child hierarchy
- **Knowledge Base** — Frequently Asked Questions and Troubleshooting sections in Markdown alongside documents
- **Markdown editor** — EasyMDE with syntax-highlighted live preview and Markdown download
- **Bulk Markdown import** — create documentation pages or Knowledge Base articles from `.md` or `.markdown` files and folders, preserving hierarchy within the total import size limit
- **Mermaid diagrams** — native rendering of Mermaid diagram blocks in published docs
- **Full-text search** — instant search across all public pages
- **Role-based access** — Owner, Admin, and Editor roles with granular permissions
- **Changelogs** — per-version changelog with optional publish date
- **Public & private projects** — control visibility per project
- **IP restriction** — restrict admin access to specific IP addresses
- **Theming** — built-in light/dark mode toggle
- **ZIP export** — download project content as Markdown files in a single ZIP archive
- **Keyboard shortcuts** — Ctrl+S / Cmd+S saves the current admin form from anywhere on the page
- **Self-hosted** — runs on your infrastructure; data stays with you

## Project Modes

- **Versioned mode** — classic release-based documentation with multiple versions, version switcher, per-version changelog, and per-version Documents/FAQ/Troubleshooting sections
- **Non-Versioned mode** — one public content stream with Documents, Frequently Asked Questions, and Troubleshooting tabs backed by one internal default version

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js ≥ 20 |
| Framework | Express 5 |
| Database | [PocketBase](https://pocketbase.io/) (external or embedded mode) |
| Templating | EJS + express-ejs-layouts |
| Markdown | Marked + highlight.js + sanitize-html + Mermaid |
| Validation | Zod |
| Logging | Winston (console transport) |
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
│       ├── pages/            # Documents, FAQ, and Troubleshooting pages
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
