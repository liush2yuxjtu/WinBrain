"use client"

import Link from 'next/link'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { usePathname } from 'next/navigation'

type StudioShellProps = {
  children: ReactNode
  userName: string
  userEmail?: string | null
  signOutAction: () => Promise<void>
}

const navigation = [
  { href: '/#studio-home', hash: '#studio-home', label: '概览', icon: '⌂' },
  { href: '/skills', path: '/skills', label: 'Skill 库', icon: '◇' },
  { href: '/#expert-interview', hash: '#expert-interview', label: '业务专家', icon: '◎' },
  { href: '/settings#data-sources', path: '/settings', hash: '#data-sources', label: '数据源', icon: '⌁' },
  { href: '/database', path: '/database', label: '数据库探索', icon: '▤' },
  { href: '/settings', path: '/settings', label: '设置', icon: '⚙' }
]

export function StudioShell({ children, userName, userEmail, signOutAction }: StudioShellProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mobileViewport, setMobileViewport] = useState(false)
  const [activeHash, setActiveHash] = useState('#studio-home')
  const sidebarRef = useRef<HTMLElement>(null)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)

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
  }, [pathname])

  useEffect(() => {
    const mediaQuery = window.matchMedia('(max-width: 800px)')
    const syncViewport = () => setMobileViewport(mediaQuery.matches)
    syncViewport()
    mediaQuery.addEventListener('change', syncViewport)
    return () => mediaQuery.removeEventListener('change', syncViewport)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus())
      }
    }
    window.requestAnimationFrame(() => sidebarRef.current?.querySelector<HTMLElement>('a[aria-current="page"], .sidebar-nav a')?.focus())
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [mobileOpen])

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
      <aside
        ref={sidebarRef}
        id="studio-navigation"
        className={`studio-sidebar${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mobile-open' : ''}`}
        aria-label="主导航"
        aria-hidden={mobileViewport && !mobileOpen ? true : undefined}
        inert={mobileViewport && !mobileOpen}
      >
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

        <Link className="sidebar-create" href="/#expert-interview" onClick={() => setMobileOpen(false)}>
          <span aria-hidden="true">＋</span><b>新建 Skill</b>
        </Link>

        <nav className="sidebar-nav">
          <p className="nav-label">工作区</p>
          {navigation.slice(0, 3).map((item) => {
            const isActive = item.hash
              ? pathname === '/' && activeHash === item.hash
              : item.path ? pathname.startsWith(item.path) : false

            return (
              <Link
              className={`sidebar-nav-item${isActive ? ' active' : ''}`}
              href={item.href}
              key={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if (item.hash) setActiveHash(item.hash)
                setMobileOpen(false)
                if (mobileViewport) window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus())
              }}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </Link>
            )
          })}

          <p className="nav-label nav-label-secondary">管理</p>
          {navigation.slice(3).map((item) => {
            const isActive = item.hash
              ? pathname.startsWith(item.path || '') && activeHash === item.hash
              : item.path ? pathname.startsWith(item.path) && activeHash !== '#data-sources' : false

            return (
              <Link
              className={`sidebar-nav-item${isActive ? ' active' : ''}`}
              href={item.href}
              key={item.href}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
              onClick={() => {
                if (item.hash) setActiveHash(item.hash)
                setMobileOpen(false)
                if (mobileViewport) window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus())
              }}
            >
              <span className="nav-icon" aria-hidden="true">{item.icon}</span>
              <span className="nav-text">{item.label}</span>
            </Link>
            )
          })}
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

      {mobileOpen ? <button className="sidebar-backdrop" type="button" aria-label="关闭导航" onClick={() => { setMobileOpen(false); window.requestAnimationFrame(() => mobileMenuButtonRef.current?.focus()) }} /> : null}

      <div className="studio-main" inert={mobileViewport && mobileOpen}>
        <button
          ref={mobileMenuButtonRef}
          className="mobile-menu-button"
          type="button"
          aria-label={mobileOpen ? '关闭导航' : '打开导航'}
          aria-expanded={mobileOpen}
          aria-controls="studio-navigation"
          onClick={() => setMobileOpen((open) => !open)}
        >☰</button>
        {children}
      </div>
    </div>
  )
}
