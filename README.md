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

Initial data is illustrative and clearly labeled. It is not sourced from the user's spreadsheet. The Google Sheets Prioritization tab requires access or an uploaded export before actual data can be mapped, including columns V–X. Preserve missing values as unknown when mapping actual records; do not infer missing dates, hours or baseline commitments.

Data is saved in the current browser only. Local project records have no shared database. A separate read-only Google Sheets source panel can read the private Prioritization tab after OAuth setup; it does not yet map or overwrite Gantt project records. Export JSON to back up or transfer projects; importing replaces the current project set after confirmation.

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

## Calculation rules

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

Tokens remain only in memory and are cleared on disconnect/reload; the public client ID may be retained in browser storage. Disconnect clears the local session and source view, but does not revoke the app's grant in Google account settings. Source data is not stored on the server. “Export source for mapping” downloads a token-free JSON snapshot that can be provided to Codex to verify headers, missing values and the project mapping. The local Gantt records remain unchanged until that mapping is implemented and verified.

Connecting the dashboard is separate from connecting Google Drive to a Codex chat. No Google Drive connector or account-linking tool was available to this session. Browser OAuth does not grant the assistant persistent access to your Google account.

## Publish with GitHub Pages

The repository includes `.github/workflows/pages.yml`. A push to `main` builds and deploys the dashboard to the repository Pages path `/FRMprio/`. The development server continues to use `/`.

1. In GitHub repository **Settings → Pages → Build and deployment**, choose **GitHub Actions** as the source. Depending on repository visibility and account plan, GitHub Pages may require an eligible plan. Do not change repository visibility to work around this without the owner's approval.
2. Push the project to `main`. If it is already pushed, run **Actions → Deploy dashboard to GitHub Pages → Run workflow** after selecting the Pages source.
3. Open the URL reported by the successful deployment. The expected default URL is `https://swilmy25.github.io/FRMprio/`; this is not a verified deployment until the workflow succeeds and the page responds.

For Google sign-in, the Authorized JavaScript origin is `https://swilmy25.github.io` (without the repository path). Optionally set repository Actions variable `VITE_GOOGLE_CLIENT_ID` to the public OAuth Web client ID before building. The workflow reads this variable; otherwise enter the ID in the dashboard UI. No Google client secret is used.

Publishing this static app exposes the app code and illustrative sample data to viewers of the Pages site. Private Google Sheets rows are fetched only in an authorized viewer's browser. There is no server-side Google credential, source-data upload, or automatic source-to-Gantt mapping. Project edits remain local to each browser.

Local Pages build check:

```sh
PAGES_BASE_PATH=/FRMprio/ npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

Changing to a custom domain or another Pages path requires updating `PAGES_BASE_PATH` in the deployment workflow and the Google OAuth authorized origin.
