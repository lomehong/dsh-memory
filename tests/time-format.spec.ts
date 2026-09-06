import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { formatLocal } from '../src/time-format'

describe('formatLocal（ISO-UTC → 查看者本地时区）', () => {
  const prevTz = process.env.TZ
  beforeAll(() => { process.env.TZ = 'UTC' })
  afterAll(() => { process.env.TZ = prevTz })

  it('UTC 时区下仅去掉 T/Z，不改动钟面时间', () => {
    expect(formatLocal('2026-09-05T04:05:06Z')).toBe('2026-09-05 04:05:06')
  })

  it('非 UTC 时区下钟面时间随偏移平移', () => {
    process.env.TZ = 'Asia/Shanghai'
    try {
      expect(formatLocal('2026-09-05T04:05:06Z')).toBe('2026-09-05 12:05:06')
    } finally {
      process.env.TZ = 'UTC'
    }
  })

  it('空值返回空串，非法输入原样返回', () => {
    expect(formatLocal(undefined)).toBe('')
    expect(formatLocal('not-a-date')).toBe('not-a-date')
  })
})
