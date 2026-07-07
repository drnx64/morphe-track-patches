import { useAppContext } from '../../context/AppContext'

export default function ControlsSection() {
  const { state, dispatch } = useAppContext()

  return (
    <section className="controls-section" aria-labelledby="controls-heading">
      <h2 className="sr-only" id="controls-heading">Filter and View Options</h2>
      <div className="filters-row">
        <div className="search-row">
          <div className="view-toggle-group" id="view-toggle-group">
            <button
              className={`view-toggle-opt${state.viewMode === 'grid' ? ' active' : ''}`}
              data-view="grid"
              title="Grid view"
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'grid' })}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M1 2.5A1.5 1.5 0 0 1 2.5 1h2A1.5 1.5 0 0 1 6 2.5v2A1.5 1.5 0 0 1 4.5 6h-2A1.5 1.5 0 0 1 1 4.5v-2zm5 0A1.5 1.5 0 0 1 7.5 1h2A1.5 1.5 0 0 1 11 2.5v2A1.5 1.5 0 0 1 9.5 6h-2A1.5 1.5 0 0 1 6 4.5v-2zm5 0A1.5 1.5 0 0 1 12.5 1h2A1.5 1.5 0 0 1 16 2.5v2A1.5 1.5 0 0 1 14.5 6h-2A1.5 1.5 0 0 1 11 4.5v-2zM1 7.5A1.5 1.5 0 0 1 2.5 6h2A1.5 1.5 0 0 1 6 7.5v2A1.5 1.5 0 0 1 4.5 11h-2A1.5 1.5 0 0 1 1 9.5v-2zm5 0A1.5 1.5 0 0 1 7.5 6h2A1.5 1.5 0 0 1 11 7.5v2A1.5 1.5 0 0 1 9.5 11h-2A1.5 1.5 0 0 1 6 9.5v-2zm5 0A1.5 1.5 0 0 1 12.5 6h2A1.5 1.5 0 0 1 16 7.5v2A1.5 1.5 0 0 1 14.5 11h-2A1.5 1.5 0 0 1 11 9.5v-2zM1 12.5A1.5 1.5 0 0 1 2.5 11h2A1.5 1.5 0 0 1 6 12.5v2A1.5 1.5 0 0 1 4.5 16h-2A1.5 1.5 0 0 1 1 14.5v-2zm5 0A1.5 1.5 0 0 1 7.5 11h2A1.5 1.5 0 0 1 11 12.5v2A1.5 1.5 0 0 1 9.5 16h-2A1.5 1.5 0 0 1 6 14.5v-2zm5 0a1.5 1.5 0 0 1 1.5-1.5h2a1.5 1.5 0 0 1 1.5 1.5v2a1.5 1.5 0 0 1-1.5 1.5h-2a1.5 1.5 0 0 1-1.5-1.5v-2z" />
              </svg>
              <span>Grid</span>
            </button>
            <button
              className={`view-toggle-opt${state.viewMode === 'list' ? ' active' : ''}`}
              data-view="list"
              title="Compact view"
              onClick={() => dispatch({ type: 'SET_VIEW_MODE', payload: 'list' })}
            >
              <svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor">
                <path d="M2.5 12a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5zm0-4a.5.5 0 0 1 .5-.5h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5z" />
              </svg>
              <span>Compact</span>
            </button>
          </div>
        </div>
        <div className="filter-group">
          <span className="filter-label">Channel:</span>
          {(['all', 'stable', 'dev'] as const).map((ch) => (
            <button
              key={ch}
              className={`filter-btn${state.filters.channel === ch ? ' active' : ''}`}
              data-channel={ch}
              onClick={() => dispatch({ type: 'SET_FILTERS', payload: { channel: ch } })}
            >
              {ch === 'all' ? 'All' : ch.charAt(0).toUpperCase() + ch.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
