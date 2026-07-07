interface VersionChipProps {
  version: string
  any?: boolean
}

export default function VersionChip({ version, any: anyVersion }: VersionChipProps) {
  return <span className={`version-chip${anyVersion ? ' any' : ''}`}>{version}</span>
}
