import { pad2 } from './time'

const WEEKDAY_CN = ['日', '一', '二', '三', '四', '五', '六']

export type StatusMessageOptions = {
  completedTask: string
  nextTask: string
  nextTaskCount?: number
  assignee: string
  start: Date
  deadline: Date
}

export function formatStatusDate(d: Date) {
  const month = d.getMonth() + 1
  const day = d.getDate()
  const weekday = WEEKDAY_CN[d.getDay()]
  const hours = pad2(d.getHours())
  const minutes = pad2(d.getMinutes())
  return `${month}/${day} (${weekday}) ${hours}:${minutes}`
}

function formatNextTask(nextTask: string, count?: number) {
  const trimmed = nextTask.trim()
  if (!trimmed) return ''

  const countText = Number.isFinite(count) && (count as number) > 0 ? `${count}集` : ''
  return `${countText}${trimmed}`
}

export function formatStatusMessage(options: StatusMessageOptions) {
  const completedTask = options.completedTask.trim()
  const nextTask = formatNextTask(options.nextTask, options.nextTaskCount)
  const assignee = options.assignee.trim()

  if (!completedTask || !nextTask || !assignee) return ''

  return (
    `已完成${completedTask}，接下來會開始翻譯${nextTask}，` +
    `再麻煩${assignee}便時幫忙設deadline，` +
    `從${formatStatusDate(options.start)}起算，deadline為${formatStatusDate(options.deadline)}，謝謝。`
  )
}
