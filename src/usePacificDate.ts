import { useEffect, useState } from 'react'

const currentDate = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })

export function usePacificDate(): string {
  const [today, setToday] = useState(currentDate)
  useEffect(() => {
    const update = () => setToday(currentDate())
    const timer = setInterval(update, 60000)
    document.addEventListener('visibilitychange', update)
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', update) }
  }, [])
  return today
}
