# DPD Plugin Demo  Test Report

## Test 1 – Plugin Initialization

**Action:**
Load diagrams.net with the DPD plugin enabled.

**Expected Result:**
- Alert appears once.
- Console log: `DPD Plugin Loaded`
- No console errors.

**Actual Result:**
- Alert displayed.
- Console log displayed.
- No errors.

Status: PASS

---

## Test 2 – Vertex Creation (From Sidebar)

**Action:**
Click a shape in the sidebar and place it on the canvas.

**Expected Result:**
- One `Vertex added` log.
- One `Vertex moved` log.
- No duplicate logs.
- No resize log.

**Explanation:**
When inserting from the sidebar:
1. The vertex is added to the model.
2. Its geometry is updated to its drop position.
This produces both:
- `Vertex added`
- `Vertex moved`

This behavior is expected in diagrams.net.

**Actual Result:**
- Exactly one `Vertex added`
- Exactly one `Vertex moved`
- No extra logs

Status: PASS

---

## Test 3 – Vertex Movement

**Action:**
Move an existing vertex to a new position.

**Expected Result:**
- One `Vertex moved`
- No `Vertex added`
- No `Vertex resized`

**Actual Result:**
- Exactly one move log
- Suggestion warning:

`app.min.js:14623 Canvas2D: Multiple readback operations using getImageData are faster with the willReadFrequently attribute set to true. See: https://html.spec.whatwg.org/multipage/canvas.html#concept-canvas-will-read-frequently`



Status: PASS

---

## Test 4 – Vertex Resize

**Action:**
Resize an existing vertex.

**Expected Result:**
- One `Vertex resized`
- No `Vertex moved`

**Actual Result:**
- Exactly one resize log
- No false logs

Status: PASS

---

## Test 5 – Vertex Deletion

**Action:**
Delete a vertex.

**Expected Result:**
- One `Vertex removed`

**Actual Result:**
- Exactly one removal log

Status: PASS

---

## Test 6 – Valid Edge Creation

**Action:**
Connect Vertex A → Vertex B.

**Expected Result:**
- One `Connection created`
- No duplicate logs
- No phantom logs

**Actual Result:**
- Exactly one valid connection log
- No duplicates

Status: PASS

---

## Test 7 – Invalid Edge Attempt

**Action:**
Drag a connection into empty space and release without connecting.

**Expected Result:**
- No `Connection created` log.

**Actual Result:**
- No connection log produced.

Status: PASS

---

## Test 8 – Undo / Redo Validation

**Action:**
1. Add vertex
2. Undo
3. Redo

**Expected Result:**
- Logs reflect actual structural changes.
- No duplicates.
- No console errors.

**Actual Result:**
- Logs correctly reflect model state changes.
- No duplicates.
- No errors.

Status: PASS

---

# Observation

Creating a shape from the sidebar triggers:

- `Vertex added`
- `Vertex moved`

This is normal because diagrams.net:
1. Inserts the vertex
2. Then updates its geometry