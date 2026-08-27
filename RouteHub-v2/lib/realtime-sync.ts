/**
 * Coalesces bursts of Supabase Realtime events into one authoritative reload.
 * Route updates can emit several row events (status, position, evidence); a
 * short debounce prevents stale overlapping requests from racing each other.
 */
export function createRealtimeRefresh(refresh: () => void | Promise<void>, delayMs = 150) {
  let timer: ReturnType<typeof setTimeout> | undefined
  let disposed = false

  const schedule = () => {
    if (disposed || timer) return
    timer = setTimeout(() => {
      timer = undefined
      if (!disposed) void refresh()
    }, delayMs)
  }

  const dispose = () => {
    disposed = true
    if (timer) clearTimeout(timer)
    timer = undefined
  }

  return {schedule, dispose}
}
