# FRMprio project dashboard

A React and TypeScript dashboard for coordinating FRM and PwC project delivery.

## Features

- Multi-project Gantt timeline and projected-date list.
- Status, independent PwC and FRM priorities, and owners for both teams.
- Category, activity type, delivery assignments, context and priority decisions.
- Planned delivery, remaining planned work, extra completed work and extra requested work, in controls and hours.
- Future capacity gaps and full-scope hour estimates.
- Search, status filtering and priority sorting.
- Editable projects with browser-local storage and JSON export/import.

The Prioritization snapshot supplied by the user is bundled and displayed by default, with their explicit authorization to publish. It contains 46 activities. Manual-project sample data remains available only through the Manual projects view. Use **Import** to select an Excel workbook containing the **Prioritization** tab or a source JSON snapshot. The dashboard maps the actual source into a separate workbook view, including V (five delivery perspectives), W (start date) and X (current staffing). Only the Prioritization tab is included as src/data/prioritization.json. The other workbook tabs and original Excel file are not included. Published source details are accessible to viewers of the Pages site and repository. Imported values persist in the current browser; subsequent reloads do not require another upload. A different browser or cleared storage requires an import again until live Google access is configured.

Data is saved in the current browser only. Local project records have no shared database. A separate read-only Google Sheets source panel can read the private Prioritization tab after OAuth setup; recognized Prioritization columns update the source-backed Gantt view without overwriting manual project records. Export JSON to back up or transfer projects; importing replaces the current project set after confirmation.

## Development

Use Node.js 24 and npm 11. From `/workspace/FRMprio`:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

The explicit host avoids restricted network-interface enumeration in the cloud runtime.

## Validation

```sh
npm run lint
npm run build
npm test
```

The build checks TypeScript and creates `dist/`. Browser tests cover the scope calculations, project edits and persistence, filtering, import/export and mobile layout. Tests use system Chromium when available; otherwise install the Playwright browser with `npx playwright install chromium`. The cloud runtime may require browser execution outside the restricted sandbox.

## Manual project calculation rules

- Remaining plan = baseline minus completed planned work, calculated independently for controls and hours.
- Extra work is kept separate from the baseline. Completed planned work cannot exceed its baseline.
- Future demand = remaining planned hours + extra requested hours.
- Project capacity gap = max(0, future demand − available future hours).
- Portfolio gap sums individual project gaps before capacity reallocation.
- Full-scope hours = baseline + extra completed hours + extra requested hours.
- Extra completed hours are excluded from future demand.
- Gantt progress reflects completed planned hours, not control count or elapsed time.

Available future hours are explicitly entered per project. Estimates do not determine working-day capacity, shared-owner conflicts, FTE requirements or a new completion date. Priority changes are proposed decisions recorded with context, not automatic allocations.

## Private live Google Sheets connection

The dashboard's “Connect Google Sheets” panel uses Google Identity Services and the Google Sheets API. It requests `https://www.googleapis.com/auth/spreadsheets.readonly`, reads spreadsheet `1jSFvzJaWn_QlN53gygctoY_Y2Avt_jh3pm-ybYXuizc`, and selects the Prioritization tab by sheet ID `8496958` rather than guessing its name.

One-time account setup, which must be performed by the Google project owner:

1. In Google Cloud Console, create or select a project and enable Google Sheets API.
2. Configure Google Auth Platform consent. Use an Internal audience when eligible, or add permitted test users for an External app in testing. Organization policy may require administrator approval.
3. Create a Web application OAuth client. Add the dashboard's actual origin (scheme, hostname and port, without a path) to Authorized JavaScript origins. Use HTTPS for hosted production. Local development may use a permitted localhost origin. No redirect URI is needed for the Identity Services popup token flow.
4. Enter the public client ID in the dashboard connection panel. Alternatively set `VITE_GOOGLE_CLIENT_ID` before the Vite build. Never put a client secret or access token in Vite variables.
5. Sign in with an account that already has permission to view the spreadsheet and approve read-only Sheets access.

Google account configuration and private-sheet access have not been exercised yet. Browser tests simulate OAuth and API responses; they validate integration behavior, not real account authorization.

Source reads preserve Google's formatted cell values and empty cells. V–X are highlighted. All populated source columns are displayed, paged at 25 rows. Automatic refresh runs every five minutes while the page is open, visible and authorized. Access-token expiry pauses refresh and requires sign-in again. There is no unattended/background server synchronization.

Tokens remain only in memory and are cleared on disconnect/reload; the public client ID may be retained in browser storage. Disconnect clears the local session and source view, but does not revoke the app's grant in Google account settings. Source data is not sent to a dashboard server; recognized snapshots are stored locally in the browser. “Export source for mapping” downloads a token-free JSON snapshot that can be provided to Codex to verify headers, missing values and the project mapping. Recognized Prioritization columns are mapped automatically into the workbook view, while the manual project records remain separate.

Connecting the dashboard is separate from connecting Google Drive to a Codex chat. No Google Drive connector or account-linking tool was available to this session. Browser OAuth does not grant the assistant persistent access to your Google account.

## Publish with GitHub Pages

The repository includes `.github/workflows/pages.yml`. A push to `main` builds and deploys the dashboard to the repository Pages path `/FRMprio/`. The development server continues to use `/`.

1. In GitHub repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. Depending on repository visibility and account plan, GitHub Pages may require an eligible plan. Do not change repository visibility to work around this without the owner's approval.
2. Push the project to `main`. If it is already pushed, run **Actions → Deploy dashboard to GitHub Pages → Run workflow** after selecting the Pages source.
3. Open the URL reported by the successful deployment. The expected default URL is `https://swilmy25.github.io/FRMprio/`; this is not a verified deployment until the workflow succeeds and the page responds.

For Google sign-in, the Authorized JavaScript origin is `https://swilmy25.github.io` (without the repository path). Optionally set repository Actions variable `VITE_GOOGLE_CLIENT_ID` to the public OAuth Web client ID before building. The workflow reads this variable; otherwise enter the ID in the dashboard UI. No Google client secret is used.

Publishing this static app exposes its code and the user-authorized Prioritization snapshot to viewers of the Pages site. Future snapshots imported by a viewer remain browser-local until explicitly bundled and published. Private Google Sheets rows are fetched only in an authorized viewer's browser. There is no server-side Google credential, source-data upload, or server-side storage of imported source data. Project edits remain local to each browser.

Local Pages build check:

```sh
PAGES_BASE_PATH=/FRMprio/ npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Changing to a custom domain or another Pages path requires updating `PAGES_BASE_PATH` in the deployment workflow and the Google OAuth authorized origin.

## Source-backed workbook mapping

The Prioritization schema uses B reference, C activity, D control scope, E PwC owners, F FRM leads, G FRM priority/timing, H category, I PwC priority, J stated alignment, K activity type, L current estimated effort, M actuals incurred, N reported remaining, O/P completed/outstanding control counts, Q original due, R proposed updated due, S delay causes, T time used, U notes/actions, V five delivery perspectives, W start date, and X staffing support.

Source values are preserved as quoted context, including cached formula-error markers. Dates and numbers that cannot be parsed remain unknown. Current estimates are not silently interpreted as original approved baseline, and actual effort is not treated as completed planned work. Original and revised dates are retained separately. When R has a date range, its last stated date is identified as a range endpoint. If only Q has a precise date, the chart labels it as original due only. Bars require both start and end dates; missing starts use due markers rather than fabricated windows. Progress percentages are not inferred.

Portfolio summaries show known numeric subtotals and unknown counts. Positive remaining hours exclude negative reported balances; negative source values are still displayed and counted in the signed source subtotal. Column V text is not added to N because overlap may exist. No capacity gap is computed without a confirmed baseline, incremental work classification and available future capacity. Formal status is not supplied by this source: displayed indications are attributed to source notes, section placement or recorded effort, and users can filter them. Duplicate reference numbers use sheet-row IDs; repeated narratives and conflicting numeric statements are flagged.

Most tests use synthetic data; the default-view test also validates the explicitly published source snapshot. The source data in src/data/prioritization.json is included in the deployment with the user's authorization. Do not add unrelated tabs, future private uploads or private screenshots to the repository without authorization. Files imported later into a viewer's browser do not automatically become part of a GitHub Pages deployment. Stored source snapshots take precedence over the bundled default, preserving local imports and live updates. The Manual projects / Workbook view preference also persists across reloads.
