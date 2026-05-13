# UI customisation Logo and Shapes Test Report

## Test 1 – Load Custom Logo 

**Action:**
Load diagrams.net with the Customer logo in the left top corner.

**Expected Result:**
- Loaded logo in acceptable resolution
- No console errors.

**Actual Result:**
- Logo displayed.
- No errors.

Status:  <span style="color: green">PASS</span>

---

## Test 2 – Resizing Browser Window Horizontally

**Action:**
Resize Browser window on x-axis

**Expected Result:**
- Logo preserving its size
- Browser window not being able to be smaller than the borders of the Logo

**Explanation:**
When Resizing a window, the drawing board is resized while text size and logo on

This behavior is expected in draw.io/diagrams.net.

**Actual Result:**
- Logo preserved its size
- Not able to achieve smaller size once reached borders of the logo element.
- No logs

Status: <span style="color: green">PASS</span>

---

## Test 3 – Resizing Browser Window Vertically

**Action:**
Resize Browser window on y-axis

**Expected Result:**
- Logo preserving its size
- Browser window not being able to be smaller than the borders of the Logo
- No logs

**Actual Result:**
- Browser window not allowing reaching smaller size than minimum for displayin all enabled elements
- Logo preserved its size
- No logs

Status:  <span style="color: green">PASS</span>

---

## Test 4 – Loading on Google Chrome Browser

**Action:**
Loading site from localhost in Google Chrome

**Expected Result:**
- Logo loads correctly with expected colors
- No false logs

**Actual Result:**
- Logo loads correctly with expected colors
- No false logs

Status: <span style="color: green">PASS</span>

---

## Test 5 – Loading on Google Mozilla Firefox

**Action:**
Loading site from localhost in Mozilla Firefox

**Expected Result:**
- Logo loads correctly with expected colors
- No false logs

**Actual Result:**
- Logo loads correctly with expected colors
- No false logs

Status: <span style="color: green">PASS</span>

---

## Test 6 – Logo as a link to NOLAI.nl

**Action:**
Upon clicking NOLAI logo a new tab is opened with `https://www.ru.nl/en/nolai`

**Expected Result:**
- When clicking on the Logo on both Chrome and Firefox, a user is redirected to `https://www.ru.nl/en/nolai`
- No error logs
- Single new tab opens

**Actual Result:**
- Exactly one valid connection log
- Single new tab opened
- No error logs

Status:  <span style="color: green">PASS</span>

---

## Test 7 – Suppressed Unnecessary elements

**Action:**
Upon loading the environment no Edit Data and Clear Default style, Help tool bar option

**Expected Result:**
- Loaded web app shows no Edit Data button and no Clear Default style option

**Actual Result:**
- Loaded web app shows no Edit Data button and no Clear Default style option


Status:  <span style="color: green">PASS</span>

---
## Test 8 – Logo loading in non-full screen browser window

**Action:**
Loading Logo in smaller than full screen mode

**Expected Result:**
- Logo loads correctly and displays all expected functionalities

**Actual Result:**
- Logo loaded correctly and displays all expected functionalities

Status:  <span style="color: green">PASS</span>

---

# Observation

Loading the web app on different web browsers from localhost and resizing it keeps the ratio of the elements and their sizes constant
