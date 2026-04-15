#!/bin/bash

# +--------------------------------------------------------+
# | This file contains modified code by SE team,          |
# | refer to keywords: 'NOLAI'                            |
# |                                                        |
# +--------------------------------------------------------+

# ====== NOLAI - Infrastructure / Sprint 3 / Task: Auth Stack Startup Script ======
#
# Starts the full development stack with goauthentik SSO, then bootstraps the
# OIDC application so Nextcloud authenticates against the local goauthentik.
#
# WHAT THIS SCRIPT DOES:
#   1. Adds '127.0.0.1 authentik-server' to /etc/hosts if not present.
#      This is required once per machine so the browser resolves
#      http://authentik-server:9000 the same way Docker containers do.
#   2. Validates required env vars are set in .env.
#   3. Builds and starts the full auth stack.
#   4. Waits for Nextcloud and goauthentik to become healthy.
#   5. Creates an OAuth2 provider + application in goauthentik via the API,
#      using the AUTHENTIK_BOOTSTRAP_TOKEN for authentication (no login needed).
#   6. Writes the generated client_id and client_secret back to .env.
#   7. Configures Nextcloud's user_oidc plugin via occ.
#   8. Runs the same post-start steps as start.sh (Draw.io app, Caddy cert).
#
# PREREQUISITES:
#   - Docker 24+ with Compose plugin
#   - jq  (apt install jq  /  brew install jq)
#   - sudo access for the one-time /etc/hosts entry
#   - .env filled in (cp .env.example .env)
#
# REQUIRED ENV VARS (beyond the base stack):
#   PG_PASS                      PostgreSQL password for goauthentik
#   AUTHENTIK_SECRET_KEY         Random 50+ char string (signs tokens/sessions)
#   AUTHENTIK_BOOTSTRAP_PASSWORD goauthentik admin password (first boot only)
#   AUTHENTIK_BOOTSTRAP_TOKEN    Static API token; used by this script to
#                                create the OAuth2 provider automatically
#
# ====== end of changes by SE ======

set -e

COMPOSE_BASE="docker-compose.yml"
COMPOSE_AUTH="docker-compose.auth.yml"
HOSTS_ENTRY="127.0.0.1 authentik-server"

# Detect docker compose command (plugin vs legacy binary) — mirrors start.sh
if docker compose version >/dev/null 2>&1; then
    DC="docker compose -f ${COMPOSE_BASE} -f ${COMPOSE_AUTH}"
else
    DC="docker-compose -f ${COMPOSE_BASE} -f ${COMPOSE_AUTH}"
fi

# -----------------------------------------------------------------------
# 0. Check dependencies
# -----------------------------------------------------------------------
for cmd in docker jq curl; do
    if ! command -v "$cmd" &>/dev/null; then
        echo "ERROR: '$cmd' is required but not installed."
        [ "$cmd" = "jq" ] && echo "       Install: apt install jq  OR  brew install jq"
        exit 1
    fi
done

# -----------------------------------------------------------------------
# 1. Add 'authentik-server' to /etc/hosts (one-time per machine)
#
# WHY: Both Nextcloud's PHP (inside Docker) and the developer's browser
# must resolve 'authentik-server' to reach goauthentik. Docker Compose DNS
# handles the in-container side automatically. For the browser, we add a
# hosts file entry so http://authentik-server:9000 works on the host too.
# -----------------------------------------------------------------------
echo "[1/7] Checking /etc/hosts for 'authentik-server' entry..."

if grep -q "authentik-server" /etc/hosts 2>/dev/null; then
    echo "      Entry already present — skipping."
else
    echo "      Adding '${HOSTS_ENTRY}' to /etc/hosts (requires sudo)..."
    echo "${HOSTS_ENTRY}" | sudo tee -a /etc/hosts > /dev/null
    echo "      Done."
fi

# -----------------------------------------------------------------------
# 2. Validate .env and required variables
# -----------------------------------------------------------------------
if [ ! -f ".env" ]; then
    echo "ERROR: .env not found. Run:  cp .env.example .env  then fill in values."
    exit 1
fi

# Load .env into the current shell so we can reference the values below.
# set -a exports every variable; set +a stops that after the source.
set -a
# shellcheck disable=SC1091
source .env
set +a

# Fail early with clear messages rather than cryptic API errors later.
: "${PG_PASS:?ERROR: PG_PASS must be set in .env}"
: "${AUTHENTIK_SECRET_KEY:?ERROR: AUTHENTIK_SECRET_KEY must be set in .env (min 50 chars)}"
: "${AUTHENTIK_BOOTSTRAP_PASSWORD:?ERROR: AUTHENTIK_BOOTSTRAP_PASSWORD must be set in .env}"
: "${AUTHENTIK_BOOTSTRAP_TOKEN:?ERROR: AUTHENTIK_BOOTSTRAP_TOKEN must be set in .env}"

# -----------------------------------------------------------------------
# 3. Build and start the auth stack
# -----------------------------------------------------------------------
echo "[2/7] Building and starting the auth stack..."
$DC up -d --build

# -----------------------------------------------------------------------
# 4. Wait for services to become healthy
# -----------------------------------------------------------------------
echo "[3/7] Waiting for services to become ready..."

wait_healthy() {
    local service="$1"
    local max_wait="${2:-180}"
    local elapsed=0

    until [ "$($DC ps -q "$service" 2>/dev/null | xargs -r docker inspect --format='{{.State.Health.Status}}' 2>/dev/null)" = "healthy" ]; do
        if [ "$elapsed" -ge "$max_wait" ]; then
            echo ""
            echo "ERROR: ${service} did not become healthy within ${max_wait}s."
            echo "       Check logs: docker compose -f ${COMPOSE_BASE} -f ${COMPOSE_AUTH} logs ${service}"
            exit 1
        fi
        printf "\r  Waiting for %-20s (%ds elapsed)" "${service}..." "$elapsed"
        sleep 5
        elapsed=$((elapsed + 5))
    done
    echo ""
    echo "  ${service} is healthy."
}

# Nextcloud is typically ready first; goauthentik takes longer on first start
# because it runs database migrations before accepting requests.
wait_healthy nextcloud       120
wait_healthy authentik-server 480   # first boot runs all Django migrations — allow 8 min

# -----------------------------------------------------------------------
# 5. Bootstrap the goauthentik OAuth2 provider and application via API
#
# We use the AUTHENTIK_BOOTSTRAP_TOKEN (a static token created on first
# goauthentik start) so no browser login is required. The steps are:
#   a) Fetch the PK of the default authorization flow (ships with goauthentik)
#   b) Create an OAuth2 provider linked to that flow
#   c) Create a goauthentik Application linked to the provider
#   d) Capture the generated client_id and client_secret
# -----------------------------------------------------------------------
echo "[4/7] Bootstrapping goauthentik OAuth2 provider..."

# The script runs on the host machine. goauthentik is reachable at
# localhost:9000 via the port mapping in docker-compose.auth.yml.
API="http://localhost:9000/api/v3"
AUTH="-H \"Authorization: Bearer ${AUTHENTIK_BOOTSTRAP_TOKEN}\""

# Helper: make an authenticated GET request
ak_get() {
    curl -sf \
        -H "Authorization: Bearer ${AUTHENTIK_BOOTSTRAP_TOKEN}" \
        "${API}${1}"
}

# Helper: make an authenticated POST request with a JSON body
ak_post() {
    curl -sf \
        -H "Authorization: Bearer ${AUTHENTIK_BOOTSTRAP_TOKEN}" \
        -H "Content-Type: application/json" \
        -d "$2" \
        "${API}${1}"
}

# -- 5a. Fetch the default authorization and invalidation flow PKs --
# goauthentik ships with default flows. We use the implicit-consent auth flow
# (no separate consent screen — appropriate for an internal tool) and the
# default invalidation flow (became a required field in goauthentik 2026.x).
FLOW_PK=$(ak_get "/flows/instances/?slug=default-provider-authorization-implicit-consent" \
    | jq -r '.results[0].pk // empty')

if [ -z "$FLOW_PK" ]; then
    echo ""
    echo "ERROR: Could not find the default authorization flow in goauthentik."
    echo "       goauthentik may not have finished its first-boot migration."
    echo "       Wait 30 seconds and re-run this script."
    exit 1
fi

INVALIDATION_FLOW_PK=$(ak_get "/flows/instances/?designation=invalidation" \
    | jq -r '.results[0].pk // empty')

if [ -z "$INVALIDATION_FLOW_PK" ]; then
    echo ""
    echo "ERROR: Could not find the default invalidation flow in goauthentik."
    echo "       goauthentik may not have finished its first-boot migration."
    echo "       Wait 30 seconds and re-run this script."
    exit 1
fi

# Fetch the self-signed certificate keypair goauthentik generates on first boot.
# This is used to sign JWTs — without it, the JWT header has no 'kid' field and
# Nextcloud's user_oidc plugin rejects the token with "kid must be provided".
SIGNING_KEY_PK=$(ak_get "/crypto/certificatekeypairs/?has_key=true" \
    | jq -r '.results[0].pk // empty')

if [ -z "$SIGNING_KEY_PK" ]; then
    echo ""
    echo "ERROR: Could not find a signing certificate keypair in goauthentik."
    echo "       goauthentik may not have finished its first-boot migration."
    echo "       Wait 30 seconds and re-run this script."
    exit 1
fi

# -- 5b. Create the OAuth2 provider (skip if already exists) --
# The redirect URI must match the URL Nextcloud sends the browser to after
# the user logs in. Nextcloud's user_oidc app always uses /apps/user_oidc/code.
REDIRECT_URI="https://localhost/apps/user_oidc/code"

PROVIDER_JSON=$(ak_post "/providers/oauth2/" "$(cat <<EOF
{
  "name":                      "Nextcloud",
  "authorization_flow":        "${FLOW_PK}",
  "invalidation_flow":         "${INVALIDATION_FLOW_PK}",
  "signing_key":               "${SIGNING_KEY_PK}",
  "client_type":               "confidential",
  "redirect_uris":             [{"matching_mode": "strict", "url": "${REDIRECT_URI}"}],
  "sub_mode":                  "user_username",
  "include_claims_in_id_token": true
}
EOF
)" 2>/dev/null \
    || ak_get "/providers/oauth2/?name=Nextcloud" | jq -r '.results[0]')

PROVIDER_PK=$(echo "$PROVIDER_JSON"     | jq -r '.pk     // empty')
CLIENT_ID=$(echo "$PROVIDER_JSON"       | jq -r '.client_id     // empty')
CLIENT_SECRET=$(echo "$PROVIDER_JSON"   | jq -r '.client_secret // empty')

if [ -z "$PROVIDER_PK" ]; then
    echo ""
    echo "ERROR: Failed to create or retrieve the OAuth2 provider."
    echo "       Check goauthentik logs: $DC logs authentik-server"
    exit 1
fi
echo "  OAuth2 provider created (pk: ${PROVIDER_PK})"

# -- 5c. Create the goauthentik Application (skip if already exists) --
# The 'slug' becomes part of the OIDC discovery URL:
#   http://authentik-server:9000/application/o/<slug>/
# It must match the slug in OIDC_PROVIDER_URL in docker-compose.auth.yml.
ak_post "/core/applications/" "$(cat <<EOF
{
  "name":     "Nextcloud",
  "slug":     "nextcloud",
  "provider": ${PROVIDER_PK}
}
EOF
)" >/dev/null 2>&1 || true
# ↑ 'true' silences the error if the application already exists (duplicate slug).

echo "  goauthentik application 'nextcloud' created."

# -- 5d. Write credentials back to .env --
# start-auth.sh generated these automatically; store them so subsequent
# runs (and the Nextcloud occ step below) always use the same values.
update_env_var() {
    local key="$1"
    local value="$2"
    if grep -q "^${key}=" .env; then
        # Replace existing line (portable sed: create backup, works on Linux + macOS)
        sed -i.bak "s|^${key}=.*|${key}=${value}|" .env && rm -f .env.bak
    else
        echo "${key}=${value}" >> .env
    fi
}

update_env_var "OIDC_CLIENT_ID"     "${CLIENT_ID}"
update_env_var "OIDC_CLIENT_SECRET" "${CLIENT_SECRET}"

echo "  client_id written to .env:     ${CLIENT_ID}"
echo "  client_secret written to .env: (hidden)"

# -----------------------------------------------------------------------
# 6. Configure Nextcloud's user_oidc plugin
#
# All configuration is done via occ (Nextcloud's CLI) inside the running
# nextcloud-main container — no manual UI steps needed.
# -----------------------------------------------------------------------
echo "[5/7] Configuring Nextcloud user_oidc plugin..."

OCC="docker exec --user www-data nextcloud-main php occ"

# Allow Nextcloud to make outbound HTTP requests to local/private network
# addresses. Required because goauthentik runs on the same Docker network
# (172.x.x.x) and Nextcloud's SSRF protection blocks private IPs by default.
# This is intentional in the dev stack; do not set this in production where
# goauthentik is reachable via a public hostname instead.
$OCC config:system:set allow_local_remote_servers --value=true --type=boolean

# Install the OIDC login app if it is not already present, then enable it.
$OCC app:install user_oidc 2>/dev/null || true
$OCC app:enable  user_oidc

# Register the goauthentik provider.
#
# --unique-uid=1 + --mapping-uid=preferred_username:
#   Uses the goauthentik username as the Nextcloud account name.
#   Without these flags, Nextcloud derives the username from the 'sub' claim
#   (a random hash), which creates new accounts on every login.
#
# --discoveryuri:
#   Full URL to the OIDC discovery document (user_oidc 7.5+ requires the
#   complete /.well-known/openid-configuration path, not just the issuer base).
#   Nextcloud fetches this server-side via Docker DNS.
$OCC user_oidc:provider goauthentik \
    --clientid="${CLIENT_ID}" \
    --clientsecret="${CLIENT_SECRET}" \
    --discoveryuri="http://authentik-server:9000/application/o/nextcloud/.well-known/openid-configuration" \
    --unique-uid=1 \
    --mapping-uid=sub

# Disable Nextcloud's built-in password login so all users must go through
# goauthentik SSO. Comment this line out temporarily if you need direct
# admin access without SSO (e.g. to recover a locked-out account).
$OCC config:app:set user_oidc allow_multiple_user_backends --value=0

echo "  user_oidc configured."

# -----------------------------------------------------------------------
# 7. Post-start steps from start.sh (Draw.io app enable + cert export)
# -----------------------------------------------------------------------
echo "[6/7] Running standard post-start steps..."

docker exec --user www-data nextcloud-main php occ app:enable drawio || \
    echo "  (drawio app already enabled or not available — skipping)"

echo "Extracting Caddy root certificate to caddy-root.crt..."
CADDY_CONTAINER=$($DC ps -q caddy)
docker cp "${CADDY_CONTAINER}:/data/caddy/pki/authorities/local/root.crt" ./caddy-root.crt
echo "  Certificate saved to: $(pwd)/caddy-root.crt"

# -----------------------------------------------------------------------
# Done
# -----------------------------------------------------------------------
echo "[7/7] Complete."
echo ""
echo "======================================================="
echo " AUTH STACK IS READY"
echo "======================================================="
echo " Nextcloud    : https://localhost  (SSO via goauthentik)"
echo " Draw.io      : https://localhost:5443"
echo " goauthentik  : http://authentik-server:9000"
echo "======================================================="
echo ""
echo " goauthentik admin UI : http://authentik-server:9000/if/admin/"
echo " goauthentik admin user: akadmin"
echo ""
echo " NEXT STEP — Trust the Caddy certificate (same as start.sh):"
echo "   macOS: sudo security add-trusted-cert -d -r trustRoot \\"
echo "              -k /Library/Keychains/System.keychain caddy-root.crt"
echo "   Linux: sudo cp caddy-root.crt /usr/local/share/ca-certificates/ \\"
echo "              && sudo update-ca-certificates"
echo ""
