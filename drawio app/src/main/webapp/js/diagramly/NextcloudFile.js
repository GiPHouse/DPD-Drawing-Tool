/*

+--------------------------------------------------------+
| This file contains modified code by SE team,           |
| refer to keywords: 'NOLAI'                             |
|                                                        |
+--------------------------------------------------------+

*/

// ====== NOLAI - {- Backend -} /Sprint 3/ Task 151 ======
//
// In-memory credential cache for the current browser tab session.
//
// WHY a module-level variable rather than localStorage:
//   App passwords are sensitive credentials that must not be persisted to disk.
//   A plain JS variable lives only in memory and is cleared on page reload,
//   giving a reasonable session lifetime without any storage risk.
//   This cache allows both the Save and Load dialogs to restore the connection
//   status without requiring the user to re-authenticate on every dialog open.
//
// Structure: { username: string|null, password: string|null, baseUrl: string|null }
// ====== end of changes by SE ======
var _nextcloudSessionCache = { username: null, password: null, baseUrl: null };
// ====== NOLAI - {- Backend -} /Sprint 3/ Task 151 ======
//
// buildNextcloudWebdavBaseContext(nextcloudUrl, username, password, remotePath)
//
// Builds the shared request context used by all WebDAV functions: the auth
// header, fetch options, base URL, and encoded path/username values.
//
// Authentication strategy:
//   When an app password is provided, Basic Auth is used and the session cookie
//   is deliberately omitted (credentials:'omit'). Sending both the OIDC session
//   cookie AND an Authorization header causes Nextcloud to evaluate the cookie
//   first; the OIDC session lacks WebDAV write permissions, so the request is
//   rejected with 401 even though the app password is valid.
//   When no password is available, cookie-only mode is used (credentials:'include').
//
// Username resolution:
//   If the caller passes null for username, the uid is parsed from the WebDAV
//   URL path (/remote.php/dav/files/{uid}/). This keeps callers simple: they
//   only need to provide the pre-built URL with the uid embedded.
//
// Returns null if no username can be determined; otherwise returns an object
// with authHeader, requestBase, baseUrl, encodedUsername, encodedPath, etc.
// ====== end of changes by SE ======
function buildNextcloudWebdavBaseContext(nextcloudUrl, username, password, remotePath) {
    const parsedUrl = new URL(nextcloudUrl, window.location.origin);
    const davPathMatch = parsedUrl.pathname.match(/^(.*)\/remote\.php\/dav\/files\/([^/]+)\/?$/);
    const basePath = davPathMatch ? davPathMatch[1] : parsedUrl.pathname.replace(/\/$/, '');
    const usernameFromUrl = davPathMatch ? decodeURIComponent(davPathMatch[2]) : null;
    const effectiveUsername = username || usernameFromUrl;

    if (!effectiveUsername) {
        console.error('No Nextcloud username provided or found in URL');
        return null;
    }

    // Handle the URL encoding for the remote path and username for WebDAV communications.
    const baseUrl = `${parsedUrl.origin}${basePath}`;
    const normalizedRemotePath = (remotePath || '/').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
    const segments = normalizedRemotePath.split('/').filter(function(segment) {
        return segment.length > 0;
    });
    const encodedPath = segments.map(function(segment) {
        return encodeURIComponent(segment);
    }).join('/');
    const encodedUsername = encodeURIComponent(effectiveUsername);

    // If no password is provided, fall back to cookie-only authentication.
    const useCookieSession = !password;

    // WHY credentials differ by auth mode:
    //   When an app password is available we set credentials:'omit' so the browser does NOT
    //   send the OIDC session cookie alongside the Authorization header. If both are present
    //   Nextcloud's auth chain evaluates the session cookie first; the OIDC session does not
    //   carry WebDAV write permissions, so the request is rejected with 401 even though the
    //   app password is valid. Omitting cookies forces Nextcloud to use only Basic Auth.
    //   When cookie-only mode is active (no password) we keep 'include' so the OIDC session
    //   cookie is the sole authentication mechanism.
    const requestBase = {
        mode: 'cors',
        credentials: useCookieSession ? 'include' : 'omit',
    };
    const authHeader = useCookieSession ? null : ('Basic ' + btoa(effectiveUsername + ':' + password));

    return {
        authHeader: authHeader,
        requestBase: requestBase,
        baseUrl: baseUrl,
        baseOrigin: parsedUrl.origin,
        encodedUsername: encodedUsername,
        encodedPath: encodedPath,
        normalizedRemotePath: normalizedRemotePath.length > 0 ? normalizedRemotePath : '/',
        effectiveUsername: effectiveUsername,
    };
}

// Extends buildNextcloudWebdavBaseContext with the final per-file WebDAV URL.
// Returns null if the base context cannot be built.
function buildNextcloudWebdavContext(filename, nextcloudUrl, username, password, remotePath) {
    const baseContext = buildNextcloudWebdavBaseContext(nextcloudUrl, username, password, remotePath);
    if (!baseContext) {
        return null;
    }

    const encodedFilename = encodeURIComponent(filename);
    const webdavUrl = `${baseContext.baseUrl}/remote.php/dav/files/${baseContext.encodedUsername}/${baseContext.encodedPath}${baseContext.encodedPath ? '/' : ''}${encodedFilename}`;

    return {
        authHeader: baseContext.authHeader,
        requestBase: baseContext.requestBase,
        webdavUrl: webdavUrl,
        effectiveUsername: baseContext.effectiveUsername,
    };
}


// ====== NOLAI - {- Backend -} /Sprint 3/ Task 151 ======
//
// initiateNextcloudLoginFlowV2(nextcloudBaseUrl)
//
// Starts a Nextcloud Login Flow v2 session by POSTing to /index.php/login/v2.
// This is the official Nextcloud mechanism for third-party apps to acquire
// credentials (username + app password) without knowing the user's raw password.
//
// WHY Login Flow v2 instead of the OCS /core/apppassword endpoint:
//   The OCS endpoint returns 405 for OIDC-authenticated users (GoAuthentik).
//   Nextcloud requires password re-confirmation to generate app passwords, but
//   OIDC users have no Nextcloud password to provide. Login Flow v2 is the only
//   Nextcloud-supported path that works for SSO users — the server handles
//   credential issuance internally after the user completes their SSO login.
//
// Returns a Promise resolving to { pollToken, pollEndpoint, loginUrl }.
// ====== end of changes by SE ======
async function initiateNextcloudLoginFlowV2(nextcloudBaseUrl) {
    var response = await fetch(nextcloudBaseUrl + '/index.php/login/v2', {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
    });
    if (!response.ok) {
        throw new Error('Login Flow v2 initiation failed: ' + response.status);
    }
    var json = await response.json();
    return {
        pollToken: json.poll.token,
        pollEndpoint: json.poll.endpoint,
        loginUrl: json.login,
    };
}

// ====== NOLAI - {- Backend -} /Sprint 3/ Task 151 ======
//
// pollNextcloudLoginFlowV2(pollEndpoint, pollToken)
//
// Checks whether the user has completed the Login Flow v2 authentication by
// POSTing the poll token to Nextcloud's poll endpoint.
//
// WHY POST with x-www-form-urlencoded:
//   The Nextcloud Login Flow v2 poll endpoint expects the token as a form body,
//   not a query parameter or JSON. Using the wrong content type causes the server
//   to ignore the token and always return 404.
//
// Returns { loginName, appPassword } when the user has completed login,
// or null if the flow is still pending (Nextcloud returns 404 until done).
// ====== end of changes by SE ======
async function pollNextcloudLoginFlowV2(pollEndpoint, pollToken) {
    var response = await fetch(pollEndpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'include',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'token=' + encodeURIComponent(pollToken),
    });
    // 404 means the user has not yet completed the login — not an error.
    if (response.status === 404) { return null; }
    if (!response.ok) {
        throw new Error('Login Flow v2 poll failed: ' + response.status);
    }
    var json = await response.json();
    return { loginName: json.loginName, appPassword: json.appPassword };
}

// WebDAV PUT function that saves the file as XML content to the Nextcloud server. Returns true if successful, false otherwise.
async function saveDrawIOToNextcloudXML(filename, xmlContent, nextcloudUrl, username, password, remotePath = '/') {
    const webdavContext = buildNextcloudWebdavContext(filename, nextcloudUrl, username, password, remotePath);
    if (!webdavContext) {
        return false;
    }

    const authHeader = webdavContext.authHeader;
    const requestBase = webdavContext.requestBase;
    const webdavUrl = webdavContext.webdavUrl;
    const effectiveUsername = webdavContext.effectiveUsername;

    let lockToken = null;
    let lockSupported = true;

    // WebDAV LOCK request body to acquire an exclusive lock on the file to prevent concurrent edits.
    const lockInfo = `<?xml version="1.0" encoding="utf-8"?>
<d:lockinfo xmlns:d="DAV:">
  <d:lockscope><d:exclusive/></d:lockscope>
  <d:locktype><d:write/></d:locktype>
  <d:owner><d:href>${effectiveUsername}</d:href></d:owner>
</d:lockinfo>`;

    try {
        // 1. LOCK request (optional fallback for servers that do not support locking)
        // Try LOCK first to avoid overwriting concurrent edits.
        // Bugfix note: some deployments return 405/501 for LOCK; in that case we still attempt a plain PUT.
        const lockResponse = await fetch(webdavUrl, {
            ...requestBase,
            method: 'LOCK',
            headers: {
                // Spread auth header conditionally: when useCookieSession=true authHeader is null
                // and we must omit the key entirely (passing null breaks some servers).
                ...(authHeader ? {'Authorization': authHeader} : {}),
                'Content-Type': 'application/xml; charset=utf-8',
                'Depth': '0',
                'Timeout': 'Second-300',
            },
            body: lockInfo,
        });

        // If LOCK isn't supported, log a warning and still continue with PUT to save.
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
            // Some servers return Lock-Token as a header, others only in XML response body.
            // Handle both formats to keep interoperability across WebDAV implementations.
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

            // If attempted to obtain a lock but didn't get a token, abort.
            if (!lockToken) {
                console.error('No lock token acquired. Aborting PUT to prevent data loss.');
                return false;
            }
        }

        // WebDAV PUT request
        const putHeaders = {
            ...(authHeader ? {'Authorization': authHeader} : {}),
            'Content-Type': 'application/xml',
        };

        if (lockSupported && lockToken) {
            putHeaders['If'] = `(${lockToken})`;
        }

        // Actual WebDAV PUT request, with file XML content in the body.
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

        console.error(`Error saving file ${filename}: ${response.status} ${response.statusText}`);
        return false;
    } catch (error) {
        if (error && error.name === 'TypeError') {
            // In browsers, failed CORS preflight often surfaces as TypeError from fetch which is shown as an error in Networks tab on browser.
            console.error('CORS/network error while saving to Nextcloud. If draw.io runs on a different origin than Nextcloud, allow CORS preflight and WebDAV headers on the server.');
        }
        console.error('WebDAV Save Error:', error);
        return false;
    } finally {
        // UNLOCK request
        if (lockToken) {
            try {
                await fetch(webdavUrl, {
                    ...requestBase,
                    method: 'UNLOCK',
                    headers: {
                        ...(authHeader ? {'Authorization': authHeader} : {}),
                        'Lock-Token': lockToken,
                    },
                });
            } catch (unlockError) {
                console.error('Unlock failed:', unlockError);
            }
        }
    }
}

// WebDAV GET function to retrieve file content from Nextcloud server. Returns null on failure, otherwise returns file content as string.
async function getDrawIOFromNextcloudXML(filename, nextcloudUrl, username, password, remotePath = '/') {
    const webdavContext = buildNextcloudWebdavContext(filename, nextcloudUrl, username, password, remotePath);
    if (!webdavContext) {
        return null;
    }

    // Creating GET header.
    try {
        const getResponse = await fetch(webdavContext.webdavUrl, {
            ...webdavContext.requestBase,
            method: 'GET',
            headers: {
                ...(webdavContext.authHeader ? {'Authorization': webdavContext.authHeader} : {}),
            },
        });

        if (!getResponse.ok) {
            console.error(`Error retrieving file ${filename}: ${getResponse.status} ${getResponse.statusText}`);
            return null;
        }

        const content = await getResponse.text();
        console.log(`Successfully retrieved content from Nextcloud for ${filename}`);
        return content;
    } catch (error) {
        if (error && error.name === 'TypeError') {
            console.error('CORS/network error while reading from Nextcloud. If draw.io runs on a different origin than Nextcloud, allow CORS preflight and WebDAV headers on the server.');
        }
        console.error('WebDAV Get Error:', error);
        return null;
    }
}

// Lists all .drawio files in the Nextcloud directory (and subdirectories if recursive=true).
// Returns array of file objects with {name, remotePath, displayPath} or empty array on failure.
async function listDrawIOFilesInNextcloud(nextcloudUrl, username, password, remotePath = '/', recursive = true) {
    const initialContext = buildNextcloudWebdavDirectoryContext(nextcloudUrl, username, password, remotePath);
    if (!initialContext) {
        return [];
    }

    const pendingDirectories = [initialContext.normalizedRemotePath];
    const visitedDirectories = {};
    const fileMap = {};

    while (pendingDirectories.length > 0) {
        const currentPath = pendingDirectories.shift();

        // If already visited this path, then skip and continue to the next.
        if (visitedDirectories[currentPath]) {
            continue;
        }
        // Mark this path as visited.
        visitedDirectories[currentPath] = true;

        // Rebuild the context for the current path to list files under it.
        const context = buildNextcloudWebdavDirectoryContext(nextcloudUrl, username, password, currentPath);
        if (!context) {
            continue;
        }

        let entries = [];

        // WebDAV PROPFIND request to list files and directories under the current path.
        try {
            const response = await fetch(context.directoryUrl, {
                ...context.requestBase,
                method: 'PROPFIND',
                headers: {
                    ...(context.authHeader ? {'Authorization': context.authHeader} : {}),
                    'Depth': '1',
                    'Content-Type': 'application/xml; charset=utf-8',
                },
                body: '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>',
            });

            if (!response.ok) {
                console.error(`Error listing Nextcloud directory ${context.normalizedRemotePath}: ${response.status} ${response.statusText}`);
            } else {
                // Parse XML response to extract file.
                const xmlText = await response.text();
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(xmlText, 'application/xml');

                const parseErrors = xmlDoc.getElementsByTagName('parsererror');
                if (parseErrors != null && parseErrors.length > 0) {
                    console.error('Unable to parse WebDAV PROPFIND response');
                } else {
                    // Each <response> is a file or directory entry under the current path.
                    const responseNodes = xmlDoc.getElementsByTagNameNS('DAV:', 'response');

                    // Loop through each response node to extract file/directory information.
                    for (let i = 0; i < responseNodes.length; i++) {
                        const responseNode = responseNodes[i];
                        const hrefNode = responseNode.getElementsByTagNameNS('DAV:', 'href')[0];

                        if (!hrefNode || hrefNode.textContent == null) {
                            continue;
                        }

                        const hrefPathname = new URL(hrefNode.textContent, context.baseOrigin).pathname;
                        const relativePath = extractRelativeWebdavPath(hrefPathname, context.userDavPrefix);

                        if (relativePath == null || relativePath === context.normalizedRemotePath) {
                            continue;
                        }

                        const propNode = responseNode.getElementsByTagNameNS('DAV:', 'prop')[0];
                        const isDirectory = propNode != null &&
                            propNode.getElementsByTagNameNS('DAV:', 'collection').length > 0;

                        const pathParts = relativePath.split('/').filter(function(segment) {
                            return segment.length > 0;
                        });

                        if (pathParts.length === 0) {
                            continue;
                        }

                        const name = decodeURIComponent(pathParts[pathParts.length - 1]);
                        const parentPath = (pathParts.length > 1) ? pathParts.slice(0, -1).join('/') : '/';

                        entries.push({
                            name: name,
                            remotePath: isDirectory ? relativePath : parentPath,
                            isDirectory: isDirectory,
                        });
                    }
                }
            }
        } catch (error) {
            if (error && error.name === 'TypeError') {
                console.error('CORS/network error while listing files from Nextcloud. If draw.io runs on a different origin than Nextcloud, allow CORS preflight and WebDAV headers on the server.');
            }
            console.error('WebDAV List Error:', error);
        }

        // Add .drawio files to the entries (filemap).
        for (let i = 0; i < entries.length; i++) {
            const entry = entries[i];

            if (entry.isDirectory) {
                if (recursive && !visitedDirectories[entry.remotePath]) {
                    pendingDirectories.push(entry.remotePath);
                }
            } else if (/\.drawio$/i.test(entry.name)) {
                const key = `${entry.remotePath}/${entry.name}`;
                fileMap[key] = {
                    name: entry.name,
                    remotePath: entry.remotePath,
                    displayPath: (entry.remotePath === '/' ? '' : entry.remotePath + '/') + entry.name,
                };
            }
        }
    }

    // Return array of files from converted fileMap.
    const files = Object.keys(fileMap).map(function(key) {
        return fileMap[key];
    });

    files.sort(function(a, b) {
        return a.displayPath.localeCompare(b.displayPath);
    });

    return files;
}

// ====== NOLAI - {- Backend -} /Sprint 2/ Task 117 ======
//
// deleteFileInNextcloud(nextcloudUrl, username, password, remotePath, filename)
//
// Deletes a file from Nextcloud via WebDAV DELETE (preceded by an optional
// LOCK to prevent concurrent modification, with UNLOCK in the finally block).
// Falls back to unlocked DELETE if the server does not support LOCK.
// ====== end of changes by SE ======
async function deleteFileInNextcloud(nextcloudUrl, username, password, remotePath = '/', filename) {

    const webdavContext = buildNextcloudWebdavContext(filename, nextcloudUrl, username, password, remotePath);

    if (!webdavContext) {
        return false;
    }

    const authHeader = webdavContext.authHeader;
    const requestBase = webdavContext.requestBase;
    const webdavUrl = webdavContext.webdavUrl;
    const effectiveUsername = webdavContext.effectiveUsername;

    let lockToken = null;
    let lockSupported = true;

    // WebDAV LOCK request body to acquire an exclusive lock on the file to prevent concurrent edits.
    const lockInfo = `<?xml version="1.0" encoding="utf-8"?>
    <d:lockinfo xmlns:d="DAV:">
    <d:lockscope><d:exclusive/></d:lockscope>
    <d:locktype><d:write/></d:locktype>
    <d:owner><d:href>${effectiveUsername}</d:href></d:owner>
    </d:lockinfo>`;

    try {
        // 1. LOCK request (optional fallback for servers that do not support locking)
        // Try LOCK first to avoid overwriting concurrent edits.
        // Bugfix note: some deployments return 405/501 for LOCK; in that case we still attempt a plain PUT.
        const lockResponse = await fetch(webdavUrl, {
            ...requestBase,
            method: 'LOCK',
            headers: {
                ...(authHeader ? {'Authorization': authHeader} : {}),
                'Content-Type': 'application/xml; charset=utf-8',
                'Depth': '0',
                'Timeout': 'Second-300',
            },
            body: lockInfo,
        });

        // If LOCK is not supported, fall back to an unlocked DELETE.
        if (!lockResponse.ok) {
            if (lockResponse.status === 405 || lockResponse.status === 501) {
                lockSupported = false;
                console.warn(`LOCK not supported by server (${lockResponse.status}). Falling back to unlocked DELETE.`);
            } else {
                console.error(`LOCK failed: ${lockResponse.status} ${lockResponse.statusText}`);
                return false;
            }
        } else {
            // Some servers return Lock-Token as a header, others only in XML response body.
            // Handle both formats to keep interoperability across WebDAV implementations.
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
                console.error('No lock token acquired. Aborting DELETE to prevent data loss.');
                return false;
            }
        }

        // WebDAV DELETE request.
        const deleteHeaders = {
            ...(authHeader ? {'Authorization': authHeader} : {}),
            'Content-Type': 'application/xml',
        };

        if (lockSupported && lockToken) {
            deleteHeaders['If'] = `(${lockToken})`;
        }

        // Actual WebDAV DELETE request.
        const response = await fetch(webdavUrl, {
            ...requestBase,
            method: 'DELETE',
            headers: deleteHeaders,
        });

        if (response.ok) {
            console.log(`Successfully deleted ${filename} from Nextcloud`);
            return true;
        }

        console.error(`Error deleting file ${filename}: ${response.status} ${response.statusText}`);
        return false;
    } catch (error) {
        if (error && error.name === 'TypeError') {
            // In browsers, failed CORS preflight often surfaces as TypeError from fetch which is shown as an error in Networks tab on browser.
            console.error('CORS/network error while deleting from Nextcloud. If draw.io runs on a different origin than Nextcloud, allow CORS preflight and WebDAV headers on the server.');
        }
        console.error('WebDAV Delete Error:', error);
        return false;
    } finally {
        // UNLOCK request
        if (lockToken) {
            try {
                await fetch(webdavUrl, {
                    ...requestBase,
                    method: 'UNLOCK',
                    headers: {
                        ...(authHeader ? {'Authorization': authHeader} : {}),
                        'Lock-Token': lockToken,
                    },
                });
            } catch (unlockError) {
                console.error('Unlock failed:', unlockError);
                }
            }
        }
    }

// Helper function that extracts relative path from full WebDAV by removing the user-specific prefix.
// Returns null if pathname doesn't start with the expected prefix.
function extractRelativeWebdavPath(pathname, userDavPrefix) {
    if (pathname.indexOf(userDavPrefix) !== 0) {
        return null;
    }

    let relative = pathname.substring(userDavPrefix.length);
    relative = relative.replace(/^\/+/, '').replace(/\/+$/, '');

    return relative.length > 0 ? relative : '/';
}

// Build context for Nextcloud WebDAV directory calls (like listing files).
function buildNextcloudWebdavDirectoryContext(nextcloudUrl, username, password, remotePath) {
    const baseContext = buildNextcloudWebdavBaseContext(nextcloudUrl, username, password, remotePath);
    if (!baseContext) {
        return null;
    }

    const userDavPrefix = `/remote.php/dav/files/${baseContext.encodedUsername}/`;
    const directoryUrl = `${baseContext.baseUrl}${userDavPrefix}${baseContext.encodedPath}${baseContext.encodedPath ? '/' : ''}`;

    return {
        authHeader: baseContext.authHeader,
        requestBase: baseContext.requestBase,
        directoryUrl: directoryUrl,
        normalizedRemotePath: baseContext.normalizedRemotePath,
        userDavPrefix: userDavPrefix,
        baseOrigin: baseContext.baseOrigin,
    };
}

// ====== NOLAI - {- Backend -} /Sprint 3/ Task 151 ======
//
// openNextcloudLoginPopup(nextcloudBaseUrl)
//
// Implements the Nextcloud Login Flow v2 to obtain app credentials for a user
// authenticating via GoAuthentik SSO.
//
// Flow:
//   1. POST /index.php/login/v2 → receive { pollToken, pollEndpoint, loginUrl }
//   2. Open loginUrl in a popup (Nextcloud redirects through GoAuthentik SSO)
//   3. Poll pollEndpoint every 2 s with pollToken
//   4. When the user completes login, the poll returns { loginName, appPassword }
//
// WHY a popup rather than a full-page redirect:
//   draw.io (port 5443) and Nextcloud (port 443) are separate origins. Redirecting
//   the main window would discard any unsaved diagram state.
//
// WHY Login Flow v2 instead of OCS session polling:
//   OCS /core/apppassword returns 405 for OIDC users (no Nextcloud password to
//   confirm). Login Flow v2 is the official Nextcloud mechanism for apps to acquire
//   credentials for SSO users — the server issues the app password directly after
//   the GoAuthentik flow completes, without requiring a Nextcloud password.
//
// Returns a Promise resolving to { username, appPassword } on success,
// or rejecting if the popup is blocked or the user cancels.
// ====== end of changes by SE ======
function openNextcloudLoginPopup(nextcloudBaseUrl) {
    return new Promise(function(resolve, reject) {

        initiateNextcloudLoginFlowV2(nextcloudBaseUrl).then(function(flow) {

            var popup = window.open(
                flow.loginUrl,
                'nextcloud_sso_login',
                'width=900,height=650,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=yes'
            );

            if (!popup || popup.closed) {
                reject(new Error(
                    'The login popup was blocked. Allow popups for this site and try again.'
                ));
                return;
            }

            var POLL_MS = 2000;
            var poll = setInterval(function() {

                // If the user closed the popup before finishing, stop polling.
                if (popup.closed) {
                    clearInterval(poll);
                    reject(new Error('Login was cancelled.'));
                    return;
                }

                // Poll the Login Flow v2 endpoint — null means still pending.
                pollNextcloudLoginFlowV2(flow.pollEndpoint, flow.pollToken).then(function(creds) {
                    if (creds) {
                        clearInterval(poll);
                        try { popup.close(); } catch (e) { /* ignore if already closed */ }
                        resolve({ username: creds.loginName, appPassword: creds.appPassword });
                    }
                    // null means the user has not completed login yet — keep polling.
                }).catch(function(err) {
                    clearInterval(poll);
                    try { popup.close(); } catch (e) { /* ignore */ }
                    reject(err);
                });

            }, POLL_MS);

        }).catch(function(err) {
            reject(new Error('Could not start login flow: ' + err.message));
        });
    });
}

// ====== NOLAI - {- Frontend -} /Sprint 3/ Task 151 ======
//
// attachNextcloudSessionBanner(container, nextcloudBaseUrl, onLoggedIn)
//
// Builds and attaches a session-status banner to a draw.io dialog container.
// Both the Save and Load dialogs call this so the login UX is identical.
//
// Parameters:
//   container        — the dialog <div> to insert the banner into (after <h2>)
//   nextcloudBaseUrl — Nextcloud root URL, e.g. 'https://localhost'
//   onLoggedIn       — callback(username, appPassword) fired once Login Flow v2
//                      completes; the caller stores both values and passes them
//                      to WebDAV functions as Basic Auth credentials
//
// Banner states:
//   ready      — amber,  "Not connected" + "Connect" button (initial state)
//   connecting — grey,   "Opening login…" (while popup is open)
//   confirmed  — green,  "Logged in as <username>"
//
// WHY always show the Connect button (no initial session check):
//   Even if a Nextcloud session cookie exists, Nextcloud returns 405 when the
//   OCS /core/apppassword endpoint is called for OIDC users — so a session alone
//   is not enough. We always need Login Flow v2 to get a usable app password.
//   Removing the initial OCS check simplifies the flow and avoids a spurious
//   CORS preflight on dialog open.
//
// ====== end of changes by SE ======
function attachNextcloudSessionBanner(container, nextcloudBaseUrl, onLoggedIn) {
    var nolaiColor = '#008f89';

    // Build the banner DOM — flex row: icon | status text | login button.
    var banner = document.createElement('div');
    banner.style.cssText = [
        'display:flex',
        'align-items:center',
        'gap:10px',
        'padding:10px 14px',
        'margin-bottom:16px',
        'border-radius:6px',
        'font-size:13px',
        'font-family:Helvetica,Arial,sans-serif',
        'background:#f5f5f5',
        'border:1px solid #ddd',
        'min-height:38px',
        'box-sizing:border-box',
    ].join(';');

    var icon = document.createElement('span');
    icon.style.cssText = 'font-size:16px;flex-shrink:0;';

    var statusText = document.createElement('span');
    statusText.style.cssText = 'flex:1;';

    // Login button — hidden until a logged-out state is detected.
    var loginBtn = document.createElement('button');
    loginBtn.innerHTML = 'Connect to Nextcloud';
    loginBtn.style.cssText = [
        'padding:5px 12px',
        'background:' + nolaiColor,
        'color:#fff',
        'border:none',
        'border-radius:4px',
        'cursor:pointer',
        'font-size:12px',
        'font-weight:bold',
        'flex-shrink:0',
        'display:none',
    ].join(';');

    banner.appendChild(icon);
    banner.appendChild(statusText);
    banner.appendChild(loginBtn);

    // Insert the banner immediately after the dialog's <h2> title element.
    var titleEl = container.querySelector('h2');
    if (titleEl && titleEl.nextSibling) {
        container.insertBefore(banner, titleEl.nextSibling);
    } else {
        container.appendChild(banner);
    }

    // setChecking — shown while the Login Flow v2 popup is open and polling.
    function setChecking() {
        banner.style.background = '#f5f5f5';
        banner.style.borderColor = '#ddd';
        icon.innerHTML = '⏳';
        statusText.innerHTML = 'Opening Nextcloud login&hellip;';
        loginBtn.style.display = 'none';
    }

    // setLoggedOut — shown on initial load or after a cancelled / failed login attempt.
    // errorMsg is displayed so the user understands why the button is visible.
    function setLoggedOut(errorMsg) {
        banner.style.background = '#fff8e1';
        banner.style.borderColor = '#ffb300';
        icon.innerHTML = '⚠️';
        statusText.innerHTML = errorMsg || 'Not connected to Nextcloud.';
        loginBtn.style.display = 'inline-block';
    }

    // confirmLogin — called once Login Flow v2 resolves with credentials, or when
    // a cached session is restored on dialog open. Writes to the session cache,
    // updates the banner to its confirmed (green) state, and fires onLoggedIn.
    function confirmLogin(username, appPassword) {
        // Persist credentials so subsequent dialog opens skip the login popup.
        _nextcloudSessionCache.username = username;
        _nextcloudSessionCache.password = appPassword;
        _nextcloudSessionCache.baseUrl  = nextcloudBaseUrl;

        banner.style.background = '#edfaf4';
        banner.style.borderColor = '#4caf50';
        icon.innerHTML = '✅';
        statusText.innerHTML = 'Logged in as <strong>' + username + '</strong>';
        loginBtn.style.display = 'none';
        if (typeof onLoggedIn === 'function') { onLoggedIn(username, appPassword); }
    }

    // Login button starts the Login Flow v2 popup.
    loginBtn.addEventListener('click', function() {
        loginBtn.disabled = true;
        loginBtn.innerHTML = 'Opening login&hellip;';
        setChecking();

        openNextcloudLoginPopup(nextcloudBaseUrl).then(function(creds) {
            confirmLogin(creds.username, creds.appPassword);
        }).catch(function(err) {
            // Re-enable the button so the user can try again without reopening the dialog.
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'Connect to Nextcloud';
            setLoggedOut(err.message);
        });
    });

    // On banner creation, restore from cache if credentials exist from a previous
    // dialog in this browser session — no popup required. Otherwise show the
    // Connect button so the user can authenticate for the first time.
    if (_nextcloudSessionCache.username && _nextcloudSessionCache.password) {
        confirmLogin(_nextcloudSessionCache.username, _nextcloudSessionCache.password);
    } else {
        setLoggedOut('Not connected — click the button to authenticate via GoAuthentik.');
    }

    // Expose state-setter functions so callers can drive the banner externally if needed.
    return { confirmLogin: confirmLogin, setLoggedOut: setLoggedOut, setChecking: setChecking };
}

// ====== NOLAI - {- Backend -} /Sprint 3/ Task 151 ======
// renameFileInNextcloud — renames a file on Nextcloud via a WebDAV MOVE request.
//
// WebDAV MOVE atomically renames/moves a resource. The Destination header carries the full
// absolute URL of the new resource path. Overwrite:F prevents accidental overwrites if a
// file with the new name already exists (server returns 412 in that case).
//
// Parameters:
//   oldFilename    {string} — current filename, e.g. "OldName.drawio"
//   newFilename    {string} — desired filename, e.g. "NewName.drawio"
//   nextcloudUrl   {string} — Nextcloud base URL, e.g. "https://localhost"
//   username       {string} — Nextcloud login name (app-password owner)
//   password       {string} — app password
//   remotePath     {string} — subfolder within the user DAV root, e.g. "/" for root
//
// Returns a Promise that resolves to true on success or rejects with an Error.
// ====== end of changes by SE ======
function renameFileInNextcloud(oldFilename, newFilename, nextcloudUrl, username, password, remotePath) {
    var ctx = buildNextcloudWebdavBaseContext(nextcloudUrl, username, password, remotePath);
    if (!ctx) { return Promise.reject(new Error('Could not build WebDAV context for rename')); }

    var prefix = ctx.baseUrl + '/remote.php/dav/files/' + ctx.encodedUsername +
                 (ctx.encodedPath ? '/' + ctx.encodedPath : '');
    var oldUrl = prefix + '/' + encodeURIComponent(oldFilename);
    var newUrl = prefix + '/' + encodeURIComponent(newFilename);

    var headers = { 'Destination': newUrl, 'Overwrite': 'F' };
    if (ctx.authHeader) { headers['Authorization'] = ctx.authHeader; }

    return fetch(oldUrl, Object.assign({}, ctx.requestBase, { method: 'MOVE', headers: headers }))
        .then(function(response) {
            // 201 Created or 204 No Content both indicate a successful MOVE.
            if (response.status === 201 || response.status === 204) { return true; }
            throw new Error('WebDAV MOVE failed: HTTP ' + response.status);
        });
}

// ====== NOLAI - {- Backend -} /Sprint 3/ Task 151 ======
// LocalFile.prototype.rename override — adds Nextcloud persistence to draw.io's in-memory rename.
//
// draw.io's default LocalFile.prototype.rename updates only the in-memory title; it has no
// knowledge of Nextcloud. This override wraps the original so the in-memory update still
// happens, then additionally performs a WebDAV MOVE if session credentials are cached.
//
// The override reads baseUrl/username/password from _nextcloudSessionCache so that it works
// without any extra wiring in Menus.js — the banner login flow already populates the cache.
//
// Assumptions:
//   - Files are always saved at the root of the user's DAV folder (remotePath = '/').
//   - _nextcloudSessionCache.baseUrl is set when the user connects via the session banner.
// ====== end of changes by SE ======
(function() {
    // Guard: LocalFile may not yet be defined if scripts load out of order.
    if (typeof LocalFile === 'undefined') { return; }

    var _originalRename = LocalFile.prototype.rename;

    LocalFile.prototype.rename = function(newTitle, success, error) {
        var oldTitle = this.title;

        // Always apply the in-memory rename so draw.io's toolbar updates immediately.
        _originalRename.call(this, newTitle, null, null);

        var cache = _nextcloudSessionCache;
        var titleChanged = oldTitle && newTitle && oldTitle !== newTitle;

        if (cache.username && cache.password && cache.baseUrl && titleChanged) {
            // Perform WebDAV MOVE then fire the caller's callbacks.
            renameFileInNextcloud(oldTitle, newTitle, cache.baseUrl, cache.username, cache.password, '/')
                .then(function() {
                    updateNolaiFileTitle(newTitle);
                    if (typeof success === 'function') { success(); }
                })
                .catch(function(err) {
                    console.error('NOLAI: Nextcloud rename (MOVE) failed', err);
                    if (typeof error === 'function') { error(err); }
                });
        } else {
            // No Nextcloud session — just update the title bar and fire success.
            updateNolaiFileTitle(newTitle);
            if (typeof success === 'function') { success(); }
        }
    };
})();

// ====== NOLAI - {- Frontend -} /Sprint 3/ Task 151 ======
// updateNolaiFileTitle — updates the filename shown in draw.io's native menu bar element and
// in the browser tab title.
//
// draw.io already renders a ".geFilename" <a> element in its top menu bar. We write directly
// to that element so the filename is styled and positioned correctly by draw.io itself — no
// overlay div is needed or created. document.title is updated in all cases.
//
// If ".geFilename" is not in the DOM yet (draw.io still initialising), the function silently
// retries every 300 ms until the element appears — no temporary UI is injected.
//
// Behaviour:
//   - Non-empty filename  → shows that filename in the menu bar and browser tab.
//   - null / empty string → shows "Untitled" in both places.
//
// Parameters:
//   filename {string|null} — full filename, e.g. "MyDiagram.drawio", or null for Untitled.
// ====== end of changes by SE ======
function updateNolaiFileTitle(filename) {
    var display = (filename && filename.trim()) ? filename.trim() : 'Untitled';

    // Always keep the browser tab title in sync.
    document.title = display + ' — NOLAI';

    // Write to draw.io's native menu-bar filename element. If it isn't in the DOM yet
    // (draw.io still initialising), schedule a retry — no overlay is used.
    var fnameEl = document.querySelector('.geFilename');
    if (fnameEl) {
        fnameEl.innerText = display;
    } else {
        setTimeout(function() { updateNolaiFileTitle(filename); }, 300);
    }
}

// Show "Untitled" once draw.io has had time to render its toolbar (~1 s after script load).
setTimeout(function() { updateNolaiFileTitle(null); }, 1000);
