import './globals.css'
import './settings.css'
import './workbench.css'
import './assistant-panel.css'
import './database.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { auth, signOut } from '@/auth'
import { StudioShell } from '@/components/studio-shell'

export const metadata: Metadata = {
  title: 'WinBrain · AI Operations Workspace',
  description: 'Turn expert knowledge into reusable, governed business skills with an AI copilot.'
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
