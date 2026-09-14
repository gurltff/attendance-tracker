import {
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useState,
} from 'react'
import { createPortal } from 'react-dom'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { logOut } from '../services/authService'
import type { Role } from '../types'

/* =========================================================
   NAVBAR
   ========================================================= */

export function Navbar() {
  const { user, setUser } = useAuth()
  const { dark, toggle } = useTheme()

  const home =
    user?.role === 'cr'
      ? '/cr'
      : user?.role === 'teacher'
        ? '/teacher'
        : '/student'

  /*
   * IMPORTANT:
   * Render the navbar directly into document.body.
   *
   * This prevents any parent page/container with:
   * - overflow
   * - transform
   * - translate
   * - scale
   * - filter
   *
   * from affecting the fixed navbar.
   */
  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <header
      className="app-navbar"
      style={{
        position: 'absolute',
        inset: '0 0 auto 0',
        zIndex: 2147483647,
      }}
    >
      <nav className="app-navbar-inner">
        {/* LEFT SIDE */}
        <Link
          to={user ? home : '/'}
          className="navbar-brand"
        >
          <span className="navbar-logo">
            ✓
          </span>

          <span className="navbar-title">
            Smart Attendance Tracker
          </span>
        </Link>

        {/* RIGHT SIDE */}
        <div className="navbar-actions">

          {/* DARK / LIGHT MODE */}
          <button
            type="button"
            className="navbar-theme-button"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {dark ? '☀️' : '🌙'}
          </button>

          {/* USER */}
          {user && (
            <>
              <span className="navbar-user">
                {user.name} · {user.role}
              </span>

              <button
                type="button"
                className="navbar-logout"
                onClick={async () => {
                  await logOut()
                  setUser(null)
                }}
              >
                Log out
              </button>
            </>
          )}
        </div>
      </nav>
    </header>,
    document.body,
  )
}

/* =========================================================
   PROTECTED ROUTE
   ========================================================= */

export function ProtectedRoute({
  role,
  children,
}: {
  role: Role
  children: ReactNode
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="p-8 text-center text-ink-muted">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  if (user.role !== role) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

export function AuthenticatedRoute({
  children,
}: {
  children: ReactNode
}) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="p-8 text-center text-ink-muted">
        Loading…
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}

/* =========================================================
   TOAST
   ========================================================= */

interface Toast {
  id: number
  text: string
  kind: 'success' | 'error' | 'info'
}

const ToastCtx = createContext<{
  push: (text: string, kind?: Toast['kind']) => void
}>({
  push: () => {},
})

export function ToastProvider({
  children,
}: {
  children: ReactNode
}) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const push = useCallback(
    (
      text: string,
      kind: Toast['kind'] = 'info',
    ) => {
      const id = Date.now()

      setToasts((t) => [
        ...t,
        {
          id,
          text,
          kind,
        },
      ])

      setTimeout(() => {
        setToasts((t) =>
          t.filter((x) => x.id !== id),
        )
      }, 4000)
    },
    [],
  )

  return (
    <ToastCtx.Provider value={{ push }}>
      {children}

      <div className="fixed bottom-4 right-4 z-[999999] space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`px-4 py-2.5 rounded-full shadow-pop border-2 border-ink text-ink text-sm font-semibold ${
              t.kind === 'success'
                ? 'bg-sage'
                : t.kind === 'error'
                  ? 'bg-blush'
                  : 'bg-butter'
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}

/* =========================================================
   EMPTY STATE
   ========================================================= */

export function EmptyState({
  text,
}: {
  text: string
}) {
  return (
    <div className="text-center text-sm text-ink-muted py-10">
      {text}
    </div>
  )
}