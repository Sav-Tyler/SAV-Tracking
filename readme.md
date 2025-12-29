\# SAV-Tracking – Retail Store Parcel Tracking



SAV-Tracking is a parcel tracking and pickup management app for retail stores that receive and hold customer packages. It streamlines intake (with OCR), customer lookup, pickup signatures, and reporting.



\## What this app offers



\- OCR-based label scanning (PaddleOCR) to auto-fill courier, customer name, phone, postal code, and address, while respecting locked customer profiles so verified data is not overwritten.

\- Customer profile management with a \*\*profile lock\*\* flag to prevent OCR updates from changing trusted details.

\- Package lifecycle: intake (pending), aging (5+ days pending), pickup with signature, and archival for search and reporting.

\- Shipping metadata: shipping company, shipping service, and normalized package weight in pounds (kg inputs are automatically converted).

\- End-of-batch shipping summary: packages grouped by shipping company with counts of Small (<10 lbs) and Large (≥10 lbs) packages.

\- Public tracking page for customers to check if their package is available for pickup.

\- Admin dashboard for user management, Grandstream integration settings, and branding (logo and tagline).



\## Grandstream UCM6302A Integration Setup



The app can trigger automated outbound calls using a Grandstream UCM6302A PBX to notify customers about package availability.



\### 1. Configure settings in the Admin panel



1\. Sign in as an admin and open `admin.html`.

2\. Scroll to the \*\*📢 Grandstream Integration Settings\*\* section.

3\. Fill in:

&nbsp;  - \*\*UCM6302A IP Address\*\* – e.g. `192.168.1.100`

&nbsp;  - \*\*Extension/Line\*\* – the extension the system should use to originate calls (e.g. `8000`)

&nbsp;  - \*\*API Username\*\* – Grandstream API or admin username

&nbsp;  - \*\*API Password\*\* – corresponding API/admin password

&nbsp;  - \*\*Recorded Message ID\*\* – ID of the prerecorded pickup notification message configured on the PBX

4\. Click \*\*💾 Save Settings\*\* to store these values.

5\. Optionally click \*\*🔌 Test Connection\*\* to verify basic connectivity.



These values are stored in the app’s settings and used by the Grandstream call endpoints, so you do not need to edit `server.py` each time configuration changes.



\### 2. PBX-side requirements



\- Ensure the UCM6302A is reachable from the server on your LAN.

\- Create or configure:

&nbsp; - An outbound route for the chosen extension/line.

&nbsp; - A prerecorded message mapped to the \*\*Recorded Message ID\*\* you enter in the admin settings.

\- Confirm that outbound calls from the configured extension can reach customer phone numbers.



Once configured, the app’s Grandstream integration can trigger single or bulk customer notification calls using the stored settings.



\## Changeable Company Logo



The public homepage (index.html) displays a company logo that is configurable by admin users.



\- \*\*Display size\*\*: The logo is rendered up to 400 px wide, scaling responsively with the container.

\- \*\*Recommended source size\*\*: At least 800×200 px for a horizontal logo to ensure clarity when scaled down.

\- \*\*Accepted file formats\*\*: PNG or JPEG are recommended.

\- \*\*How to set it\*\*:

\- Go to the Admin panel → Branding Settings.

\- Enter the full URL to the logo image (for example, `https://example.com/logo.png` or `/static/logo.png` if served locally).

\- Click “Save Branding”; the homepage logo will update on next load.



\## Changeable Homepage Tagline



The text under the logo on the public page is also configurable.



\- Default text:  

`Track your packages with Superior Audio \& Video`

\- How to change:

\- Go to the Admin panel → Branding Settings.

\- Edit the “Homepage Tagline” field.

\- Click “Save Branding”; the new tagline will appear on the homepage on next load.



