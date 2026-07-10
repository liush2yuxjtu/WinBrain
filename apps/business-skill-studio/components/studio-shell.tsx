"use client"

import { useEffect, useState, type ReactNode } from 'react'

type StudioShellProps = {
  children: ReactNode
  userName: string
  userEmail?: string | null
  signOutAction: () => Promise<void>
}

const navigation = [
  { href: '#studio-home', label: 'Skill 工作台', icon: '✦' },
  { href: '#expert-interview', label: '专家访谈', icon: '⌁' },
  { href: '#skill-draft', label: 'Skill 草稿', icon: '◇' }
]

export function StudioShell({ children, userName, userEmail, signOutAction }: StudioShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeHash, setActiveHash] = useState('#studio-home')

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem('winbrain-sidebar-collapsed') === 'true')
    } catch (error) {
      console.warn('Unable to read the sidebar preference from localStorage.', error)
    }

    const syncActiveHash = () => setActiveHash(window.location.hash || '#studio-home')
    syncActiveHash()
    window.addEventListener('hashchange', syncActiveHash)

    return () => window.removeEventListener('hashchange', syncActiveHash)
  }, [])

  function toggleSidebar() {
    const next = !collapsed
    setCollapsed(next)

    try {
      window.localStorage.setItem('winbrain-sidebar-collapsed', String(next))
    } catch (error) {
      console.warn('Unable to persist the sidebar preference to localStorage.', error)
    }
  }

  const avatarInitial = Array.from(userName.trim())[0]?.toUpperCase() || '?'

  return (
    <div className="app-shell">
      <aside className={`studio-sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`} aria-label="主导航">
        <div className="sidebar-brand">
          <img src="/winbrain-logo.svg" alt="" width="44" height="44" />
          <div className="brand-copy">
            <strong>WinBrain</strong>
            <span>Business Skill Studio</span>
          </div>
          <button
            className="sidebar-collapse"
            type="button"
            aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'}
            aria-expanded={!collapsed}
            onClick={toggleSidebar}
          >
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <nav className="sidebar-nav">
          <p className="nav-label">工作流</p>
          {navigation.map((item) => (
            <a
              className={`sidebar-nav-item${activeHash === item.href ? ' active' : ''}`}
              href={item.href}
              key={item.href}
              onClick={() => {
                setActiveHash(item.href)
                setMobileOpen(false)
              }}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
              <span className="nav-chevron" aria-hidden="true">›</span>
            </a>
          ))}
        </nav>

        <div className="sidebar-footer">
          <div className="user-avatar" aria-hidden="true">{avatarInitial}</div>
          <div className="user-copy">
            <strong>{userName}</strong>
            {userEmail ? <span>{userEmail}</span> : null}
          </div>
          <form action={signOutAction}>
            <button className="sign-out-button" type="submit" aria-label="退出登录" title="退出登录">↗</button>
          </form>
        </div>
      </aside>

      {mobileOpen ? <button className="sidebar-backdrop" type="button" aria-label="关闭导航" onClick={() => setMobileOpen(false)} /> : null}

      <div className="studio-main">
        <button className="mobile-menu-button" type="button" aria-label="打开导航" onClick={() => setMobileOpen(true)}>☰</button>
        {children}
      </div>
    </div>
  )
}
