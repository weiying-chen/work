import { describe, expect, it } from 'vitest'

import { minutesFromTimeParts } from './taskTime'

describe('minutesFromTimeParts', () => {
  it('returns null when both fields are empty', () => {
    expect(minutesFromTimeParts('', '')).toBeNull()
  })

  it('returns null for invalid values', () => {
    expect(minutesFromTimeParts('nope', '10')).toBeNull()
    expect(minutesFromTimeParts('1', 'nope')).toBeNull()
    expect(minutesFromTimeParts('-1', '0')).toBeNull()
  })

  it('handles minutes only', () => {
    expect(minutesFromTimeParts('', '30')).toBe(30)
  })

  it('handles hours only', () => {
    expect(minutesFromTimeParts('1', '')).toBe(60)
  })

  it('handles hours and minutes', () => {
    expect(minutesFromTimeParts('1', '30')).toBe(90)
  })

  it('handles decimal hours', () => {
    expect(minutesFromTimeParts('1.5', '')).toBe(90)
  })
})
