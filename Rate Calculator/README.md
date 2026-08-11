# True Hourly Rate & Overhead Calculator

`Amp_Me_Up_Electrical_Rate_Calculator.html`

Works out what an hour of work actually costs Amp Me Up Electrical, and what you need to
charge to make the margin you're aiming for.

Live: <https://ampmeupelectrical.github.io/amp-me-up-report-builder/Rate%20Calculator/Amp_Me_Up_Electrical_Rate_Calculator.html>

Same pattern as the other tools in this repo — one HTML file, no build step, no server,
no dependencies beyond the Manrope web font. Open it in a browser and it works.

---

## 1. What it does

| Tab | What's on it |
|---|---|
| **Dashboard** | Breakeven cost per billable hour, recommended charge-out rate, profit/loss at your current rate, where every hour goes, rate at 0–50% margin, overheads by category |
| **Overheads** | Every business cost that isn't a wage. Any frequency (weekly → yearly), GST tick-box per line, CSV import |
| **Labour** | One card per person. Wage, super, workers' comp, payroll tax, leave loading, allowances, leave/public holidays/sick/training, and hours per week that can't be invoiced |
| **Travel & non-billable** | Trip log → weekly average → push straight into the Labour tab. Plus a quick estimator if there's nothing logged yet |
| **Trend** | Dated snapshots of your breakeven and target rate, with a chart and a CSV export |
| **How it works** | The maths, in plain English |

---

## 2. The maths

**Cost of a person, per year**

```
base wage (or drawings)
  + annual leave loading
  + allowances
  = gross
  + superannuation      (% of gross)
  + workers' compensation (% of gross)
  + payroll tax         (% of gross — 0 under the QLD $1.3M threshold)
  + other costs you carry (phone, PPE, training, tool allowance)
  = true cost
```

**Hours you can actually sell**

```
paid hours (hours/week × weeks/year)
  − annual leave − public holidays − sick leave − training
  = hours worked
  − travel − quoting − admin − yard/materials runs − other
  = billable hours
```

**The rate**

```
breakeven = (total overheads + labour cost of billable staff) ÷ total billable hours
```

Then either

- **margin** — `rate = breakeven ÷ (1 − margin%)` — the share of the invoice you keep, or
- **mark-up** — `rate = breakeven × (1 + markup%)` — a percentage added on top of cost.

They are not the same number. 30% mark-up on $100 is $130, and $30 of a $130 sale is a 23%
margin. The tool defaults to margin.

**Things worth knowing**

- Every figure is **ex GST**. Ticking *GST* on an overhead line divides it by 1.1, because if
  you're registered the GST isn't a cost to you. Inc-GST rates are shown alongside where useful.
- Anyone marked **not billable** (office/admin) has their whole employment cost rolled into
  overheads rather than being spread over their own hours.
- Utilisation is billable hours ÷ paid hours **of the people on the tools**. 55–70% is normal;
  if you're seeing 85% you've under-counted your non-billable time.

---

## 3. Where the data lives

Everything is kept in this browser's `localStorage` under the key `amue_rate_calc_v1`, saved
automatically as you type. Nothing is uploaded anywhere.

- **Save file (.json)** — a full backup you can keep or move to another machine. Drop it in
  OneDrive/Google Drive/Dropbox and you can open it anywhere.
- **Load file** — reads one back in.
- **Start over** — wipes this device and reloads the starter figures.

Clearing your browser data clears the calculator, so save a `.json` now and then.

### Cloud sync — not built yet

Proper sync (log in on the phone, see the same live numbers) needs a small back end behind it.
The state is a single JSON object with a `version` field, so a sync layer can be bolted on
without changing the maths.

---

## 4. CSV import

**Overheads** — export a period of transactions from Xero/MYOB/QuickBooks or a bank statement,
hit **Import from CSV**, and map the columns. The dialog lets you:

- pick the amount / category / description / date columns (it guesses from the headers)
- say what period the file covers, or let it work that out from the dates — either way the
  total is annualised
- handle bank exports where expenses are negative
- strip GST
- bring it in grouped by category (one line each) or as every transaction

Nothing is imported until you press **Add to existing** or **Replace existing**, and the preview
shows exactly what you'll get.

**Travel** — same idea: a date, who, how long (minutes or hours), and optionally a
billed/not-billed column.

---

## 5. Starter figures

First open, the tool is loaded with example figures for a solo QLD residential electrical
business so nothing reads as `$0.00`. **They are made up.** Replace them with your real numbers —
or hit **Clear all amounts** on the Overheads tab and start from scratch.

---

## 6. Export PDF summary

**Export PDF summary** prints a one-page-ish branded summary — breakeven, recommended rate,
overheads by category, labour breakdown, the margin table and the cost of non-billable time.
Chrome's Save-as-PDF name is set automatically to
`Charge-Out Rate Summary - DD-MM-YYYY - Amp Me Up Electrical`.

---

## 7. Editing it

Open the file and edit it. There's no build step and no source/generated split — the same file
you open in a browser is the one in the repo.

- The logo is a **relative link** to `../Company Logo/New-Logo-Google-PFP.png`, not embedded,
  so this file stays small.
- All the maths lives in one function, `calc()`. Everything else renders from what it returns.
- Brand tokens are the same `:root` variables used across the other tools
  (`--orange:#F78419`, `--dark:#131313`).

---

*A costing model, not tax or financial advice. Run a big pricing change past your accountant.*

Amp Me Up Electrical · QLD Contractor Licence 92927 · ABN 45 699 117 934
