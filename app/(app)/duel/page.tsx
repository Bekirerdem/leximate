'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Swords, UserPlus, Clock, Trophy, Search, Zap } from 'lucide-react'

interface Friend {
  id: string
  username: string
  cefr_level: string
  streak_count: number
}

interface Friendship {
  id: number
  user_id_1: string
  user_id_2: string
  status: string
}

interface IncomingDuel {
  id: string
  challenger_id: string
  challengerName: string
}

export default function DuelPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [friends, setFriends] = useState<Friend[]>([])
  const [pending, setPending] = useState<Friend[]>([])
  const [incomingDuels, setIncomingDuels] = useState<IncomingDuel[]>([])
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<Friend | null>(null)
  const [searchError, setSearchError] = useState('')
  const [adding, setAdding] = useState(false)
  const [myId, setMyId] = useState<string | null>(null)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    // Friendships
    const { data: fs } = await supabase
      .from('friendships')
      .select('id, user_id_1, user_id_2, status')
      .or(`user_id_1.eq.${user.id},user_id_2.eq.${user.id}`) as { data: Friendship[] | null }

    if (fs?.length) {
      const friendIds = fs.map(f => f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1)
      const { data: profiles } = await supabase
        .from('profiles').select('id, username, cefr_level, streak_count').in('id', friendIds)
      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p as Friend]))

      const activeFriends: Friend[] = []
      const pendingFriends: Friend[] = []
      for (const f of fs) {
        const otherId = f.user_id_1 === user.id ? f.user_id_2 : f.user_id_1
        const profile = profileMap[otherId]
        if (!profile) continue
        if (f.status === 'active') activeFriends.push(profile)
        else if (f.status === 'pending' && f.user_id_2 === user.id) pendingFriends.push(profile)
      }
      setFriends(activeFriends)
      setPending(pendingFriends)
    }

    // Incoming duels (rooms where I'm opponent and status is waiting)
    const { data: rooms } = await supabase
      .from('duel_rooms')
      .select('id, challenger_id, status')
      .eq('opponent_id', user.id)
      .eq('status', 'waiting')

    if (rooms?.length) {
      const challengerIds = rooms.map(r => r.challenger_id)
      const { data: challengers } = await supabase
        .from('profiles').select('id, username').in('id', challengerIds)
      const cMap = Object.fromEntries((challengers ?? []).map(p => [p.id, p.username]))

      setIncomingDuels(rooms.map(r => ({
        id: r.id,
        challenger_id: r.challenger_id,
        challengerName: cMap[r.challenger_id] ?? 'Bilinmiyor',
      })))
    }
  }

  async function handleSearch() {
    if (!username.trim()) return
    setSearching(true)
    setSearchResult(null)
    setSearchError('')
    const supabase = createClient()
    const { data } = await supabase
      .from('profiles').select('id, username, cefr_level, streak_count')
      .ilike('username', username.trim()).neq('id', myId ?? '').limit(1).single()
    if (data) setSearchResult(data as Friend)
    else setSearchError('Kullanıcı bulunamadı')
    setSearching(false)
  }

  async function handleAddFriend(friendId: string) {
    if (!myId) return
    setAdding(true)
    const supabase = createClient()
    await supabase.from('friendships').insert({ user_id_1: myId, user_id_2: friendId, status: 'pending' })
    setSearchResult(null)
    setUsername('')
    setAdding(false)
    alert('Arkadaşlık isteği gönderildi!')
  }

  async function handleAcceptFriend(friendId: string) {
    if (!myId) return
    const supabase = createClient()
    await supabase.from('friendships').update({ status: 'active' })
      .eq('user_id_1', friendId).eq('user_id_2', myId)
    loadAll()
  }

  async function handleChallenge(friendId: string) {
    if (!myId) return
    const supabase = createClient()
    const { data: words } = await supabase.from('words').select('id').limit(50)
    const rw = words?.[Math.floor(Math.random() * (words?.length ?? 1))]
    const { data: room } = await supabase.from('duel_rooms').insert({
      challenger_id: myId, opponent_id: friendId, current_word_id: rw?.id,
    }).select().single()
    if (room) router.push(`/duel/${room.id}`)
  }

  async function handleJoinDuel(roomId: string) {
    router.push(`/duel/${roomId}`)
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Swords size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold">Düello</h1>
            <p className="text-slate-400 text-xs">Arkadaşlarınla rekabet et</p>
          </div>
        </div>
        <p className="text-slate-300 text-sm mt-3">
          Aynı kelimeler, aynı anda — kim daha hızlı ve doğru yanıt verir?
        </p>
      </div>

      {/* Incoming duels */}
      {incomingDuels.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-indigo-500" />
            <p className="text-sm font-semibold text-indigo-700">Düello Daveti!</p>
          </div>
          {incomingDuels.map(d => (
            <div key={d.id} className="flex items-center justify-between">
              <p className="font-semibold text-slate-800 text-sm">{d.challengerName} seni düelloya davet etti</p>
              <button
                onClick={() => handleJoinDuel(d.id)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors"
              >
                Kabul Et
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Pending friend requests */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Clock size={15} className="text-amber-500" />
            <p className="text-sm font-semibold text-amber-700">Arkadaşlık İstekleri</p>
          </div>
          {pending.map(f => (
            <div key={f.id} className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800 text-sm">{f.username}</p>
                <p className="text-xs text-slate-500">{f.cefr_level} · {f.streak_count} gün serisi</p>
              </div>
              <button
                onClick={() => handleAcceptFriend(f.id)}
                className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600 transition-colors"
              >
                Kabul Et
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Friends list */}
      {friends.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center gap-2">
            <Trophy size={15} className="text-blue-500" />
            <p className="text-sm font-bold text-slate-700">Arkadaşlar</p>
          </div>
          <div className="divide-y divide-slate-50">
            {friends.map(f => (
              <div key={f.id} className="flex items-center justify-between p-4">
                <div>
                  <p className="font-semibold text-slate-800 text-sm">{f.username}</p>
                  <p className="text-xs text-slate-500">{f.cefr_level} · 🔥 {f.streak_count}</p>
                </div>
                <button
                  onClick={() => handleChallenge(f.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700 transition-colors"
                >
                  <Swords size={12} />
                  Düello
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add friend */}
      <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus size={15} className="text-blue-500" />
          <p className="text-sm font-bold text-slate-700">Arkadaş Ekle</p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            placeholder="Kullanıcı adı"
            className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors flex items-center gap-1.5"
          >
            <Search size={14} />
            Ara
          </button>
        </div>
        {searchError && <p className="text-red-500 text-sm">{searchError}</p>}
        {searchResult && (
          <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
            <div>
              <p className="font-semibold text-slate-800 text-sm">{searchResult.username}</p>
              <p className="text-xs text-slate-500">{searchResult.cefr_level} seviyesi</p>
            </div>
            <button
              onClick={() => handleAddFriend(searchResult!.id)}
              disabled={adding}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {adding ? '...' : 'Ekle'}
            </button>
          </div>
        )}
      </div>

      {friends.length === 0 && pending.length === 0 && incomingDuels.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-4">
          Düello yapmak için bir arkadaş ekle
        </p>
      )}
    </div>
  )
}
