# DPD Drawing Tool

A customised [draw.io](https://www.drawio.com/) diagramming environment built for [NOLAI](https://www.ru.nl/en/nolai) (Nationaal Onderzoekslab voor AI). The tool enforces DPD (Data Protection by Design) semantic rules directly in the diagram canvas and stores diagrams in an integrated Nextcloud file storage instance.

---

## Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Quick start — development stack](#quick-start--development-stack)
- [Development auth stack — Goauthentik SSO](#development-auth-stack--goauthentik-sso)
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

## Development auth stack — Goauthentik SSO

The base dev stack (`bash start.sh`) uses Nextcloud's built-in username/password login. The auth stack layers a local [Goauthentik](https://goauthentik.io/) instance on top so you can develop and test the OIDC integration before pointing at the client's real Goauthentik server.

It is controlled by two files:

- `docker-compose.auth.yml` — a Compose override file that adds four new services (PostgreSQL, Redis, `authentik-server`, `authentik-worker`) and extends the `nextcloud` service with the OIDC environment variables.
- `start-auth.sh` — a startup script that handles everything automatically: adding an `/etc/hosts` entry, starting the stack, waiting for services to be healthy, creating the OAuth2 provider in Goauthentik via its API, writing the generated credentials back to `.env`, and configuring Nextcloud's `user_oidc` plugin.

> **Note:** This stack is for local development only. It runs an unencrypted Goauthentik instance over HTTP to avoid self-signed-certificate overhead. The client's production Goauthentik instance uses HTTPS — see [Goauthentik SSO (authentication)](#goauthentik-sso-authentication) for the production setup.

### Architecture

The auth stack extends the base four-container stack with four additional containers:

```
Browser
  │
  ├── https://localhost:5443  ──▶  Caddy  ──▶  Draw.io container   (port 8080)
  │
  ├── https://localhost       ──▶  Caddy  ──▶  Nextcloud container  (port 80)
  │                                                │ (user_oidc plugin)
  │                                                │ OIDC server-side calls (Docker DNS)
  │                                                ▼
  └── http://authentik-server:9000  ──▶  authentik-server container
                                             ├── PostgreSQL container (port 5432)
                                             └── Redis container      (in-memory)
                                             └── authentik-worker container
```

`authentik-server` is reachable as `http://authentik-server:9000` from both Nextcloud's PHP (via Docker Compose DNS) and the developer's browser (via an `/etc/hosts` entry that `start-auth.sh` adds). This means all OIDC discovery document endpoints, token exchange calls, and browser redirects all use the same hostname — no split-brain between in-container and host resolution.

### Prerequisites

In addition to the base stack prerequisites, the auth stack requires:

- **`jq`** — used by `start-auth.sh` to parse Goauthentik's API responses. Install with `brew install jq` (macOS) or `apt install jq` (Linux).
- **`sudo` access** — needed once to add the `authentik-server` hostname to `/etc/hosts`. The script explains this when it runs.

> **Windows users (WSL 2):** Run the script inside WSL 2, the same as the base stack. One extra step is needed because the browser runs on Windows and uses the Windows hosts file — see [Step 2](#step-2--start-the-auth-stack) below.

### Environment variables

These variables are only needed for the auth stack. Add them to your `.env` (they are already in `.env.example` with safe dev defaults):

| Variable | Description |
|---|---|
| `PG_PASS` | Password for Goauthentik's PostgreSQL database |
| `PG_USER` | PostgreSQL username (default: `authentik`) |
| `PG_DB` | PostgreSQL database name (default: `authentik`) |
| `AUTHENTIK_SECRET_KEY` | Random string (50+ chars) used to sign sessions and tokens |
| `AUTHENTIK_BOOTSTRAP_PASSWORD` | Password for the initial `akadmin` admin account — only applied on first boot |
| `AUTHENTIK_BOOTSTRAP_TOKEN` | Static API token used by `start-auth.sh` to create the OAuth2 provider without a browser login — only applied on first boot |
| `OIDC_CLIENT_ID` | Written back to `.env` automatically by `start-auth.sh` — do not set by hand |
| `OIDC_CLIENT_SECRET` | Written back to `.env` automatically by `start-auth.sh` — do not set by hand |

### Step 1 — Fill in the auth variables

Open `.env` and make sure `PG_PASS`, `AUTHENTIK_SECRET_KEY`, `AUTHENTIK_BOOTSTRAP_PASSWORD`, and `AUTHENTIK_BOOTSTRAP_TOKEN` are set. The defaults in `.env.example` are fine for local development.

Leave `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` empty — `start-auth.sh` will populate them.

### Step 2 — Start the auth stack

```bash
bash start-auth.sh
```

The script runs seven steps and prints progress as it goes:

1. Adds `127.0.0.1 authentik-server` to `/etc/hosts` (once per machine, requires `sudo`).
2. Validates that the required env vars are set.
3. Builds and starts the full auth stack (`docker compose -f docker-compose.yml -f docker-compose.auth.yml up`).
4. Waits for Nextcloud and Goauthentik to become healthy (Goauthentik's first boot runs database migrations and can take several minutes).
5. Creates an OAuth2/OIDC provider and application in Goauthentik via the API, using `AUTHENTIK_BOOTSTRAP_TOKEN` — no browser login needed.
6. Writes the generated `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` back to `.env`.
7. Installs and configures Nextcloud's `user_oidc` app via `occ`, enables SSO-only login, and exports the Caddy certificate.

**Windows / WSL 2 extra step:** After the script finishes step 1, it will print a warning if it detects WSL. You need to also add the hosts entry to Windows (the script cannot do this because it runs inside Linux). Open **PowerShell as Administrator** and run once:

```powershell
Add-Content -Path C:\Windows\System32\drivers\etc\hosts -Value '127.0.0.1 authentik-server'
```

Then restart your browser. Without this, the browser cannot resolve `http://authentik-server:9000` and the Goauthentik login redirect will fail.

### Step 3 — Trust the certificate

The same certificate trust step as the base stack applies here. Run the appropriate command for your OS from the repo root (see [Step 3 in Quick start](#step-3--trust-the-https-certificate)).

### Step 4 — Open the application

| Service | URL |
|---|---|
| Draw.io | [https://localhost:5443](https://localhost:5443) |
| Nextcloud | [https://localhost](https://localhost) — login via **Login with Goauthentik** |
| Goauthentik admin UI | [http://authentik-server:9000/if/admin/](http://authentik-server:9000/if/admin/) |

Log in to Nextcloud using your Goauthentik credentials. The initial admin account in the local Goauthentik instance has username `akadmin` and the password you set as `AUTHENTIK_BOOTSTRAP_PASSWORD`.

> **Direct admin access:** `start-auth.sh` disables Nextcloud's built-in password login so all users go through Goauthentik. If you need direct admin access (e.g. to recover a locked-out account), temporarily re-enable it: `docker exec --user www-data nextcloud-main php occ config:app:set user_oidc allow_multiple_user_backends --value=1`

### Re-running the script

`start-auth.sh` is idempotent — re-running it is safe. If the OAuth2 provider already exists in Goauthentik, the script fetches the existing credentials instead of creating new ones. The only step that cannot be re-run is the first-boot bootstrap (changing `AUTHENTIK_BOOTSTRAP_PASSWORD` or `AUTHENTIK_BOOTSTRAP_TOKEN` in `.env` after first boot has no effect — reset them via the Goauthentik admin UI instead).

### Resetting the auth stack

```bash
docker compose -f docker-compose.yml -f docker-compose.auth.yml down -v
```

This stops all containers and deletes all volumes, including the Goauthentik database and the Nextcloud database. Re-running `bash start-auth.sh` afterwards starts from scratch.

---

## Single-container deployment

The `docker/` directory contains everything needed to build a single distributable image. This is what the client uses — they don't interact with the codebase or run any scripts.

### Build the image

```bash
# Run from the repo root (the . at the end means "use this directory as the build context")
docker build -f docker/Dockerfile -t dpd-app:latest .
```

### Push to GitHub Container Registry (GHCR)

The `.github/workflows/publish.yml` workflow builds and pushes the image automatically — you do not run these commands manually in normal development. The workflow triggers on:

- Every push to `main` → publishes `ghcr.io/<org>/<repo>:latest` and a short SHA tag (e.g. `:sha-a1b2c3d`)
- Every version tag (e.g. `v1.2.3`) → publishes `:1.2.3`, `:1.2`, and `:latest`

No extra secrets are needed. The workflow uses the automatic `GITHUB_TOKEN`.

**One-time setup — link the package to the repository:**

After the first workflow run, the package appears under the repository's **Packages** tab (right sidebar on GitHub). If it isn't automatically linked to the repo, go to the package page → **Package settings** → **Connect a repository** and select this repo. This allows repo collaborators to pull the image using their own GitHub credentials.

**Client authentication — pulling a private package:**

Since the client has access to the repository, they can authenticate to GHCR using a Personal Access Token (PAT). They create one at GitHub → **Settings → Developer settings → Personal access tokens → Tokens (classic)**, with the `read:packages` scope selected. They then log in once on their server:

```bash
docker login ghcr.io -u <their-github-username> -p <their-PAT>
```

After that, `docker pull` and `docker run` work without any further authentication steps.

**To trigger a versioned release manually:**

```bash
git tag v1.0.0
git push origin v1.0.0
```

This pushes a tag, which triggers the publish workflow and produces the `:1.0.0`, `:1.0`, and `:latest` tags in GHCR.

### Client deployment

#### Step 1 — Create a Personal Access Token (PAT)

The image is hosted in a private registry. The client needs a GitHub PAT to pull it. They only need to do this once.

1. Log in to GitHub and go to **Settings → Developer settings → Personal access tokens → Tokens (classic)**
2. Click **Generate new token (classic)**
3. Give it a name (e.g. `dpd-docker-pull`), set an expiry, and tick **`read:packages`** — nothing else is needed
4. Click **Generate token** and copy it immediately (GitHub only shows it once)

#### Step 2 — Log in to the registry

Run this once on the server. Enter the PAT when prompted:

```bash
echo <PAT> | docker login ghcr.io -u <github-username> --password-stdin
```

#### Step 3 — Pull the image

```bash
docker pull ghcr.io/giphouse/dpd-drawing-tool:latest
```

#### Step 4 — Run the container

```bash
docker run -d \
  -p 443:443 \
  -p 5443:5443 \
  -v dpd_data:/data \
  -e MYSQL_PASSWORD=your_db_password \
  -e NEXTCLOUD_ADMIN_PASSWORD=your_admin_password \
  ghcr.io/giphouse/dpd-drawing-tool:latest
```

> **Apple Silicon Mac (M1/M2/M3)?** Add `--platform linux/amd64` to both the `pull` and `run` commands. The image is built for `linux/amd64` — Docker on Apple Silicon will run it automatically under Rosetta emulation.

**What these flags mean:**
- `-d` — run in the background (detached)
- `-p 443:443` — map port 443 on the host to port 443 inside the container
- `-v dpd_data:/data` — attach a Docker volume called `dpd_data` to `/data` inside the container. This is how data (database files, uploaded diagrams) persists when the container is stopped or restarted. Without this, all data would be lost every time the container stops.
- `-e` — set an environment variable inside the container

#### Step 5 — Wait for first boot and open the application

On **first boot**, the container automatically initialises the database, installs Nextcloud, and configures all settings before starting the application. This takes around 1–2 minutes. Subsequent starts skip this and go straight to running.

You can watch progress with:

```bash
docker logs -f <container_id>
```

Wait until you see `=== Initialisation complete ===` in the output, then open:

| Service | URL |
|---|---|
| Draw.io | https://localhost:5443 |
| Nextcloud | https://localhost |

Log in to Nextcloud with username `admin` (or whatever you set as `NEXTCLOUD_ADMIN_USER`) and the `NEXTCLOUD_ADMIN_PASSWORD` you passed to `docker run`.

#### Step 6 — The "Not Secure" warning

The browser will show a **"Not Secure"** warning and the connection will be flagged as `ERR_CERT_AUTHORITY_INVALID`. This is expected for testing deployments. The container uses a **self-signed certificate** generated by Caddy — your browser doesn't trust it because it wasn't issued by a recognised certificate authority (like Let's Encrypt).

You can safely click through the warning to access the application for testing purposes:
- **Chrome / Edge:** click **Advanced** → **Proceed to localhost (unsafe)**
- **Firefox:** click **Advanced** → **Accept the Risk and Continue**
- **Safari:** click **Show Details** → **visit this website**

For production deployments where the application is served on a real domain, this warning disappears entirely — see [Production TLS](#production-tls-real-https-certificate) below.

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

The container does **not** run Goauthentik. It connects to the client's **existing** Goauthentik instance via OpenID Connect (OIDC). When the three `OIDC_*` environment variables are set, the container automatically installs and configures Nextcloud's `user_oidc` app on first boot, allowing users to log in with their Goauthentik credentials.

> **Note:** The OIDC integration is currently a stub — the wiring is in place but it has not yet been tested against the client's Goauthentik instance. The engineers implementing the full integration should refer to the comments in `docker/entrypoint.sh`.

#### Step 1 — Create an OAuth2/OpenID provider in Goauthentik

In the Goauthentik admin interface:

1. Go to **Admin → Providers → Create**
2. Select **OAuth2/OpenID Provider**
3. Fill in the settings:
   - **Name:** choose something descriptive, e.g. `Nextcloud DPD`
   - **Authorization flow:** select your standard authorisation flow (e.g. `default-provider-authorization-explicit-consent`)
   - **Redirect URIs:** `https://<APP_DOMAIN>/apps/user_oidc/code` — replace `<APP_DOMAIN>` with the hostname the container will be served from
   - Leave other settings at their defaults unless your Goauthentik setup requires otherwise
4. Save the provider and note down the **Client ID** and **Client Secret** from the provider's overview page

#### Step 2 — Create an application in Goauthentik

1. Go to **Admin → Applications → Create**
2. Fill in the settings:
   - **Name:** e.g. `DPD Drawing Tool`
   - **Slug:** e.g. `dpd-drawing-tool`
   - **Provider:** select the provider you created in Step 1
3. Save the application

#### Step 3 — Get the discovery URL

On the provider's overview page in Goauthentik, find the **OpenID Configuration URL**. It will look like:

```
https://<goauthentik-domain>/application/o/<application-slug>/.well-known/openid-configuration
```

This is the value to pass as `OIDC_PROVIDER_URL`.

#### Step 4 — Run the container with OIDC variables

Pass all three OIDC variables to `docker run`:

```bash
docker run -d \
  -p 443:443 \
  -p 5443:5443 \
  -v dpd_data:/data \
  -e MYSQL_PASSWORD=your_db_password \
  -e NEXTCLOUD_ADMIN_PASSWORD=your_admin_password \
  -e APP_DOMAIN=dpd.example.com \
  -e OIDC_PROVIDER_URL=https://<goauthentik-domain>/application/o/<application-slug>/.well-known/openid-configuration \
  -e OIDC_CLIENT_ID=<client-id-from-goauthentik> \
  -e OIDC_CLIENT_SECRET=<client-secret-from-goauthentik> \
  ghcr.io/giphouse/dpd-drawing-tool:latest
```

On first boot, the container will install and configure the `user_oidc` Nextcloud app automatically. Users will then be able to log in via the **Login with Goauthentik** button on the Nextcloud login page.

> **Important:** OIDC is configured only on first boot. If you need to change the OIDC settings after the container has already initialised, exec into the container and run the relevant `occ user_oidc:provider` commands manually, or wipe the volume and start fresh.

### Production TLS (real HTTPS certificate)

For a production deployment on a real domain the "Not Secure" warning disappears entirely. Caddy obtains a trusted certificate from Let's Encrypt automatically — no manual certificate management is needed.

**What the SE team must do before shipping the production image:**

1. Remove the `local_certs` line from `docker/Caddyfile`. This line tells Caddy to generate a self-signed certificate, which is only appropriate for local testing.
2. Rebuild and push the image via the publish workflow.

**What the client does when running the container:**

Pass the real domain via the `APP_DOMAIN` environment variable:

```bash
docker run -d \
  -p 443:443 \
  -p 5443:5443 \
  -v dpd_data:/data \
  -e MYSQL_PASSWORD=your_db_password \
  -e NEXTCLOUD_ADMIN_PASSWORD=your_admin_password \
  -e APP_DOMAIN=dpd.example.com \
  ghcr.io/giphouse/dpd-drawing-tool:latest
```

Caddy will automatically contact Let's Encrypt on first boot to obtain a certificate for `dpd.example.com`. The server must be publicly reachable on port 443 for this to succeed (Let's Encrypt needs to verify domain ownership).

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

### Single-container image shows "Not Secure" in the browser

This is expected for testing deployments — see [Step 6](#step-6--the-not-secure-warning) in the client deployment guide. Click through the warning to proceed.

If you are on a real domain and still seeing this warning, check that `local_certs` has been removed from `docker/Caddyfile` in the image you are running, and that port 443 is publicly reachable so Let's Encrypt can issue a certificate.

### Single-container image: application not loading after first boot

If the browser shows a connection error immediately after starting the container, the services may still be initialising. First boot takes 1–2 minutes. Run `docker logs -f <container_id>` and wait for `=== Initialisation complete ===` before trying the URLs.

### Reset the single-container deployment

```bash
docker stop <container_id>
docker volume rm dpd_data     # permanently deletes all stored data
docker run -d -p 443:443 -p 5443:5443 -v dpd_data:/data -e MYSQL_PASSWORD=... -e NEXTCLOUD_ADMIN_PASSWORD=... dpd-app:latest
```
