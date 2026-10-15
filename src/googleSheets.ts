export const SPREADSHEET_ID = '1jSFvzJaWn_QlN53gygctoY_Y2Avt_jh3pm-ybYXuizc'
export const SHEET_ID = 8496958
export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly'
export type SheetSnapshot = { title: string; rows: string[][]; fetchedAt: number; sections?: Record<string,string> }
export type TokenResponse = { access_token?: string; expires_in?: number; error?: string; scope?: string }
type GoogleIdentity = { accounts: { oauth2: { initTokenClient: (config: {
  client_id: string; scope: string; include_granted_scopes: boolean;
  callback: (response: TokenResponse) => void; error_callback: (error: { type: string }) => void;
}) => { requestAccessToken: (options: { prompt: string }) => void }; revoke: (token: string, callback: () => void) => void } } }
declare global { interface Window { google?: GoogleIdentity } }
let identityPromise: Promise<GoogleIdentity> | undefined
export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google?.accounts.oauth2) return Promise.resolve(window.google)
  if (identityPromise) return identityPromise
  identityPromise = new Promise<GoogleIdentity>((resolve, reject) => {
    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    const timeout = window.setTimeout(() => { script.remove(); reject(new Error('Google sign-in timed out. Check connectivity and try again.')) }, 20000)
    script.onload = () => { clearTimeout(timeout); if (window.google?.accounts.oauth2) resolve(window.google); else { script.remove(); reject(new Error('Google sign-in could not initialize.')) } }
    script.onerror = () => { clearTimeout(timeout); script.remove(); reject(new Error('Google sign-in could not load. Allow accounts.google.com and try again.')) }
    document.head.append(script)
  }).catch(error => { identityPromise = undefined; throw error })
  return identityPromise
}
async function getJson(url: string, token: string, signal: AbortSignal) {
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal, cache: 'no-store' })
  if (!response.ok) {
    if (response.status === 401) throw new Error('Your Google session expired. Reconnect to refresh the sheet.')
    if (response.status === 403) throw new Error('Google denied access. Confirm the signed-in account can view this sheet and the Google Sheets API is enabled for the OAuth project. Workspace policy may also require administrator approval.')
    if (response.status === 404) throw new Error('The spreadsheet could not be found for this account.')
    throw new Error(`Google Sheets request failed (${response.status}). Try refreshing later.`)
  }
  return response.json()
}
export async function readPrioritization(token: string, signal: AbortSignal): Promise<SheetSnapshot> {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}`
  const metadata = await getJson(`${base}?fields=sheets(properties(sheetId,title))`, token, signal)
  const tab = metadata.sheets?.find((s: { properties?: { sheetId: number; title: string } }) => s.properties?.sheetId === SHEET_ID)?.properties
  if (!tab || typeof tab.title !== 'string') throw new Error('The linked Prioritization tab is missing. Check whether it was deleted or replaced.')
  const range = encodeURIComponent(`'${tab.title.replaceAll("'", "''")}'`)
  const data = await getJson(`${base}/values/${range}?majorDimension=ROWS&valueRenderOption=FORMATTED_VALUE`, token, signal)
  if (data.values !== undefined && (!Array.isArray(data.values) || data.values.some((row: unknown) => !Array.isArray(row)))) throw new Error('Google returned an unexpected sheet format.')
  return { title: tab.title, rows: (data.values ?? []).map((row: unknown[]) => row.map(value => String(value ?? ''))), fetchedAt: Date.now() }
}
export function columnLetter(index: number): string {
  let value = index + 1, result = ''
  while (value > 0) { value--; result = String.fromCharCode(65 + value % 26) + result; value = Math.floor(value / 26) }
  return result
}
