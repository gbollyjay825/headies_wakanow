# Guest package bookings

The home page and `/packages/:slug` expose three travel packages without a visa account or login. Package payments and fulfillment use their own `package_bookings` table and do not modify visa applications.

## Sales and package configuration

The owner has confirmed that bookings and payments are open now. The current per-person charge is Value ₦4,044,000, Premium ₦3,398,000 and VIP ₦7,077,000, using the supplied flyer figures. Premium remains lower than Value as shown in the source. A configured price override can change a tier's charge without changing existing booking snapshots.

Travel dates, departure city, duration, room occupancy, flight and baggage allowance, hotel allocation/availability, transfer scope, insurance cover, Headies ticket/access category, visa treatment and cancellation/refund terms are not invented where the source is silent. The team can provide these details through the optional configuration below and during fulfillment. Hotel names are options from the source flyers, not reservations. A payment receipt does not imply a visa guarantee or ticket/hotel confirmation.

Checkout is open by default. Only an explicit `CHECKOUT_ENABLED=false` or an invalid configured price override pauses sales in the catalogue. `PRICE_CONFIRMED` is no longer used. Dates, nights, departure city and terms are optional catalogue information and do not gate payment. The Paystack secret is still required for the server to initialize an actual payment.

| Setting | Behavior |
| --- | --- |
| `PACKAGE_CHECKOUT_ENABLED` | Optional; only the exact value `false` pauses sales |
| `PACKAGE_TRAVEL_DATES` | Optional confirmed, customer-readable dates; blank when unset |
| `PACKAGE_DEPARTURE_CITY` | Optional configured origin; otherwise checkout requires the customer's preferred departure city |
| `PACKAGE_NIGHTS` | Optional integer from 1 to 90; unspecified when unset or invalid |
| `PACKAGE_TERMS` | Optional supplied booking terms; no cancellation/refund policy is fabricated when unset |
| `PAYSTACK_SECRET_KEY` | Existing Paystack server secret; use test mode before live launch |
| `PUBLIC_SITE_URL` | Site origin for the return URL, e.g. `https://headies.wakanow.com` |

Any package setting may be overridden per tier using `PACKAGE_VALUE_…`, `PACKAGE_PREMIUM_…` or `PACKAGE_VIP_…`. For example, `PACKAGE_VALUE_CHECKOUT_ENABLED=false` pauses Value while Premium remains open. `PACKAGE_VALUE_PRICE_NAIRA`, `PACKAGE_PREMIUM_PRICE_NAIRA` and `PACKAGE_VIP_PRICE_NAIRA` override the source flyer prices with positive whole-naira amounts. An invalid nonempty price override keeps the source figure visible but disables payment until corrected. `PACKAGE_PRICE_NAIRA` is a shared fallback; tier-specific prices are recommended. Prices are server-authoritative, multiplied by 1–6 travellers, and charged in NGN kobo. Preferred departure city, room preference and special requests are recorded for fulfillment and do not change the price or guarantee an allocation.

The project's existing `PUBLIC_APP_URL`, then `APP_BASE_URL`, are supported as fallbacks for `PUBLIC_SITE_URL`; otherwise the production origin is used. Do not put Paystack secrets in browser variables or source files.

## Storage and launch

Run `npm run db:migrate` against the target Postgres database before starting the new server. The additive table uses `bigint` totals because group bookings may exceed the signed 32-bit integer range. The existing JSON store remains supported for isolated development; production should use the existing Postgres connection. Existing visa data is untouched.

Run `npm test` and `npm run build`. Exercise a Paystack test transaction, cancellation, page reload and webhook as part of deployment verification. `PACKAGE_TEST_DATABASE_URL` can point the package regression tests at a disposable migrated Postgres database; never point tests at production.

## Paystack webhook and return

Configure the Paystack dashboard webhook URL as:

`https://headies.wakanow.com/api/payments/paystack/webhook`

The server verifies the SHA-512 `x-paystack-signature` against the exact raw request bytes. It accepts only correctly bound package references (`hwpkg-…`) and verifies the booking ID, package slug, reference, amount and NGN currency. Unrelated events, including visa references, are acknowledged without changing records. Repeated success events are idempotent; a later failed or pending verification cannot downgrade a recorded payment.

The return URL is `/packages/:slug?payment=return`; Paystack supplies its reference. A redirect or popup callback alone never marks a booking paid. Server verification or a correctly signed success webhook is required. If using a hosting adapter other than the bundled Node server, ensure it supplies an unchanged `Buffer` as `req.rawBody`; a pre-parsed JSON body cannot authenticate a webhook and is rejected. The serverless adapter disables body parsing and also accepts a raw string/Buffer body supplied by the host.

## Recovery and customer information

The browser generates a random 32-byte access token and an idempotency key before checkout. Only their hash (for the token) and the idempotency key are stored on the server; the raw token is kept in the customer's browser session alongside the reference. Customer name, email and phone are required; optional preferred date, room preference and special requests are recorded. When no package origin is configured, `departureCity` is a required, trimmed 2–120-character preferred city and is saved with the booking. A configured origin remains authoritative and supplied customer input must match it. No passport, payment-card data or visa login is collected by this flow.

`POST /api/package-bookings/status` accepts `{reference, bookingToken}` or `{idempotencyKey, bookingToken}`. The latter recovers an interrupted first response before the browser has a reference. `POST /api/package-bookings/verify` uses the same credentials and checks Paystack. The token must be retained to access the guest receipt; guessing a reference alone gives no access. A repeated initialize call requires the original token and cannot change the package, price snapshot, traveller count, customer details or saved preferences, including departure city. Replay validation uses the booked snapshot, so a later catalogue origin change does not block recovery. Status responses include a reusable Paystack access code only for pending, non-cancelled transactions with a successfully initialized checkout.

If initialization times out, the saved booking remains Pending because the provider may have accepted the request. The API returns the booking/token with the error where possible. Check status before another checkout. If the provider accepted the transaction but no checkout response can be recovered, admin reconciliation with Paystack is needed; do not manually mark it Paid. Failed or abandoned attempts may start a new checkout with a new idempotency key.

The admin bookings list shows payment separately from fulfillment. Admins can update fulfillment, but cannot fabricate or erase payment status. Payment received, Contacted and Confirmed require verified payment. Paid bookings cannot return to Awaiting payment. The receipt says payment was received; the travel team must still confirm reservations. Admin exports omit booking access secrets and include the customer contact details needed for fulfillment.

## Current scope

This flow has no automated ticket issuance, inventory reservation, price quotation engine, refund operation or outbound email receipt. Payment receipt/status is available in the browser and the team can find the booking in admin. The existing public API and admin passcode architecture is reused. Configure gateway/edge abuse controls appropriate to live payment traffic. Keep customer access tokens out of logs, analytics and shared URLs.
