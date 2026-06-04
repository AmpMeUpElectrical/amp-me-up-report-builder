# Amp Me Up Electrical — Condition Report Builder

A standalone, single-file web app for producing branded residential electrical condition reports. Runs entirely in the browser (Chrome/Edge), works offline, no backend, no build step. Output is a print-to-PDF document; persistence is file-based (JSON save/load).

---

## 1. Tech stack & design decisions

- **Vanilla HTML/CSS/JS in one file.** No framework, no bundler. Open the `.html` directly (`file://`) and it runs.
- **No browser storage.** `localStorage`/`sessionStorage` are deliberately avoided — they aren't portable and don't survive being moved between machines. State lives in memory during a session and is persisted by downloading/uploading JSON.
- **Print-to-PDF, not a PDF library.** Export uses `window.print()` + an `@media print` stylesheet. This gives vector text, embedded images, and full control over what's hidden in the final document — higher quality and zero dependencies vs. jsPDF/html2canvas.
- **Logo is embedded as a base64 data URI** so the file is fully self-contained and renders offline.

If migrating to a framework (React/Vue/etc.), the state model below ports directly; the print stylesheet is the part that needs the most care to preserve.

---

## 2. Build / asset step (important)

The source HTML contains the literal token `LOGO_PLACEHOLDER` as the logo `<img src>`. Before shipping, that token must be replaced with a base64 data URI of the logo:

```python
import base64
b = base64.b64encode(open('logo_trim.png','rb').read()).decode()
html = open('report_builder.html').read()
html = html.replace('LOGO_PLACEHOLDER', 'data:image/png;base64,' + b)
open('Amp_Me_Up_Electrical_Report_Builder.html','w').write(html)
```

`logo_trim.png` is the brand logo with its surrounding white margin cropped to the artwork bounding box (so it fills the header tile). Re-run this step after **any** edit to the source HTML, or the logo will break.

> Roadmap note: a reversed (white-wordmark) transparent logo would remove the need for the white header tile and let the mark sit directly on the dark header.

---

## 3. Brand constants

| Item | Value |
|---|---|
| Business name | Amp Me Up Electrical (never "Services") |
| ABN | 51 674 950 628 |
| Phone | 0432 533 873 |
| Email | logan@ampmeupelectrical.com |
| Licence | QLD Contractor Lic 92927 |
| Service areas | Logan · Redlands · Ipswich · Gold Coast |
| Orange (accent) | `#F78419` |
| Near-black (base) | `#131313` |
| White | `#FFFFFF` |

These are hard-coded in the header and as CSS variables. Severity tier colours are also CSS vars (`--urgent-*`, `--rec-*`, `--adv-*`, `--ok-*`).

---

## 4. Severity system (single source of truth)

All severity labels/colours are driven by the JS `SEV` object. **Change labels here and nowhere else** — the count tiles, finding-card buttons, card pills, findings index, and snippet library all read from it.

| Code | Label | Colour family |
|---|---|---|
| `u` | Urgent / Unsafe | red |
| `r` | Needs Attention / Non-Compliant | amber |
| `a` | Monitor / Potential Risk | blue |
| `o` | Compliant | green |

Selecting `o` (Compliant) auto-fills the recommendation field with `N/A`; switching away clears it only if it still equals `N/A` (manual edits are preserved).

> Known footgun: during development the `SEV` labels silently reverted to old values in one edit pass while the HTML tiles stayed correct, producing a mismatch between the on-screen tiles and the exported PDF pills. If labels look inconsistent, check the `SEV` object first.

---

## 5. Data model (JSON save/load schema)

`Save report` serialises this; `Load report` restores it. Photos and signature are stored inline as data URIs, so a loaded report is fully intact.

```jsonc
{
  "v": 1,
  "meta": {
    "client": "string",
    "addr": "string",
    "date": "DD Mon YYYY",
    "by": "string",
    "ref": "ECR-#### or Job #",
    "overall": "No action required | Action recommended | Urgent attention required",
    "scope": ""        // vestigial; the Scope field was removed from the UI
  },
  "intro": "string",
  "nextSteps": "string",
  "disc": "string",     // notes & limitations
  "sigDate": "DD Mon YYYY",
  "signature": "data:image/png;base64,...",   // or ""
  "findings": [
    {
      "title": "string",
      "sev": "u | r | a | o",
      "observation": "string",
      "recommendation": "string",
      "clause": "string",                       // e.g. "AS/NZS 3000 Cl 2.6"
      "photo": "data:image/...;base64,..."      // or ""
    }
  ],
  "snippets": [
    {
      "title": "string",
      "sev": "u | r | a | o",
      "observation": "string",
      "recommendation": "string",
      "clause": "string"
    }
  ]
}
```

The snippet library can also be exported/imported on its own (same `snippets` array shape) so reusable findings carry between jobs.

---

## 6. Features

- **Findings** — full-width square photo zone (`aspect-ratio: 1/1`, `object-fit: contain` so nothing is cropped) above title, severity selector, observation, recommendation, and referenced clause. Add/remove freely.
- **Snippet library** — save any finding as a reusable snippet (text + clause + severity); insert into any finding via per-card dropdown. Persisted in the report JSON and separately exportable.
- **Auto findings summary (page 1)** — numbered index of every finding with its severity pill, generated live. Doubles as a scope-of-works overview for quoting.
- **Severity count tiles** — live counts for the four tiers.
- **Draw-to-sign signature** — pointer-drawn canvas; stamps the date on first stroke; converted to an image for print and stored in the JSON.
- **Save / Load / Export PDF / New** in the toolbar.

---

## 7. Print / PDF behaviour & gotchas

The `@media print` block does the heavy lifting. Key rules to preserve on migration:

- `* { print-color-adjust: exact }` — **required**, or the dark header, orange bar, and tier fills are stripped by the browser.
- Editing chrome (toolbar, add/remove buttons, snippet dropdowns, severity buttons) is hidden; inputs/textareas render as plain text.
- **Severity pill**: the on-screen severity *buttons* are hidden in print; a `.sevpill` (set by `setSev()` from `SEV[sev].label`) is shown instead.
- **Signature**: the `<canvas>` is hidden and an `<img>` is shown. The image `src` is refreshed on every `pointerup` (not just `beforeprint`) because setting it only in `beforeprint` can be too late for the print renderer to load it.
- **Empty clause hidden**: on `beforeprint`, any `.clausewrap` whose input is empty (or just `-`) gets `.empty-clause` → `display:none`, so no blank "Referenced clause" box appears.
- **Page layout**: `.secwrap` (Findings) has `break-before: page` so findings always start on a fresh page; `.finding` has `break-inside: avoid` so each card stays whole. The "see below" bridge note lives at the top of `.secwrap` so it isn't orphaned on its own page.
- Textareas auto-grow (`height = scrollHeight`) so full content prints without clipping.

---

## 8. Known constraints

- `aspect-ratio` requires a modern browser (Chrome 88+/Edge/Safari 15+) — fine for current targets.
- Large reports = large JSON (photos are inline data URIs). Acceptable for a handful of photos per job; consider external blob storage if scaling.
- AS/NZS 3000 clause references are entered manually. Numbers used in samples are illustrative until verified against a licensed copy of the standard.

---

## 9. Roadmap

- **AS/NZS 3019 tested-assessment tier** — a formal periodic-assessment report (with test results) built off this visual report.
- **Clause index** — on first load of a licensed AS/NZS 3000 copy, build a small section/clause→page map so lookups are fast and clause numbers are verified.
- **Reversed transparent logo** — to drop the white header tile.
- **ServiceM8 quoting/invoicing engine** — separate project. Shares finding/snippet DNA (line items), so the snippet schema above is the bridge between reporting and quoting.

---

*Single source file: `report_builder.html` (pre-logo-injection). Shipping file: `Amp_Me_Up_Electrical_Report_Builder.html` (logo embedded).*
