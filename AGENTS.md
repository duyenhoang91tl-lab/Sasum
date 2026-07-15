# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
Three related, **build-less / dependency-less** pieces (all plain static files — no `package.json`,
no bundler, no lint/test suite):

1. **OME CS Portal** — `index.html`, a single self-contained customer-service dashboard
   (Vietnamese UI). Loads SheetJS (`xlsx`) from cdnjs at runtime (needs internet).
2. **"Duyên AI" Chrome extension** (Manifest V3) — `manifest.json` + `content.js` (+ `style.css`)
   that injects a helper panel into `https://chat.zalo.me/*`. A full, loadable copy lives in
   `zalo-extension/` (see `zalo-extension/HUONG_DAN.md`).
3. **Google Apps Script backend** — `gas_v13.js`, deployed as a GAS web app on Google's servers
   (not run locally).

### Running the OME CS Portal (dev)
- Serve the repo root with any static server and open `index.html`, e.g.
  `python3 -m http.server 8090` then `http://localhost:8090/index.html`.
- **IMPORTANT non-obvious gotcha:** `index.html` contains a hardcoded `const FIXED_GS_URL = '…/exec'`
  near the top of the main `<script>` that points at a **live production GAS deployment**. On load
  the app pulls real user accounts + real customer data (tens of thousands of records) and shows a
  login gate ("Đăng nhập"). Because `gsUrl = FIXED_GS_URL || loadLS('ome_gs_url')`, the fixed URL
  overrides any locally configured URL, so there is **no offline/guest mode** as shipped, and login
  requires **admin-provisioned credentials** (passwords are SHA-256 hashed in the backend "Users"
  sheet). Do **not** mutate this production data.
- To develop against your own data, deploy your own GAS web app and repoint the URL (in-app
  "🔗 Kết nối Google Sheets" modal writes `localStorage.ome_gs_url`), keeping in mind the
  `FIXED_GS_URL` override above.
- Client-side core feature (no auth/backend write): **"📂 Tải Excel"** imports `.xlsx` files with
  Vietnamese headers (must include a source column `Nguồn đơn`, plus `Số điện thoại`,
  `Tên khách hàng`, etc.) and merges them into the in-memory customer map for viewing/filtering.

### Running the Chrome extension
Load unpacked from `zalo-extension/` at `chrome://extensions` (enable Developer mode) — steps in
`zalo-extension/HUONG_DAN.md`. It only activates on `chat.zalo.me`, so exercising it end-to-end
requires a logged-in Zalo session and a Groq API key; it cannot be tested headlessly.

### Lint / test / build
None — these are static files edited and shipped as-is.
