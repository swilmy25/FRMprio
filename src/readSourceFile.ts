import { isSourceSnapshot, orangeOnly, parseSource } from './prioritization'
import type { SourceSnapshot } from './prioritization'
export async function readSourceFile(file: File): Promise<SourceSnapshot | null> {
  if (/\.xlsx$/i.test(file.name)) {
    const { readSheet } = await import('read-excel-file/browser')
    const raw = await readSheet(file, 'Prioritization', { trim: false })
    const rows = raw.map(row => row.map(cell => cell === null ? '' : cell instanceof Date ? cell.toISOString().slice(0,10) : String(cell)))
    // The spreadsheet reader omits cached formula errors. Recover those as literal unknown markers.
    const { unzipSync, strFromU8 } = await import('fflate')
    const files = unzipSync(new Uint8Array(await file.arrayBuffer()))
    const xml = (path:string) => new DOMParser().parseFromString(strFromU8(files[path]), 'application/xml')
    const workbook = xml('xl/workbook.xml')
    const sheet = Array.from(workbook.getElementsByTagName('sheet')).find(s=>s.getAttribute('name')==='Prioritization')
    const rels = xml('xl/_rels/workbook.xml.rels')
    const relationship = Array.from(rels.getElementsByTagName('Relationship')).find(r=>r.getAttribute('Id')===sheet?.getAttribute('r:id'))
    const target = relationship?.getAttribute('Target')
    const path = target?.startsWith('/') ? target.slice(1) : `xl/${target}`
    if (target && files[path]) { for(const cell of Array.from(xml(path).getElementsByTagName('c'))) {
      if(cell.getAttribute('t')!=='e') continue
      const coordinate=cell.getAttribute('r')?.match(/^([A-Z]+)(\d+)$/)
      if(!coordinate) continue
      const ri=Number(coordinate[2])-1, ci=[...coordinate[1]].reduce((n,l)=>n*26+l.charCodeAt(0)-64,0)-1
      rows[ri] ??= []; rows[ri][ci]=cell.getElementsByTagName('v')[0]?.textContent ?? '#FORMULA_ERROR!'
    }}
    const snapshot: SourceSnapshot = {kind:'frmprio.prioritization.v1', fileName:file.name, tabName:'Prioritization', importedAt:new Date().toISOString(), rows}
    parseSource(snapshot)
    return orangeOnly(snapshot)
  }
  const parsed: unknown = JSON.parse(await file.text())
  if (isSourceSnapshot(parsed)) { parseSource(parsed); return orangeOnly(parsed) }
  if (parsed && typeof parsed==='object' && 'rows' in parsed && 'title' in parsed) {
    const value = parsed as {rows: unknown; title: unknown; fetchedAt?: number}
    const snapshot = {kind:'frmprio.prioritization.v1', fileName:'Google Sheets export', tabName:value.title, importedAt:new Date(value.fetchedAt ?? Date.now()).toISOString(), rows:value.rows}
    if (isSourceSnapshot(snapshot)) {parseSource(snapshot);return orangeOnly(snapshot)}
  }
  return null
}
