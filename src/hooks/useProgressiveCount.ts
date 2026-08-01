import { useEffect, useRef, useState } from 'react'

export function useProgressiveCount(
  total: number,
  batchSize = 12,
  initial = 24,
): number {
  const [count, setCount] = useState(() => Math.min(initial, total))
  const currentRef = useRef(count)
  const totalRef = useRef(total)
  totalRef.current = total

  useEffect(() => {
    currentRef.current = Math.min(initial, total)
    setCount(currentRef.current)
    if (currentRef.current >= total) return

    let raf = 0
    const step = () => {
      currentRef.current = Math.min(currentRef.current + batchSize, total)
      setCount(currentRef.current)
      if (currentRef.current < total) {
        raf = requestAnimationFrame(step)
      }
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [total, batchSize, initial])

  return count
}
