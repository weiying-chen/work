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

const LS_DEADLINE_KEY = 'aliveline:deadline-iso'
const LS_PREV_DEADLINE_KEY = 'aliveline:previous-deadline-iso'
const LS_PREV_CHANGED_KEY = 'aliveline:previous-deadline-changed-iso'
const LS_PREV_REASONS_KEY = 'aliveline:previous-reasons'
const LS_REASON_DRAFT_KEY = 'aliveline:reason-drafts'
const LS_CHANGE_BASE_KEY = 'aliveline:change-base-deadline-iso'
const LS_MESSAGE_TASK_KEY = 'aliveline:message-task'
const LS_MESSAGE_ASSIGNEE_KEY = 'aliveline:message-assignee'
const LS_DAILY_CLEAR_KEY = 'aliveline:daily-clear'
const LS_REMINDER_NOTIFIED_KEY = 'aliveline:reminder-notified'
const LS_REMINDER_REQUESTED_KEY = 'aliveline:reminder-requested'
const LS_TEAMS_REMINDER_NOTIFIED_KEY = 'aliveline:teams-reminder-notified'
const LS_TEAMS_REMINDER_REQUESTED_KEY = 'aliveline:teams-reminder-requested'

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
  const deadlineRef = useRef<PickerInput | null>(null)

  const [now, setNow] = useState(() => new Date())
  const [deadline, setDeadline] = useState(() => readStoredDate(LS_DEADLINE_KEY) ?? new Date())
  const [previousDeadline, setPreviousDeadline] = useState<Date | null>(() =>
    readStoredDate(LS_PREV_DEADLINE_KEY)
  )
  const [previousChangedAt, setPreviousChangedAt] = useState<Date | null>(() =>
    readStoredDate(LS_PREV_CHANGED_KEY)
  )
  const [previousReasons, setPreviousReasons] = useState<ReasonEntry[]>(() =>
    readStoredReasons(LS_PREV_REASONS_KEY)
  )
  const [reasonDrafts, setReasonDrafts] = useState<ReasonEntry[]>(() =>
    readStoredReasons(LS_REASON_DRAFT_KEY)
  )
  const [changeBaseDeadline, setChangeBaseDeadline] = useState<Date | null>(() =>
    readStoredDate(LS_CHANGE_BASE_KEY)
  )
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
    localStorage.setItem(LS_DEADLINE_KEY, deadline.toISOString())
  }, [deadline])

  useEffect(() => {
    if (previousDeadline) {
      localStorage.setItem(LS_PREV_DEADLINE_KEY, previousDeadline.toISOString())
    }
  }, [previousDeadline])

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
    if (changeBaseDeadline) {
      localStorage.setItem(LS_CHANGE_BASE_KEY, changeBaseDeadline.toISOString())
    } else {
      localStorage.removeItem(LS_CHANGE_BASE_KEY)
    }
  }, [changeBaseDeadline])

  useEffect(() => {
    localStorage.setItem(LS_MESSAGE_TASK_KEY, messageTask)
  }, [messageTask])

  useEffect(() => {
    const todayKey = dateKey(now)
    if (localStorage.getItem(LS_DAILY_CLEAR_KEY) === todayKey) return

    const cutoff = new Date(now)
    cutoff.setHours(17, 30, 0, 0)
    if (now.getTime() < cutoff.getTime()) return

    localStorage.setItem(LS_DAILY_CLEAR_KEY, todayKey)
    setReasonDrafts([])
    setReasonText('')
    setReasonMinutes('')
    setChangeBaseDeadline(null)
    setPreviousReasons([])
    setMessageTask('')
    setMessageAssignee('')
  }, [now])

  const workMsLeft = useMemo(() => workMsBetween(now, deadline), [now, deadline])
  const parts = useMemo(() => msToParts(workMsLeft), [workMsLeft])
  const workStartAt = useMemo(() => (isInWorkTime(now) ? now : nextWorkStart(now)), [now])
  const showEarlyFinishReminder = useMemo(
    () => shouldShowEarlyFinishReminder(now, deadline),
    [deadline, now]
  )
  const showTeamsReminder = useMemo(
    () => shouldShowTeamsReminder(now, deadline),
    [deadline, now]
  )

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
  }, [deadline, now, showEarlyFinishReminder])

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
  }, [deadline, now, showTeamsReminder])

  useEffect(() => {
    localStorage.setItem(LS_MESSAGE_ASSIGNEE_KEY, messageAssignee)
  }, [messageAssignee])

  const updateDeadline = (
    nextDeadline: Date,
    options?: { reasons?: ReasonEntry[]; resetDrafts?: boolean }
  ) => {
    if (nextDeadline.getTime() === deadline.getTime()) return
    setPreviousDeadline(deadline)
    setPreviousChangedAt(new Date())
    setPreviousReasons(options?.reasons ?? [])
    setDeadline(nextDeadline)
    if (options?.resetDrafts) {
      setReasonDrafts([])
      setChangeBaseDeadline(null)
    }
  }

  const onSetDeadline = (v: string) => {
    const d = parseDatetimeLocalValue(v)
    if (d) updateDeadline(d, { resetDrafts: true })
  }

  const openPicker = () => {
    const el = deadlineRef.current
    if (!el) return
    el.focus()
    el.showPicker?.()
  }

  const reset = () => {
    updateDeadline(new Date(), { resetDrafts: true })
  }

  const teamsMessage = useMemo(() => {
    if (!previousDeadline) return ''
    return formatTeamsMessage({
      previous: previousDeadline,
      next: deadline,
      reasons: reasonDrafts.length > 0 ? reasonDrafts : previousReasons,
      task: messageTask,
      assignee: messageAssignee,
    })
  }, [deadline, messageAssignee, messageTask, previousDeadline, previousReasons, reasonDrafts])

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
    const baseDeadline = changeBaseDeadline ?? deadline
    if (!changeBaseDeadline) {
      setPreviousDeadline(deadline)
      setPreviousChangedAt(new Date())
      setChangeBaseDeadline(deadline)
    }
    setReasonDrafts(nextReasons)
    setPreviousReasons(nextReasons)
    setDeadline(
      addWorkMinutes(baseDeadline, nextReasons.reduce((sum, reason) => sum + reason.minutes, 0))
    )
    setReasonText('')
    setReasonMinutes('')
  }

  const removeReasonDraft = (index: number) => {
    const nextReasons = reasonDrafts.filter((_, i) => i !== index)
    setReasonDrafts(nextReasons)
    setPreviousReasons(nextReasons)
    if (changeBaseDeadline) {
      setDeadline(
        addWorkMinutes(changeBaseDeadline, nextReasons.reduce((sum, reason) => sum + reason.minutes, 0))
      )
    }
  }

  return (
    <div className="app">
      <div className="main">
        <div className="block">
          <div className="label">Previous deadline</div>
          <div className="previous">{previousDeadline ? fmtDateTime(previousDeadline) : '—'}</div>
        </div>

        <div className="block">
          <div className="label">Deadline</div>
          <div className="deadline">{fmtDateTime(deadline)}</div>
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
        <span className="deadlinePickerWrap">
          <input
            ref={deadlineRef}
            className="deadlineInputGhost"
            type="datetime-local"
            value={toDatetimeLocalValue(deadline)}
            onChange={(e) => onSetDeadline(e.target.value)}
            aria-label="Deadline time"
          />

          <button onClick={openPicker} className="deadlineButton" aria-label="Change deadline time">
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
          <button onClick={onCopyTeamsMessage} disabled={!previousDeadline}>
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
