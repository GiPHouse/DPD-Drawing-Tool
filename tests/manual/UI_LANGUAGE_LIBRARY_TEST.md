# UI Language & Library — Manual Test Plan


- **Task #195** — Drop down DPD library by default
- **Task #190** — Keep English language only

**Status: ALL TESTS PASSED**

---

## Task #195 — DPD library open by default

### 1 — Library is expanded with shapes on first load

| Step | Action |
|---|---|
| 1 | Open the app in a fresh window |
| 2 | Look at the **left shapes sidebar** |

**Expected:** The **DPDS** palette is **expanded** (arrow pointing down) and its
shapes are visible immediately.

**Pass condition:** Shapes are rendered inside the open DPDS palette.

**Result: PASSED**

---

### 2 — Collapse and re-expand still works

| Step | Action |
|---|---|
| 1 | Click the **DPDS** palette title to collapse it |
| 2 | Click it again to re-expand |

**Expected:**
- Collapse → shapes hide, arrow points right.
- Re-expand → the same shapes reappear, arrow points down.

**Pass condition:** Shapes survive a collapse/expand cycle.

**Result: PASSED**

---

### 3 — Other palettes unaffected

| Step | Action |
|---|---|
| 1 | Scroll the sidebar; inspect **General**, **Basic**, **Misc** |

**Expected:** They behave as before.

**Result: PASSED**

---

## Task #190 — English only, no language selector

### 1 — Language menu is gone

| Step | Action |
|---|---|
| 1 | Open the **Extras** menu in the top menu bar |

**Expected:** There is **no "Language"** submenu in the Extras menu.

**Pass condition:** The language selector cannot be reached anywhere in the UI.

**Result: PASSED**

---

### 2 — UI is English

| Step | Action |
|---|---|
| 1 | Scan the menus, toolbar, and dialogs |

**Expected:** All UI text is in English.

**Result: PASSED**

---