import { useRef, useEffect } from 'react'

type Falloff = 'linear' | 'smooth' | 'sharp'

interface CursorGridProps {
  cellSize?: number
  color?: string
  radius?: number
  falloff?: Falloff
  holdTime?: number
  fadeDuration?: number
  lineWidth?: number
  maxOpacity?: number
  fillOpacity?: number
  gridOpacity?: number
  cellRadius?: number
  clickPulse?: boolean
  pulseSpeed?: number
  className?: string
}

const FALLOFF_CURVES: Record<Falloff, (t: number) => number> = {
  linear: (t) => t,
  smooth: (t) => t * t * (3 - 2 * t),
  sharp: (t) => t * t * t,
}

const hexToRgb = (hex: string): [number, number, number] => {
  const h = hex.replace('#', '')
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const num = parseInt(v.slice(0, 6), 16)
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255]
}

interface Pulse {
  x: number
  y: number
  t0: number
}

type RoundRectContext = CanvasRenderingContext2D & {
  roundRect?: (x: number, y: number, w: number, h: number, r: number) => void
}

const CursorGrid = ({
  cellSize = 70,
  color = '#D946EF',
  radius = 140,
  falloff = 'smooth',
  holdTime = 400,
  fadeDuration = 800,
  lineWidth = 1.2,
  maxOpacity = 1,
  fillOpacity = 0,
  gridOpacity = 0,
  cellRadius = 0,
  clickPulse = true,
  pulseSpeed = 600,
  className = '',
}: CursorGridProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const propsRef = useRef<CursorGridProps>({})
  const wakeRef = useRef<(() => void) | null>(null)

  propsRef.current = {
    cellSize,
    color,
    radius,
    falloff,
    holdTime,
    fadeDuration,
    lineWidth,
    maxOpacity,
    fillOpacity,
    gridOpacity,
    cellRadius,
    clickPulse,
    pulseSpeed,
  }

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    let cols = 0
    let rows = 0
    let offX = 0
    let offY = 0
    let alphas = new Float32Array(0)
    let touched = new Float64Array(0)
    let w = 0
    let h = 0
    let rectLeft = 0
    let rectTop = 0
    const pulses: Pulse[] = []
    let raf = 0
    let running = false
    let lastFrame = 0

    const rebuild = () => {
      const p = propsRef.current
      const rect = canvas.getBoundingClientRect()
      rectLeft = rect.left
      rectTop = rect.top
      w = container.offsetWidth
      h = container.offsetHeight
      canvas.width = Math.max(1, Math.round(w * dpr))
      canvas.height = Math.max(1, Math.round(h * dpr))
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols = Math.ceil(w / (p.cellSize ?? 70)) + 1
      rows = Math.ceil(h / (p.cellSize ?? 70)) + 1
      offX = (w - cols * (p.cellSize ?? 70)) / 2
      offY = (h - rows * (p.cellSize ?? 70)) / 2
      alphas = new Float32Array(cols * rows)
      touched = new Float64Array(cols * rows)
    }

    const cellCenter = (i: number): [number, number] => {
      const p = propsRef.current
      const size = p.cellSize ?? 70
      const cx = offX + (i % cols) * size + size / 2
      const cy = offY + Math.floor(i / cols) * size + size / 2
      return [cx, cy]
    }

    const energize = (x: number, y: number, boost?: number) => {
      const p = propsRef.current
      const size = p.cellSize ?? 70
      const r = Math.max(p.radius ?? 140, 1)
      const ease = FALLOFF_CURVES[p.falloff ?? 'linear'] ?? FALLOFF_CURVES.linear
      const now = performance.now()
      const minCol = Math.max(0, Math.floor((x - r - offX) / size))
      const maxCol = Math.min(cols - 1, Math.floor((x + r - offX) / size))
      const minRow = Math.max(0, Math.floor((y - r - offY) / size))
      const maxRow = Math.min(rows - 1, Math.floor((y + r - offY) / size))
      for (let cRow = minRow; cRow <= maxRow; cRow++) {
        for (let cCol = minCol; cCol <= maxCol; cCol++) {
          const i = cRow * cols + cCol
          const [cx, cy] = cellCenter(i)
          const dist = Math.hypot(cx - x, cy - y)
          if (dist > r) continue
          const level = ease(1 - dist / r) * (p.maxOpacity ?? 1) * (boost ?? 1)
          if (level > alphas[i]) {
            alphas[i] = level
            touched[i] = now
          } else if (level > 0) {
            touched[i] = now
          }
        }
      }
    }

    const draw = (now: number) => {
      const p = propsRef.current
      const dt = Math.min(now - lastFrame, 50)
      lastFrame = now
      ctx.clearRect(0, 0, w, h)
      const [cr, cg, cb] = hexToRgb(p.color ?? '#D946EF')
      const size = p.cellSize ?? 70

      if ((p.gridOpacity ?? 0) > 0) {
        ctx.strokeStyle = `rgba(${cr}, ${cg}, ${cb}, ${p.gridOpacity})`
        ctx.lineWidth = 1
        ctx.beginPath()
        for (let cCol = 0; cCol <= cols; cCol++) {
          const x = Math.round(offX + cCol * size) + 0.5
          ctx.moveTo(x, 0)
          ctx.lineTo(x, h)
        }
        for (let cRow = 0; cRow <= rows; cRow++) {
          const y = Math.round(offY + cRow * size) + 0.5
          ctx.moveTo(0, y)
          ctx.lineTo(w, y)
        }
        ctx.stroke()
      }

      for (let pi = pulses.length - 1; pi >= 0; pi--) {
        const pulse = pulses[pi]
        const age = (now - pulse.t0) / 1000
        const ringR = age * (p.pulseSpeed ?? 600)
        if (ringR > Math.hypot(w, h)) {
          pulses.splice(pi, 1)
          continue
        }
        const band = size
        const minCol = Math.max(0, Math.floor((pulse.x - ringR - band - offX) / size))
        const maxCol = Math.min(cols - 1, Math.floor((pulse.x + ringR + band - offX) / size))
        const minRow = Math.max(0, Math.floor((pulse.y - ringR - band - offY) / size))
        const maxRow = Math.min(rows - 1, Math.floor((pulse.y + ringR + band - offY) / size))
        for (let cRow = minRow; cRow <= maxRow; cRow++) {
          for (let cCol = minCol; cCol <= maxCol; cCol++) {
            const i = cRow * cols + cCol
            const [cx, cy] = cellCenter(i)
            const dist = Math.hypot(cx - pulse.x, cy - pulse.y)
            if (Math.abs(dist - ringR) < band / 2 && (p.maxOpacity ?? 1) > alphas[i]) {
              alphas[i] = p.maxOpacity ?? 1
              touched[i] = now
            }
          }
        }
      }

      let anyVisible = pulses.length > 0
      const fadeStep = dt / Math.max(p.fadeDuration ?? 800, 16)
      const half = size / 2
      const rctx = ctx as RoundRectContext

      for (let i = 0; i < alphas.length; i++) {
        let a = alphas[i]
        if (a <= 0) continue
        if (now - touched[i] > (p.holdTime ?? 400)) {
          a = Math.max(0, a - fadeStep)
          alphas[i] = a
          if (a <= 0) continue
        }
        anyVisible = true

        const [cx, cy] = cellCenter(i)
        const gradient = ctx.createRadialGradient(cx, cy, half * 0.1, cx, cy, size)
        gradient.addColorStop(0, `rgba(${cr}, ${cg}, ${cb}, ${a})`)
        gradient.addColorStop(1, `rgba(${cr}, ${cg}, ${cb}, 0)`)

        const x = cx - half + 0.5
        const y = cy - half + 0.5
        const s = size - 1

        ctx.beginPath()
        if ((p.cellRadius ?? 0) > 0 && rctx.roundRect) {
          rctx.roundRect(x, y, s, s, p.cellRadius)
        } else {
          ctx.rect(x, y, s, s)
        }
        if ((p.fillOpacity ?? 0) > 0) {
          ctx.fillStyle = `rgba(${cr}, ${cg}, ${cb}, ${a * (p.fillOpacity ?? 0)})`
          ctx.fill()
        }
        ctx.strokeStyle = gradient
        ctx.lineWidth = p.lineWidth ?? 1.2
        ctx.stroke()
      }

      if (anyVisible) {
        raf = requestAnimationFrame(draw)
      } else {
        running = false
        if ((propsRef.current.gridOpacity ?? 0) <= 0) ctx.clearRect(0, 0, w, h)
      }
    }

    const wake = () => {
      if (running) return
      running = true
      lastFrame = performance.now()
      raf = requestAnimationFrame(draw)
    }
    wakeRef.current = wake

    const toLocal = (e: PointerEvent): [number, number] => {
      return [e.clientX - rectLeft, e.clientY - rectTop]
    }

    const onPointerMove = (e: PointerEvent) => {
      const [x, y] = toLocal(e)
      energize(x, y)
      wake()
    }

    const onPointerDown = (e: PointerEvent) => {
      if (!propsRef.current.clickPulse) return
      const [x, y] = toLocal(e)
      pulses.push({ x, y, t0: performance.now() })
      wake()
    }

    const ro = new ResizeObserver(() => {
      rebuild()
      wake()
    })
    ro.observe(container)
    rebuild()
    wake()

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerdown', onPointerDown)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerdown', onPointerDown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cellSize])

  useEffect(() => {
    wakeRef.current?.()
  }, [gridOpacity, color, lineWidth, maxOpacity, fillOpacity, cellRadius])

  return (
    <div ref={containerRef} className={`cursor-grid${className ? ` ${className}` : ''}`}>
      <canvas ref={canvasRef} className="cursor-grid__canvas" />
    </div>
  )
}

export default CursorGrid
