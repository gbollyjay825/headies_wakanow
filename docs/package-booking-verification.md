# Package booking verification — 5 September 2026

## Implemented

- Three homepage package cards and redesigned flyer assets.
- Public package details, hotel options, inclusions and commercial terms.
- No-login guest checkout with lead traveller contact details, quantity and preferences.
- Server-authoritative NGN totals, Paystack initialization and verification, signed webhook reconciliation.
- Private, resumable browser-session receipts; separate payment and travel fulfillment states.
- Admin booking filters, customer details, fulfillment updates and CSV export.

## Checks completed

- `npm test`: 36 passing tests, including existing visa and Nominees regressions, open-by-default sales, preferred-origin validation and invalid-price configuration protection.
- `npm run build`: production Angular build passes.
- `git diff --check`: passes.
- Package tests against both isolated JSON storage and a disposable Postgres database. The additive schema migration was run twice. Six-person VIP totals of 4,246,200,000 kobo were stored correctly; the temporary database was removed after testing.
- Real local HTTP adapter test verifies raw webhook signature handling and `private, no-store` guest receipt responses.
- Isolated Chrome browser checks at desktop and 390px mobile widths: homepage artwork loads, homepage/details navigation, required-field validation, responsive form and receipt without horizontal overflow.
- Two-person Premium test booking totals ₦6,796,000. Closing checkout and reloading recovers the same booking. Resuming and completing the simulated provider flow produces a server-verified Paid receipt.
- Admin can see the test order and correct gross payment total, change fulfillment to Contacted, and download a CSV containing the contact details and saved package terms without access secrets.
- API checks confirm default configuration opens checkout while leaving dates, nights, origin and terms unspecified. Preferred departure city is required and stored when no origin is configured; the configured-origin restriction and immutable checkout recovery remain enforced. An unknown package displays a recoverable error with navigation back to the collection.
- Mobile booking and terms shortcuts stay on the package page and preserve entered customer details. Conditional field-error descriptions reference only existing elements.
- After the owner's open-now confirmation, browser checks verify the Pay button is enabled without itinerary metadata, the preferred departure field is editable, and no coming-soon copy is shown. Compact homepage cards measure 514px high at a 1440px desktop viewport and 490px at 390px mobile, without horizontal overflow. Full flyer artwork remains available on the details page.

Browser payment tests used an isolated local store, a fake Paystack API, a stub checkout SDK and clearly labelled test travel terms. They made no external payment calls and charged no money. These checks do **not** replace an actual Paystack test-mode transaction and webhook check on the deployed environment.

## Release requirements

The owner has confirmed bookings and payments are open now; checkout is enabled by default at the current package prices. It collects a preferred departure city when no origin is configured and does not invent travel dates or refund terms. Explicit sales pauses and invalid-price protection remain available. Production must retain its PostgreSQL and live Paystack environment, with the additive `package_bookings` table created before release activation. The protected dashboard is `/package_admin`. See `package-bookings-operations.md` for environment settings and launch checks.
