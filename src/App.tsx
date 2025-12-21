import { useEffect, useMemo, useRef, useState } from 'react'

const LS_KEY = 'time-left:end-iso'

type PickerInput = HTMLInputElement & {
  showPicker?: () => void
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function fmtDateTime(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function toDatetimeLocalValue(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

function parseDatetimeLocalValue(v: string) {
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? null : d
}

function msToParts(ms: number) {
  const abs = Math.abs(ms)

  const totalSeconds = Math.floor(abs / 1000)
  const seconds = totalSeconds % 60

  const totalMinutes = Math.floor(totalSeconds / 60)
  const minutes = totalMinutes % 60

  const totalHours = Math.floor(totalMinutes / 60)
  const hours = totalHours % 24

  const days = Math.floor(totalHours / 24)

  return { days, hours, minutes, seconds }
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

  const msLeft = end.getTime() - now.getTime()
  const isOverdue = msLeft < 0
  const parts = useMemo(() => msToParts(msLeft), [msLeft])

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

  return (
    <div className="app">
      <h1>Time left</h1>

      <div className="card">
        <div className="label">Deadline</div>
        <div className="end">{fmtDateTime(end)}</div>

        <div className="label">Remaining</div>
        <div className="remaining">
          {isOverdue ? '-' : ''}
          {parts.days > 0 && `${parts.days}d `}
          {parts.hours}h {parts.minutes}m {parts.seconds}s
        </div>

        {isOverdue && <div className="overdue">Overdue</div>}
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
