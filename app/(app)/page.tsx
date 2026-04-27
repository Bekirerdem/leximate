import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import Link from 'next/link'
import { cn } from '@/lib/utils'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const { data: session } = await supabase
    .from('daily_sessions')
    .select('*')
    .eq('user_id', user.id)
    .eq('session_date', new Date().toISOString().split('T')[0])
    .single()

  const { count: totalWords } = await supabase
    .from('user_words')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .neq('status', 'new')

  const { count: dueToday } = await supabase
    .from('user_words')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .lte('next_review_date', new Date().toISOString().split('T')[0])
    .neq('status', 'new')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Merhaba, {profile?.username}!
          </h1>
          <p className="text-slate-500 text-sm">Bugün harika bir gün öğrenmek için</p>
        </div>
        <Badge variant="outline" className="text-sm font-semibold">
          {profile?.cefr_level}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-orange-500">🔥 {profile?.streak_count ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1">Gün serisi</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-blue-600">{totalWords ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1">Kelime</div>
          </CardContent>
        </Card>
        <Card className="text-center">
          <CardContent className="pt-4 pb-3">
            <div className="text-2xl font-bold text-green-600">{dueToday ?? 0}</div>
            <div className="text-xs text-slate-500 mt-1">Tekrar</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Bugünkü Hedef</CardTitle>
        </CardHeader>
        <CardContent>
          {session?.completed ? (
            <p className="text-green-600 font-medium">✓ Bugünkü görevini tamamladın!</p>
          ) : (
            <div className="space-y-3">
              <p className="text-slate-600 text-sm">10 yeni kelime seni bekliyor</p>
              <Link href="/learn" className={cn(buttonVariants(), 'w-full justify-center')}>
                Öğrenmeye Başla
              </Link>
            </div>
          )}
        </CardContent>
      </Card>

      {(dueToday ?? 0) > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="pt-4 flex items-center justify-between">
            <div>
              <p className="font-medium text-amber-800">{dueToday} kelime tekrar bekliyor</p>
              <p className="text-sm text-amber-600">Hatırlama gücünü koru</p>
            </div>
            <Link href="/review" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}>
              Tekrar Et
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
