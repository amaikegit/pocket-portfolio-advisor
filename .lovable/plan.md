

## Plan: Default form values, new projections, and automations

### 1. Default form values for adding dividends
- Initialize `form` state with current month, year, and today's date as defaults when opening the "Add" dialog
- Sort `existingTickers` alphabetically in the Select dropdown

### 2. New projections and analytics (new component: `DividendProjections.tsx`)
Using existing portfolio + dividend data, add a new section with:

- **Projeção de Dividendos 12 Meses**: Based on current DY of each asset, project monthly dividends for the next 12 months (line chart)
- **Crescimento de Dividendos (YoY)**: Compare year-over-year growth rate showing how dividends grew between years (bar chart with %)
- **Cobertura de Dividendos vs Investimento**: Show the ratio of total dividends received vs total invested over time — how long until dividends "pay back" the investment (progress indicator)
- **Renda Passiva Mensal Projetada**: Card showing projected monthly passive income based on current portfolio DY, vs average received

### 3. Automations and improvements

- **Auto-fill dividend amount suggestion**: When user selects a ticker in the add form, show a hint with the last dividend amount registered for that ticker (small helper text below the amount field)
- **Dividend frequency detection**: In the analytics table, add a column showing detected payment frequency per asset (monthly, quarterly, semi-annual) based on historical data

### Technical details

**Files to create:**
- `src/components/dividends/DividendProjections.tsx` — new projections section with charts

**Files to modify:**
- `src/pages/Dividends.tsx`:
  - Change `resetForm()` to set defaults: `{ ticker: "", amount: "", month: (currentMonth).toString(), year: currentYear.toString(), date: new Date().toISOString().slice(0,10) }`
  - Sort `existingTickers` alphabetically: `assets.map(a => a.ticker).sort()`
  - Add `DividendProjections` component to the page
  - Show last dividend hint when ticker is selected in add form
- `src/components/dividends/DividendAnalytics.tsx`:
  - Add "Frequência" column to analytics table showing detected payment frequency

