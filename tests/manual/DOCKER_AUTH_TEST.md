# Docker Deployment & Goauthentik Manual Test Report

---

## Test 1 – Container Starts Successfully

**Action:**
Run the single-container image:
```
docker run -d \
  -p 80:80 -p 443:443 -p 5443:5443 \
  -v dpd_data:/data \
  -e MYSQL_PASSWORD=secret \
  -e NEXTCLOUD_ADMIN_PASSWORD=secret \
  dpd-app:latest
```

**Expected Result:**
- Container starts and stays running.
- `docker logs <container>` shows no crash errors.

**Actual Result:**

Status: PASSED

---

## Test 2 – Nextcloud Loads

**Action:**
Open `https://localhost` in the browser.

**Expected Result:**
- Nextcloud login page loads.
- No 502 or 503 error.

**Actual Result:**

Status: PASSED

---

## Test 3 – Draw.io Loads

**Action:**
Open `https://localhost:5443` in the browser.

**Expected Result:**
- Draw.io interface loads correctly.
- No blank page or connection refused error.

**Actual Result:**

Status: PASSED

---

## Test 4 – Goauthentik SSO Login

**Action:**
Open `https://localhost` and enter valid Goauthentik credentials when redirected.

**Expected Result:**
- Nextcloud redirects to the Goauthentik login page automatically.
- After logging in, user is redirected back and Nextcloud dashboard loads.

**Actual Result:**

Status: PASSED

---

# Observations
