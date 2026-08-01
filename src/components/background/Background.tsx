import CursorGrid from './CursorGrid'

export default function Background() {
  return (
    <div className="bg-layer" aria-hidden="true">
      <div className="glow-orb main-orb" />
      <div className="glow-orb sub-orb" />
      <CursorGrid
        cellSize={72}
        color="#818cf8"
        radius={120}
        falloff="smooth"
        holdTime={300}
        fadeDuration={1100}
        lineWidth={0.8}
        maxOpacity={0.35}
        fillOpacity={0.02}
        gridOpacity={0}
        cellRadius={6}
        clickPulse={false}
        pulseSpeed={700}
      />
    </div>
  )
}
