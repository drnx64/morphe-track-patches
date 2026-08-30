import { useAppContext } from '../../context/AppContext'
import { INFO_ICON } from '../../utils/svg'

export function FetchErrorBanner() {
  const { state } = useAppContext()
  const errors = state.fetchErrors

  if (!errors || errors.length === 0) return null

  return (
    <div className="fetch-error-banner">
      <span className="fetch-error-banner-icon" dangerouslySetInnerHTML={{ __html: INFO_ICON }} />
      <span>
        Some data failed to load ({errors.length} error{errors.length !== 1 ? 's' : ''}).
        Some features may be unavailable.
      </span>
    </div>
  )
}
