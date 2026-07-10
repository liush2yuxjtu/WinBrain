import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { auth, signOut } from '@/auth'
import { StudioShell } from '@/components/studio-shell'

export const metadata: Metadata = {
  title: 'WinBrain AI Workspace',
  description: 'Create reusable Claude skills and explore WinBrain database metadata with dedicated agents.'
}

async function signOutAction() {
  'use server'

  await signOut({ redirectTo: '/login' })
}

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await auth()

  return (
    <html lang="zh-CN">
      <body>
        {session?.user ? (
          <StudioShell
            userName={session.user.name || session.user.email || 'WinBrain 用户'}
            userEmail={session.user.email}
            signOutAction={signOutAction}
          >
            {children}
          </StudioShell>
        ) : children}
      </body>
    </html>
  )
}
