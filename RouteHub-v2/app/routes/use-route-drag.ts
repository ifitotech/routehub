'use client'

import {useCallback, useRef, useState} from 'react'

export type RouteDropTarget = {kind: 'unassigned'} | {kind: 'route'; routeId: string}

/**
 * Pointer Events (not the HTML5 drag-and-drop API) so the same gesture works
 * with mouse, touch and pen without a polyfill - Manager is used on tablets
 * dispatching from the floor, not just desktop. The dragged card stays put
 * and dims; a small floating label follows the pointer instead, and the drop
 * target is resolved with elementFromPoint against data-drag-route/
 * data-drop-zone attributes rather than native dragover/drop events.
 */
export function useRouteDrag(onDrop: (draggedRouteId: string, target: RouteDropTarget) => void) {
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{x: number; y: number} | null>(null)
  const [overTarget, setOverTarget] = useState<RouteDropTarget | null>(null)
  const draggingRef = useRef<string | null>(null)

  const resolveTarget = useCallback((x: number, y: number): RouteDropTarget | null => {
    const el = document.elementFromPoint(x, y)
    if (!el) return null
    const routeEl = el.closest<HTMLElement>('[data-drag-route]')
    if (routeEl?.dataset.dragRoute && routeEl.dataset.dragRoute !== draggingRef.current) {
      return {kind: 'route', routeId: routeEl.dataset.dragRoute}
    }
    if (el.closest('[data-drop-zone="unassigned"]')) return {kind: 'unassigned'}
    return null
  }, [])

  const stopListening = useCallback((move: (event: PointerEvent) => void, up: (event: PointerEvent) => void) => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  const startDrag = useCallback((routeId: string, event: React.PointerEvent) => {
    if (event.button !== undefined && event.button !== 0 && event.pointerType === 'mouse') return
    event.preventDefault()
    draggingRef.current = routeId
    setDraggingId(routeId)
    setPointer({x: event.clientX, y: event.clientY})
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'

    const move = (moveEvent: PointerEvent) => {
      setPointer({x: moveEvent.clientX, y: moveEvent.clientY})
      setOverTarget(resolveTarget(moveEvent.clientX, moveEvent.clientY))
    }
    const up = (upEvent: PointerEvent) => {
      stopListening(move, up)
      const target = resolveTarget(upEvent.clientX, upEvent.clientY)
      const dragged = draggingRef.current
      draggingRef.current = null
      setDraggingId(null)
      setPointer(null)
      setOverTarget(null)
      if (dragged && target) onDrop(dragged, target)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }, [onDrop, resolveTarget, stopListening])

  return {draggingId, pointer, overTarget, startDrag}
}
