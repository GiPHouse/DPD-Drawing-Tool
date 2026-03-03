# 
#
#   +--------------------------------------------------------+
#   | This file contains modified code by SE team,           |
#   | refer to keywords: 'NOLAI'                             |
#   |                                                        |
#   +--------------------------------------------------------+
#


echo 
"Optimizing settings for HTTPS..."

CONTAINER_NAME="my-nextcloud-nextcloud-main-1"

docker exec --user www-data $CONTAINER_NAME php occ config:system:set trusted_domains 1 --value=localhost
# Tell Nextcloud to use HTTPS for all generated links
docker exec --user www-data $CONTAINER_NAME php occ config:system:set overwriteprotocol --value="https"
# Tell Nextcloud the proxy is running on localhost
docker exec --user www-data $CONTAINER_NAME php occ config:system:set overwritehost --value="localhost"
# Ensure Nextcloud trusts the proxy's headers
docker exec --user www-data $CONTAINER_NAME php occ config:system:set trusted_proxies 0 --value="127.0.0.1"

echo "Retrieving certificate for Windows..."
docker cp my-nextcloud-caddy-proxy-1:/data/caddy/pki/authorities/local/root.crt ./caddy-root.crt

echo ""
echo "======================================================="
echo "INSTALLATION COMPLETE!"
echo "======================================================="
echo "STEP 1: Install the Certificate in Windows"
echo "   - The Windows folder will now open automatically."
echo "   - Double-click on 'caddy-root.crt'."
echo "   - Click 'Install Certificate' -> 'Local Machine'."
echo "   - Select 'Place all certificates in the following store'."
echo "   - Click Browse and select: 'Trusted Root Certification Authorities'."
echo "   - Click OK -> Next -> Finish."
echo ""
echo "======================================================="