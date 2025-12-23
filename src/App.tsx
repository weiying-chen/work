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

// Set true while developing/testing. Set false for real use.
// If you want this to be dev-only, see note below.
const IGNORE_WORK_SCHEDULE = true
// const IGNORE_WORK_SCHEDULE = import.meta.env.DEV

type PickerInput = HTMLInputElement & {
  showPicker?: () => void
}

export default function App() {
  const endRef = useRef<PickerInput | null>(null)

  const [now, setNow] = useState(() => new Date())

  const [end, setEnd] = useState<Date>(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) {
      const d = new Date(saved)
      if (!Number.isNaN(d.getTime())) return d
    }

    const d = new Date()
    d.setHours(d.getHours() + 6)
    d.setSeconds(0, 0)
    return d
  })

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_KEY, end.toISOString())
  }, [end])

  const effectiveEnd = useMemo(() => {
    return endOfLastWorkBlockBefore(end, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
  }, [end])

  const workMsLeft = useMemo(() => {
    // Test mode: just do raw calendar countdown to effectiveEnd.
    if (IGNORE_WORK_SCHEDULE) {
      return Math.max(0, effectiveEnd.getTime() - now.getTime())
    }

    // Real mode: count only work-time between now and effectiveEnd.
    if (effectiveEnd.getTime() <= now.getTime()) return 0
    return workMsBetween(now, effectiveEnd, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
  }, [now, effectiveEnd])

  const isOverdue = now.getTime() > end.getTime()
  const parts = useMemo(() => msToParts(workMsLeft), [workMsLeft])

  const paused = useMemo(() => {
    if (IGNORE_WORK_SCHEDULE) return false
    return !isInWorkTime(now, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
  }, [now])

  const reason = useMemo(() => {
    if (IGNORE_WORK_SCHEDULE) return null
    return pauseReason(now, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
  }, [now])

  const resumesAt = useMemo(() => {
    if (IGNORE_WORK_SCHEDULE) return now
    return nextResumeAt(now, DEFAULT_WORK_BLOCKS, DEFAULT_HOLIDAYS)
  }, [now])

  const addMinutes = (m: number) => {
    setEnd((prev) => new Date(prev.getTime() + m * 60000))
  }

  const onSetEnd = (v: string) => {
    const d = parseDatetimeLocalValue(v)
    if (d) setEnd(d)
  }

  const openPicker = () => {
    const el = endRef.current
    if (!el) return
    el.focus()
    el.showPicker?.()
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
        <div className="end">{fmtDateTime(end)}</div>

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
            value={toDatetimeLocalValue(end)}
            onChange={(e) => onSetEnd(e.target.value)}
            aria-label="End time"
          />

          <button onClick={openPicker} className="endButton" aria-label="Change end time">
            End <span className="icon">🗓️</span>
          </button>
        </span>
      </div>
    </div>
  )
}
