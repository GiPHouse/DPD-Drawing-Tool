# DPD Drawing Tool

A customised [draw.io](https://www.drawio.com/) diagramming environment built for [NOLAI](https://www.ru.nl/en/nolai) (Nationaal Onderzoekslab voor AI). The tool enforces DPD (Data Protection by Design) semantic rules directly in the diagram canvas and stores diagrams in an integrated Nextcloud file storage instance.

---

## Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick start — development stack](#quick-start--development-stack)
- [Single-container deployment](#single-container-deployment)
- [Deploy draw.io only](#deploy-drawio-only)
- [Development setup](#development-setup)
- [Running the tests](#running-the-tests)
- [Project structure](#project-structure)
- [Troubleshooting](#troubleshooting)

---

## Overview

The DPD Drawing Tool is built on top of the open-source draw.io diagramming application. It adds:

- **DPD plugin** (`drawio app/src/main/webapp/plugins/dpd.js`) — enforces DPD semantic rules in the diagram canvas: connection validation, cardinality constraints, and required attribute checks.
- **NOLAI UI customisations** — the NOLAI logo, removal of draw.io UI elements not relevant to the DPD workflow, and hardened resize behaviour.
- **Nextcloud integration** — diagrams are saved and loaded via Nextcloud's WebDAV API, giving users file versioning, sharing, and access control.
- **Caddy reverse proxy** — handles HTTPS (secure connections) for both services so the browser and draw.io can communicate securely.

---

## Architecture

### What each service does

| Service | What it is | Role in this project |
|---|---|---|
| **Draw.io** | A diagramming web app running on Tomcat (a Java web server) | The user-facing application with the DPD plugin |
| **Nextcloud** | A self-hosted file storage platform (like a private Google Drive) | Stores and manages diagram files via WebDAV |
| **MariaDB** | A relational database (similar to MySQL) | Stores Nextcloud's internal data (users, file metadata, settings) |
| **Caddy** | A web server used as a reverse proxy | Sits in front of both services, handles HTTPS, and routes traffic to the right place |

### Why Caddy sits in front of everything

Caddy is a **reverse proxy** — instead of the browser connecting directly to Draw.io or Nextcloud, all traffic goes through Caddy first. This allows Caddy to handle HTTPS (encrypted connections) in one place, so Draw.io and Nextcloud don't each need their own certificate setup. Caddy routes traffic based on port: port 443 goes to Nextcloud, port 5443 goes to Draw.io.

### Development stack (Docker Compose)

Four separate containers, each running one service:

```
Browser
  │
  ├── https://localhost:5443  ──▶  Caddy  ──▶  Draw.io container  (port 8080)
  │                                               └── dpd.js plugin
  │
  └── https://localhost       ──▶  Caddy  ──▶  Nextcloud container (port 80)
                                                 └── MariaDB container (port 3306)
```

### Single-container image (`docker/Dockerfile`)

All four services bundled inside one container, managed by `supervisord` (a process manager that starts and monitors multiple programs at once):

```
docker run -p 443:443 -p 5443:5443 dpd-app
  └── supervisord (starts and monitors all services)
        ├── Caddy    → external port 443  → Apache:8000  (Nextcloud)
        │             external port 5443  → Tomcat:8080  (Draw.io)
        ├── Apache2  → internal port 8000 (serves Nextcloud PHP files)
        ├── Tomcat 9 → internal port 8080 (serves Draw.io WAR file)
        └── MariaDB  → internal socket    (database, not reachable externally)
```

This image is intended for the client — they only need Docker installed and one command to run the entire application.

---

## Prerequisites

### Development stack

| Dependency | Minimum version | Notes |
|---|---|---|
| Docker | 24+ | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| Docker Compose | v2 plugin or v1 binary | Detected automatically by `start.sh` |
| Node.js | 20+ | Only needed to run tests locally |
| Bash | Any modern version | macOS/Linux built-in; Windows users need WSL 2 |

> **Windows users:** Run all commands inside WSL 2 (Windows Subsystem for Linux). The certificate trust step at the end must be done in Windows itself — see [Troubleshooting](#troubleshooting).

### Single-container image (client)

Only Docker 24+ is required. No Compose, no scripts, no extra files.

---

## Quick start — development stack

### Step 1 — Set up your environment variables

Environment variables are how we pass configuration (like passwords) to Docker without hardcoding them in the source code. They live in a `.env` file which is **never committed to git** — each developer has their own local copy.

```bash
# Run this from the repo root directory
cp .env.example .env
```

Now open `.env` in a text editor and replace every `change_me_...` placeholder with a real value. The `.env.example` file has a description next to each variable explaining what it is.

### Step 2 — Start the stack

```bash
bash start.sh
```

This script does four things automatically:
1. Builds the custom Draw.io Docker image from source
2. Starts all four containers (`docker compose up`)
3. Waits for Nextcloud to finish its first-boot setup, then enables the Draw.io integration
4. Exports Caddy's self-signed HTTPS certificate to `caddy-root.crt` in the repo root

The first run takes a few minutes because Docker is building the Draw.io image and Nextcloud is installing itself.

### Step 3 — Trust the HTTPS certificate

Caddy generates a **self-signed certificate** to enable HTTPS on localhost. Browsers don't trust self-signed certificates by default (they're not issued by a known authority like Let's Encrypt), so you need to manually tell your machine to trust this one.

> **Important:** Run these commands from inside the repo directory, not your home directory. The `caddy-root.crt` file was saved to the repo root by `start.sh`.

```bash
# Navigate to the repo first
cd /path/to/this/repo

# macOS
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain caddy-root.crt

# Linux (Debian/Ubuntu)
sudo cp caddy-root.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates

# Windows (PowerShell as Administrator)
certutil -addstore -f "Root" caddy-root.crt
```

After running the command, **restart your browser**. You only need to do this once — the certificate persists on your machine until you reset the Docker volumes.

### Step 4 — Open the application

| Service | URL |
|---|---|
| Draw.io | [https://localhost:5443](https://localhost:5443) |
| Nextcloud | [https://localhost](https://localhost) |

Log in to Nextcloud with the `NEXTCLOUD_ADMIN_USER` and `NEXTCLOUD_ADMIN_PASSWORD` values you set in `.env`.

---

## Single-container deployment

The `docker/` directory contains everything needed to build a single distributable image. This is what the client uses — they don't interact with the codebase or run any scripts.

### Build the image

```bash
# Run from the repo root (the . at the end means "use this directory as the build context")
docker build -f docker/Dockerfile -t dpd-app:latest .
```

### Push to a registry

A Docker registry (like Docker Hub or GitHub Container Registry) is where you store and share Docker images — similar to how GitHub stores code.

```bash
docker tag dpd-app:latest your-registry/dpd-app:latest
docker push your-registry/dpd-app:latest
```

### Client deployment (one command)

The client runs this on their server:

```bash
docker run -d \
  -p 443:443 \
  -p 5443:5443 \
  -v dpd_data:/data \
  -e MYSQL_PASSWORD=your_db_password \
  -e NEXTCLOUD_ADMIN_PASSWORD=your_admin_password \
  your-registry/dpd-app:latest
```

**What these flags mean:**
- `-d` — run in the background (detached)
- `-p 443:443` — map port 443 on the host to port 443 inside the container
- `-v dpd_data:/data` — attach a Docker volume called `dpd_data` to `/data` inside the container. This is how data (database files, uploaded diagrams) persists when the container is stopped or restarted. Without this, all data would be lost every time the container stops.
- `-e` — set an environment variable inside the container

On **first boot**, the container automatically initialises the database, installs Nextcloud, and configures all settings. This takes a couple of minutes. Subsequent starts skip setup and go straight to running.

### All environment variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `MYSQL_PASSWORD` | Yes | — | Password for the Nextcloud database user |
| `NEXTCLOUD_ADMIN_PASSWORD` | Yes | — | Password for the Nextcloud admin account |
| `MYSQL_DATABASE` | No | `nextcloud` | Database name |
| `MYSQL_USER` | No | `nextcloud` | Database username |
| `NEXTCLOUD_ADMIN_USER` | No | `admin` | Nextcloud admin username |
| `APP_DOMAIN` | No | `localhost` | The hostname clients use to reach the app. Set to a real domain for automatic Let's Encrypt TLS. |
| `OIDC_PROVIDER_URL` | No | unset | Goauthentik OIDC discovery URL — enables SSO login when set |
| `OIDC_CLIENT_ID` | No | unset | Required if `OIDC_PROVIDER_URL` is set |
| `OIDC_CLIENT_SECRET` | No | unset | Required if `OIDC_PROVIDER_URL` is set |

### Goauthentik SSO (authentication)

The client already runs a Goauthentik identity provider for user login. The container connects to the client's **existing** Goauthentik instance — it does not run one itself. Setting the three `OIDC_*` variables enables single sign-on automatically on first boot.

### Production TLS (real HTTPS certificate)

For a real domain (e.g. `dpd.example.com`), set `APP_DOMAIN=dpd.example.com` and remove the `local_certs` line from `docker/Caddyfile` before building the image. Caddy will automatically obtain and renew a trusted certificate from Let's Encrypt — no manual certificate management needed.

---

## Deploy draw.io only

Useful for UI development and running E2E tests without the full stack:

```bash
# From the repo root
docker build -t dpd-drawio "drawio app/"
docker run -d --name drawio-app -p 5500:8080 dpd-drawio
```

The app will be at [http://localhost:5500](http://localhost:5500).

> **Note:** E2E tests in `tests/e2e/` target `http://localhost:5500`. When running integration tests against the full Compose stack, update the base URL in `tests/e2e/playwright.config.js` to `https://localhost:5443`.

Stop and remove the container when done:

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

For rapid iteration without a full Docker rebuild, copy the file directly into the running container:

```bash
docker cp "drawio app/src/main/webapp/plugins/dpd.js" drawio-app:/usr/local/tomcat/webapps/ROOT/plugins/dpd.js
```

Then reload the browser — no restart needed.

### Code comment conventions

Every file touched by the SE team follows the comment style in `docs/comment_conventions.txt`. The key rules are:

- Every modified file gets a header block referencing `NOLAI`.
- Every edited or created code section is wrapped with `// ====== NOLAI - {Group/Sprint/Task} ======` and `// ====== end of changes by SE ======`.
- Comments explain *why* the code works the way it does, not just what it does.

---

## Running the tests

See [TESTING.md](TESTING.md) for the full guide. Quick reference — all commands from the repo root:

```bash
# Unit tests (no Docker needed)
cd tests/unit && npm install && npm test && cd ../..
```

```bash
# Unit tests with coverage report
cd tests/unit && npm run test:coverage && cd ../..
# Open tests/unit/coverage/index.html to view line-by-line coverage
```

```bash
# E2E UI tests — requires the draw.io container running on port 5500 (see above)
cd tests/e2e
npm install
npx playwright install --with-deps chromium firefox
npx playwright test specs/plugin-init.spec.js specs/dpd-rules.spec.js
cd ../..
```

```bash
# Integration tests — requires the full stack running (bash start.sh)
cd tests/e2e
INTEGRATION=1 npx playwright test specs/file-operations.spec.js --project=chromium
cd ../..
```

Current test status: 15 unit tests passing, 5 stubs pending Sprint 2 features. Statement coverage **93.5%**, branch coverage **93.2%**, function coverage **100%**.

---

## Project structure

```
.
├── README.md                        # This file
├── TESTING.md                       # Full testing guide
├── start.sh                         # Dev stack: build, start, enable app, export cert
├── setup_merged.sh                  # DEPRECATED — replaced by start.sh
├── docker-compose.yml               # Defines all four dev containers and how they connect
├── Caddyfile                        # Reverse proxy config for the dev stack
├── .env.example                     # Template for environment variables — copy to .env
│
├── docker/                          # Single-container image for client distribution
│   ├── Dockerfile                   # Builds the image: compiles Draw.io, installs all services
│   ├── entrypoint.sh                # Runs on container start: init DB, install Nextcloud, configure OIDC
│   ├── supervisord.conf             # Starts and monitors all 4 services inside the container
│   ├── Caddyfile                    # Reverse proxy config for the single-container image
│   ├── apache-nextcloud.conf        # Apache web server config for Nextcloud
│   └── mariadb-nextcloud.cnf        # Database settings required by Nextcloud
│
├── docs/
│   ├── comment_conventions.txt      # Code comment style guide
│   └── NOLAI Figma Prototype.pdf    # UI design reference
│
├── drawio app/                      # Customised draw.io build
│   ├── Dockerfile                   # Compiles draw.io source → WAR file → Tomcat server
│   ├── src/main/webapp/plugins/
│   │   └── dpd.js                   # The DPD plugin — primary application logic
│   └── ...                          # draw.io source tree (Apache 2.0 licence)
│
└── tests/
    ├── unit/                        # Jest unit tests for dpd.js
    ├── e2e/                         # Playwright browser automation tests
    ├── manual/                      # Historical manual test records
    └── nextcloudCallTests.js        # Browser console tests for WebDAV helper functions
```

---

## Troubleshooting

### Certificate error when running the trust command

If you see `Error reading file caddy-root.crt`, the terminal cannot find the file because you are not in the repo directory. The certificate is saved to the repo root by `start.sh`. Navigate there first:

```bash
cd /path/to/this/repo
sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain caddy-root.crt
```

If you are unsure where the repo is: `find ~ -name "caddy-root.crt" 2>/dev/null`

### Browser shows a security warning despite trusting the certificate

Restart the browser completely after running the trust command — most browsers cache certificate state and need a full restart (not just a new tab) to pick up the change.

### Nextcloud shows "untrusted domain" error

Nextcloud only accepts requests from hostnames listed in its trusted domains config. The default is `localhost`. If you access it from a different hostname or IP address, add it:

```bash
docker exec --user www-data nextcloud-main php occ config:system:set trusted_domains 2 --value=YOUR_HOSTNAME
```

### Draw.io container fails to build

The build compiles the draw.io source using Ant (a Java build tool). The most common cause of failure is a missing source file. Check that `drawio app/etc/build/build.xml` exists — if it is missing, the source tree is incomplete.

### Ports already in use

The stack requires ports 80, 443, and 5443 to be free. If another process is using them:

```bash
# macOS / Linux — find which process is using a port
sudo lsof -i :443
sudo lsof -i :5443

# Windows (PowerShell)
netstat -ano | findstr :443
```

Kill the conflicting process, then re-run `bash start.sh`.

### Reset the dev stack (wipe all data and start fresh)

```bash
docker compose down -v   # stops containers and deletes all volumes (database, Nextcloud files)
bash start.sh            # rebuilds and starts everything from scratch
```

> **Warning:** `down -v` permanently deletes all stored data including any diagrams saved in Nextcloud. Only do this if you want a completely clean environment.

### Reset the single-container deployment

```bash
docker stop <container_id>
docker volume rm dpd_data     # permanently deletes all stored data
docker run -d -p 443:443 -p 5443:5443 -v dpd_data:/data -e MYSQL_PASSWORD=... -e NEXTCLOUD_ADMIN_PASSWORD=... dpd-app:latest
```
