import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: room } = await supabase
    .from('duel_rooms').select('host_id, status').eq('id', id).single()
  if (!room) return NextResponse.json({ error: 'oda yok' }, { status: 404 })
  if (room.host_id !== user.id) return NextResponse.json({ error: 'sadece host başlatabilir' }, { status: 403 })
  if (room.status !== 'waiting') return NextResponse.json({ error: 'zaten başlamış' }, { status: 400 })

  // En az 2 kişi joined olmalı (host dahil)
  const { count } = await supabase
    .from('duel_participants').select('*', { count: 'exact', head: true })
    .eq('room_id', id).eq('joined', true)
  if ((count ?? 0) < 2) return NextResponse.json({ error: 'en az 2 katılımcı gerekli' }, { status: 400 })

  const { error } = await supabase
    .from('duel_rooms').update({ status: 'active', current_round: 1 }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
