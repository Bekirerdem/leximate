export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="w-full max-w-md p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900">LexiMate</h1>
          <p className="text-slate-500 mt-1">İngilizce öğrenme yolculuğun başlıyor</p>
        </div>
        {children}
      </div>
    </div>
  )
}
