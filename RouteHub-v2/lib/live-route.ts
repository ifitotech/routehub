export type LocationAgeLabels = {unavailable?:string;justNow?:string;minute?:string;minutes?:string;hour?:string;hours?:string}

export function formatLocationAge(value: string | null | undefined, now = Date.now(), labels: LocationAgeLabels = {}) {
  const unavailable=labels.unavailable||'Location unavailable'
  if (!value) return unavailable
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return unavailable
  const minutes = Math.max(0, Math.floor((now - timestamp) / 60_000))
  if (minutes === 0) return labels.justNow||'Updated just now'
  if (minutes === 1) return labels.minute||'Updated 1 min ago'
  if (minutes < 60) return labels.minutes?.replace('{n}',String(minutes))||`Updated ${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  return labels.hours?.replace('{n}',String(hours))||`Updated ${hours} hr ago`
}
