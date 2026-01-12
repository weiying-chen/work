import { describe, expect, it } from 'vitest'

import {
  addWorkMinutes,
  isInWorkTime,
  nextWorkStart,
  shouldShowEarlyFinishReminder,
  shouldShowTeamsReminder,
  workMsBetween,
} from './workTime'

function at(h: number, m: number) {
  return new Date(2025, 0, 2, h, m, 0, 0)
}

describe('work time schedule', () => {
  it('counts time across midday', () => {
    const start = at(11, 30)
    const end = at(13, 30)
    const ms = workMsBetween(start, end)
    expect(ms).toBe(120 * 60000)
  })

  it('counts only the remaining time in the day block', () => {
    const start = at(11, 30)
    const end = at(12, 30)
    const ms = workMsBetween(start, end)
    expect(ms).toBe(60 * 60000)
  })

  it('recognizes work time inside blocks', () => {
    expect(isInWorkTime(at(8, 15))).toBe(false)
    expect(isInWorkTime(at(9, 0))).toBe(true)
    expect(isInWorkTime(at(12, 30))).toBe(true)
    expect(isInWorkTime(at(17, 15))).toBe(true)
    expect(isInWorkTime(at(17, 30))).toBe(false)
  })
})

describe('addWorkMinutes', () => {
  it('starts counting at the next work block when before hours', () => {
    const start = at(7, 0)
    const end = addWorkMinutes(start, 60)
    expect(end.getHours()).toBe(9)
    expect(end.getMinutes()).toBe(30)
  })

  it('rolls into the next day after 17:30', () => {
    const start = at(16, 30)
    const end = addWorkMinutes(start, 120)
    expect(end.getDate()).toBe(3)
    expect(end.getHours()).toBe(9)
    expect(end.getMinutes()).toBe(30)
  })
})

describe('nextWorkStart', () => {
  it('returns the next work block start after hours', () => {
    const start = at(18, 0)
    const next = nextWorkStart(start)
    expect(next.getDate()).toBe(3)
    expect(next.getHours()).toBe(8)
    expect(next.getMinutes()).toBe(30)
  })

  it('returns now during work time', () => {
    const start = at(10, 15)
    const next = nextWorkStart(start)
    expect(next.getHours()).toBe(10)
    expect(next.getMinutes()).toBe(15)
  })
})

describe('shouldShowEarlyFinishReminder', () => {
  it('shows between 8:30 and 9:00 when deadline ends by 17:30', () => {
    const now = at(8, 35)
    const end = at(17, 0)
    expect(shouldShowEarlyFinishReminder(now, end)).toBe(true)
  })

  it('does not show before 8:30', () => {
    const now = at(8, 15)
    const end = at(17, 0)
    expect(shouldShowEarlyFinishReminder(now, end)).toBe(false)
  })

  it('does not show after 9:00', () => {
    const now = at(9, 1)
    const end = at(17, 0)
    expect(shouldShowEarlyFinishReminder(now, end)).toBe(false)
  })

  it('does not show when deadline is after 17:30', () => {
    const now = at(8, 40)
    const end = at(17, 45)
    expect(shouldShowEarlyFinishReminder(now, end)).toBe(false)
  })

  it('does not show when deadline is exactly 17:30', () => {
    const now = at(8, 40)
    const end = at(17, 30)
    expect(shouldShowEarlyFinishReminder(now, end)).toBe(false)
  })

  it('does not show when deadline is on another day', () => {
    const now = at(8, 40)
    const end = at(8, 40)
    end.setDate(end.getDate() + 1)
    expect(shouldShowEarlyFinishReminder(now, end)).toBe(false)
  })
})

describe('shouldShowTeamsReminder', () => {
  it('shows at 5:00 when the deadline spills past 17:30', () => {
    const now = at(17, 2)
    const end = at(18, 0)
    expect(shouldShowTeamsReminder(now, end)).toBe(true)
  })

  it('shows at 5:00 when the deadline is exactly 17:30', () => {
    const now = at(17, 5)
    const end = at(17, 30)
    expect(shouldShowTeamsReminder(now, end)).toBe(true)
  })

  it('shows at 5:00 when the deadline is on a later day', () => {
    const now = at(17, 3)
    const end = at(9, 0)
    end.setDate(end.getDate() + 1)
    expect(shouldShowTeamsReminder(now, end)).toBe(true)
  })

  it('shows one hour before a same-day deadline ending by 17:30', () => {
    const now = at(15, 10)
    const end = at(16, 5)
    expect(shouldShowTeamsReminder(now, end)).toBe(true)
  })

  it('does not show outside the reminder window', () => {
    const now = at(14, 30)
    const end = at(16, 5)
    expect(shouldShowTeamsReminder(now, end)).toBe(false)
  })

  it('does not show after a same-day deadline passes', () => {
    const now = at(16, 6)
    const end = at(16, 5)
    expect(shouldShowTeamsReminder(now, end)).toBe(false)
  })

  it('does not show after the 17:30 reminder window', () => {
    const now = at(17, 31)
    const end = at(18, 0)
    expect(shouldShowTeamsReminder(now, end)).toBe(false)
  })
})
