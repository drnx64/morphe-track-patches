import { useState, useEffect, useCallback, createContext, useContext } from 'react'

export type AnnouncementPriority = 'info' | 'warning' | 'urgent'

export interface Announcement {
  id: string
  title: string
  body: string
  date: string
  priority: AnnouncementPriority
  url?: string
  autoDismiss?: boolean
}

interface AnnouncementsState {
  all: Announcement[]
  unread: Announcement[]
  read: Announcement[]
  unreadCount: number
  dismiss: (id: string) => void
  dismissAll: () => void
  loaded: boolean
}

const DISMISS_KEY = 'MorpheTracker_AnnouncementDismissed'

function isExpired(dateStr: string): boolean {
  if (!dateStr) return true
  try {
    const d = new Date(dateStr + 'T00:00:00Z')
    return (Date.now() - d.getTime()) > 86400000
  } catch {
    return true
  }
}

async function hashContent(title: string, body: string): Promise<string> {
  const data = `${title}\n${body}`
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    const encoded = new TextEncoder().encode(data)
    const hashBuffer = await crypto.subtle.digest('SHA-256', encoded)
    const hashArray = Array.from(new Uint8Array(hashBuffer))
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16)
  }
  let hash = 0
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return 'h_' + Math.abs(hash).toString(36)
}

function loadDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

function saveDismissed(ids: string[]) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(ids))
  } catch {}
}

function cleanupExpired(dismissed: string[], validIds: Set<string>): string[] {
  return dismissed.filter((id) => validIds.has(id))
}

const AnnouncementsContext = createContext<AnnouncementsState | null>(null)

export function useAnnouncements() {
  return useContext(AnnouncementsContext)
}

export function AnnouncementsProvider({ children }: { children: React.ReactNode }) {
  const [all, setAll] = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<string[]>(() => loadDismissed())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/msg.txt')
      .then((r) => (r.ok ? r.text() : '[]'))
      .then(async (text) => {
        try {
          const data = JSON.parse(text)
          const rawArr: Array<{ title: string; body: string; date: string; priority?: AnnouncementPriority; url?: string; autoDismiss?: boolean }> = Array.isArray(data) ? data : data ? [data] : []
          const arr: Announcement[] = await Promise.all(
            rawArr.map(async (raw) => ({
              id: await hashContent(raw.title, raw.body),
              title: raw.title,
              body: raw.body,
              date: raw.date,
              priority: raw.priority || 'info',
              url: raw.url,
              autoDismiss: raw.autoDismiss,
            }))
          )
          setAll(arr)
          setDismissed((prev) => {
            const validIds = new Set(arr.filter((a) => !isExpired(a.date)).map((a) => a.id))
            const cleaned = cleanupExpired(prev, validIds)
            saveDismissed(cleaned)
            return cleaned
          })
        } catch {
          setAll([])
        }
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  const active = all.filter((a) => !isExpired(a.date))
  const unread = active.filter((a) => !dismissed.includes(a.id))
  const read = active.filter((a) => dismissed.includes(a.id))
  const unreadCount = unread.length

  const dismiss = useCallback((id: string) => {
    setDismissed((prev) => {
      if (prev.includes(id)) return prev
      const next = [...prev, id]
      saveDismissed(next)
      return next
    })
  }, [])

  const dismissAll = useCallback(() => {
    setDismissed((prev) => {
      const allIds = active.map((a) => a.id)
      const next = [...new Set([...prev, ...allIds])]
      saveDismissed(next)
      return next
    })
  }, [active])

  return (
    <AnnouncementsContext.Provider value={{ all: active, unread, read, unreadCount, dismiss, dismissAll, loaded }}>
      {children}
    </AnnouncementsContext.Provider>
  )
}
