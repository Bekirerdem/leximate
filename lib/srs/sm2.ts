interface SM2Input {
  ease_factor: number
  interval_days: number
  correct_count: number
  quality: number
}

interface SM2Output {
  ease_factor: number
  interval_days: number
  next_review_date: string
  status: 'learning' | 'review' | 'mastered'
}

export function calculateNextReview(input: SM2Input): SM2Output {
  const { ease_factor, interval_days, correct_count, quality } = input

  const isCorrect = quality >= 3

  let newInterval: number
  let newEaseFactor: number

  if (!isCorrect) {
    newInterval = 1
    newEaseFactor = Math.max(1.3, ease_factor - 0.2)
  } else {
    newEaseFactor = Math.max(
      1.3,
      ease_factor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
    )

    if (correct_count === 0) {
      newInterval = 1
    } else if (correct_count === 1) {
      newInterval = 6
    } else {
      newInterval = Math.round(interval_days * ease_factor)
    }
  }

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + newInterval)
  const next_review_date = nextDate.toISOString().split('T')[0]

  const status = newInterval >= 21 ? 'mastered' : newInterval >= 3 ? 'review' : 'learning'

  return { ease_factor: newEaseFactor, interval_days: newInterval, next_review_date, status }
}
