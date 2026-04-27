export type CefrLevel = 'A0' | 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'
export type PartOfSpeech = 'noun' | 'verb' | 'adjective' | 'adverb' | 'phrase'
export type WordStatus = 'new' | 'learning' | 'review' | 'mastered'

export interface Profile {
  id: string
  username: string
  cefr_level: CefrLevel
  streak_count: number
  streak_last_date: string | null
  created_at: string
}

export interface Word {
  id: number
  english: string
  turkish: string
  cefr_level: CefrLevel
  part_of_speech: PartOfSpeech
  example_sentence: string | null
  audio_url: string | null
}

export interface UserWord {
  id: number
  user_id: string
  word_id: number
  status: WordStatus
  ease_factor: number
  interval_days: number
  next_review_date: string
  correct_count: number
  incorrect_count: number
  last_reviewed_at: string | null
  word?: Word
}

export interface DailySession {
  id: number
  user_id: string
  session_date: string
  words_learned: number
  words_reviewed: number
  completed: boolean
}
