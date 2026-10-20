import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { fitValue, type Fitted as Fit, type Measure } from './fit'

// A value in a box of fixed width, shown by the display rules in fit.ts. The box is the element holding it: a table
// cell, the pop-up's dollar box, or a holdings row. Its width and font are measured on screen.

/** The space the expand symbol takes beside a shortened value: the icon and a small gap. */
const EXPAND_ROOM = 18

let canvas: CanvasRenderingContext2D | null = null

/** Measures text in the font an element uses. */
function measureIn(element: HTMLElement): Measure {
  const style = getComputedStyle(element)
  canvas ??= document.createElement('canvas').getContext('2d')
  return (text, size) => {
    if (!canvas) return text.length * size * 0.6
    canvas.font = `${style.fontStyle} ${style.fontWeight} ${size}px ${style.fontFamily}`
    return canvas.measureText(text).width
  }
}

/** Bumped once the app's font has loaded, so values measured with the fallback font are measured again. */
function useFontsLoaded() {
  const [loaded, setLoaded] = useState(0)
  useEffect(() => {
    let live = true
    document.fonts?.ready.then(() => live && setLoaded(n => n + 1))
    return () => void (live = false)
  }, [])
  return loaded
}

interface Props {
  /** The full value, as it reads when it fits. */
  text: string
  className?: string
  /** Shrink the font, down to 11px, before shortening, with no expand symbol (the corner box and holdings). */
  shrink?: boolean
}

/**
 * The value, fitted to its box. Without `shrink` (the full views and the pop-up dollar box) the font never changes,
 * and a shortened value has the expand symbol at its right, which opens a bubble with the full value.
 */
export default function Fitted({ text, className, shrink = false }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const [fit, setFit] = useState<Fit>({ text, shortened: false })
  const fonts = useFontsLoaded()

  useLayoutEffect(() => {
    const element = ref.current
    const box = element?.parentElement
    if (!element || !box) return
    const run = () => {
      const size = parseFloat(getComputedStyle(box).fontSize)
      const next = fitValue(text, element.clientWidth, measureIn(element), { size, shrink, reserve: shrink ? 0 : EXPAND_ROOM })
      setFit(old => (old.text === next.text && old.size === next.size && old.shortened === next.shortened ? old : next))
    }
    run()
    const watch = new ResizeObserver(run)
    watch.observe(element)
    return () => watch.disconnect()
  }, [text, shrink, fonts])

  const style: CSSProperties | undefined = fit.size ? { fontSize: fit.size } : undefined
  return (
    <span ref={ref} className={className ? `fitted ${className}` : 'fitted'} style={style}>
      <span className="fittedText">{fit.text}</span>
      {fit.shortened && !shrink && <Expand full={text} className={className} />}
    </span>
  )
}

/**
 * The expand symbol: two arrows pointing out. Pressing it opens a small bubble under the box with the full value, and
 * the arrows turn inward; pressing it again closes it. The press never reaches the row (so it does not open an edit).
 * The bubble is drawn over everything, level with the box; scrolling closes it, as it does the holdings menu.
 */
export function Expand({ full, className }: { full: string; className?: string }) {
  const [at, setAt] = useState<{ left: number; top: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!at) return
    const close = () => setAt(null)
    window.addEventListener('scroll', close, { capture: true })
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, { capture: true })
      window.removeEventListener('resize', close)
    }
  }, [at])

  const toggle = () => {
    const box = button.current?.closest('.fitted')?.parentElement?.getBoundingClientRect()
    setAt(at || !box ? null : { left: box.right, top: box.bottom + 4 })
  }

  return (
    <>
      <button
        ref={button}
        type="button"
        className="expand"
        aria-label={at ? 'Hide the full value' : 'Show the full value'}
        aria-expanded={at !== null}
        onClick={e => {
          e.stopPropagation()
          toggle()
        }}
        onPointerDown={e => e.stopPropagation()}
      >
        <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
          {at ? (
            <path d="M11 1 7 5M7 1.8V5h3.2M1 11l4-4M1.8 7H5v3.2" />
          ) : (
            <path d="M7 5l4-4M7.8 1H11v3.2M5 7l-4 4M1 7.8V11h3.2" />
          )}
        </svg>
      </button>
      {at &&
        createPortal(
          <div className={className ? `bubble ${className}` : 'bubble'} role="status" style={{ left: at.left, top: at.top }}>
            {full}
          </div>,
          document.body,
        )}
    </>
  )
}
