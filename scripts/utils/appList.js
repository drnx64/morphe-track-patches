/**
 * Shared batched app-row list rendering with delegated events.
 * Renders in rAF batches (~30 rows/frame) instead of one long synchronous
 * build, and attaches a single pair of listeners per list instead of two
 * listeners per row.
 */
import { el } from '../ui.js'
import { escHtml } from './html.js'
import { resolveAppName, renderAppIcon } from './misc.js'

const BATCH_SIZE = 30

function buildRow(app, idx, prefix, nameCache, iconCache) {
  const appName = resolveAppName(app, nameCache)
  const iconHtml = renderAppIcon(app, iconCache, 'sm')
  const patchCount = (app.patches || []).length
  const row = el('div', { class: `${prefix}-row`, role: 'button', tabindex: '0', dataset: { idx } })
  row.innerHTML = `
    ${iconHtml}
    <div class="${prefix}-info">
      <span class="${prefix}-name">${escHtml(appName)}</span>
      <span class="${prefix}-pkg">${escHtml(app.package)}</span>
    </div>
    <span class="${prefix}-patches">${patchCount} patch${patchCount !== 1 ? 'es' : ''}</span>
  `
  return row
}

/**
 * Mount app rows into listEl in rAF batches; delegated listeners attached once.
 * @param {HTMLElement} listEl
 * @param {Array} apps
 * @param {Object} opts
 * @param {string} opts.prefix - row class prefix ('bundle-modal-app' | 'bundle-card-app')
 * @param {(app: Object) => void} opts.onOpen
 * @param {Object} opts.nameCache
 * @param {Object} opts.iconCache
 * @param {() => void} [opts.onBatch] - called after each batch (e.g. to sync max-height)
 */
export function mountAppRows(listEl, apps, { prefix, onOpen, nameCache, iconCache, onBatch }) {
  if (listEl.dataset.mounted) return
  listEl.dataset.mounted = '1'
  listEl.__apps = apps

  const resolveRow = (target) => {
    const row = target.closest?.(`.${prefix}-row`)
    return row && listEl.contains(row) ? listEl.__apps[Number(row.dataset.idx)] : null
  }

  listEl.addEventListener('click', (e) => {
    const app = resolveRow(e.target)
    if (app) onOpen(app)
  })
  listEl.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return
    const app = resolveRow(e.target)
    if (app) {
      e.preventDefault()
      onOpen(app)
    }
  })

  let idx = 0
  const step = () => {
    const end = Math.min(idx + BATCH_SIZE, apps.length)
    const frag = document.createDocumentFragment()
    for (; idx < end; idx++) {
      frag.appendChild(buildRow(apps[idx], idx, prefix, nameCache, iconCache))
    }
    listEl.appendChild(frag)
    if (onBatch) onBatch()
    if (idx < apps.length) requestAnimationFrame(step)
  }
  requestAnimationFrame(step)
}

/**
 * Precompute display names once, then sort — avoids resolveAppName
 * calls inside the comparator.
 * @param {Array} apps
 * @param {Object} nameCache
 * @returns {Array} sorted copy
 */
export function sortAppsByName(apps, nameCache) {
  return apps
    .map((app) => ({ app, name: resolveAppName(app, nameCache) }))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((x) => x.app)
}
