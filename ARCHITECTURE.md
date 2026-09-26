# Architecture

This document explains how OStock is put together and — most importantly — exactly how each operation changes stock levels.

## Overview

```
 Browser (React client components)
   │  supabase-js (publishable key + user session cookie)
   ▼
 Supabase
   ├── Auth        — users, sessions, password reset
   └── PostgreSQL  — warehouses, locations, categories, products,
                     stock_moves, stock_by_location (RLS enabled)

 Next.js server
   └── proxy.ts → utils/supabase/middleware.ts
                  refreshes the session cookie and guards routes
```

OStock has **no custom API layer**. Every page is a client component (`'use client'`) that talks to Supabase directly with the browser client from [`utils/supabase/client.ts`](../utils/supabase/client.ts). All business logic (stock calculations, validation rules) runs in the browser, in the page/modal components.

The server-side client in [`utils/supabase/server.ts`](../utils/supabase/server.ts) exists for future Server Components but is not used by any page yet.

## Authentication and route protection

1. **Every request** (except static assets) passes through [`proxy.ts`](../proxy.ts), which calls `updateSession()` in [`utils/supabase/middleware.ts`](../utils/supabase/middleware.ts).
2. `updateSession()` creates a server Supabase client bound to the request cookies and calls `supabase.auth.getUser()`, which refreshes the session token if needed.
3. Routing rules:
   - `/` → `/dashboard` if logged in, otherwise `/login`.
   - Not logged in and not on `/login`, `/signup`, `/reset-password` → redirect to `/login`.
   - Logged in and on one of those auth pages → redirect to `/dashboard`.
4. If the Supabase env vars are missing, the proxy returns early and **no route protection is applied**.

Auth features used:

| Page | Supabase call |
|---|---|
| `/login` | `auth.signInWithPassword` |
| `/signup` | `auth.signUp` (stores `name`/`full_name` in user metadata) |
| `/reset-password` | `auth.resetPasswordForEmail` (redirects back to `/reset-password?step=update`), `auth.verifyOtp` (type `recovery`) for the 6-digit code path, `auth.updateUser` to set the new password. Also listens for the `PASSWORD_RECOVERY` auth event. |
| `/profile` | `auth.getUser`, `auth.updateUser` (name, password), `auth.signOut` |
| `AppShell` | `auth.getUser` for the header, `auth.signOut` |

> Route protection is UI-level only. The database policies currently allow any client with the public key to read and write. See [DATABASE.md → Security](DATABASE.md#security).

## Layout and shared components

- **[`AppShell`](../components/navigation/AppShell.tsx)** wraps every authenticated page: sidebar with navigation groups (Dashboard, Products, Operations → Receipts/Deliveries/Transfers/Adjustments/Move History, Settings → Categories/Warehouses), top bar with the user's name, and a mobile drawer.
- **[`FilterBar`](../components/filters/FilterBar.tsx)** — dropdowns for move type, status, warehouse and category. It loads warehouses/categories from Supabase and can either call an `onChange` callback or sync the values to the URL query string (`syncUrl`). *Currently no page reads these values back, so the filters do not yet affect the displayed data* (see [KNOWN_ISSUES.md](KNOWN_ISSUES.md)).
- **[`TeammatePlaceholder`](../components/common/TeammatePlaceholder.tsx)** — a "section under construction" page used during team development; not referenced by any route now.
- **[`types/index.ts`](../types/index.ts)** — shared types: `Product`, `StockMove`, `MoveType`, `MoveStatus`, `Warehouse`, `Location`, `ProductCategory`/`Category`, `StockByLocation`.

## Stock model

Stock is tracked at two levels:

| Level | Where | Meaning |
|---|---|---|
| **Total on hand** | `products.qty_on_hand` | Total quantity of a product across all locations. |
| **Per location** | `stock_by_location.qty` (unique per `product_id` + `location_id`) | Quantity of a product at one specific location. |

Every change is also recorded as a row in **`stock_moves`**, which acts as the ledger (`move_type` = `receipt` / `delivery` / `internal` / `adjustment`).

Intended invariant (documented in [`NewTransferModal.tsx`](../app/transfers/NewTransferModal.tsx)):

```sql
SELECT SUM(qty) FROM stock_by_location WHERE product_id = :id
  = SELECT qty_on_hand FROM products WHERE id = :id
```

### Move statuses

`draft → waiting → ready → done`, or `canceled` from any non-final state. The UI shows different labels per operation:

| Status | Receipt label | Delivery label |
|---|---|---|
| `draft` | Draft | Draft |
| `waiting` | In Transit | Picked |
| `ready` | Received | Packed |
| `done` | Validated | Delivered |
| `canceled` | Canceled | Canceled |

Only the transition to `done` ("Validate") touches stock quantities. Earlier steps just update `stock_moves.status`. Cancel sets `canceled` and never changes stock.

## How each operation changes stock

### Product creation — [`ProductModal.tsx`](../app/products/ProductModal.tsx)

1. Rejects the save if another product already has the same SKU.
2. Inserts the product with `qty_on_hand = initial stock`.
3. If initial stock > 0 and a location was chosen:
   - inserts a `stock_moves` row: `adjustment`, `done`, `to_location = location`, reference `"Initial Stock setup"`;
   - upserts `stock_by_location` for that location with `qty = initial stock`.

Editing a product changes name, SKU, category, UoM and reorder point only — never quantity.

### Receipt — [`NewReceiptModal.tsx`](../app/receipts/NewReceiptModal.tsx), [`receipts/[id]/page.tsx`](../app/receipts/[id]/page.tsx)

- **Create:** one `stock_moves` row per line (`receipt`, `draft`, `from_location = null`, `to_location = destination`), all sharing the supplier reference.
- **Validate** (offered at `ready`, and as "Quick Validate" directly from `draft`):
  1. Re-reads `products.qty_on_hand`.
  2. `products.qty_on_hand += quantity`.
  3. `stock_by_location[to_location].qty += quantity`.
  4. Status → `done`.

### Delivery — [`NewDeliveryModal.tsx`](../app/deliveries/NewDeliveryModal.tsx), [`deliveries/[id]/page.tsx`](../app/deliveries/[id]/page.tsx)

- **Create:** one `stock_moves` row per line (`delivery`, `draft`, `from_location = source`).
- **Validate** (only offered at `ready`):
  1. Re-reads `products.qty_on_hand`.
  2. If `quantity > qty_on_hand` → shows *"Insufficient stock…"* and **writes nothing**.
  3. Otherwise `products.qty_on_hand -= quantity`.
  4. `stock_by_location[from_location].qty -= quantity`.
  5. Status → `done`.

### Internal transfer — [`NewTransferModal.tsx`](../app/transfers/NewTransferModal.tsx)

Transfers are created **already done** (no draft workflow).

1. Validates: product, source and destination chosen; source ≠ destination; quantity > 0; quantity ≤ stock at the source location (from `stock_by_location`).
2. Inserts `stock_moves`: `internal`, `done`, `from_location`, `to_location`.
3. `stock_by_location[source].qty -= quantity` (floored at 0).
4. `stock_by_location[destination].qty += quantity`.
5. **`products.qty_on_hand` is intentionally not changed** — total stock is the same.

### Adjustment — [`adjustments/page.tsx`](../app/adjustments/page.tsx)

The user picks a product and location and enters the physically **counted** quantity.

1. *Recorded* quantity = `stock_by_location.qty` for that product/location, or `products.qty_on_hand` if no per-location row exists.
2. `delta = counted − recorded` (rejected if 0).
3. Inserts `stock_moves`: `adjustment`, `done`, `to_location = location`, `quantity = delta` (can be negative).
4. `products.qty_on_hand += delta`.
5. `stock_by_location[location].qty = counted`.

Worked example (from the code comments): on-hand 50, location 20, counted 17 → delta −3 → on-hand 47, location 17.

### Summary

| Operation | `products.qty_on_hand` | `stock_by_location` | `stock_moves` |
|---|---|---|---|
| New product w/ initial stock | = initial | location = initial | adjustment, done |
| Receipt validated | + qty | destination + qty | status → done |
| Delivery validated | − qty (blocked if insufficient) | source − qty | status → done |
| Internal transfer | unchanged | source − qty, destination + qty | internal, done |
| Adjustment | + delta | location = counted | adjustment, done, qty = delta |
| Cancel | unchanged | unchanged | status → canceled |

## Dashboard metrics — [`dashboard/page.tsx`](../app/dashboard/page.tsx)

| KPI | Calculation |
|---|---|
| Total in stock | Products with `qty_on_hand > 0` |
| Low stock | Products with `qty_on_hand <= reorder_point` (includes out-of-stock) |
| Pending receipts | `receipt` moves with status ≠ `done` (canceled ones are included) |
| Pending deliveries | `delivery` moves with status ≠ `done` (canceled ones are included) |
| Internal transfers scheduled | `internal` moves with status `draft` or `waiting` |
| Recent operations | Latest 10 `stock_moves`, joined to products and locations; falls back to a plain query if the join fails |

## Data access pattern

Pages load data in `useEffect` with the browser client and PostgREST embedded joins, for example:

```ts
supabase.from('stock_moves').select(`
  id, status, quantity, reference, created_at,
  products ( name, sku, uom, qty_on_hand ),
  toLoc:locations!stock_moves_to_location_fkey ( id, name )
`).eq('move_type', 'receipt')
```

The `locations!stock_moves_to_location_fkey` hint requires real foreign-key constraints with exactly those names — see [DATABASE.md](DATABASE.md#required-schema-fixes).
