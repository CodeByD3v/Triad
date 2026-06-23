import { useEffect, useState } from 'react'
import TransparencyScore from '../components/TransparencyScore'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const BADGE_INFO = {
  first_reporter: { icon: '🎯', label: 'First Reporter', desc: 'Submitted your first report' },
  community_helper: { icon: '🤝', label: 'Community Helper', desc: 'Earned 50 XP' },
  civic_champion: { icon: '🏅', label: 'Civic Champion', desc: 'Earned 200 XP' },
  ward_guardian: { icon: '🛡️', label: 'Ward Guardian', desc: 'Earned 500 XP' },
  verifier: { icon: '✅', label: 'Verifier', desc: 'Verified a community issue' },
}

const RANK_ICONS = ['👑', '🥈', '🥉']

export default function Leaderboard() {
  const [leaders, setLeaders] = useState([])
  const [wards, setWards] = useState([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('citizens') // 'citizens' or 'wards'

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/leaderboard?limit=20`).then(r => r.json()).catch(() => ({ leaderboard: [] })),
      fetch(`${API_BASE}/api/analytics/transparency`).then(r => r.json()).catch(() => ({ wards: [] })),
    ]).then(([leaderData, wardData]) => {
      setLeaders(leaderData.leaderboard || [])
      setWards(wardData.wards || [])
      setLoading(false)
    })
  }, [])

  return (
    <div className="page-container animate-fade-in">
      <h1 className="page-title">Leaderboard</h1>
      <p className="page-subtitle">Top community heroes making a difference</p>

      {/* Tab Switcher */}
      <div style={{
        display: 'flex',
        gap: 8,
        marginBottom: 24,
      }}>
        <button
          className={`filter-pill ${tab === 'citizens' ? 'active' : ''}`}
          onClick={() => setTab('citizens')}
        >
          👤 Top Citizens
        </button>
        <button
          className={`filter-pill ${tab === 'wards' ? 'active' : ''}`}
          onClick={() => setTab('wards')}
        >
          🏘️ Ward Transparency
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: 12 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="skeleton" style={{ height: 72, borderRadius: 'var(--radius-lg)' }} />
          ))}
        </div>
      ) : tab === 'citizens' ? (
        /* Citizens Leaderboard */
        <div>
          {/* Top 3 Podium */}
          {leaders.length >= 3 && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 12,
              marginBottom: 24,
            }}>
              {[1, 0, 2].map((idx) => {
                const user = leaders[idx]
                if (!user) return null
                const isFirst = idx === 0
                return (
                  <div
                    key={user.uid}
                    className="glass-card"
                    style={{
                      padding: isFirst ? '24px 16px' : '20px 16px',
                      textAlign: 'center',
                      transform: isFirst ? 'scale(1.05)' : 'none',
                      zIndex: isFirst ? 1 : 0,
                      borderColor: isFirst ? 'rgba(245, 158, 11, 0.3)' : undefined,
                    }}
                  >
                    <div style={{
                      fontSize: isFirst ? '2rem' : '1.5rem',
                      marginBottom: 8,
                    }}>
                      {RANK_ICONS[idx]}
                    </div>
                    <div style={{
                      width: isFirst ? 56 : 44,
                      height: isFirst ? 56 : 44,
                      borderRadius: '50%',
                      background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-primary-400))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      margin: '0 auto 8px',
                      fontSize: isFirst ? '1.2rem' : '1rem',
                      fontWeight: 800,
                      color: 'white',
                    }}>
                      {(user.display_name || user.uid)?.[0]?.toUpperCase() || '?'}
                    </div>
                    <p style={{
                      fontWeight: 600,
                      fontSize: isFirst ? '0.95rem' : '0.85rem',
                      margin: '0 0 4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {user.display_name || user.uid?.slice(0, 8)}
                    </p>
                    <span className="xp-badge" style={{ fontSize: '0.7rem' }}>
                      ⚡ {user.xp || 0} XP
                    </span>
                    {user.badges && user.badges.length > 0 && (
                      <div style={{ marginTop: 8, display: 'flex', gap: 4, justifyContent: 'center', flexWrap: 'wrap' }}>
                        {user.badges.map(b => (
                          <span key={b} title={BADGE_INFO[b]?.label} style={{ fontSize: '0.9rem' }}>
                            {BADGE_INFO[b]?.icon || '🏷️'}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Rest of the list */}
          <div style={{ display: 'grid', gap: 8 }}>
            {leaders.slice(3).map((user, i) => (
              <div
                key={user.uid}
                className="glass-card"
                style={{
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <span style={{
                  width: 28,
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: 'var(--text-muted)',
                }}>
                  #{i + 4}
                </span>
                <div style={{
                  width: 36,
                  height: 36,
                  borderRadius: '50%',
                  background: 'var(--surface-elevated)',
                  border: '1px solid var(--surface-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  color: 'var(--text-accent)',
                  flexShrink: 0,
                }}>
                  {(user.display_name || user.uid)?.[0]?.toUpperCase() || '?'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    margin: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {user.display_name || user.uid?.slice(0, 12)}
                  </p>
                  {user.badges && user.badges.length > 0 && (
                    <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
                      {user.badges.map(b => (
                        <span key={b} style={{ fontSize: '0.75rem' }}>{BADGE_INFO[b]?.icon || '🏷️'}</span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="xp-badge">⚡ {user.xp || 0} XP</span>
              </div>
            ))}
          </div>

          {leaders.length === 0 && (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No citizens on the leaderboard yet. Be the first to report an issue!
            </div>
          )}

          {/* Badge Legend */}
          <div className="glass-card" style={{ padding: 20, marginTop: 24 }}>
            <h3 style={{
              fontSize: '0.8rem',
              fontWeight: 600,
              color: 'var(--text-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginBottom: 12,
            }}>
              🏆 Available Badges
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {Object.entries(BADGE_INFO).map(([key, info]) => (
                <div key={key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 12px',
                  background: 'var(--surface-elevated)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  <span style={{ fontSize: '1.2rem' }}>{info.icon}</span>
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '0.8rem', margin: 0 }}>{info.label}</p>
                    <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', margin: 0 }}>{info.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        /* Ward Transparency Scores */
        <div>
          {wards.length === 0 ? (
            <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
              No ward data available yet. Submit issues to start building transparency scores.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
              {wards.map((ward, i) => (
                <div key={ward.ward_name} className="glass-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1 }}>
                      <h3 style={{
                        fontSize: '1rem',
                        fontWeight: 700,
                        margin: '0 0 4px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {ward.ward_name}
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: '0 0 12px' }}>
                        Rank #{i + 1}
                      </p>
                      <div style={{ display: 'grid', gap: 6, fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Issues Raised</span>
                          <span style={{ fontWeight: 600 }}>{ward.issues_raised || 0}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-secondary)' }}>Issues Resolved</span>
                          <span style={{ fontWeight: 600, color: '#86efac' }}>{ward.issues_resolved || 0}</span>
                        </div>
                      </div>
                    </div>
                    <TransparencyScore
                      score={ward.transparency_score || 0}
                      size={80}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
