#!/bin/bash

DEVICE_IP=$(hostname -I 2>/dev/null | awk '{for (i = 1; i <= NF; i++) if ($i !~ /^127\./) { print $i; exit }}')

if [ -z "$DEVICE_IP" ]; then
  DEVICE_IP="localhost"
fi

echo "Creating folder structure..."
mkdir -p ~/my-nextcloud
cd ~/my-nextcloud

echo "Creating docker files..."
cat <<EOF > docker-compose.yml
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
EOF

cat <<EOF > Caddyfile
{
    local_certs
}

https://localhost, https://$DEVICE_IP {
    @davPreflight {
        method OPTIONS
    path_regexp dav ^/remote\.php/dav(?:/.*)?$
    }

    handle @davPreflight {
    @preflightLocalhost header Origin http://localhost:5500
    @preflightLoopback header Origin http://127.0.0.1:5500
  @preflightDevice header Origin http://$DEVICE_IP:5500
    header @preflightLocalhost Access-Control-Allow-Origin "http://localhost:5500"
    header @preflightLoopback Access-Control-Allow-Origin "http://127.0.0.1:5500"
  header @preflightDevice Access-Control-Allow-Origin "http://$DEVICE_IP:5500"
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
  @originDevice header Origin http://$DEVICE_IP:5500
    header @originLocalhost Access-Control-Allow-Origin "http://localhost:5500"
    header @originLoopback Access-Control-Allow-Origin "http://127.0.0.1:5500"
  header @originDevice Access-Control-Allow-Origin "http://$DEVICE_IP:5500"
    header Access-Control-Allow-Credentials "true"
    header Access-Control-Expose-Headers "DAV, ETag, Lock-Token"
    header Vary "Origin"
}
EOF

echo "Starting docker containers..."
docker compose up -d

echo "Wait till everything is started (45 sec)..."
sleep 45

echo "Now go to https://localhost or https://$DEVICE_IP and do the setup"
echo "Run NextcloudHTTPS.sh script"