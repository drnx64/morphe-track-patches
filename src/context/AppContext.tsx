import { createContext, useContext, useReducer, ReactNode } from 'react'
import type { BundleData } from '../types/bundles'

interface AppState {
  bundles: Record<string, BundleData>
  iconCache: Record<string, string>
  nameCache: Record<string, string>
  iconImageCache: Record<string, string>
  liveDataDate: string
  lastChecked: string
  loading: boolean
  filters: { search: string; channel: 'all' | 'stable' | 'dev' }
  viewMode: 'grid' | 'list'
  changelogViewMode: 'grid' | 'list'
}

type AppAction =
  | { type: 'SET_BUNDLES'; payload: Record<string, BundleData> }
  | { type: 'SET_ICON_CACHE'; payload: Record<string, string> }
  | { type: 'SET_NAME_CACHE'; payload: Record<string, string> }
  | { type: 'SET_ICON_IMAGE_CACHE'; payload: Record<string, string> }
  | { type: 'SET_METADATA'; payload: { liveDataDate: string; lastChecked: string } }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_FILTERS'; payload: Partial<AppState['filters']> }
  | { type: 'SET_VIEW_MODE'; payload: 'grid' | 'list' }
  | { type: 'SET_CHANGELOG_VIEW_MODE'; payload: 'grid' | 'list' }

const initialState: AppState = {
  bundles: {},
  iconCache: {},
  nameCache: {},
  iconImageCache: {},
  liveDataDate: '',
  lastChecked: '',
  loading: true,
  filters: { search: '', channel: 'all' },
  viewMode: (localStorage.getItem('morphe_view') as 'grid' | 'list') || 'grid',
  changelogViewMode: (localStorage.getItem('morphe_changelog_view') as 'grid' | 'list') || 'grid',
}

function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_BUNDLES':
      return { ...state, bundles: action.payload }
    case 'SET_ICON_CACHE':
      return { ...state, iconCache: action.payload }
    case 'SET_NAME_CACHE':
      return { ...state, nameCache: action.payload }
    case 'SET_ICON_IMAGE_CACHE':
      return { ...state, iconImageCache: action.payload }
    case 'SET_METADATA':
      return { ...state, ...action.payload }
    case 'SET_LOADING':
      return { ...state, loading: action.payload }
    case 'SET_FILTERS':
      return { ...state, filters: { ...state.filters, ...action.payload } }
    case 'SET_VIEW_MODE':
      localStorage.setItem('morphe_view', action.payload)
      return { ...state, viewMode: action.payload }
    case 'SET_CHANGELOG_VIEW_MODE':
      localStorage.setItem('morphe_changelog_view', action.payload)
      return { ...state, changelogViewMode: action.payload }
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
