import { formatTeamsDate } from './deadlineHistory'

export type StatusMessageOptions = {
  completedAssignment: string
  nextAssignment: string
  nextTaskCount?: number
  assignee: string
  start: Date
  deadline: Date
}

function formatNextAssignment(nextAssignment: string, count?: number) {
  const trimmed = nextAssignment.trim()
  if (!trimmed) return ''

  const countText = Number.isFinite(count) && (count as number) > 0 ? `${count}集` : ''
  return `${countText}${trimmed}`
}

export function formatStatusMessage(options: StatusMessageOptions) {
  const completedAssignment = options.completedAssignment.trim()
  const nextAssignment = formatNextAssignment(options.nextAssignment, options.nextTaskCount)
  const assignee = options.assignee.trim()

  if (!completedAssignment || !nextAssignment || !assignee) return ''

  return (
    `已完成${completedAssignment}，接下來會開始翻譯${nextAssignment}，` +
    `再麻煩${assignee}便時幫忙設deadline，` +
    `從${formatTeamsDate(options.start)}起算，deadline為${formatTeamsDate(options.deadline)}，謝謝。`
  )
}
