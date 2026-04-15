# +--------------------------------------------------------+
# | This file contains modified code by SE team,          |
# | refer to keywords: 'NOLAI'                            |
# |                                                        |
# +--------------------------------------------------------+

# ====== NOLAI - Infrastructure / Sprint 2 / Task: Single-Container Dockerfile ======
#
# Builds a single distributable Docker image containing all services.
# The client pulls this image from a registry and runs it with one command —
# no shell scripts, no docker compose, no additional files required.
#
# SERVICES INSIDE THE CONTAINER (managed by supervisord):
#   MariaDB  — Nextcloud's database (internal only)
#   Apache2  — PHP application server serving Nextcloud on internal port 8000
#   Tomcat 9 — Java application server serving Draw.io on internal port 8080
#   Caddy    — Reverse proxy: HTTPS on port 443 (Nextcloud) and 5443 (Draw.io)
#
# BUILD STAGES:
#   Stage 1 (drawio-build): Compiles Draw.io from source using Ant/Java 17.
#                           Identical to the existing drawio app/Dockerfile stage 1.
#   Stage 2 (app):          Ubuntu 22.04 base with all services installed.
#
# BUILD COMMAND (from repo root):
#   docker build -f docker/Dockerfile -t dpd-app:latest .
#
# RUN COMMAND:
#   docker run -d \
#     -p 443:443 -p 5443:5443 \
#     -v dpd_data:/data \
#     -e MYSQL_PASSWORD=secret \
#     -e NEXTCLOUD_ADMIN_PASSWORD=secret \
#     dpd-app:latest
#
# PERSISTENT DATA:
#   All state is stored under the /data volume:
#     /data/mysql     — MariaDB data files
#     /data/nextcloud — Nextcloud user files
#   Mounting a named volume at /data preserves data across container restarts.
#
# FIRST BOOT:
#   entrypoint.sh detects the absence of /data/.initialized, runs a full
#   MariaDB + Nextcloud setup, then touches that file. Subsequent starts
#   skip setup and go straight to supervisord.
#
# ====== end of changes by SE ======


# ==========================================================================
# Stage 1 — Build the Draw.io WAR file
#
# WHY a separate build stage: the Ant/Java build toolchain is only needed
# at build time. Keeping it in a separate stage means it is never included
# in the final image, keeping the image smaller and the attack surface smaller.
#
# This stage is identical in logic to the existing drawio app/Dockerfile
# stage 1. The COPY path references the repo root as the build context.
# ==========================================================================
FROM eclipse-temurin:17-jdk-jammy AS drawio-build

RUN apt-get update -y && apt-get install -y ant && apt-get clean

WORKDIR /app

# COPY uses JSON array syntax to handle the space in "drawio app/" directory name.
# The build context must be the repo root: docker build -f docker/Dockerfile .
COPY ["drawio app/", "/app/"]

WORKDIR /app/etc/build

# Compiles the full draw.io source into a single .war file at /app/build/draw.war.
RUN ant war


# ==========================================================================
# Stage 2 — Application container
#
# WHY Ubuntu 22.04: provides PHP 8.1, MariaDB, and Tomcat 9 from official
# apt repos without requiring external PPAs. PHP 8.1 meets Nextcloud 28's
# minimum PHP requirement.
# ==========================================================================
FROM ubuntu:22.04

LABEL maintainer="SE Team"
LABEL org.opencontainers.image.title="DPD Drawing Tool"
LABEL org.opencontainers.image.description="Single-container DPD Drawing Tool: Nextcloud + Draw.io + MariaDB + Caddy"

# Suppress interactive prompts during apt-get install.
ENV DEBIAN_FRONTEND=noninteractive

# Pin the Nextcloud version for reproducible builds.
# Update this value when upgrading Nextcloud.
ENV NEXTCLOUD_VERSION=28.0.3

# Tomcat version — must be 9.x to match the drawio app/Dockerfile runtime.
ENV TOMCAT_VERSION=9.0.87


# --------------------------------------------------------------------------
# Install all system packages in a single RUN layer.
#
# WHY one layer: each RUN creates a new image layer. Combining installs
# reduces the total number of layers and avoids caching an intermediate
# layer that still contains the apt package lists.
# --------------------------------------------------------------------------
RUN apt-get update && apt-get install -y \
    # supervisord — starts and monitors all other processes in the container
    supervisor \
    # MariaDB — Nextcloud's database server
    mariadb-server \
    # Apache2 + PHP 8.1 — serves Nextcloud on internal port 8000
    apache2 \
    libapache2-mod-php8.1 \
    php8.1 \
    # Nextcloud required PHP extensions
    php8.1-gd \
    php8.1-mysql \
    php8.1-curl \
    php8.1-xml \
    php8.1-zip \
    php8.1-mbstring \
    php8.1-intl \
    php8.1-bcmath \
    php8.1-gmp \
    php8.1-imagick \
    # Java 17 runtime — required by Tomcat to serve the Draw.io WAR
    openjdk-17-jre-headless \
    # Utilities used by entrypoint.sh and Caddy installation
    curl wget gnupg2 apt-transport-https sudo \
    && apt-get clean && rm -rf /var/lib/apt/lists/*


# --------------------------------------------------------------------------
# Install Caddy from its official apt repository.
#
# WHY official repo: Caddy is not in Ubuntu's default repos. The official
# Caddy repository provides the latest stable release with automatic TLS.
# --------------------------------------------------------------------------
RUN curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
      | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg \
    && curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
      > /etc/apt/sources.list.d/caddy-stable.list \
    && apt-get update && apt-get install -y caddy \
    && apt-get clean && rm -rf /var/lib/apt/lists/*


# --------------------------------------------------------------------------
# Install Tomcat 9 from the official Apache release.
#
# WHY not the Ubuntu package: the Ubuntu tomcat9 package is configured for
# systemd and sets up /etc/default/tomcat9, which makes it awkward to manage
# via supervisord. Using the binary tarball gives us a clean CATALINA_HOME
# at /opt/tomcat with no systemd assumptions.
#
# WHY archive.apache.org not downloads.apache.org: downloads.apache.org only
# keeps the latest release of each major version. Older pinned versions are
# rotated off. archive.apache.org keeps every release permanently, which is
# the correct source for any pinned version number.
# --------------------------------------------------------------------------
RUN mkdir -p /opt/tomcat \
    && curl -L "https://archive.apache.org/dist/tomcat/tomcat-9/v${TOMCAT_VERSION}/bin/apache-tomcat-${TOMCAT_VERSION}.tar.gz" \
      | tar xz -C /opt/tomcat --strip-components=1 \
    && chmod +x /opt/tomcat/bin/*.sh \
    # Remove default example webapps to reduce attack surface
    && rm -rf /opt/tomcat/webapps/*

# Create a symlink so supervisord.conf can reference JAVA_HOME at a fixed path
# regardless of the platform architecture (amd64 vs arm64).
RUN ln -s "$(dirname "$(dirname "$(readlink -f "$(which java)")")")" /opt/java


# --------------------------------------------------------------------------
# Download and install Nextcloud.
#
# WHY pinned version: 'latest' would re-download on every rebuild, breaking
# reproducibility. Pin to a specific minor version and update deliberately.
# --------------------------------------------------------------------------
RUN curl -L "https://download.nextcloud.com/server/releases/nextcloud-${NEXTCLOUD_VERSION}.tar.bz2" \
      -o /tmp/nextcloud.tar.bz2 \
    && tar -xjf /tmp/nextcloud.tar.bz2 -C /var/www/ \
    && chown -R www-data:www-data /var/www/nextcloud \
    && rm /tmp/nextcloud.tar.bz2


# --------------------------------------------------------------------------
# Copy the compiled Draw.io WAR from Stage 1 into Tomcat's webapps directory.
#
# Deploying as ROOT.war serves Draw.io at the context root (/), which matches
# how the existing drawio app/Dockerfile deploys it.
# --------------------------------------------------------------------------
COPY --from=drawio-build /app/build/draw.war /opt/tomcat/webapps/ROOT.war


# --------------------------------------------------------------------------
# Configure Apache for Nextcloud.
#
# Apache is configured to listen on port 8000 (not 80) so that Caddy can
# own port 80 and 443 without conflicts. Caddy reverse-proxies port 8000
# for Nextcloud traffic.
# --------------------------------------------------------------------------
COPY docker/apache-nextcloud.conf /etc/apache2/sites-available/nextcloud.conf

RUN a2enmod rewrite headers env dir mime php8.1 \
    && a2dissite 000-default \
    && a2ensite nextcloud \
    # Redirect Apache's default port from 80 to 8000
    && sed -i 's/^Listen 80$/Listen 8000/' /etc/apache2/ports.conf \
    # Increase PHP limits for Nextcloud file uploads and operations
    && echo "memory_limit = 512M"        >> /etc/php/8.1/apache2/php.ini \
    && echo "upload_max_filesize = 512M" >> /etc/php/8.1/apache2/php.ini \
    && echo "post_max_size = 512M"       >> /etc/php/8.1/apache2/php.ini \
    && echo "max_execution_time = 300"   >> /etc/php/8.1/apache2/php.ini \
    && echo "date.timezone = UTC"        >> /etc/php/8.1/apache2/php.ini


# --------------------------------------------------------------------------
# Configure MariaDB for Nextcloud.
#
# WHY READ-COMMITTED + ROW: same reason as in docker-compose.yml — Nextcloud
# requires these settings to avoid deadlocks and ensure correct behaviour.
# Placing them in a .cnf file is cleaner than passing command flags.
# --------------------------------------------------------------------------
COPY docker/mariadb-nextcloud.cnf /etc/mysql/conf.d/nextcloud.cnf


# --------------------------------------------------------------------------
# Copy all remaining configuration files.
# --------------------------------------------------------------------------
COPY docker/Caddyfile      /etc/caddy/Caddyfile
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

COPY docker/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh


# --------------------------------------------------------------------------
# Persistent data directory.
#
# /data is the single volume mount point. Subdirectories are created by
# entrypoint.sh on first boot once the volume is mounted:
#   /data/mysql     — MariaDB data files
#   /data/nextcloud — Nextcloud user files
# --------------------------------------------------------------------------
VOLUME ["/data"]

# Port 443  — Nextcloud (HTTPS, via Caddy)
# Port 5443 — Draw.io  (HTTPS, via Caddy)
# Port 80   — HTTP, Caddy redirects to 443
EXPOSE 80 443 5443

ENTRYPOINT ["/entrypoint.sh"]
