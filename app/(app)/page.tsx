import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BookOpen, RotateCcw, Zap } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()

  const today = new Date().toISOString().split('T')[0]

  const [
    { data: session },
    { count: totalWords },
    { count: dueToday },
    { count: masteredWords },
  ] = await Promise.all([
    supabase.from('daily_sessions').select('*').eq('user_id', user.id).eq('session_date', today).single(),
    supabase.from('user_words').select('*', { count: 'exact', head: true }).eq('user_id', user.id).neq('status', 'new'),
    supabase.from('user_words').select('*', { count: 'exact', head: true }).eq('user_id', user.id).lte('next_review_date', today).neq('status', 'new'),
    supabase.from('user_words').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'mastered'),
  ])

  const firstName = profile?.username?.split(' ')[0] ?? 'Öğrenci'
  const streak = profile?.streak_count ?? 0
  const wordsToday = session?.words_learned ?? 0
  const dailyGoal = 10
  const goalCompleted = session?.completed ?? false

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="relative rounded-3xl overflow-hidden" style={{ background: 'linear-gradient(135deg, #1e3a5f 0%, #2d5a8e 50%, #1a4480 100%)' }}>
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, #60a5fa 0%, transparent 50%), radial-gradient(circle at 80% 20%, #818cf8 0%, transparent 50%)' }} />
        <div className="relative p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-blue-300 text-sm font-medium tracking-wide">Merhaba 👋</p>
              <h1 className="text-3xl font-black text-white mt-0.5">{firstName}</h1>
            </div>
            <span className="bg-white/15 backdrop-blur-sm text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/20">
              {profile?.cefr_level}
            </span>
          </div>

          <div className="mt-5 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-orange-400/20 border border-orange-400/30 flex items-center justify-center text-xl">
                🔥
              </div>
              <div>
                <p className="text-2xl font-black text-white leading-none">{streak}</p>
                <p className="text-blue-300 text-xs">gün serisi</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-emerald-400/20 border border-emerald-400/30 flex items-center justify-center text-xl">
                📚
              </div>
              <div>
                <p className="text-2xl font-black text-white leading-none">{totalWords ?? 0}</p>
                <p className="text-blue-300 text-xs">kelime</p>
              </div>
            </div>
            <div className="w-px h-8 bg-white/20" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-purple-400/20 border border-purple-400/30 flex items-center justify-center text-xl">
                ⭐
              </div>
              <div>
                <p className="text-2xl font-black text-white leading-none">{masteredWords ?? 0}</p>
                <p className="text-blue-300 text-xs">ezber</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Streak warning */}
      {streak > 0 && !goalCompleted && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-100 rounded-2xl p-4">
          <span className="text-2xl shrink-0">🔥</span>
          <div>
            <p className="text-sm font-bold text-orange-800">{streak} günlük serinle bugün devam et!</p>
            <p className="text-xs text-orange-500 mt-0.5">Öğrenmeden geçme, serinyi koru.</p>
          </div>
        </div>
      )}

      {/* Daily goal */}
      <div className="bg-white rounded-3xl p-5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-slate-100">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-800">Bugünkü Hedef</h2>
          <span className="text-sm font-semibold text-slate-500">{wordsToday}/{dailyGoal}</span>
        </div>

        <div className="h-3 bg-slate-100 rounded-full overflow-hidden mb-4">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min((wordsToday / dailyGoal) * 100, 100)}%`,
              background: goalCompleted ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #3b82f6, #6366f1)',
            }}
          />
        </div>

        {goalCompleted ? (
          <div className="flex items-center gap-3 bg-emerald-50 rounded-2xl p-3.5">
            <span className="text-2xl">🏆</span>
            <div>
              <p className="font-bold text-emerald-800 text-sm">Günlük hedef tamamlandı!</p>
              <p className="text-emerald-600 text-xs">Harika iş, yarın da devam et</p>
            </div>
          </div>
        ) : (
          <Link
            href="/learn"
            className="flex items-center justify-between w-full bg-blue-600 hover:bg-blue-700 active:scale-[0.98] text-white rounded-2xl px-5 py-4 transition-all shadow-[0_4px_14px_rgba(59,130,246,0.4)]"
          >
            <div className="flex items-center gap-3">
              <BookOpen size={20} />
              <div className="text-left">
                <p className="font-bold">Öğrenmeye Devam Et</p>
                <p className="text-blue-200 text-xs">{dailyGoal - wordsToday} kelime kaldı</p>
              </div>
            </div>
            <span className="text-blue-200 text-lg">→</span>
          </Link>
        )}
      </div>

      {/* Action cards */}
      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/learn"
          className="bg-white rounded-3xl p-5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-slate-100 hover:shadow-[0_4px_24px_rgba(59,130,246,0.15)] hover:border-blue-200 transition-all active:scale-[0.97] group"
        >
          <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center mb-3 group-hover:bg-blue-200 transition-colors">
            <BookOpen size={18} className="text-blue-600" />
          </div>
          <p className="font-bold text-slate-800 text-sm">Yeni Öğren</p>
          <p className="text-slate-400 text-xs mt-0.5">Kelime keşfet</p>
        </Link>

        <Link
          href="/review"
          className="bg-white rounded-3xl p-5 shadow-[0_2px_20px_rgba(0,0,0,0.06)] border border-slate-100 hover:shadow-[0_4px_24px_rgba(245,158,11,0.15)] hover:border-amber-200 transition-all active:scale-[0.97] group"
        >
          <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center mb-3 group-hover:bg-amber-200 transition-colors">
            <RotateCcw size={18} className="text-amber-600" />
          </div>
          <p className="font-bold text-slate-800 text-sm">Tekrar Et</p>
          <p className={`text-xs mt-0.5 font-medium ${(dueToday ?? 0) > 0 ? 'text-amber-500' : 'text-slate-400'}`}>
            {(dueToday ?? 0) > 0 ? `${dueToday} kart bekliyor` : 'Hepsi güncel'}
          </p>
        </Link>
      </div>

      {/* Duel promo */}
      <Link
        href="/duel"
        className="flex items-center gap-4 bg-gradient-to-r from-slate-800 to-slate-900 rounded-3xl p-5 active:scale-[0.98] transition-all"
      >
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl shrink-0">⚔️</div>
        <div className="flex-1">
          <p className="font-bold text-white text-sm">Düello Yap</p>
          <p className="text-slate-400 text-xs mt-0.5">Arkadaşlarınla yarış</p>
        </div>
        <Zap size={18} className="text-slate-400 shrink-0" />
      </Link>
    </div>
  )
}
