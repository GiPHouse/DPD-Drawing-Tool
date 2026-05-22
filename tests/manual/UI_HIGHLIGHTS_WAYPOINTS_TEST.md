# UI Highlights & Waypoints Test Plan (Task #193)

## Test 1 – Highlight pointer animation appears on activation

**Action:**
Load the DPD tool with the full stack (`bash start.sh`).
Add a node to the canvas that triggers a DPD violation.
In the right-side DPD Console, click the **Highlights** toggle button to activate highlights.

**Expected Result:**
- An animated pointer image rises up from the bottom of the screen toward the Highlights button.
- The pointer rotates from ~60° to 0° while rising.
- The pointer holds for roughly 1.8 seconds, then slides back down and fades out.
- Only one pointer is visible at a time (re-clicking does not stack multiple pointers).
- No console errors.

**Actual Result:**
- first load is indicating its presence, after it points to the button

Status: <span style="color: green">PASSED</span>

---

## Test 2 – DPD Console expands to full height when highlights are active

**Action:**
With a violation present on the canvas, activate the Highlights toggle in the DPD Console.
Observe the right-side panel layout.

**Expected Result:**
- The DPD Console section expands to fill 100% of the right panel height.
- The Properties / Format section collapses to 0% (hidden).
- No layout overflow or visual glitches.
- No console errors.

**Actual Result:**
- The DPD Console section expands to fill 100% of the right panel height.
- The Properties / Format section collapses to 0% (hidden).
- No layout overflow or visual glitches.
- No console errors.

Status: <span style="color: green">PASSED</span>

---

## Test 3 – Right panel restores to 50/50 split when highlights are deactivated

**Action:**
Activate highlights (console expands to 100%).
Click the **Highlights** button again to deactivate.

**Expected Result:**
- The DPD Console section returns to 50% height.
- The Properties / Format section reappears at 50% height.
- The layout is visually balanced.
- No console errors.

**Actual Result:**
-
-

Status: <span style="color: green">PASSED</span>

---

## Test 4 – Default right panel split is 50/50

**Action:**
Load the DPD tool.
Without activating highlights, observe the right panel default layout.

**Expected Result:**
- The Properties / Format section occupies approximately 50% of the right panel height.
- The DPD Console section occupies approximately 50% of the right panel height.
- No console errors.

**Actual Result:**
- The Properties / Format section occupies approximately 50% of the right panel height.
- The DPD Console section occupies approximately 50% of the right panel height.
- No console errors.

Status: <span style="color: green">PASSED</span>

---

## Test 5 – Esc key deactivates highlights

**Action:**
Activate highlights via the **Highlights** toggle.
While highlights are active, press the `Escape` key on the keyboard.

**Expected Result:**
- Highlights are deactivated (highlights are removed from the canvas).
- The right panel returns to the 50/50 split layout.
- The warning banner disappears.
- No console errors.

**Actual Result:**
- Highlights are deactivated (highlights are removed from the canvas).
- The right panel returns to the 50/50 split layout.
- The warning banner disappears.
- No console errors.

Status: <span style="color: green">PASSED</span>

---

## Test 6 – Esc key does nothing when highlights are inactive

**Action:**
Ensure highlights are not active.
Press the `Escape` key.

**Expected Result:**
- No change to the canvas or panel layout.
- No console errors or unexpected behaviour.

**Actual Result:**
- No change to the canvas or panel layout.
- No console errors or unexpected behaviour.

Status: <span style="color: green">PASSED</span>

---

## Test 7 – Warning banner shows Esc instruction when highlights are active

**Action:**
Activate highlights.
Observe the warning banner that appears at the top of the canvas.

**Expected Result:**
- The banner reads: `⚠ Diagram editing is locked while Highlights are active.`
- A secondary line beneath it reads: `Press Esc or click Highlights to disable`.
- The `Esc` key label is visually styled (dark background, green text).
- No console errors.

**Actual Result:**
- The banner reads: `⚠ Diagram editing is locked while Highlights are active.`
- A secondary line beneath it reads: `Press Esc or click Highlights to disable`.
- The `Esc` key label is visually styled (dark background, green text).
- No console errors.

Status: <span style="color: green">PASSED</span>

---

## Test 8 – clearWaypoints removed from Edit menu

**Action:**
Open the **Edit** menu from the top menu bar.
Navigate to the submenu that previously contained `clearWaypoints` (Edit → select-all area).

**Expected Result:**
- The `Clear Waypoints` option is not present anywhere in the Edit menu.
- All other Edit menu items (group, ungroup, remove from group, autosize, etc.) remain functional.
- No console errors.

**Actual Result:**
- The `Clear Waypoints` option is not present anywhere in the Edit menu.
- All other Edit menu items (group, ungroup, remove from group, autosize, etc.) remain functional.
- No console errors.

Status: <span style="color: green">PASSED</span>

---

## Test 9 – addWaypoint / removeWaypoint removed from edge context menu

**Action:**
Draw an edge between two nodes on the canvas.
Right-click on the edge to open the context menu.

**Expected Result:**
- Neither `Add Waypoint` nor `Remove Waypoint` appears in the context menu.
- The context menu shows other relevant edge options without errors.
- No console errors.

**Actual Result:**
- Neither `Add Waypoint` nor `Remove Waypoint` appears in the context menu.
- The context menu shows other relevant edge options without errors.
- No console errors.

Status: <span style="color: green">PASSED</span>

---

## Test 10 – clearWaypoints removed from edge right-click context menu

**Action:**
Draw an edge with at least one waypoint on the canvas.
Right-click on the edge.

**Expected Result:**
- `Clear Waypoints` is not present in the context menu.
- No console errors.

**Actual Result:**
- `Clear Waypoints` is not present in the context menu.
- No console errors.


Status: <span style="color: green">PASSED</span>

---

## Test 11 – Repeated highlight toggling stability

**Action:**
Activate and deactivate highlights at least five times in quick succession using both the button and the `Esc` key.

**Expected Result:**
- The panel layout correctly toggles between 100% console and 50/50 split each time.
- No duplicate pointer animations are stacked on screen.
- No console errors or layout corruption after repeated toggling.

**Actual Result:**
- The panel layout correctly toggles between 100% console and 50/50 split each time.
- No duplicate pointer animations are stacked on screen.
- No console errors or layout corruption after repeated toggling.


Status: <span style="color: green">PASSED</span>

---

## Test 12 – Unit Tests local

**Action:**
run unit tests (part of github actions) locally first

**Expected Result:**
- pass the unit tests

**Actual Result:**
- Passed

Status: <span style="color: green">PASSED</span>