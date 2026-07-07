export interface ReleaseEntry {
  type: 'change' | 'text'
  scope: string
  description: string
  commitLink?: string
  changeType?: string
  text?: string
}

export interface ReleaseSection {
  heading: string
  entries: ReleaseEntry[]
  mode: 'structured' | 'markdown'
  markdown?: string
  rawLines?: string[]
}

export interface ParsedRelease {
  sections: ReleaseSection[]
}
