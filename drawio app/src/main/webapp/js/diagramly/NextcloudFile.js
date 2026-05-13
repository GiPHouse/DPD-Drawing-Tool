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

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 148 (Smart Save) ======
//
// _nolaiCurrentNextcloudFile — tracks which Nextcloud-resident file the editor
// is currently bound to. Set on Save success / My Files load / Rename success /
// Version restore. Read by the Save action's quick path so that ⌘+S can save
// silently to the same Nextcloud path without re-prompting for a filename.
//
// Structure: { filename: string, remotePath: string } | null
//   filename   — the full filename including the '.drawio' extension
//   remotePath — DAV-relative folder; '/' means the user's DAV root.
//
// WHY module-level (not stored on the LocalFile instance):
//   draw.io constructs new LocalFile objects on every load (My Files reload,
//   Version restore replaces the live file with a fresh LocalFile, etc.).
//   Storing the binding on the instance would silently lose it across those
//   transitions and the next ⌘+S would regress to a "Save As" prompt.
//   Using a module variable keeps the user's mental model — "I am currently
//   editing <this Nextcloud file>" — stable across draw.io's internal
//   re-construction of file objects.
//
// WHY in-memory rather than persisted:
//   Same reasoning as _nextcloudSessionCache: this is session state that
//   should reset on browser reload. Persisting could surprise users who
//   open the app and find it bound to a file they no longer expect.
// ====== end of changes by SE ======
var _nolaiCurrentNextcloudFile = null;

// nolaiSetCurrentNextcloudFile — records the Nextcloud filename + remotePath
// the editor is now bound to. Pass null/empty filename to clear.
function nolaiSetCurrentNextcloudFile(filename, remotePath) {
    if (!filename) {
        _nolaiCurrentNextcloudFile = null;
        return;
    }
    _nolaiCurrentNextcloudFile = {
        filename: filename,
        remotePath: remotePath || '/',
    };
}

function nolaiGetCurrentNextcloudFile() {
    return _nolaiCurrentNextcloudFile;
}

function nolaiClearCurrentNextcloudFile() {
    _nolaiCurrentNextcloudFile = null;
}

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
// ====== NOLAI - {- Backend -} /Sprint 4/ Task 192 — first-login retry fix ======
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
// WHY one automatic retry when the popup closes without credentials:
//   On the very first OIDC login, Nextcloud must provision the user account
//   (create their record in the database) before the Login Flow v2 grant step
//   can succeed. If the OIDC redirect lands on /login/v2/grant before
//   provisioning finishes, the server finds user= empty and the state token
//   check fails — showing "Access denied: State token does not match" and
//   closing the popup.
//
//   Critically, the OIDC session IS fully established by this point — the
//   user authenticated successfully with Authentik. So starting a new Login
//   Flow v2 immediately after the failed popup closes will open a second popup
//   that Nextcloud redirects straight through (no password re-entry) and the
//   poll resolves within seconds.
//
//   We allow exactly one automatic retry (MAX_RETRIES = 1) with a short delay
//   to give Nextcloud time to finish provisioning. After that, any further
//   popup-close is treated as a deliberate user cancellation.
//
// Returns a Promise resolving to { username, appPassword } on success,
// or rejecting if the popup is blocked or the user cancels after retries.
// ====== end of changes by SE ======
function openNextcloudLoginPopup(nextcloudBaseUrl) {
    var MAX_RETRIES = 1;
    var POLL_MS     = 2000;
    // Delay before the automatic retry — gives Nextcloud time to finish
    // provisioning the account that was created during the first OIDC flow.
    var RETRY_DELAY_MS = 1500;

    return new Promise(function(resolve, reject) {

        function attemptLogin(retriesLeft) {
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

                // Guard against a race where the poll resolves at the same tick
                // the popup-close check fires — only one outcome should win.
                var settled = false;

                var poll = setInterval(function() {

                    // If the user closed the popup before the poll resolved:
                    if (popup.closed) {
                        clearInterval(poll);
                        if (settled) { return; }
                        settled = true;

                        if (retriesLeft > 0) {
                            // Automatic retry — OIDC session is established, a new
                            // Login Flow v2 will complete without a password prompt.
                            console.warn(
                                '[NOLAI] Login popup closed without credentials — ' +
                                'retrying automatically (' + retriesLeft + ' attempt(s) left).'
                            );
                            setTimeout(function() { attemptLogin(retriesLeft - 1); }, RETRY_DELAY_MS);
                        } else {
                            reject(new Error('Login was cancelled.'));
                        }
                        return;
                    }

                    // Poll the Login Flow v2 endpoint — null means still pending.
                    pollNextcloudLoginFlowV2(flow.pollEndpoint, flow.pollToken).then(function(creds) {
                        if (creds) {
                            if (settled) { return; }
                            settled = true;
                            clearInterval(poll);
                            try { popup.close(); } catch (e) { /* ignore if already closed */ }
                            resolve({ username: creds.loginName, appPassword: creds.appPassword });
                        }
                        // null means the user has not completed login yet — keep polling.
                    }).catch(function(err) {
                        if (settled) { return; }
                        settled = true;
                        clearInterval(poll);
                        try { popup.close(); } catch (e) { /* ignore */ }
                        reject(err);
                    });

                }, POLL_MS);

            }).catch(function(err) {
                reject(new Error('Could not start login flow: ' + err.message));
            });
        }

        attemptLogin(MAX_RETRIES);
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
    //
    // Clicking the chip opens a small dropdown with the user's display name and
    // a "Sign out" button that clears the session cache and resets to the
    // sign-in state.  A single document click listener dismisses the dropdown
    // when the user clicks anywhere else.
    // ====== NOLAI - {- Frontend -} /Sprint 4/ Task 191 ======
    function showUserChip(username, appPassword, displayName) {
        _chipState.mode        = 'signed-in';
        _chipState.username    = username;
        _chipState.appPassword = appPassword;
        _chipState.displayName = displayName;

        container.innerHTML = '';
        var dark = _nolaiIsDark();

        var chip = document.createElement('div');
        chip.title = 'Signed in as ' + (displayName || username) + ' — click to sign out';
        chip.style.cssText = [
            'display:inline-flex',
            'align-items:center',
            'gap:7px',
            'padding:3px 11px 3px 3px',
            'background:' + (dark ? 'rgba(0,190,183,0.18)' : 'rgba(0,143,137,0.10)'),
            'border:1px solid ' + (dark ? 'rgba(0,190,183,0.40)' : 'rgba(0,143,137,0.30)'),
            'border-radius:16px',
            'font-size:12px',
            'font-family:Helvetica,Arial,sans-serif',
            'max-width:220px',
            'white-space:nowrap',
            'overflow:hidden',
            'cursor:pointer',
            'user-select:none',
            'position:relative',
        ].join(';');

        chip.addEventListener('mouseover', function() { chip.style.opacity = '0.85'; });
        chip.addEventListener('mouseout',  function() { chip.style.opacity = '1'; });

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

        fetchAvatar(username, appPassword).then(function(url) {
            avatarImg.src = url;
        }).catch(function() { /* keep initials */ });

        var nameEl = document.createElement('span');
        nameEl.textContent = displayName || username;
        nameEl.style.cssText = [
            'overflow:hidden',
            'text-overflow:ellipsis',
            'font-weight:500',
            'color:' + (dark ? '#e8e8e8' : '#111'),
            'flex:1',
            'min-width:0',
        ].join(';');

        chip.appendChild(avatarImg);
        chip.appendChild(nameEl);
        container.appendChild(chip);

        // ---- Dropdown menu ----
        // showDropdown — builds and positions a small card below the chip
        // containing the full display name and a Sign out button.
        // WHY build on each click rather than toggling: keeps the DOM clean and
        // ensures dark-mode colours are always fresh.
        var dropdown = null;

        function removeDropdown() {
            if (dropdown && dropdown.parentNode) { dropdown.parentNode.removeChild(dropdown); }
            dropdown = null;
            document.removeEventListener('click', onDocClick, true);
        }

        function onDocClick(evt) {
            // Dismiss if the click is outside the chip
            if (!chip.contains(evt.target)) { removeDropdown(); }
        }

        function showDropdown() {
            if (dropdown) { removeDropdown(); return; } // toggle off

            var darkNow = _nolaiIsDark();
            dropdown = document.createElement('div');
            dropdown.style.cssText = [
                'position:fixed',
                'z-index:99999',
                'background:' + (darkNow ? '#2a2a2a' : '#fff'),
                'border:1px solid ' + (darkNow ? '#444' : '#ddd'),
                'border-radius:8px',
                'box-shadow:0 4px 16px rgba(0,0,0,0.18)',
                'padding:10px 0 6px',
                'min-width:190px',
                'font-family:Helvetica,Arial,sans-serif',
            ].join(';');

            // User info header
            var userRow = document.createElement('div');
            userRow.style.cssText = 'display:flex;align-items:center;gap:9px;padding:2px 14px 10px;border-bottom:1px solid ' + (darkNow ? '#3a3a3a' : '#eee') + ';';

            var dropAvatar = document.createElement('img');
            dropAvatar.src = avatarImg.src; // reuse already-loaded src
            dropAvatar.style.cssText = 'width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;';
            userRow.appendChild(dropAvatar);

            var userInfo = document.createElement('div');
            userInfo.style.cssText = 'min-width:0;';
            userInfo.innerHTML =
                '<div style="font-weight:600;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:' + (darkNow ? '#eee' : '#222') + ';">' + (displayName || username) + '</div>' +
                '<div style="font-size:11px;color:' + (darkNow ? '#888' : '#999') + ';overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Nextcloud</div>';
            userRow.appendChild(userInfo);
            dropdown.appendChild(userRow);

            // Sign out button
            var signOutBtn = document.createElement('button');
            signOutBtn.textContent = 'Sign out';
            signOutBtn.style.cssText = [
                'display:block',
                'width:100%',
                'text-align:left',
                'padding:8px 14px',
                'border:none',
                'background:transparent',
                'color:' + (darkNow ? '#ff6b6b' : '#c0392b'),
                'font-size:13px',
                'font-family:Helvetica,Arial,sans-serif',
                'cursor:pointer',
                'margin-top:4px',
            ].join(';');
            signOutBtn.addEventListener('mouseover', function() { signOutBtn.style.background = darkNow ? 'rgba(255,100,100,0.12)' : 'rgba(192,57,43,0.08)'; });
            signOutBtn.addEventListener('mouseout',  function() { signOutBtn.style.background = 'transparent'; });
            signOutBtn.addEventListener('click', function(evt) {
                evt.stopPropagation();
                removeDropdown();
                // ====== NOLAI - {- Backend -} /Sprint 4/ Task 191 ======
                // Clear session cache so subsequent actions require re-authentication.
                // WHY only clear the cache (not revoke the app password):
                //   Revoking would require an authenticated DELETE to /ocs/v2.php/core/apppassword,
                //   but the user may have used the same app password elsewhere. Clearing the
                //   local cache is sufficient to require a fresh login from this browser session.
                // ====== end of changes by SE ======
                _nextcloudSessionCache.username    = null;
                _nextcloudSessionCache.password    = null;
                _nextcloudSessionCache.baseUrl     = null;
                _nextcloudSessionCache.displayName = null;
                showSignInButton();
            });
            dropdown.appendChild(signOutBtn);

            // Position below the chip
            document.body.appendChild(dropdown);
            var rect = chip.getBoundingClientRect();
            dropdown.style.top  = (rect.bottom + 6) + 'px';
            dropdown.style.left = Math.max(4, rect.right - dropdown.offsetWidth) + 'px';

            // Dismiss on any outside click (capture phase so it fires before other handlers)
            setTimeout(function() {
                document.addEventListener('click', onDocClick, true);
            }, 0);
        }

        chip.addEventListener('click', function(evt) {
            evt.stopPropagation();
            showDropdown();
        });
    }
    // ====== end of changes by SE ======

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
// ====== NOLAI - {- Backend -} /Sprint 4/ Task 148 — rename ⇒ save fallback ======
// LocalFile.prototype.rename override — adds Nextcloud persistence to draw.io's in-memory rename.
//
// draw.io's default LocalFile.prototype.rename updates only the in-memory title; it has no
// knowledge of Nextcloud. This override wraps the original so the in-memory update still
// happens, then additionally performs a WebDAV MOVE if session credentials are cached.
//
// The override reads baseUrl/username/password from _nextcloudSessionCache so that it works
// without any extra wiring in Menus.js — the banner login flow already populates the cache.
//
// Sprint 4 addition — "rename also saves" behaviour:
//   When the user renames a brand-new diagram that has not yet been saved to Nextcloud, the
//   WebDAV MOVE source path doesn't exist on the server, so the server returns 404. Treating
//   that as an error is unhelpful — what the user actually wants in that flow is "give this
//   diagram a name and save it under that name". So when MOVE returns 404 we fall back to
//   saveDrawIOToNextcloudXML with the editor's current XML under newTitle. This makes the
//   rename dialog double as a "name & save" affordance for first-time saves.
//
// Assumptions:
//   - Files are always saved at the root of the user's DAV folder (remotePath = '/').
//   - _nextcloudSessionCache.baseUrl is set when the user connects via the session banner.
//   - The fallback save uses this.ui.getFileData(true), the same XML serialisation the Save
//     action uses — so the resulting Nextcloud file is byte-equivalent to a normal Save.
// ====== end of changes by SE ======
(function() {
    // Guard: LocalFile may not yet be defined if scripts load out of order.
    if (typeof LocalFile === 'undefined') { return; }

    var _originalRename = LocalFile.prototype.rename;

    LocalFile.prototype.rename = function(newTitle, success, error) {
        var oldTitle = this.title;
        var self = this;

        // Always apply the in-memory rename so draw.io's toolbar updates immediately.
        _originalRename.call(this, newTitle, null, null);

        var cache = _nextcloudSessionCache;
        var titleChanged = oldTitle && newTitle && oldTitle !== newTitle;

        // saveUnderNewName — fallback path: PUT the current diagram XML under newTitle.
        // Used when (a) MOVE returns 404 because the source doesn't exist on Nextcloud, or
        // (b) there was no oldTitle to MOVE from in the first place (truly first-time save).
        // Reads the live editor XML via this.ui.getFileData(true), exactly mirroring the
        // existing Save action, so the resulting file is identical to what Save would write.
        function saveUnderNewName(reasonLog) {
            // self.ui is set by DrawioFile's constructor; getFileData serialises the current
            // editor state to draw.io's XML format. This is the authoritative source of truth
            // for the diagram's content — using self.data would risk writing stale content
            // captured at file-load time before the user's edits.
            var xml = (self.ui && typeof self.ui.getFileData === 'function')
                ? self.ui.getFileData(true)
                : (typeof self.getData === 'function' ? self.getData() : null);

            if (xml == null) {
                console.error('NOLAI: rename-save fallback could not access editor XML (' + reasonLog + ')');
                if (typeof error === 'function') {
                    error(new Error('Could not read diagram contents to save.'));
                }
                return;
            }

            saveDrawIOToNextcloudXML(newTitle, xml, cache.baseUrl, cache.username, cache.password, '/')
                .then(function(saved) {
                    if (saved) {
                        updateNolaiFileTitle(newTitle);
                        // Bind the editor to the just-created Nextcloud file so the next
                        // ⌘+S is a silent save instead of another prompt.
                        nolaiSetCurrentNextcloudFile(newTitle, '/');
                        // Clear the modified flag — the editor's content is now in sync
                        // with what was just persisted.
                        if (self.ui && self.ui.editor) { self.ui.editor.modified = false; }
                        // Reflect in the editor's status line so the user sees the same
                        // confirmation they'd get from a manual Save.
                        if (self.ui && self.ui.editor && typeof self.ui.editor.setStatus === 'function') {
                            self.ui.editor.setStatus('Saved to Nextcloud as ' + newTitle);
                        }
                        if (typeof success === 'function') { success(); }
                    } else {
                        console.error('NOLAI: rename-save fallback PUT did not succeed (' + reasonLog + ')');
                        if (typeof error === 'function') {
                            error(new Error('Could not save under new name.'));
                        }
                    }
                })
                .catch(function(saveErr) {
                    console.error('NOLAI: rename-save fallback PUT threw (' + reasonLog + ')', saveErr);
                    if (typeof error === 'function') { error(saveErr); }
                });
        }

        if (cache.username && cache.password && cache.baseUrl && titleChanged) {
            // Try a real MOVE first — that is the correct operation for an existing file
            // because it preserves the Nextcloud fileid and version chain. Only fall back
            // to a PUT if the source didn't exist (404).
            renameFileInNextcloud(oldTitle, newTitle, cache.baseUrl, cache.username, cache.password, '/')
                .then(function() {
                    updateNolaiFileTitle(newTitle);
                    // The current-file binding now points at the new name on the server.
                    nolaiSetCurrentNextcloudFile(newTitle, '/');
                    if (typeof success === 'function') { success(); }
                })
                .catch(function(err) {
                    var msg = (err && err.message) ? err.message : '';
                    // /HTTP 404/ matches the message thrown by renameFileInNextcloud when
                    // the WebDAV MOVE returns 404. Tightly scoped — any other failure
                    // (auth, conflict, network) still surfaces as a real error.
                    if (/HTTP 404/i.test(msg)) {
                        console.warn('NOLAI: Source missing on Nextcloud — falling back to PUT save under new name.');
                        saveUnderNewName('MOVE 404');
                    } else {
                        console.error('NOLAI: Nextcloud rename (MOVE) failed', err);
                        if (typeof error === 'function') { error(err); }
                    }
                });
        } else if (cache.username && cache.password && cache.baseUrl && newTitle && !oldTitle) {
            // Edge case: no oldTitle at all (truly first-time naming). Skip the MOVE
            // attempt and go straight to a fresh PUT under newTitle.
            saveUnderNewName('no oldTitle');
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

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 148 (Version Control) ======
//
// Nextcloud Versions API helpers.
//
// WHY this exists alongside the existing native draw.io revision history path:
//   draw.io ships with a native RevisionDialog wired to ui.getRevisions(), which
//   plugins/nextcloud.js implements via remoteInvoke('getFileRevisions') — a
//   postMessage RPC that requires drawio to be embedded inside Nextcloud's
//   parent window. In our standalone NOLAI deployment drawio runs on its own
//   origin (https://localhost:5443) and talks to Nextcloud directly over WebDAV,
//   so the postMessage path has no listener and revision history is broken.
//
//   These helpers fill that gap by talking directly to Nextcloud's Versions
//   WebDAV endpoint, exactly the same way saveDrawIOToNextcloudXML and
//   listDrawIOFilesInNextcloud talk to the Files endpoint. Authentication
//   reuses the same _nextcloudSessionCache (Basic Auth via app password from
//   Login Flow v2) so no new login flow is needed.
//
// API SHAPE (Nextcloud 25+):
//   File metadata:   PROPFIND on /remote.php/dav/files/{user}/{path}/{file}
//                    requesting <oc:fileid/> — returns the numeric file id.
//   Version listing: PROPFIND on /remote.php/dav/versions/{user}/versions/{fileId}/
//                    with Depth:1 — each <d:response> is one version. The href
//                    last segment is the version's Unix-seconds timestamp.
//   Version content: GET on the version href — body is the historical file XML.
//   Restore:         MOVE on the version href with
//                    Destination: /remote.php/dav/versions/{user}/restore/target
//                    Nextcloud's DAV plugin recognises /restore/target as a
//                    marker that means "atomically copy this version's contents
//                    over the live file". This is the supported, idiomatic
//                    restore path — there is no separate REST endpoint.
//
// All helpers return Promises that resolve to the documented value, or reject
// with an Error containing a human-readable message. They rely on
// buildNextcloudWebdavBaseContext for auth + URL construction so they share
// the cookie/Basic-Auth strategy used everywhere else in this file.
// ====== end of changes by SE ======

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 148 (Version Control) ======
//
// getFileIdFromNextcloud(filename, nextcloudUrl, username, password, remotePath)
//
// Resolves the Nextcloud internal file id for a file. The file id is required
// by every other Versions endpoint — the Versions API is keyed by file id, not
// path, so that file moves/renames do not break the version chain.
//
// Implementation: PROPFIND on the file with body
//   <d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
//     <d:prop><oc:fileid/></d:prop>
//   </d:propfind>
// then parse the first <oc:fileid> element from the response.
//
// Returns a Promise resolving to the file id (string of digits) or null if the
// file does not exist on the server (404 or empty response). Any other error
// rejects so callers can surface useful messages.
// ====== end of changes by SE ======
function getFileIdFromNextcloud(filename, nextcloudUrl, username, password, remotePath) {
    var ctx = buildNextcloudWebdavContext(filename, nextcloudUrl, username, password, remotePath || '/');
    if (!ctx) {
        return Promise.reject(new Error('Could not build WebDAV context'));
    }

    var headers = {
        'Depth': '0',
        'Content-Type': 'application/xml; charset=utf-8',
    };
    if (ctx.authHeader) { headers['Authorization'] = ctx.authHeader; }

    // The oc: namespace is owncloud-derived and is what Nextcloud uses for fileid.
    var body =
        '<?xml version="1.0"?>' +
        '<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">' +
        '<d:prop><oc:fileid/></d:prop>' +
        '</d:propfind>';

    return fetch(ctx.webdavUrl, Object.assign({}, ctx.requestBase, {
        method: 'PROPFIND', headers: headers, body: body,
    })).then(function(resp) {
        // 404 = file not yet on Nextcloud → caller decides what to do (e.g. prompt save).
        if (resp.status === 404) { return null; }
        if (!resp.ok) {
            throw new Error('PROPFIND for fileid failed: HTTP ' + resp.status);
        }
        return resp.text();
    }).then(function(xmlText) {
        if (xmlText == null) { return null; }
        var parser = new DOMParser();
        var doc = parser.parseFromString(xmlText, 'application/xml');
        // Note: ownCloud namespace URI is used as-is by Nextcloud for backwards compat.
        var nodes = doc.getElementsByTagNameNS('http://owncloud.org/ns', 'fileid');
        if (nodes && nodes.length > 0 && nodes[0].textContent) {
            return nodes[0].textContent.trim();
        }
        return null;
    });
}

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 148 (Version Control) ======
//
// listFileVersionsInNextcloud(fileId, nextcloudUrl, username, password)
//
// Lists every server-side version of the file identified by fileId.
//
// WebDAV endpoint:
//   /remote.php/dav/versions/{user}/versions/{fileId}/
// PROPFIND Depth:1 returns the directory itself + one <response> per version.
//
// Version metadata returned:
//   versionId   — last segment of the version href (Unix seconds timestamp,
//                 also a stable identifier the user can refer to)
//   href        — absolute server-relative path used by GET / MOVE
//   absUrl      — fully qualified URL (origin + href), used directly by fetch
//   mtime       — JS milliseconds (parsed from <d:getlastmodified> RFC 1123)
//   size        — bytes (parsed from <d:getcontentlength>) or null
//   etag        — opaque etag string or null
//
// The current/live file is NOT returned by Nextcloud in this listing — only
// the *historical* versions appear. The caller renders the live file as a
// separate "Current" entry in the UI.
//
// Returns a Promise resolving to an array, sorted newest-first by mtime.
// ====== end of changes by SE ======
function listFileVersionsInNextcloud(fileId, nextcloudUrl, username, password) {
    if (!fileId) {
        return Promise.reject(new Error('Missing fileId — cannot list versions'));
    }

    // We deliberately use buildNextcloudWebdavBaseContext (NOT the per-file variant)
    // because the versions endpoint is not under /remote.php/dav/files/, so the
    // generic per-file URL builder would put us in the wrong place.
    var ctx = buildNextcloudWebdavBaseContext(nextcloudUrl, username, password, '/');
    if (!ctx) {
        return Promise.reject(new Error('Could not build WebDAV context'));
    }

    // /remote.php/dav/versions/{user}/versions/{fileId}/
    var versionsPath = '/remote.php/dav/versions/' + ctx.encodedUsername +
                       '/versions/' + encodeURIComponent(fileId) + '/';
    var versionsUrl = ctx.baseUrl + versionsPath;

    var headers = {
        'Depth': '1',
        'Content-Type': 'application/xml; charset=utf-8',
    };
    if (ctx.authHeader) { headers['Authorization'] = ctx.authHeader; }

    // Request the standard mtime/size/etag triple — sufficient to render
    // a meaningful list. Author info varies across Nextcloud versions and
    // is intentionally not requested to keep behaviour predictable.
    var body =
        '<?xml version="1.0"?>' +
        '<d:propfind xmlns:d="DAV:">' +
        '<d:prop>' +
        '<d:getlastmodified/>' +
        '<d:getcontentlength/>' +
        '<d:getetag/>' +
        '</d:prop>' +
        '</d:propfind>';

    return fetch(versionsUrl, Object.assign({}, ctx.requestBase, {
        method: 'PROPFIND', headers: headers, body: body,
    })).then(function(resp) {
        // 404 = no versions stored for this file (Nextcloud keeps versions only
        // after at least one overwrite; a brand-new file has zero versions).
        if (resp.status === 404) { return ''; }
        if (!resp.ok) {
            throw new Error('PROPFIND for versions failed: HTTP ' + resp.status);
        }
        return resp.text();
    }).then(function(xmlText) {
        var versions = [];
        if (!xmlText) { return versions; }

        var parser = new DOMParser();
        var doc = parser.parseFromString(xmlText, 'application/xml');
        var responses = doc.getElementsByTagNameNS('DAV:', 'response');

        for (var i = 0; i < responses.length; i++) {
            var rsp = responses[i];
            var hrefNode = rsp.getElementsByTagNameNS('DAV:', 'href')[0];
            if (!hrefNode || !hrefNode.textContent) { continue; }

            var href = hrefNode.textContent;
            // The directory itself appears as the first <response>; skip it.
            // It ends in "/versions/{fileId}/" while real versions end in a
            // numeric timestamp segment with no trailing slash.
            if (/\/versions\/[^/]+\/?$/.test(href) && /\/$/.test(href)) {
                continue;
            }

            // Last non-empty path segment is the version id (Unix seconds).
            var segments = href.split('/').filter(function(s) { return s.length > 0; });
            var versionId = segments[segments.length - 1];
            if (!versionId) { continue; }

            // Parse <d:getlastmodified> (RFC 1123 string) → ms since epoch.
            // Fall back to versionId * 1000 if Nextcloud omits the property.
            var mtime = null;
            var lmNodes = rsp.getElementsByTagNameNS('DAV:', 'getlastmodified');
            if (lmNodes && lmNodes.length > 0 && lmNodes[0].textContent) {
                var parsed = Date.parse(lmNodes[0].textContent);
                if (!isNaN(parsed)) { mtime = parsed; }
            }
            if (mtime == null) {
                var asNum = parseInt(versionId, 10);
                if (!isNaN(asNum)) { mtime = asNum * 1000; }
            }

            var size = null;
            var clNodes = rsp.getElementsByTagNameNS('DAV:', 'getcontentlength');
            if (clNodes && clNodes.length > 0 && clNodes[0].textContent) {
                var asInt = parseInt(clNodes[0].textContent, 10);
                if (!isNaN(asInt)) { size = asInt; }
            }

            var etag = null;
            var etagNodes = rsp.getElementsByTagNameNS('DAV:', 'getetag');
            if (etagNodes && etagNodes.length > 0 && etagNodes[0].textContent) {
                etag = etagNodes[0].textContent.replace(/^"|"$/g, '');
            }

            versions.push({
                versionId: versionId,
                href: href,
                absUrl: ctx.baseOrigin + href,
                mtime: mtime,
                size: size,
                etag: etag,
            });
        }

        // Sort newest-first so the list reads top-to-bottom from most recent.
        versions.sort(function(a, b) {
            return (b.mtime || 0) - (a.mtime || 0);
        });

        return versions;
    });
}

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 148 (Version Control) ======
//
// getVersionContentFromNextcloud(versionAbsUrl, username, password)
//
// Fetches the raw XML body of a single historical version. This is the same
// kind of content that getDrawIOFromNextcloudXML returns for the live file —
// a draw.io <mxfile> XML document — so the result can be fed straight into
// editorUi.fileLoaded(new LocalFile(...)) or used to populate a preview Graph.
//
// We construct the auth context from a base URL because the version URL is
// fully qualified and not under /remote.php/dav/files/.
// ====== end of changes by SE ======
function getVersionContentFromNextcloud(versionAbsUrl, nextcloudUrl, username, password) {
    if (!versionAbsUrl) {
        return Promise.reject(new Error('Missing version URL'));
    }
    var ctx = buildNextcloudWebdavBaseContext(nextcloudUrl, username, password, '/');
    if (!ctx) {
        return Promise.reject(new Error('Could not build WebDAV context'));
    }

    var headers = {};
    if (ctx.authHeader) { headers['Authorization'] = ctx.authHeader; }

    return fetch(versionAbsUrl, Object.assign({}, ctx.requestBase, {
        method: 'GET', headers: headers,
    })).then(function(resp) {
        if (!resp.ok) {
            throw new Error('GET version failed: HTTP ' + resp.status);
        }
        return resp.text();
    });
}

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 148 (Version Control) ======
//
// restoreVersionInNextcloud(versionAbsUrl, nextcloudUrl, username, password)
//
// Atomically rolls the live file back to a chosen historical version.
//
// Implementation: WebDAV MOVE on the version's absolute URL with the
// Destination header set to /remote.php/dav/versions/{user}/restore/target.
// Nextcloud's DAV plugin recognises that path as a virtual restore marker —
// the server overwrites the live file with the version's contents and then
// captures the *previous* live state as a new version (so a restore is itself
// reversible by performing another restore on the now-newest historical entry).
//
// WHY MOVE (and not COPY/PUT to the live file):
//   - MOVE is the documented Nextcloud restore mechanism; it preserves the
//     original mtime/etag chain and triggers the proper "version restored"
//     activity entry inside Nextcloud.
//   - PUT-ing the version contents to the live file would create an extra
//     intermediate version and lose the link to the original entry.
//
// Returns a Promise resolving to true on success or rejecting with an Error.
// ====== end of changes by SE ======
function restoreVersionInNextcloud(versionAbsUrl, nextcloudUrl, username, password) {
    if (!versionAbsUrl) {
        return Promise.reject(new Error('Missing version URL'));
    }
    var ctx = buildNextcloudWebdavBaseContext(nextcloudUrl, username, password, '/');
    if (!ctx) {
        return Promise.reject(new Error('Could not build WebDAV context'));
    }

    // Destination is the virtual restore-target path under the user's versions root.
    var destination = ctx.baseUrl +
        '/remote.php/dav/versions/' + ctx.encodedUsername + '/restore/target';

    var headers = {
        'Destination': destination,
        // Overwrite must be T (true) — we are explicitly replacing the live file.
        'Overwrite': 'T',
    };
    if (ctx.authHeader) { headers['Authorization'] = ctx.authHeader; }

    return fetch(versionAbsUrl, Object.assign({}, ctx.requestBase, {
        method: 'MOVE', headers: headers,
    })).then(function(resp) {
        // 201 Created or 204 No Content both indicate success in WebDAV semantics.
        if (resp.status === 201 || resp.status === 204) { return true; }
        throw new Error('Version restore (MOVE) failed: HTTP ' + resp.status);
    });
}

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 192 ======
//
// searchNextcloudUsers — searches for Nextcloud users by display name.
//
// Uses the OCS autocomplete endpoint, which is the same source Nextcloud's
// own sharing UI queries. It returns both the internal UID (needed for the
// Share API) and the human-readable display name (shown in the picker UI)
// in a single call — bridging the SHA-256 UID ↔ Authentik display name gap.
//
// Parameters:
//   query         {string} — partial display name or username to search for
//   nextcloudUrl  {string} — Nextcloud base URL, e.g. "https://localhost"
//   username      {string} — authenticated user's Nextcloud UID
//   password      {string} — app password from Login Flow v2
//
// Returns a Promise resolving to an array of { id, label } objects:
//   id    — the Nextcloud UID (SHA-256 hash) used in the Share API
//   label — the human-readable display name shown in the picker UI
// ====== end of changes by SE ======
function searchNextcloudUsers(query, nextcloudUrl, username, password) {
    var url = nextcloudUrl +
        '/ocs/v2.php/core/autocomplete/get' +
        '?search=' + encodeURIComponent(query) +
        '&shareTypes[]=0' +
        '&format=json';

    return fetch(url, {
        headers: {
            'Authorization': 'Basic ' + btoa(username + ':' + password),
            'OCS-APIRequest': 'true',
        },
        mode: 'cors',
        credentials: 'omit',
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        return (data.ocs && data.ocs.data) ? data.ocs.data : [];
    })
    .catch(function() { return []; });
}

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 192 ======
//
// shareFileWithUser — shares a Nextcloud file with another user via the OCS Share API.
//
// WHY permissions default to 3 (READ + UPDATE):
//   The goal is collaborative editing — the recipient should be able to save
//   changes back to the file. READ-only (1) would prevent saves.
//   We deliberately exclude CREATE/DELETE/SHARE (4/8/16) to limit scope.
//
// WHY path uses OCS format (not the WebDAV URL):
//   The OCS Share API takes a server-relative path from the user's files root,
//   not the full WebDAV URL. For a file at DAV root, this is just "/{filename}".
//   For a subfolder, it is "/{folder}/{filename}".
//
// Parameters:
//   filename      {string} — e.g. "MyDiagram.drawio"
//   targetUid     {string} — Nextcloud UID from searchNextcloudUsers()
//   nextcloudUrl  {string} — Nextcloud base URL
//   username      {string} — authenticated user's Nextcloud UID
//   password      {string} — app password
//   remotePath    {string} — subfolder, e.g. "/" for root
//   permissions   {number} — bitmask: 1=read, 2=update; default 3
//
// Returns a Promise resolving to the share object on success, or rejecting
// with an Error on failure.
// ====== end of changes by SE ======
function shareFileWithUser(filename, targetUid, nextcloudUrl, username, password, remotePath, permissions) {
    var perms = (permissions != null) ? permissions : 3; // READ + UPDATE

    // Build the OCS-relative path. Strips leading/trailing slashes from
    // remotePath so the join is always clean regardless of caller format.
    var folder = (remotePath || '/').replace(/^\/+|\/+$/g, '');
    var ocsPath = folder ? ('/' + folder + '/' + filename) : ('/' + filename);

    var body = [
        'path='      + encodeURIComponent(ocsPath),
        'shareType=0',                                // 0 = user share
        'shareWith=' + encodeURIComponent(targetUid),
        'permissions=' + perms,
    ].join('&');

    // WHY ?format=json on the URL:
    //   The OCS API defaults to XML when no format is specified. Every other OCS
    //   call in this file uses ?format=json; without it here the response body
    //   starts with "<?xml" and r.json() throws "Unexpected token '<'".
    return fetch(nextcloudUrl + '/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json', {
        method: 'POST',
        headers: {
            'Authorization':  'Basic ' + btoa(username + ':' + password),
            'OCS-APIRequest': 'true',
            'Content-Type':   'application/x-www-form-urlencoded',
        },
        mode: 'cors',
        credentials: 'omit',
        body: body,
    })
    .then(function(r) {
        if (!r.ok) {
            return r.json().then(function(err) {
                throw new Error(
                    (err.ocs && err.ocs.meta && err.ocs.meta.message)
                    || ('Share API failed: HTTP ' + r.status)
                );
            });
        }
        return r.json();
    })
    .then(function(data) {
        if (!data.ocs || !data.ocs.data) {
            throw new Error('Unexpected Share API response shape');
        }
        return data.ocs.data;
    });
}

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 191 ======
//
// getSharesForFile — fetches the list of user shares for a specific file via
// the OCS Share API. Used by the My Files dialog to show collaborator avatars
// next to each file in the list.
//
// WHY per-file rather than a single bulk call:
//   The OCS Share API offers no endpoint that returns all shares for all files
//   in one request — it must be queried per file path. Calls are fired in
//   parallel after the list renders so the UI appears instantly and avatars
//   load progressively without blocking the dialog.
//
// Parameters:
//   filename      {string} — e.g. "MyDiagram.drawio"
//   remotePath    {string} — subfolder, e.g. "/" for root
//   nextcloudUrl  {string} — Nextcloud base URL
//   username      {string} — authenticated user's Nextcloud UID
//   password      {string} — app password from Login Flow v2
//
// Returns a Promise resolving to an array of share objects. Each object has at
// minimum: share_type (0 = user), share_with (UID), share_with_displayname.
// Resolves to [] on any error so callers never need to catch.
// ====== end of changes by SE ======
function getSharesForFile(filename, remotePath, nextcloudUrl, username, password) {
    var folder = (remotePath || '/').replace(/^\/+|\/+$/g, '');
    var ocsPath = folder ? ('/' + folder + '/' + filename) : ('/' + filename);

    return fetch(
        nextcloudUrl + '/ocs/v2.php/apps/files_sharing/api/v1/shares' +
        '?path=' + encodeURIComponent(ocsPath) + '&format=json',
        {
            headers: {
                'Authorization':  'Basic ' + btoa(username + ':' + password),
                'OCS-APIRequest': 'true',
            },
            mode: 'cors',
            credentials: 'omit',
        }
    )
    .then(function(r) { return r.json(); })
    .then(function(data) {
        return (data.ocs && Array.isArray(data.ocs.data)) ? data.ocs.data : [];
    })
    .catch(function() { return []; });
}

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 192 ======
//
// createPublicLink — creates a Nextcloud public share link (shareType=3) for a
// .drawio file so the owner can distribute a read-only URL to external parties.
//
// Parameters:
//   filename     — bare filename, e.g. 'myDiagram.drawio'
//   remotePath   — folder path relative to the user's DAV root, e.g. '/' or '/subdir'
//   nextcloudUrl — bare origin, e.g. 'https://localhost'
//   username     — Nextcloud uid (the sha-256 hash used by user_oidc unique-uid)
//   password     — Nextcloud app password from Login Flow v2
//
// Returns a Promise that resolves to the share object from OCS (includes .url,
// .token, .id) or rejects with a descriptive Error.
// ====== end of changes by SE ======
function createPublicLink(filename, remotePath, nextcloudUrl, username, password) {
    var folder = (remotePath || '/').replace(/^\/+|\/+$/g, '');
    var ocsPath = folder ? ('/' + folder + '/' + filename) : ('/' + filename);

    var body = new URLSearchParams();
    body.append('path', ocsPath);
    body.append('shareType', '3'); // 3 = public link

    return fetch(
        nextcloudUrl + '/ocs/v2.php/apps/files_sharing/api/v1/shares?format=json',
        {
            method: 'POST',
            headers: {
                'Authorization':  'Basic ' + btoa(username + ':' + password),
                'OCS-APIRequest': 'true',
                'Content-Type':   'application/x-www-form-urlencoded',
            },
            body: body.toString(),
            mode: 'cors',
            credentials: 'omit',
        }
    )
    .then(function(r) { return r.json(); })
    .then(function(data) {
        if (!data.ocs || !data.ocs.data) {
            var msg = (data.ocs && data.ocs.meta && data.ocs.meta.message) || 'Unknown error';
            throw new Error('createPublicLink failed: ' + msg);
        }
        return data.ocs.data;
    });
}

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 192 ======
//
// removeShare — removes an existing Nextcloud share (any type) by its numeric
// share ID. Used by both the user-share list (×) and the public link toggle.
//
// Parameters:
//   shareId      — numeric share ID as returned by getSharesForFile / createPublicLink
//   nextcloudUrl — bare origin, e.g. 'https://localhost'
//   username     — Nextcloud uid
//   password     — Nextcloud app password
//
// Returns a Promise<void>; rejects on HTTP or OCS-level error.
// ====== end of changes by SE ======
function removeShare(shareId, nextcloudUrl, username, password) {
    return fetch(
        nextcloudUrl + '/ocs/v2.php/apps/files_sharing/api/v1/shares/' + encodeURIComponent(shareId) + '?format=json',
        {
            method: 'DELETE',
            headers: {
                'Authorization':  'Basic ' + btoa(username + ':' + password),
                'OCS-APIRequest': 'true',
            },
            mode: 'cors',
            credentials: 'omit',
        }
    )
    .then(function(r) { return r.json(); })
    .then(function(data) {
        var statusCode = data.ocs && data.ocs.meta && data.ocs.meta.statuscode;
        if (statusCode !== 100 && statusCode !== 200) {
            var msg = (data.ocs && data.ocs.meta && data.ocs.meta.message) || 'Unknown error';
            throw new Error('removeShare failed: ' + msg);
        }
    });
}

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 192 ======
//
// getSharesReceivedForFile — returns shares where the *current user* is the
// recipient (i.e. files shared WITH me from others). This populates the
// "Others with access" section in the Sharing tab — other users who have been
// granted access to a file by the owner, or who the owner received the file from.
//
// Parameters:
//   nextcloudUrl — bare origin, e.g. 'https://localhost'
//   username     — Nextcloud uid (the logged-in user, i.e. the share recipient)
//   password     — Nextcloud app password
//   filename     — bare filename to filter by (optional — pass null to get all)
//   remotePath   — folder path (optional — pass null to skip filter)
//
// Returns a Promise<share[]>; resolves to [] on error so the UI degrades
// gracefully even when the user has not been shared anything.
// ====== end of changes by SE ======
function getSharesReceivedForFile(nextcloudUrl, username, password, filename, remotePath) {
    var url = nextcloudUrl + '/ocs/v2.php/apps/files_sharing/api/v1/shares?shared_with_me=true&format=json';

    return fetch(url, {
        headers: {
            'Authorization':  'Basic ' + btoa(username + ':' + password),
            'OCS-APIRequest': 'true',
        },
        mode: 'cors',
        credentials: 'omit',
    })
    .then(function(r) { return r.json(); })
    .then(function(data) {
        var shares = (data.ocs && Array.isArray(data.ocs.data)) ? data.ocs.data : [];
        // Optionally filter to just the requested file.
        if (filename) {
            var folder = (remotePath || '/').replace(/^\/+|\/+$/g, '');
            var ocsPath = folder ? ('/' + folder + '/' + filename) : ('/' + filename);
            shares = shares.filter(function(s) { return s.path === ocsPath; });
        }
        return shares;
    })
    .catch(function() { return []; });
}

// ====== NOLAI - {- Backend -} /Sprint 4/ Task 192 ======
//
// updateSharePermissions — changes the permissions integer on an existing user
// share. Nextcloud permissions: 1=read, 2=update, 4=create, 8=delete, 16=share.
// For draw.io files the sensible presets are:
//   Read-only  : 1
//   Can edit   : 3  (read + update)
//
// Parameters:
//   shareId      — numeric share ID
//   permissions  — integer permission bitmask (1 or 3 for draw.io use cases)
//   nextcloudUrl — bare origin
//   username     — Nextcloud uid
//   password     — Nextcloud app password
//
// Returns a Promise<void>; rejects on error.
// ====== end of changes by SE ======
function updateSharePermissions(shareId, permissions, nextcloudUrl, username, password) {
    var body = new URLSearchParams();
    body.append('permissions', String(permissions));

    return fetch(
        nextcloudUrl + '/ocs/v2.php/apps/files_sharing/api/v1/shares/' + encodeURIComponent(shareId) + '?format=json',
        {
            method: 'PUT',
            headers: {
                'Authorization':  'Basic ' + btoa(username + ':' + password),
                'OCS-APIRequest': 'true',
                'Content-Type':   'application/x-www-form-urlencoded',
            },
            body: body.toString(),
            mode: 'cors',
            credentials: 'omit',
        }
    )
    .then(function(r) { return r.json(); })
    .then(function(data) {
        var statusCode = data.ocs && data.ocs.meta && data.ocs.meta.statuscode;
        if (statusCode !== 100 && statusCode !== 200) {
            var msg = (data.ocs && data.ocs.meta && data.ocs.meta.message) || 'Unknown error';
            throw new Error('updateSharePermissions failed: ' + msg);
        }
    });
}