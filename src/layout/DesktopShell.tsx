import { NavLink, Outlet, useLocation } from 'react-router-dom'

const navItems = [
  { label: 'Timeline', to: '/timeline', icon: 'timeline' },
  { label: 'Weekly', to: '/week', icon: 'weekly' },
  { label: 'Tasks', to: '/tasks', icon: 'tasks' },
  { label: 'Analytics', to: '/stats', icon: 'analytics' },
  { label: 'Settings', to: '/settings', icon: 'settings' },
] as const

function NavIcon({ kind }: { kind: 'timeline' | 'weekly' | 'tasks' | 'analytics' | 'settings' }) {
  if (kind === 'timeline') {
    return (
      <svg className="nav-item-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 16l5-5 4 4 7-7" />
        <circle cx="4" cy="16" r="1.5" />
        <circle cx="9" cy="11" r="1.5" />
        <circle cx="13" cy="15" r="1.5" />
        <circle cx="20" cy="8" r="1.5" />
      </svg>
    )
  }

  if (kind === 'weekly') {
    return (
      <svg className="nav-item-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
        <path d="M8 4v16M12 4v16M16 4v16" />
      </svg>
    )
  }

  if (kind === 'tasks') {
    return (
      <svg className="nav-item-icon" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="9" />
        <path d="M8 12l2.5 2.5L16 9" />
      </svg>
    )
  }

  if (kind === 'analytics') {
    return (
      <svg className="nav-item-icon" viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3" y="4" width="18" height="16" rx="2" ry="2" />
        <path d="M8 16v-4M12 16V8M16 16v-6" />
      </svg>
    )
  }

  return (
    <svg className="nav-item-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4M12 16h.01" />
    </svg>
  )
}

function titleFromPath(pathname: string) {
  if (pathname.startsWith('/settings')) return 'Settings'
  if (pathname.startsWith('/stats')) return 'Analytics & Trends'
  if (pathname.startsWith('/tasks')) return 'Tasks'
  if (pathname.startsWith('/week')) return 'Week'
  return 'Timeline'
}

export function DesktopShell() {
  const location = useLocation()

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Primary">
        <div className="brand">Rhythm</div>
        <nav className="nav-list">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `nav-item${isActive ? ' nav-item-active' : ''}`
              }
            >
              <NavIcon kind={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <h1>{titleFromPath(location.pathname)}</h1>
          <span className="topbar-meta">Rhythm Web</span>
        </header>

        <main className="content-area">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
