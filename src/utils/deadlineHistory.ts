import { pad2 } from './time'

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六']

export function formatTeamsDate(d: Date) {
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekday = WEEKDAY_CN[d.getDay()]
  const hours = pad2(d.getHours())
  const minutes = pad2(d.getMinutes())
  return `${month}/${day}（${weekday}）${hours}:${minutes}`
}

export type ReasonEntry = {
  text: string
  minutes: number
}

type TeamsMessageOptions = {
  previous: Date
  next: Date
  reasons?: ReasonEntry[]
  task?: string
  assignee?: string
}

function formatReasonLine(reason: ReasonEntry) {
  const trimmed = reason.text.trim()
  if (!trimmed) return ''
  return `${trimmed} ${formatDuration(reason.minutes)}`
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  if (hours > 0 && minutes > 0) return `${hours}時${minutes}分`
  if (hours > 0) return `${hours}時`
  return `${minutes}分`
}

export function formatTeamsMessage({ previous, next, reasons, task, assignee }: TeamsMessageOptions) {
  const sanitizedReasons =
    reasons?.filter((reason) => reason.text.trim().length > 0 && reason.minutes > 0) ?? []
  const totalMinutes = sanitizedReasons.reduce((sum, reason) => sum + reason.minutes, 0)
  const reasonLines = sanitizedReasons.map(formatReasonLine).filter((line) => line.length > 0).join('\n')
  const prefix =
    reasonLines.length > 0
      ? `今日做其他事時間是 ${formatDuration(totalMinutes)}\n\n${reasonLines}\n\n`
      : ''
  const action = next.getTime() < previous.getTime() ? '提前至' : '延後至'
  const taskPrefix = task?.trim() ? `${task.trim()}，` : ''
  const assigneeText = assignee?.trim() ? `，請${assignee.trim()}幫我確認` : ''

  return (
    prefix +
    `${taskPrefix}deadline由${formatTeamsDate(previous)}，${action}${formatTeamsDate(next)}${assigneeText}，謝謝。`
  )
}
