# User Guide

A step-by-step guide to using OStock day to day.

## 1. Account

**Sign up** — Go to the app, click **Sign up**, enter your name, email and password. Depending on the server settings you are either logged in straight away or asked to confirm your email first.

**Log in** — Enter your email and password on the login page.

**Forgot password** — Click **Forgot password?** on the login page, enter your email and click send. Then either:
- click the link in the email, which brings you back to set a new password, or
- enter the 6-digit code from the email together with your new password.

**Profile** — Click your name (top of the sidebar) to change your display name or password, or to sign out.

## 2. Initial setup

Do these once, in this order:

1. **Settings → Warehouses** — add each warehouse (name and address), then add the storage locations inside it (e.g. *Main Store / Shelf A*, *Main Store / Back Room*).
2. **Settings → Product Categories** — add product categories (e.g. *Electronics*, *Raw Materials*).
3. **Products → New Product** — for each item enter:
   - **Name** and **SKU** (the SKU must be unique),
   - **Category**, **Unit of measure** (Units, kg, boxes…),
   - **Reorder point** — when stock falls to this level the product is flagged as low stock,
   - optionally **Initial stock** and the **location** where it is stored.

## 3. Daily operations

### Receiving goods (Receipts)

1. **Operations → Receipts → New Receipt**.
2. Enter the supplier name / reference.
3. Add one line per product: product, destination location, quantity. Use **Add Line** for more products.
4. Save. Each line becomes a receipt in **Draft**.
5. Open a receipt and move it through the steps: **Mark as In Transit → Mark as Received → Validate Receipt**. While still in Draft you can also use **Quick Validate** to skip straight to done.
6. Validating adds the quantity to stock. Until then, stock is unchanged.

### Shipping goods (Deliveries)

1. **Operations → Deliveries → New Delivery**.
2. Enter the customer / reference and add lines: product, source location, quantity.
3. Open the delivery and progress it: **Mark as Picked → Mark as Packed → Validate Delivery**.
4. Validating removes the quantity from stock. If there isn't enough stock the delivery is blocked with an *Insufficient stock* message — receive more stock first.

Any receipt or delivery that is not yet done can be **Canceled**; cancelling never changes stock.

### Moving stock between locations (Transfers)

1. **Operations → Transfers → New Transfer**.
2. Choose the product, the **from** location (the available quantity there is shown), the **to** location and the quantity.
3. Save. The transfer is completed immediately. Total stock stays the same; only the location quantities change.

The two locations must be different, and you cannot move more than is available at the source.

### Correcting stock after a count (Adjustments)

1. **Operations → Adjustments**.
2. Choose the product and location. The system shows the **recorded** quantity.
3. Enter the quantity you actually **counted**. The difference is shown (e.g. *−3*).
4. Add an optional note (e.g. *"Damaged"*) and save.

Stock at that location is set to the counted quantity, and total stock is corrected by the difference.

## 4. Monitoring

- **Dashboard** — number of products in stock, low-stock items, pending receipts/deliveries and the latest operations. Use **Refresh** to reload.
- **Products** — search by name or SKU; low-stock items are highlighted. Click a product to see stock per location and its recent movements.
- **Move History** — every stock movement ever recorded, with date, type, locations, quantity and status.
