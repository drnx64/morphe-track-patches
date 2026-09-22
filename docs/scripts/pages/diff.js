/**
 * Diff page — cross-bundle comparison with searchable dropdowns and patch-level diff.
 */
import { el, mount } from '../ui.js'
import * as store from '../store.js'
import { resolveAppName, renderAppIcon, scoreAppSearch } from '../utils/misc.js'
import { escHtml } from '../utils/html.js'

export function renderDiff(container) {
  const page = el('div', { class: 'diff-page' })
  page.appendChild(el('h2', { class: 'section-title' }, ['Bundle Diff']))

  const bundles = store.get('bundles') || {}
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}

  const bundleNames = [...new Set(Object.keys(bundles).map((k) => k.replace(/:(stable|dev)$/, '')))]

  const selector = el('div', { class: 'diff-selector' })
  selector.innerHTML = '<label class="diff-label">Select two bundles to compare:</label>'

  const select1 = createSearchableSelect(bundleNames, 'First bundle...')
  const select2 = createSearchableSelect(bundleNames, 'Second bundle...')
  if (bundleNames.length > 1) select2.selectValue = bundleNames[1]

  const compareBtn = el('button', { class: 'btn btn--primary' }, ['Compare'])
  selector.appendChild(select1.element)
  selector.appendChild(select2.element)
  selector.appendChild(compareBtn)

  const resultArea = el('div', { class: 'diff-result' })

  page.appendChild(selector)
  page.appendChild(resultArea)
  mount(container, page)

  compareBtn.addEventListener('click', () => {
    const name1 = select1.selectValue
    const name2 = select2.selectValue
    if (!name1 || !name2) {
      resultArea.replaceChildren(el('div', { class: 'loading-state' }, ['Please select two bundles.']))
      return
    }
    if (name1 === name2) {
      resultArea.replaceChildren(el('div', { class: 'loading-state' }, ['Please select two different bundles.']))
      return
    }

    const apps1 = new Map()
    const apps2 = new Map()
    for (const [key, bundle] of Object.entries(bundles)) {
      const bundleName = key.replace(/:(stable|dev)$/, '')
      if (bundleName === name1) {
        for (const app of bundle.apps || []) {
          if (!apps1.has(app.package)) apps1.set(app.package, app)
        }
      }
      if (bundleName === name2) {
        for (const app of bundle.apps || []) {
          if (!apps2.has(app.package)) apps2.set(app.package, app)
        }
      }
    }

    const only1 = [...apps1.keys()].filter((p) => !apps2.has(p))
    const only2 = [...apps2.keys()].filter((p) => !apps1.has(p))
    const both = [...apps1.keys()].filter((p) => apps2.has(p))

    resultArea.replaceChildren()

    const headerEl = el('div', { class: 'diff-header' })
    headerEl.innerHTML = `
      <h3 class="diff-title">${escHtml(name1)} vs ${escHtml(name2)}</h3>
      <div class="diff-summary-bar">
        <span class="diff-stat diff-stat--shared">${both.length} shared</span>
        <span class="diff-stat diff-stat--only1">${only1.length} only in ${escHtml(name1)}</span>
        <span class="diff-stat diff-stat--only2">${only2.length} only in ${escHtml(name2)}</span>
      </div>
    `
    resultArea.appendChild(headerEl)

    if (only1.length > 0) {
      const section = el('div', { class: 'diff-section' })
      section.appendChild(el('h4', { class: 'diff-section-title' }, [`Only in ${escHtml(name1)}`]))
      const list = el('div', { class: 'diff-apps-list' })
      for (const pkg of only1) {
        const app = apps1.get(pkg)
        const appName = resolveAppName(app, nameCache)
        const iconHtml = renderAppIcon(app, iconCache, 'sm')
        const row = el('div', { class: 'diff-app-row' })
        row.innerHTML = `${iconHtml} <span class="diff-app-name">${escHtml(appName)}</span> <span class="diff-app-pkg">${escHtml(pkg)}</span>`
        list.appendChild(row)
      }
      section.appendChild(list)
      resultArea.appendChild(section)
    }

    if (only2.length > 0) {
      const section = el('div', { class: 'diff-section' })
      section.appendChild(el('h4', { class: 'diff-section-title' }, [`Only in ${escHtml(name2)}`]))
      const list = el('div', { class: 'diff-apps-list' })
      for (const pkg of only2) {
        const app = apps2.get(pkg)
        const appName = resolveAppName(app, nameCache)
        const iconHtml = renderAppIcon(app, iconCache, 'sm')
        const row = el('div', { class: 'diff-app-row' })
        row.innerHTML = `${iconHtml} <span class="diff-app-name">${escHtml(appName)}</span> <span class="diff-app-pkg">${escHtml(pkg)}</span>`
        list.appendChild(row)
      }
      section.appendChild(list)
      resultArea.appendChild(section)
    }

    if (both.length > 0) {
      const sharedSection = el('div', { class: 'diff-section' })
      sharedSection.appendChild(el('h4', { class: 'diff-section-title' }, ['Shared apps — patch differences']))

      const patchDiffs = []
      for (const pkg of both) {
        const app1 = apps1.get(pkg)
        const app2 = apps2.get(pkg)
        const patches1 = new Set((app1.patches || []).map((p) => p.name))
        const patches2 = new Set((app2.patches || []).map((p) => p.name))
        const onlyP1 = [...patches1].filter((p) => !patches2.has(p))
        const onlyP2 = [...patches2].filter((p) => !patches1.has(p))
        if (onlyP1.length > 0 || onlyP2.length > 0) {
          patchDiffs.push({ package: pkg, app: app1, onlyIn1: onlyP1, onlyIn2: onlyP2 })
        }
      }

      if (patchDiffs.length > 0) {
        for (const diff of patchDiffs) {
          const appName = resolveAppName(diff.app, nameCache)
          const iconHtml = renderAppIcon(diff.app, iconCache, 'sm')
          const card = el('div', { class: 'diff-patch-card' })
          card.innerHTML = `
            <div class="diff-patch-card-header">
              ${iconHtml}
              <span class="diff-patch-app-name">${escHtml(appName)}</span>
            </div>
          `
          if (diff.onlyIn1.length > 0) {
            const list = el('div', { class: 'diff-patch-list diff-patch-list--only1' })
            list.innerHTML = `<span class="diff-patch-list-label">Only in ${escHtml(name1)}:</span>`
            for (const p of diff.onlyIn1) {
              list.appendChild(el('span', { class: 'diff-patch-item diff-patch-item--only1' }, [p]))
            }
            card.appendChild(list)
          }
          if (diff.onlyIn2.length > 0) {
            const list = el('div', { class: 'diff-patch-list diff-patch-list--only2' })
            list.innerHTML = `<span class="diff-patch-list-label">Only in ${escHtml(name2)}:</span>`
            for (const p of diff.onlyIn2) {
              list.appendChild(el('span', { class: 'diff-patch-item diff-patch-item--only2' }, [p]))
            }
            card.appendChild(list)
          }
          sharedSection.appendChild(card)
        }
      } else {
        sharedSection.appendChild(el('div', { class: 'diff-empty' }, ['All shared apps have identical patches.']))
      }
      resultArea.appendChild(sharedSection)
    }
  })
}

function createSearchableSelect(options, placeholder) {
  let _selectValue = ''
  const wrapper = el('div', { class: 'diff-searchable-select' })
  const input = el('input', {
    type: 'text', class: 'diff-search-input', placeholder, 'aria-label': placeholder,
  })
  const dropdown = el('div', { class: 'diff-dropdown' })
  wrapper.appendChild(input)
  wrapper.appendChild(dropdown)

  let isOpen = false

  function renderOptions(filter = '') {
    dropdown.replaceChildren()
    const q = filter.toLowerCase()
    const filtered = options.filter((o) => o.toLowerCase().includes(q))
    for (const opt of filtered) {
      const item = el('div', { class: 'diff-dropdown-item', role: 'option' }, [opt])
      item.addEventListener('click', () => {
        _selectValue = opt
        input.value = opt
        isOpen = false
        dropdown.classList.remove('open')
      })
      dropdown.appendChild(item)
    }
    if (filtered.length === 0) {
      dropdown.appendChild(el('div', { class: 'diff-dropdown-empty' }, ['No matches']))
    }
  }

  input.addEventListener('focus', () => {
    isOpen = true
    dropdown.classList.add('open')
    renderOptions(input.value)
  })

  input.addEventListener('input', () => {
    if (isOpen) renderOptions(input.value)
  })

  input.addEventListener('blur', () => {
    setTimeout(() => { isOpen = false; dropdown.classList.remove('open') }, 150)
  })

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.blur()
      isOpen = false
      dropdown.classList.remove('open')
    }
  })

  return {
    element: wrapper,
    get selectValue() { return _selectValue },
    set selectValue(v) { _selectValue = v; input.value = v },
  }
}
