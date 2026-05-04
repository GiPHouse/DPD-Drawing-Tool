#!/bin/bash

# +--------------------------------------------------------+
# | This file contains modified code by SE team,          |
# | refer to keywords: 'NOLAI'                            |
# |                                                        |
# +--------------------------------------------------------+

# ====== NOLAI - Infrastructure / Sprint 2 / Task: Dev Stack Startup Script ======
#
# Minimal helper script for the development Docker Compose stack.
# Replaces the old setup_merged.sh with a much simpler set of steps.
#
# WHAT THIS SCRIPT DOES:
#   1. Checks that a .env file exists (copy from .env.example if not).
#   2. Builds and starts all containers via docker compose.
#   3. Waits for Nextcloud to become healthy (via its healthcheck endpoint).
#   4. Enables the Draw.io Nextcloud integration app.
#   5. Extracts Caddy's self-signed root certificate to caddy-root.crt.
#
# WHAT HAS MOVED OUT OF THIS SCRIPT (compared to setup_merged.sh):
#   - docker-compose.yml generation: now a committed file in the repo root.
#   - Caddyfile generation: now a committed file in the repo root.
#   - occ maintenance:install: handled automatically by the Nextcloud official
#     image on first boot when NEXTCLOUD_ADMIN_USER / NEXTCLOUD_ADMIN_PASSWORD
#     environment variables are set.
#   - Trusted domain, HTTPS, and proxy occ commands: replaced by environment
#     variables in docker-compose.yml (OVERWRITEPROTOCOL, TRUSTED_PROXIES, etc).
#   - sleep loops: replaced by healthcheck polling with a timeout.
#
# USAGE:
#   bash start.sh
#
# PREREQUISITES:
#   - .env file exists (cp .env.example .env and fill in values)
#   - Docker 24+ and Docker Compose v2 installed
#
# ====== end of changes by SE ======

set -e

# Detect docker compose command (plugin vs legacy binary)
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# ---- Check .env exists ----
if [ ! -f ".env" ]; then
    echo "ERROR: .env file not found."
    echo "       Copy .env.example to .env and fill in your values:"
    echo "       cp .env.example .env"
    exit 1
fi

# ---- Build and start containers ----
echo "Building and starting containers..."
$DOCKER_COMPOSE up -d --build

# ---- Wait for Nextcloud to be healthy ----
# docker compose up returns as soon as containers start, not when they are ready.
# We poll the healthcheck status rather than using a fixed sleep.
echo "Waiting for Nextcloud to become healthy..."
MAX_WAIT=120  # seconds
ELAPSED=0
until [ "$($DOCKER_COMPOSE ps -q nextcloud | xargs docker inspect --format='{{.State.Health.Status}}')" = "healthy" ] 2>/dev/null; do
    if [ $ELAPSED -ge $MAX_WAIT ]; then
        echo "ERROR: Nextcloud did not become healthy within ${MAX_WAIT}s."
        echo "       Check logs: docker compose logs nextcloud"
        exit 1
    fi
    echo "  Still waiting... (${ELAPSED}s elapsed)"
    sleep 5
    ELAPSED=$((ELAPSED + 5))
done
echo "Nextcloud is healthy."

# ---- Enable the Draw.io integration app ----
# The Nextcloud image auto-installs Nextcloud on first boot but does not
# enable third-party apps. We enable the drawio app here after install.
echo "Enabling Draw.io integration app..."
docker exec --user www-data nextcloud-main php occ app:enable drawio || \
    echo "  (drawio app already enabled or not available — skipping)"

# ---- Extract the Caddy self-signed root certificate ----
# Caddy generates a local root CA on first run. Browsers and the Draw.io
# WebDAV client will reject HTTPS connections until this certificate is
# trusted on the client machine. See README.md for trust instructions.
echo "Extracting Caddy root certificate to caddy-root.crt..."
CADDY_CONTAINER=$($DOCKER_COMPOSE ps -q caddy)
docker cp "${CADDY_CONTAINER}:/data/caddy/pki/authorities/local/root.crt" ./caddy-root.crt
echo "  Certificate saved to: $(pwd)/caddy-root.crt"

# ---- Done ----
echo ""
echo "======================================================="
echo " STACK IS READY"
echo "======================================================="
echo " Nextcloud : https://localhost"
echo " Draw.io   : https://localhost:5443"
echo "======================================================="
echo ""
echo "NEXT STEP — Trust the certificate:"
echo "  Windows (PowerShell as Admin):"
echo "    certutil -addstore -f 'Root' caddy-root.crt"
echo "  macOS:"
echo "    sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain caddy-root.crt"
echo "  Linux:"
echo "    sudo cp caddy-root.crt /usr/local/share/ca-certificates/ && sudo update-ca-certificates"
