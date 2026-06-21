# Amp Me Up Electrical — Hourly Rate Works Agreement Builder

A standalone, single-file web app for producing a branded **Hourly Rate Works Agreement** (time-and-materials) that the client signs in DocuSign. For non-emergency work that the client wants charged by the hour, or that's too complex/urgent to quote. Runs entirely in the browser, no backend, no build step. Output is a print-to-PDF document.

Shipping file: `Amp_Me_Up_Electrical_Hourly_Rate_Agreement.html`

This tool is a sibling of the [Emergency Callout Agreement](../Emergency%20Callout/) — same layout, header, toolbar, signature blocks, split-payment option and print pipeline. See that folder's README for the shared mechanics; this file documents only the differences.

---

## 1. How to use it (the DocuSign workflow)

1. Open the tool from the [tools landing page](../index.html) (or the "← Tools" link in the toolbar returns there).
2. **Set the rates** for this job — first-hour and each-additional-hour rates for business hours and after-hours. Your last-used rates are remembered on that browser; **Reset rates to default** restores the standard set.
3. **Enter the client's details** — full name, date (defaults to today), service address, email. The Full name + Date auto-fill into the signature block at the bottom.
4. *(Optional)* Tick **Include split-payment section** if a payment plan has been agreed.
5. Click **Print / Save as PDF**, then upload to **DocuSign** and place signature fields on the empty signature boxes.

---

## 2. Rates (defaults — all editable)

| Field | Default (ex GST) |
|---|---|
| Business hours — first hour | $150 |
| Business hours — each additional hour | $130 |
| After hours / weekends — first hour | $200 |
| After hours / weekends — each additional hour | $180 |
| Change-of-mind / travel minimum | $150 |

`localStorage` key is `amue_hr_rates` (separate from the Emergency builder's `amue_ec_rates`, so each tool keeps its own last-used rates). Time is charged from arrival, billed in 15-minute increments. Fixed policy figures (not per-job): 7-day terms, late-payment fees ($10/day for invoices under $10,000, otherwise 20% p.a. calculated daily), $30 bulky-waste disposal.

---

## 3. How it differs from the Emergency Callout Agreement

**Removed (emergency-only):** Nature of Fault Finding, Authority to Proceed, No Guarantee of Immediate Resolution — and the emergency-flavoured wording elsewhere (the "fault finding / callout" language in Scope, the "if a fault can't be rectified, power may remain isolated" lines in Compliance and Inconvenience, and "callout" → "attendance" in a couple of clauses).

**Changed:** "Emergency Callout Rates" → **"Hourly Rates"** (same first-hour / each-additional-hour structure, relabelled). Title/intro/scope reworded for hourly (time-and-materials) work.

**Added (for hourly/time-and-materials work):**
- **§4 Hourly-Rate Works & Estimates** — any estimate is a guide only, **not a fixed-price quotation**; the final amount is actual time + materials; duration isn't guaranteed; additional works are charged at the hourly rate (significant ones discussed first); the client may request a running time/cost total and will be notified if the cost is likely to materially exceed an estimate.
- **Progress invoicing** point in Payment Terms — longer jobs may be invoiced periodically for time + materials to date.

**Kept identical:** compliance/duty-of-care, cease-work, change-of-mind/cancellation, site access, roof damage, client-supplied equipment, workmanship warranty, inconvenience, limitation of liability, payment terms, retention of title, exclusions, disposal, privacy, photography, acceptance, the optional split-payment agreement, and all signature boxes (client Full name + Date auto-mirror the top fields).

> Not legal advice. Give the assembled document a final read before relying on it.

---

## 4. Page budget

Tuned to **4 pages** with the split-payment section off (clause spacing slightly tighter than the Emergency builder — clause `margin-top:11px`, 11 mm page margin — because the hourly clauses pack a little fuller). Turning split-payment on adds the 5th page. Re-check the page count (headless Chrome `--print-to-pdf` + PyMuPDF) after any content edits.

---

## 5. Brand constants

Amp Me Up Electrical · ABN **45 699 117 934** · QLD Contractor Lic 92927 · 0432 533 873 · logan@ampmeupelectrical.com · Logan · Redlands · Ipswich · Gold Coast · orange `#F78419` · near-black `#131313`.
