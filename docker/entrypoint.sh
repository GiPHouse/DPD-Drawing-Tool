#!/bin/bash

# +--------------------------------------------------------+
# | This file contains modified code by SE team,           |
# | refer to keywords: 'NOLAI'                             |
# |                                                        |
# +--------------------------------------------------------+

# ====== NOLAI - Infrastructure / Sprint 2 / Task: Single-Container Entrypoint ======
#
# Container entrypoint script. This is the first thing that runs when the
# container starts (it is the ENTRYPOINT in docker/Dockerfile).
#
# FIRST BOOT vs SUBSEQUENT BOOTS:
#   The presence of /data/.initialized controls which path is taken.
#   - First boot:  the file does not exist → full setup runs → file is created.
#   - Later boots: the file exists → setup is skipped → supervisord starts directly.
#
#   This means you can stop and restart the container safely without re-running
#   the database initialisation or Nextcloud installer.
#
# WHAT FIRST-BOOT SETUP DOES:
#   1. Creates /data/mysql and /data/nextcloud directories on the mounted volume.
#   2. Initialises the MariaDB data directory.
#   3. Starts MariaDB temporarily to create the Nextcloud database and user.
#   4. Starts Apache temporarily to run Nextcloud's CLI installer (occ).
#   5. Configures Nextcloud system settings (trusted domain, HTTPS override, proxy).
#   6. Enables the Draw.io Nextcloud integration app.
#   7. Configures Goauthentik OIDC if OIDC_PROVIDER_URL is set (see below).
#   8. Stops the temporary processes, writes /data/.initialized.
#
# REQUIRED ENVIRONMENT VARIABLES:
#   MYSQL_PASSWORD             — MariaDB password for the Nextcloud user
#   NEXTCLOUD_ADMIN_PASSWORD   — Password for the Nextcloud admin account
#
# OPTIONAL ENVIRONMENT VARIABLES:
#   MYSQL_DATABASE             — Database name          (default: nextcloud)
#   MYSQL_USER                 — Database user          (default: nextcloud)
#   NEXTCLOUD_ADMIN_USER       — Admin account username (default: admin)
#   APP_DOMAIN                 — Public hostname        (default: localhost)
#
# GOAUTHENTIK OIDC (optional — leave unset to skip):
#   OIDC_PROVIDER_URL          — Discovery URL of the client's Goauthentik instance
#   OIDC_CLIENT_ID             — Client ID registered in Goauthentik
#   OIDC_CLIENT_SECRET         — Client secret registered in Goauthentik
#
#   The container does NOT run Goauthentik. It connects to the client's
#   existing Goauthentik server. Set these three variables to enable SSO.
#   If OIDC_PROVIDER_URL is not set, Nextcloud uses its built-in login.
#
# ====== end of changes by SE ======

set -e

INIT_MARKER="/data/.initialized"

# -----------------------------------------------------------------------
# FIRST BOOT: run full initialisation
# -----------------------------------------------------------------------
if [ ! -f "$INIT_MARKER" ]; then
    echo "=== First boot detected: running initialisation ==="

    # ---- Validate required environment variables ----
    # Fail early with a clear message rather than a cryptic database error later.
    : "${MYSQL_PASSWORD:?ERROR: MYSQL_PASSWORD environment variable is required}"
    : "${NEXTCLOUD_ADMIN_PASSWORD:?ERROR: NEXTCLOUD_ADMIN_PASSWORD environment variable is required}"

    # Apply defaults for optional variables
    MYSQL_DATABASE="${MYSQL_DATABASE:-nextcloud}"
    MYSQL_USER="${MYSQL_USER:-nextcloud}"
    NEXTCLOUD_ADMIN_USER="${NEXTCLOUD_ADMIN_USER:-admin}"
    APP_DOMAIN="${APP_DOMAIN:-localhost}"

    # ---- Create persistent data directories on the mounted volume ----
    echo "[1/7] Creating data directories..."
    mkdir -p /data/mysql /data/nextcloud
    chown -R mysql:mysql   /data/mysql
    chown -R www-data:www-data /data/nextcloud

    # ---- Initialise the MariaDB data directory ----
    # mariadb-install-db creates the system tables in /data/mysql.
    # --skip-test-db omits the test database that ships by default.
    echo "[2/7] Initialising MariaDB data directory..."
    mariadb-install-db --user=mysql --datadir=/data/mysql --skip-test-db

    # ---- Start MariaDB temporarily for database setup ----
    # --skip-networking: only allows local socket connections during setup so
    # the database is not reachable externally while we configure it.
    echo "[3/7] Starting MariaDB for initial configuration..."
    mysqld_safe --datadir=/data/mysql --user=mysql --skip-networking &
    MYSQL_PID=$!

    # Wait for MariaDB to accept connections
    until mysqladmin ping --silent 2>/dev/null; do
        echo "  Waiting for MariaDB..."
        sleep 1
    done

    # Create the Nextcloud database and user
    echo "  Creating database '${MYSQL_DATABASE}' and user '${MYSQL_USER}'..."
    mysql --user=root <<-SQL
        CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\`
            CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
        CREATE USER IF NOT EXISTS '${MYSQL_USER}'@'localhost'
            IDENTIFIED BY '${MYSQL_PASSWORD}';
        GRANT ALL PRIVILEGES ON \`${MYSQL_DATABASE}\`.* TO '${MYSQL_USER}'@'localhost';
        FLUSH PRIVILEGES;
SQL

    # ---- Start Apache temporarily for Nextcloud CLI install ----
    # The Nextcloud occ CLI requires a running web server to resolve some
    # internal paths during installation.
    echo "[4/7] Starting Apache for Nextcloud installation..."
    apache2ctl start

    # ---- Run the Nextcloud automated installer ----
    # occ maintenance:install performs the full installation:
    # creates config.php, sets up the database schema, and creates the admin user.
    echo "[5/7] Running Nextcloud installer..."
    sudo -u www-data php /var/www/nextcloud/occ maintenance:install \
        --database=mysql \
        --database-name="${MYSQL_DATABASE}" \
        --database-user="${MYSQL_USER}" \
        --database-pass="${MYSQL_PASSWORD}" \
        --database-host="localhost" \
        --admin-user="${NEXTCLOUD_ADMIN_USER}" \
        --admin-pass="${NEXTCLOUD_ADMIN_PASSWORD}" \
        --data-dir="/data/nextcloud"
        # WHY localhost not 127.0.0.1: MariaDB is started with --skip-networking
        # during init, which disables TCP entirely. MySQL clients treat 'localhost'
        # specially — they connect via Unix socket instead of TCP, which works
        # even with --skip-networking. Using '127.0.0.1' forces TCP and causes
        # "Connection refused" because TCP is disabled at this point.

    # ---- Configure Nextcloud system settings ----
    echo "[6/7] Configuring Nextcloud system settings..."

    # trusted_domains: the hostname(s) Nextcloud will accept requests for.
    # Requests from any other hostname will be rejected.
    sudo -u www-data php /var/www/nextcloud/occ config:system:set \
        trusted_domains 0 --value="${APP_DOMAIN}"

    # overwriteprotocol: forces Nextcloud to generate https:// URLs even though
    # it only sees plain HTTP from Apache (Caddy terminates TLS before it reaches Apache).
    sudo -u www-data php /var/www/nextcloud/occ config:system:set \
        overwriteprotocol --value="https"

    # overwritehost: sets the hostname used in generated URLs to match APP_DOMAIN.
    sudo -u www-data php /var/www/nextcloud/occ config:system:set \
        overwritehost --value="${APP_DOMAIN}"

    # trusted_proxies: 127.0.0.1 is the Caddy proxy address as seen from
    # Apache (both run in the same container).
    sudo -u www-data php /var/www/nextcloud/occ config:system:set \
        trusted_proxies 0 --value="127.0.0.1"

    # Enable the Draw.io integration app so diagrams can be saved to Nextcloud.
    sudo -u www-data php /var/www/nextcloud/occ app:enable drawio || true

    # ---- Goauthentik OIDC configuration ----
    # ====== NOLAI - Infrastructure / Sprint 4 / Task #188 ======
    #
    # Configures Nextcloud to authenticate against the client's existing
    # Goauthentik server via OpenID Connect. Only runs when OIDC_PROVIDER_URL
    # is set; leave it unset to fall back to built-in username/password login.
    #
    # OIDC_PROVIDER_URL may be either the base application URL
    # (https://auth.example.com/application/o/nextcloud/) or the full discovery
    # endpoint — the script normalises it either way.
    #
    # ====== end of changes by SE ======
    if [ -n "${OIDC_PROVIDER_URL}" ]; then
        echo "  Configuring Goauthentik OIDC integration..."

        : "${OIDC_CLIENT_ID:?ERROR: OIDC_CLIENT_ID is required when OIDC_PROVIDER_URL is set}"
        : "${OIDC_CLIENT_SECRET:?ERROR: OIDC_CLIENT_SECRET is required when OIDC_PROVIDER_URL is set}"

        # user_oidc 7.5+ requires the full /.well-known/openid-configuration path.
        # Accept both the base URL and the full path so .env is forgiving.
        DISCOVERY_URI="${OIDC_PROVIDER_URL}"
        if [[ "${DISCOVERY_URI}" != *".well-known/openid-configuration" ]]; then
            DISCOVERY_URI="${DISCOVERY_URI%/}/.well-known/openid-configuration"
        fi

        # Allow Nextcloud to reach the OIDC server even when it is on a private
        # network (VPN, internal Docker network during testing, etc.).
        sudo -u www-data php /var/www/nextcloud/occ \
            config:system:set allow_local_remote_servers --value=true --type=boolean

        # Allow Draw.io (origin https://<APP_DOMAIN>:5443) to make cross-origin
        # WebDAV and OCS requests to Nextcloud.
        sudo -u www-data php /var/www/nextcloud/occ \
            config:system:set cors.allowed-domains 0 --value="https://${APP_DOMAIN}:5443"

        # Install and enable the OIDC login app.
        sudo -u www-data php /var/www/nextcloud/occ app:install user_oidc 2>/dev/null || true
        sudo -u www-data php /var/www/nextcloud/occ app:enable  user_oidc

        # Register the Goauthentik provider.
        #
        # WHY --unique-uid=1 and --mapping-uid=sub:
        #   Required for Login Flow v2 (used by the Draw.io WebDAV integration).
        #   user_oidc 7.5 has a bug where unique-uid=0 leaves the user field
        #   empty in the Login Flow v2 session, causing "State token does not
        #   match" after the OIDC redirect. The Goauthentik provider must be
        #   created with sub_mode=user_username so 'sub' is the plain username
        #   rather than a per-app SHA-256 hash.
        #
        # WHY --mapping-display-name=sub:
        #   Shows the Goauthentik username in the Nextcloud UI rather than an
        #   opaque internal hash.
        sudo -u www-data php /var/www/nextcloud/occ user_oidc:provider goauthentik \
            --clientid="${OIDC_CLIENT_ID}" \
            --clientsecret="${OIDC_CLIENT_SECRET}" \
            --discoveryuri="${DISCOVERY_URI}" \
            --unique-uid=1 \
            --mapping-uid=sub \
            --mapping-display-name=sub

        # Require all users to log in via Goauthentik SSO.
        # Comment this line out temporarily to allow direct admin login for recovery.
        sudo -u www-data php /var/www/nextcloud/occ \
            config:app:set user_oidc allow_multiple_user_backends --value=0

        echo "  OIDC configured. Discovery URI: ${DISCOVERY_URI}"
    else
        echo "  OIDC_PROVIDER_URL not set — skipping Goauthentik configuration."
        echo "  Nextcloud will use built-in username/password login."
    fi

    # ---- Stop temporary services ----
    # supervisord will restart them cleanly as managed processes.
    echo "[7/7] Stopping temporary services..."
    apache2ctl stop
    # WHY mysqladmin shutdown not kill: sending SIGTERM to mysqld_safe does not
    # reliably stop mariadbd in time — mysqld_safe stays alive waiting for
    # mariadbd to exit, causing 'wait' to hang indefinitely. mysqladmin shutdown
    # tells MariaDB to stop gracefully via its own protocol; mysqld_safe detects
    # the exit and terminates, so 'wait' completes immediately after.
    mysqladmin -u root shutdown
    wait "${MYSQL_PID}" 2>/dev/null || true

    # Write the init marker so this block is skipped on all future starts
    touch "$INIT_MARKER"
    echo "=== Initialisation complete ==="
    echo ""
    echo "  Nextcloud : https://${APP_DOMAIN}"
    echo "  Draw.io   : https://${APP_DOMAIN}:5443"
    echo "  Admin     : ${NEXTCLOUD_ADMIN_USER}"
    echo ""
fi

# -----------------------------------------------------------------------
# HAND OFF TO SUPERVISORD
#
# exec replaces this shell process with supervisord, making supervisord PID 1.
# supervisord starts MariaDB, Apache, Tomcat, and Caddy in parallel and keeps
# them running for the lifetime of the container.
# -----------------------------------------------------------------------
echo "Starting all services via supervisord..."
exec /usr/bin/supervisord -c /etc/supervisor/supervisord.conf
