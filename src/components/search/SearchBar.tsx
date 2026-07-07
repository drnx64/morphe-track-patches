import { useRef, useCallback } from 'react'
import { useAppContext } from '../../context/AppContext'
import { SEARCH_ICON, CLEAR_ICON } from '../../utils/svg'

export default function SearchBar() {
  const { state, dispatch } = useAppContext()
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    if (debounceRef.current) clearTimeout(debounceRef.current)
    dispatch({ type: 'SET_FILTERS', payload: { search: val.toLowerCase().trim() } })
    debounceRef.current = setTimeout(() => {
      document.dispatchEvent(new CustomEvent('search-dropdown-update', { detail: val }))
    }, 120)
  }, [dispatch])

  const handleClear = useCallback(() => {
    dispatch({ type: 'SET_FILTERS', payload: { search: '' } })
    if (inputRef.current) {
      inputRef.current.value = ''
      inputRef.current.focus()
    }
    document.dispatchEvent(new CustomEvent('search-dropdown-close'))
  }, [dispatch])

  return (
    <div className="search-bar">
      <span className="search-bar-icon" dangerouslySetInnerHTML={{ __html: SEARCH_ICON }} />
      <input
        ref={inputRef}
        type="text"
        id="search-input"
        placeholder="Search by app name, package name, or bundle..."
        aria-label="Search patches"
        autoComplete="off"
        defaultValue={state.filters.search}
        onInput={handleInput}
      />
      <button
        className={`search-bar-clear${state.filters.search ? ' visible' : ''}`}
        id="search-clear-btn"
        aria-label="Clear search"
        tabIndex={-1}
        onClick={handleClear}
        dangerouslySetInnerHTML={{ __html: CLEAR_ICON }}
      />
    </div>
  )
}
