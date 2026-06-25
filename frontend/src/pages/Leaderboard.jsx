import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const BADGE_META = {
  first_reporter:   { icon: '🌱', label: 'First Reporter',   desc: 'Submitted your first issue' },
  community_helper: { icon: '🤝', label: 'Community Helper', desc: 'Confirmed 10+ existing issues' },
  civic_champion:   { icon: '🏆', label: 'Civic Champion',   desc: 'Earned 200+ XP' },
  ward_guardian:    { icon: '🛡️', label: 'Ward Guardian',   desc: 'Earned 500+ XP' },
}

const XP_ACTIONS = [
  { action: 'Submit a new issue',        xp: '+20 XP' },
  { action: 'Confirm an existing issue', xp: '+5 XP'  },
  { action: 'Issue gets verified',       xp: '+10 XP' },
  { action: 'Upvote a report',           xp: '+2 XP'  },
]

const TABS = [
  { key: 'citizens', label: '👤 Citizens' },
  { key: 'wards',    label: '🏘 Wards'    },
  { key: 'badges',   label: '🏅 Badges'   },
]

export default function Leaderboard() {
  const { uid }                   = useAuth()
  const [users, setUsers]         = useState([])
  const [wards, setWards]         = useState([])
  const [tab, setTab]             = useState('citizens')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/leaderboard?limit=20`).then(r => r.json()),
      fetch(`${API_BASE}/api/analytics/transparency`).then(r => r.json()),
    ]).then(([lb, tr]) => {
      setUsers(lb.leaderboard || [])
      setWards(tr.wards || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: 680 }}>

      <h1 className="page-title">Community Leaderboard</h1>
      <p className="page-subtitle">Earn XP by reporting and verifying civic issues in your ward</p>

      {/* XP guide */}
      <div className="glass-card" style={{ padding: 16, marginBottom: 20, borderColor: 'rgba(99,102,241,0.25)' }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>
          How to earn XP
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {XP_ACTIONS.map(({ action, xp }) => (
            <div key={action} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              background: 'var(--surface-elevated)', borderRadius: 'var(--radius-sm)',
              padding: '8px 12px', fontSize: '0.82rem',
            }}>
              <span style={{ color: 'var(--text-secondary)' }}>{action}</span>
              <span className="xp-badge" style={{ marginLeft: 8 }}>{xp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{
        display: 'flex', background: 'var(--surface-elevated)',
        borderRadius: 'var(--radius-md)', padding: 4, marginBottom: 16,
        border: '1px solid var(--surface-border)',
      }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)}
            style={{
              flex: 1, padding: '8px 0', borderRadius: 'var(--radius-sm)',
              border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500,
              transition: 'all var(--transition-fast)',
              background: tab === key ? 'var(--surface-card)' : 'transparent',
              color: tab === key ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: tab === key ? 'var(--shadow-card)' : 'none',
            }}>
            {label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40, gap: 12, color: 'var(--text-secondary)' }}>
          <div style={{
            width: 24, height: 24, border: '3px solid var(--surface-border)',
            borderTopColor: 'var(--color-primary-500)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite',
          }} />
          Loading…
        </div>
      )}

      {/* ── Citizens tab ── */}
      {!loading && tab === 'citizens' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {users.length === 0 && (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No citizens yet — be the first!
            </div>
          )}
          {users.map((user, i) => {
            const isMe = user.uid === uid
            const rankIcon = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`
            const rankBg   = i === 0 ? 'rgba(245,158,11,0.15)' : i === 1 ? 'rgba(148,163,184,0.15)' : i === 2 ? 'rgba(234,88,12,0.15)' : 'rgba(99,102,241,0.1)'
            return (
              <div key={user.uid} className="glass-card"
                style={{
                  padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14,
                  borderColor: isMe ? 'rgba(99,102,241,0.4)' : undefined,
                }}>
                {/* Rank */}
                <div style={{
                  width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                  background: rankBg, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', fontSize: i < 3 ? '1.1rem' : '0.8rem',
                  fontWeight: 700, color: 'var(--text-primary)',
                }}>{rankIcon}</div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: '0 0 3px', fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {user.display_name || user.uid?.slice(0, 10) || 'Anonymous'}
                    {isMe && <span style={{ fontSize: '0.7rem', background: 'rgba(99,102,241,0.2)', color: 'var(--text-accent)', padding: '1px 6px', borderRadius: 99 }}>You</span>}
                  </p>
                  {user.badges?.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                      {user.badges.map(b => (
                        <span key={b} style={{
                          fontSize: '0.72rem', padding: '1px 8px', borderRadius: 99,
                          background: 'var(--surface-elevated)', color: 'var(--text-secondary)',
                          border: '1px solid var(--surface-border)',
                        }}>
                          {BADGE_META[b]?.icon} {BADGE_META[b]?.label || b}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* XP */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <p style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: 'var(--color-primary-400)' }}>{user.xp || 0}</p>
                  <p style={{ margin: 0, fontSize: '0.7rem', color: 'var(--text-muted)' }}>XP</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Wards tab ── */}
      {!loading && tab === 'wards' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: 4 }}>
            Transparency Score = issues resolved ÷ issues raised (last 30 days) × 100
          </p>
          {wards.length === 0 && (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No ward data yet — submit some issues first
            </div>
          )}
          {wards.map((ward, i) => {
            const score = ward.transparency_score || 0
            const barColor = score >= 70 ? 'var(--severity-low)' : score >= 40 ? 'var(--severity-medium)' : 'var(--severity-high)'
            return (
              <div key={ward.ward_name} className="glass-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      #{i + 1} {ward.ward_name}
                    </p>
                    <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {ward.issues_resolved}/{ward.issues_raised} issues resolved
                    </p>
                  </div>
                  <span style={{
                    fontWeight: 800, fontSize: '1.1rem', padding: '4px 14px',
                    borderRadius: 'var(--radius-full)', background: `${barColor}22`,
                    color: barColor, border: `1px solid ${barColor}44`,
                  }}>{score}%</span>
                </div>
                {/* Progress bar */}
                <div style={{ height: 6, background: 'var(--surface-border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${score}%`, background: barColor, borderRadius: 99, transition: 'width 1s ease-out' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Badges tab ── */}
      {!loading && tab === 'badges' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {Object.entries(BADGE_META).map(([key, { icon, label, desc }]) => (
            <div key={key} className="glass-card" style={{ padding: 20, textAlign: 'center' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: 8 }}>{icon}</div>
              <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{label}</p>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-muted)' }}>{desc}</p>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
