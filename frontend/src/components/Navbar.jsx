import { NavLink, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { auth, googleProvider, signInWithPopup, getAuth, signOut } from '../firebase'
import { useState } from 'react'

const NAV = [
  { path: '/',            label: 'Map',         icon: '🗺️' },
  { path: '/report',      label: 'Report',      icon: '📸' },
  { path: '/leaderboard', label: 'Leaderboard', icon: '🏆' },
]

export default function Navbar() {
  const { user, displayName, isAnonymous } = useAuth()
  const [busy, setBusy]       = useState(false)
  const [open, setOpen]       = useState(false)
  const loc = useLocation()

  async function handleAuth() {
    setBusy(true)
    try {
      if (isAnonymous) {
        await signInWithPopup(auth, googleProvider)
      } else {
        await signOut(auth)
      }
    } catch (e) {
      console.error('Auth error', e)
    } finally {
      setBusy(false)
    }
  }

  return (
    <nav style={{
      position: 'sticky', top: 0, zIndex: 1000,
      background: 'rgba(5, 5, 15, 0.88)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      borderBottom: '1px solid var(--surface-border)',
    }}>
      <div style={{
        maxWidth: 1200, margin: '0 auto', padding: '0 20px',
        display: 'flex', alignItems: 'center', height: 60, gap: 16,
      }}>

        {/* Logo */}
        <NavLink to="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <div style={{
            width: 34, height: 34, borderRadius: 10, flexShrink: 0,
            background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-400))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem',
            boxShadow: '0 2px 12px rgba(99,102,241,0.35)',
          }}>🛡️</div>
          <span style={{
            fontWeight: 800, fontSize: '1.05rem', whiteSpace: 'nowrap',
            background: 'linear-gradient(135deg, var(--text-primary), var(--color-primary-300))',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
          }}>Community Hero</span>
        </NavLink>

        {/* Desktop nav — centered */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, justifyContent: 'center' }}
          className="desk-nav">
          {NAV.map(item => (
            <NavLink key={item.path} to={item.path} style={{ textDecoration: 'none' }}>
              <button className={`btn-ghost${loc.pathname === item.path ? ' active' : ''}`}>
                <span>{item.icon}</span><span>{item.label}</span>
              </button>
            </NavLink>
          ))}
        </div>

        {/* Auth */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {!isAnonymous && user?.photoURL && (
            <img src={user.photoURL} alt="" style={{
              width: 28, height: 28, borderRadius: '50%',
              border: '1.5px solid var(--surface-border)',
            }} />
          )}
          {!isAnonymous && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
              className="desk-nav">
              {displayName}
            </span>
          )}
          <button onClick={handleAuth} disabled={busy} className="btn-secondary"
            style={{ padding: '7px 13px', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
            {busy ? '…' : isAnonymous ? '🔑 Sign in' : 'Sign out'}
          </button>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setOpen(!open)} className="mob-toggle"
          style={{
            display: 'none', background: 'none', border: 'none',
            color: 'var(--text-primary)', fontSize: '1.4rem', cursor: 'pointer', padding: 6,
          }}>
          {open ? '✕' : '☰'}
        </button>
      </div>

      {/* Mobile dropdown */}
      {open && (
        <div style={{
          padding: '8px 16px 16px', borderTop: '1px solid var(--surface-border)',
          display: 'flex', flexDirection: 'column', gap: 4,
        }}>
          {NAV.map(item => (
            <NavLink key={item.path} to={item.path} style={{ textDecoration: 'none' }}
              onClick={() => setOpen(false)}>
              <button className={`btn-ghost${loc.pathname === item.path ? ' active' : ''}`}
                style={{ width: '100%', justifyContent: 'flex-start', padding: '11px 14px' }}>
                <span>{item.icon}</span><span>{item.label}</span>
              </button>
            </NavLink>
          ))}
        </div>
      )}

      <style>{`
        @media (max-width: 700px) {
          .desk-nav { display: none !important; }
          .mob-toggle { display: block !important; }
        }
      `}</style>
    </nav>
  )
}
