import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet'
import { useNavigate } from 'react-router-dom'
import SeverityBadge from '../components/SeverityBadge'
import 'leaflet/dist/leaflet.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const SEVERITY_COLOR = (s) => s >= 8 ? '#ef4444' : s >= 5 ? '#f59e0b' : '#22c55e'

const STATUS_FILTERS = ['all', 'Reported', 'Verified', 'In-Progress', 'Escalated', 'Resolved']

function MapResizer() {
  const map = useMap()
  useEffect(() => {
    setTimeout(() => map.invalidateSize(), 100)
  }, [map])
  return null
}

export default function Dashboard() {
  const [issues, setIssues] = useState([])
  const [hotspots, setHotspots] = useState([])
  const [filter, setFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState('map') // 'map' or 'list'
  const navigate = useNavigate()

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/issues?limit=200`).then(r => r.json()).catch(() => ({ issues: [] })),
      fetch(`${API_BASE}/api/analytics/hotspots`).then(r => r.json()).catch(() => ({ hotspots: [] })),
    ]).then(([issuesData, hotspotsData]) => {
      setIssues(issuesData.issues || [])
      setHotspots(hotspotsData.hotspots || [])
      setLoading(false)
    })
  }, [])

  const filtered = filter === 'all' ? issues : issues.filter(i => i.status === filter)

  const statusClass = (s) => s?.toLowerCase().replace(/[^a-z]/g, '-') || 'reported'

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      {/* Header */}
      <div style={{
        padding: '20px 20px 0',
        maxWidth: 1200,
        margin: '0 auto',
        width: '100%',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 className="page-title">Dashboard</h1>
            <p className="page-subtitle" style={{ marginBottom: 16 }}>
              {issues.length} issues tracked · {issues.filter(i => i.status === 'Resolved').length} resolved
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className={`btn-ghost ${view === 'map' ? 'active' : ''}`}
              onClick={() => setView('map')}
            >
              🗺️ Map
            </button>
            <button
              className={`btn-ghost ${view === 'list' ? 'active' : ''}`}
              onClick={() => setView('list')}
            >
              📋 List
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div style={{
          display: 'flex',
          gap: 8,
          paddingBottom: 16,
          overflowX: 'auto',
        }}>
          {STATUS_FILTERS.map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`filter-pill ${filter === s ? 'active' : ''}`}
            >
              {s === 'all' ? 'All Issues' : s}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '0 20px 20px' }}>
        {loading ? (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1,
            gap: 12,
            color: 'var(--text-secondary)',
          }}>
            <div style={{
              width: 24,
              height: 24,
              border: '3px solid var(--surface-border)',
              borderTopColor: 'var(--color-primary-500)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
            }} />
            Loading issues...
          </div>
        ) : view === 'map' ? (
          /* Map View */
          <div style={{ flex: 1, borderRadius: 'var(--radius-lg)', overflow: 'hidden', minHeight: 500 }}>
            <MapContainer
              center={[20.5937, 78.9629]}
              zoom={5}
              style={{ width: '100%', height: '100%', minHeight: 500 }}
            >
              <MapResizer />
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              />

              {/* Issue markers */}
              {filtered.map(issue => (
                <CircleMarker
                  key={issue.id}
                  center={[issue.location?.latitude || 0, issue.location?.longitude || 0]}
                  radius={8}
                  fillColor={SEVERITY_COLOR(issue.severity_score)}
                  color="rgba(255,255,255,0.3)"
                  weight={1}
                  fillOpacity={0.85}
                  eventHandlers={{
                    click: () => navigate(`/issue/${issue.id}`),
                  }}
                >
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif' }}>
                      <strong style={{ fontSize: '0.9rem' }}>{issue.category}</strong>
                      <p style={{ margin: '6px 0', fontSize: '0.8rem', opacity: 0.8 }}>
                        {issue.summary}
                      </p>
                      <div style={{ display: 'flex', gap: 8, fontSize: '0.75rem', opacity: 0.7 }}>
                        <span>Severity: {issue.severity_score}/10</span>
                        <span>·</span>
                        <span>{issue.upvotes} upvotes</span>
                      </div>
                      <div style={{ marginTop: 6 }}>
                        <span className={`status-badge ${statusClass(issue.status)}`}>
                          {issue.status}
                        </span>
                      </div>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}

              {/* Hotspot overlay */}
              {hotspots.filter(h => h.risk_level === 'High').map((h, i) => (
                <CircleMarker
                  key={`hs-${i}`}
                  center={[h.cluster_lat, h.cluster_lng]}
                  radius={30}
                  fillColor="#ef4444"
                  color="#ef4444"
                  weight={2}
                  fillOpacity={0.1}
                  dashArray="6 4"
                >
                  <Popup>
                    <div style={{ fontFamily: 'Inter, sans-serif' }}>
                      <strong style={{ color: '#ef4444' }}>⚠ Predicted Risk Zone</strong>
                      <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>{h.predicted_hazard_type}</p>
                      <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>{h.preventative_recommendation}</p>
                    </div>
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>

            {/* Legend */}
            <div className="glass-card" style={{
              display: 'flex',
              gap: 20,
              padding: '10px 16px',
              marginTop: 12,
              fontSize: '0.8rem',
              color: 'var(--text-secondary)',
              flexWrap: 'wrap',
            }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="severity-dot high" /> High (8–10)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="severity-dot medium" /> Medium (5–7)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="severity-dot low" /> Low (1–4)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  border: '2px dashed #ef4444',
                  background: 'rgba(239, 68, 68, 0.15)',
                }} /> Predicted Risk
              </span>
            </div>
          </div>
        ) : (
          /* List View */
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.length === 0 ? (
              <div className="glass-card" style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
                No issues found for this filter.
              </div>
            ) : (
              filtered.map(issue => (
                <div
                  key={issue.id}
                  className="glass-card"
                  style={{ padding: 16, cursor: 'pointer' }}
                  onClick={() => navigate(`/issue/${issue.id}`)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <span className={`status-badge ${statusClass(issue.status)}`}>
                          {issue.status}
                        </span>
                        <SeverityBadge score={issue.severity_score} />
                      </div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600, margin: '0 0 4px' }}>
                        {issue.category}
                      </h3>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: 0 }}>
                        {issue.summary}
                      </p>
                      <div style={{
                        display: 'flex',
                        gap: 16,
                        marginTop: 8,
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                      }}>
                        <span>📍 {issue.location?.ward_name || 'Unknown'}</span>
                        <span>👍 {issue.upvotes} upvotes</span>
                      </div>
                    </div>
                    {issue.image_url && (
                      <img
                        src={issue.image_url}
                        alt=""
                        style={{
                          width: 80,
                          height: 80,
                          borderRadius: 'var(--radius-sm)',
                          objectFit: 'cover',
                          border: '1px solid var(--surface-border)',
                        }}
                      />
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
