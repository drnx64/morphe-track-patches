import { useAppContext } from '../../../context/AppContext'
import { TIMELINE_ICON, LIST_ICON, GRID_ICON } from '../../../utils/svg'

type ViewMode = 'timeline' | 'accordion' | 'grid'

const VIEWS: { mode: ViewMode; label: string; icon: string }[] = [
  { mode: 'timeline', label: 'Timeline', icon: TIMELINE_ICON },
  { mode: 'accordion', label: 'Accordion', icon: LIST_ICON },
  { mode: 'grid', label: 'Grid', icon: GRID_ICON },
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
          <span className="view-toggle-icon" dangerouslySetInnerHTML={{ __html: v.icon }} />
          <span className="view-toggle-label">{v.label}</span>
        </button>
      ))}
    </div>
  )
}
