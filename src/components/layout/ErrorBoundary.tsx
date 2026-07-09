import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    this.setState({ errorInfo })
    console.error('[MorpheTracker] Uncaught error:', error, errorInfo)
    const loadingEl = document.getElementById('loading-screen')
    if (loadingEl) loadingEl.style.display = 'none'
  }

  private handleCopy = async () => {
    const { error, errorInfo } = this.state
    const lines = [
      `Error: ${error?.name || 'Unknown'}`,
      `Message: ${error?.message || 'No message'}`,
      `Stack: ${error?.stack || 'No stack trace'}`,
      ``,
      `Component Stack:`,
      errorInfo?.componentStack || 'No component stack',
      ``,
      `Tech Stack:`,
      `- React 18.3.1`,
      `- TypeScript 5.5.4`,
      `- Vite 5.4.2`,
      `- React Router DOM 6.26.0`,
      `- CSS custom properties (dark theme)`,
      `- IndexedDB (MorpheTrackerCache)`,
      `- Service Worker`,
      `- Python 3 (backend pipeline)`,
      ``,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      ``,
      `--- How to fix ---`,
      `Paste the above error details in your chat with opencode to get help fixing this issue.`,
    ]
    try {
      await navigator.clipboard.writeText(lines.join('\n'))
    } catch {
      console.warn('[MorpheTracker] Clipboard write failed')
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { error, errorInfo } = this.state

    return (
      <div className="error-page-overlay">
        <div className="error-page-box">
          <div className="error-page-icon">!</div>
          <h1 className="error-page-title">Something went wrong</h1>
          <p className="error-page-subtitle">
            An unexpected error occurred. Copy the error details and send them to opencode to get help fixing this.
          </p>

          <div className="error-page-details">
            <div className="error-page-section">
              <span className="error-page-label">Error</span>
              <code className="error-page-value">{error?.name || 'Unknown'}</code>
            </div>
            <div className="error-page-section">
              <span className="error-page-label">Message</span>
              <code className="error-page-value error-page-message">{error?.message || 'No message'}</code>
            </div>
            {error?.stack && (
              <div className="error-page-section">
                <span className="error-page-label">Stack Trace</span>
                <pre className="error-page-pre">{error.stack}</pre>
              </div>
            )}
            {errorInfo?.componentStack && (
              <div className="error-page-section">
                <span className="error-page-label">Component Stack</span>
                <pre className="error-page-pre">{errorInfo.componentStack}</pre>
              </div>
            )}
            <div className="error-page-section">
              <span className="error-page-label">Tech Stack</span>
              <ul className="error-page-tech-list">
                <li>React 18.3.1 + TypeScript 5.5.4</li>
                <li>Vite 5.4.2 + React Router DOM 6.26.0</li>
                <li>CSS custom properties (dark theme)</li>
                <li>IndexedDB (MorpheTrackerCache cache)</li>
                <li>Service Worker + Umami Analytics</li>
                <li>Python 3 (backend crawl &amp; diff pipeline)</li>
              </ul>
            </div>
          </div>

          <div className="error-page-actions">
            <button className="error-page-btn error-page-btn-primary" onClick={this.handleRetry}>
              Retry
            </button>
            <button className="error-page-btn error-page-btn-copy" onClick={this.handleCopy}>
              Copy Error Details
            </button>
          </div>
        </div>
      </div>
    )
  }
}