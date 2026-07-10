"use client"

import { useEffect, useState, type ReactNode } from 'react'

type StudioShellProps = {
  children: ReactNode
  userName: string
  userEmail?: string | null
  signOutAction: () => Promise<void>
}

const navigation = [
  { href: '/#studio-home', label: '概览', icon: '⌂', active: (location: string) => location === '/' || location === '/#studio-home' },
  { href: '/#skill-draft', label: 'Skill Library', icon: '◇', active: (location: string) => location === '/#skill-draft' },
  { href: '/#expert-interview', label: '业务专家', icon: '◎', active: (location: string) => location === '/#expert-interview' },
  { href: '/settings#data-sources', label: '数据源', icon: '⌁', active: (location: string) => location === '/settings#data-sources' },
  { href: '/settings', label: '设置', icon: '⚙', active: (location: string) => location === '/settings' }
]

export function StudioShell({ children, userName, userEmail, signOutAction }: StudioShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeLocation, setActiveLocation] = useState('/')

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem('winbrain-sidebar-collapsed') === 'true')
    } catch (error) {
      console.warn('Unable to read the sidebar preference from localStorage.', error)
    }

    const syncLocation = () => setActiveLocation(`${window.location.pathname}${window.location.hash}`)
    syncLocation()
    window.addEventListener('hashchange', syncLocation)
    window.addEventListener('popstate', syncLocation)

    return () => {
      window.removeEventListener('hashchange', syncLocation)
      window.removeEventListener('popstate', syncLocation)
    }
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
          <img src="/winbrain-logo.svg" alt="" width="38" height="38" />
          <div className="brand-copy">
            <strong>WinBrain</strong>
            <span>AI Operations Workspace</span>
          </div>
          <button className="sidebar-collapse" type="button" aria-label={collapsed ? '展开侧边栏' : '折叠侧边栏'} aria-expanded={!collapsed} onClick={toggleSidebar}>
            {collapsed ? '›' : '‹'}
          </button>
        </div>

        <a className="sidebar-create" href="/#expert-interview" onClick={() => setMobileOpen(false)}>
          <span aria-hidden="true">＋</span><b>新建 Skill</b>
        </a>

        <nav className="sidebar-nav">
          <p className="nav-label">工作区</p>
          {navigation.slice(0, 3).map((item) => (
            <a
              className={`sidebar-nav-item${item.active(activeLocation) ? ' active' : ''}`}
              href={item.href}
              key={item.href}
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </a>
          ))}

          <p className="nav-label nav-label-secondary">管理</p>
          {navigation.slice(3).map((item) => (
            <a
              className={`sidebar-nav-item${item.active(activeLocation) ? ' active' : ''}`}
              href={item.href}
              key={item.href}
              onClick={() => setMobileOpen(false)}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
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
