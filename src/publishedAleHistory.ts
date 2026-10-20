import data from './data/ale-history.json'
import { isAleHistory } from './aleHistory'
import type { AleHistory } from './aleHistory'

if (!isAleHistory(data)) throw new Error('Published Ale-kazam history is invalid.')
export const PUBLISHED_ALE_HISTORY: AleHistory = data
