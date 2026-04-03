import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'HR Knowledge Assistant',
  description: 'Ask questions about KMS HR policies and benefits',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
