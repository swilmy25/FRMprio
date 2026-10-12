import { useCallback, useEffect, useRef, useState } from 'react'
import { columnLetter, loadGoogleIdentity, readPrioritization, SHEETS_SCOPE, SPREADSHEET_ID, SHEET_ID } from './googleSheets'
import type { SheetSnapshot } from './googleSheets'

const CLIENT_STORAGE = 'frmprio.google.clientId'
export default function LiveSheet({ onSnapshot }: { onSnapshot?: (snapshot: SheetSnapshot) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [clientId, setClientId] = useState(() => { try { return localStorage.getItem(CLIENT_STORAGE) ?? import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '' } catch { return import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '' } })
  const [connected, setConnected] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [snapshot, setSnapshot] = useState<SheetSnapshot | null>(null)
  const [automatic, setAutomatic] = useState(true)
  const [page, setPage] = useState(0)
  const token = useRef<{ value: string; expiry: number } | null>(null)
  const request = useRef<AbortController | null>(null)
  const generation = useRef(0)
  const expiryTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendingAuth = useRef(false)
  const mounted = useRef(true)
  const teardown = useCallback(() => { mounted.current = false; generation.current++; request.current?.abort(); if (expiryTimer.current) clearTimeout(expiryTimer.current); token.current = null }, [])
  useEffect(() => { mounted.current = true; return teardown }, [teardown])

  const refresh = useCallback(async () => {
    const credential = token.current
    if (!credential || credential.expiry <= Date.now()) { setConnected(false); setError('Your Google session expired. Reconnect to refresh the sheet.'); return }
    request.current?.abort()
    const controller = new AbortController()
    request.current = controller
    const version = generation.current
    const timeout = setTimeout(() => controller.abort(), 20000)
    setBusy(true); setError('')
    try {
      const data = await readPrioritization(credential.value, controller.signal)
      if (mounted.current && generation.current === version && request.current === controller) { setSnapshot(data); setPage(0); onSnapshot?.(data) }
    } catch (e) {
      if (mounted.current && generation.current === version && request.current === controller) setError(controller.signal.aborted ? 'Sheet refresh timed out. The last successful data remains below; try again.' : e instanceof Error ? e.message : 'Sheet refresh failed.')
    } finally {
      clearTimeout(timeout)
      if (mounted.current && generation.current === version && request.current === controller) { request.current = null; setBusy(false) }
    }
  }, [onSnapshot])

  const connect = async () => {
    const id = clientId.trim()
    if (!/^[A-Za-z0-9_-]+\.apps\.googleusercontent\.com$/.test(id)) { setError('Enter a Google OAuth Web client ID ending in .apps.googleusercontent.com. This is a public identifier, not a client secret.'); return }
    const version = ++generation.current
    request.current?.abort(); request.current = null
    token.current = null; setConnected(false)
    if (expiryTimer.current) clearTimeout(expiryTimer.current)
    setBusy(true); setError(''); pendingAuth.current = true
    try {
      const google = await loadGoogleIdentity()
      if (!mounted.current || generation.current !== version) return
      try { localStorage.setItem(CLIENT_STORAGE, id) } catch { /* Public client ID can be entered again next session. */ }
      const client = google.accounts.oauth2.initTokenClient({ client_id: id, scope: SHEETS_SCOPE, include_granted_scopes: false,
        callback: response => {
          if (!mounted.current || generation.current !== version) return
          pendingAuth.current = false
          if (response.error || !response.access_token || !Number.isFinite(Number(response.expires_in)) || Number(response.expires_in) <= 0) { setBusy(false); setError('Google access was not granted. Reconnect and approve read-only Sheets access.'); return }
          const expiresIn = Number(response.expires_in) * 1000
          token.current = { value: response.access_token, expiry: Date.now() + expiresIn }
          setConnected(true)
          expiryTimer.current = setTimeout(() => { token.current = null; request.current?.abort(); setConnected(false); setBusy(false); setError('Your Google session expired. Reconnect to refresh. The last successful data remains visible.') }, expiresIn)
          void refresh()
        },
        error_callback: () => { if (mounted.current && generation.current === version) { pendingAuth.current = false; setBusy(false); setError('Google sign-in was closed or blocked. Allow the sign-in popup and try again.') } },
      })
      client.requestAccessToken({ prompt: 'consent' })
    } catch (e) { if (mounted.current && generation.current === version) { pendingAuth.current = false; setBusy(false); setError(e instanceof Error ? e.message : 'Google sign-in failed.') } }
  }
  const disconnect = () => {
    generation.current++; pendingAuth.current = false; request.current?.abort(); request.current = null
    if (expiryTimer.current) clearTimeout(expiryTimer.current)
    token.current = null; setConnected(false); setBusy(false); setSnapshot(null); setError('')
  }
  useEffect(() => {
    if (!connected || !automatic) return
    const timer = setInterval(() => { if (!document.hidden && !request.current && !pendingAuth.current) void refresh() }, 5 * 60 * 1000)
    return () => clearInterval(timer)
  }, [automatic, connected, refresh])
  const exportSource = () => { if (!snapshot) return; const url = URL.createObjectURL(new Blob([JSON.stringify({ spreadsheetId: SPREADSHEET_ID, sheetId: SHEET_ID, ...snapshot }, null, 2)], { type: 'application/json' })); const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'prioritization-source.json'; anchor.click(); URL.revokeObjectURL(url) }
  const columns = snapshot ? snapshot.rows.reduce((max, row) => Math.max(max, row.length), 24) : 24
  const pages = snapshot ? Math.max(1, Math.ceil(snapshot.rows.length / 25)) : 1
  return <section className="panel live-sheet" aria-label="Live Google Sheets source">
    <div className="live-heading"><div><p className="eyebrow">LIVE SOURCE</p><h2>Google Sheets · Prioritization</h2><p>{snapshot ? `Last read ${new Date(snapshot.fetchedAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles' })} PT${error || !connected ? ' · Update paused' : ''}` : 'Connect your Google account to read the latest source, including columns V–X.'}</p></div><button className="button" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>{expanded ? 'Hide connection' : 'Connect Google Sheets'}</button></div>
    {expanded && <div className="live-body">
      {!connected && <><label className="client-label">Google OAuth Web client ID<input value={clientId} onChange={e => setClientId(e.target.value)} placeholder="Your client ID.apps.googleusercontent.com" autoComplete="off" /></label><p className="live-help">Sign in with an account that can view this sheet. Your sheet stays private. Access is read-only; your sign-in token remains in memory and is cleared on disconnect or reload.</p></>}
      <div className="live-actions">{connected ? <><button className="button" onClick={() => void refresh()} disabled={busy}>{busy ? 'Refreshing…' : 'Refresh now'}</button><button className="button" onClick={disconnect}>Disconnect</button><label className="auto-refresh"><input type="checkbox" checked={automatic} onChange={e => setAutomatic(e.target.checked)} />Refresh every 5 minutes while open</label></> : <><button className="button primary" onClick={() => void connect()} disabled={busy}>{busy ? 'Connecting…' : 'Sign in with Google'}</button>{busy && <button className="button" onClick={disconnect}>Cancel connection</button>}</> }<a className="button" href={`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit?gid=${SHEET_ID}`} target="_blank" rel="noreferrer">Open source sheet</a></div>
      {error && <p className="error" role="alert">{error}</p>}
      {!clientId && <p className="live-help">One-time setup: enable Google Sheets API in a Google Cloud project, configure Google Auth Platform consent, and create a Web OAuth client with this dashboard’s exact origin in Authorized JavaScript origins. Use an Internal audience if eligible, or add your account as a test user for an External app in testing. Enter its public client ID above. Do not enter a client secret. Use the origin shown in your browser’s address bar (scheme, hostname and port; no path).</p>}
      {snapshot && <><div className="live-read-note"><button className="button source-export" onClick={exportSource}>Export source for mapping</button><strong>{snapshot.title}</strong> · {snapshot.rows.length} source rows. All cells are shown as Google formats them; empty cells remain empty. Columns V–X are highlighted. Recognized Prioritization columns update the workbook dashboard; missing fields remain unknown. Manual project records remain separate.</div><div className="sheet-scroll"><table className="source-table"><thead><tr><th>Row</th>{Array.from({ length: columns }, (_, i) => <th key={i} className={i >= 21 && i <= 23 ? 'source-context' : ''}>{columnLetter(i)}</th>)}</tr></thead><tbody>{snapshot.rows.slice(page * 25, (page + 1) * 25).map((row, ri) => <tr key={ri}><th>{page * 25 + ri + 1}</th>{Array.from({ length: columns }, (_, ci) => <td key={ci} className={ci >= 21 && ci <= 23 ? 'source-context' : ''}>{row[ci] ?? ''}</td>)}</tr>)}</tbody></table></div>{!snapshot.rows.length && <p className="live-help">This tab has no populated cells.</p>}<div className="sheet-pagination"><button className="button" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page + 1} of {pages}</span><button className="button" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Next</button></div></>}
    </div>}
  </section>
}
