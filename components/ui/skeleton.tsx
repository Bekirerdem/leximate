import { cn } from '@/lib/utils'

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cn('animate-pulse rounded-xl bg-slate-100', className)} />
  )
}

export function LearnSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="bg-white rounded-3xl p-8 space-y-4">
        <Skeleton className="h-4 w-20 mx-auto" />
        <Skeleton className="h-12 w-48 mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
    </div>
  )
}

export function ReviewSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-2 w-full rounded-full" />
      <div className="bg-white rounded-3xl p-8 space-y-4">
        <Skeleton className="h-4 w-20 mx-auto" />
        <Skeleton className="h-12 w-48 mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto" />
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-14" />)}
      </div>
    </div>
  )
}

export function ProfileSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-40 w-full rounded-3xl" />
      <div className="grid grid-cols-2 gap-3">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
      </div>
      <Skeleton className="h-48 rounded-2xl" />
    </div>
  )
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-48 rounded-3xl" />
      <Skeleton className="h-24 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-28 rounded-2xl" />
      </div>
    </div>
  )
}
