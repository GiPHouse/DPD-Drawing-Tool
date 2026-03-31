(async function runNextcloudInputEdgeCaseTests() {
  const originalFetch = window.fetch;
  const results = [];

  function ok(name) {
    results.push({ name, pass: true });
  }

  function fail(name, err) {
    results.push({ name, pass: false, err: String(err) });
  }

  function expect(cond, msg) {
    if (!cond) throw new Error(msg);
  }

  function expectEq(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(`${msg} | expected=${expected} actual=${actual}`);
    }
  }

  function makeResp(status, statusText, headersObj, bodyText) {
    const headers = new Headers(headersObj || {});
    return {
      ok: status >= 200 && status < 300,
      status,
      statusText: statusText || "",
      headers,
      text: async () => bodyText || ""
    };
  }

  try {
    // Test 1: Missing username should fail fast and never call fetch
    {
      const calls = [];
      window.fetch = async (url, opts) => {
        calls.push({ url, opts });
        return makeResp(500, "Unexpected");
      };

      const ctx = buildNextcloudWebdavContext("x.drawio", "https://localhost", "", "admin", "/");

      expect(ctx == null, "Expected null context when username is missing");
      expectEq(calls.length, 0, "Fetch should not be called for invalid context");
      ok("Missing username fails fast");
    }

    // Test 2: Username should be derived from DAV URL when username arg is empty
    {
      const ctx = buildNextcloudWebdavContext(
        "a.drawio",
        "https://localhost/remote.php/dav/files/admin/",
        "",
        "admin",
        "/"
      );

      expect(ctx != null, "Expected context from DAV URL username");
      expectEq(ctx.effectiveUsername, "admin", "Effective username mismatch");
      ok("Username derived from URL");
    }

    // Test 3: Filename and path are URL-encoded correctly
    {
      const ctx = buildNextcloudWebdavContext(
        "Test 1 #v2.drawio",
        "https://localhost/remote.php/dav/files/admin/",
        "admin",
        "admin",
        "Folder A/Sub#1"
      );

      expect(ctx != null, "Context should exist");
      expect(
        ctx.webdavUrl.indexOf("Folder%20A/Sub%231/Test%201%20%23v2.drawio") !== -1,
        "Expected encoded path/filename in WebDAV URL"
      );
      ok("Path and filename encoding");
    }

    // Test 4: Windows-style remotePath separators are normalized
    {
      const ctx = buildNextcloudWebdavContext(
        "file.drawio",
        "https://localhost/remote.php/dav/files/admin/",
        "admin",
        "admin",
        "folder\\nested\\"
      );

      expect(ctx != null, "Context should exist");
      expect(ctx.webdavUrl.indexOf("/folder/nested/file.drawio") !== -1, "Expected normalized slashes in URL");
      ok("Remote path normalization");
    }

    // Test 5: Directory listing only keeps .drawio entries
    {
      window.fetch = async () => makeResp(
        207,
        "Multi-Status",
        {},
        `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:">
  <d:response>
    <d:href>/remote.php/dav/files/admin/</d:href>
    <d:propstat><d:prop><d:resourcetype><d:collection/></d:resourcetype></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/admin/ok.drawio</d:href>
    <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
  </d:response>
  <d:response>
    <d:href>/remote.php/dav/files/admin/not-included.txt</d:href>
    <d:propstat><d:prop><d:resourcetype/></d:prop></d:propstat>
  </d:response>
</d:multistatus>`
      );

      const files = await listDrawIOFilesInNextcloud(
        "https://localhost/remote.php/dav/files/admin/",
        "admin",
        "admin",
        "/",
        false
      );

      expectEq(files.length, 1, "Only .drawio file should be returned");
      expectEq(files[0].name, "ok.drawio", "Wrong file returned");
      ok("List filters non-drawio files");
    }

    // Test 6: Delete returns false on 404 (file not found)
    {
      const calls = [];
      window.fetch = async (url, opts) => {
        calls.push({ url, opts });
        if (opts.method === "LOCK") return makeResp(501, "Not Implemented");
        if (opts.method === "DELETE") return makeResp(404, "Not Found");
        return makeResp(500, "Unexpected");
      };

      const out = await deleteFileInNextcloud(
        "https://localhost/remote.php/dav/files/admin/",
        "admin",
        "admin",
        "/",
        "missing.drawio"
      );

      expect(out === false, "Expected false when DELETE returns 404");
      expect(calls.some(c => c.opts.method === "DELETE"), "DELETE should be called");
      ok("Delete returns false on 404");
    }

    // Test 7: Delete handles fetch TypeError and returns false
    {
      window.fetch = async () => {
        throw new TypeError("Failed to fetch");
      };

      const out = await deleteFileInNextcloud(
        "https://localhost/remote.php/dav/files/admin/",
        "admin",
        "admin",
        "/",
        "any.drawio"
      );

      expect(out === false, "Expected false for network failure");
      ok("Delete handles network TypeError");
    }
  } catch (e) {
    fail("Unhandled test runner error", e);
  } finally {
    window.fetch = originalFetch;
  }

  console.table(results);
  const failed = results.filter(r => !r.pass);
  if (failed.length) {
    console.error("Some tests failed", failed);
  } else {
    console.log("All input/edge-case tests passed");
  }
})();