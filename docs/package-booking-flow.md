# Guest travel package booking

## Product brief

Add a public package collection to the Headies x Wakanow homepage with bookings and payments open now. A guest chooses a package, reviews its inclusions and available booking details on a dedicated page, enters contact and travel preferences, and pays through Paystack without creating an account. A verified payment produces a recoverable order reference. The travel team manages fulfilment in the admin workspace.

## Customer journey

1. **Discover:** compare Value, Premium and VIP on the homepage. Display the current NGN price in accessible text alongside redesigned flyers.
2. **Review:** open `/packages/value`, `/packages/premium` or `/packages/vip`. Explain inclusions, featured hotel options and any supplied departure city, dates, nights and booking terms. Do not invent missing travel or refund details. Hotel options are not a confirmed reservation.
3. **Provide details:** collect lead traveller full name, email, international phone number and traveller count. Require a preferred departure city when the package does not specify an origin; otherwise use the configured city. Collect optional preferred travel date, room preference and special requests. Require acknowledgement of the displayed package details. Card and bank details are entered only in Paystack.
4. **Pay:** calculate the total on the server and open Paystack on the same page. Reuse the existing payment session when a guest cancels or reloads. Do not create another charge automatically.
5. **Confirm payment:** verify reference, amount, currency and booking metadata on the server. A valid signed Paystack webhook can also reconcile a payment after the browser closes. A browser callback alone never marks an order paid.
6. **Fulfil:** show payment received and the booking reference; distinguish this from confirmed flights, accommodation or event tickets. Staff can view, filter and export orders, contact guests and update fulfilment status.

## Catalogue transcribed from the supplied flyers

| Package | Advertised starting price | Featured hotel options |
| --- | ---: | --- |
| 3-Star Value | ₦4,044,000 | Holiday Inn; Courtyard by Marriott; Chelsea Hotel |
| 4-Star Premium | ₦3,398,000 | Pantages Hotel; DoubleTree by Hilton; Delta Hotels |
| 5-Star VIP | ₦7,077,000 per person | 1 Hotel Toronto; Park Hyatt Toronto; The Ritz-Carlton |

All three flyers list flights, hotels, transfers, insurance and Headies access. The original artwork is source material for the catalogue and visual redesign. It does not supply travel dates, number of nights, departure city, room basis, flight class or cancellation terms. The owner has confirmed that sales are open; the current checkout uses the listed amounts per person.

## Additional package information

- Preserve the supplied price ordering unless the owner provides corrected prices.
- Display dates, departure city and stay duration when supplied; otherwise record customer preferences and leave exact arrangements unspecified.
- Publish supplied occupancy, flight, insurance and event-access details without inventing specific entitlements. The quantity calculation uses one per-person rate; variable room/child supplements require their own priced options.
- Publish cancellation/refund terms when supplied; no policy is fabricated.

Missing travel dates, duration or commercial terms do not close checkout. Sales are open by default and can be paused explicitly with `CHECKOUT_ENABLED=false`; an invalid price override also pauses payment. The application can be tested with local sample details and a fake payment provider without charging a customer.

## Data and operational choices

- Collect only the information required to create and follow up a booking. Passport scans, passport numbers and other travellers’ documents are outside initial checkout.
- Store the package, price and terms accepted with the order so later catalogue changes cannot alter an existing payment.
- Use an opaque guest token for receipt access. A booking reference alone does not reveal personal details.
- Separate payment status from fulfilment status. Cancellation is not an automatic refund.
- Keep existing visa login, nominee pricing and visa-document handling separate from package bookings.
- The full-resolution flyer PNGs are downloadable project assets; optimised JPEGs are used on the website. Exact artwork prompts are in `package-flyer-prompts.md`.

See `package-bookings-operations.md` for checkout configuration, migration and the webhook endpoint.
