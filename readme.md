# SAV-Tracking – Retail Store Parcel Tracking

SAV-Tracking is a parcel tracking and pickup management app for retail stores that receive and hold customer packages. It uses a central Flask + SQLite API backend with a browser-based frontend that talks to the API via a configurable `API_BASE_URL`. [file:109][file:110][file:112]

## What this app offers

- OCR-based label scanning (Tesseract.js in the browser) to auto-fill courier, customer name, phone, postal code, and other fields before saving packages to the API. [file:106][file:116]
- Customer profile management with a **profile lock** flag so OCR and intake do not overwrite trusted customer details. [file:109]
- Package lifecycle: intake (pending), aging (5+ days pending), pickup with signature, archival for search, reporting, and signature viewing. [file:106][file:109][file:111]
- Shipping metadata: shipping company, shipping service, and normalized package weight in pounds (kg inputs are automatically converted). [file:109][file:116]
- End-of-batch shipping summary: packages grouped by shipping company with counts of Small (<10 lbs) and Large (≥10 lbs) packages. [file:109][file:110]
- Public tracking page for customers to check if their package is available for pickup. [file:107][file:110]
- Admin pages for user management, Grandstream integration settings, branding (logo, tagline, colours), and API base URL configuration for LAN vs HTTPS. [file:110][file:112][file:114]

## Architecture overview

### Backend (Flask + SQLite)

- `server.py` runs a Flask app exposing REST endpoints under `/api` for:
  - Login and users: `/api/login`, `/api/users`, `/api/users/<username>/password`. [file:109]
  - Customers: `/api/customers`, `/api/customers/<id>`, `/api/customers/<id>/packages`. [file:109]
  - Packages: `/api/packages`, `/api/packages/pending`, `/api/packages/old`, `/api/packages/<id>`, `/api/packages/<id>/sign`, `/api/packages/bulk-status`, `/api/packages/archived`, `/api/track/<tracking_number>`. [file:109]
  - Pickups & signatures: `/api/pickups`, `/api/pickups/bulk`. [file:109]
  - Reports: `/api/reports/shipping-summary`. [file:109]
  - Settings: `/api/settings` (branding, colours, Grandstream, etc.). [file:109][file:114]
  - Grandstream calling: `/api/call/customer/<id>`, `/api/call/bulk`. [file:109]
- Data is stored in `packages.db` (SQLite), created and migrated automatically by `init_db()` and `add_package_columns_if_missing()`. [file:109]

### Frontend (static HTML/JS/CSS)

- All JS code that talks to the backend uses a configurable `API_BASE_URL` defined in `config.js` and wrapped by helpers in `common.js`. [file:112][file:110]
- Core shared files:
  - `config.js`: defines `API_BASE_URL` (e.g. `http://192.168.1.10:5000/api` or `https://sub.example.com/api`). [file:110]
  - `common.js`: exports auth helpers, API helpers (`apiGet`, `apiPost`, `apiPut`, `apiDelete`), and simple localStorage caches for packages/customers/settings. [file:112]
  - `styles.css`: shared styling for index, dashboard, admin, customers, settings, etc. [file:113]
- Key pages:
  - `index.html`: staff login and small status metrics; calls the API via shared JS. [file:107][file:112]
  - `dashboard.html` + `dashboard.js`: package intake, OCR-assisted entry, pending and 5-day-old views, and shipping summary. [file:106][file:110]
  - `customers.html` + `customers.js`: customer CRUD via `/api/customers` with caching. [file:110]
  - `admin.html` + `admin.js`: user management via `/api/users` and API base URL configuration for LAN/HTTPS. [file:110]
  - `settings.html`: branding colours, logo, tagline, and Grandstream settings stored via `/api/settings`. [file:114][file:109]
  - `signatures.html`: read-only signature and pickup history viewer via `/api/pickups` and `/api/customers/<id>/packages`. [file:111][file:109]
  - `ocr.js`: Tesseract.js wrapper and courier-specific text parsing to produce package objects compatible with the backend schema. [file:116]

## Grandstream UCM6302A integration

The app can trigger automated outbound calls using a Grandstream UCM6302A PBX to notify customers about package availability. [file:109][file:110]

### Configure in Settings

1. Sign in as an admin and open `settings.html`. [file:114]
2. In **Grandstream UCM Settings**, fill in:
   - Grandstream IP (e.g. `192.168.1.100`). [file:114]
   - Admin username and password. [file:114]
   - Extension for outbound calls (e.g. `8000`). [file:114]
   - Recording ID (ID of the prerecorded pickup message). [file:114]
3. Click **Save Grandstream Settings**. [file:114]
4. Use **Test Call** with a customer ID to verify basic connectivity. [file:114]

These values are stored in the `settings` table and used by `/api/call/customer/<id>` and `/api/call/bulk`, so you do not need to edit `server.py` when configuration changes. [file:109]

## Branding: logo, colours, and tagline

### Logo and tagline

- `settings.html` lets admins configure:
  - Logo URL or data URL (used on the public tracking/index page). [file:114][file:107]
  - Tagline text shown under the logo. [file:114][file:107]
- Settings are saved via `/api/settings` and cached in localStorage for fast load. [file:109][file:112][file:114]

### Colours

- The same page controls CSS variables used in `styles.css` for:
  - `--index-text-color`
  - `--index-header-bg`
  - `--index-page-bg`
  - `--index-tracking-bg`
  - `--index-staff-bar-bg` [file:113][file:114]
- Changes take effect on the public tracking display after refresh.

## API base URL (LAN vs HTTPS)

- `config.js` defines the default `API_BASE_URL` (e.g. LAN `http://192.168.1.10:5000/api`). [file:110]
- Admins can adjust the API URL when moving from LAN to a hosted HTTPS server using the field in the Admin page or related settings, and the frontend will use the new base for all API calls on reload. [file:110][file:112]
- All fetches use the helpers in `common.js` so no module hardcodes `localhost` or raw `/api/...` URLs. [file:112]

## LocalStorage vs server database

- The SQLite database (`packages.db`) is the authoritative system of record. [file:109][file:110]
- `common.js` uses localStorage only to:
  - Cache recent packages/customers/settings for faster UI rendering. [file:112]
  - Provide read-only fallback displays if the API is temporarily offline. [file:110][file:112]
- All create/update/delete operations go to the Flask API first; on success, caches are refreshed. [file:109][file:112]

## Running on a LAN

1. Install Python and required packages (see `requirements.txt`). [file:110]
2. Start the backend:
   - `python server.py` (runs on `http://127.0.0.1:5000` by default). [file:109]
3. Serve the frontend files over HTTP (e.g. simple static server) so browsers can load HTML/JS/CSS and call the API via `API_BASE_URL`. [file:110][file:112]

For hosted HTTPS deployment, place Flask behind a reverse proxy (e.g. Nginx) with TLS and update `API_BASE_URL` in `config.js` and/or via the admin-configurable base URL to use `https://your-domain/api`. [file:110][file:112]

## File-by-file structure

### Backend

- `server.py`  
  Flask application exposing all `/api` endpoints for auth, users, customers, packages, pickups, reports, settings, and Grandstream calls. Handles SQLite connections, schema creation/migration, OCR-assisted parsing for server-side label processing, and business rules like 5‑day aging and shipping summaries. [file:109][file:110]

- `packages.db`  
  SQLite database file (created at runtime) containing the tables `users`, `customers`, `packages`, `pickups`, and `settings`. This is the authoritative system of record for all operational data. [file:109][file:110]

- `requirements.txt`  
  Python dependency list for the backend (Flask, CORS, SQLite-related, etc.). Used to set up the virtual environment on LAN or hosted servers. [file:110]

### Configuration

- `config.js`  
  Defines and exports `API_BASE_URL`, the base URL for all frontend API calls (e.g. `http://192.168.1.10:5000/api` or `https://sub.example.com/api`). Can be adjusted when moving from LAN to HTTPS hosting. [file:110]

### Shared frontend

- `common.js`  
  Shared JS utilities used by multiple pages:
  - Auth helpers: `getAuthToken`, `setAuthToken`, `clearAuthToken`, `getCurrentUser`, `setCurrentUser`, `clearCurrentUser`. [file:112]
  - API helpers: `apiGet`, `apiPost`, `apiPut`, `apiDelete` that prefix paths with `API_BASE_URL` and attach auth headers. [file:112]
  - Local cache helpers: `cachePackages`, `readCachedPackages`, `cacheCustomers`, `readCachedCustomers`, `cacheSettings`, `readCachedSettings`. [file:112]
  - Legacy helpers: `checkAuth`, `logout`, and welcome/admin-button wiring on protected pages. [file:112]

- `styles.css`  
  Shared styling for the public tracking/index page and internal dashboards:
  - CSS custom properties for index branding: `--index-text-color`, `--index-header-bg`, `--index-page-bg`, `--index-tracking-bg`, `--index-staff-bar-bg`. [file:113]
  - Layout utilities: `.page-shell`, `.page-content`, `.grid`, `.card`, `.section`, `.header`, `.scrollable`, buttons, inputs, canvases. [file:113]
  - Visual styles for admin-only notices, OCR workflow sections, customer summaries, and batch completion banners. [file:113]

- `ocr.js`  
  Pure front-end OCR wrapper around Tesseract.js:
  - `processLabelFiles(files, courier)`: runs OCR for uploaded label images, converts each to a data URL for storage, and returns package objects with fields aligned to backend expectations (courier, tracking, name, phone, postal, weight, service, label_image, status, created_at, raw_ocr). [file:116]
  - `extractFieldsFromText(text, courier)`: heuristically extracts tracking, name, postal, phone, weight, and service for UPS, Straightship/Canpar/ICS/Flex, Purolator, Intelcom/Dragonfly, plus a generic fallback. [file:116]

### Core HTML pages

- `index.html`  
  Staff login and landing page:
  - Modern split layout with a branding panel and an auth panel.
  - Shows today’s intake count and ready-for-pickup metrics based on localStorage packages, with prefilled demo credentials (`sav_clerk / demo123`). [file:107]
  - On successful login, stores session data (`savUser`) and redirects to `dashboard.html`. [file:107]

- `dashboard.html` + `dashboard.js`  
  Main staff dashboard for package intake, OCR import, and pickup processing:
  - Uses `common.js` API helpers to talk to `/api/packages`, `/api/packages/pending`, `/api/packages/old`, `/api/reports/shipping-summary`, and `pickups` endpoints (in the updated architecture). [file:106][file:112][file:110]
  - Integrates with `ocr.js` to parse label images and pre-populate package forms before saving to the server. [file:106][file:116]
  - Performs 5‑day aging logic, shows ready/pending counts, and allows signing, skipping, or sending packages back depending on status and workflow. [file:106][file:109]

- `customers.html` + `customers.js`  
  Customer management UI:
  - Lists all customers via `/api/customers`, with search and edit forms. [file:110][file:109]
  - Uses `apiGet`, `apiPost`, `apiPut`, `apiDelete` from `common.js` for CRUD operations and keeps a cached copy of customer data in localStorage. [file:112][file:110]
  - Respects `profile_locked` flags when linking customers to packages during intake. [file:109][file:110]

- `admin.html` + `admin.js`  
  Admin functions:
  - User management interface for creating users, assigning roles (admin/staff), and viewing existing users via `/api/users`. [file:110][file:109]
  - API base URL configuration: exposes and stores `API_BASE_URL` (via config + localStorage) so an admin can switch from LAN to HTTPS API endpoints. [file:110][file:112]
  - Includes navigation to dashboard and settings, and uses shared `logout` from `common.js`. [file:110][file:112]

- `settings.html` + `settings.js`  
  System-wide settings:
  - Branding & colours: controls logo URL, tagline, and CSS variables for the public tracking page. [file:114][file:113]
  - Grandstream UCM settings: IP, admin credentials, extension, and recording ID, all persisted via `/api/settings`. [file:114][file:109]
  - Uses `apiGet`/`apiPost` to load and save settings and applies branding to the document root on load for live preview. [file:114][file:112][file:115]
  - `settings.js` (legacy version) previously talked to `http://localhost:5000/api`; the updated architecture replaces that with `config.js` + `common.js` helpers so no hard-coded localhost remains. [file:115][file:112][file:110]

- `archived.html` + `archive.js`  
  Archived/signed package views (not shown in this snippet but referenced in the architecture):
  - Reads completed/signed packages via `/api/packages/archived` with optional search filters. [file:110][file:109]
  - May use cached archive data to support faster client-side refiltering when implemented. [file:110]

- `customertracking.html`  
  Public customer tracking page (not shown here, referenced in design):
  - Allows customers to enter a tracking number and query `/api/track/<tracking_number>` to see if a package is at the store and whether it is ready for pickup. [file:110][file:109]

- `signatures.html`  
  Read-only signatures and pickups viewer:
  - Right side shows a filterable table of recent pickups from `/api/pickups`. [file:111][file:109]
  - Left side shows pickup details, associated packages (queried via `/api/customers/<id>/packages?status=signed`), and the captured signature rendered onto a canvas. [file:111][file:109]
  - Provides “Download signature” and “Print pickup form” tools, pulling data only from the server and local state (no edits). [file:111]

### Other scripts and assets

- `settings.js` (legacy)  
  Earlier standalone settings script that:
  - Loaded branding via `GET /api/settings`.
  - Saved tagline and logo (as data URL) via `POST /api/settings`.
  - Managed Grandstream settings via custom `/api/grandstream` endpoints. [file:115]
  In the new architecture, these concerns are centralized in `settings.html` using `common.js` API helpers and the unified `/api/settings` endpoints. [file:114][file:109][file:112]

- `readme.md`  
  This documentation file, describing:
  - Overall purpose and features.
  - Backend and frontend architecture.
  - Grandstream integration, branding, and API base URL configuration.
  - File-by-file structure of the project. [file:117][file:110]
