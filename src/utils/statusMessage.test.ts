import { describe, expect, it } from 'vitest'

import { formatStatusMessage } from './statusMessage'

describe('formatStatusMessage', () => {
  it('formats a full status message with count and metadata', () => {
    const start = new Date(2026, 0, 13, 16, 10)
    const deadline = new Date(2026, 0, 16, 9, 10)
    const message = formatStatusMessage({
      completedAssignment: '"三"人文講堂',
      nextAssignment: '仁心慧語 (呂紹睿)',
      nextTaskCount: 6,
      assignee: 'Emily Ding',
      start,
      deadline,
    })

    expect(message).toBe(
      '已完成"三"人文講堂，接下來會開始翻譯6集仁心慧語 (呂紹睿)，再麻煩Emily Ding便時幫忙設deadline，從1/13 (二) 16:10起算，deadline為1/16 (五) 09:10，謝謝。'
    )
  })

  it('formats without count or metadata', () => {
    const start = new Date(2026, 0, 13, 10, 5)
    const deadline = new Date(2026, 0, 14, 9, 0)
    const message = formatStatusMessage({
      completedAssignment: '人文講堂',
      nextAssignment: '仁心慧語',
      assignee: 'Alex',
      start,
      deadline,
    })

    expect(message).toBe(
      '已完成人文講堂，接下來會開始翻譯仁心慧語，再麻煩Alex便時幫忙設deadline，從1/13 (二) 10:05起算，deadline為1/14 (三) 09:00，謝謝。'
    )
  })
})
