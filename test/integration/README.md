# Tests

| File | What it covers |
|---|---|
| `test/services.test.ts` | Business rules against a real (temporary) local store: seeding, registration validation, tamper detection, offers → orders, buy-now and the order lifecycle, auctions (increments, outbid notifications, settlement). |
| `test/integration/e2e-validation-scenarios.test.ts` | Harvest-date validation scenarios end to end. |
| `test/property-based/date-validation.test.ts` | Property-based checks of the date validator (fast-check). |
| `lib/validation/date-validator.test.ts` | Unit tests for the date validator. |

Run everything with `npm test`. Service tests run in Node against an isolated temp data directory (`S2S_DATA_DIR`), so they never touch your local demo database.
