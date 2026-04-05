# DPD Drawing Tool

A customised [draw.io](https://www.drawio.com/) diagramming environment built for [NOLAI](https://www.ru.nl/en/nolai) (Nationaal Onderzoekslab voor AI). The tool enforces DPD (Data Protection by Design) semantic rules directly in the diagram canvas, and stores files in an integrated Nextcloud instance over WebDAV.

---

## Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick start — full stack](#quick-start--full-stack)
- [Deploy draw.io only](#deploy-drawio-only)
- [Development setup](#development-setup)
- [Running the tests](#running-the-tests)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Overview

The DPD Drawing Tool extends the open-source draw.io application with:

- **DPD plugin** (`drawio app/src/main/webapp/plugins/dpd.js`) — a draw.io plugin that listens for graph model changes and enforces DPD semantic rules: connection validation between incompatible DPD types, cardinality constraints, and required attribute checks.
- **NOLAI UI customisations** — the NOLAI logo in the top-left corner (linking to [nolai.nl](https://www.ru.nl/en/nolai)), suppression of draw.io UI elements not relevant to the DPD workflow ("Edit Data", "Clear Default Style"), and hardened resize behaviour.
- **Nextcloud integration** — diagrams are saved and loaded through the Nextcloud WebDAV API, with support for file listing, versioning, sharing, and deletion.
- **Secure reverse proxy** — Caddy terminates HTTPS and proxies Nextcloud, handling CORS preflight for WebDAV requests from the draw.io container.

---

## Architecture

```
Browser
  │
  ├── http://localhost:5500  ──▶  draw.io (Tomcat, Docker)
  │                                └── dpd.js plugin
  │
  └── https://localhost      ──▶  Caddy (reverse proxy, TLS)
                                   └── Nextcloud (PHP, Docker)
                                        └── MariaDB (Docker)
```

All four services run as Docker containers orchestrated by Docker Compose. The Compose file and a matching Caddyfile are generated at deploy time by `setup_merged.sh`.

---

## Prerequisites

| Dependency | Minimum version | Notes |
|---|---|---|
| Docker | 24+ | [docs.docker.com](https://docs.docker.com/get-docker/) |
| Docker Compose | v2 (plugin) or v1 (`docker-compose`) | Detected automatically by the setup script |
| Node.js | 20+ | Only needed for running tests locally |
| Bash | Any modern version | macOS, Linux, or WSL on Windows |

On **Windows**, run the setup script and all commands inside WSL 2 (Windows Subsystem for Linux). The certificate installation step at the end of setup must be completed in Windows itself (see [Troubleshooting](#troubleshooting)).

---

## Quick start — full stack

This single command builds and starts all four containers (draw.io, Nextcloud, MariaDB, Caddy), auto-installs Nextcloud, and configures the draw.io integration:

```bash
bash setup_merged.sh
```

The script will:

1. Tear down any previous containers and volumes.
2. Generate a `docker-compose.yml` and `Caddyfile` in the repo root.
3. Build the custom draw.io image from `drawio app/Dockerfile`.
4. Pull and start Nextcloud, MariaDB, and Caddy.
5. Wait for Nextcloud to initialise, then run the automated installation via `occ maintenance:install`.
6. Configure trusted domains, HTTPS overrides, and Nextcloud proxy settings.
7. Export Caddy's self-signed root certificate to `caddy-root.crt` in the repo root.

Once it completes:

| Service | URL |
|---|---|
| draw.io | [http://localhost:5500](http://localhost:5500) |
| Nextcloud | [https://localhost](https://localhost) |

Default Nextcloud credentials: **username** `admin`, **password** `admin`.

> **Trust the certificate (required for HTTPS).** Before using Nextcloud in your browser or connecting from draw.io, install the generated `caddy-root.crt` as a trusted root certificate. See [Trusting the Caddy certificate](#trusting-the-caddy-certificate) below.

---

## Deploy draw.io only

To run just the draw.io container without Nextcloud (useful for UI development and running E2E UI tests). **Run all commands from the repo root** — note the `"drawio app/"` path argument so you never need to `cd` into that directory:

```bash
# From the repo root
docker build -t dpd-drawio "drawio app/"
docker run -d --name drawio-app -p 5500:8080 dpd-drawio
```

The app will be available at [http://localhost:5500](http://localhost:5500).

Stop it when done:

```bash
docker stop drawio-app && docker rm drawio-app
```

---

## Development setup

### Editing the DPD plugin

The plugin source is at `drawio app/src/main/webapp/plugins/dpd.js`. After making changes, rebuild and restart from the repo root:

```bash
docker build -t dpd-drawio "drawio app/"
docker stop drawio-app && docker rm drawio-app
docker run -d --name drawio-app -p 5500:8080 dpd-drawio
```

Alternatively, if you only need to iterate on `dpd.js` without a full rebuild, copy the file directly into the running container:

```bash
docker cp "drawio app/src/main/webapp/plugins/dpd.js" drawio-app:/usr/local/tomcat/webapps/ROOT/plugins/dpd.js
```

Reload the browser to pick up the change.

### Code comment conventions

The team follows a defined comment style. See `docs/comment_conventions.txt` for the full guide. The key points:

- Every touched file gets a header block referencing `NOLAI`.
- Each edited or created code section is wrapped with `// ====== NOLAI - ... ======` and `// ====== end of changes by SE ======`.
- Comments should explain *why*, not *what* the code does.

---

## Running the tests

See [TESTING.md](TESTING.md) for the full testing guide. The short version — all commands run from the repo root:

```bash
# Unit tests (no Docker needed)
cd tests/unit
npm install
npm test
cd ../..
```

```bash
# Unit tests with coverage report
cd tests/unit
npm run test:coverage
# Open tests/unit/coverage/index.html in a browser for the line-by-line view
cd ../..
```

```bash
# E2E UI tests — first start the draw.io container (see "Deploy draw.io only" above),
# then from the repo root:
cd tests/e2e
npm install
npx playwright install --with-deps chromium firefox
npx playwright test specs/plugin-init.spec.js specs/dpd-rules.spec.js
cd ../..
```

```bash
# Integration tests — first run setup_merged.sh, then from the repo root:
cd tests/e2e
INTEGRATION=1 npx playwright test specs/file-operations.spec.js --project=chromium
cd ../..
```

Current test status:

- 15 unit tests passing, 5 stubs pending Sprint 2 features
- Statement coverage: **93.5%**, branch coverage: **93.2%**, function coverage: **100%**

---

## Project structure

```
.
├── README.md                        # This file
├── TESTING.md                       # Full testing guide
├── setup_merged.sh                  # One-command full-stack deployment
├── .gitignore
│
├── docs/
│   ├── comment_conventions.txt      # Code comment style guide
│   └── NOLAI Figma Prototype.pdf    # UI design reference
│
├── drawio app/                      # Customised draw.io build
│   ├── Dockerfile                   # Two-stage: Ant build → Tomcat runtime
│   ├── src/main/webapp/
│   │   └── plugins/
│   │       └── dpd.js               # DPD plugin — the primary application logic
│   └── ...                          # draw.io source tree (Apache 2.0)
│
└── tests/
    ├── unit/                        # Jest unit tests for dpd.js
    │   ├── dpd.plugin.test.js
    │   ├── jest.config.js
    │   ├── jest.transform.js        # Custom babel-jest wrapper for coverage
    │   ├── setup.js                 # mxGraph mocks
    │   └── package.json
    ├── e2e/                         # Playwright browser tests
    │   ├── playwright.config.js
    │   ├── package.json
    │   └── specs/
    │       ├── plugin-init.spec.js
    │       ├── dpd-rules.spec.js
    │       └── file-operations.spec.js
    ├── manual/                      # Historical manual test records
    │   ├── PLUGIN_DEMO_TEST.md
    │   └── UI_LOGO_TEST.md
    └── nextcloudCallTests.js        # Browser console tests for WebDAV helpers
```

---

## Troubleshooting

### Trusting the Caddy certificate

Caddy generates a self-signed root certificate for `https://localhost`. Browsers and draw.io's WebDAV client will refuse connections until this certificate is trusted.

**macOS:**

```bash
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain caddy-root.crt
```

**Linux (Debian/Ubuntu):**

```bash
sudo cp caddy-root.crt /usr/local/share/ca-certificates/caddy-root.crt
sudo update-ca-certificates
```

**Windows (run in PowerShell as Administrator):**

```powershell
certutil -addstore -f "Root" caddy-root.crt
```

Or double-click `caddy-root.crt` in Explorer → Install Certificate → Local Machine → Trusted Root Certification Authorities.

After trusting the certificate, restart your browser.

### Nextcloud shows "untrusted domain" error

The setup script configures `localhost` as a trusted domain. If you access Nextcloud from a different hostname or IP, add it:

```bash
docker exec --user www-data nextcloud-main php occ config:system:set trusted_domains 2 --value=YOUR_HOSTNAME
```

### draw.io container fails to build

The Dockerfile uses a two-stage build: an `eclipse-temurin:17-jdk-jammy` builder runs `ant war` to compile the `.war` file, then a `tomcat:9.0-jdk17-temurin` runner serves it. Build failures are almost always caused by a missing or incompatible version of the draw.io source. Ensure the `drawio app/` directory contains the full draw.io source tree (check that `drawio app/etc/build/build.xml` exists).

### Ports already in use

The stack uses ports 80, 443, and 5500. To find and stop conflicting processes:

```bash
# macOS / Linux
sudo lsof -i :5500
sudo lsof -i :443

# Windows (PowerShell)
netstat -ano | findstr :5500
```

### Resetting the stack completely

```bash
docker compose down -v        # or docker-compose down -v
sudo rm -rf nextcloud_data nextcloud_db caddy_data
bash setup_merged.sh
```
