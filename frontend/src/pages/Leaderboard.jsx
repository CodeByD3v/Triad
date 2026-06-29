import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const BADGES = {
  first_reporter:   { icon:'🌱', label:'First Reporter',   desc:'Submitted your first issue' },
  community_helper: { icon:'🤝', label:'Community Helper', desc:'Confirmed 10+ issues' },
  civic_champion:   { icon:'🏆', label:'Civic Champion',   desc:'Earned 200+ XP' },
  ward_guardian:    { icon:'🛡️', label:'Ward Guardian',   desc:'Earned 500+ XP' },
}

const XP_GUIDE = [
  { action:'Report a new issue',      xp:'+20 XP' },
  { action:'Confirm existing issue',  xp:'+5 XP'  },
  { action:'Issue gets verified',     xp:'+10 XP' },
  { action:'Upvote a report',         xp:'+2 XP'  },
]

const TABS = [
  { key:'citizens', label:'👤 Citizens' },
  { key:'wards',    label:'🏘 Wards'    },
  { key:'badges',   label:'🏅 Badges'   },
]

export default function Leaderboard() {
  const { uid }               = useAuth()
  const [users, setUsers]     = useState([])
  const [wards, setWards]     = useState([])
  const [tab, setTab]         = useState('citizens')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/leaderboard?limit=20`).then(r => r.json()),
      fetch(`${API_BASE}/api/analytics/transparency`).then(r => r.json()),
    ])
    .then(([lb, tr]) => { setUsers(lb.leaderboard || []); setWards(tr.wards || []) })
    .catch(() => {})
    .finally(() => setLoading(false))
  }, [])

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth:700 }}>

      <h1 className="page-title">Community Leaderboard</h1>
      <p className="page-subtitle">Earn XP by reporting and verifying civic issues</p>

      {/* XP guide */}
      <div className="glass-card" style={{ padding:18, marginBottom:20 }}>
        <p style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--color-primary-400)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
          How to earn XP
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
          {XP_GUIDE.map(({ action, xp }) => (
            <div key={action} style={{
              display:'flex', justifyContent:'space-between', alignItems:'center',
              background:'var(--surface-elevated)', borderRadius:'var(--radius-sm)',
              padding:'8px 12px',
            }}>
              <span style={{ fontSize:'0.81rem', color:'var(--text-secondary)' }}>{action}</span>
              <span className="xp-badge">{xp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{
        display:'flex', gap:3, background:'var(--surface-elevated)',
        borderRadius:'var(--radius-md)', padding:4, marginBottom:18,
        border:'1px solid var(--surface-border)',
      }}>
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex:1, padding:'8px 0', border:'none', cursor:'pointer',
            borderRadius:'var(--radius-sm)', fontSize:'0.84rem', fontWeight:500,
            background: tab===key ? 'var(--surface-card)' : 'transparent',
            color: tab===key ? 'var(--text-primary)' : 'var(--text-muted)',
            boxShadow: tab===key ? 'var(--shadow-card)' : 'none',
            transition:'all var(--transition)',
          }}>{label}</button>
        ))}
      </div>

      {loading && (
        <div style={{ display:'flex', justifyContent:'center', padding:48, gap:12, color:'var(--text-secondary)' }}>
          <div className="spinner dark" /> Loading…
        </div>
      )}

      {/* Citizens */}
      {!loading && tab === 'citizens' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {users.length === 0 ? (
            <div className="glass-card" style={{ padding:48, textAlign:'center', color:'var(--text-muted)' }}>
              No citizens yet — be the first to report!
            </div>
          ) : users.map((u, i) => {
            const isMe   = u.uid === uid
            const medal  = i===0?'🥇':i===1?'🥈':i===2?'🥉':`#${i+1}`
            const rankBg = i===0?'rgba(245,158,11,0.14)':i===1?'rgba(148,163,184,0.12)':i===2?'rgba(234,88,12,0.12)':'rgba(99,102,241,0.08)'
            return (
              <div key={u.uid} className="glass-card"
                style={{ padding:'13px 18px', display:'flex', alignItems:'center', gap:14,
                         borderColor: isMe ? 'rgba(99,102,241,0.35)' : undefined }}>
                <div style={{
                  width:36, height:36, borderRadius:'50%', flexShrink:0,
                  background:rankBg, display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize: i<3 ? '1.1rem' : '0.8rem', fontWeight:700,
                }}>{medal}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ margin:'0 0 3px', fontWeight:600, fontSize:'0.93rem', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                    {u.display_name || u.uid?.slice(0,10) || 'Anonymous'}
                    {isMe && <span style={{ fontSize:'0.68rem', background:'rgba(99,102,241,0.18)', color:'var(--text-accent)', padding:'1px 7px', borderRadius:99 }}>You</span>}
                  </p>
                  {u.badges?.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                      {u.badges.map(b => (
                        <span key={b} style={{
                          fontSize:'0.7rem', padding:'1px 8px', borderRadius:99,
                          background:'var(--surface-elevated)', color:'var(--text-secondary)',
                          border:'1px solid var(--surface-border)',
                        }}>{BADGES[b]?.icon} {BADGES[b]?.label || b}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  <div style={{ fontWeight:800, fontSize:'1.2rem', color:'var(--color-primary-300)', lineHeight:1 }}>{u.xp||0}</div>
                  <div style={{ fontSize:'0.68rem', color:'var(--text-muted)', marginTop:2 }}>XP</div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Wards */}
      {!loading && tab === 'wards' && (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', marginBottom:4 }}>
            Score = issues resolved ÷ raised (last 30 days) × 100
          </p>
          {wards.length === 0 ? (
            <div className="glass-card" style={{ padding:48, textAlign:'center', color:'var(--text-muted)' }}>
              No ward data yet
            </div>
          ) : wards.map((w, i) => {
            const score = w.transparency_score || 0
            const color = score>=70 ? 'var(--severity-low)' : score>=40 ? 'var(--severity-medium)' : 'var(--severity-high)'
            return (
              <div key={w.ward_name} className="glass-card" style={{ padding:16 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div>
                    <p style={{ margin:'0 0 2px', fontWeight:600, fontSize:'0.93rem' }}>#{i+1} {w.ward_name}</p>
                    <p style={{ margin:0, fontSize:'0.76rem', color:'var(--text-muted)' }}>
                      {w.issues_resolved}/{w.issues_raised} issues resolved
                    </p>
                  </div>
                  <span style={{
                    fontWeight:800, fontSize:'1.05rem', padding:'4px 13px',
                    borderRadius:'var(--radius-full)', color,
                    background:`color-mix(in srgb, ${color} 14%, transparent)`,
                    border:`1px solid color-mix(in srgb, ${color} 30%, transparent)`,
                  }}>{score}%</span>
                </div>
                <div style={{ height:5, background:'var(--surface-border)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${score}%`, background:color, borderRadius:99, transition:'width 1.2s ease-out' }} />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Badges */}
      {!loading && tab === 'badges' && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          {Object.entries(BADGES).map(([key, { icon, label, desc }]) => (
            <div key={key} className="glass-card" style={{ padding:22, textAlign:'center' }}>
              <div style={{ fontSize:'2.2rem', marginBottom:10 }}>{icon}</div>
              <p style={{ fontWeight:600, fontSize:'0.9rem', margin:'0 0 5px' }}>{label}</p>
              <p style={{ fontSize:'0.76rem', color:'var(--text-muted)', margin:0 }}>{desc}</p>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
