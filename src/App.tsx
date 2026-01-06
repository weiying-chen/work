import { useEffect, useMemo, useRef, useState } from 'react'

import { addWorkMinutes, isInWorkTime, nextWorkStart, workMsBetween } from './utils/workTime'
import { fmtDateTime, fmtTime, msToParts, parseDatetimeLocalValue, toDatetimeLocalValue } from './utils/time'

type PickerInput = HTMLInputElement & {
  showPicker?: () => void
}

const LS_KEY = 'deadline:end-iso'

export default function App() {
  const endRef = useRef<PickerInput | null>(null)

  const [now, setNow] = useState(() => new Date())
  const [end, setEnd] = useState(() => {
    const saved = localStorage.getItem(LS_KEY)
    if (saved) {
      const d = new Date(saved)
      if (!Number.isNaN(d.getTime())) return d
    }
    return new Date()
  })

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_KEY, end.toISOString())
  }, [end])

  const workMsLeft = useMemo(() => workMsBetween(now, end), [now, end])
  const parts = useMemo(() => msToParts(workMsLeft), [workMsLeft])
  const workStartAt = useMemo(() => (isInWorkTime(now) ? now : nextWorkStart(now)), [now])

  const addMinutes = (m: number) => {
    setEnd((prev) => addWorkMinutes(prev, m))
  }

  const addHours = (h: number) => addMinutes(h * 60)

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

  const reset = () => {
    setEnd(new Date())
  }

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
        {!isInWorkTime(now) && <div className="overdue">Counting from {fmtTime(workStartAt)}.</div>}
      </div>

      <div className="controls">
        <button onClick={() => addMinutes(30)}>+30m</button>
        <button onClick={() => addHours(1)}>+1h</button>
        <button onClick={() => addHours(2)}>+2h</button>
        <button onClick={() => addHours(4)}>+4h</button>
        <button onClick={() => addHours(6)}>+6h</button>

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

        <button onClick={reset} className="resetButton" aria-label="Reset deadline to now">
          Reset
        </button>
      </div>
    </div>
  )
}
