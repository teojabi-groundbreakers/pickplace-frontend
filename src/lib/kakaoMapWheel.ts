import type { KakaoMap, KakaoMapsApi } from './kakaoMaps'

const ZOOM_THRESHOLD_PX = 40
const ZOOM_DURATION_MS = 200
const GESTURE_GAP_MS = 180
const LINE_HEIGHT_PX = 16

export function bindKakaoMapWheel(
  element: HTMLElement,
  map: KakaoMap,
  maps: KakaoMapsApi,
): () => void {
  let accumulated = 0
  let lastInputAt = -Infinity
  let zooming = false
  let frame: number | null = null
  let pointer: { x: number; y: number } | null = null

  const clearPending = () => {
    accumulated = 0
    lastInputAt = -Infinity
    pointer = null
    if (frame !== null) {
      cancelAnimationFrame(frame)
      frame = null
    }
  }

  const flush = () => {
    frame = null
    if (zooming) return
    if (Date.now() - lastInputAt > GESTURE_GAP_MS) {
      clearPending()
      return
    }
    if (Math.abs(accumulated) < ZOOM_THRESHOLD_PX || !pointer) return

    const level = map.getLevel()
    const nextLevel = Math.min(14, Math.max(1, level + Math.sign(accumulated)))
    accumulated = 0
    if (nextLevel === level) return

    // Resolve the anchor after the previous animation changed the viewport.
    const bounds = element.getBoundingClientRect()
    const point = new maps.Point(pointer.x - bounds.left, pointer.y - bounds.top)
    const anchor = map.getProjection().coordsFromContainerPoint(point)
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    map.setLevel(nextLevel, {
      anchor,
      animate: reduceMotion ? false : { duration: ZOOM_DURATION_MS },
    })
  }

  const onZoomStart = () => {
    zooming = true
  }

  const onZoomChanged = () => {
    zooming = false
    if (Math.abs(accumulated) >= ZOOM_THRESHOLD_PX && frame === null) {
      // Wait for the SDK event stack to finish before starting another animation.
      frame = requestAnimationFrame(flush)
    }
  }

  const onWheel = (event: WheelEvent) => {
    // Capture before the SDK so one input cannot zoom twice or scroll the page.
    event.preventDefault()
    event.stopPropagation()

    if (!event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      clearPending()
      return
    }

    const unit =
      event.deltaMode === WheelEvent.DOM_DELTA_LINE
        ? LINE_HEIGHT_PX
        : event.deltaMode === WheelEvent.DOM_DELTA_PAGE
          ? element.clientHeight || window.innerHeight
          : 1
    const delta = event.deltaY * unit
    const now = Date.now()

    if (now - lastInputAt > GESTURE_GAP_MS || Math.sign(delta) !== Math.sign(accumulated)) {
      clearPending()
    }
    lastInputAt = now
    pointer = { x: event.clientX, y: event.clientY }

    // Keep at most one next step so an inertial flick cannot build a long zoom queue.
    accumulated = Math.max(-ZOOM_THRESHOLD_PX, Math.min(ZOOM_THRESHOLD_PX, accumulated + delta))
    if (!zooming && frame === null) flush()
  }

  maps.event.addListener(map, 'zoom_start', onZoomStart)
  maps.event.addListener(map, 'zoom_changed', onZoomChanged)
  // Use a native non-passive listener so preventDefault can cancel trackpad scrolling.
  element.addEventListener('wheel', onWheel, { capture: true, passive: false })
  element.addEventListener('mouseleave', clearPending)
  element.addEventListener('pointerdown', clearPending, true)
  element.addEventListener('touchstart', clearPending, { capture: true, passive: true })

  return () => {
    clearPending()
    element.removeEventListener('wheel', onWheel, true)
    element.removeEventListener('mouseleave', clearPending)
    element.removeEventListener('pointerdown', clearPending, true)
    element.removeEventListener('touchstart', clearPending, true)
    maps.event.removeListener(map, 'zoom_start', onZoomStart)
    maps.event.removeListener(map, 'zoom_changed', onZoomChanged)
  }
}
