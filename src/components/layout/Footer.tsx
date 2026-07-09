export default function Footer() {
  return (
    <footer className="app-footer">
      <div className="footer-links">
        <a href="https://github.com/drnx64/morphe-track-patches" target="_blank" rel="noopener" className="footer-link">
          <svg viewBox="0 0 16 16" width="16" height="16" fill="currentColor">
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
          </svg>
        </a>
        <span className="footer-sep">&middot;</span>
        <span className="footer-text">
          By{' '}
          <a href="https://github.com/drnx64" target="_blank" rel="noopener" className="footer-link">
            drnx64
          </a>
        </span>
        <span className="footer-sep">&middot;</span>
        <a href="https://morphe.software" target="_blank" rel="noopener" className="footer-link">
          Powered by Morphe
        </a>
        <span className="footer-sep">&middot;</span>
        <a href="feed.xml" target="_blank" rel="noopener" className="footer-link">
          RSS Feed
        </a>
      </div>
      <p className="footer-disclaimer">
        Not affiliated with Morphe or ReVanced. Data is automatically collected from public sources.
      </p>
      <p className="footer-disclaimer">
        This site uses <a href="https://umami.is" target="_blank" rel="noopener">Umami</a> for privacy-focused analytics &mdash; no personal data is collected.
      </p>
      <p className="footer-disclaimer footer-disclaimer--warning">
        <svg className="warning-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
          <path d="M12 2L1 21h22L12 2zm0 4l7.53 13H4.47L12 6zm0 2.5a1 1 0 0 1 1 1v4a1 1 0 0 1-2 0v-4a1 1 0 0 1 1-1zm0 7a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z"/>
        </svg>
        <span><strong>Disclaimer:</strong> Only add patch bundles or sources you trust. This site is not liable for any damages or issues arising from the use of third-party patches. Data is aggregated from public sources and provided for informational purposes only.</span>
      </p>
    </footer>
  )
}
