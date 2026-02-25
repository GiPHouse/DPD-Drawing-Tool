async function saveDrawIOToNextcloudXML(filename, xmlContent, nextcloudUrl, username, password, remotePath = '/') {
    const authHeader = `Basic ${btoa(`${username}:${password}`)}`;
    const parsedUrl = new URL(nextcloudUrl, window.location.origin);
    const davPathMatch = parsedUrl.pathname.match(/^(.*)\/remote\.php\/dav\/files\/([^/]+)\/?$/);
    const basePath = davPathMatch ? davPathMatch[1] : parsedUrl.pathname.replace(/\/$/, '');
    const usernameFromUrl = davPathMatch ? decodeURIComponent(davPathMatch[2]) : null;
    const effectiveUsername = username || usernameFromUrl;

    if (!effectiveUsername) {
        console.error('No Nextcloud username provided or found in URL');
        return false;
    }

    const baseUrl = `${parsedUrl.origin}${basePath}`;
    const normalizedRemotePath = (remotePath || '/').replace(/\\/g, '/');
    const segments = normalizedRemotePath.split('/').filter(function(segment) {
        return segment.length > 0;
    });
    const encodedPath = segments.map(function(segment) {
        return encodeURIComponent(segment);
    }).join('/');
    const encodedFilename = encodeURIComponent(filename);
    const encodedUsername = encodeURIComponent(effectiveUsername);
    const webdavUrl = `${baseUrl}/remote.php/dav/files/${encodedUsername}/${encodedPath}${encodedPath ? '/' : ''}${encodedFilename}`;

    let lockToken = null;
    let lockSupported = true;

    // Set to true when Nextcloud session cookies are required.
    // Leave false for Basic-auth-only flow to reduce CORS complexity.
    const useCookieSession = false;

    // Reusable options for all WebDAV calls
    const requestBase = {
        mode: 'cors',
        credentials: useCookieSession ? 'include' : 'omit',
    };

    const lockInfo = `<?xml version="1.0" encoding="utf-8"?>
<d:lockinfo xmlns:d="DAV:">
  <d:lockscope><d:exclusive/></d:lockscope>
  <d:locktype><d:write/></d:locktype>
  <d:owner><d:href>${effectiveUsername}</d:href></d:owner>
</d:lockinfo>`;

    try {
        // 1. LOCK request (optional fallback for servers that do not support locking)
        const lockResponse = await fetch(webdavUrl, {
            ...requestBase,
            method: 'LOCK',
            headers: {
                'Authorization': authHeader,
                'Content-Type': 'application/xml; charset=utf-8',
                'Depth': '0',
                'Timeout': 'Second-300',
            },
            body: lockInfo,
        });

        if (!lockResponse.ok) {
            if (lockResponse.status === 405 || lockResponse.status === 501) {
                lockSupported = false;
                console.warn(`LOCK not supported by server (${lockResponse.status}). Falling back to unlocked PUT.`);
            } else {
                console.error(`LOCK failed: ${lockResponse.status} ${lockResponse.statusText}`);
                return false;
            }
        } else {
            // Lock token extraction
            const lockTokenHeader = lockResponse.headers.get('Lock-Token');
            if (lockTokenHeader) {
                lockToken = lockTokenHeader.trim();
            } else {
                const lockBody = await lockResponse.text();
                const tokenMatch = lockBody.match(/opaquelocktoken:[^<\s]+/i);
                if (tokenMatch && tokenMatch[0]) {
                    lockToken = `<${tokenMatch[0]}>`;
                }
            }

            if (!lockToken) {
                console.error('No lock token acquired. Aborting PUT to prevent data loss.');
                return false;
            }
        }

        // 2. PUT request
        const putHeaders = {
            'Authorization': authHeader,
            'Content-Type': 'application/xml',
        };

        if (lockSupported && lockToken) {
            putHeaders['If'] = `(${lockToken})`;
        }

        const response = await fetch(webdavUrl, {
            ...requestBase,
            method: 'PUT',
            headers: putHeaders,
            body: xmlContent,
        });

        if (response.ok) {
            console.log(`Successfully saved ${filename} to Nextcloud`);
            return true;
        }

        console.error(`Error saving file: ${response.status} ${response.statusText}`);
        return false;
    } catch (error) {
        if (error && error.name === 'TypeError') {
            console.error('CORS/network error while saving to Nextcloud. If draw.io runs on a different origin than Nextcloud, allow CORS preflight and WebDAV headers on the server.');
        }
        console.error('WebDAV Save Error:', error);
        return false;
    } finally {
        // 3. UNLOCK request
        if (lockToken) {
            try {
                await fetch(webdavUrl, {
                    ...requestBase,
                    method: 'UNLOCK',
                    headers: {
                        'Authorization': authHeader,
                        'Lock-Token': lockToken,
                    },
                });
            } catch (unlockError) {
                console.error('Unlock failed:', unlockError);
            }
        }
    }
}