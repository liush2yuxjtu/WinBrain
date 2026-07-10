import './globals.css'
import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { auth, signOut } from '@/auth'

export const metadata: Metadata = {
  title: 'WinBrain Business Skill Studio',
  description: 'Chat with business experts and turn their know-how into reusable Claude skills.'
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
          <header className="app-shell-header">
            <div>
              <strong>{session.user.name || session.user.email}</strong>
              <span>{session.user.email}</span>
            </div>
            <form action={signOutAction}>
              <button className="secondary" type="submit">退出登录</button>
            </form>
          </header>
        ) : null}
        {children}
      </body>
    </html>
  )
}
