## Test 1 – Normal logout

**Action:**
1. Click on username
2. Click sign out 

**Expected Result:**
- GoAuthentik credentials completly forgotten
- Redirected to goAuthentik login page
- Draw.io isn't logged in.

**Actual Result:**
- drawing tool is logged out
- GoAuthentik is logged out
- User is redirected to goAuthentik login page

Status: PASS

## Test 2 – Normal logout and logged in as second user

**Action:**
1. Click on username
2. Click sign out 
3. Login as different user

**Expected Result:**
- GoAuthentik credentials completly forgotten
- Redirected to goAuthentik login page where credentials of second user is put in
- Draw.io is logged in as the seconds user

**Actual Result:**
- drawing tool is logged in as second user
- GoAuthentik is logged in as second user

Status: PASS

## Test 3 – Logout, share, login

**Action:**
1. Create a file and save it
2. Logout
3. Login as second user
4. Logout
4. Login as first user and share the saved file
5. Logout
6. Login as second user and open shared file

**Expected Result:**
- Logging out logs out of GoAuthentik, then the user can log back in GoAuthentik
- Sharing works, permissions work and file isn't corrupted due to the logging in and out

**Actual Result:**
- Logging in and out worked as expected
- Sharing works, file wasn't corrupted.

Status: PASS