interface ChannelBadgeProps {
  channel: string
}

export default function ChannelBadge({ channel }: ChannelBadgeProps) {
  return <span className={`channel-badge ${channel}`}>{channel}</span>
}
