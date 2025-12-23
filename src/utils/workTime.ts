// All "what counts as work time" rules live here.
// Pure logic: no React, no localStorage.

export type TimeHM = { h: number; m: number }
export type WorkBlock = { start: TimeHM; end: TimeHM }

export type PauseReason = 'break' | 'before' | 'after' | 'weekend' | 'holiday'

export const DEFAULT_WORK_BLOCKS: WorkBlock[] = [
  { start: { h: 8, m: 30 }, end: { h: 12, m: 0 } },
  { start: { h: 13, m: 0 }, end: { h: 17, m: 30 } },
]

// Date-only strings in local time: 'YYYY-MM-DD'
export const DEFAULT_HOLIDAYS: string[] = [
  // '2026-01-01',
]

export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function ymdLocal(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function isWeekend(d: Date) {
  const day = d.getDay() // 0 Sun .. 6 Sat
  return day === 0 || day === 6
}

export function isHoliday(d: Date, holidays: string[] = DEFAULT_HOLIDAYS) {
  return holidays.includes(ymdLocal(d))
}

export function atLocalTime(baseDay: Date, t: TimeHM) {
  const d = new Date(baseDay)
  d.setHours(t.h, t.m, 0, 0)
  return d
}

export function clampOverlapMs(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  const start = Math.max(aStart.getTime(), bStart.getTime())
  const end = Math.min(aEnd.getTime(), bEnd.getTime())
  return Math.max(0, end - start)
}

export function isInWorkTime(
  now: Date,
  blocks: WorkBlock[] = DEFAULT_WORK_BLOCKS,
  holidays: string[] = DEFAULT_HOLIDAYS
) {
  if (isWeekend(now) || isHoliday(now, holidays)) return false

  const dayStart = new Date(now)
  dayStart.setHours(0, 0, 0, 0)

  const t = now.getTime()

  for (const block of blocks) {
    const bs = atLocalTime(dayStart, block.start)
    const be = atLocalTime(dayStart, block.end)
    if (t >= bs.getTime() && t < be.getTime()) return true
  }

  return false
}

export function workMsBetween(
  start: Date,
  end: Date,
  blocks: WorkBlock[] = DEFAULT_WORK_BLOCKS,
  holidays: string[] = DEFAULT_HOLIDAYS
) {
  if (end.getTime() <= start.getTime()) return 0

  let total = 0

  const cursorDay = new Date(start)
  cursorDay.setHours(0, 0, 0, 0)

  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)

  for (let day = new Date(cursorDay); day.getTime() <= endDay.getTime(); day.setDate(day.getDate() + 1)) {
    if (isWeekend(day) || isHoliday(day, holidays)) continue

    for (const block of blocks) {
      const bs = atLocalTime(day, block.start)
      const be = atLocalTime(day, block.end)
      total += clampOverlapMs(start, end, bs, be)
    }
  }

  return total
}

export function endOfLastWorkBlockBefore(
  deadline: Date,
  blocks: WorkBlock[] = DEFAULT_WORK_BLOCKS,
  holidays: string[] = DEFAULT_HOLIDAYS
) {
  // If deadline is in non-work time (or on weekend/holiday), treat the "countable end"
  // as the end of the last work block strictly before it.
  // If deadline is inside a work block, return deadline itself.
  const d = new Date(deadline)

  if (isInWorkTime(d, blocks, holidays)) return d

  const limit = 370 // safety limit ~1 year
  for (let i = 0; i < limit; i++) {
    const day = new Date(d)
    day.setHours(0, 0, 0, 0)

    if (!isWeekend(day) && !isHoliday(day, holidays)) {
      for (let j = blocks.length - 1; j >= 0; j--) {
        const be = atLocalTime(day, blocks[j].end)
        const bs = atLocalTime(day, blocks[j].start)
        if (be.getTime() <= d.getTime() && be.getTime() > bs.getTime()) {
          return be
        }
      }
    }

    // Move to previous day 23:59:59.999
    d.setDate(d.getDate() - 1)
    d.setHours(23, 59, 59, 999)
  }

  return deadline
}

export function nextResumeAt(
  now: Date,
  blocks: WorkBlock[] = DEFAULT_WORK_BLOCKS,
  holidays: string[] = DEFAULT_HOLIDAYS
) {
  if (isInWorkTime(now, blocks, holidays)) return now

  const today = new Date(now)
  today.setHours(0, 0, 0, 0)

  if (!isWeekend(today) && !isHoliday(today, holidays)) {
    for (const block of blocks) {
      const bs = atLocalTime(today, block.start)
      if (bs.getTime() > now.getTime()) return bs
    }
  }

  const limit = 370
  const day = new Date(today)
  for (let i = 0; i < limit; i++) {
    day.setDate(day.getDate() + 1)
    if (isWeekend(day) || isHoliday(day, holidays)) continue
    return atLocalTime(day, blocks[0].start)
  }

  return now
}

export function pauseReason(
  now: Date,
  blocks: WorkBlock[] = DEFAULT_WORK_BLOCKS,
  holidays: string[] = DEFAULT_HOLIDAYS
): PauseReason | null {
  if (isInWorkTime(now, blocks, holidays)) return null
  if (isHoliday(now, holidays)) return 'holiday'
  if (isWeekend(now)) return 'weekend'

  const day = new Date(now)
  day.setHours(0, 0, 0, 0)

  const firstStart = atLocalTime(day, blocks[0].start)
  const lastEnd = atLocalTime(day, blocks[blocks.length - 1].end)

  if (now.getTime() < firstStart.getTime()) return 'before'
  if (now.getTime() >= lastEnd.getTime()) return 'after'
  return 'break'
}
