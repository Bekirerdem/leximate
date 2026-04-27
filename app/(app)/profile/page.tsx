import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { count: totalWords } = await supabase
    .from('user_words')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'new')

  const { count: masteredWords } = await supabase
    .from('user_words')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'mastered')

  return (
    <div className="space-y-4">
      <div className="text-center py-4">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-3">
          <span className="text-2xl font-bold text-blue-600">
            {profile?.username?.[0]?.toUpperCase()}
          </span>
        </div>
        <h1 className="text-xl font-bold text-slate-900">{profile?.username}</h1>
        <p className="text-slate-500 text-sm">{user.email}</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <Badge variant="outline" className="text-lg font-bold px-4 py-1">
              {profile?.cefr_level}
            </Badge>
            <div className="text-xs text-slate-500 mt-2">Seviye</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-orange-500">🔥 {profile?.streak_count ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1">Gün serisi</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">İstatistikler</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-slate-600">Toplam öğrenilen</span>
            <span className="font-semibold">{totalWords ?? 0} kelime</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-600">Ezberlenen</span>
            <span className="font-semibold text-green-600">{masteredWords ?? 0} kelime</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
