/**
 * Diff page — cross-bundle app comparison.
 */
import { el, mount } from '../ui.js'
import * as store from '../store.js'
import { resolveAppName, buildAppIndex } from '../utils/misc.js'
import { escHtml } from '../utils/html.js'

export function renderDiff(container) {
  const page = el('div', { class: 'diff-page' })
  page.appendChild(el('h2', { class: 'section-title' }, ['Bundle Diff']))

  const bundles = store.get('bundles') || {}
  const nameCache = store.get('nameCache') || {}
  const iconCache = store.get('iconCache') || {}

  // Get unique bundle names
  const bundleNames = [...new Set(Object.keys(bundles).map((k) => k.replace(/:(stable|dev)$/, '')))]

  const selector = el('div', { class: 'diff-selector' }, [
    el('label', {}, ['Select two bundles to compare:']),
  ])

  const select1 = el('select', { class: 'diff-select', id: 'diff-select-1' })
  const select2 = el('select', { class: 'diff-select', id: 'diff-select-2' })
  for (const name of bundleNames) {
    select1.appendChild(el('option', { value: name }, [name]))
    select2.appendChild(el('option', { value: name }, [name]))
  }
  if (bundleNames.length > 1) select2.selectedIndex = 1

  const compareBtn = el('button', { class: 'btn btn--primary' }, ['Compare'])
  selector.appendChild(select1)
  selector.appendChild(select2)
  selector.appendChild(compareBtn)

  const resultArea = el('div', { class: 'diff-result' })

  page.appendChild(selector)
  page.appendChild(resultArea)
  mount(container, page)

  compareBtn.addEventListener('click', () => {
    const name1 = select1.value
    const name2 = select2.value
    if (name1 === name2) {
      resultArea.replaceChildren(el('div', { class: 'loading-state' }, ['Please select two different bundles.']))
      return
    }

    // Collect apps from both bundles
    const apps1 = new Set()
    const apps2 = new Set()
    for (const [key, bundle] of Object.entries(bundles)) {
      const bundleName = key.replace(/:(stable|dev)$/, '')
      if (bundleName === name1) {
        for (const app of bundle.apps || []) apps1.add(app.package)
      }
      if (bundleName === name2) {
        for (const app of bundle.apps || []) apps2.add(app.package)
      }
    }

    const only1 = [...apps1].filter((p) => !apps2.has(p))
    const only2 = [...apps2].filter((p) => !apps1.has(p))
    const both = [...apps1].filter((p) => apps2.has(p))

    resultArea.replaceChildren()
    resultArea.appendChild(el('h3', {}, [`${name1} vs ${name2}`]))
    resultArea.appendChild(el('p', { class: 'diff-summary' }, [
      `${both.length} shared, ${only1.length} only in ${name1}, ${only2.length} only in ${name2}`,
    ]))

    if (only1.length > 0) {
      const section = el('div', { class: 'diff-section' }, [
        el('h4', {}, [`Only in ${name1}`]),
      ])
      for (const pkg of only1) {
        section.appendChild(el('div', { class: 'diff-app' }, [pkg]))
      }
      resultArea.appendChild(section)
    }

    if (only2.length > 0) {
      const section = el('div', { class: 'diff-section' }, [
        el('h4', {}, [`Only in ${name2}`]),
      ])
      for (const pkg of only2) {
        section.appendChild(el('div', { class: 'diff-app' }, [pkg]))
      }
      resultArea.appendChild(section)
    }
  })
}
