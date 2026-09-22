/**
 * Build script — copies all needed files to docs/ for GitHub Pages.
 * Run: node scripts/build.js
 */
import { cpSync, mkdirSync, existsSync, readdirSync, rmSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DOCS = join(ROOT, 'docs')

console.log('[build] Starting build to docs/...')

// Clean docs/
if (existsSync(DOCS)) {
  rmSync(DOCS, { recursive: true })
  console.log('[build] Cleaned docs/')
}
mkdirSync(DOCS, { recursive: true })

// 1. Copy index.html
cpSync(join(ROOT, 'index.html'), join(DOCS, 'index.html'))
console.log('[build] index.html')

// 2. Copy assets/
cpSync(join(ROOT, 'assets'), join(DOCS, 'assets'), { recursive: true })
console.log('[build] assets/')

// 3. Copy scripts/
cpSync(join(ROOT, 'scripts'), join(DOCS, 'scripts'), { recursive: true })
console.log('[build] scripts/')

// 4. Copy public files (favicon, feed, msg.txt)
for (const file of ['favicon.svg', 'feed.xml']) {
  const src = join(ROOT, file)
  if (existsSync(src)) {
    cpSync(src, join(DOCS, file))
    console.log(`[build] ${file}`)
  }
}

const publicDir = join(ROOT, 'public')
if (existsSync(publicDir)) {
  for (const file of readdirSync(publicDir)) {
    cpSync(join(publicDir, file), join(DOCS, file))
    console.log(`[build] public/${file}`)
  }
}

// 5. Copy data/ (essential files only)
const DATA_DIR = join(ROOT, 'data')
const DOCS_DATA = join(DOCS, 'data')

if (existsSync(DATA_DIR)) {
  mkdirSync(DOCS_DATA, { recursive: true })

  // Essential root files
  const ESSENTIAL_FILES = ['core.json', 'stats.json', 'changes.json', 'changelog.json', 'repos_list.txt']
  for (const file of ESSENTIAL_FILES) {
    const src = join(DATA_DIR, file)
    if (existsSync(src)) {
      cpSync(src, join(DOCS_DATA, file))
    }
  }
  console.log('[build] data/ (essential files)')

  // state/ directory
  const STATE_DIR = join(DATA_DIR, 'state')
  const DOCS_STATE = join(DOCS_DATA, 'state')
  if (existsSync(STATE_DIR)) {
    mkdirSync(DOCS_STATE, { recursive: true })
    for (const file of readdirSync(STATE_DIR)) {
      cpSync(join(STATE_DIR, file), join(DOCS_STATE, file))
    }
    console.log(`[build] data/state/ (${readdirSync(STATE_DIR).length} files)`)
  }

  // bundles/ directory
  const BUNDLES_DIR = join(DATA_DIR, 'bundles')
  const DOCS_BUNDLES = join(DOCS_DATA, 'bundles')
  if (existsSync(BUNDLES_DIR)) {
    mkdirSync(DOCS_BUNDLES, { recursive: true })
    for (const file of readdirSync(BUNDLES_DIR)) {
      cpSync(join(BUNDLES_DIR, file), join(DOCS_BUNDLES, file))
    }
    console.log(`[build] data/bundles/ (${readdirSync(BUNDLES_DIR).length} files)`)
  }
}

console.log('[build] Done!')
