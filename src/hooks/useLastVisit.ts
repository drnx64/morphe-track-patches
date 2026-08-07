import { useEffect, useRef } from 'react'
import { getLastVisitDate, markVisitNow, isNewSinceLastVisit } from '../utils/lastVisit'

/**
 * Records the current visit on mount and returns whether a given ISO date
 * (as produced by the changelog) is "new" since the previous visit.
 */
export function useLastVisit() {
  const lastVisitRef = useRef<string | null>(null)

  if (lastVisitRef.current === null) {
    lastVisitRef.current = getLastVisitDate()
  }

  useEffect(() => {
    markVisitNow()
  }, [])

  return { isNew: isNewSinceLastVisit, lastVisit: lastVisitRef.current }
}