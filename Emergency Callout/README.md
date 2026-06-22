# Amp Me Up Electrical — Emergency Callout Agreement Builder

A standalone, single-file web app for producing a branded **Emergency Electrical Callout & Fault-Finding Agreement** that the client signs in DocuSign. Runs entirely in the browser, no backend, no build step. Output is a print-to-PDF document.

Shipping file: `Amp_Me_Up_Electrical_Emergency_Callout_Agreement.html`

---

## 1. How to use it (the DocuSign workflow)

1. Open the tool from the [tools landing page](../index.html) (or directly on the GitHub Pages site).
2. **Set the rates** for this job — the call-out fee and hourly rate (business hours + after-hours) and the travel/abort minimum are editable inputs. Your last-used rates are remembered on that browser (see §4); use **Reset rates to default** to return to the standard set.
3. **Enter the client's details** — full name, date (defaults to today), service address, email.
4. *(Optional)* Tick **Include split-payment section** if a payment plan has been agreed; fill in the totals/frequency.
5. Click **Print / Save as PDF** and save the PDF.
6. Upload the PDF to **DocuSign** and drop signature/date fields onto the blank signature lines (see §3).

The client's typed details print as filled text; the **signature lines are intentionally left blank** for DocuSign.

---

## 2. Editable rates (defaults)

| Field | Default (ex GST) |
|---|---|
| Business hours — call-out fee | $250 |
| Business hours — per hour | $150 |
| After hours / weekends — call-out fee | $350 |
| After hours / weekends — per hour | $200 |
| Change-of-mind / travel minimum | $150 |

All rates and fees are exclusive of GST (stated on the document). Fixed policy figures that are **not** per-job inputs: 7-day payment terms, late-payment fees ($10/day for invoices under $10,000, otherwise 20% p.a. calculated daily), $30 bulky-waste disposal fee.

---

## 3. Signature blocks for DocuSign

Two signing parties (**Client** and **Amp Me Up Electrical**) each get blank, labelled lines:

- Client: signature · full name · date
- Amp Me Up Electrical: signature · electrician full name (blank, fillable — typed by whichever electrician attends) · date

The optional Split Payment Agreement has its own matching pair of signature blocks. In DocuSign, place the recipient's Signature and Date fields directly on these lines. (If you later want DocuSign **anchor text tags** to auto-place fields from a saved template, that's a future enhancement — the current version uses plain lines for maximum flexibility.)

---

## 4. Persistence & logo

- **Rates persist via `localStorage`** (key `amue_ec_rates`) so your last-used rates become the starting point next time on that browser. This is deliberate for this tool (rates are standing config, adjusted per job) and differs from the Condition Report builder, which avoids storage because it holds portable per-job data. Customer details are **never** stored.
- **Logo is embedded as a base64 data URI** (same convention as the other builders) so the file is fully self-contained and renders offline / standalone.

---

## 5. Brand constants

| Item | Value |
|---|---|
| Business name | Amp Me Up Electrical (never "Services") |
| ABN | 45 699 117 934 |
| Phone | 0432 533 873 |
| Email | logan@ampmeupelectrical.com |
| Licence | QLD Contractor Lic 92927 (Logan James Allen) |
| Service areas | Logan · Redlands · Ipswich · Gold Coast |
| Orange (accent) | `#F78419` |
| Near-black (base) | `#131313` |

---

## 6. Document provenance (how the terms were assembled)

This agreement merges the original **Emergency Callout Terms of Service** with the company's **Standard Terms & Conditions** (`../Terms and Conditions/`), removing duplicates so each point appears once.

**Merged (duplicates removed, kept once):**
- Payment terms — both sources stated 7 days / 20% p.a.; combined into one clause (§16) with the default & late-payment points.
- Compliance & Australian Standards — emergency duty-of-care points + the standard AS/NZS 3000 rectification clause combined (§6).
- Site access — emergency access points + standard site-access clause combined (§10).
- Power isolation & inconvenience — emergency "power may remain isolated" tied into the standard inconvenience/incidental-loss clause (§14).

**Kept from the emergency TOS (callout-specific):** scope, editable callout rates, materials, nature of fault finding, authority to proceed, cease-work-by-client, change-of-mind/cancellation, no guarantee of immediate resolution, the safety carve-outs (no temporary/non-compliant fixes; won't risk the licence), and the optional split-payment agreement.

**Folded in from the standard T&Cs (relevant, were missing):** roof/building damage, client-supplied equipment, workmanship warranty, limitation of liability, retention of title, a trimmed exclusions list (asbestos / building works / distributor costs), waste disposal, privacy, photography & marketing.

**Deliberately dropped (not relevant to an hourly emergency callout):** the 30-day quotation validity and the 50% deposit-before-scheduling clause (emergency work is billed hourly from arrival, with a travel/first-hour cancellation fee instead), and the **Variations** clause — extra work found mid-callout is simply charged at the hourly rate, so a separate $500 variation-approval process doesn't apply.

> Not legal advice. Give the assembled document a final read before relying on it.

---

## 7. Tech notes

- Vanilla HTML/CSS/JS in one file. Export uses `window.print()` + an `@media print` stylesheet (A4, page numbers in the footer). No PDF library, no dependencies.
- `print-color-adjust:exact` keeps the dark header band and orange accent in the printed PDF; the toolbar and input borders are hidden, and the rate inputs print as plain text (sized to content so figures read with a single trailing space).
- A **"← Tools"** link in the toolbar (no-print) returns to the landing page (`../index.html`).
- **Page budget:** the agreement is tuned to fit exactly **4 pages** with the split-payment section off — via the clause/signature spacing and a 12 mm page margin. Turning on split-payment adds the 5th page (intended). If you add clauses or text, re-check the page count (render with headless Chrome `--print-to-pdf` and count) so it doesn't spill to a stray 5th page.
