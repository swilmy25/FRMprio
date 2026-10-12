export const SOURCE_STORAGE = 'frmprio.prioritization.v1'
export type SourceSnapshot = { kind: 'frmprio.prioritization.v1'; fileName: string; tabName: string; importedAt: string; rows: string[][] }
export type SourceActivity = {
  id: string; row: number; ref: string; name: string; section: string;
  pwcOwners: string; frmLeads: string; staffing: string; frmPriority: string; pwcPriority: string; alignment: string;
  category: string; activityType: string; estimate: number | null; actual: number | null; remaining: number | null;
  controls: string; completedControls: string; outstandingControls: string;
  originalDue: string; revisedDue: string; startRaw: string; start: string | null; end: string | null; endBasis: string;
  delay: string; timeUsed: string; notes: string; response: string;
  perspectives: Record<'a' | 'b' | 'c' | 'd' | 'e', string>; warnings: string[]; status: string;
}
export function sourceNumber(value: string): number | null {
  if (!/^\s*-?(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*$/.test(value)) return null
  const n = Number(value.replaceAll(',', ''))
  return Number.isFinite(n) ? n : null
}
export function sourceDate(value: string): string | null {
  const iso = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  const us = value.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!iso && !us) return null
  const normalized = iso ? value.trim() : `${us![3]}-${us![1].padStart(2, '0')}-${us![2].padStart(2, '0')}`
  const parsed = new Date(`${normalized}T00:00:00Z`)
  return Number.isFinite(parsed.valueOf()) && parsed.toISOString().slice(0, 10) === normalized ? normalized : null
}
export function splitPerspectives(text: string): SourceActivity['perspectives'] {
  const result = { a: '', b: '', c: '', d: '', e: '' }
  const markers = [...text.matchAll(/(?:^|\n)\s*([a-e])\)\s*/gi)]
  for (let i = 0; i < markers.length; i++) {
    const match = markers[i]
    const key = match[1].toLowerCase() as keyof typeof result
    result[key] = text.slice(match.index! + match[0].length, markers[i + 1]?.index ?? text.length).trim()
  }
  return result
}
export function isSourceSnapshot(value: unknown): value is SourceSnapshot {
  if (!value || typeof value !== 'object') return false
  const v = value as SourceSnapshot
  return v.kind === 'frmprio.prioritization.v1' && typeof v.fileName === 'string' && typeof v.tabName === 'string' && typeof v.importedAt === 'string' && Number.isFinite(Date.parse(v.importedAt)) && Array.isArray(v.rows) && v.rows.length <= 10000 && v.rows.every(row => Array.isArray(row) && row.length <= 200 && row.every(cell => typeof cell === 'string'))
}
export function parseSource(snapshot: SourceSnapshot): SourceActivity[] {
  const header = snapshot.rows.findIndex(row => /task\s*\/\s*activity/i.test(row[2] ?? '') && /FRM Lead/i.test(row[5] ?? '') && /Owner/i.test(row[4] ?? ''))
  if (header < 0) throw new Error('The Prioritization column layout is unrecognized. Expected Task / Activity in C, owners in E, and FRM Lead in F.')
  let section = 'Active portfolio'
  const activities: SourceActivity[] = []
  const responseCounts = new Map<string, number>()
  for (const row of snapshot.rows.slice(header + 1)) if (row[2]?.trim() && row[21]?.trim()) responseCounts.set(row[21].trim(), (responseCounts.get(row[21].trim()) ?? 0) + 1)
  snapshot.rows.slice(header + 1).forEach((cells, index) => {
    const cell = (i: number) => (cells[i] ?? '').trim()
    if (!cell(2)) { if (/depriorit/i.test(cell(1))) section = 'Deprioritized'; return }
    const warnings: string[] = []
    const estimate = sourceNumber(cell(11)), actual = sourceNumber(cell(12)), remaining = sourceNumber(cell(13))
    const start = sourceDate(cell(22))
    const revised = sourceDate(cell(17))
    const range = cell(17).match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s*-\s*(\d{1,2}\/\d{1,2}\/\d{4})$/)
    const rangeEnd = range ? sourceDate(range[2]) : null
    const end = revised ?? rangeEnd ?? sourceDate(cell(16))
    const endBasis = revised ? 'Proposed updated due' : rangeEnd ? 'Updated due range endpoint' : end ? 'Original due only' : 'End unknown'
    if(rangeEnd) warnings.push('R contains a due-date range. The last stated date is shown as an endpoint, not a single agreed deadline.')
    if(end && endBasis === 'Original due only') warnings.push('No precise revised due date; the timeline shows the original due date only.')
    const perspectives = splitPerspectives(cell(21))
    if (estimate === null) warnings.push(`Estimated effort is unknown (L: ${cell(11) || 'blank'}).`)
    if (actual === null) warnings.push(`Actual hours are unknown (M: ${cell(12) || 'blank'}).`)
    if (remaining === null) warnings.push(`Remaining hours are unknown (N: ${cell(13) || 'blank'}).`)
    if (remaining !== null && remaining < 0) warnings.push(`Reported remaining is ${remaining} hrs; actuals exceed the estimate. This is an estimate overrun, not negative future work.`)
    if (estimate !== null && actual !== null && remaining !== null && Math.abs(estimate - actual - remaining) > 0.05) warnings.push('L − M does not reconcile with N; values are preserved as reported.')
    if (!start) warnings.push(`No precise start date (W: ${cell(22) || 'blank'}); no start date is inferred.`)
    if (!end) warnings.push(`No single end date (R: ${cell(17) || 'blank'}, Q: ${cell(16) || 'blank'}).`)
    if (start && end && start > end) warnings.push('Source start date is after the due date; the timeline window is not plotted.')
    if (cell(9).toLowerCase() === 'no') warnings.push('FRM and PwC alignment is explicitly marked No (J).')
    if (/^done\b/i.test(cell(20)) && remaining !== null && remaining > 0) warnings.push('U says Done but N still reports remaining hours; completion status needs review.')
    if (/refer .*row above/i.test(`${cell(18)} ${cell(19)}`)) warnings.push('This row refers to another activity. Confirm coverage before aggregating its control/report counts again.')
    if (cell(21) && (responseCounts.get(cell(21)) ?? 0) > 1) warnings.push('Column V repeats verbatim on multiple activities; confirm attribution before totaling this narrative.')
    const aHours = perspectives.a.match(/\b(\d+(?:\.\d+)?)\s*(?:hrs|hours)\b/i)
    const bHours = perspectives.b.match(/\b(\d+(?:\.\d+)?)\s*(?:hrs|hours)\b/i)
    if (aHours && actual !== null && Number(aHours[1]) !== actual) warnings.push(`V(a) reports ${aHours[1]} hrs versus ${actual} actual hrs in M. The two figures are not merged.`)
    if (bHours && remaining !== null && Number(bHours[1]) !== remaining) warnings.push(`V(b) reports ${bHours[1]} hrs versus ${remaining} remaining hrs in N. Confirm scope and timing.`)
    const status = section === 'Deprioritized' ? 'Deprioritized' : actual !== null && estimate !== null && actual > estimate ? 'Effort overrun' : /^done\b/i.test(cell(20)) && remaining === 0 ? 'Reported complete' : /on track/i.test(`${cell(18)} ${cell(21)}`) ? 'Reported on track' : cell(18) && !/^(N\/A|No Delay)/i.test(cell(18)) ? 'Delay noted' : /\bat risk\b/i.test(cell(20)) ? 'Risk noted' : actual === 0 ? 'No hours recorded' : 'Status not supplied'
    activities.push({ id: `source-row-${header + index + 2}`, row: header + index + 2, ref: cell(1), name: cell(2), section, pwcOwners: cell(4), frmLeads: cell(5), frmPriority: cell(6), pwcPriority: cell(8), alignment: cell(9), category: cell(7), activityType: cell(10), estimate, actual, remaining, controls: cell(3), completedControls: cell(14), outstandingControls: cell(15), originalDue: cell(16), revisedDue: cell(17), startRaw: cell(22), start, end, endBasis, delay: cell(18), timeUsed: cell(19), notes: cell(20), response: cell(21), staffing: cell(23), perspectives, warnings, status })
  })
  return activities
}
export function priorityRank(value: string): number { return /critical/i.test(value) ? 0 : /^high/i.test(value) ? 1 : /^(moderate|medium)/i.test(value) ? 2 : /^low/i.test(value) ? 3 : 4 }
export function knownTotals(activities: SourceActivity[]) {
  const sum = (key: 'estimate' | 'actual' | 'remaining') => ({ hours: activities.reduce((n, p) => n + (p[key] ?? 0), 0), known: activities.filter(p => p[key] !== null).length })
  return { estimate: sum('estimate'), actual: sum('actual'), remaining: sum('remaining'), positiveRemaining: activities.reduce((n,p) => n + Math.max(0, p.remaining ?? 0),0), negativeRemaining: activities.filter(p => p.remaining !== null && p.remaining < 0).length }
}
