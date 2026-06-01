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

## Test 4 – Sign out dropdown opens and closes
 
**Action:**
1. Log in
2. Click on the username chip in the top-right
3. Observe the dropdown
4. Click anywhere outside the dropdown

**Expected Result:**
- Dropdown appears below the chip containing a "Sign out" button
- Clicking outside closes the dropdown

**Actual Result:**
 - Logging in works as expected
 - Drop down appears and looks 
Status: PASS

## Test 5 – Sign out dropdown repositions after window resize
 
**Action:**
1. Log in
2. Click on the username chip to open the dropdown
3. Resize the browser window (drag it narrower or wider)
4. Observe the position of the dropdown

**Expected Result:**
- The dropdown stays anchored below the username chip at all times
- The dropdown does not drift away from the chip or get stranded mid-screen

**Actual Result:**
 - dropdown stays under the username at all times, even when resizing the window

Status: PASS

## Test 6 – Sign out dropdown does not appear when not logged in
 
**Action:**
1. Open draw.io without logging in (or after a logout)
2. Observe the top-right area of the toolbar

**Expected Result:**
- No username chip or sign out dropdown is visible
- A login prompt or button is shown instead

**Actual Result:**
- No dropdown is seen when not loggin in, just the sign in button
 
Status: PASS

## Test 7 – Session memory is cleared after logout
 
**Action:**
1. Log in as a user
2. Open the browser DevTools console and run:
   ```
   window._nextcloudSessionCache
   ```
   Confirm `username` and `password` fields are populated
3. Click sign out
4. On the GoAuthentik login page, re-open DevTools console and run the same command

**Expected Result:**
- Before logout: `username` and `password` fields contain values
- After logout (on the redirect target page): all fields are `null`

**Actual Result:**
- when logged out, the fields are set to null, when logged in, the fields are populated.
 
Status: PASS
 