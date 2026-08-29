import { useAppContext } from '../../../context/AppContext'

type ViewMode = 'timeline' | 'accordion' | 'grid'

const VIEWS: { mode: ViewMode; label: string; icon: string }[] = [
  { mode: 'timeline', label: 'Timeline', icon: '│' },
  { mode: 'accordion', label: 'Accordion', icon: '▸' },
  { mode: 'grid', label: 'Grid', icon: '⊞' },
]

export default function ViewToggle() {
  const { state, dispatch } = useAppContext()

  return (
    <div className="updates-view-toggle">
      {VIEWS.map((v) => (
        <button
          key={v.mode}
          type="button"
          className={`view-toggle-btn${state.updatesViewMode === v.mode ? ' active' : ''}`}
          onClick={() => dispatch({ type: 'SET_UPDATES_VIEW_MODE', payload: v.mode })}
          title={v.label}
        >
          <span className="view-toggle-icon">{v.icon}</span>
          <span className="view-toggle-label">{v.label}</span>
        </button>
      ))}
    </div>
  )
}
