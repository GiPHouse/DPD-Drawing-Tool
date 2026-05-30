#!/bin/bash

# +--------------------------------------------------------+
# | This file contains modified code by SE team,          |
# | refer to keywords: 'NOLAI'                            |
# |                                                        |
# +--------------------------------------------------------+

# ====== NOLAI - Infrastructure / Sprint 4 / Task #188 ======
#
# Starts the base dev stack (draw.io + Nextcloud + Caddy + MariaDB) and
# configures Nextcloud to authenticate via the CLIENT'S existing Goauthentik
# server. No local Goauthentik containers are started.
#
# Use this script when you have credentials from the client's Goauthentik
# admin. Use start-auth.sh instead if you want a fully local dev auth stack.
#
# WHAT THIS SCRIPT DOES:
#   1. Validates that OIDC_PROVIDER_URL, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET
#      are filled in .env.
#   2. Builds and starts the base stack (docker-compose.yml only).
#   3. Waits for Nextcloud to become healthy.
#   4. Configures Nextcloud's user_oidc plugin against the client's server.
#   5. Exports the Caddy root certificate (caddy-root.crt).
#
# PREREQUISITES:
#   - Docker 24+ with Compose plugin
#   - .env filled in (cp .env.example .env)
#   - The following obtained from the client's Goauthentik admin:
#       OIDC_PROVIDER_URL   — discovery URL of their Goauthentik instance
#       OIDC_CLIENT_ID      — client ID for the registered OAuth2 provider
#       OIDC_CLIENT_SECRET  — client secret for the registered OAuth2 provider
#
# ====== end of changes by SE ======

set -e

COMPOSE_BASE="docker-compose.yml"

# Detect docker compose command (plugin vs legacy binary)
if docker compose version >/dev/null 2>&1; then
    DC="docker compose -f ${COMPOSE_BASE}"
else
    DC="docker-compose -f ${COMPOSE_BASE}"
fi

# -----------------------------------------------------------------------
# 1. Validate .env and required OIDC variables
# -----------------------------------------------------------------------
echo "[1/5] Checking .env for required OIDC variables..."

if [ ! -f ".env" ]; then
    echo "ERROR: .env not found. Run:  cp .env.example .env  then fill in values."
    exit 1
fi

set -a
# shellcheck disable=SC1091
source .env
set +a

missing=0
for var in OIDC_PROVIDER_URL OIDC_CLIENT_ID OIDC_CLIENT_SECRET; do
    if [ -z "${!var}" ]; then
        echo "  ERROR: ${var} is not set in .env"
        missing=1
    fi
done

if [ "$missing" -eq 1 ]; then
    echo ""
    echo "  Obtain these values from the client's Goauthentik admin and add them to .env."
    echo "  See .env.example for the expected format."
    exit 1
fi

echo "  All required OIDC variables are present."

# -----------------------------------------------------------------------
# 2. Build and start the base stack
# -----------------------------------------------------------------------
echo "[2/5] Building and starting the base stack..."
$DC up -d --build

# -----------------------------------------------------------------------
# 3. Wait for Nextcloud to become healthy
# -----------------------------------------------------------------------
echo "[3/5] Waiting for Nextcloud to become ready..."

wait_healthy() {
    local service="$1"
    local max_wait="${2:-180}"
    local elapsed=0

    until [ "$($DC ps -q "$service" 2>/dev/null | xargs -r docker inspect --format='{{.State.Health.Status}}' 2>/dev/null)" = "healthy" ]; do
        if [ "$elapsed" -ge "$max_wait" ]; then
            echo ""
            echo "ERROR: ${service} did not become healthy within ${max_wait}s."
            echo "       Check logs: ${DC} logs ${service}"
            exit 1
        fi
        printf "\r  Waiting for %-20s (%ds elapsed)" "${service}..." "$elapsed"
        sleep 5
        elapsed=$((elapsed + 5))
    done
    echo ""
    echo "  ${service} is healthy."
}

wait_healthy nextcloud 180

# -----------------------------------------------------------------------
# 4. Configure Nextcloud's user_oidc plugin against the client's server
# -----------------------------------------------------------------------
echo "[4/5] Configuring Nextcloud OIDC against the client's Goauthentik..."

OCC="docker exec --user www-data nextcloud-main php occ"

# Normalise the discovery URL — user_oidc 7.5+ requires the full
# /.well-known/openid-configuration path, not just the issuer base URL.
DISCOVERY_URI="${OIDC_PROVIDER_URL}"
if [[ "${DISCOVERY_URI}" != *".well-known/openid-configuration" ]]; then
    DISCOVERY_URI="${DISCOVERY_URI%/}/.well-known/openid-configuration"
fi

# Allow Nextcloud to make outbound HTTP requests to private/local addresses.
# Required if the client's Goauthentik is reachable only via VPN or a private
# IP range; harmless when it is on a public hostname.
$OCC config:system:set allow_local_remote_servers --value=true --type=boolean

# Allow Draw.io (origin https://localhost:5443) to make cross-origin WebDAV
# and OCS requests to Nextcloud (https://localhost).
$OCC config:system:set cors.allowed-domains 0 --value="https://localhost:5443"

# Install and enable the OIDC login app.
$OCC app:install user_oidc 2>/dev/null || true
$OCC app:enable  user_oidc

# Register the client's Goauthentik as the OIDC provider.
#
# WHY --unique-uid=1 and --mapping-uid=sub:
#   Required for Login Flow v2 (used by the Draw.io WebDAV integration).
#   user_oidc 7.5 has a bug where unique-uid=0 leaves the user field empty in
#   the Login Flow v2 session, causing "State token does not match" after the
#   OIDC redirect. The Goauthentik provider must be created with
#   sub_mode=user_username so 'sub' is the plain username, not a SHA-256 hash.
#
# WHY --mapping-display-name=sub:
#   Shows the Goauthentik username in the Nextcloud UI.
$OCC user_oidc:provider goauthentik \
    --clientid="${OIDC_CLIENT_ID}" \
    --clientsecret="${OIDC_CLIENT_SECRET}" \
    --discoveryuri="${DISCOVERY_URI}" \
    --unique-uid=1 \
    --mapping-uid=sub \
    --mapping-display-name=sub

# Require SSO for all logins. Comment this line out to allow direct admin
# access without SSO while testing or recovering a locked-out account.
$OCC config:app:set user_oidc allow_multiple_user_backends --value=0

echo "  user_oidc configured. Discovery URI: ${DISCOVERY_URI}"

# Enable the Draw.io Nextcloud integration app.
docker exec --user www-data nextcloud-main php occ app:enable drawio || \
    echo "  (drawio app already enabled or not available — skipping)"

# -----------------------------------------------------------------------
# 5. Export the Caddy root certificate
# -----------------------------------------------------------------------
echo "[5/5] Extracting Caddy root certificate to caddy-root.crt..."
CADDY_CONTAINER=$($DC ps -q caddy)
docker cp "${CADDY_CONTAINER}:/data/caddy/pki/authorities/local/root.crt" ./caddy-root.crt
echo "  Certificate saved to: $(pwd)/caddy-root.crt"

# -----------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------
echo ""
echo "======================================================="
echo " CLIENT AUTH STACK IS READY"
echo "======================================================="
echo " Nextcloud : https://localhost  (SSO via client's Goauthentik)"
echo " Draw.io   : https://localhost:5443"
echo "======================================================="
echo ""
echo " NEXT STEP — Trust the Caddy certificate:"
echo "   macOS: sudo security add-trusted-cert -d -r trustRoot \\"
echo "              -k /Library/Keychains/System.keychain caddy-root.crt"
echo "   Linux: sudo cp caddy-root.crt /usr/local/share/ca-certificates/ \\"
echo "              && sudo update-ca-certificates"
echo "   Windows (PowerShell as Admin):"
echo "     certutil -addstore -f 'Root' caddy-root.crt"
echo ""
echo " TEST LOGIN:"
echo "   1. Open https://localhost in your browser."
echo "   2. Click 'Login with Goauthentik' (or the SSO button)."
echo "   3. Sign in with the test account provided by the client."
echo "   4. Confirm you land on the Nextcloud file browser."
echo "   5. Open Draw.io at https://localhost:5443 and verify file save/load."
echo ""
