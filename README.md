# Do'kon boshqaruvi (Store Management System)

A web system for a building-materials store with several branches.

- Products with units (kg, qop, metr ...), QR code stickers (40 x 30 mm) and receipts
- Stock per branch, in batches with expiry dates (first-expired-first-out)
- Receiving goods from suppliers (kirim), transfers between branches
- Checkout with discounts, several payment methods, customer debts (nasiya)
- Returns, debt payments
- Roles: admin, manager, cashier (a manager and a cashier only see their own branch)
- History of every change (who changed what)
- Daily report per branch at 00:00, sent to Telegram as a PDF, also downloadable
- Interface language: Uzbek (Latin). Currency: so'm (UZS). Timezone: Uzbekistan (UTC+5)

**Stack:** Vue 3 + Vite + Pinia + Vue Router (client) | Node.js + Express + Mongoose (server) | MongoDB Atlas

> IMPORTANT: this code was written without being able to install packages or run
> the app. Run it locally first, test every flow with sample data (sale, return,
> debt, transfer, report), and fix the small errors that a first run usually shows.
> See "Test checklist" at the end.

---

## 1. Folder structure

```
store-system/
  server/                 the backend (API)
    server.js             starts everything
    src/app.js            Express app and the list of routes
    src/models/           database collections (Mongoose schemas)
    src/routes/           API endpoints, one file for each part
    src/services/         bigger logic: stock, reports, PDF, Telegram
    src/utils/            small helpers (dates, money, units, audit ...)
    src/middleware/       login check and error handler
    scripts/seed.js       creates the first admin, branch and units
    fonts/                fonts used inside the PDF reports
  client/                 the frontend (what users see)
    src/views/            one file for each page
    src/components/       reusable parts (modal, product search ...)
    src/stores/           shared state (logged-in user, print, lists)
    src/lib/              helpers (api, number formats, labels)
    netlify.toml          Netlify settings
  docs/CODE-GUIDE.md      how the code works and how to change it
```

## 2. Run it on your computer

You need Node.js 18 or newer.

### 2.1 Database (MongoDB Atlas)

1. Create a free account on https://www.mongodb.com/atlas and create a cluster.
2. Database Access: create a database user (username + password).
3. Network Access: allow your IP (and later `0.0.0.0/0` for Render, see section 4).
4. "Connect" -> "Drivers": copy the connection string.

Atlas is needed (not a plain local MongoDB) because the system uses
**transactions**, which need a replica set. Atlas clusters have one.

### 2.2 Server

```bash
cd server
npm install
cp .env.example .env       # then open .env and fill in the values
npm run seed               # creates the admin, the first branch and default units
npm run dev                # starts the API on http://localhost:5000
```

In `.env` you must set at least `MONGODB_URI`, `JWT_SECRET`, `ADMIN_PASSWORD`.
Generate a secret with:
`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`

### 2.3 Client

```bash
cd client
npm install
npm run dev                # opens http://localhost:5173
```

Log in with the admin from `.env` (default username `admin`) and **change the
password** on the "Profil" page.

### 2.4 First setup (in this order)

1. **Filiallar**: add every branch (a warehouse can be a branch with "Omborxona" ticked).
2. **O'lchov birliklari**: check the default units, add the special ones the store uses.
3. **Foydalanuvchilar**: create managers and cashiers and give each a branch.
4. **Mahsulotlar**: add products, or import them from CSV ("Import (CSV)").
   A CSV can include a `quantity` column to load opening stock into the selected branch.
5. **Kirim**: receive goods (or use the import quantity).
6. Print stickers: select products in the list -> "Yorliq chop etish".

## 3. Roles

| Action | Admin | Manager | Cashier |
|---|---|---|---|
| See all branches | yes | own branch only | own branch only |
| Checkout, sales, returns, customers, debt payments | yes | yes | yes |
| Discount limit | none | none | up to `MAX_CASHIER_DISCOUNT_PERCENT` (10%) |
| Products: add, edit, import | yes | yes | no (view only, no cost price) |
| Receive goods, transfer, correct stock | yes | yes (own branch) | no |
| Suppliers, reports, change history | yes | yes (own branch) | no |
| Branches, units, users | yes | no | no |

An admin chooses a branch in the top bar. "Barcha filiallar" means all branches
for reading; to **write** (sell, receive, transfer) the admin must choose one branch.

## 4. Deploy

Order: Atlas (done) -> Render (server) -> Netlify (client) -> Telegram -> scheduler.

### 4.1 Push the code to GitHub

Put the `store-system` folder in a GitHub repository (private). The `.gitignore`
files already keep `.env` and `node_modules` out. NEVER upload `.env`.

### 4.2 Render (backend)

1. New -> Web Service -> connect your GitHub repository.
2. Root Directory: `server`. Build Command: `npm install`. Start Command: `npm start`.
3. Environment variables (copy from `.env`): `NODE_ENV=production`, `MONGODB_URI`,
   `JWT_SECRET`, `JWT_EXPIRES_IN`, `STORE_UTC_OFFSET_HOURS=5`, `STORE_TIMEZONE=Asia/Tashkent`,
   `MAX_CASHIER_DISCOUNT_PERCENT`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, `CRON_SECRET`.
4. In Atlas -> Network Access allow `0.0.0.0/0` (Render has no fixed IP). The database
   user and password still protect it, so use a strong password.
5. Create the first admin by running `npm run seed` ON YOUR COMPUTER with `MONGODB_URI`
   in your local `.env` pointing to the same Atlas database.
6. Test: open `https://YOUR-RENDER-APP.onrender.com/api/health`. It must show `{"status":"ok"...}`.

Render's free plan puts the server to sleep after some idle time; the first request
afterwards can take 30-60 seconds. See 4.5 for how to avoid that.

### 4.3 Netlify (frontend)

1. In `client/netlify.toml` replace `YOUR-RENDER-APP` with your real Render name. Commit and push.
2. Netlify -> Add new site -> import from GitHub. Base directory: `client`.
   Build command `npm run build`, publish directory `dist` (the file already says so).
3. Open the Netlify address and log in.

**Why there is no CORS setup:** `netlify.toml` makes Netlify pass every `/api/...`
request to Render. The browser only talks to the Netlify address, so the login
cookie is a normal same-site cookie. (Netlify's proxy waits about 26 seconds for
an answer, one more reason to keep the Render server awake.)

### 4.4 Telegram

1. In Telegram open `@BotFather`, send `/newbot`, follow the steps, copy the token -> `TELEGRAM_BOT_TOKEN`.
2. Create a group (or use a private chat) for the owner and add the bot to it. Send any message in it.
3. Open `https://api.telegram.org/bot<TOKEN>/getUpdates` in a browser. Find `"chat":{"id": ...}`.
   That number (negative for groups) -> `TELEGRAM_CHAT_ID`.
4. Test: as admin open "Hisobotlar", choose a date and branch, click "Ko'rsatish",
   then "Telegramga yuborish".

Everyone in that group can read the reports. Decide who is in the group.

### 4.5 The 00:00 report and keeping Render awake

A sleeping server cannot run a timer, so use a free external scheduler such as https://cron-job.org:

1. Job 1 (report): `POST https://YOUR-RENDER-APP.onrender.com/api/reports/cron/daily`
   - Header: `x-cron-secret: <your CRON_SECRET>`
   - Schedule: every day at 00:00, timezone `Asia/Tashkent`.
   - Call the Render address directly (not Netlify).
2. Job 2 (keep awake): `GET https://YOUR-RENDER-APP.onrender.com/api/health` every 10 minutes.
   Check Render's current rules for free services before relying on this, or pay for
   an always-on instance, which is the cleanest solution for a real shop.

What happens: the server answers "202" at once and works in the background. For
every active branch it builds the report of the day that just ended (00:00-24:00
store time), makes a PDF, sends it to Telegram, and records it in the database, so
a repeated call never sends the same report twice. One extra report ("Umumiy
o'zgarishlar") lists changes made by the admin. At the end a short status message
shows how many reports were sent and which failed.

The message arrives a few seconds to a minute after 00:00; "exactly 00:00" is not
possible with any hosting. The report always covers the right day.

To run the same job inside the server instead, set `ENABLE_INTERNAL_CRON=true`
(only works if the server is awake at midnight).

## 5. Printing

- **Stickers (40 x 30 mm):** the page sets the paper size itself. In the print
  dialog choose the sticker printer and turn headers/footers off. The QR code contains
  only the product code (SKU).
- **Receipts:** choose the receipt printer and its paper roll (80 mm) in the print
  dialog once; the browser remembers it. The receipt is built for a 72 mm printable width.
- **Scanner:** a USB/Bluetooth 2D scanner works like a keyboard. Click the search box
  on the checkout page (it is focused automatically) and scan; the scanner sends Enter at the end.
- **Phone camera:** the "Kamera" button on the checkout page (needs https, which Netlify gives).

Printer model: start with a cheap USB thermal label printer that installs as a normal
Windows/Mac printer. If it does not, tell me the model and we will look at its driver or SDK.

## 6. Test checklist (do this before the client uses it)

1. Log in as admin, create a branch, a manager and a cashier, log in as each.
2. Add 3 products (one with an alternative unit, one with expiry tracking).
3. Receive stock (Kirim) with batch numbers and an expiry date.
4. Sell at the cashier: cash only, then split payment, then credit (nasiya) with a customer.
5. Check "Qoldiq" went down, and "Harakatlar" shows the movements.
6. Return one item of a sale; check stock went back and the debt/refund is right.
7. Pay part of a debt in "Mijozlar va qarzlar".
8. Transfer goods to another branch; check both branches' stock.
9. Open "Hisobotlar" for today, download the PDF, send to Telegram.
10. Print a sticker and a receipt on the real printers.
11. Try to sell more than the stock (must be refused) and an expired batch (must be skipped).

## 7. Safety and maintenance

- Use long, unique passwords. Change the seeded admin password.
- Keep `.env` secret. If a secret was ever shown or pushed, replace it.
- Turn on backups for the database (check what your Atlas plan offers; free clusters
  have limited backup options). Consider a regular export.
- Nothing is ever deleted from sales, movements or debts: mistakes are fixed with returns
  and stock adjustments, so the history (and the Telegram reports) stay trustworthy.

## 8. Known simplifications

- Transfers happen at once (no "sent / received" confirmation step).
- No supplier debts, no tax/VAT, no multi-currency.
- Stock quantities are decimals (3 digits); extremely rare rounding differences are possible.
- Prices are the same in all branches.
- It works online only (no offline mode).
