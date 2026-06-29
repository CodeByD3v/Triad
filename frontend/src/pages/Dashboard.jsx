import { useEffect, useState, useCallback } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import SeverityBadge from '../components/SeverityBadge'
import 'leaflet/dist/leaflet.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const SEV_COLOR = s => s >= 8 ? '#ef4444' : s >= 5 ? '#f59e0b' : '#22c55e'
const FILTERS   = ['all','Reported','Verified','In-Progress','Escalated','Resolved']
const sc        = s => s?.toLowerCase().replace(/[^a-z]/g,'-') || 'reported'

function MapResizer() {
  const map = useMap()
  useEffect(() => { setTimeout(() => map.invalidateSize(), 150) }, [map])
  return null
}

function FlyToUser() {
  const map = useMap()
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      p => map.flyTo([p.coords.latitude, p.coords.longitude], 13, { duration: 1.5 }),
      () => {},
      { timeout: 6000 }
    )
  }, [map])
  return null
}

export default function Dashboard() {
  const [issues, setIssues]     = useState([])
  const [hotspots, setHotspots] = useState([])
  const [filter, setFilter]     = useState('all')
  const [view, setView]         = useState('map')
  const [loading, setLoading]   = useState(true)
  const [offline, setOffline]   = useState(false)
  const navigate = useNavigate()

  const load = useCallback(async () => {
    setLoading(true); setOffline(false)
    try {
      const [ir, hr] = await Promise.all([
        fetch(`${API_BASE}/api/issues?limit=200`),
        fetch(`${API_BASE}/api/analytics/hotspots`).catch(() => null),
      ])
      if (!ir.ok) throw new Error()
      const [id, hd] = await Promise.all([
        ir.json(),
        hr?.ok ? hr.json() : { hotspots: [] },
      ])
      setIssues(id.issues || [])
      setHotspots(hd.hotspots || [])
    } catch { setOffline(true) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered  = filter === 'all' ? issues : issues.filter(i => i.status === filter)
  const resolved  = issues.filter(i => i.status === 'Resolved').length
  const escalated = issues.filter(i => i.status === 'Escalated').length

  return (
    <div className="animate-fade-in" style={{ display:'flex', flexDirection:'column', flex:1, minHeight:0 }}>

      {/* Offline banner */}
      {offline && (
        <div style={{ padding:'0 20px', maxWidth:1200, margin:'12px auto 0', width:'100%' }}>
          <div className="alert-banner error" style={{ justifyContent:'space-between' }}>
            <span style={{ display:'flex', gap:8, alignItems:'center' }}>
              <span>⚠️</span> Backend unreachable — check your API server
            </span>
            <button className="btn-secondary" onClick={load}
              style={{ padding:'4px 12px', fontSize:'0.78rem', flexShrink:0 }}>
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ padding:'20px 20px 0', maxWidth:1200, margin:'0 auto', width:'100%' }}>

        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(110px,1fr))', gap:10, marginBottom:20 }}>
          {[
            { label:'Total Issues',  value: issues.length,  color:'var(--color-primary-300)' },
            { label:'Resolved',      value: resolved,       color:'var(--severity-low)' },
            { label:'Escalated',     value: escalated,      color:'var(--severity-high)' },
            { label:'Active Wards',  value: [...new Set(issues.map(i => i.location?.ward_name).filter(Boolean))].length, color:'var(--severity-medium)' },
          ].map(s => (
            <div key={s.label} className="glass-card" style={{ padding:'14px 18px' }}>
              <div style={{ fontSize:'1.55rem', fontWeight:800, color:s.color, lineHeight:1 }}>{s.value}</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text-muted)', marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Controls row */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12, flexWrap:'wrap', gap:10 }}>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
            {FILTERS.map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={`filter-pill${filter===f?' active':''}`}>
                {f === 'all' ? 'All' : f}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:6 }}>
            <button className={`btn-ghost${view==='map'?' active':''}`} onClick={() => setView('map')}>🗺️ Map</button>
            <button className={`btn-ghost${view==='list'?' active':''}`} onClick={() => setView('list')}>📋 List</button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ flex:1, padding:'0 20px 24px', maxWidth:1200, margin:'0 auto', width:'100%', display:'flex', flexDirection:'column' }}>

        {loading ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:12, color:'var(--text-secondary)', minHeight:400 }}>
            <div className="spinner dark" /> Loading issues…
          </div>

        ) : view === 'map' ? (
          <>
            <div style={{ flex:1, borderRadius:'var(--radius-lg)', overflow:'hidden', minHeight:460 }}>
              <MapContainer center={[20.5937,78.9629]} zoom={5}
                style={{ width:'100%', height:'100%', minHeight:460 }}>
                <MapResizer />
                <FlyToUser />
                <TileLayer
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                  attribution='&copy; <a href="https://carto.com/">CARTO</a>'
                />

                {filtered.map(issue => (
                  <CircleMarker key={issue.id}
                    center={[issue.location?.latitude||0, issue.location?.longitude||0]}
                    radius={issue.upvotes > 10 ? 10 : 7}
                    fillColor={SEV_COLOR(issue.severity_score)}
                    color="rgba(255,255,255,0.25)" weight={1} fillOpacity={0.88}
                    eventHandlers={{ click: () => navigate(`/issue/${issue.id}`) }}>
                    <Popup>
                      <div style={{ minWidth:190 }}>
                        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
                          <span className={`status-badge ${sc(issue.status)}`}>{issue.status}</span>
                          <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                            {issue.upvotes} 👍
                          </span>
                        </div>
                        <strong style={{ fontSize:'0.88rem', display:'block', marginBottom:4 }}>{issue.category}</strong>
                        <p style={{ fontSize:'0.78rem', color:'var(--text-secondary)', margin:'0 0 8px', lineHeight:1.4 }}>
                          {issue.summary}
                        </p>
                        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
                          <SeverityBadge score={issue.severity_score} />
                          <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>
                            📍 {issue.location?.ward_name}
                          </span>
                        </div>
                        <button onClick={e => { e.stopPropagation(); navigate(`/issue/${issue.id}`) }}
                          className="btn-primary" style={{ width:'100%', padding:'7px 0', fontSize:'0.78rem' }}>
                          View Details & Generate Letter →
                        </button>
                      </div>
                    </Popup>
                  </CircleMarker>
                ))}

                {hotspots.filter(h => h.risk_level === 'High').map((h, i) => (
                  <CircleMarker key={i} center={[h.cluster_lat, h.cluster_lng]}
                    radius={32} fillColor="#ef4444" color="#ef4444"
                    weight={1.5} fillOpacity={0.08} dashArray="5 4">
                    <Popup>
                      <strong style={{ color:'#fca5a5' }}>⚠ Predicted Risk Zone</strong>
                      <p style={{ margin:'5px 0 3px', fontSize:'0.82rem' }}>{h.predicted_hazard_type}</p>
                      <p style={{ fontSize:'0.76rem', color:'var(--text-muted)', margin:0 }}>{h.preventative_recommendation}</p>
                    </Popup>
                  </CircleMarker>
                ))}
              </MapContainer>
            </div>

            {/* Legend */}
            <div className="glass-card" style={{
              display:'flex', gap:16, padding:'9px 16px', marginTop:10,
              fontSize:'0.78rem', color:'var(--text-secondary)', flexWrap:'wrap', alignItems:'center',
            }}>
              {[['high','High (8–10)'],['medium','Medium (5–7)'],['low','Low (1–4)']].map(([cls,label]) => (
                <span key={cls} style={{ display:'flex', alignItems:'center', gap:5 }}>
                  <span className={`severity-dot ${cls}`} /> {label}
                </span>
              ))}
              <span style={{ display:'flex', alignItems:'center', gap:5 }}>
                <span style={{ width:11,height:11,borderRadius:'50%',border:'1.5px dashed #ef4444',background:'rgba(239,68,68,0.12)',flexShrink:0 }} />
                Predicted Risk
              </span>
              <span style={{ marginLeft:'auto', fontSize:'0.72rem', color:'var(--text-muted)' }}>
                Click marker for details
              </span>
            </div>
          </>

        ) : (
          <div style={{ display:'grid', gap:10 }}>
            {filtered.length === 0 ? (
              <div className="glass-card" style={{ padding:40, textAlign:'center', color:'var(--text-muted)' }}>
                No issues match this filter
              </div>
            ) : filtered.map(issue => (
              <div key={issue.id} className="glass-card hoverable"
                style={{ padding:'14px 18px', cursor:'pointer', display:'flex', gap:14, alignItems:'flex-start' }}
                onClick={() => navigate(`/issue/${issue.id}`)}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:6, flexWrap:'wrap' }}>
                    <span className={`status-badge ${sc(issue.status)}`}>{issue.status}</span>
                    <SeverityBadge score={issue.severity_score} />
                  </div>
                  <h3 style={{ fontSize:'0.95rem', fontWeight:600, margin:'0 0 3px', color:'var(--text-primary)' }}>
                    {issue.category}
                  </h3>
                  <p style={{ fontSize:'0.82rem', color:'var(--text-secondary)', margin:0, lineHeight:1.5 }}>
                    {issue.summary}
                  </p>
                  <div style={{ display:'flex', gap:14, marginTop:8, fontSize:'0.75rem', color:'var(--text-muted)' }}>
                    <span>📍 {issue.location?.ward_name || 'Unknown'}</span>
                    <span>👍 {issue.upvotes}</span>
                  </div>
                </div>
                {issue.image_url && (
                  <img src={issue.image_url} alt=""
                    style={{ width:76, height:76, borderRadius:'var(--radius-md)', objectFit:'cover', border:'1px solid var(--surface-border)', flexShrink:0 }} />
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
