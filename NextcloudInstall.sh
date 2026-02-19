#!/bin/bash

echo "Creating folder structure..."
mkdir -p ~/my-nextcloud
cd my-nextcloud

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
    ports:
      - "443:443"
    volumes:
      - ./caddy_data:/data
    command: caddy reverse-proxy --from localhost --to nextcloud-main:80
EOF

echo "Starting docker containers..."
docker compose up -d

echo "Wait till everything is started (45 sec)..."
sleep 45

echo "Now go to https://localhost and do the setup"
echo "Run NextcloudHTTPS.sh script"