export function minutesFromTimeParts(hoursText: string, minutesText: string) {
  const trimmedHours = hoursText.trim()
  const trimmedMinutes = minutesText.trim()

  if (!trimmedHours && !trimmedMinutes) return null

  const hours = trimmedHours ? Number(trimmedHours) : 0
  const minutes = trimmedMinutes ? Number(trimmedMinutes) : 0

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null
  if (hours < 0 || minutes < 0) return null

  const total = Math.round(hours * 60 + minutes)
  return total > 0 ? total : null
}
