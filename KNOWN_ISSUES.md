# Known Issues and Recommended Improvements

Found while documenting the codebase. Ordered roughly by impact.

## Setup blockers

| # | Issue | Where | Fix |
|---|---|---|---|
| 1 | `stock_by_location` table is used throughout but not created by `schema.sql`. | `schema.sql` | Add it — SQL in [DATABASE.md](DATABASE.md#required-schema-fixes). |
| 2 | `stock_moves.from_location` / `to_location` are `text` with no FKs, but pages join via `stock_moves_*_location_fkey`. | `schema.sql` | Convert to `uuid` FKs — SQL in [DATABASE.md](DATABASE.md#required-schema-fixes). |
| 3 | `turbopack.root` is hard-coded to `/Users/preetham/Desktop/OStock`. | `next.config.ts` | Remove it or use `path.resolve(__dirname)`. |

## Security

| # | Issue | Fix |
|---|---|---|
| 4 | RLS policies allow **anonymous** full read/write on every table; login is only enforced in the web UI. | Restrict policies to the `authenticated` role (see [DATABASE.md → Security](DATABASE.md#security)). |

## Data integrity

| # | Issue | Where |
|---|---|---|
| 5 | Stock updates are several separate client-side requests (read → compute → write qty → write location → update status) with no transaction. A network failure midway can leave `qty_on_hand`, `stock_by_location` and the move status out of sync, and errors from the intermediate writes are not checked. | receipts/[id], deliveries/[id], transfers modal, adjustments |
| 6 | Read-modify-write race: two users validating at the same time can overwrite each other's quantity update. | same as above |
| 7 | Adjustments compute the new total from the product list loaded when the page opened, not a fresh read, so the total can be stale. | `app/adjustments/page.tsx` |
| 8 | If a product has no `stock_by_location` row for the chosen location, adjustments treat the product's **total** on-hand as that location's recorded quantity, which misstates the delta when stock is spread across locations. | `app/adjustments/page.tsx` |
| 9 | Delivery validation checks the **total** on-hand, not stock at the source location; the location row can be driven to 0 while stock physically sits elsewhere. | `app/deliveries/[id]/page.tsx` |

**Recommended fix for 5–9:** move each operation into a PostgreSQL function (e.g. `validate_receipt(move_id)`, `validate_delivery(move_id)`, `create_transfer(...)`, `apply_adjustment(...)`) that runs in one transaction with row locks (`select … for update`), and call it via `supabase.rpc(...)`.

## Functional gaps

| # | Issue | Where |
|---|---|---|
| 10 | `FilterBar` writes filters to the URL / a state setter, but no page reads them, so filters have no effect on the data shown. | dashboard, receipts, deliveries, transfers, history |
| 11 | "Internal transfers scheduled" KPI counts transfers in `draft`/`waiting`, but transfers are always created as `done`, so it is always 0. | `app/dashboard/page.tsx` |
| 12 | "Pending receipts/deliveries" KPIs count everything not `done`, including **canceled** moves. | `app/dashboard/page.tsx` |
| 13 | Multi-line receipts/deliveries are stored as independent moves sharing a reference; each line must be advanced and validated separately. | receipts, deliveries |

## Housekeeping

- `package.json` name is `"odoo"` — rename to `"ostock"`.
- `components/common/TeammatePlaceholder.tsx` is no longer used by any route.
- `utils/supabase/server.ts` is not used yet (all pages are client components).
- No automated tests. Worth adding at least for the stock arithmetic once it moves into database functions.
