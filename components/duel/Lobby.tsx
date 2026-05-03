'use client'

import { Crown, Check, Clock, Users } from 'lucide-react'

export interface LobbyParticipant {
  user_id: string
  username: string
  joined: boolean
  is_host: boolean
  is_me: boolean
}

interface LobbyProps {
  participants: LobbyParticipant[]
  rounds: number
  level: string
  amHost: boolean
  starting: boolean
  onStart: () => void
}

export function Lobby({ participants, rounds, level, amHost, starting, onStart }: LobbyProps) {
  const joinedCount = participants.filter(p => p.joined).length
  const canStart = amHost && joinedCount >= 2

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/15 rounded-xl flex items-center justify-center">
            <Users size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold">Düello Lobisi</h2>
            <p className="text-indigo-100 text-xs">{rounds} tur · {level} seviye</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50">
        {participants.map(p => (
          <div key={p.user_id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 font-bold text-sm">
                {p.username.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <p className="font-semibold text-slate-800 text-sm flex items-center gap-1.5">
                  {p.username}
                  {p.is_me && <span className="text-xs text-slate-400">(sen)</span>}
                  {p.is_host && <Crown size={12} className="text-amber-500" />}
                </p>
                <p className="text-xs text-slate-500">
                  {p.joined ? 'Hazır' : 'Bekleniyor...'}
                </p>
              </div>
            </div>
            {p.joined ? (
              <div className="w-7 h-7 bg-emerald-50 rounded-full flex items-center justify-center">
                <Check size={14} className="text-emerald-600" />
              </div>
            ) : (
              <div className="w-7 h-7 bg-slate-50 rounded-full flex items-center justify-center">
                <Clock size={14} className="text-slate-400 animate-pulse" />
              </div>
            )}
          </div>
        ))}
      </div>

      {amHost ? (
        <button
          onClick={onStart}
          disabled={!canStart || starting}
          className="w-full py-4 rounded-2xl text-white font-bold shadow-[0_4px_14px_rgba(99,102,241,0.35)] hover:opacity-90 active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
        >
          {starting ? 'Başlatılıyor...' : canStart ? 'Düelloyu Başlat' : 'En az 2 oyuncu bekleniyor'}
        </button>
      ) : (
        <p className="text-center text-slate-400 text-sm py-2">
          Host'un düelloyu başlatması bekleniyor...
        </p>
      )}
    </div>
  )
}
