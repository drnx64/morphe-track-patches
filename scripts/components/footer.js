/**
 * Footer — links, disclaimers.
 */
import { el } from '../ui.js'

const SITE_URL = 'https://drnx64.github.io/morphe-track-patches'

export function renderFooter() {
  return el('footer', { class: 'app-footer' }, [
    el('div', { class: 'footer-inner' }, [
      el('div', { class: 'footer-links' }, [
        el('a', { href: `${SITE_URL}/feed.xml`, target: '_blank', rel: 'noopener' }, ['RSS Feed']),
        el('span', { class: 'footer-sep' }, ['|']),
        el('a', { href: 'https://github.com/drnx64/morphe-track-patches', target: '_blank', rel: 'noopener' }, ['GitHub']),
      ]),
      el('p', { class: 'footer-disclaimer' }, [
        'MorpheTracker is not affiliated with or endorsed by any app developers.',
      ]),
    ]),
  ])
}
