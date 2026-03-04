/* 

+--------------------------------------------------------+
| This file contains modified code by SE team,           |
| refer to keywords: 'NOLAI'                             |
|                                                        |
+--------------------------------------------------------+

*/
// Build basic authentication header and returns shared request context (url, path, headers) for Nextcloud WebDAV function calls.
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

    // Set to true when Nextcloud session cookies are required.
    // Leave false for Basic-auth-only flow to reduce CORS complexity.
    const useCookieSession = false;
    const requestBase = {
        mode: 'cors',
        credentials: useCookieSession ? 'include' : 'omit',
    };
    const authHeader = `Basic ${btoa(`${effectiveUsername}:${password}`)}`;

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

// Uses base context from buildNextcloudWebdavBaseContext and adds final WebDAV URL for the specific file.
// Returns null if base context can't be built. Otherwise returns object with auth header, request options, and full WebDAV URL for the file.
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
                'Authorization': authHeader,
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
            'Authorization': authHeader,
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
                'Authorization': webdavContext.authHeader,
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
                    'Authorization': context.authHeader,
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