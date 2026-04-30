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
var _nextcloudSessionCache = { username: null, password: null, baseUrl: null, displayName: null };

// ====== NOLAI - {- Frontend -} /Sprint 3/ Task 151 ======
// _nolaiTopBarRefresh — optional callback registered by attachNextcloudTopBarButton.
// When a dialog login button completes authentication it calls this so the top-bar
// chip updates immediately without requiring a page reload.
// ====== end of changes by SE ======
var _nolaiTopBarRefresh = null;

// ====== NOLAI - {- Frontend -} /Sprint 3/ Task 151 ======
// _nolaiIsDark() — safe wrapper around Editor.isDarkMode().
// Returns true when the editor is currently in dark mode, false otherwise.
// Guarded so that calling it before Editor is fully initialised never throws.
// ====== end of changes by SE ======
function _nolaiIsDark() {
    return typeof Editor !== 'undefined' &&
           typeof Editor.isDarkMode === 'function' &&
           Editor.isDarkMode();
}

// ====== NOLAI - {- Frontend -} /Sprint 3/ Task 151 ======
// Dark-mode reactive update system for NOLAI widgets.
//
// Problem: our widgets use inline styles computed once at render time. When the
// user toggles dark mode (View → Dark, or the OS preference changes), draw.io
// calls EditorUi.prototype.setDarkMode which writes to the Editor.darkMode
// property and fires a 'darkModeChanged' event on the EditorUi instance. Neither
// signal is easily reachable from NextcloudFile.js without access to editorUi.
//
// Solution: intercept Editor.darkMode via Object.defineProperty so we receive
// a synchronous notification on every write. Widgets register callbacks in
// _nolaiDarkModeListeners and are called immediately when the value changes.
//
// WHY Object.defineProperty rather than a MutationObserver:
//   MutationObserver would need to watch a large subtree to catch the geDarkMode
//   class being toggled, which is expensive. The property setter gives a precise,
//   zero-overhead hook with no DOM traversal.
//
// Guard: _nolaiDarkPatched on the Editor object prevents double-patching if the
// script is ever loaded more than once.
// ====== end of changes by SE ======
var _nolaiDarkModeListeners = [];

(function patchEditorDarkMode() {
    // Editor may not be defined yet if scripts load asynchronously — retry.
    if (typeof Editor === 'undefined') {
        setTimeout(patchEditorDarkMode, 50);
        return;
    }
    if (Editor._nolaiDarkPatched) { return; }

    var _stored = Editor.darkMode; // capture the current value (false by default)

    Object.defineProperty(Editor, 'darkMode', {
        configurable: true,
        get: function() { return _stored; },
        set: function(val) {
            var changed = _stored !== val;
            _stored = val;
            if (changed) {
                // Call each listener; wrap in try/catch so one bad callback
                // cannot prevent the others from running.
                for (var i = 0; i < _nolaiDarkModeListeners.length; i++) {
                    try { _nolaiDarkModeListeners[i](val); } catch (e) { /* ignore */ }
                }
            }
        },
    });

    Editor._nolaiDarkPatched = true;
})();
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
// attachNextcloudTopBarButton(container, nextcloudBaseUrl, onLoggedIn)
//
// Renders a professional, compact Nextcloud authentication widget in the draw.io
// top-bar button container. The widget has three visual states:
//
//   signed-out  — teal pill button "Sign in to Nextcloud" (cloud icon + label)
//   signing-in  — muted "Signing in…" text while the login popup is open
//   signed-in   — rounded chip: Nextcloud avatar (or initials fallback) + display name
//
// Avatar loading:
//   Fetches /index.php/avatar/{username}/32 with Basic Auth. If the request
//   fails (CORS, network, etc.) the chip shows a generated SVG initials circle
//   using the first character of the display name in the NOLAI teal colour.
//
// Cross-dialog coordination:
//   Registers itself as _nolaiTopBarRefresh so that the session banner inside
//   Save/Load dialogs can refresh this chip immediately after the user logs in
//   from within a dialog — no page reload needed.
//
// Parameters:
//   container        — the <div> inside buttonContainer that wraps this widget
//   nextcloudBaseUrl — Nextcloud root URL, e.g. 'https://localhost'
//   onLoggedIn       — optional callback(username, appPassword) fired on login
// ====== end of changes by SE ======
function attachNextcloudTopBarButton(container, nextcloudBaseUrl, onLoggedIn) {
    var nolaiColor = '#008f89';

    container.style.cssText = [
        'display:inline-flex',
        'align-items:center',
        'vertical-align:middle',
        'margin:0 4px',
    ].join(';');

    // makeInitialsAvatar — generates a teal SVG circle with one capital letter.
    // Used immediately on login and as the permanent fallback if the Nextcloud
    // avatar endpoint is unreachable.
    function makeInitialsAvatar(displayName) {
        var initial = (displayName || 'U').trim().charAt(0).toUpperCase();
        var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">' +
            '<circle cx="12" cy="12" r="12" fill="' + nolaiColor + '"/>' +
            '<text x="12" y="16.5" text-anchor="middle" font-family="Helvetica,Arial,sans-serif" ' +
            'font-size="12" font-weight="700" fill="#fff">' + initial + '</text>' +
            '</svg>';
        return 'data:image/svg+xml;base64,' + btoa(svg);
    }

    // fetchAvatar — attempts to load the user's Nextcloud avatar as a Blob URL.
    // Uses Basic Auth so the browser does not send the OIDC session cookie
    // (same reasoning as WebDAV calls — mixing cookie + token causes 401).
    function fetchAvatar(username, appPassword) {
        return fetch(
            nextcloudBaseUrl + '/index.php/avatar/' + encodeURIComponent(username) + '/32',
            {
                headers: { 'Authorization': 'Basic ' + btoa(username + ':' + appPassword) },
                mode: 'cors',
                credentials: 'omit',
            }
        ).then(function(r) {
            if (!r.ok) { throw new Error('avatar unavailable'); }
            return r.blob();
        }).then(function(blob) {
            return URL.createObjectURL(blob);
        });
    }

    // fetchDisplayName — same helper as in attachNextcloudSessionBanner, duplicated
    // here so the top-bar button has no dependency on the banner function.
    function fetchDisplayNameLocal(username, appPassword) {
        return fetch(nextcloudBaseUrl + '/ocs/v2.php/cloud/user?format=json', {
            headers: {
                'Authorization': 'Basic ' + btoa(username + ':' + appPassword),
                'OCS-APIRequest': 'true',
            },
            mode: 'cors',
            credentials: 'omit',
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            return (data.ocs && data.ocs.data && data.ocs.data.displayname)
                ? data.ocs.data.displayname
                : username;
        })
        .catch(function() { return username; });
    }

    // _chipState — tracks what the widget is currently showing so that the dark-mode
    // listener can call the right render function without any extra arguments.
    //
    //   mode: 'signed-out'  — Sign in button
    //         'signing-in'  — "Signing in…" spinner
    //         'signed-in'   — avatar chip with username
    //
    // For 'signed-in', username/appPassword/displayName are also stored so the
    // chip can be rebuilt verbatim (including avatar re-fetch) on a mode toggle.
    var _chipState = { mode: 'signed-out', username: null, appPassword: null, displayName: null };

    // showSignInButton — the default state before the user has authenticated.
    // The teal button looks correct on both light and dark toolbars so no branching
    // on dark mode is needed here.
    function showSignInButton() {
        _chipState.mode = 'signed-out';
        container.innerHTML = '';

        var btn = document.createElement('button');
        // Inline cloud SVG icon keeps the button self-contained (no external asset needed).
        var cloudIcon = '<svg width="13" height="10" viewBox="0 0 24 18" fill="currentColor" ' +
            'style="margin-right:5px;vertical-align:middle;flex-shrink:0">' +
            '<path d="M19.35 6.04A7.49 7.49 0 0012 0C9.11 0 6.6 1.64 5.35 4.04A5.994 5.994 0 ' +
            '000 10c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/>' +
            '</svg>';
        btn.innerHTML = cloudIcon + 'Sign in to Nextcloud';
        btn.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'padding:5px 13px',
            'background:' + nolaiColor,
            'color:#fff',
            'border:none',
            'border-radius:16px',
            'cursor:pointer',
            'font-size:12px',
            'font-weight:600',
            'font-family:Helvetica,Arial,sans-serif',
            'letter-spacing:0.1px',
            'box-shadow:0 1px 3px rgba(0,0,0,0.18)',
            'white-space:nowrap',
            'line-height:1.2',
            'transition:opacity 0.15s',
        ].join(';');

        btn.addEventListener('mouseover', function() { btn.style.opacity = '0.85'; });
        btn.addEventListener('mouseout',  function() { btn.style.opacity = '1'; });
        btn.addEventListener('click', startLogin);
        container.appendChild(btn);
    }

    // showSpinner — minimal text shown while the Login Flow v2 popup is open.
    // Colour adapts to dark mode so it reads well on the dark toolbar.
    function showSpinner() {
        _chipState.mode = 'signing-in';
        container.innerHTML = '';
        var dark = _nolaiIsDark();
        var span = document.createElement('span');
        span.style.cssText = [
            'font-size:12px',
            'font-family:Helvetica,Arial,sans-serif',
            'color:' + (dark ? '#aaa' : '#888'),
            'padding:0 6px',
            'white-space:nowrap',
        ].join(';');
        span.textContent = 'Signing in…';
        container.appendChild(span);
    }

    // showUserChip — the signed-in state.  Displays avatar + display name in a
    // rounded chip styled with a subtle NOLAI teal tint.
    // Background opacity, border colour, and text colour all adapt to dark mode
    // so the chip remains legible against both light and dark top bars.
    function showUserChip(username, appPassword, displayName) {
        _chipState.mode        = 'signed-in';
        _chipState.username    = username;
        _chipState.appPassword = appPassword;
        _chipState.displayName = displayName;

        container.innerHTML = '';
        var dark = _nolaiIsDark();

        var chip = document.createElement('div');
        chip.title = 'Signed in to Nextcloud as ' + (displayName || username);
        chip.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'gap:7px',
            'padding:3px 11px 3px 3px',
            // Slightly higher opacity in dark mode so the tint is visible on the
            // dark toolbar background without being too vivid.
            'background:' + (dark ? 'rgba(0,190,183,0.18)' : 'rgba(0,143,137,0.10)'),
            'border:1px solid ' + (dark ? 'rgba(0,190,183,0.40)' : 'rgba(0,143,137,0.30)'),
            'border-radius:16px',
            'font-size:12px',
            'font-family:Helvetica,Arial,sans-serif',
            'max-width:220px',
            'white-space:nowrap',
            'overflow:hidden',
            'cursor:default',
            'user-select:none',
        ].join(';');

        // Avatar — starts as initials; replaced by real photo once the fetch resolves.
        var avatarImg = document.createElement('img');
        avatarImg.style.cssText = [
            'width:22px',
            'height:22px',
            'border-radius:50%',
            'display:block',
            'flex-shrink:0',
            'object-fit:cover',
        ].join(';');
        avatarImg.src = makeInitialsAvatar(displayName || username);
        avatarImg.alt = displayName || username;

        // Swap in the real Nextcloud avatar once it has loaded.
        fetchAvatar(username, appPassword).then(function(url) {
            avatarImg.src = url;
        }).catch(function() { /* keep initials — no visual change needed */ });

        var nameEl = document.createElement('span');
        nameEl.textContent = displayName || username;
        nameEl.style.cssText = [
            'overflow:hidden',
            'text-overflow:ellipsis',
            'font-weight:500',
            // Light text on dark toolbar; dark text on light toolbar.
            'color:' + (dark ? '#e8e8e8' : '#111'),
            'flex:1',
            'min-width:0',
        ].join(';');

        chip.appendChild(avatarImg);
        chip.appendChild(nameEl);
        container.appendChild(chip);
    }

    // confirmLogin — called once credentials are obtained.  Updates the session
    // cache, renders the chip, and fires the caller's onLoggedIn callback.
    function confirmLogin(username, appPassword, displayName) {
        _nextcloudSessionCache.username    = username;
        _nextcloudSessionCache.password    = appPassword;
        _nextcloudSessionCache.baseUrl     = nextcloudBaseUrl;
        _nextcloudSessionCache.displayName = displayName || username;
        showUserChip(username, appPassword, displayName || username);
        if (typeof onLoggedIn === 'function') { onLoggedIn(username, appPassword); }
    }

    // startLogin — opens the Login Flow v2 popup, then resolves credentials.
    function startLogin() {
        showSpinner();
        openNextcloudLoginPopup(nextcloudBaseUrl).then(function(creds) {
            fetchDisplayNameLocal(creds.username, creds.appPassword).then(function(dn) {
                confirmLogin(creds.username, creds.appPassword, dn);
            }).catch(function() {
                confirmLogin(creds.username, creds.appPassword, creds.username);
            });
        }).catch(function() {
            // User cancelled or popup was blocked — return to the sign-in button.
            showSignInButton();
        });
    }

    // rerender — redraws the widget in its current state using fresh dark-mode
    // colours.  Called by the _nolaiDarkModeListeners entry below whenever
    // Editor.darkMode changes.
    function rerender() {
        if (_chipState.mode === 'signed-in') {
            showUserChip(_chipState.username, _chipState.appPassword, _chipState.displayName);
        } else if (_chipState.mode === 'signing-in') {
            showSpinner();
        } else {
            showSignInButton();
        }
    }

    // Register with the global dark-mode listener list so rerender() is called
    // synchronously whenever Editor.darkMode is written (i.e., every time the
    // user toggles dark mode via View or the OS preference changes).
    _nolaiDarkModeListeners.push(rerender);

    // Register a refresh callback so dialog sign-in buttons can update this chip.
    _nolaiTopBarRefresh = function() {
        var c = _nextcloudSessionCache;
        if (c.username && c.password) {
            showUserChip(c.username, c.password, c.displayName || c.username);
        }
    };

    // Restore from session cache (e.g., user opened the save dialog and logged in
    // there before this button was initialised) or show the sign-in button.
    if (_nextcloudSessionCache.username && _nextcloudSessionCache.password) {
        var c = _nextcloudSessionCache;
        showUserChip(c.username, c.password, c.displayName || c.username);
        if (typeof onLoggedIn === 'function') { onLoggedIn(c.username, c.password); }
    } else {
        showSignInButton();
    }
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
    // Initial colours are set here; setChecking/setLoggedOut/confirmLogin overwrite
    // them per-state with dark-mode-aware values.
    var _initDark = _nolaiIsDark();
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
        'background:' + (_initDark ? '#2a2a2a' : '#f5f5f5'),
        'border:1px solid ' + (_initDark ? '#555' : '#ddd'),
        'min-height:38px',
        'box-sizing:border-box',
    ].join(';');

    var icon = document.createElement('span');
    icon.style.cssText = 'font-size:16px;flex-shrink:0;';

    var statusText = document.createElement('span');
    statusText.style.cssText = 'flex:1;';

    // Login button — hidden until a logged-out state is detected.
    // Labelled "Sign in" to match the top-bar button wording.
    var loginBtn = document.createElement('button');
    loginBtn.innerHTML = 'Sign in';
    loginBtn.style.cssText = [
        'padding:5px 14px',
        'background:' + nolaiColor,
        'color:#fff',
        'border:none',
        'border-radius:12px',
        'cursor:pointer',
        'font-size:12px',
        'font-weight:600',
        'flex-shrink:0',
        'display:none',
        'white-space:nowrap',
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
    // Background/border adapt to dark mode so the banner is legible on dark dialogs.
    function setChecking() {
        var dark = _nolaiIsDark();
        banner.style.background = dark ? '#2a2a2a' : '#f5f5f5';
        banner.style.borderColor = dark ? '#555'    : '#ddd';
        icon.innerHTML = '⏳';
        statusText.style.color = dark ? '#ccc' : '#444';
        statusText.innerHTML = 'Opening Nextcloud login&hellip;';
        loginBtn.style.display = 'none';
    }

    // setLoggedOut — shown on initial load or after a cancelled / failed login attempt.
    // Directs the user to the top-bar "Sign in to Nextcloud" button as the primary
    // action; the inline sign-in button here is a convenience shortcut.
    // Amber palette is adjusted to work on both light and dark dialog backgrounds.
    function setLoggedOut(errorMsg) {
        var dark = _nolaiIsDark();
        banner.style.background   = dark ? '#2d2100' : '#fff8e1';
        banner.style.borderColor  = dark ? '#b36b00' : '#ffb300';
        icon.innerHTML = '⚠️';
        var textColor = dark ? '#ffd54f' : '#5d4037';
        statusText.style.color = textColor;
        statusText.innerHTML = errorMsg
            ? '<span style="color:' + textColor + '">' + errorMsg + '</span>'
            : 'Not signed in to Nextcloud. Use the <strong>Sign in to Nextcloud</strong> button in the top right, or sign in below.';
        loginBtn.style.display = 'inline-block';
    }

    // confirmLogin — called once Login Flow v2 resolves with credentials, or when
    // a cached session is restored on dialog open. Writes to the session cache,
    // updates the banner to its confirmed (green) state, and fires onLoggedIn.
    //
    // WHY displayName is separate from username:
    //   The Nextcloud Login Flow v2 returns the raw account UID as loginName, which
    //   is a SHA-256 hash when user_oidc's unique-uid=1 is active. The OCS API
    //   provides the human-readable display name separately. We use username for all
    //   authentication (WebDAV, OCS) and displayName only for the UI label.
    function confirmLogin(username, appPassword, displayName) {
        // Persist credentials so subsequent dialog opens skip the login popup.
        _nextcloudSessionCache.username    = username;
        _nextcloudSessionCache.password    = appPassword;
        _nextcloudSessionCache.baseUrl     = nextcloudBaseUrl;
        _nextcloudSessionCache.displayName = displayName || username;

        var dark = _nolaiIsDark();
        banner.style.background   = dark ? '#0d2b1a' : '#edfaf4';
        banner.style.borderColor  = dark ? '#388e3c' : '#4caf50';
        icon.innerHTML = '✅';
        var nameColor = dark ? '#81c784' : '#2e7d32';
        statusText.style.color = nameColor;
        statusText.innerHTML = 'Connected as <strong>' + (displayName || username) + '</strong>';
        loginBtn.style.display = 'none';
        // Refresh the top-bar chip immediately so the user sees their avatar/name
        // without needing to close and reopen the dialog.
        if (typeof _nolaiTopBarRefresh === 'function') { _nolaiTopBarRefresh(); }
        if (typeof onLoggedIn === 'function') { onLoggedIn(username, appPassword); }
    }

    // fetchDisplayName — fetches the human-readable display name for the
    // authenticated user from Nextcloud's OCS API.
    //
    // WHY fetch after login rather than using the loginName directly:
    //   Login Flow v2 only returns loginName (the account UID) and appPassword.
    //   The display name is a separate field in Nextcloud's user record and must
    //   be retrieved via /ocs/v2.php/cloud/user using the new app credentials.
    function fetchDisplayName(username, appPassword) {
        return fetch(nextcloudBaseUrl + '/ocs/v2.php/cloud/user?format=json', {
            headers: {
                'Authorization': 'Basic ' + btoa(username + ':' + appPassword),
                'OCS-APIRequest': 'true'
            }
        })
        .then(function(r) { return r.json(); })
        .then(function(data) {
            return (data.ocs && data.ocs.data && data.ocs.data.displayname)
                ? data.ocs.data.displayname
                : username;
        })
        .catch(function() { return username; });
    }

    // Login button starts the Login Flow v2 popup.
    loginBtn.addEventListener('click', function() {
        loginBtn.disabled = true;
        loginBtn.innerHTML = 'Opening login&hellip;';
        setChecking();

        openNextcloudLoginPopup(nextcloudBaseUrl).then(function(creds) {
            // Fetch the display name before confirming so the banner shows the
            // human-readable name rather than the raw account UID.
            fetchDisplayName(creds.username, creds.appPassword).then(function(displayName) {
                confirmLogin(creds.username, creds.appPassword, displayName);
            });
        }).catch(function(err) {
            // Re-enable the button so the user can try again without reopening the dialog.
            loginBtn.disabled = false;
            loginBtn.innerHTML = 'Sign in';
            setLoggedOut(err.message);
        });
    });

    // On banner creation, restore from cache if credentials exist from a previous
    // dialog in this browser session — no popup required. Otherwise show the
    // Connect button so the user can authenticate for the first time.
    if (_nextcloudSessionCache.username && _nextcloudSessionCache.password) {
        confirmLogin(
            _nextcloudSessionCache.username,
            _nextcloudSessionCache.password,
            _nextcloudSessionCache.displayName
        );
    } else {
        setLoggedOut(null); // shows the standard "not signed in" message with top-bar reference
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
