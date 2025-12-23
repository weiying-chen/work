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

// Set true while developing/testing. Set false for real use.
// If you want this to be dev-only, see note below.
const IGNORE_WORK_SCHEDULE = true
// const IGNORE_WORK_SCHEDULE = import.meta.env.DEV

type PickerInput = HTMLInputElement & {
  showPicker?: () => void
}

function defaultEndFromNow(base: Date) {
  const d = new Date(base)
  d.setHours(d.getHours() + 6)
  d.setSeconds(0, 0)
  return d
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
      // If stopped and user clicks +1h/-1h, start from now.
      const base = prev ?? new Date()
      return new Date(base.getTime() + m * 60000)
    })
  }

  const onSetEnd = (v: string) => {
    const d = parseDatetimeLocalValue(v)
    if (d) setEnd(d)
  }

  const openPicker = () => {
    const el = endRef.current
    if (!el) return

    if (stopped) {
      // If stopped, create an end so the native picker has a value,
      // then open the picker on the next frame.
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
        <button onClick={() => addMinutes(60)}>+1h</button>
        <button onClick={() => addMinutes(-60)}>-1h</button>

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
