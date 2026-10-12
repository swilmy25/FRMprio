import data from './data/prioritization.json'
import { isSourceSnapshot, parseSource } from './prioritization'
import type { SourceSnapshot } from './prioritization'

if (!isSourceSnapshot(data)) throw new Error('Published Prioritization snapshot is invalid.')
parseSource(data)
export const PUBLISHED_SNAPSHOT: SourceSnapshot = data
