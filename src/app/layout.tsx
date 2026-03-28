import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Wubbo',
  description: 'De kennisbank van Rutger en Annelie',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="nl">
      <body>{children}</body>
    </html>
  )
}
