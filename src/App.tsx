import { useEffect, useMemo, useRef, useState } from 'react'

import {
  DEFAULT_HOLIDAYS,
  DEFAULT_WORK_BLOCKS,
  endOfLastWorkBlockBefore,
  isInWorkTime,
  nextResumeAt,
  pauseReason,
  workMsBetween,
} from './utils/workTime'

import { fmtDateTime, fmtTime, msToParts, parseDatetimeLocalValue, toDatetimeLocalValue } from './utils/time'

const LS_KEY = 'time-left:end-iso'
const LS_STOPPED = '__stopped__'

const STEP_MIN = 5
const STEP_MS = STEP_MIN * 60000

// Set true while developing/testing. Set false for real use.
// If you want this to be dev-only, see note below.
// const IGNORE_WORK_SCHEDULE = true
const IGNORE_WORK_SCHEDULE = import.meta.env.DEV

type PickerInput = HTMLInputElement & {
  showPicker?: () => void
}

function defaultEndFromNow(base: Date) {
  const d = new Date(base)
  d.setHours(d.getHours() + 6)
  d.setSeconds(0, 0)
  return d
}

function clampDateMin(d: Date, min: Date) {
  return d.getTime() < min.getTime() ? new Date(min) : d
}

// Move the calendar deadline so that "work time between now and end" changes by deltaMin.
// This means +1h always gives +1h of work time, even across breaks/overnight/weekends.
function shiftEndByWorkMinutes(now: Date, prevEnd: Date | null, deltaMin: number) {
  // If we were stopped, treat base end as now.
  const baseEnd = prevEnd ? new Date(prevEnd) : new Date(now)

  // Never let end be before now.
  let cursor = clampDateMin(baseEnd, now)

  // Current "countable end" and current work between now and that end.
  const currentEffective = endOfLastWorkBlockBefore(cursor, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
  const currentWork = workMsBetween(now, currentEffective, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)

  const want = Math.max(0, currentWork + deltaMin * 60000)

  // Fast path: if want is 0, collapse end to now (so remaining becomes 0).
  if (want === 0) return new Date(now)

  // If we need more work time, walk forward until we have enough.
  if (want > currentWork) {
    // Ensure we start from a point that can actually accumulate future work time.
    cursor = new Date(Math.max(cursor.getTime(), now.getTime()))

    for (let i = 0; i < 5000; i++) {
      const eff = endOfLastWorkBlockBefore(cursor, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
      const got = workMsBetween(now, eff, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
      if (got >= want) return cursor

      // Jump strategy:
      // - If cursor is in work time, jump STEP minutes.
      // - Otherwise jump to next resume time.
      if (isInWorkTime(cursor, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)) {
        cursor = new Date(cursor.getTime() + STEP_MS)
      } else {
        const nr = nextResumeAt(cursor, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
        cursor = nr.getTime() === cursor.getTime() ? new Date(cursor.getTime() + 60 * 60000) : nr
      }
    }

    return cursor
  }

  // If we need less work time, walk backward until we're <= want, then tighten forward.
  if (want < currentWork) {
    // Start from the current end, but not before now.
    cursor = new Date(Math.max(cursor.getTime(), now.getTime()))

    // Step backward until got <= want
    for (let i = 0; i < 5000; i++) {
      const eff = endOfLastWorkBlockBefore(cursor, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
      const got = workMsBetween(now, eff, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
      if (got <= want) break

      // Step backward:
      // - If inside work time, go back STEP minutes.
      // - Otherwise, go to end of the last work block before cursor (minus 1ms to avoid looping).
      if (isInWorkTime(cursor, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)) {
        cursor = new Date(cursor.getTime() - STEP_MS)
      } else {
        const back = new Date(cursor.getTime() - 1)
        const lastEnd = endOfLastWorkBlockBefore(back, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
        // If lastEnd doesn't move, fall back to -1h to guarantee progress.
        cursor =
          lastEnd.getTime() === cursor.getTime() ? new Date(cursor.getTime() - 60 * 60000) : new Date(lastEnd)
      }

      if (cursor.getTime() < now.getTime()) {
        cursor = new Date(now)
        break
      }
    }

    // Tighten forward to the earliest cursor that still gives >= want.
    // This avoids overshooting backward too much.
    let tighten = new Date(cursor)
    for (let i = 0; i < 200; i++) {
      const eff = endOfLastWorkBlockBefore(tighten, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
      const got = workMsBetween(now, eff, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
      if (got >= want) {
        // Move slightly earlier if possible
        const earlier = new Date(tighten.getTime() - STEP_MS)
        if (earlier.getTime() < now.getTime()) return tighten

        const effEarlier = endOfLastWorkBlockBefore(earlier, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
        const gotEarlier = workMsBetween(now, effEarlier, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)

        if (gotEarlier >= want) tighten = earlier
        else return tighten
      } else {
        // Not enough, move forward a bit
        tighten = new Date(tighten.getTime() + 1 * 60000)
      }
    }

    return tighten
  }

  // want === currentWork, no change
  return cursor
}

export default function App() {
  const endRef = useRef<PickerInput | null>(null)

  const [now, setNow] = useState(() => new Date())

  // Date | null so we can truly have "no deadline"
  // IMPORTANT: persist stopped state across reloads using LS_STOPPED sentinel
  const [end, setEnd] = useState<Date | null>(() => {
    const saved = localStorage.getItem(LS_KEY)

    if (saved === LS_STOPPED) return null

    if (saved) {
      const d = new Date(saved)
      if (!Number.isNaN(d.getTime())) return d
    }

    // Default initial deadline (only when nothing saved)
    return defaultEndFromNow(new Date())
  })

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  // Persist end OR persisted stopped state
  useEffect(() => {
    if (end) localStorage.setItem(LS_KEY, end.toISOString())
    else localStorage.setItem(LS_KEY, LS_STOPPED)
  }, [end])

  const stopped = end == null

  const effectiveEnd = useMemo(() => {
    if (!end) return null
    return endOfLastWorkBlockBefore(end, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
  }, [end])

  const workMsLeft = useMemo(() => {
    if (!end) return 0

    if (IGNORE_WORK_SCHEDULE) {
      return Math.max(0, end.getTime() - now.getTime())
    }

    if (!effectiveEnd) return 0
    if (effectiveEnd.getTime() <= now.getTime()) return 0
    return workMsBetween(now, effectiveEnd, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
  }, [now, end, effectiveEnd])

  const isOverdue = !stopped && now.getTime() > end!.getTime()
  const parts = useMemo(() => msToParts(workMsLeft), [workMsLeft])

  const paused = useMemo(() => {
    if (IGNORE_WORK_SCHEDULE) return false
    if (stopped) return false
    return !isInWorkTime(now, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
  }, [now, stopped])

  const reason = useMemo(() => {
    if (IGNORE_WORK_SCHEDULE) return null
    if (stopped) return null
    return pauseReason(now, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
  }, [now, stopped])

  const resumesAt = useMemo(() => {
    if (IGNORE_WORK_SCHEDULE) return now
    if (stopped) return now
    return nextResumeAt(now, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
  }, [now, stopped])

  const addMinutes = (m: number) => {
    setEnd((prev) => {
      // If we are ignoring schedule (dev), keep the old simple behavior.
      if (IGNORE_WORK_SCHEDULE) {
        const base = prev ?? new Date()
        return new Date(base.getTime() + m * 60000)
      }

      // Real behavior: add/subtract WORK minutes from "remaining work time".
      return shiftEndByWorkMinutes(now, prev, m)
    })
  }

  const addHours = (h: number) => addMinutes(h * 60)

  const onSetEnd = (v: string) => {
    const d = parseDatetimeLocalValue(v)
    if (d) setEnd(d)
  }

  const openPicker = () => {
    const el = endRef.current
    if (!el) return

    if (stopped) {
      const d = defaultEndFromNow(now)
      setEnd(d)

      requestAnimationFrame(() => {
        el.focus()
        el.showPicker?.()
      })
      return
    }

    el.focus()
    el.showPicker?.()
  }

  // Stop means: no deadline + stays stopped after reload
  const stop = () => {
    setEnd(null)
  }

  const pauseText = useMemo(() => {
    if (!paused) return null

    const at = fmtDateTime(resumesAt)
    if (reason === 'break') return `Paused—break time. Resumes at ${fmtTime(resumesAt)}.`
    if (reason === 'before') return `Paused—outside working hours. Resumes at ${fmtTime(resumesAt)}.`
    if (reason === 'after') return `Paused—outside working hours. Resumes at ${at}.`
    if (reason === 'weekend') return `Paused—weekend. Resumes at ${at}.`
    if (reason === 'holiday') return `Paused—holiday. Resumes at ${at}.`
    return `Paused. Resumes at ${at}.`
  }, [paused, reason, resumesAt])

  return (
    <div className="app">
      <div className="main">
        <div className="label">Deadline</div>
        <div className="end">{end ? fmtDateTime(end) : 'None'}</div>

        <div className="label">Remaining (work time)</div>
        <div className="remaining">
          {parts.days > 0 && `${parts.days}d `}
          {parts.hours}h {parts.minutes}m {parts.seconds}s
        </div>

        {paused && <div className="overdue">{pauseText}</div>}
        {isOverdue && <div className="overdue">Overdue (calendar time)</div>}
      </div>

      <div className="controls">
        <button onClick={() => addHours(1)}>+1h</button>
        <button onClick={() => addHours(2)}>+2h</button>
        <button onClick={() => addHours(4)}>+4h</button>
        <button onClick={() => addHours(6)}>+6h</button>
        <button onClick={() => addHours(-1)}>-1h</button>

        <span className="endPickerWrap">
          <input
            ref={endRef}
            className="endInputGhost"
            type="datetime-local"
            value={end ? toDatetimeLocalValue(end) : ''}
            onChange={(e) => onSetEnd(e.target.value)}
            aria-label="End time"
          />

          <button onClick={openPicker} className="endButton" aria-label="Change end time">
            End <span className="icon">🗓️</span>
          </button>
        </span>

        <button onClick={stop} className="resetButton" aria-label="Stop and clear deadline">
          Stop
        </button>
      </div>
    </div>
  )
}
