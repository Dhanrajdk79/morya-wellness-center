# Morya Wellness Center – Stock & Billing

## 1. Google Sheet + Apps Script
1. Create a new Google Sheet. Open Extensions > Apps Script.
2. Paste `apps-script/Code.gs`. Change `TOKEN` to your own secret.
3. Run `doPost` once manually is not needed; instead: Deploy > New deployment > Web app,
   Execute as **Me**, Access **Anyone**. Authorise Drive + Sheets when asked. Copy the `/exec` URL.
   (After any code change, use Deploy > Manage deployments > Edit > New version.)

## 2. Backend
```
cd backend
npm install
cp .env.example .env     # fill SCRIPT_URL and SCRIPT_TOKEN
npm start
```
Open http://localhost:3000 (Express also serves the React frontend). Needs Node 18+.

## 3. Billing rules (backend/billing.js)
- Discount % comes from VP tiers: 0 VP = 25%, 500 = 35%, 1000 = 42%, 2000 = 50%.
  Edit `TIERS` to match your current Herbalife India structure.
- "VP already bought this month" is added to the bill's VP to pick the tier.
- MRP is GST-inclusive: GST = net x rate / (100 + rate). Optional extra discount applies after the tier discount.
- The server re-reads prices from the sheet and recalculates, then reduces stock.
