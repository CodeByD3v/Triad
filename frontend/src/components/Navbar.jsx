import { NavLink, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  auth,
  googleProvider,
  onAuthStateChanged,
  signInAnonymously,
  signInWithPopup,
} from '../firebase'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: '🗺️' },
  { path: '/report', label: 'Report', icon: '📸' },
  { path: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [user, setUser] = useState(null)
  const [authBusy, setAuthBusy] = useState(false)
  const location = useLocation()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser)
      if (!currentUser) {
        try {
          await signInAnonymously(auth)
        } catch (error) {
          console.error('Anonymous sign-in failed', error)
        }
      }
    })

    return () => unsubscribe()
  }, [])

  async function handleGoogleSignIn() {
    setAuthBusy(true)
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      console.error('Google sign-in failed', error)
    } finally {
      setAuthBusy(false)
    }
  }

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      background: 'rgba(5, 5, 16, 0.85)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--surface-border)',
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        padding: '0 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: 64,
      }}>
        {/* Logo */}
        <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-400))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1.1rem',
            boxShadow: '0 2px 12px rgba(99, 102, 241, 0.3)',
          }}>
            🛡️
          </div>
          <span style={{
            fontWeight: 800,
            fontSize: '1.15rem',
            background: 'linear-gradient(135deg, var(--text-primary), var(--color-primary-300))',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Community Hero
          </span>
        </NavLink>

        {/* Desktop Nav */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }} className="desktop-nav">
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              className={`btn-ghost ${location.pathname === item.path ? 'active' : ''}`}
              style={{ textDecoration: 'none', fontSize: '0.9rem' }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            lineHeight: 1.1,
            fontSize: '0.75rem',
            color: 'var(--text-muted)',
          }}>
            <span>{user ? (user.isAnonymous ? 'Guest mode' : 'Signed in') : 'Not signed in'}</span>
            <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.displayName || user?.email || user?.uid || 'Not signed in'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={authBusy}
            className="btn-secondary"
            style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}
          >
            {authBusy ? 'Signing in…' : 'Google Sign-in'}
          </button>
        </div>

        {/* Mobile Toggle */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="mobile-toggle"
          style={{
            display: 'none',
            background: 'none',
            border: 'none',
            color: 'var(--text-primary)',
            fontSize: '1.5rem',
            cursor: 'pointer',
            padding: 8,
          }}
        >
          {mobileOpen ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileOpen && (
        <div
          className="mobile-menu"
          style={{
            padding: '8px 20px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            borderTop: '1px solid var(--surface-border)',
          }}
        >
          {NAV_ITEMS.map(item => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={() => setMobileOpen(false)}
              className={`btn-ghost ${location.pathname === item.path ? 'active' : ''}`}
              style={{ textDecoration: 'none', justifyContent: 'flex-start', padding: '12px 16px' }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-nav { display: none !important; }
          .mobile-toggle { display: block !important; }
        }
        @media (min-width: 769px) {
          .mobile-menu { display: none !important; }
        }
      `}</style>
    </nav>
  )
}
