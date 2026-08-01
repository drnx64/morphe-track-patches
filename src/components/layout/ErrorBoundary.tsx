import { Component, ErrorInfo, ReactNode, createRef } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
  copied: boolean
  copyFailed: boolean
}

export default class ErrorBoundary extends Component<Props, State> {
  private copyTextarea = createRef<HTMLTextAreaElement>()

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null, copied: false, copyFailed: false }
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

  private buildErrorText(): string {
    const { error, errorInfo } = this.state
    return [
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
    ].join('\n')
  }

  private handleCopy = async () => {
    const text = this.buildErrorText()

    let ok = false
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text)
        ok = true
      }
    } catch {
      /* fall through to legacy path */
    }
    if (!ok) {
      ok = this.legacyCopy(text)
    }

    if (ok) {
      this.setState({ copied: true, copyFailed: false })
      setTimeout(() => this.setState({ copied: false }), 2000)
    } else {
      this.setState({ copyFailed: true })
      setTimeout(() => {
        const ta = this.copyTextarea.current
        if (ta) {
          ta.focus()
          ta.select()
        }
      }, 50)
    }
  }

  private legacyCopy(text: string): boolean {
    try {
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.setAttribute('readonly', '')
      textarea.style.position = 'fixed'
      textarea.style.top = '0'
      textarea.style.left = '0'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.focus()
      textarea.select()
      let ok = false
      try {
        ok = document.execCommand('copy')
      } catch {
        ok = false
      }
      document.body.removeChild(textarea)
      return ok
    } catch {
      return false
    }
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null, copied: false, copyFailed: false })
  }

  render() {
    if (!this.state.hasError) return this.props.children

    const { error, errorInfo, copied, copyFailed } = this.state

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

            {copyFailed && (
              <div className="error-page-section">
                <span className="error-page-label">
                  Automatic copy failed — the text is selected below, press Ctrl/Cmd + C
                </span>
                <textarea
                  ref={this.copyTextarea}
                  className="error-page-copy-area"
                  readOnly
                  value={this.buildErrorText()}
                  onFocus={(e) => e.currentTarget.select()}
                />
              </div>
            )}
          </div>

          <div className="error-page-actions">
            <button className="error-page-btn error-page-btn-primary" onClick={this.handleRetry}>
              Retry
            </button>
            <button
              className={`error-page-btn error-page-btn-copy${copied ? ' error-page-btn-copied' : ''}`}
              onClick={this.handleCopy}
            >
              {copied ? 'Copied!' : copyFailed ? 'Try Again' : 'Copy Error Details'}
            </button>
          </div>
        </div>
      </div>
    )
  }
}
