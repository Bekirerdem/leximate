'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Swords, UserPlus, Clock, Trophy, Search, Zap, X, Users } from 'lucide-react'
import { toast } from 'sonner'

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

interface IncomingInvite {
  room_id: string
  host_username: string
  rounds: number
  level: string
}

interface ActiveRoom {
  room_id: string
  status: string
  rounds: number
  level: string
}

const MAX_PARTICIPANTS = 3   // host hariç
const ROUND_OPTIONS = [5, 7, 10]

export default function DuelHubPage() {
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [friends, setFriends] = useState<Friend[]>([])
  const [pending, setPending] = useState<Friend[]>([])
  const [incomingInvites, setIncomingInvites] = useState<IncomingInvite[]>([])
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([])
  const [searching, setSearching] = useState(false)
  const [searchResult, setSearchResult] = useState<Friend | null>(null)
  const [searchError, setSearchError] = useState('')
  const [adding, setAdding] = useState(false)
  const [myId, setMyId] = useState<string | null>(null)

  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rounds, setRounds] = useState(7)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let channel: ReturnType<ReturnType<typeof createClient>['channel']> | null = null

    const init = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      await loadAll()

      channel = supabase
        .channel(`duel_hub_${user.id}`)
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'duel_participants', filter: `user_id=eq.${user.id}` },
          () => { loadAll() }
        )
        .on('postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'duel_participants', filter: `user_id=eq.${user.id}` },
          () => { loadAll() }
        )
        .on('postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'friendships', filter: `user_id_2=eq.${user.id}` },
          () => { loadAll() }
        )
        .subscribe()
    }
    init()
    return () => { if (channel) channel.unsubscribe() }
  }, [])

  async function loadAll() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setMyId(user.id)

    // Friendships
    const { data: fs } = await supabase
      .from('friendships').select('id, user_id_1, user_id_2, status')
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
    } else {
      setFriends([])
      setPending([])
    }

    // Davet edildiğim odalar (joined=false, status=waiting) ve devam edenler (status=active veya joined=true&waiting)
    const { data: myParts } = await supabase
      .from('duel_participants')
      .select('room_id, joined, duel_rooms!inner(id, status, rounds_total, cefr_level, host_id)')
      .eq('user_id', user.id)
      .in('duel_rooms.status', ['waiting', 'active'])

    const invites: IncomingInvite[] = []
    const active: ActiveRoom[] = []
    const hostIds = new Set<string>()

    for (const r of myParts ?? []) {
      const room = (r as unknown as { duel_rooms: { id: string; status: string; rounds_total: number; cefr_level: string; host_id: string } }).duel_rooms
      if (!room) continue
      if (!r.joined && room.status === 'waiting') {
        hostIds.add(room.host_id)
        invites.push({ room_id: room.id, host_username: '', rounds: room.rounds_total, level: room.cefr_level })
      } else if (r.joined) {
        active.push({ room_id: room.id, status: room.status, rounds: room.rounds_total, level: room.cefr_level })
      }
    }

    if (hostIds.size > 0) {
      const { data: hosts } = await supabase
        .from('profiles').select('id, username').in('id', Array.from(hostIds))
      const map = Object.fromEntries((hosts ?? []).map(h => [h.id, h.username]))
      // ilişki kuralım: invites'taki room id ile host_id eşle
      for (const i of invites) {
        const rec = (myParts ?? []).find(r => (r as unknown as { duel_rooms: { id: string } }).duel_rooms.id === i.room_id)
        const hid = (rec as unknown as { duel_rooms: { host_id: string } } | undefined)?.duel_rooms.host_id
        if (hid) i.host_username = map[hid] ?? '?'
      }
    }

    setIncomingInvites(invites)
    setActiveRooms(active)
  }

  function toggleSelected(friendId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(friendId)) next.delete(friendId)
      else if (next.size < MAX_PARTICIPANTS) next.add(friendId)
      else toast.error(`En fazla ${MAX_PARTICIPANTS} arkadaş seçebilirsin`)
      return next
    })
  }

  async function handleStartDuel() {
    if (selected.size === 0) { toast.error('En az 1 arkadaş seç'); return }
    setCreating(true)
    try {
      const res = await fetch('/api/duel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantIds: Array.from(selected), rounds }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast.error(data.error ?? 'Düello yaratılamadı')
        return
      }
      router.push(`/duel/${data.id}`)
    } finally {
      setCreating(false)
    }
  }

  async function handleAcceptInvite(roomId: string) {
    const res = await fetch(`/api/duel/${roomId}/join`, { method: 'POST' })
    if (!res.ok) { toast.error('Davet kabul edilemedi'); return }
    router.push(`/duel/${roomId}`)
  }

  async function handleSearch() {
    if (!username.trim()) return
    setSearching(true)
    setSearchResult(null)
    setSearchError('')
    const supabase = createClient()
    // RLS profiles tablosunda yabancı kullanıcı okumayı bloklar; bu RPC
    // security definer ile sadece username eşleşmesini publish eder.
    const { data, error } = await supabase
      .rpc('search_profile_by_username', { query: username.trim() })
    if (error || !data || data.length === 0) {
      setSearchError('Kullanıcı bulunamadı')
    } else {
      setSearchResult(data[0] as Friend)
    }
    setSearching(false)
  }

  async function handleAddFriend(friendId: string) {
    if (!myId) return
    setAdding(true)
    const supabase = createClient()
    const { error } = await supabase.from('friendships').insert({ user_id_1: myId, user_id_2: friendId, status: 'pending' })
    setSearchResult(null); setUsername(''); setAdding(false)
    if (error) toast.error('İstek gönderilemedi')
    else toast.success('Arkadaşlık isteği gönderildi')
  }

  async function handleAcceptFriend(friendId: string) {
    if (!myId) return
    const supabase = createClient()
    await supabase.from('friendships').update({ status: 'active' })
      .eq('user_id_1', friendId).eq('user_id_2', myId)
    toast.success('Arkadaşlık kabul edildi')
    loadAll()
  }

  async function handleRejectFriend(friendId: string) {
    if (!myId) return
    const supabase = createClient()
    await supabase.from('friendships').delete()
      .eq('user_id_1', friendId).eq('user_id_2', myId)
    loadAll()
  }

  return (
    <div className="space-y-5">
      <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Swords size={20} />
          </div>
          <div>
            <h1 className="text-lg font-bold">Düello Arenası</h1>
            <p className="text-slate-400 text-xs">2-4 kişilik, sırayla cevap, kazanan birinci olur</p>
          </div>
        </div>
      </div>

      {/* Aktif odalar */}
      {activeRooms.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-semibold text-emerald-700">Devam Eden Düellolar</p>
          {activeRooms.map(r => (
            <div key={r.room_id} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {r.status === 'waiting' ? 'Lobi' : 'Aktif'} · {r.rounds} tur · {r.level}
                </p>
              </div>
              <button
                onClick={() => router.push(`/duel/${r.room_id}`)}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
              >
                Devam Et
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Davetler */}
      {incomingInvites.length > 0 && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Zap size={15} className="text-indigo-500" />
            <p className="text-sm font-semibold text-indigo-700">Düello Daveti</p>
          </div>
          {incomingInvites.map(i => (
            <div key={i.room_id} className="flex items-center justify-between">
              <p className="font-semibold text-slate-800 text-sm">
                {i.host_username} seni davet etti · {i.rounds} tur · {i.level}
              </p>
              <button
                onClick={() => handleAcceptInvite(i.room_id)}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700"
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
              <div className="flex gap-2">
                <button onClick={() => handleRejectFriend(f.id)}
                  className="p-1.5 border border-slate-200 text-slate-400 rounded-lg hover:bg-slate-50">
                  <X size={14} />
                </button>
                <button onClick={() => handleAcceptFriend(f.id)}
                  className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-semibold hover:bg-amber-600">
                  Kabul Et
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Yeni düello — friend multi-select */}
      {friends.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-blue-500" />
              <p className="text-sm font-bold text-slate-700">
                Yeni Düello ({selected.size}/{MAX_PARTICIPANTS})
              </p>
            </div>
            <p className="text-xs text-slate-400">en fazla 4 kişi (sen + 3)</p>
          </div>

          <div className="divide-y divide-slate-50">
            {friends.map(f => {
              const isSel = selected.has(f.id)
              return (
                <button
                  key={f.id}
                  onClick={() => toggleSelected(f.id)}
                  className={`w-full flex items-center justify-between p-4 transition-colors ${isSel ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}
                >
                  <div className="text-left">
                    <p className="font-semibold text-slate-800 text-sm">{f.username}</p>
                    <p className="text-xs text-slate-500">{f.cefr_level} · 🔥 {f.streak_count}</p>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${isSel ? 'bg-indigo-600 border-indigo-600' : 'border-slate-300'}`}>
                    {isSel && <span className="text-white text-xs font-bold">✓</span>}
                  </div>
                </button>
              )
            })}
          </div>

          {/* Tur sayısı */}
          <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <p className="text-xs font-semibold text-slate-600 mb-2">Tur Sayısı</p>
            <div className="flex gap-2">
              {ROUND_OPTIONS.map(n => (
                <button
                  key={n}
                  onClick={() => setRounds(n)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition-colors ${
                    rounds === n
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-200'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={handleStartDuel}
            disabled={selected.size === 0 || creating}
            className="w-full py-4 text-white font-bold disabled:opacity-40 disabled:cursor-not-allowed transition-opacity"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            {creating ? 'Hazırlanıyor (cümleler üretiliyor)...' : 'Düello Başlat'}
          </button>
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
          <button onClick={handleSearch} disabled={searching}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-60 flex items-center gap-1.5">
            <Search size={14} /> Ara
          </button>
        </div>
        {searchError && <p className="text-red-500 text-sm">{searchError}</p>}
        {searchResult && (
          <div className="flex items-center justify-between bg-slate-50 rounded-xl p-3">
            <div>
              <p className="font-semibold text-slate-800 text-sm">{searchResult.username}</p>
              <p className="text-xs text-slate-500">{searchResult.cefr_level} seviyesi</p>
            </div>
            <button onClick={() => handleAddFriend(searchResult!.id)} disabled={adding}
              className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-60">
              {adding ? '...' : 'Ekle'}
            </button>
          </div>
        )}
      </div>

      {friends.length === 0 && pending.length === 0 && incomingInvites.length === 0 && (
        <div className="text-center text-slate-400 text-sm py-6 bg-white rounded-2xl border border-dashed border-slate-200">
          <Trophy size={32} className="mx-auto mb-2 opacity-30" />
          Düello yapmak için önce arkadaş ekle
        </div>
      )}
    </div>
  )
}
