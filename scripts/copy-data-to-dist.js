import { cpSync, mkdirSync, existsSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const DATA_DIR = join(ROOT, 'data')
const DIST_DATA = join(ROOT, 'dist', 'data')

if (!existsSync(DATA_DIR)) {
  console.log('[copy-data] No data/ directory found, skipping.')
  process.exit(0)
}

mkdirSync(DIST_DATA, { recursive: true })

// Essential files to copy
const ESSENTIAL_FILES = [
  'core.json',
  'stats.json',
  'changes.json',
  'changelog.json',
  'repos_list.txt',
]

for (const file of ESSENTIAL_FILES) {
  const src = join(DATA_DIR, file)
  const dst = join(DIST_DATA, file)
  if (existsSync(src)) {
    cpSync(src, dst)
    console.log(`[copy-data] ${file}`)
  }
}

// Copy state/ directory (icon_cache, name_cache, last_run, release_cache)
const STATE_DIR = join(DATA_DIR, 'state')
const DIST_STATE = join(DIST_DATA, 'state')
if (existsSync(STATE_DIR)) {
  mkdirSync(DIST_STATE, { recursive: true })
  const stateFiles = readdirSync(STATE_DIR)
  for (const file of stateFiles) {
    const src = join(STATE_DIR, file)
    const dst = join(DIST_STATE, file)
    cpSync(src, dst)
  }
  console.log(`[copy-data] state/ (${stateFiles.length} files)`)
}

// Copy bundles/ directory (split bundle files)
const BUNDLES_DIR = join(DATA_DIR, 'bundles')
const DIST_BUNDLES = join(DIST_DATA, 'bundles')
if (existsSync(BUNDLES_DIR)) {
  mkdirSync(DIST_BUNDLES, { recursive: true })
  const bundleFiles = readdirSync(BUNDLES_DIR)
  for (const file of bundleFiles) {
    const src = join(BUNDLES_DIR, file)
    const dst = join(DIST_BUNDLES, file)
    cpSync(src, dst)
  }
  console.log(`[copy-data] bundles/ (${bundleFiles.length} files)`)
}

console.log('[copy-data] Done.')
