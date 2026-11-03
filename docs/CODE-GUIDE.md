# Code guide: how it works and how to change it

Read this together with the code. Every file starts with a comment that says what it does.

## 1. The path of one request (example: a sale)

1. The cashier clicks "Sotish" in `client/src/views/CheckoutView.vue`.
2. The function `sell()` calls `api.post('/sales', {...})` (`client/src/lib/api.js`).
3. In production Netlify passes the request to Render; in development Vite does (`vite.config.js`).
4. `server/src/app.js` sends `/api/sales` to `server/src/routes/sales.js`.
5. `protect` (`middleware/auth.js`) reads the login cookie and loads `req.user`.
6. The route validates the data, calculates prices **from the database** (never trusts the browser),
   then calls `runInTransaction(...)` (`utils/transaction.js`).
7. Inside the transaction: stock is taken out (`services/stockService.js`), the sale is saved,
   the customer's debt is updated. If anything fails, **everything** is undone.
8. The answer goes back; the browser shows the receipt.

## 2. Ideas you must understand

**Stock lives in batches.** `StockBatch` = product + branch + batch number + expiry date + quantity.
The stock of a product in a branch is the sum of its batches. Never change `quantity` anywhere
except in `stockService.js`.

**Every stock change is a movement.** `StockMovement` rows are only added, never edited or deleted.
That is the history shown on the "Harakatlar" page and in the daily report.

**First expired, first out (FEFO).** `removeStock` in `stockService.js` takes from the batch that
expires first. Expired batches are skipped when selling.

**Units.** Prices and stock are always in the product's base unit. An alternative unit has a
factor (1 qop = 50 kg -> 50). `utils/units.js` converts. A sale line stores both the entered
quantity (2 qop) and the base quantity (100 kg).

**Money** is a whole number of so'm. Quantities may have 3 decimals (`utils/money.js`).

**Transactions.** `runInTransaction` makes several database writes succeed or fail together.
The work function can be run twice if MongoDB asks for a retry, so keep it free of side effects
outside the database.

**Branch rules.** `utils/permissions.js`: `getBranchScope` for reading (admin: any/all, others:
own branch) and `getBranchForWrite` for writing. Use them in every new route that touches
branch data.

**Store day.** The report day runs 00:00-24:00 Uzbekistan time. `utils/dates.js` converts between
that and UTC. If the timezone ever changes, change `STORE_UTC_OFFSET_HOURS`.

**Audit log.** `utils/audit.js` writes who changed products, users, units, branches, suppliers and
customers. Sales, returns, purchases and stock changes have their own history.

## 3. Recipes

### Add a field to a product (example: "brand")
1. `server/src/models/Product.js`: add `brand: { type: String, trim: true, default: '' }`.
2. `server/src/routes/products.js`: add `'brand'` to the `allowed` list in `pickProductFields`.
3. `client/src/views/ProductsView.vue`: add `brand` to the `form` object, to `openNew`, `openEdit`,
   to the `body` in `save()`, and an `<input v-model="form.brand">` in the form.
4. Show it in the table if you want.

### Add a new API route
1. Create `server/src/routes/something.js` (copy a small one, e.g. `audit.js`).
2. Register it in `server/src/app.js`: `app.use('/api/something', require('./routes/something'));`
3. Use `protect` and `requireRole(...)`. Use `asyncHandler` for async functions.

### Add a new page
1. Create `client/src/views/SomethingView.vue`.
2. Add a route in `client/src/router/index.js` (with `meta.roles` if needed).
3. Add a menu item in `client/src/components/AppLayout.vue` (`MENU` list).

### Change the sticker design or size
`client/src/style.css` (classes `.label`, `.label-price`, ...), `client/src/components/PrintSheet.vue`
(the HTML) and `client/src/stores/print.js` (`size: 40mm 30mm`).

### Change the receipt
`client/src/components/PrintSheet.vue` (the `receipt` block) and `.receipt` in `style.css`.

### Change the daily report
`server/src/services/reportService.js` collects the data, `pdfService.js` draws the PDF,
`dailyReportJob.js` sends it. `client/src/views/ReportsView.vue` shows it on the screen.

### Change texts
All screen texts are written directly in the `.vue` files; search for the Uzbek text.
Server error messages are in the route files. Names of roles, payment methods and so on
are in `client/src/lib/labels.js` and in `server/src/services/reportService.js`.

### Change the cashier discount limit
`MAX_CASHIER_DISCOUNT_PERCENT` in `.env`.

## 4. Common errors

| Message | Cause |
|---|---|
| `Transaction numbers are only allowed on a replica set member` | You use a local MongoDB. Use Atlas. |
| `MongoServerSelectionError` | Wrong `MONGODB_URI`, or your IP is not allowed in Atlas Network Access. |
| Login works locally but not on Netlify | `netlify.toml` still has `YOUR-RENDER-APP`, or the Render server is asleep (wait, retry). |
| `Telegram xatosi: chat not found` | Wrong `TELEGRAM_CHAT_ID`, or the bot is not in the group. |
| PDF shows broken letters | The fonts in `server/fonts` are missing. |
| "Omborda yetarli qoldiq yo'q" but the stock page shows goods | The goods are in an expired batch, or in another branch. |
| Print dialog shows wrong paper size | Choose the printer's paper (40x30 mm label / 80 mm roll) in the dialog or printer settings. |

## 5. How to debug

- Server: look at the Render logs (or the terminal in development). `console.log(...)` works.
- Browser: open DevTools (F12): "Network" tab shows every request and the server's answer
  (the `message` field), "Console" shows script errors.
- Check the data directly in Atlas ("Browse Collections").
