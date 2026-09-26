# Database

OStock uses a Supabase (PostgreSQL) database. The base schema is in [`schema.sql`](../schema.sql); this page documents every table the application uses, including one that `schema.sql` does not yet create.

## Entity relationships

```
warehouses 1 ──< locations
categories 1 ──< products          (on delete: set null)
products   1 ──< stock_moves       (on delete: cascade)
locations  1 ──< stock_moves       (from_location / to_location)
products   1 ──< stock_by_location >── 1 locations
```

## Tables

### `warehouses`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK, `gen_random_uuid()` |
| `name` | text | required |
| `address` | text | default `''` |
| `created_at` | timestamptz | default `now()` |

### `locations`

Storage locations inside a warehouse (e.g. "Shelf A", "Stock Room").

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `warehouse_id` | uuid | FK → `warehouses.id`, **on delete cascade** |
| `name` | text | required |
| `created_at` | timestamptz | |

### `categories`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | required, **unique** |
| `description` | text | default `''` |
| `created_at` | timestamptz | |

### `products`

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `name` | text | required |
| `sku` | text | required, **unique** |
| `category_id` | uuid | FK → `categories.id`, on delete set null |
| `uom` | text | unit of measure, default `'Units'` |
| `qty_on_hand` | numeric | total stock across all locations, default 0 |
| `reorder_point` | numeric | low-stock threshold, default 10 |
| `created_at` | timestamptz | |

### `stock_moves`

The ledger of all stock movements.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `product_id` | uuid | FK → `products.id`, on delete cascade |
| `move_type` | text | `receipt` \| `delivery` \| `internal` \| `adjustment` |
| `status` | text | `draft` \| `waiting` \| `ready` \| `done` \| `canceled` |
| `from_location` | uuid* | source location (deliveries, transfers) |
| `to_location` | uuid* | destination location (receipts, transfers, adjustments) |
| `quantity` | numeric | positive for receipts/deliveries/transfers; **signed delta** for adjustments |
| `reference` | text | supplier/customer reference or note |
| `created_at` | timestamptz | |

\* `schema.sql` declares these as `text`; the application requires `uuid` foreign keys — see below.

### `stock_by_location` *(not in schema.sql)*

Per-location quantities. Used by receipts, deliveries, transfers, adjustments, product creation and the product detail page.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `product_id` | uuid | FK → `products.id` |
| `location_id` | uuid | FK → `locations.id` |
| `qty` | numeric | quantity at this location |
| | | **unique (`product_id`, `location_id`)** — required by the app's `upsert(..., { onConflict: 'product_id,location_id' })` |

## Required schema fixes

`schema.sql` as committed does not match what the code expects:

1. **`stock_by_location` is missing.** Any receipt/delivery validation, transfer, adjustment or product creation with initial stock will error or silently skip location updates.
2. **`stock_moves.from_location` / `to_location` are `text` with no foreign keys.** The pages query them with PostgREST joins named `locations!stock_moves_from_location_fkey` and `locations!stock_moves_to_location_fkey`, which only work if those FK constraints exist. Without them the Receipts, Deliveries, Transfers, Adjustments, History and product detail pages fail to load data.

The SQL below brings a database created from `schema.sql` in line with the code. It was **inferred from how the code uses the database** — if your team's live Supabase project already has these objects, compare before running. Run it in the Supabase SQL Editor after `schema.sql`:

```sql
-- 1. Make from/to locations real foreign keys to locations
--    (the default constraint names below are exactly what the app's joins reference)
alter table public.stock_moves
  alter column from_location type uuid using nullif(from_location, '')::uuid,
  alter column to_location   type uuid using nullif(to_location,   '')::uuid;

alter table public.stock_moves
  add constraint stock_moves_from_location_fkey
    foreign key (from_location) references public.locations(id) on delete set null,
  add constraint stock_moves_to_location_fkey
    foreign key (to_location)   references public.locations(id) on delete set null;

-- 2. Per-location stock
create table if not exists public.stock_by_location (
  id          uuid primary key default gen_random_uuid(),
  product_id  uuid not null references public.products(id)  on delete cascade,
  location_id uuid not null references public.locations(id) on delete cascade,
  qty         numeric not null default 0,
  unique (product_id, location_id)
);

alter table public.stock_by_location enable row level security;

drop policy if exists "Allow all on stock_by_location" on public.stock_by_location;
create policy "Allow all on stock_by_location" on public.stock_by_location
  for all using (true) with check (true);
```

> The `alter column ... type uuid` step fails if existing rows contain non-UUID text in those columns; clean those rows first. On a fresh database it runs cleanly.

## Security

Row Level Security is **enabled** on every table, but each table has a policy of `using (true) with check (true)` for all operations. This means:

- anyone who has the project URL and the public (publishable/anon) key — both of which are shipped to the browser — can read, insert, update and delete **all** inventory data, **without logging in**;
- the login requirement is enforced only by the Next.js proxy, i.e. only for people using the web UI.

This is acceptable for a demo or hackathon, but before real use restrict policies to authenticated users at minimum, for example:

```sql
drop policy if exists "Allow all on products" on public.products;
create policy "Authenticated full access on products" on public.products
  for all to authenticated using (true) with check (true);
-- repeat for warehouses, locations, categories, stock_moves, stock_by_location
```
