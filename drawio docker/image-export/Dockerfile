FROM node:lts-slim

LABEL maintainer="JGraph Ltd"

# We don't need the standalone Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD true

# From https://github.com/puppeteer/puppeteer/blob/main/docker/Dockerfile
# Install latest chrome dev package and fonts to support major charsets (Chinese, Japanese, Arabic, Hebrew, Thai and a few others)
# Note: this installs the necessary libs to make the bundled version of Chrome that Puppeteer
# installs, work.
RUN apt-get update \
    && apt-get install -y wget gnupg git curl \
    && wget -q -O - https://dl-ssl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/googlechrome-linux-keyring.gpg \
    && sh -c 'echo "deb [arch=amd64 signed-by=/usr/share/keyrings/googlechrome-linux-keyring.gpg] http://dl.google.com/linux/chrome/deb/ stable main" >> /etc/apt/sources.list.d/google.list' \
    && apt-get update \
    && apt-get install -y google-chrome-stable fonts-ipafont-gothic fonts-wqy-zenhei fonts-thai-tlwg fonts-khmeros fonts-kacst fonts-freefont-ttf libxss1 dbus dbus-x11 \
        --no-install-recommends \
    && service dbus start \
    && wget http://ftp.de.debian.org/debian/pool/contrib/m/msttcorefonts/ttf-mscorefonts-installer_3.8_all.deb \
    && apt install -y --no-install-recommends \
        ./ttf-mscorefonts-installer_3.8_all.deb \
    && apt install -y --no-install-recommends minizip \
    && groupadd -r pptruser && useradd -rm -g pptruser -G audio,video pptruser \
    && cd /home/pptruser \
    && git clone https://github.com/jgraph/draw-image-export2.git \
    && chown -R pptruser:pptruser /home/pptruser \
    && apt-get remove -y --purge git wget \
    && rm -rf /var/lib/apt/lists/*

USER pptruser

ENV DBUS_SESSION_BUS_ADDRESS autolaunch:

WORKDIR /home/pptruser/draw-image-export2

RUN npm install

EXPOSE 8000

CMD ["npm", "start"]