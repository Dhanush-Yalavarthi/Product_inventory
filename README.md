# Inventory Management System (Prototype)

A simple web-based inventory system for a small shop, built for the **PDAP** academic project.
It runs completely in the browser: **HTML + CSS + JavaScript**, with data saved in the browser's **localStorage**.
No server, database installation or internet connection is needed.

## How to run

**Option 1: on your computer**
1. Unzip the folder.
2. Double-click `index.html`. It opens in Chrome, Edge or Firefox.

**Option 2: online with GitHub Pages**
1. Create a new public repository on GitHub, for example `inventory-system`.
2. Upload `index.html`, `style.css`, `app.js` and `README.md` (*Add file → Upload files → Commit*).
3. Go to *Settings → Pages*. Under *Branch*, select `main` and `/ (root)`, then click *Save*.
4. After 1–2 minutes the site is live at `https://<your-username>.github.io/inventory-system/`.

## Demo logins

| Role  | Username | Password  |
|-------|----------|-----------|
| Admin | admin    | admin123  |
| Staff | staff    | staff123  |

The first time the site opens, it loads sample data for a stationery shop: 12 products, 3 suppliers and 2 weeks of history.

## Features and SRS mapping

| SRS ID | Feature | Where |
|--------|---------|-------|
| FR-01 | Login with username and password | Login page |
| FR-02 | Role-based access (Admin / Staff) | Menu and buttons change by role |
| FR-03 | Add, view, edit, deactivate products; unique SKU | Products |
| FR-04 | Supplier records, searchable, linked to stock-in | Suppliers |
| FR-05 | Stock receipt with supplier, date, product, qty, unit cost | Stock In |
| FR-06 | Sale / issue; cannot exceed available stock | Stock Out |
| FR-07 | Current stock per product | Products, Dashboard, Reports |
| FR-08 | Low-stock alerts (qty ≤ reorder level) | Dashboard, Low stock report |
| FR-09 | Adjustment with mandatory reason (admin only) | Stock Adjustment |
| FR-10 | Reports with date range, plus CSV export and print | Reports |
| FR-11 | History keeps the user, date and time of every transaction | Movement history |
| FR-12 | Validation messages next to each field | All forms |
| FR-13 | Backup download and restore | Backup & Restore |

**Reliability:** every stock change goes through one function, `recordMovement()`. It updates the product quantity and adds the history record in a single save, so the two never go out of sync.

## Role permissions

| Action | Admin | Staff |
|--------|:-----:|:-----:|
| View dashboard, products, suppliers, reports | ✔ | ✔ |
| Record stock in / sales | ✔ | ✔ |
| Add / edit products and suppliers | ✔ | ✖ |
| Stock adjustment | ✔ | ✖ |
| Manage users, backup and restore | ✔ | ✖ |

## Files

```
index.html   page skeleton
style.css    design, responsive layout, print styles
app.js       all logic: storage, login, pages, validation, reports
README.md    this file
```

## Data model (stored as JSON in localStorage key `ims_data_v1`)

- **users**: id, username, name, role, active, passwordHash
- **products**: id, sku, name, category, unit, price, reorderLevel, quantity, active
- **suppliers**: id, name, contact, phone, email, address
- **movements**: id, type (IN / OUT / ADJ), productId, change, balance, supplierId, unitCost, unitPrice, reference, reason, date, time, userId

## Backup and restore procedure

1. Sign in as **admin** and open **Backup & Restore**.
2. Click **Download backup**. This saves `ims-backup-YYYY-MM-DD.json`.
3. To restore, choose that file under **Restore from backup** and confirm.
4. Sign in again.

## Limitations of this prototype

- Data lives in one browser on one computer. Another browser or device starts with demo data.
- Password hashing runs in the browser, so it's suitable for a demo, not for real security.
- Only one user can work at a time. There is no shared server.

## Future scope (from the SRS)

- Python (Flask) backend with a MySQL database for multiple users over a network
- Barcode scanning
- Multiple branches or locations
- Accounting integration and online customer ordering
- Purchase and sales with multiple products per bill
