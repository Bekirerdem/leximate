'use client'

import { Trophy, Medal } from 'lucide-react'
import Link from 'next/link'

export interface LeaderboardEntry {
  user_id: string
  username: string
  score: number
  is_me: boolean
}

interface LeaderboardProps {
  entries: LeaderboardEntry[]
  roundsTotal: number
}

export function Leaderboard({ entries, roundsTotal }: LeaderboardProps) {
  const sorted = [...entries].sort((a, b) => b.score - a.score)
  const top = sorted[0]
  const me = sorted.find(e => e.is_me)
  const myRank = me ? sorted.findIndex(e => e.is_me) + 1 : null

  return (
    <div className="space-y-5 py-6">
      <div className="text-center">
        <div className="text-6xl mb-3">{me?.user_id === top.user_id ? '🏆' : '🎯'}</div>
        <h2 className="text-2xl font-bold text-slate-900">
          {me?.user_id === top.user_id ? 'Kazandın!' : `${top.username} kazandı`}
        </h2>
        {myRank && (
          <p className="text-slate-500 text-sm mt-1">
            Senin sıran: {myRank}/{sorted.length} · {me?.score}/{roundsTotal} doğru
          </p>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center gap-2">
          <Trophy size={15} className="text-amber-500" />
          <p className="text-sm font-bold text-slate-700">Sıralama</p>
        </div>
        <div className="divide-y divide-slate-50">
          {sorted.map((e, i) => {
            const medal = i === 0 ? 'text-amber-500' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-700' : 'text-slate-300'
            const pct = Math.round((e.score / roundsTotal) * 100)
            return (
              <div key={e.user_id} className={`flex items-center justify-between p-4 ${e.is_me ? 'bg-indigo-50/50' : ''}`}>
                <div className="flex items-center gap-3">
                  <div className="w-8 flex justify-center">
                    {i < 3 ? <Medal size={20} className={medal} /> : <span className="text-sm font-bold text-slate-400">{i + 1}</span>}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800 text-sm">
                      {e.username} {e.is_me && <span className="text-xs text-slate-400 font-normal">(sen)</span>}
                    </p>
                    <p className="text-xs text-slate-500">{pct}% doğru</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black text-slate-900">{e.score}</p>
                  <p className="text-xs text-slate-400">/{roundsTotal}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <Link
          href="/duel"
          className="flex items-center justify-center w-full py-4 rounded-2xl text-white font-bold shadow-[0_4px_14px_rgba(99,102,241,0.35)] active:scale-95 transition-all"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          Yeni Düello
        </Link>
        <Link
          href="/"
          className="flex items-center justify-center w-full py-3.5 rounded-2xl border border-slate-200 text-slate-700 font-semibold hover:bg-slate-50 transition-colors"
        >
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  )
}
