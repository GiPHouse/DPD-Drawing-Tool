# Version Control UI and functionality test

## Test 1 – Check if version control activates correctly

**Action:**
Load diagrams.net with the DPD plugin enabled.
Place an object from the library into the editor and move it to the right.
Open the File menu, authenticate if needed, and save the file as `test1.drawio`.
Move the object to the left.
Save the file again with the same name.
Open the File menu and choose `Version History`.
Check that the version list appears and select each version to verify the preview updates.

**Expected Result:**
- The Version History dialog shows 2 version entries for `test1.drawio`.
- The file name `test1.drawio` is shown in the Version History dialog header.
- The older version preview shows the object on the right.
- The newer version preview shows the object on the left.
- No console errors.

**Actual Result:**
- 
- 

Status:  <span style="color: green">PASS</span>

---

### Test 2 – Unsaved file / save-first flow
**Action:**
Open a new diagram and do not save it to Nextcloud.
Open the File menu and choose `Version History`.

**Expected Result:**
- A friendly message appears stating the file must be saved first.
- A button is available to save the diagram to Nextcloud.
- The dialog does not crash or show raw errors.

---

### Test 3 – First save only / no historical versions
**Action:**
Save a new file once as `test2.drawio`.
Open the File menu and choose `Version History`.

**Expected Result:**
- The dialog shows a message that no prior versions exist yet.
- The message explains Nextcloud starts keeping versions after the first overwrite.
- No console errors.

---

### Test 4 – Preview switching between versions
**Action:**
Save a file twice with two different visual states.
Open `Version History`.
Click the newer version, then click the older version.

**Expected Result:**
- The preview updates when each version is selected.
- The dialog shows a loading state while fetching the preview.
- The older and newer previews match the correct saved states.

---

### Test 5 – Restore version
**Action:**
From `Version History`, select an older version and click `Restore this version`.
Confirm the restore prompt.

**Expected Result:**
- The restore confirmation appears.
- The editor reloads the restored content.
- The file name remains the same.
- No console errors.
- Optionally, a new version entry is created after restore and save.

---

### Test 6 – Login / auth fallback
**Action:**
Open `Version History` when not signed in to Nextcloud.
Authenticate through the dialog.

**Expected Result:**
- The dialog shows the session/login banner first.
- After login, it loads the version list without reopening the dialog.
- No console errors.

---

### Test 7 – Non-`.drawio` file handling
**Action:**
Open a file in the editor that is not saved as `.drawio` (if possible).
Open `Version History`.

**Expected Result:**
- A message is shown saying only `.drawio` files are supported for version history.
- No console errors.

---

### Test 8 – Error handling
**Action:**
Simulate a network/auth failure while loading versions or preview content.
Open `Version History`.

**Expected Result:**
- The dialog shows a readable error message.
- The UI does not freeze or crash.
- No raw stack traces are visible to the user.

