import { describe, expect, it } from 'vitest'

import {
  addWorkMinutes,
  isInWorkTime,
  nextWorkStart,
  shouldShowEarlyFinishReminder,
  workMsBetween,
} from './workTime'

function at(h: number, m: number) {
  return new Date(2025, 0, 2, h, m, 0, 0)
}

describe('work time schedule', () => {
  it('treats 12:00–13:00 as break time', () => {
    const start = at(11, 30)
    const end = at(13, 30)
    const ms = workMsBetween(start, end)
    expect(ms).toBe(60 * 60000)
  })

  it('counts only the remaining time in the morning block', () => {
    const start = at(11, 30)
    const end = at(12, 30)
    const ms = workMsBetween(start, end)
    expect(ms).toBe(30 * 60000)
  })

  it('recognizes work time inside blocks', () => {
    expect(isInWorkTime(at(9, 0))).toBe(true)
    expect(isInWorkTime(at(12, 30))).toBe(false)
  })
})

describe('addWorkMinutes', () => {
  it('starts counting at the next work block when before hours', () => {
    const start = at(7, 0)
    const end = addWorkMinutes(start, 60)
    expect(end.getHours()).toBe(9)
    expect(end.getMinutes()).toBe(0)
  })

  it('skips the lunch break', () => {
    const start = at(11, 30)
    const end = addWorkMinutes(start, 60)
    expect(end.getHours()).toBe(13)
    expect(end.getMinutes()).toBe(30)
  })

  it('rolls into the next day after 17:00', () => {
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
    expect(next.getMinutes()).toBe(0)
  })

  it('returns the afternoon start during lunch', () => {
    const start = at(12, 15)
    const next = nextWorkStart(start)
    expect(next.getHours()).toBe(13)
    expect(next.getMinutes()).toBe(0)
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

  it('does not show when deadline is on another day', () => {
    const now = at(8, 40)
    const end = at(8, 40)
    end.setDate(end.getDate() + 1)
    expect(shouldShowEarlyFinishReminder(now, end)).toBe(false)
  })
})
