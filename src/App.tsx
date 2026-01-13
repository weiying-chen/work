import { useEffect, useMemo, useRef, useState } from 'react'

import { formatDuration, formatTeamsMessage, type TaskEntry } from './utils/deadlineHistory'
import { formatStatusMessage } from './utils/statusMessage'
import {
  fmtDateTime,
  fmtTime,
  msToParts,
  pad2,
  parseDatetimeLocalValue,
  toDatetimeLocalValue,
} from './utils/time'
import { minutesFromTimeParts } from './utils/taskTime'
import {
  addWorkMinutes,
  isInWorkTime,
  nextWorkStart,
  shouldShowEarlyFinishReminder,
  shouldShowTeamsReminder,
  workMsBetween,
} from './utils/workTime'

type PickerInput = HTMLInputElement

const LS_DEADLINE_KEY = 'aliveline:deadline-iso'
const LS_PREV_DEADLINE_KEY = 'aliveline:previous-deadline-iso'
const LS_PREV_CHANGED_KEY = 'aliveline:previous-deadline-changed-iso'
const LS_PREV_TASKS_KEY = 'aliveline:previous-tasks'
const LS_TASKS_KEY = 'aliveline:tasks'
const LS_CHANGE_BASE_KEY = 'aliveline:change-base-deadline-iso'
const LS_MESSAGE_TASK_KEY = 'aliveline:message-task'
const LS_MESSAGE_ASSIGNEE_KEY = 'aliveline:message-assignee'
const LS_STATUS_COMPLETED_TASK_KEY = 'aliveline:status-completed-task'
const LS_STATUS_NEXT_TASK_KEY = 'aliveline:status-next-task'
const LS_STATUS_NEXT_COUNT_KEY = 'aliveline:status-next-count'
const LS_STATUS_ASSIGNEE_KEY = 'aliveline:status-assignee'
const LS_STATUS_START_KEY = 'aliveline:status-start-iso'
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

function readStoredEntries(key: string) {
  const saved = localStorage.getItem(key)
  if (!saved) return [] as TaskEntry[]
  try {
    const parsed = JSON.parse(saved) as TaskEntry[]
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
  const [previousTasks, setPreviousTasks] = useState<TaskEntry[]>(() =>
    readStoredEntries(LS_PREV_TASKS_KEY)
  )
  const [tasks, setTasks] = useState<TaskEntry[]>(() =>
    readStoredEntries(LS_TASKS_KEY)
  )
  const [changeBaseDeadline, setChangeBaseDeadline] = useState<Date | null>(() =>
    readStoredDate(LS_CHANGE_BASE_KEY)
  )
  const [taskText, setTaskText] = useState('')
  const [taskHours, setTaskHours] = useState('')
  const [taskMinutes, setTaskMinutes] = useState('')
  const [messageTask, setMessageTask] = useState(() => localStorage.getItem(LS_MESSAGE_TASK_KEY) ?? '')
  const [messageAssignee, setMessageAssignee] = useState(
    () => localStorage.getItem(LS_MESSAGE_ASSIGNEE_KEY) ?? ''
  )
  const [statusCompletedTask, setStatusCompletedTask] = useState(
    () => localStorage.getItem(LS_STATUS_COMPLETED_TASK_KEY) ?? ''
  )
  const [statusNextTask, setStatusNextTask] = useState(
    () => localStorage.getItem(LS_STATUS_NEXT_TASK_KEY) ?? ''
  )
  const [statusNextCount, setStatusNextCount] = useState(
    () => localStorage.getItem(LS_STATUS_NEXT_COUNT_KEY) ?? ''
  )
  const [statusAssignee, setStatusAssignee] = useState(
    () => localStorage.getItem(LS_STATUS_ASSIGNEE_KEY) ?? ''
  )
  const [statusStartAt, setStatusStartAt] = useState<Date | null>(
    () => readStoredDate(LS_STATUS_START_KEY)
  )
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')
  const [statusCopyStatus, setStatusCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

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
    localStorage.setItem(LS_PREV_TASKS_KEY, JSON.stringify(previousTasks))
  }, [previousTasks])

  useEffect(() => {
    localStorage.setItem(LS_TASKS_KEY, JSON.stringify(tasks))
  }, [tasks])

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
    setTasks([])
    setTaskText('')
    setTaskHours('')
    setTaskMinutes('')
    setChangeBaseDeadline(null)
    setPreviousTasks([])
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

  useEffect(() => {
    localStorage.setItem(LS_STATUS_COMPLETED_TASK_KEY, statusCompletedTask)
  }, [statusCompletedTask])

  useEffect(() => {
    localStorage.setItem(LS_STATUS_NEXT_TASK_KEY, statusNextTask)
  }, [statusNextTask])

  useEffect(() => {
    localStorage.setItem(LS_STATUS_NEXT_COUNT_KEY, statusNextCount)
  }, [statusNextCount])

  useEffect(() => {
    localStorage.setItem(LS_STATUS_ASSIGNEE_KEY, statusAssignee)
  }, [statusAssignee])

  useEffect(() => {
    if (statusStartAt) {
      localStorage.setItem(LS_STATUS_START_KEY, statusStartAt.toISOString())
    } else {
      localStorage.removeItem(LS_STATUS_START_KEY)
    }
  }, [statusStartAt])

  const updateDeadline = (
    nextDeadline: Date,
    options?: { tasks?: TaskEntry[]; resetDrafts?: boolean }
  ) => {
    if (nextDeadline.getTime() === deadline.getTime()) return
    setPreviousDeadline(deadline)
    setPreviousChangedAt(new Date())
    setPreviousTasks(options?.tasks ?? [])
    setDeadline(nextDeadline)
    if (options?.resetDrafts) {
      setTasks([])
      setChangeBaseDeadline(null)
    }
  }

  const onSetDeadline = (v: string) => {
    const d = parseDatetimeLocalValue(v)
    if (d) updateDeadline(d, { resetDrafts: true })
  }

  const reset = () => {
    updateDeadline(new Date(), { resetDrafts: true })
  }

  const teamsMessage = useMemo(() => {
    if (!previousDeadline) return ''
    return formatTeamsMessage({
      previous: previousDeadline,
      next: deadline,
      tasks: tasks.length > 0 ? tasks : previousTasks,
      task: messageTask,
      assignee: messageAssignee,
    })
  }, [deadline, messageAssignee, messageTask, previousDeadline, previousTasks, tasks])

  useEffect(() => {
    setCopyStatus('idle')
  }, [teamsMessage])

  const statusMessage = useMemo(() => {
    if (!statusStartAt) return ''
    const parsedCount = statusNextCount.trim() ? Number(statusNextCount) : undefined
    const count = Number.isFinite(parsedCount) ? parsedCount : undefined
    return formatStatusMessage({
      completedTask: statusCompletedTask,
      nextTask: statusNextTask,
      nextTaskCount: count,
      assignee: statusAssignee,
      start: statusStartAt,
      deadline,
    })
  }, [
    deadline,
    statusAssignee,
    statusCompletedTask,
    statusNextCount,
    statusNextTask,
    statusStartAt,
  ])

  useEffect(() => {
    setStatusCopyStatus('idle')
  }, [statusMessage])

  const onCopyTeamsMessage = async () => {
    if (!teamsMessage) return
    try {
      await navigator.clipboard.writeText(teamsMessage)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  const onCopyStatusMessage = async () => {
    if (!statusMessage) return
    try {
      await navigator.clipboard.writeText(statusMessage)
      setStatusCopyStatus('copied')
    } catch {
      setStatusCopyStatus('failed')
    }
  }

  const addTaskEntry = () => {
    const minutes = minutesFromTimeParts(taskHours, taskMinutes)
    if (!taskText.trim() || minutes === null) return
    const entry: TaskEntry = {
      text: taskText.trim(),
      minutes: Math.round(minutes),
    }
    const nextTasks = [...tasks, entry]
    const baseDeadline = changeBaseDeadline ?? deadline
    if (!changeBaseDeadline) {
      setPreviousDeadline(deadline)
      setPreviousChangedAt(new Date())
      setChangeBaseDeadline(deadline)
    }
    setTasks(nextTasks)
    setPreviousTasks(nextTasks)
    setDeadline(addWorkMinutes(baseDeadline, nextTasks.reduce((sum, item) => sum + item.minutes, 0)))
    setTaskText('')
    setTaskHours('')
    setTaskMinutes('')
  }

  const removeTaskEntry = (index: number) => {
    const nextTasks = tasks.filter((_, i) => i !== index)
    setTasks(nextTasks)
    setPreviousTasks(nextTasks)
    if (changeBaseDeadline) {
      setDeadline(
        addWorkMinutes(changeBaseDeadline, nextTasks.reduce((sum, item) => sum + item.minutes, 0))
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
        <input
          ref={deadlineRef}
          className="deadlineInput"
          type="datetime-local"
          value={toDatetimeLocalValue(deadline)}
          onChange={(e) => onSetDeadline(e.target.value)}
          aria-label="Deadline time"
        />

        <button onClick={reset} className="resetButton" aria-label="Reset deadline to now">
          Reset
        </button>
      </div>

      <div className="message">
        <div className="label">Add task time</div>
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

        <div className="taskFields">
          <input
            type="text"
            value={taskText}
            onChange={(e) => setTaskText(e.target.value)}
            placeholder="Task"
            aria-label="Task"
          />
          <input
            type="number"
            min="0"
            value={taskHours}
            onChange={(e) => setTaskHours(e.target.value)}
            placeholder="Hours"
            aria-label="Hours"
          />
          <input
            type="number"
            min="0"
            value={taskMinutes}
            onChange={(e) => setTaskMinutes(e.target.value)}
            placeholder="Minutes"
            aria-label="Minutes"
          />
          <button
            onClick={addTaskEntry}
            disabled={!taskText.trim() || minutesFromTimeParts(taskHours, taskMinutes) === null}
          >
            Add task
          </button>
        </div>

        {tasks.length > 0 && (
          <div className="taskList">
            {tasks.map((entry, index) => (
              <div key={`${entry.text}-${index}`} className="taskRow">
                <span>{entry.text}</span>
                <span>{formatDuration(entry.minutes)}</span>
                <button onClick={() => removeTaskEntry(index)} aria-label="Remove task">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="messagePreview" aria-label="Teams message preview">
          {teamsMessage || 'Add tasks to generate a Teams message preview.'}
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

      <div className="message">
        <div className="label">Status + next deadline</div>
        <div className="statusFields">
          <input
            type="text"
            value={statusCompletedTask}
            onChange={(e) => setStatusCompletedTask(e.target.value)}
            placeholder="Completed task (short)"
            aria-label="Completed task"
          />
          <input
            type="text"
            value={statusNextTask}
            onChange={(e) => setStatusNextTask(e.target.value)}
            placeholder="Next task"
            aria-label="Next task"
          />
          <input
            type="number"
            min="0"
            value={statusNextCount}
            onChange={(e) => setStatusNextCount(e.target.value)}
            placeholder="Count (optional)"
            aria-label="Next task count"
          />
          <input
            type="text"
            value={statusAssignee}
            onChange={(e) => setStatusAssignee(e.target.value)}
            placeholder="Confirm by"
            aria-label="Status confirm by"
          />
          <input
            type="datetime-local"
            value={statusStartAt ? toDatetimeLocalValue(statusStartAt) : ''}
            onChange={(e) => setStatusStartAt(parseDatetimeLocalValue(e.target.value))}
            className="statusStartAt"
            aria-label="Start time"
          />
        </div>

        <div className="messagePreview" aria-label="Status message preview">
          {statusMessage || 'Fill fields to generate a status message.'}
        </div>

        <div className="messageActions">
          <button onClick={onCopyStatusMessage} disabled={!statusMessage}>
            Copy status message
          </button>
          {statusCopyStatus === 'copied' && <span className="copyStatus">Copied.</span>}
          {statusCopyStatus === 'failed' && (
            <span className="copyStatus">Copy failed. Please copy manually.</span>
          )}
        </div>
      </div>
    </div>
  )
}
