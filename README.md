# PocketDocs

Self-hosted documentation platform with versioning, powered by [PocketBase](https://pocketbase.io/).

PocketDocs lets teams create, organize, and publish documentation for multiple projects—each with independent versions, nested page trees, changelogs, and full-text search. The admin panel provides a Markdown editor with live preview, role-based access control, and optional GitHub import to bootstrap docs from existing repositories.

## Features

- **Multi-project, multi-version** — manage many documentation projects, each with unlimited versions
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

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js ≥ 20 |
| Framework | Express 5 |
| Database | [PocketBase](https://pocketbase.io/) |
| Templating | EJS + express-ejs-layouts |
| Markdown | Marked + highlight.js + sanitize-html + Mermaid |
| Validation | Zod |
| Logging | Winston + daily-rotate-file |
| Auth | Cookie-based JWT via PocketBase |

## Quick Start

```bash
# 1. Clone and install
git clone "https://github.com/devAlphaSystem/Alpha-System-PocketDocs.git" pocketdocs && cd pocketdocs
npm install

# 2. Start PocketBase (separate terminal)
./pocketbase serve

# 3. Configure environment
cp .env.example .env
# Edit .env — set POCKETBASE_URL, admin credentials, and secrets

# 4. Import the database schema
# In the PocketBase admin UI, import pb_schema.json

# 5. Start PocketDocs
npm run dev
```

Open `http://localhost:3000` — you will be redirected to the owner setup page on first launch.

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
├── pb_schema.json            # PocketBase collection schema (import on first setup)
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
