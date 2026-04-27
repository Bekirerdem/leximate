import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Flame, Star, BookOpen, Trophy, TrendingUp, LogOut, Swords } from 'lucide-react'

const LEVEL_ORDER = ['A0', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const LEARNED_TO_LEVEL_UP: Record<string, number> = {
  A0: 100, A1: 250, A2: 380, B1: 470, B2: 560, C1: 240,
}

const LEVEL_COLORS: Record<string, string> = {
  A0: 'bg-slate-500', A1: 'bg-emerald-500', A2: 'bg-blue-500',
  B1: 'bg-indigo-500', B2: 'bg-purple-500', C1: 'bg-pink-500', C2: 'bg-rose-500',
}

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const [
    { count: totalWords },
    { count: masteredWords },
    { count: learningWords },
    { data: recentSessions },
    { data: duelRooms },
    { count: learnedAtCurrentLevel },
  ] = await Promise.all([
    supabase.from('user_words').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).neq('status', 'new'),
    supabase.from('user_words').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'mastered'),
    supabase.from('user_words').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('status', 'learning'),
    supabase.from('daily_sessions').select('*')
      .eq('user_id', user.id).order('session_date', { ascending: false }).limit(7),
    supabase.from('duel_rooms').select('challenger_id, opponent_id, challenger_score, opponent_score, status')
      .or(`challenger_id.eq.${user.id},opponent_id.eq.${user.id}`)
      .eq('status', 'completed'),
    supabase.from('user_words')
      .select('*, words!inner(cefr_level)', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .neq('status', 'new')
      .eq('words.cefr_level', profile?.cefr_level ?? 'A1'),
  ])

  const duelTotal = duelRooms?.length ?? 0
  const duelWins = duelRooms?.filter(r => {
    const isChallenger = r.challenger_id === user.id
    const myScore = isChallenger ? r.challenger_score : r.opponent_score
    const opScore = isChallenger ? r.opponent_score : r.challenger_score
    return myScore > opScore
  }).length ?? 0
  const duelWinRate = duelTotal > 0 ? Math.round((duelWins / duelTotal) * 100) : 0

  const currentLevel = profile?.cefr_level ?? 'A1'
  const currentLevelIdx = LEVEL_ORDER.indexOf(currentLevel)
  const nextLevel = currentLevelIdx < LEVEL_ORDER.length - 1 ? LEVEL_ORDER[currentLevelIdx + 1] : null
  const threshold = LEARNED_TO_LEVEL_UP[currentLevel] ?? 50
  const learnedCount = learnedAtCurrentLevel ?? 0
  const progressToNext = Math.min(learnedCount / threshold * 100, 100)
  const totalLearned = (totalWords ?? 0)

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
            {profile?.username?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{profile?.username}</h1>
            <p className="text-blue-200 text-sm">{user.email}</p>
          </div>
          <form action="/auth/signout" method="POST">
            <button type="submit" className="text-white/60 hover:text-white transition-colors">
              <LogOut size={18} />
            </button>
          </form>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${LEVEL_COLORS[currentLevel] ?? 'bg-white/20'}`}>
            {currentLevel}
          </span>
          <span className="text-white/80 text-sm font-medium">Seviye</span>
          {nextLevel && (
            <span className="ml-auto text-blue-200 text-xs">{nextLevel} için {Math.max(0, threshold - learnedCount)} kelime</span>
          )}
        </div>

        {nextLevel && (
          <div className="mt-2 h-2 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all"
              style={{ width: `${progressToNext}%` }}
            />
          </div>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Flame size={18} className="text-orange-500" />
            <span className="text-xs text-slate-500 font-medium">Gün Serisi</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{profile?.streak_count ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <BookOpen size={18} className="text-blue-500" />
            <span className="text-xs text-slate-500 font-medium">Öğrenilen</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{totalLearned}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <Trophy size={18} className="text-emerald-500" />
            <span className="text-xs text-slate-500 font-medium">Ezberlenen</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{masteredWords ?? 0}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={18} className="text-indigo-500" />
            <span className="text-xs text-slate-500 font-medium">Öğreniliyor</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{learningWords ?? 0}</p>
        </div>
      </div>

      {/* Duel stats */}
      {duelTotal > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Swords size={16} className="text-indigo-500" />
            <h2 className="text-sm font-bold text-slate-700">Düello İstatistikleri</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div>
              <p className="text-2xl font-bold text-slate-900">{duelTotal}</p>
              <p className="text-xs text-slate-500 mt-0.5">Toplam</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600">{duelWins}</p>
              <p className="text-xs text-slate-500 mt-0.5">Galibiyet</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-indigo-600">{duelWinRate}%</p>
              <p className="text-xs text-slate-500 mt-0.5">Kazanma Oranı</p>
            </div>
          </div>
        </div>
      )}

      {/* Last 7 days */}
      {recentSessions && recentSessions.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Star size={16} className="text-amber-500" />
            <h2 className="text-sm font-bold text-slate-700">Son 7 Gün</h2>
          </div>
          <div className="space-y-2">
            {recentSessions.map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  {new Date(s.session_date).toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-slate-400">{s.words_learned} yeni · {s.words_reviewed} tekrar</span>
                  {s.completed && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Change level link */}
      <a
        href="/onboarding"
        className="block w-full text-center py-3.5 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 text-sm font-medium hover:border-blue-300 hover:text-blue-500 transition-colors"
      >
        Seviyeni Değiştir →
      </a>
    </div>
  )
}
