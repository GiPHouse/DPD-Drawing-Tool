# DPD Plugin — Manual Test Plan

All 15 rules across 4 categories. Each test tells you exactly what to draw,
what to expect, and what the pass condition is.

---

## Shapes (from the sidebar)

| Shape | DPD component type | Visual |
|---|---|---|
| Process / MPC process / Distributed processes | `process` | Circle |
| Storage / PEP repository / Distributed storages | `data_store` | Parallel lines |
| External entity / Distributed external entities | `external_entity` | Rectangle |

---

## How to annotate an edge

After drawing an arrow between two shapes the **Annotate Data Flow** dialog
opens automatically. You can also right-click any existing arrow and choose
**Annotate Data Flow…**.

Fields:
- **Identifiability** *(required)*: non_personal / de_identified / indirectly_identifiable / directly_identifiable
- **Linkability** *(required)*: unlinkable / locally_linkable / universally_linkable
- **Pseudonymity** *(optional)*: none / strict_pseudonymous / soft_pseudonymous
- **Data Labels** *(optional)*: free text, comma-separated

---

## Structural Rules

### R-S1 — Data stores cannot connect directly to each other

| Step | Action |
|---|---|
| 1 | Drag two **Storage** shapes onto the canvas |
| 2 | Draw an arrow from one to the other |

**Expected:** Alert fires immediately —
`R-S1 Error: Data stores cannot connect directly to each other.`
Connection is **blocked** (arrow does not appear).

---

### R-S2 — External entities cannot connect directly to each other

| Step | Action |
|---|---|
| 1 | Drag two **External entity** shapes onto the canvas |
| 2 | Draw an arrow from one to the other |

**Expected:** Alert fires —
`R-S2 Error: External entities cannot connect directly to each other.`
Connection is **blocked**.

---

### R-S3 — Data stores cannot connect directly to external entities

| Step | Action |
|---|---|
| 1 | Drag one **Storage** and one **External entity** |
| 2 | Draw an arrow from Storage → External entity |
| 3 | Repeat in the other direction |

**Expected:** Both attempts are **blocked** with an R-S3 alert.

---

### R-S4 — Every data flow should be annotated  *(Warning)*

| Step | Action |
|---|---|
| 1 | Drag a **Process** and a **Storage** shape |
| 2 | Draw an arrow between them |
| 3 | In the annotation dialog, click **Cancel** (leave it unannotated) |
| 4 | Click **" Validate DPD** |

**Expected:** Validation report shows `R-S4 Warning: Data flow has no identifiability annotation.`

---

## Identifiability Rules

### R-I1 — Incoming flow exceeds process input constraint  *(Error)*

| Step | Action |
|---|---|
| 1 | Drag a **Process** shape, right-click it → **Edit Data** |
| 2 | Add attribute `accepts_max_identifiability` = `de_identified` |
| 3 | Drag an **External entity** and connect it to the Process |
| 4 | In the annotation dialog set Identifiability = `directly_identifiable`, Linkability = `universally_linkable` |
| 5 | Click **" Validate DPD** |

**Expected:** `R-I1 Error: Flow is "directly_identifiable" but process only accepts "de_identified" or lower.`

---

### R-I2 — Outgoing flow exceeds process output constraint  *(Error)*

| Step | Action |
|---|---|
| 1 | Drag a **Process** shape, right-click → **Edit Data** |
| 2 | Add attribute `outputs_max_identifiability` = `de_identified` |
| 3 | Drag a **Storage** shape and connect Process → Storage |
| 4 | Annotate: Identifiability = `directly_identifiable`, Linkability = `universally_linkable` |
| 5 | Click **" Validate DPD** |

**Expected:** `R-I2 Error: Flow is "directly_identifiable" but process should output "de_identified" or lower.`

---

### R-I3 — Incoming flow exceeds data store constraint  *(Error)*

| Step | Action |
|---|---|
| 1 | Drag a **Storage** shape, right-click → **Edit Data** |
| 2 | Add attribute `stores_max_identifiability` = `de_identified` |
| 3 | Drag a **Process** and connect Process → Storage |
| 4 | Annotate: Identifiability = `directly_identifiable`, Linkability = `universally_linkable` |
| 5 | Click **" Validate DPD** |

**Expected:** `R-I3 Error: Store accepts at most "de_identified" but receives "directly_identifiable".`

---

### R-I4 — Identifiable data should be universally linkable  *(Warning)*

| Step | Action |
|---|---|
| 1 | Draw **External entity → Process** |
| 2 | Annotate: Identifiability = `directly_identifiable`, Linkability = `locally_linkable` |
| 3 | Click **" Validate DPD** |

**Expected:** `R-I4 Warning: Identifiable data ("directly_identifiable") should be universally linkable.`

Repeat with `indirectly_identifiable` + `unlinkable` → same warning.

**Negative test:** Set Linkability = `universally_linkable` → **no R-I4 warning**.

---

### R-I5 — Data store cannot reduce identifiability  *(Warning)*

| Step | Action |
|---|---|
| 1 | Drag a **Process**, a **Storage**, and another **Process** |
| 2 | Connect Process A → Storage: Identifiability = `directly_identifiable`, Linkability = `universally_linkable` |
| 3 | Connect Storage → Process B: Identifiability = `de_identified`, Linkability = `unlinkable` |
| 4 | Click **" Validate DPD** |

**Expected:** `R-I5 Warning: Identifiability decreases across a data store without an intermediate process.`

---

## Linkability Rules

### R-L1 — Incoming flow exceeds process linkability constraint  *(Error)*

| Step | Action |
|---|---|
| 1 | Drag a **Process**, right-click → **Edit Data** |
| 2 | Add `accepts_max_linkability` = `locally_linkable` |
| 3 | Drag an **External entity**, connect it to the Process |
| 4 | Annotate: Identifiability = `de_identified`, Linkability = `universally_linkable` |
| 5 | Click **" Validate DPD** |

**Expected:** `R-L1 Error: Flow is "universally_linkable" but process only accepts "locally_linkable" or lower.`

---

### R-L2 — De-identified but universally linkable data  *(Warning)*

| Step | Action |
|---|---|
| 1 | Draw **External entity → Process** |
| 2 | Annotate: Identifiability = `de_identified`, Linkability = `universally_linkable` |
| 3 | Click **" Validate DPD** |

**Expected:** `R-L2 Warning: De-identified but universally linkable data can become identifiable if combined with other identifiable data.`

---

## Pseudonymity Rules

### R-P1 — Pseudonymous data cannot be directly identifiable  *(Error)*

| Step | Action |
|---|---|
| 1 | Draw **External entity → Process** |
| 2 | Annotate: Identifiability = `directly_identifiable`, Linkability = `locally_linkable`, Pseudonymity = `strict_pseudonymous` |
| 3 | Click **" Validate DPD** |

**Expected:** `R-P1 Error: Pseudonymous data cannot be directly identifiable.`

---

### R-P2 — Pseudonymous data must be locally linkable  *(Error)*

| Step | Action |
|---|---|
| 1 | Draw **External entity → Process** |
| 2 | Annotate: Identifiability = `de_identified`, Linkability = `universally_linkable`, Pseudonymity = `strict_pseudonymous` |
| 3 | Click **" Validate DPD** |

**Expected:** `R-P2 Error: Pseudonymous data must be locally linkable (linked only by the pseudonym).`

Also fails for `unlinkable` — repeat with that value.

---

### R-P3 — Strict pseudonymous data must be de-identified  *(Error)*

| Step | Action |
|---|---|
| 1 | Draw **External entity → Process** |
| 2 | Annotate: Identifiability = `indirectly_identifiable`, Linkability = `locally_linkable`, Pseudonymity = `strict_pseudonymous` |
| 3 | Click **" Validate DPD** |

**Expected:** `R-P3 Error: Strict pseudonymous data must be de-identified beyond the pseudonym.`

**Negative test:** Switch Identifiability to `de_identified` → **no R-P3 error**.

---

### R-P4 — Soft pseudonymous data should be indirectly identifiable  *(Warning)*

| Step | Action |
|---|---|
| 1 | Draw **External entity → Process** |
| 2 | Annotate: Identifiability = `de_identified`, Linkability = `locally_linkable`, Pseudonymity = `soft_pseudonymous` |
| 3 | Click **" Validate DPD** |

**Expected:** `R-P4 Warning: Soft pseudonymous data is expected to be indirectly identifiable.`

**Negative test:** Switch Identifiability to `indirectly_identifiable` → **no R-P4 warning**.

---

## Multi-violation test

Draw:

```
[Storage A] ──▶ [Storage B]          (violates R-S1)
[External entity] ──▶ [External entity]  (violates R-S2)
[External entity] ──▶ [Process]       annotate: de_identified + universally_linkable + soft_pseudonymous
```

**Expected in the validation report:**
- R-S1 Error
- R-S2 Error
- R-L2 Warning (de-identified + universally linkable)
- R-P4 Warning (soft pseudonymous + not indirectly identifiable)

---

## Rule reference summary

| Rule | Category | Severity | What it checks |
|---|---|---|---|
| R-S1 | Structural | Error | store → store |
| R-S2 | Structural | Error | entity → entity |
| R-S3 | Structural | Error | store ↔ entity |
| R-S4 | Structural | Warning | unannotated edge |
| R-I1 | Identifiability | Error | incoming ident > process max |
| R-I2 | Identifiability | Error | outgoing ident > process max |
| R-I3 | Identifiability | Error | incoming ident > store max |
| R-I4 | Identifiability | Warning | identifiable + not universally linkable |
| R-I5 | Identifiability | Warning | ident decreases across store |
| R-L1 | Linkability | Error | incoming link > process max |
| R-L2 | Linkability | Warning | de-identified + universally linkable |
| R-P1 | Pseudonymity | Error | pseudonymous + directly identifiable |
| R-P2 | Pseudonymity | Error | pseudonymous + not locally linkable |
| R-P3 | Pseudonymity | Error | strict pseudo + not de-identified |
| R-P4 | Pseudonymity | Warning | soft pseudo + not indirectly identifiable |
