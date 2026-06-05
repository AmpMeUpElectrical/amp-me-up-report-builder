# Amp Me Up Electrical — Certificate of Testing & Compliance Builder

A standalone, single-file web app for producing branded QLD Certificates of Testing and Compliance (issued under **s227, Electrical Safety Regulation 2013**). Runs entirely in the browser (Chrome/Edge), works offline, no backend, no build step. Output is a print-to-PDF document; persistence is file-based (JSON save/load).

Sibling project to the **Condition Report Builder** — shares the same header, brand tokens, print pipeline, and JSON persistence model, so anything learned there ports directly here.

---

## 1. Tech stack & design decisions

- **Vanilla HTML/CSS/JS in one file.** No framework, no bundler. Open the `.html` directly (`file://`) and it runs.
- **No browser storage.** `localStorage`/`sessionStorage` are deliberately avoided — they aren't portable between machines. State lives in memory during a session and is persisted by downloading/uploading JSON.
- **Print-to-PDF, not a PDF library.** Export uses `window.print()` + an `@media print` stylesheet. Vector text, embedded images, full control over what's hidden — higher quality and zero dependencies vs. jsPDF/html2canvas.
- **Logo embedded as a base64 data URI** so the file is fully self-contained and renders offline.

If migrating to a framework (React/Vue/etc.), the flat state object in §5 ports directly; the print stylesheet is the part that needs the most care to preserve.

---

## 2. Logo & (optional) build step

**Current approach (decided 2026-06-05): edit the shipping file directly.** `Amp_Me_Up_Electrical_Certificate_Builder.html` already has the logo embedded as a base64 data URI (one long line, ~line 118), so it just works — open it and it runs, logo and all. Edits go straight into this file; there is **no required build step and nothing to re-run**. The master brand logo lives at **`..\Company Logo\New-Logo-Google-PFP.png`** (720×720, transparent background; shared with the Report Builder). The certificate's embedded logo was generated from that file on 2026-06-05, so the logo isn't trapped inside the one big file. Editing the certificate's *content* needs no rebuild; **only if the logo image itself changes** do you re-embed it from the master — base64-encode the PNG and replace the single `data:image/png;base64,…` value on line ~118 (a one-liner, or just ask Claude Code).

There is currently **no `cotc_source.html`** in this folder. The token/build workflow below is *optional* — only worth setting up if you ever want a smaller, cleaner file to edit instead of the logo-embedded one. To adopt it: copy the shipping file, swap the base64 logo `<img src>` back to the literal token `LOGO_PLACEHOLDER`, save that as `cotc_source.html`, then regenerate the shipping file with:

```python
import base64
b = base64.b64encode(open('../Company Logo/New-Logo-Google-PFP.png','rb').read()).decode()
html = open('cotc_source.html').read()
html = html.replace('LOGO_PLACEHOLDER', 'data:image/png;base64,' + b)
open('Amp_Me_Up_Electrical_Certificate_Builder.html','w').write(html)
```

The logo file (`..\Company Logo\New-Logo-Google-PFP.png`) is the same brand logo used by the Report Builder. If you adopt the optional source/build workflow, re-run this step after **any** edit to `cotc_source.html`, or the logo will break in the shipping file. (Under the current direct-edit approach this never applies — the logo stays embedded and intact.)

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
| Name on licence | Logan James Allen |
| Service areas | Logan · Redlands · Ipswich · Gold Coast |
| Orange (accent) | `#F78419` |
| Near-black (base) | `#131313` |
| White | `#FFFFFF` |

These are hard-coded in the header and as CSS variables (`--orange`, `--dark`, `--line`, `--muted`, `--hint`, `--tint`). The header markup is intentionally **identical** to the Report Builder — keep them in sync if either changes.

---

## 4. Locked vs. editable fields

Three fields are **pre-filled and visually locked** (`.locked` — greyed background) so every certificate carries consistent contractor details, while remaining editable if ever needed:

| Field | Default |
|---|---|
| Electrical contractor licence no. | `92927` |
| Name on contractor licence | `Logan James Allen` |
| Phone number | `0432 533 873` |

Mandatory fields are marked with an orange asterisk (`.req`), matching the official form's "* indicates a mandatory field" convention. Mandatory set: given name/business, surname/ABN, street address, date of test, contractor licence no., date certificate given. (The *site address* field is **optional** — it's only filled when the work site differs from the client address above.)

> **Soft enforcement.** On **Export PDF** the mandatory fields are checked: any blank ones are highlighted in red, the first is scrolled into view, and a dialog lists what's missing. Export can still proceed via "Export anyway?" (warn, not hard block) — the operator stays in control. The red highlight is screen-only; it is stripped from the printed PDF. To make it a hard block, change the `confirm(...)` in the `btnPdf` handler to an `alert(...); return;`.

---

## 5. Data model (JSON save/load schema)

`Save` serialises this flat object; `Load` restores it. The signature is stored inline as a data URI, so a loaded certificate is fully intact.

```jsonc
{
  "v": 1,
  "type": "cotc",
  "ref": "COC-####",
  "title": "string",          // Mr / Mrs / etc. (optional)
  "given": "string",          // given name/s OR business name
  "surname": "string",        // surname OR ABN
  "street": "string",
  "suburb": "string",
  "postcode": "string",
  "install": "string",        // site address — only if it differs from the client address above (JSON key kept as "install" for backward-compat)
  "work": "string",           // description of electrical work performed
  "testDate": "DD Mon YYYY",
  "licence": "92927",         // locked default
  "contractor": "Logan James Allen",  // locked default
  "phone": "0432 533 873",    // locked default
  "givenDate": "DD Mon YYYY",
  "signature": "data:image/png;base64,..."   // or ""
}
```

The save filename derives from `ref` (e.g. `COC-1234.json`).

---

## 6. Features

- **Header** — identical dark/orange branded header to the Report Builder (logo, business name, service areas, licence/ABN/phone/email).
- **Certificate fields** — *Work performed for* (title, given/business, surname/ABN, address split into street + suburb + postcode), *Electrical installation tested* (optional site address if different from the client address, plus description of electrical work performed), *Test & contractor details*.
- **s227 certification statement** — fixed legal block (AS/NZS 3000 wiring rules + Electrical Safety Regulation 2013) in an orange-accented tint panel.
- **Auto reference + dates** — generates a `COC-####` number and stamps today's date into *test date* and *date given* on load / New.
- **Draw-to-sign signature** — pointer-drawn canvas; converted to an image for print and stored in the JSON. Signing auto-fills the *date given* if blank. Image `src` refreshes on every `pointerup`.
- **Save / Load / Export PDF / New** in the toolbar.
- **Mandatory-field check on export** — Export PDF flags blank required fields (red highlight + missing-list dialog) before printing; highlights clear as you type and reset on Load/New. Warn-only (override allowed); never prints red. See §4.
- Textareas auto-grow so full content prints without clipping.

---

## 7. Print / PDF behaviour & gotchas

The `@media print` block does the heavy lifting. Key rules to preserve on migration:

- `* { print-color-adjust: exact }` — **required**, or the dark header and orange accents are stripped by the browser.
- Toolbar and the signature **Clear** button are hidden in print.
- Inputs/textareas render as plain text; `.field` inputs get a thin bottom rule (`border-bottom`) so they read as form lines on the certificate.
- Locked fields print as normal dark text (the grey lock styling is stripped in print).
- **Signature**: the `<canvas>` is hidden and an `<img>` is shown. The image `src` is refreshed on every `pointerup` (not just `beforeprint`) because setting it only in `beforeprint` can be too late for the print renderer to load it.
- `break-inside: avoid` on `.sec`, `.titlerow`, `.header`, `.signoff` keeps logical blocks from splitting across pages. Designed to fit a single A4 page for a typical certificate.

---

## 8. Known constraints

- Mandatory fields are *warned* on export, not hard-blocked — an operator can still "Export anyway?" past blanks (by design). The locked contractor licence field is in the required set but is pre-filled, so it effectively always passes.
- Large signature = larger JSON (inline data URI). Negligible for a single signature.
- The s227 statement wording is hard-coded; verify against the current Electrical Safety Regulation before relying on it for compliance.

---

## 9. Roadmap

- **Certificate register** — a saved list/index of issued certificates (deferred; single-certificate for now).
- **Sequential numbering** — `COC-0001…` incrementing instead of random `COC-####` (needs persistence to track the counter).
- **Reversed transparent logo** — to drop the white header tile (shared with Report Builder).
- **AS/NZS 3019 tested-assessment tie-in** — link a certificate to the periodic-assessment report from the Report Builder roadmap.
- **ServiceM8 bridge** — shared client/job DNA with the quoting/invoicing engine so client details flow through without re-keying.

---

*Working file — edit this directly: `Amp_Me_Up_Electrical_Certificate_Builder.html` (logo embedded). Master brand logo: `..\Company Logo\New-Logo-Google-PFP.png` (shared with the Report Builder). Optional, not currently present: `cotc_source.html` (pre-logo-injection source) — see §2.*
