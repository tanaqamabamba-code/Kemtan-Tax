# Kemtan

Hardware shop management (sales, stock with FIFO costing, expenses, damage/loss, money owed, staff wages, business health) **plus a Tax tab** that prepares the numbers for the Kemtan Tax Compliance Self-Assessment Workbook.

Built from the Tanbuild app. It uses its own storage keys (`kemtan-*`), so it never mixes with the old Tanbuild app even though both live on the same github.io address.

## Tax tab

| Section | What it does |
|---|---|
| Summary | Turnover → cost of sales → gross profit → accounting profit → taxable income → estimated tax → balance, plus automatic checks |
| Settings | Company details, financial year, VAT registered (No = 0% VAT), tax rate, other income / adjustments |
| Review | Mark each expense Deductible / Private / Capital / Non-deductible and add evidence refs; add supplier, TIN and invoice details to purchases |
| Assets | Fixed asset register (cost, depreciation, tax allowance) |
| QPD | Quarterly payment tracker (percentages editable) |
| Export | CSV files with the same columns as the workbook tabs: Tax computation, Sales, Purchases, Expenses, Stock valuation, Fixed assets, Payroll summary |

Notes
- USD only. VAT is 0% while "VAT registered" is No.
- Rates are never hard-coded. Enter the confirmed tax rate (and VAT rate once registered).
- Cost of sales = opening stock + purchases − closing stock (FIFO). Stock-loss expenses are left out of operating expenses because they are already inside cost of sales.
- PAYE and NSSA are not calculated; the payroll export gives total wages paid per month.
- This is a working paper, not a filed return. Have a Zimbabwe tax practitioner review it.

## Moving your Tanbuild data across

1. In the old Tanbuild app: **Backup → Download backup**.
2. In this app: **Backup → choose that file → Restore**.

## Deploying (same as Tanbuild)

1. Create a new empty GitHub repository (e.g. `Kemtan-Tax`).
2. Upload everything in this folder to the `main` branch (keep `.github/workflows/build.yml`).
3. The "Build and Deploy" action builds the app and publishes it to the `gh-pages` branch.
4. Repository **Settings → Pages**: Source = *Deploy from a branch*, Branch = `gh-pages` / root.
5. The app appears at `https://YOUR-USERNAME.github.io/Kemtan-Tax/`.

## Building locally

```bash
npm install
npm run build
npm start
```

## Project structure

```
src/
  index.jsx, App.jsx, styles.css
  fifo.js            FIFO costing engine + initial state
  tax-calcs.js       tax computation, checks, register builders
  storage.js         localStorage (kemtan-* keys)
  utils.js, health-calcs.js, seedData.js
  components/        one file per tab (TaxTab.jsx is new)
dist/index.html      shell that loads the built bundle.js
```
