import { createContext, useContext, useReducer, ReactNode } from 'react'
import type { BundleData } from '../types/bundles'
import type { StatsData } from '../types/api'
import type { AffectedBundle } from '../types/changes'
import type { ChangelogEntry } from '../types/changelog'

type DeviceTier = 'low' | 'mid' | 'high'

interface AppState {
  bundles: Record<string, BundleData>
  iconCache: Record<string, string>
  nameCache: Record<string, string>
  changelog: ChangelogEntry[]
  liveDataDate: string
  lastChecked: string
  stats: StatsData | null
  changes: { affected_bundles?: AffectedBundle[] } | null
  loading: boolean
  loadingProgress: number
  iconsReady: boolean
  loadingStatus: string
  filters: { search: string; channel: 'all' | 'stable' | 'dev' }
  viewMode: 'grid' | 'list'
  changelogViewMode: 'grid' | 'list'
  updatesViewMode: 'timeline' | 'accordion' | 'grid'
  lastVisitScan: string
  fetchErrors: string[]
  reducedMotion: boolean
  deviceTier: DeviceTier
}

export type AppAction =
  | { type: 'SET_BUNDLES'; payload: Record<string, BundleData> }
  | { type: 'MERGE_BUNDLES'; payload: Record<string, BundleData> }
  | { type: 'SET_ICON_CACHE'; payload: Record<string, string> }
  | { type: 'SET_NAME_CACHE'; payload: Record<string, string> }
  | { type: 'SET_CHANGELOG'; payload: ChangelogEntry[] }
  | { type: 'SET_METADATA'; payload: { liveDataDate: string; lastChecked: string } }
  | { type: 'SET_STATS'; payload: StatsData | null }
  | { type: 'SET_CHANGES'; payload: { affected_bundles?: AffectedBundle[] } | null }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_LOADING_PROGRESS'; payload: number }
  | { type: 'SET_LOADING_STATUS'; payload: string }
  | { type: 'SET_ICONS_READY'; payload: boolean }
  | { type: 'SET_FILTERS'; payload: Partial<AppState['filters']> }
  | { type: 'SET_VIEW_MODE'; payload: 'grid' | 'list' }
  | { type: 'SET_CHANGELOG_VIEW_MODE'; payload: 'grid' | 'list' }
  | { type: 'SET_UPDATES_VIEW_MODE'; payload: 'timeline' | 'accordion' | 'grid' }
  | { type: 'SET_LAST_VISIT_SCAN'; payload: string }
  | { type: 'SET_FETCH_ERRORS'; payload: string[] }
  | { type: 'SET_REDUCED_MOTION'; payload: boolean }

function getStoredLastVisitScan(): string {
  try {
    return localStorage.getItem('MorpheTracker_LastVisitScan') || ''
  } catch {
    return ''
  }
}

function detectDeviceTier(): DeviceTier {
  const cores = navigator.hardwareConcurrency || 2
  if (cores <= 2) return 'low'
  if (cores >= 8) return 'high'
  return 'mid'
}

function getInitialReducedMotion(): { reducedMotion: boolean; deviceTier: DeviceTier } {
  const stored = localStorage.getItem('morphe_reduced_motion')
  if (stored !== null) {
    return { reducedMotion: stored === 'true', deviceTier: detectDeviceTier() }
  }
  const deviceTier = detectDeviceTier()
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
  let reduced: boolean
  if (deviceTier === 'low') {
    reduced = true
  } else if (deviceTier === 'high') {
    reduced = mq.matches
  } else {
    reduced = mq.matches
  }
  try { localStorage.setItem('morphe_reduced_motion', String(reduced)) } catch {}
  return { reducedMotion: reduced, deviceTier }
}

const { reducedMotion: initialReducedMotion, deviceTier: initialDeviceTier } = getInitialReducedMotion()

const initialState: AppState = {
  bundles: {},
  iconCache: {},
  nameCache: {},
  changelog: [],
  liveDataDate: '',
  lastChecked: '',
  stats: null,
  changes: null,
  loading: true,
  loadingProgress: 0,
  iconsReady: false,
  loadingStatus: 'Initializing...',
  filters: { search: '', channel: 'all' },
  viewMode: (localStorage.getItem('morphe_view') as 'grid' | 'list') || 'grid',
  changelogViewMode: (localStorage.getItem('morphe_changelog_view') as 'grid' | 'list') || 'grid',
  updatesViewMode: (localStorage.getItem('morphe_updates_view') as 'timeline' | 'accordion' | 'grid') || 'timeline',
  lastVisitScan: getStoredLastVisitScan(),
  fetchErrors: [],
  reducedMotion: initialReducedMotion,
  deviceTier: initialDeviceTier,
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_BUNDLES':
      return { ...state, bundles: action.payload }
    case 'MERGE_BUNDLES':
      return { ...state, bundles: { ...state.bundles, ...action.payload } }
    case 'SET_ICON_CACHE':
      return { ...state, iconCache: action.payload }
    case 'SET_NAME_CACHE':
      return { ...state, nameCache: action.payload }
    case 'SET_CHANGELOG':
      return { ...state, changelog: action.payload }
    case 'SET_METADATA':
      return { ...state, ...action.payload }
    case 'SET_STATS':
      return { ...state, stats: action.payload }
    case 'SET_CHANGES':
      return { ...state, changes: action.payload }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_LOADING_PROGRESS':
      return { ...state, loadingProgress: action.payload }
    case 'SET_LOADING_STATUS':
      return { ...state, loadingStatus: action.payload }
    case 'SET_ICONS_READY':
      return { ...state, iconsReady: action.payload }
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } }
    case 'SET_VIEW_MODE':
      localStorage.setItem('morphe_view', action.payload)
      return { ...state, viewMode: action.payload }
    case 'SET_CHANGELOG_VIEW_MODE':
      localStorage.setItem('morphe_changelog_view', action.payload)
      return { ...state, changelogViewMode: action.payload }
    case 'SET_UPDATES_VIEW_MODE':
      localStorage.setItem('morphe_updates_view', action.payload)
      return { ...state, updatesViewMode: action.payload }
    case 'SET_LAST_VISIT_SCAN':
      try { localStorage.setItem('MorpheTracker_LastVisitScan', action.payload) } catch {}
      return { ...state, lastVisitScan: action.payload }
    case 'SET_FETCH_ERRORS':
      return { ...state, fetchErrors: action.payload }
    case 'SET_REDUCED_MOTION':
      try { localStorage.setItem('morphe_reduced_motion', String(action.payload)) } catch {}
      return { ...state, reducedMotion: action.payload }
    default:
      return state
  }
}

const AppContext = createContext<{ state: AppState; dispatch: React.Dispatch<AppAction> } | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState)
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>
}

export function useAppContext() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppContext must be used within AppProvider')
  return ctx
}
