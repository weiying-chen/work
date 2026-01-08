import { useEffect, useMemo, useRef, useState } from 'react'

import { formatTeamsMessage, type ReasonEntry } from './utils/deadlineHistory'
import {
  fmtDateTime,
  fmtTime,
  msToParts,
  pad2,
  parseDatetimeLocalValue,
  toDatetimeLocalValue,
} from './utils/time'
import {
  addWorkMinutes,
  isInWorkTime,
  nextWorkStart,
  shouldShowEarlyFinishReminder,
  shouldShowTeamsReminder,
  workMsBetween,
} from './utils/workTime'

type PickerInput = HTMLInputElement & {
  showPicker?: () => void
}

const LS_END_KEY = 'deadline:end-iso'
const LS_PREV_END_KEY = 'deadline:previous-end-iso'
const LS_PREV_CHANGED_KEY = 'deadline:previous-changed-iso'
const LS_PREV_REASONS_KEY = 'deadline:previous-reasons'
const LS_REASON_DRAFT_KEY = 'deadline:reason-draft'
const LS_CHANGE_BASE_KEY = 'deadline:change-base-iso'
const LS_MESSAGE_TASK_KEY = 'deadline:message-task'
const LS_MESSAGE_ASSIGNEE_KEY = 'deadline:message-assignee'
const LS_REMINDER_NOTIFIED_KEY = 'deadline:reminder-notified'
const LS_REMINDER_REQUESTED_KEY = 'deadline:reminder-requested'
const LS_TEAMS_REMINDER_NOTIFIED_KEY = 'deadline:teams-reminder-notified'
const LS_TEAMS_REMINDER_REQUESTED_KEY = 'deadline:teams-reminder-requested'

function readStoredDate(key: string) {
  const saved = localStorage.getItem(key)
  if (!saved) return null
  const d = new Date(saved)
  return Number.isNaN(d.getTime()) ? null : d
}

function dateKey(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function readStoredReasons(key: string) {
  const saved = localStorage.getItem(key)
  if (!saved) return [] as ReasonEntry[]
  try {
    const parsed = JSON.parse(saved) as ReasonEntry[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (item) => typeof item?.text === 'string' && Number.isFinite(item?.minutes) && item.minutes > 0
    )
  } catch {
    return []
  }
}

export default function App() {
  const endRef = useRef<PickerInput | null>(null)

  const [now, setNow] = useState(() => new Date())
  const [end, setEnd] = useState(() => readStoredDate(LS_END_KEY) ?? new Date())
  const [previousEnd, setPreviousEnd] = useState<Date | null>(() => readStoredDate(LS_PREV_END_KEY))
  const [previousChangedAt, setPreviousChangedAt] = useState<Date | null>(() =>
    readStoredDate(LS_PREV_CHANGED_KEY)
  )
  const [previousReasons, setPreviousReasons] = useState<ReasonEntry[]>(() =>
    readStoredReasons(LS_PREV_REASONS_KEY)
  )
  const [reasonDrafts, setReasonDrafts] = useState<ReasonEntry[]>(() =>
    readStoredReasons(LS_REASON_DRAFT_KEY)
  )
  const [changeBaseEnd, setChangeBaseEnd] = useState<Date | null>(() => readStoredDate(LS_CHANGE_BASE_KEY))
  const [reasonText, setReasonText] = useState('')
  const [reasonMinutes, setReasonMinutes] = useState('')
  const [messageTask, setMessageTask] = useState(() => localStorage.getItem(LS_MESSAGE_TASK_KEY) ?? '')
  const [messageAssignee, setMessageAssignee] = useState(
    () => localStorage.getItem(LS_MESSAGE_ASSIGNEE_KEY) ?? ''
  )
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    localStorage.setItem(LS_END_KEY, end.toISOString())
  }, [end])

  useEffect(() => {
    if (previousEnd) {
      localStorage.setItem(LS_PREV_END_KEY, previousEnd.toISOString())
    }
  }, [previousEnd])

  useEffect(() => {
    if (previousChangedAt) {
      localStorage.setItem(LS_PREV_CHANGED_KEY, previousChangedAt.toISOString())
    }
  }, [previousChangedAt])

  useEffect(() => {
    localStorage.setItem(LS_PREV_REASONS_KEY, JSON.stringify(previousReasons))
  }, [previousReasons])

  useEffect(() => {
    localStorage.setItem(LS_REASON_DRAFT_KEY, JSON.stringify(reasonDrafts))
  }, [reasonDrafts])

  useEffect(() => {
    if (changeBaseEnd) {
      localStorage.setItem(LS_CHANGE_BASE_KEY, changeBaseEnd.toISOString())
    } else {
      localStorage.removeItem(LS_CHANGE_BASE_KEY)
    }
  }, [changeBaseEnd])

  useEffect(() => {
    localStorage.setItem(LS_MESSAGE_TASK_KEY, messageTask)
  }, [messageTask])

  const workMsLeft = useMemo(() => workMsBetween(now, end), [now, end])
  const parts = useMemo(() => msToParts(workMsLeft), [workMsLeft])
  const workStartAt = useMemo(() => (isInWorkTime(now) ? now : nextWorkStart(now)), [now])
  const showEarlyFinishReminder = useMemo(
    () => shouldShowEarlyFinishReminder(now, end),
    [end, now]
  )
  const showTeamsReminder = useMemo(() => shouldShowTeamsReminder(now, end), [end, now])

  useEffect(() => {
    if (!showEarlyFinishReminder) return
    if (typeof Notification === 'undefined') return

    const todayKey = dateKey(now)
    if (localStorage.getItem(LS_REMINDER_NOTIFIED_KEY) === todayKey) return

    const sendNotification = () => {
      new Notification('Reminder', {
        body: 'Ask for more work before 9:00 AM.',
      })
      localStorage.setItem(LS_REMINDER_NOTIFIED_KEY, todayKey)
    }

    if (Notification.permission === 'granted') {
      sendNotification()
      return
    }

    if (Notification.permission === 'denied') return

    if (localStorage.getItem(LS_REMINDER_REQUESTED_KEY) === todayKey) return
    localStorage.setItem(LS_REMINDER_REQUESTED_KEY, todayKey)

    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') sendNotification()
    })
  }, [end, now, showEarlyFinishReminder])

  useEffect(() => {
    if (!showTeamsReminder) return
    if (typeof Notification === 'undefined') return

    const todayKey = dateKey(now)
    if (localStorage.getItem(LS_TEAMS_REMINDER_NOTIFIED_KEY) === todayKey) return

    const sendNotification = () => {
      new Notification('Reminder', {
        body: 'Post the Teams update.',
      })
      localStorage.setItem(LS_TEAMS_REMINDER_NOTIFIED_KEY, todayKey)
    }

    if (Notification.permission === 'granted') {
      sendNotification()
      return
    }

    if (Notification.permission === 'denied') return

    if (localStorage.getItem(LS_TEAMS_REMINDER_REQUESTED_KEY) === todayKey) return
    localStorage.setItem(LS_TEAMS_REMINDER_REQUESTED_KEY, todayKey)

    Notification.requestPermission().then((permission) => {
      if (permission === 'granted') sendNotification()
    })
  }, [end, now, showTeamsReminder])

  useEffect(() => {
    localStorage.setItem(LS_MESSAGE_ASSIGNEE_KEY, messageAssignee)
  }, [messageAssignee])

  const updateDeadline = (nextEnd: Date, options?: { reasons?: ReasonEntry[]; resetDrafts?: boolean }) => {
    if (nextEnd.getTime() === end.getTime()) return
    setPreviousEnd(end)
    setPreviousChangedAt(new Date())
    setPreviousReasons(options?.reasons ?? [])
    setEnd(nextEnd)
    if (options?.resetDrafts) {
      setReasonDrafts([])
      setChangeBaseEnd(null)
    }
  }

  const onSetEnd = (v: string) => {
    const d = parseDatetimeLocalValue(v)
    if (d) updateDeadline(d, { resetDrafts: true })
  }

  const openPicker = () => {
    const el = endRef.current
    if (!el) return
    el.focus()
    el.showPicker?.()
  }

  const reset = () => {
    updateDeadline(new Date(), { resetDrafts: true })
  }

  const teamsMessage = useMemo(() => {
    if (!previousEnd) return ''
    return formatTeamsMessage({
      previous: previousEnd,
      next: end,
      reasons: reasonDrafts.length > 0 ? reasonDrafts : previousReasons,
      task: messageTask,
      assignee: messageAssignee,
    })
  }, [end, messageAssignee, messageTask, previousEnd, previousReasons, reasonDrafts])

  useEffect(() => {
    setCopyStatus('idle')
  }, [teamsMessage])

  const onCopyTeamsMessage = async () => {
    if (!teamsMessage) return
    try {
      await navigator.clipboard.writeText(teamsMessage)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  const addReasonDraft = () => {
    const minutes = Number(reasonMinutes)
    if (!reasonText.trim() || !Number.isFinite(minutes) || minutes <= 0) return
    const entry: ReasonEntry = {
      text: reasonText.trim(),
      minutes: Math.round(minutes),
    }
    const nextReasons = [...reasonDrafts, entry]
    const baseEnd = changeBaseEnd ?? end
    if (!changeBaseEnd) {
      setPreviousEnd(end)
      setPreviousChangedAt(new Date())
      setChangeBaseEnd(end)
    }
    setReasonDrafts(nextReasons)
    setPreviousReasons(nextReasons)
    setEnd(addWorkMinutes(baseEnd, nextReasons.reduce((sum, reason) => sum + reason.minutes, 0)))
    setReasonText('')
    setReasonMinutes('')
  }

  const removeReasonDraft = (index: number) => {
    const nextReasons = reasonDrafts.filter((_, i) => i !== index)
    setReasonDrafts(nextReasons)
    setPreviousReasons(nextReasons)
    if (changeBaseEnd) {
      setEnd(addWorkMinutes(changeBaseEnd, nextReasons.reduce((sum, reason) => sum + reason.minutes, 0)))
    }
  }

  return (
    <div className="app">
      <div className="main">
        <div className="block">
          <div className="label">Previous deadline</div>
          <div className="previous">{previousEnd ? fmtDateTime(previousEnd) : '—'}</div>
        </div>

        <div className="block">
          <div className="label">Deadline</div>
          <div className="end">{fmtDateTime(end)}</div>
        </div>

        <div className="block">
          <div className="label">Remaining (work time)</div>
          <div className="remaining">
            {parts.days > 0 && `${parts.days}d `}
            {parts.hours}h {parts.minutes}m {parts.seconds}s
          </div>
        </div>
        {showEarlyFinishReminder && (
          <div className="reminder">Reminder: ask for more work before 9:00 AM.</div>
        )}
        {showTeamsReminder && <div className="reminder">Reminder: post the Teams update.</div>}
        {!isInWorkTime(now) && <div className="overdue">Counting from {fmtTime(workStartAt)}.</div>}
      </div>

      <div className="controls">
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
            Set deadline <span className="icon">🗓️</span>
          </button>
        </span>

        <button onClick={reset} className="resetButton" aria-label="Reset deadline to now">
          Reset
        </button>
      </div>

      <div className="message">
        <div className="label">Add time by reason</div>
        <div className="messageFields">
          <input
            type="text"
            value={messageTask}
            onChange={(e) => setMessageTask(e.target.value)}
            placeholder="Task (optional)"
            aria-label="Task name"
          />
          <input
            type="text"
            value={messageAssignee}
            onChange={(e) => setMessageAssignee(e.target.value)}
            placeholder="Confirm by (optional)"
            aria-label="Confirm by"
          />
        </div>

        <div className="reasonFields">
          <input
            type="text"
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder="Reason"
            aria-label="Reason"
          />
          <input
            type="number"
            min="1"
            value={reasonMinutes}
            onChange={(e) => setReasonMinutes(e.target.value)}
            placeholder="Minutes"
            aria-label="Minutes"
          />
          <button onClick={addReasonDraft} disabled={!reasonText.trim() || !reasonMinutes}>
            Add reason
          </button>
        </div>

        {reasonDrafts.length > 0 && (
          <div className="reasonList">
            {reasonDrafts.map((reason, index) => (
              <div key={`${reason.text}-${index}`} className="reasonRow">
                <span>{reason.text}</span>
                <span>{reason.minutes}分</span>
                <button onClick={() => removeReasonDraft(index)} aria-label="Remove reason">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="messagePreview" aria-label="Teams message preview">
          {teamsMessage || 'Add time to generate a Teams message preview.'}
        </div>

        <div className="messageActions">
          <button onClick={onCopyTeamsMessage} disabled={!previousEnd}>
            Copy Teams message
          </button>
          {copyStatus === 'copied' && <span className="copyStatus">Copied.</span>}
          {copyStatus === 'failed' && (
            <span className="copyStatus">Copy failed. Please copy manually.</span>
          )}
        </div>
      </div>
    </div>
  )
}
