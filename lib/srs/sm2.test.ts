import { describe, it, expect } from 'vitest'
import { calculateNextReview } from './sm2'

describe('SM-2 algorithm', () => {
  it('ilk doğru cevap — interval 1 gün, ease_factor değişmez', () => {
    const result = calculateNextReview({
      ease_factor: 2.5,
      interval_days: 1,
      correct_count: 0,
      quality: 4,
    })
    expect(result.interval_days).toBe(1)
    expect(result.ease_factor).toBeCloseTo(2.5)
  })

  it('ikinci doğru cevap — interval 6 güne çıkar', () => {
    const result = calculateNextReview({
      ease_factor: 2.5,
      interval_days: 1,
      correct_count: 1,
      quality: 4,
    })
    expect(result.interval_days).toBe(6)
  })

  it('üçüncü+ doğru cevap — interval ease_factor ile çarpılır', () => {
    const result = calculateNextReview({
      ease_factor: 2.5,
      interval_days: 6,
      correct_count: 2,
      quality: 4,
    })
    expect(result.interval_days).toBe(15)
  })

  it('yanlış cevap — interval 1e sıfırlanır', () => {
    const result = calculateNextReview({
      ease_factor: 2.5,
      interval_days: 15,
      correct_count: 5,
      quality: 1,
    })
    expect(result.interval_days).toBe(1)
  })

  it('ease_factor 1.3 altına düşmez', () => {
    const result = calculateNextReview({
      ease_factor: 1.4,
      interval_days: 3,
      correct_count: 1,
      quality: 0,
    })
    expect(result.ease_factor).toBeGreaterThanOrEqual(1.3)
  })

  it('kaliteli cevap (5) ease_factor yükseltir', () => {
    const result = calculateNextReview({
      ease_factor: 2.5,
      interval_days: 1,
      correct_count: 1,
      quality: 5,
    })
    expect(result.ease_factor).toBeGreaterThan(2.5)
  })

  it('next_review_date bugünden itibaren interval_days sonra', () => {
    const result = calculateNextReview({
      ease_factor: 2.5,
      interval_days: 1,
      correct_count: 1,
      quality: 4,
    })
    const expected = new Date()
    expected.setDate(expected.getDate() + 6)
    expect(result.next_review_date).toBe(expected.toISOString().split('T')[0])
  })
})
