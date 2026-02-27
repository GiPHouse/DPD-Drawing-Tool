#!/bin/bash

# This combined setup script launches a secure Nextcloud instance behind
# Caddy, as well as a custom Draw.io build.  It also performs the
# auto-installation of Nextcloud and configures the Draw.io integration
# exactly as the `nextcloud-autodeploy-reducedUI` branch did, but with the
# HTTPS/Caddy configuration borrowed from the `nextcloud` branch.

set -e

echo "Cleaning up old containers and volumes..."
docker-compose down -v || true

# generate secure docker-compose and Caddy config
cat <<'EOF' > docker-compose.yml
version: '3.8'
services:
  db:
    image: mariadb:10.11
    restart: always
    command: --transaction-isolation=READ-COMMITTED --binlog-format=ROW
    volumes:
      - ./nextcloud_db:/var/lib/mysql
    environment:
      - MYSQL_ROOT_PASSWORD=strongpassword
      - MYSQL_PASSWORD=nextcloudpass
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud

  nextcloud-main:
    image: nextcloud:latest
    container_name: nextcloud-main
    restart: always
    volumes:
      - ./nextcloud_data:/var/www/html
    environment:
      - MYSQL_PASSWORD=nextcloudpass
      - MYSQL_DATABASE=nextcloud
      - MYSQL_USER=nextcloud
      - MYSQL_HOST=db
    depends_on:
      - db

  caddy-proxy:
    image: caddy:latest
    restart: always
    command: ["caddy", "run", "--config", "/etc/caddy/Caddyfile", "--adapter", "caddyfile"]
    ports:
      - "443:443"
      - "80:80"
    volumes:
      - ./caddy_data:/data
      - ./Caddyfile:/etc/caddy/Caddyfile:ro

  my-drawio:
    build: "./drawio app"
    container_name: drawio-app
    ports:
      - "5500:8080"
    # volumes:
    #   - "./drawio-app/src/main/webapp:/usr/local/tomcat/webapps/ROOT"

volumes:
  nextcloud_data:
EOF

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
docker-compose up -d --build

echo "Waiting for Nextcloud to initialize..."
# Increased sleep slightly to ensure the container is ready for installation
sleep 25

echo "Auto-installing Nextcloud (if needed)..."
docker exec --user www-data -w /var/www/html nextcloud-main bash -c '
  if php occ status >/dev/null 2>&1; then
    echo "Nextcloud already installed"
  else
    php occ maintenance:install \
      --database "mysql" \
      --database-name "nextcloud" \
      --database-user "nextcloud" \
      --database-pass "nextcloudpass" \
      --database-host "db" \
      --admin-user "admin" \
      --admin-pass "admin" || echo "install command failed, continuing"
  fi
'

echo "Enabling Draw.io App..."
docker exec --user www-data -w /var/www/html nextcloud-main php occ app:enable drawio

echo "Injecting Payload into DrawioConfig..."
# 1. Copy your already-formatted file into the container
docker cp payload.json nextcloud-main:/tmp/payload.json

# 2. Inject the URL using the CamelCase key we discovered earlier
docker exec --user www-data nextcloud-main php occ config:app:set drawio DrawioUrl --value="http://localhost:5500"

# 3. Inject the JSON using PHP to read the file directly. 
# This avoids all shell-related quote issues.
docker exec --user www-data nextcloud-main php -r '
    $json = file_get_contents("/tmp/payload.json");
    if ($json === false) { exit(1); }
    exec("php occ config:app:set drawio DrawioConfig --value=" . escapeshellarg($json));
'

echo "Refreshing App State..."
docker exec --user www-data -w /var/www/html nextcloud-main php occ app:disable drawio
docker exec --user www-data -w /var/www/html nextcloud-main php occ app:enable drawio

echo "---------------------------------------"
echo "DONE! Custom DPDS shapes are now active."
echo "URL: https://localhost"
echo "User: admin"
echo "Pass: admin"
echo "---------------------------------------"
