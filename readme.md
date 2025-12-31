SAV-Tracking – Retail Store Parcel Tracking
SAV-Tracking is a parcel tracking and pickup management app for retail stores that receive and hold customer packages. It uses a central Flask + SQLite API backend with a browser-based frontend that talks to the API via a configurable API_BASE_URL.

What this app offers
OCR-based label scanning (Tesseract.js in the browser) to auto-fill courier, customer name, phone, postal code, and other fields before saving packages to the API.

Customer profile management with a profile lock flag so OCR and intake do not overwrite trusted customer details.

Package lifecycle: intake (pending), aging (5+ days pending), pickup with signature collection, archival for search and reporting.

Shipping metadata: shipping company, shipping service, and normalized package weight in pounds (kg inputs are automatically converted).

End-of-batch shipping summary: packages grouped by shipping company with counts of Small (<10 lbs) and Large (≥10 lbs) packages.

Public tracking page for customers to check if their package is available for pickup.

Admin pages for user management, Grandstream integration settings, branding (logo, tagline, colours), and API base URL configuration for LAN vs HTTPS.

Architecture overview
Backend (Flask + SQLite)
server.py runs a Flask app exposing REST endpoints under /api and serves the main HTML files.

Key responsibilities:

Flask app setup, CORS, and static file serving.

SQLite connection management via get_db() and init_db().

Business logic for packages, customers, users, settings, and click-to-call.

OCR integration using PaddleOCR (server-side label processing if used).

Key endpoints observed:

/ – Serves the main login/entry page (index.html).

/api/login – Handles staff login and returns an auth token/user info.

/api/packages – CRUD-like operations for packages (listing + creating via POST); used by staff dashboard.

/api/public-search – Public customer tracking search used by customer_tracking.html.

/api/settings – Read/write application settings (branding, API base, etc.); used by settings.js.

/api/signatures/complete-pickup – Records pickup signatures and completes package pickups.

/api/grandstream – Integrates with Grandstream PBX / click-to-call configuration.

/api/call/customer/<int:customer_id> – Initiate a single customer call from dashboard/admin flow.

/api/call/bulk – Initiate bulk calls to multiple customers.

Important functions:

get_db() – returns a per-request SQLite connection.

init_db() – creates/updates DB schema (tables: packages, customers, users, settings).

add_package_columns_if_missing() – schema migration helper for new package fields.

get_setting(name) / set_setting(name, value) – read/write key/value settings.

normalize_postal_code() / normalize_address() – data normalization utilities shared by listing/search logic.

get_packages() / add_package() – backing logic for dashboard.js package listing and creation.

public_search() – backing logic for customer_tracking.html public tracking lookup.

complete_pickup() – saves a pickup signature + updates package status to completed.

get_settings() / update_settings() – used by settings.js for branding/telephony configuration.

get_grandstream_settings() / update_grandstream_settings() / get_grandstream_config() – manages Grandstream click-to-call configuration.

call_customer() / call_bulk_customers() – invoked from the dashboard/admin UI to initiate phone calls.

Shared front-end modules
config.js
Computes API_BASE_URL from the current host:

If the page is opened as http://192.168.1.23:5000/index.html, the default becomes http://192.168.1.23:5000/api.

Allows override from settings.html via localStorage.

Exports: API_BASE_URL.

Used by: common.js and other JS modules for all API calls.

common.js
Responsibilities:

Standardized API helpers using API_BASE_URL:

apiGet(path, options?)

apiPost(path, body, options?)

apiRequest(method, path, body, options?)

Auth token helpers:

getAuthToken(), setAuthToken(token), clearAuthToken().

Auth check:

checkAuth() – verifies user is logged in, redirects to index.html if not.

Current user helpers:

getCurrentUser(), setCurrentUser(user), clearCurrentUser().

Logout:

logout() – clears auth and redirects to index.html.

Shared utilities (formatting, maybe pagination/filters and DOM helpers).

Connections:

Used by: dashboard.js, customers.js, settings.js, admin.js, archive.js, etc.

Talks to: all /api/... routes in server.py via fetch.

auth.js
Responsibilities:

login() – submits credentials to /api/login.

staffLogin() – staff login flow on index.html:

Sends credentials to /api/login.

Stores auth token and user info via common.js.

Redirects to dashboard.html on success.

publicTrack() – triggers public tracking searches via /api/public-search and updates customer_tracking.html.

Connections:

HTML:

index.html calls staffLogin().

customer_tracking.html calls publicTrack().

Backend:

/api/login

/api/public-search

toast.js
Provides a tiny toast/notification helper:

showToast(message, type) – type might be success, error, info, etc.

Used throughout the front-end for consistent user feedback:

dashboard.js, settings.js, admin.js, etc.

styles.css
Global styling for all HTML views:

Layout / typography / colour scheme.

Table styling for package/customer lists.

Buttons, nav, alerts, and modal styles.

Shared by:

dashboard.html, admin.html, customers.html, archived.html, settings.html, index.html, customer_tracking.html.

Staff Dashboard (dashboard.html + dashboard.js + ocr.js)
HTML: dashboard.html

Main staff view for:

Intake of new packages via OCR or manual form.

Viewing pending packages and status summaries.

Running pickups with signature capture.

Initiating calls to customers.

Includes:

External script: Tesseract.js via CDN (https://cdn.jsdelivr.net/npm/tesseract.js@v4/dist/tesseract.min.js).

Inline module script that imports:

config.js – for API base URL configuration.

common.js – for checkAuth() and logout helpers.

auth.js – for authentication utilities.

dashboard.js – main dashboard initialization.