# StockWise — Stock & Billing Management System

A lightweight full-stack stock and billing application for small retail, wellness, and nutrition businesses. StockWise brings product inventory, customer billing, discount calculations, and bill history into one browser-based interface.

> **Project status:** Personal learning and portfolio project. Review the security, tax rules, and backup process before using it for business-critical or public production workloads.

## Overview

StockWise is built with a React frontend served by a Node.js/Express backend. The backend communicates with a Google Apps Script web app, which reads and writes data in Google Sheets.

```text
Browser
  │
  │ HTTP requests to /api/*
  ▼
React frontend (frontend/)
  │
  ▼
Node.js + Express (backend/server.js)
  │
  │ SCRIPT_URL + SCRIPT_TOKEN
  ▼
Google Apps Script Web App (apps-script/Code.gs)
  │
  ▼
Google Sheets
  ├── Products
  └── Bills
```

The browser does not connect directly to Google Sheets. API requests go through the Express backend, keeping the Apps Script token out of frontend JavaScript.

## Features

### Product and stock management
- Add a product with its name, SKU/code, MRP, Volume Points (VP), GST rate, and opening stock.
- Optionally attach a product photo. The browser resizes the image before sending it to the backend.
- View the product list and available quantity.
- Add stock to an existing product.
- Products with a stock quantity of 5 or less are marked as low stock in the interface.

### Billing
- Enter customer name and phone number.
- Enter the customer's previously accumulated monthly VP.
- Add products and quantities to a bill. The interface prevents adding more than the displayed available stock.
- Calculate VP, tier-based discount, optional extra discount, taxable value, included GST, and bill total.
- Save a bill and display its invoice.
- Print the invoice using the browser's print dialog.

### Bill history
- Retrieve previously saved bills.
- Review bill number, date, customer, total VP, discount percentage, and grand total.

### Configurable discount tiers
- The frontend retrieves discount tiers from the backend (`GET /api/tiers`).
- The calculation uses the customer's previous monthly VP plus VP in the current bill to select the applicable tier.
- Configure tier thresholds and percentages in `backend/billing.js` and verify that they match the rules applicable to your business before use.

## Technology stack

| Layer | Technology | Responsibility |
|---|---|---|
| Frontend | React 18, JSX, HTML, CSS | User interface and bill preview |
| Backend | Node.js, Express | API routes and application logic |
| Integration | Google Apps Script | Secure server-to-Sheets communication |
| Data storage | Google Sheets | Product and bill records |
| Development | npm, Git, GitHub | Dependencies and version control |

## Project structure

```text
stockwise/
├── apps-script/
│   └── Code.gs             # Google Apps Script web app
├── backend/
│   ├── server.js           # Express server and API routes
│   ├── billing.js          # Billing calculations and discount tiers
│   ├── package.json        # Backend dependencies and scripts
│   ├── package-lock.json
│   └── .env                # Local secrets; create this yourself (not committed)
├── frontend/
│   ├── index.html          # HTML entry point and React/Babel loading
│   ├── app.jsx             # React application
│   └── style.css           # Application styles
├── .gitignore
├── package.json
└── README.md
```

## Prerequisites

- Node.js 18 or later (Node.js 20+ recommended).
- npm.
- A Google account to create the spreadsheet and Apps Script project.
- Git (optional, for cloning the repository).

Check your installation:

```bash
node --version
npm --version
```

## Setup guide

### 1. Get the source code

Clone the repository:

```bash
git clone https://github.com/Dhanrajdk79/morya-wellness-center.git
cd morya-wellness-center
```

Alternatively, download the repository ZIP from GitHub and extract it.

### 2. Create the Google Sheet

1. Create a new Google Spreadsheet for the application.
2. Open **Extensions → Apps Script**.
3. Copy the contents of `apps-script/Code.gs` into the Apps Script editor.
4. Save the Apps Script project.
5. Follow the sheet/tab names and headers used by the supplied script. Avoid renaming columns or tabs unless you also update the script.

The Apps Script code is the source of truth for the sheet structure and the operations supported by the backend.

### 3. Configure the Apps Script secret

Use a private secret shared only between the backend and Apps Script. Do not put the secret in `frontend/app.jsx`, commit it to Git, or paste it into public issue reports.

Recommended approach:

1. In Apps Script, open **Project Settings → Script Properties**.
2. Add a property named `SCRIPT_TOKEN` and set its value to a long, randomly generated secret.
3. Ensure `Code.gs` reads the token from Script Properties (for example, with `PropertiesService.getScriptProperties().getProperty('SCRIPT_TOKEN')`) rather than containing a hard-coded production secret.
4. Use the exact same value for `SCRIPT_TOKEN` in the backend `.env` file.

If the supplied `Code.gs` still contains a placeholder token constant, update the code to read the Script Property before deploying.

### 4. Deploy the Apps Script web app

1. In Apps Script, select **Deploy → New deployment**.
2. Select **Web app** as the deployment type.
3. Set **Execute as** to **Me**.
4. Set access according to your security requirements. The backend must be able to reach the deployed endpoint; an endpoint accessible to anyone on the internet must be protected by the shared token and should not be treated as a public user API.
5. Deploy and approve the requested Google permissions.
6. Copy the Web app URL ending in `/exec`.

When changing Apps Script code, create a new deployment version using **Deploy → Manage deployments → Edit → New version → Deploy**. Keep the deployed URL and backend configuration in sync.

### 5. Configure the backend environment

Create `backend/.env` (do not commit this file):

```env
PORT=3000
SCRIPT_URL=https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec
SCRIPT_TOKEN=YOUR_LONG_RANDOM_SECRET
```

Replace the example URL and secret with your own values. The `SCRIPT_TOKEN` must match the Script Property configured in the previous step.

Install dependencies and start the server:

```bash
cd backend
npm install
npm start
```

Open the application in your browser:

```text
http://localhost:3000
```

Keep the terminal window open while using the local application. Stop the server with `Ctrl + C`.

### Windows PowerShell note

If you need to create `.env` from an example file, use:

```powershell
Copy-Item .env.example .env
```

Then edit `.env` with your own values. Do not share screenshots that expose the secret.

## Application flow

### Stock flow

1. When the page loads, React requests `GET /api/products`.
2. Express forwards the request to the Apps Script integration.
3. Apps Script reads product records from Google Sheets and returns them to the backend.
4. The frontend displays the product list and current quantities.
5. When a new product is submitted, the frontend sends `POST /api/products` with the product fields and optional resized image data.
6. To add quantity to an existing product, the frontend sends `POST /api/products/:id/stock` with the quantity to add.
7. After a successful change, the frontend reloads the product list.

### Billing flow

1. The billing screen loads the configured discount tiers using `GET /api/tiers`.
2. The user enters customer details and any previous monthly VP.
3. The user selects products and quantities. The UI checks the requested quantity against the currently loaded stock.
4. The frontend calculates a live bill preview, including VP, applicable tier discount, optional extra discount, taxable amount, included GST, and total.
5. On save, the frontend sends `POST /api/bills` with customer information and cart items.
6. The backend performs the billing operation and uses Apps Script to persist the bill and update inventory in Google Sheets.
7. The saved invoice is displayed; the user can print it.
8. The product list is refreshed so the updated stock is visible.

### Past-bills flow

1. The history screen sends `GET /api/bills`.
2. The backend requests bill records through Apps Script.
3. The frontend displays the returned bill history.

## API routes used by the frontend

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/products` | Retrieve products and stock |
| `POST` | `/api/products` | Add a product |
| `POST` | `/api/products/:id/stock` | Add stock to a product |
| `GET` | `/api/tiers` | Retrieve billing discount tiers |
| `POST` | `/api/bills` | Save a bill and process stock changes |
| `GET` | `/api/bills` | Retrieve saved bills |

These routes describe the requests used by the current frontend. Check `backend/server.js` for the authoritative implementation and request validation.

## Configuration and business rules

- The current frontend offers GST rate choices of 0%, 5%, 12%, 18%, and 28% when adding a product.
- GST is treated as included in the discounted amount in the displayed bill calculation.
- Discount tiers are retrieved from the backend and selected using previous monthly VP plus the current bill's VP.
- An optional extra discount can be entered for a bill.
- The low-stock indicator is shown when available stock is 5 units or fewer.

These are application behaviours, not tax or accounting advice. Confirm tax treatment, applicable GST rates, discount eligibility, and any loyalty/VP programme rules with the relevant qualified source before issuing real invoices.

## Troubleshooting

### `Cannot GET /`
- Confirm that the Express server serves the `frontend` directory.
- Start the backend from the `backend` folder using `npm start`.
- Check the terminal for startup errors and open `http://localhost:3000`.

### Products or bills do not load
- Check that the Apps Script deployment URL ends in `/exec`.
- Confirm that `SCRIPT_URL` and `SCRIPT_TOKEN` are present in `backend/.env`.
- Confirm the token matches the Apps Script Script Property.
- Check that the latest Apps Script code has been deployed as a new version.
- Review the Node.js terminal and Apps Script execution logs for errors.

### Changes to Apps Script do not appear
Save the code, create a new deployment version, and deploy it. Saving the editor alone does not update an existing versioned web-app deployment.

### `npm` is blocked in PowerShell
If PowerShell reports that `npm.ps1` cannot run because script execution is disabled, use Command Prompt, or use an approved PowerShell execution-policy approach for your machine. Do not change security policy globally without understanding the implications.

## Security, privacy, and production checklist

This project is a starting point and should be hardened before internet-facing use:

- Add authentication and authorization to the Express API. The current frontend/API flow should not be assumed to include user login.
- Keep `.env`, Apps Script secrets, and deployment credentials out of GitHub.
- Restrict who can access the application and the spreadsheet.
- Use HTTPS when hosting outside your local machine.
- Validate all product, quantity, customer, and billing data on the server; never rely only on browser-side checks.
- Add rate limiting and request-size limits where appropriate.
- Back up the Google Sheet regularly and test restoring a backup.
- Review Apps Script permissions and avoid exposing administrative spreadsheet access.
- Test concurrent bill creation and stock updates before multiple people use the app.
- Confirm that bill saving and stock updates behave consistently if a network request fails partway through.
- Do not store unnecessary personal information. Protect customer phone numbers and transaction records.

## Deployment options

The application can run locally on a computer that has Node.js installed, or on a Node.js-compatible server. For a local always-on server, keep the computer powered on, connected to the network, and prevent it from sleeping. For remote access, use HTTPS and a secure tunnel or properly configured hosting; do not expose the development server directly to the public internet without security controls.

## Contributing

Contributions and suggestions are welcome:

1. Fork the repository.
2. Create a feature branch.
3. Make and test your changes.
4. Open a pull request describing the change.

Please do not include real customer information, spreadsheet data, credentials, or `.env` files in commits or screenshots.

## Author

**Dhanraj Kshirsagar**  
GitHub: [@Dhanrajdk79](https://github.com/Dhanrajdk79)

## Repository

[https://github.com/Dhanrajdk79/morya-wellness-center](https://github.com/Dhanrajdk79/morya-wellness-center)

---

If you find this project useful, consider starring the repository or suggesting an improvement.
