import type { AppData } from './bundles'
import type { PatchDiff } from './changes'

export type ViewMode = 'grid' | 'list'
export type ChannelFilter = 'all' | 'stable' | 'dev'

export interface FilterState {
  search: string
  channel: ChannelFilter
}

export interface ModalState {
  stableApp: AppData | null
  devApp: AppData | null
  bundleName: string
  currentChannel: 'stable' | 'dev'
  patchDiff: PatchDiff | null
  summary: string | null
}
