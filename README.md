# The Headies × Wakanow

Angular customer website with a Node API, guest travel-package checkout, visa applications and admin workspaces.

## Run locally

```bash
npm ci
npm run build
npm start
```

Open `http://127.0.0.1:8756`. Use `PORT` to change the local port. Run `npm test` for regression tests. A Paystack server key is required to open a real payment checkout; do not put it in browser code.

## Customer and admin pages

- `/`: compact Value, Premium and VIP packages, plus custom travel enquiries.
- `/packages/:slug`: package details and no-login guest checkout.
- `/package_admin`: protected package dashboard with customer details, payment status, totals, search, CSV export and fulfillment updates. Uses the existing admin/superadmin login.
- `/visa`: the existing visa application flow.
- `/admin`: the combined travel/visa admin workspace, including the package bookings tab.

## Where bookings are stored

With `DATABASE_URL` configured, package orders are saved server-side in the PostgreSQL **`package_bookings`** table. The current production database is **`headies_wakanow`**. Records include customer contact details, the saved package/price/terms, Paystack reference, payment status and fulfillment status. Visa applications and their documents remain in separate tables.

For isolated local development without `DATABASE_URL`, the JSON fallback uses `packageBookings` in `.data/store.json`, or the location supplied by `WKN_STORE_FILE`/`WKN_DATA_DIR`. Production must keep its PostgreSQL configuration; browser storage is not the booking database. The browser retains only an opaque guest receipt token/reference and checkout key in its session storage.

Run the additive database migration before deploying the package API. Payment status is verified on the server; recording payment does not issue tickets or confirm the itinerary. See [package operations](docs/package-bookings-operations.md) for configuration and the signed Paystack webhook endpoint.

## Deployment

The existing production origin is `https://headies.wakanow.com`. Releases run through `headies-wakanow.service` with the existing protected server environment and a versioned release directory. Do not copy local test bookings or test credentials to production. Preserve the previous release for rollback and retain the additive bookings table.
