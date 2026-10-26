# FRMprio

React and TypeScript dashboard for FRM / PwC project coordination, published through GitHub Pages.

## Current source

The user-authorized snapshot in `src/data/prioritization.json` comes from the **Prioritization** tab in `OAI Blueprint IT Team Wide Weekly Sync Agenda (2).xlsx`, with the user's October 20–21 decisions and the team’s October 21 Slack updates (supplied October 26) applied. It now contains 49 activities, including the user-requested OE testing split/additions and Non-GAAP metrics: 7 completed and 1 closed because Nano will not be assessed in FY26. Only columns marked orange in the workbook are included:

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

Meeting decisions are stored separately from worksheet values, attributed to Sonu, Mayra, Jeff or Layla, and shown in activity details and a collapsible summary grouped by the project’s assigned PwC owners from worksheet column E and explicit user additions. Member and focus filters isolate moved dates, new TBDs, existing TBDs and discussion actions without changing the Gantt filters. Date moves and new TBDs show workbook end → current end. Keystone is a confirmed date, and Chronosphere was already TBD; neither is labeled a new change. Activity links clear project filters and open the matching detail. Lead views and exports retain their scoped notes. Each update shows a prominent **Update from** line beside its worksheet owner, with the provider’s full name where the worksheet identifies it and the date the note was recorded. The note source follows the user’s supplied meeting notes and is retained separately from project ownership. Shared-owner updates appear under every listed owner, with headline and focus totals counting each update once. Removed activities retain their original column E owners in change records; missing ownership is shown explicitly and is never inferred from the note provider. The original 45 retained activities and removed rows were audited directly against the latest supplied workbook. Additional activity ownership follows explicit user instructions. Stripe and Vertex list Joaquin Garcia and Mayra Mendoza; Chronosphere, Revenue new controls and Azure list Mayra Mendoza. The recorded date is when notes were supplied; the separately confirmed Slack post date is shown where available. The October 21 team posts were recorded October 26. Relative dates are anchored to the confirmed post date, not the later import date. Applied interpretations are labeled separately. Original orange-column values remain available in details and exports.

Layla’s additional Deloitte monitoring follow-up remains **In progress**, with its end moved from October 15 to **December 31, 2026** for additional TOE testing. The original workbook date and older Sarah follow-up are retained as historical context. The original monitoring assessment remains complete. Monorepo Automated Account Classification is **On track** with an **October 31** end; Monorepo Inventory remains a separate completed activity. Engine Manager UI Change completion and the separately planned UAR are unchanged.

AWS’s invalid `11/31` end is corrected to **November 30**, retaining its October 26 start. Keystone remains October 30, API Tokenization October 23 and Vertex October 31. Revenue, Chronosphere and Stripe retain TBD ends. Chronosphere is **On hold on the FRM side**. Stripe is **Waiting on FRM**, remains open in the portfolio, and has its unresolved-date escalation explicitly paused at Mayra’s request. It is excluded from the escalation filter and Ale-kazam, never marked complete. A supplied end date, an invalid replacement date or a new reported risk restores normal escalation checks.

**SDLC / Pando** is reassigned to **Ben Oates**, with Avi retained as FRM lead. **Platform OE ITACs** replaces Sonu with **Stephen Wilm**, retaining Mayra and Layla as co-owners; ITGCs retains Sonu/Mayra/Layla. Original column E values are preserved separately from effective owner overrides. Filters, member summaries, readout tags, lead views and exports use effective ownership; note attribution stays with the provider (Mayra for Pando, Sonu for the ITACs handoff).

Stephen’s **Ads Sprint 1** report is **On track**, with four workpapers remaining and no confirmed completion. “This week” belongs to the October 21 report; that week has elapsed as of October 26, so closure is not assumed. The workbook October 30 end is retained. **Ads New ITAC Controls — Phases 2 & 3** remains one activity, owned by Stephen with FRM lead Urminder, **October 13–November 15**. Its PBC dependency was escalated to Urminder and is tracked with TPM `@sdp`; this now appears in escalation/readout despite the future target. Original Sprint 1.5/Sprint 2/3 workbook wording remains available as context, not a separate allocation or replacement deadline.

**Oracle MCP** is **At risk** against October 30. The October 16 testing issue allowed journal posting without approval and posting to the wrong Oracle environment. `@ssherugar` had an RCA meeting planned October 21; no outcome was supplied. Stephen and Joaquin remain the PwC owners and Sudhika the FRM lead. The readout calls for the RCA outcome, remediation/retesting and a confirmed or revised date. A future due date does not hide a reported control or delivery risk.

The four OE testing lines remain separate high-level items. Non-Platform ITACs/ITGCs keep Stephen/Jeff, Sudhika/Chandana, Moderate priorities, Deprioritized section and the shared October 19–December 15 window; no separate effort allocation is inferred. Platform ITACs (Stephen/Mayra/Layla) and ITGCs (Sonu/Mayra/Layla) are **Waiting on FRM** for confirmation of the TOD reassessment, linked to Revenue. Dates, priorities and FRM leads remain unconfirmed. Detailed OE scope/progress remains in the separate dashboard; no link or detailed figures were invented. User-added entries are labeled as added activities, not workbook source rows, and remain portable in JSON exports/imports.

Revenue’s consolidated scope retains Databricks–Orion context and both FRM leads. Mayra’s October 21 “tomorrow” sets an **October 22 follow-up checkpoint**. As of October 26 it has passed without confirmation in the supplied updates; the readout calls for escalation with Urminder/Ash. Her initial October 9 deadline is historical context, not a replacement delivery end; end remains TBD. The PwC High versus FRM Low priority disagreement remains a separate alignment decision. No FRM confirmation, completion or replacement date is invented.

**Non-GAAP metrics** remains **In progress**, owned by Stephen with Avi/Ale, starting **July 2026** (day unspecified), ending **November 15**. Contracted Power is the final metric remaining; other metrics are ready. No completion percentage is inferred. Original removals (Azure, SDLC–Keystone and the absent standalone Non-Rev line), FY26 Nano scope closure and the separate 2026/2027 IronClad interpretations are retained.

## Filters and dates

- Multi-select filters for individual FRM leads and PwC owners, separate FRM/PwC priority ratings, and category. Shared owners and shared leads are matched individually; full source wording remains in details.
- OR within a multi-select filter, AND across different filters. Active selections can be removed individually or cleared together.
- Alignment filters include explicit No and differing known ratings. An inconsistent Yes is shown as needing alignment, with its original source value preserved in details. Blank/TBD is not treated as aligned.
- Clickable completed, escalation and alignment summary cards; section/date-status filters and priority sorting.
- W is the start and X is the end. Y is staffing. No fallback to excluded historical dates. Due-date ranges retain the source range and use the final stated date as the timeline endpoint.
- Completed section membership or X marked Completed takes precedence and is green. If no actual completion date was supplied, the chart says so instead of inventing a date or duration.
- Unfinished work with TBD, pending/missing/unresolved dates, invalid ordering, an overdue end, a passed follow-up checkpoint, or a reported risk/escalated dependency is red for escalation. Explicitly paused unresolved-date items remain open in a separate amber state and can be filtered as Escalation paused. Dates are checked in America/Los_Angeles and rechecked each minute and on visibility changes. An end today is not yet overdue. Past actual starts alone are not overdue. N/A/ongoing PMO dates remain undated.
- Both dates appear as text alongside the Gantt. Bars require exact dates; a diamond means end only. Month-only starts (for example July 2026 or 2026-07) retain their precision and are labeled as month only. They extend the displayed timeline range to include that month but do not create a daily start date or a precise-duration bar. A known start month alone does not trigger a missing-start escalation; a start month later than the end date still escalates. No progress percentages are inferred.

## FRM lead views

Project dashboard remains the complete, deduplicated portfolio. The navigation provides a view for each FRM lead found in the source, with activity counts. On mobile these are horizontally scrollable view tabs. Shared activities appear once in the overall portfolio and in every assigned lead's view.

A lead view scopes its Gantt, dates, completion/escalation/alignment metrics, owner/category/priority filters, and activity details to that lead. Clickable breakdowns show FRM priorities, categories and PwC ownership. Shared-owner activities count under each relevant owner, so owner totals need not sum to the activity count. Clearing filters does not remove the lead scope. Navigation starts each view with clear filters; live refreshes retain the current scope and filters.

URLs such as `#lead=Avi` can be shared or reloaded; `#portfolio` returns to the overall dashboard. Lead exports include only that lead's source rows and preserve shared ownership and source row references. Overall exports continue to include the full source snapshot. Staffing remains detail-only.

## Ale-kazam readout

The **Ale-kazam** button at the top opens Alejandro's high-level readout across the entire active source snapshot, independently of lead views and project filters. The shareable link is `#view=ale-kazam`. It contains only decision metrics and two compact lists: Escalations and PwC / FRM alignment. Each decision shows both the worksheet's PwC owners and its effective FRM leads as separate tags, a short topic, and a one-sentence next step based on the recorded blocker. These are proposed next steps for Alejandro and the team, not additional meeting commitments.

As of October 26, 2026, the source has **9 decision items: 8 escalations and 1 alignment item across 8 topics**: API Tokenization (October 23 end passed), Revenue, Chronosphere hold, Ads Phases 2/3 PBC dependency, Oracle risk, Pando (Ben), and both Platform OE buckets, plus Revenue priority alignment. Corrected AWS and monitoring dates remove their prior date escalations. Stripe is explicitly paused. Counts change with the date and reported facts. Revenue new controls appears in both buckets, with separate scope/date and priority decisions. Counts follow the same date-health and alignment rules as the dashboard, including the deprioritized SDLC–Pando item with a missing start date. Counts update as the data or Pacific date changes; they are not fixed at seven. Completed date escalations drop out. The Google Sheets panel stays mounted while hidden in the readout so an authorized session can continue refreshing. Use **Back to dashboard** or a lead navigation button to return to the normal views.

Each item also shows **First logged**, **Last seen** and its update status. The initial seven decisions were first logged on **October 20, 2026**; no earlier escalation dates are inferred from due dates or meeting notes. An item present in the immediately preceding logged update is highlighted **Carryover**, with its number of logged appearances and a headline carried-over count. An item that leaves a bucket and later returns shows **Seen previously** and retains its first date. Escalation and alignment histories are separate even for the same topic. Owner handoffs, worksheet row moves and changes to text after the activity's first line do not reset its history. Dates use Pacific time.

Published history lives in `src/data/ale-history.json`. `npm run readout:log` (also run automatically by `npm run build`) records a changed source update or changed decision membership; commit that generated log alongside future source updates so later publications retain the shared history. A source version is counted once: page reloads and UI-only deployments do not create check-ins. Unchanged live Google Sheets polling is counted at most once per Pacific day; changed sheet content can create another update that day. A later check-in is recorded when fresh live data is actually fetched, not simply when the calendar advances.

Browser imports and live refreshes extend the log in local storage and carry it in source JSON exports; imports do not write back to the repository or other viewers. Lead exports retain only their scoped topics' history. Published entries remain available without browser storage. If a browser cannot save additional history, the readout displays an error and an export preserves the in-memory log. There is no shared write backend; publish the exported source and updated history to share a browser-local update with everyone.

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

The build checks TypeScript. The 57 tests cover the manual planner, Google read/expiry/disconnect behavior, orange-only projection, individual/shared-person filters, combined filters, alignment, date boundaries and completed precedence, detail-only staffing, browser-cache upgrades, default/live source loading, meeting provenance and date overrides, scope closures, removals, merged revenue context, returning to the published update, member summaries, new versus existing TBDs, Layla's status updates, linked activity selection and scoped exports, mobile summary filters, a worksheet-derived ownership fixture, shared / missing / removed ownership attribution, and the Ale-kazam readout's counts, overlap, actions, ownership, full-portfolio scope, navigation, mobile layout, Pacific rollover and ongoing authorized refresh, plus first/last dates, consecutive and returning items, stable identity across row and owner changes, idempotent polling, scoped history exports, persistence across reloads and browsers, and visible storage failures. Chromium may require execution outside the cloud sandbox. System Chromium is used when available; otherwise run `npx playwright install chromium`.

## GitHub Pages deployment

`.github/workflows/pages.yml` deploys on pushes to main. In repository Settings → Pages, choose **GitHub Actions** as the source. Builds use `PAGES_BASE_PATH=/FRMprio/`. The expected site is `https://swilmy25.github.io/FRMprio/`; verify the deployment workflow before claiming a pushed update is live. This cloud runtime may block GitHub API and Pages HTTP verification even when Git push works.

Optional repository Actions variable `VITE_GOOGLE_CLIENT_ID` supplies the public Google client ID at build time. Do not change repository visibility or add Google secrets to work around access failures.

Production path check:

```sh
PAGES_BASE_PATH=/FRMprio/ npm run build
npm run preview -- --host 127.0.0.1 --port 4173 --strictPort
```

A custom domain or different Pages path requires updating the build base and Google authorized origin.
