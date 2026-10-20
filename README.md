# FRMprio

React and TypeScript dashboard for FRM / PwC project coordination, published through GitHub Pages.

## Current source

The user-authorized snapshot in `src/data/prioritization.json` comes from the **Prioritization** tab in `OAI Blueprint IT Team Wide Weekly Sync Agenda (2).xlsx`, with the user's October 20, 2026 meeting decisions applied. It contains 45 activities: 7 completed and 1 closed because Nano will not be assessed in FY26. Only columns marked orange in the workbook are included:

| Column | Field |
| --- | --- |
| C | Task / activity |
| E | PwC owners |
| F | FRM lead |
| G | FRM proposed priority / timing |
| H | Category |
| I | PwC proposed priority |
| J | Alignment on prioritization |
| K | Activity type |
| W | Projected / actual start |
| X | Projected end |
| Y | Staffing support planned / currently |

The source uses colored markers in row 1, with labels in row 2. Excluded cells are empty in the published snapshot. Section membership (active, deprioritized, completed) is retained as structural metadata. No other workbook tabs are included. Hours, controls, original due dates and the blue column V narrative are excluded. Staffing support is shown only in the selected activity's detail view, not in overview rows, filters, search, or the raw source preview.

The user explicitly authorized publishing their supplied Prioritization data. This static snapshot and the app code are accessible to viewers of the GitHub Pages site and repository. Do not add unrelated tabs or other private uploads without authorization.

Meeting decisions are stored separately from worksheet values, attributed to Sonu, Mayra, Jeff or Layla, and shown in activity details and a collapsible summary grouped by the project’s PwC owners in worksheet column E. Member and focus filters isolate moved dates, new TBDs, existing TBDs and discussion actions without changing the Gantt filters. Date moves and new TBDs show workbook end → current end. Keystone is a confirmed date, and Chronosphere was already TBD; neither is labeled a new change. Activity links clear project filters and open the matching detail. Lead views and exports retain their scoped notes. Each update shows a prominent **Update from** line beside its worksheet owner, with the provider’s full name where the worksheet identifies it and the date the note was recorded. The note source follows the user’s supplied meeting notes and is retained separately from project ownership. Shared-owner updates appear under every listed owner, with headline and focus totals counting each update once. Removed activities retain their original column E owners in change records; missing ownership is shown explicitly and is never inferred from the note provider. All 45 retained activities and the removed rows were audited directly against the latest supplied workbook. Stripe and Vertex list Joaquin Garcia and Mayra Mendoza; Chronosphere, Revenue new controls and Azure list Mayra Mendoza. The recorded date is when the notes were supplied, not an assumed meeting date. Applied interpretations are labeled separately. Original orange-column values remain available in details and exports.

Layla's additional Deloitte monitoring follow-up remains **In progress** and needs her confirmation after meeting with Sarah. Its October 15 workbook end is retained and flagged overdue; no new date or TBD is invented. The separately completed original monitoring assessment stays complete. Engine Manager completion applies to **UI Change**, with its former due date retained only as workbook context. The separate November Engine Manager UAR remains planned pending scope clarification; no actual completion date is invented.

The update applies Keystone 10/30, API Tokenization 10/23 and Vertex 10/31 end dates; Revenue new controls, Chronosphere and Stripe remain TBD. Revenue's Databricks–Orion migration context is merged into Revenue new controls, counted once, and retained in both original FRM lead views. Azure and SDLC–Keystone are removed. The latest workbook no longer has a standalone Non-Rev controls line; its distinct AWS activity remains. AWS's invalid `11/31` end is unresolved and red. IronClad completion applies to the 2026 memo only; the separate 2027 scoping activity remains planned pending clarification. Nano is a scope closure, not evidence of completed testing, and no actual completion dates are invented.

## Filters and dates

- Multi-select filters for individual FRM leads and PwC owners, separate FRM/PwC priority ratings, and category. Shared owners and shared leads are matched individually; full source wording remains in details.
- OR within a multi-select filter, AND across different filters. Active selections can be removed individually or cleared together.
- Alignment filters include explicit No and differing known ratings. An inconsistent Yes is shown as needing alignment, with its original source value preserved in details. Blank/TBD is not treated as aligned.
- Clickable completed, escalation and alignment summary cards; section/date-status filters and priority sorting.
- W is the start and X is the end. Y is staffing. No fallback to excluded historical dates. Due-date ranges retain the source range and use the final stated date as the timeline endpoint.
- Completed section membership or X marked Completed takes precedence and is green. If no actual completion date was supplied, the chart says so instead of inventing a date or duration.
- Unfinished work with TBD, pending/missing/unresolved dates, invalid ordering, or an end before today is red for escalation. Dates are checked in America/Los_Angeles and rechecked each minute and on visibility changes. An end today is not yet overdue. Past actual starts alone are not overdue. N/A/ongoing PMO dates remain undated.
- Both dates appear as text alongside the Gantt. Bars require both dates; a diamond means end only. No progress percentages are inferred.

## FRM lead views

Project dashboard remains the complete, deduplicated portfolio. The navigation provides a view for each FRM lead found in the source, with activity counts. On mobile these are horizontally scrollable view tabs. Shared activities appear once in the overall portfolio and in every assigned lead's view.

A lead view scopes its Gantt, dates, completion/escalation/alignment metrics, owner/category/priority filters, and activity details to that lead. Clickable breakdowns show FRM priorities, categories and PwC ownership. Shared-owner activities count under each relevant owner, so owner totals need not sum to the activity count. Clearing filters does not remove the lead scope. Navigation starts each view with clear filters; live refreshes retain the current scope and filters.

URLs such as `#lead=Avi` can be shared or reloaded; `#portfolio` returns to the overall dashboard. Lead exports include only that lead's source rows and preserve shared ownership and source row references. Overall exports continue to include the full source snapshot. Staffing remains detail-only.

## Browser data and live Google Sheets

New visitors see the bundled snapshot without an import. Existing legacy source caches are ignored so the fresh publication is shown. Newer publications replace prior bundled defaults while preserving separately imported snapshots and manual project edits. A browser-local snapshot displays a **Load published update** action to return to the current workbook and meeting decisions after confirmation. Manual / workbook view choice persists.

**Import** accepts a current-layout Excel workbook containing Prioritization or a source JSON snapshot. Only the selected orange columns and structural sections are retained from Excel; cached formula errors are not evaluated. A raw workbook import does not contain the separately supplied meeting decisions. JSON exports retain applicable meeting annotations and merged context, including scoped lead exports. Imports persist locally in that browser. **Export** downloads the active snapshot or separate manual projects. Different browsers and cleared storage require the published default, another import or live access. The manual-project sample planner remains available separately.

Read-only Google sign-in and five-minute refresh while open, visible and authorized are implemented. Real Google access is still pending; OAuth/API tests use mocks. Tokens stay in memory, expire, and are cleared on disconnect/reload. Source snapshots already imported/refreshed remain in browser storage. Disconnect does not revoke Google's account-level app grant or erase saved workbook data.

To enable private live access:

1. Enable Google Sheets API in a Google Cloud project and configure OAuth consent / permitted test users or an eligible Internal audience.
2. Create a Web OAuth client with the exact deployed origin in Authorized JavaScript origins. For the default Pages address this is `https://swilmy25.github.io`, without `/FRMprio/`. Organization policy may require administrator approval.
3. Enter its public client ID in the dashboard connection panel, or configure `VITE_GOOGLE_CLIENT_ID` before building. Never enter a client secret or token in Vite variables.
4. Sign in with an account authorized to view the linked spreadsheet. Sheet ID `8496958` selects Prioritization by ID. Recognized source columns refresh the workbook view without overwriting manual projects.

Dashboard sign-in does not give this chat persistent Google account access. There is no unattended server sync or shared editing backend.

## Development and validation

Use Node.js 24 and npm 11, from `/workspace/FRMprio`:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

The explicit host avoids restricted interface enumeration in the cloud runtime.

```sh
npm run lint
npm run build
npm test
```

The build checks TypeScript. The 35 tests cover the manual planner, Google read/expiry/disconnect behavior, orange-only projection, individual/shared-person filters, combined filters, alignment, date boundaries and completed precedence, detail-only staffing, browser-cache upgrades, default/live source loading, meeting provenance and date overrides, scope closures, removals, merged revenue context, returning to the published update, member summaries, new versus existing TBDs, Layla's status updates, linked activity selection and scoped exports, mobile summary filters, a worksheet-derived ownership fixture, and shared / missing / removed ownership attribution. Chromium may require execution outside the cloud sandbox. System Chromium is used when available; otherwise run `npx playwright install chromium`.

## GitHub Pages deployment

`.github/workflows/pages.yml` deploys on pushes to main. In repository Settings → Pages, choose **GitHub Actions** as the source. Builds use `PAGES_BASE_PATH=/FRMprio/`. The expected site is `https://swilmy25.github.io/FRMprio/`; verify the deployment workflow before claiming a pushed update is live. This cloud runtime may block GitHub API and Pages HTTP verification even when Git push works.

Optional repository Actions variable `VITE_GOOGLE_CLIENT_ID` supplies the public Google client ID at build time. Do not change repository visibility or add Google secrets to work around access failures.

Production path check:

```sh
PAGES_BASE_PATH=/FRMprio/ npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

A custom domain or different Pages path requires updating the build base and Google authorized origin.
