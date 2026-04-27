import type { Metadata } from 'next'
import { Geist } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const geist = Geist({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LexiMate',
  description: 'Kişiselleştirilmiş İngilizce öğrenme uygulaması',
  manifest: '/manifest.json',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className={geist.className}>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </body>
    </html>
  )
}
