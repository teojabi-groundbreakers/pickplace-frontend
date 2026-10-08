import type { KakaoMap, KakaoMapsApi } from './kakaoMaps'

const ZOOM_THRESHOLD_PX = 40
const ZOOM_INTERVAL_MS = 160
const GESTURE_GAP_MS = 180
const LINE_HEIGHT_PX = 16

export function bindKakaoMapWheel(
  element: HTMLElement,
  map: KakaoMap,
  maps: KakaoMapsApi,
): () => void {
  let accumulated = 0
  let lastInputAt = -Infinity
  let lastZoomAt = -Infinity

  const onWheel = (event: WheelEvent) => {
    // Capture before the SDK so one input cannot zoom twice or scroll the page.
    event.preventDefault()
    event.stopPropagation()

    if (!event.deltaY || Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
      accumulated = 0
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
      accumulated = 0
    }
    lastInputAt = now

    if (now - lastZoomAt < ZOOM_INTERVAL_MS) {
      accumulated = 0
      return
    }

    accumulated += delta
    if (Math.abs(accumulated) < ZOOM_THRESHOLD_PX) return

    accumulated = 0
    lastZoomAt = now
    const level = map.getLevel()
    const nextLevel = Math.min(14, Math.max(1, level + Math.sign(delta)))
    if (nextLevel === level) return

    const bounds = element.getBoundingClientRect()
    const point = new maps.Point(event.clientX - bounds.left, event.clientY - bounds.top)
    const anchor = map.getProjection().coordsFromContainerPoint(point)
    map.setLevel(nextLevel, { anchor })
  }

  // Use a native non-passive listener so preventDefault can cancel trackpad scrolling.
  element.addEventListener('wheel', onWheel, { capture: true, passive: false })
  return () => element.removeEventListener('wheel', onWheel, true)
}
