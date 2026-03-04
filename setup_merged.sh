#!/bin/bash

set -e

# Detect docker compose command
if docker compose version >/dev/null 2>&1; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

echo "Cleaning up old containers and volumes..."
$DOCKER_COMPOSE down -v || true
sudo rm -rf ./nextcloud_db ./caddy_data || true

# ---------------------------------------------------------
# Generate docker-compose.yml
# ---------------------------------------------------------

cat <<'EOF' > docker-compose.yml
version: '3.8'

services:
  db:
    image: mariadb:10.11
    restart: always
    command: --transaction-isolation=READ-COMMITTED --binlog-format=ROW
    volumes:
      - db_data:/var/lib/mysql
    environment:
      MYSQL_ROOT_PASSWORD: strongpassword
      MYSQL_PASSWORD: nextcloudpass
      MYSQL_DATABASE: nextcloud
      MYSQL_USER: nextcloud

  nextcloud-main:
    image: nextcloud:latest
    container_name: nextcloud-main
    restart: always
    volumes:
      - nextcloud_data:/var/www/html
    environment:
      MYSQL_PASSWORD: nextcloudpass
      MYSQL_DATABASE: nextcloud
      MYSQL_USER: nextcloud
      MYSQL_HOST: db
    depends_on:
      - db

  caddy-proxy:
    image: caddy:latest
    container_name: caddy-proxy
    restart: always
    command: ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - caddy_data:/data
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
    depends_on:
      - nextcloud-main

  my-drawio:
    build: "./drawio app"
    container_name: drawio-app
    ports:
      - "5500:8080"

volumes:
  nextcloud_data:
  db_data:
  caddy_data:
EOF

# ---------------------------------------------------------
# Generate Caddyfile
# ---------------------------------------------------------

cat <<'EOF' > Caddyfile
{
    local_certs
}

https://localhost {
    @davPreflight {
        method OPTIONS
        path_regexp dav ^/remote\.php/dav(?:/.*)?$
    }
    handle @davPreflight {
        @preflightLocalhost header Origin http://localhost:5500
        @preflightLoopback header Origin http://127.0.0.1:5500
        header @preflightLocalhost Access-Control-Allow-Origin "http://localhost:5500"
        header @preflightLoopback Access-Control-Allow-Origin "http://127.0.0.1:5500"
        header Access-Control-Allow-Credentials "true"
        header Access-Control-Allow-Methods "OPTIONS, GET, HEAD, PROPFIND, MKCOL, MOVE, COPY, LOCK, UNLOCK, PUT, DELETE"
        header Access-Control-Allow-Headers "Authorization, Content-Type, Depth, Timeout, If, Lock-Token, Destination, Overwrite, X-Requested-With, OCS-APIRequest"
        header Access-Control-Max-Age "86400"
        header Vary "Origin"
        respond "" 204
    }
    reverse_proxy nextcloud-main:80
    @originLocalhost header Origin http://localhost:5500
    @originLoopback header Origin http://127.0.0.1:5500
    header @originLocalhost Access-Control-Allow-Origin "http://localhost:5500"
    header @originLoopback Access-Control-Allow-Origin "http://127.0.0.1:5500"
    header Access-Control-Allow-Credentials "true"
    header Access-Control-Expose-Headers "DAV, ETag, Lock-Token"
    header Vary "Origin"
}
EOF

echo "Building and starting the containers..."
$DOCKER_COMPOSE up -d --build

echo "Waiting for containers to settle..."
sleep 45

# --- DYNAMIC NAME DETECTION ---
# This finds the actual name of the caddy container even if Docker prefixes it
ACTUAL_CADDY_NAME=$($DOCKER_COMPOSE ps -q caddy-proxy)
ACTUAL_NEXTCLOUD_NAME="nextcloud-main"

echo "Auto-installing Nextcloud..."
docker exec --user www-data -w /var/www/html $ACTUAL_NEXTCLOUD_NAME php occ maintenance:install \
  --database "mysql" \
  --database-name "nextcloud" \
  --database-user "nextcloud" \
  --database-pass "nextcloudpass" \
  --database-host "db" \
  --admin-user "admin" \
  --admin-pass "admin" || echo "Install already exists."

echo "Optimizing settings for HTTPS..."
docker exec --user www-data $ACTUAL_NEXTCLOUD_NAME php occ config:system:set trusted_domains 1 --value=localhost
docker exec --user www-data $ACTUAL_NEXTCLOUD_NAME php occ config:system:set overwriteprotocol --value="https"
docker exec --user www-data $ACTUAL_NEXTCLOUD_NAME php occ config:system:set overwritehost --value="localhost"
docker exec --user www-data $ACTUAL_NEXTCLOUD_NAME php occ config:system:set trusted_proxies 0 --value="127.0.0.1"

echo "Retrieving certificate for Windows..."
# Use the ID found by docker-compose to copy the file
docker cp $ACTUAL_CADDY_NAME:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt

echo "Configuring Draw.io integration..."
docker exec --user www-data $ACTUAL_NEXTCLOUD_NAME php occ app:enable drawio || true

echo "---------------------------------------"
echo "DONE!"
echo "Nextcloud: https://localhost"
echo "---------------------------------------"

echo "======================================================="
echo "INSTALLATION COMPLETE!"
echo "======================================================="
echo "STEP 1: Install the Certificate in Windows"
echo "   - Open this folder: $(pwd)"
echo "   - Double-click on 'caddy-root.crt'."
echo "   - Install into 'Trusted Root Certification Authorities'."
echo "======================================================="