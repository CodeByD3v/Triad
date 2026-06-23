import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { MapContainer, TileLayer, CircleMarker } from 'react-leaflet'
import SeverityBadge from '../components/SeverityBadge'
import 'leaflet/dist/leaflet.css'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const STATUS_TIMELINE = ['Reported', 'Verified', 'In-Progress', 'Escalated', 'Resolved']

export default function IssueDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [issue, setIssue] = useState(null)
  const [loading, setLoading] = useState(true)
  const [grievanceLetter, setGrievanceLetter] = useState(null)
  const [generatingLetter, setGeneratingLetter] = useState(false)
  const [upvoting, setUpvoting] = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/issues/${id}`)
      .then(r => r.json())
      .then(d => { setIssue(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function handleUpvote() {
    setUpvoting(true)
    try {
      const fd = new FormData()
      fd.append('user_id', 'anonymous')
      await fetch(`${API_BASE}/api/issues/${id}/upvote`, { method: 'POST', body: fd })
      setIssue(prev => ({ ...prev, upvotes: (prev.upvotes || 0) + 1 }))
    } catch (_) {}
    setUpvoting(false)
  }

  async function handleGenerateGrievance() {
    setGeneratingLetter(true)
    try {
      const res = await fetch(`${API_BASE}/api/issues/${id}/grievance`, { method: 'POST' })
      const data = await res.json()
      setGrievanceLetter(data.letter)
    } catch (_) {
      setGrievanceLetter('Failed to generate letter. Please try again.')
    }
    setGeneratingLetter(false)
  }

  function getStatusClass(s) {
    return s?.toLowerCase().replace(/[^a-z]/g, '-') || 'reported'
  }

  if (loading) {
    return (
      <div className="page-container" style={{ maxWidth: 700 }}>
        <div className="skeleton" style={{ height: 24, width: 200, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 300, marginBottom: 16 }} />
        <div className="skeleton" style={{ height: 100 }} />
      </div>
    )
  }

  if (!issue) {
    return (
      <div className="page-container" style={{ textAlign: 'center' }}>
        <h2 style={{ color: 'var(--text-secondary)' }}>Issue not found</h2>
        <button className="btn-primary" onClick={() => navigate('/')}>Back to Dashboard</button>
      </div>
    )
  }

  const statusIdx = STATUS_TIMELINE.indexOf(issue.status)

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: 700 }}>
      {/* Back button */}
      <button
        className="btn-ghost"
        onClick={() => navigate('/')}
        style={{ marginBottom: 16, padding: '8px 12px' }}
      >
        ← Back to Dashboard
      </button>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 8px' }}>
            {issue.category}
          </h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span className={`status-badge ${getStatusClass(issue.status)}`}>{issue.status}</span>
            <SeverityBadge score={issue.severity_score} />
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              📍 {issue.location?.ward_name}
            </span>
          </div>
        </div>
        <button
          className="btn-secondary"
          onClick={handleUpvote}
          disabled={upvoting}
          style={{ whiteSpace: 'nowrap' }}
        >
          👍 Upvote ({issue.upvotes || 0})
        </button>
      </div>

      {/* Image */}
      {issue.image_url && (
        <div className="glass-card" style={{ padding: 4, marginBottom: 16, overflow: 'hidden' }}>
          <img
            src={issue.image_url}
            alt={issue.category}
            style={{
              width: '100%',
              maxHeight: 400,
              objectFit: 'cover',
              borderRadius: 'calc(var(--radius-lg) - 4px)',
              display: 'block',
            }}
          />
        </div>
      )}

      {/* AI Analysis */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 12,
        }}>
          🤖 AI Analysis
        </h3>
        <p style={{ fontSize: '0.95rem', lineHeight: 1.6, margin: '0 0 12px' }}>
          {issue.summary}
        </p>
        {issue.description && (
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 12px' }}>
            <strong>User Description:</strong> {issue.description}
          </p>
        )}
        {issue.tags && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {issue.tags.map((tag, i) => (
              <span key={i} style={{
                padding: '2px 10px',
                borderRadius: 'var(--radius-full)',
                fontSize: '0.75rem',
                background: 'rgba(99, 102, 241, 0.1)',
                color: 'var(--text-accent)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
              }}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Status Timeline */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 16,
        }}>
          📊 Status Timeline
        </h3>
        <div style={{ display: 'flex', gap: 0, alignItems: 'center' }}>
          {STATUS_TIMELINE.map((s, i) => {
            const isActive = i <= statusIdx
            const isCurrent = i === statusIdx
            return (
              <div key={s} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_TIMELINE.length - 1 ? 1 : 'none' }}>
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  minWidth: 50,
                }}>
                  <div style={{
                    width: isCurrent ? 16 : 12,
                    height: isCurrent ? 16 : 12,
                    borderRadius: '50%',
                    background: isActive
                      ? 'linear-gradient(135deg, var(--color-primary-500), var(--color-primary-400))'
                      : 'var(--surface-border)',
                    boxShadow: isCurrent ? '0 0 12px rgba(99, 102, 241, 0.5)' : 'none',
                    transition: 'all 0.3s ease',
                  }} />
                  <span style={{
                    fontSize: '0.65rem',
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}>
                    {s}
                  </span>
                </div>
                {i < STATUS_TIMELINE.length - 1 && (
                  <div style={{
                    flex: 1,
                    height: 2,
                    background: i < statusIdx
                      ? 'var(--color-primary-500)'
                      : 'var(--surface-border)',
                    marginBottom: 20,
                    transition: 'background 0.3s ease',
                  }} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Mini Map */}
      {issue.location && (
        <div className="glass-card" style={{ padding: 4, marginBottom: 16, overflow: 'hidden' }}>
          <MapContainer
            center={[issue.location.latitude, issue.location.longitude]}
            zoom={15}
            style={{ height: 200, borderRadius: 'calc(var(--radius-lg) - 4px)' }}
            zoomControl={false}
            dragging={false}
          >
            <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" />
            <CircleMarker
              center={[issue.location.latitude, issue.location.longitude]}
              radius={10}
              fillColor={issue.severity_score >= 8 ? '#ef4444' : issue.severity_score >= 5 ? '#f59e0b' : '#22c55e'}
              color="white"
              weight={2}
              fillOpacity={0.9}
            />
          </MapContainer>
        </div>
      )}

      {/* Escalation info */}
      {issue.escalation_reason && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 16, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
          <h3 style={{
            fontSize: '0.8rem',
            fontWeight: 600,
            color: '#fca5a5',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: 8,
          }}>
            🚨 Escalation Notice
          </h3>
          <p style={{ fontSize: '0.85rem', lineHeight: 1.6, margin: 0, color: 'var(--text-secondary)' }}>
            {issue.escalation_reason}
          </p>
        </div>
      )}

      {/* Grievance Letter Generator */}
      <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
        <h3 style={{
          fontSize: '0.8rem',
          fontWeight: 600,
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: 12,
        }}>
          📄 Grievance Letter Generator
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Generate a formal grievance letter addressed to the Municipal Corporation using AI.
        </p>

        {!grievanceLetter ? (
          <button
            className="btn-primary"
            onClick={handleGenerateGrievance}
            disabled={generatingLetter}
          >
            {generatingLetter ? (
              <>
                <span style={{
                  width: 16, height: 16,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block',
                }} />
                Generating with Gemini Pro…
              </>
            ) : (
              '✍️ Generate Grievance Letter'
            )}
          </button>
        ) : (
          <div>
            <div style={{
              background: 'var(--surface-elevated)',
              borderRadius: 'var(--radius-md)',
              padding: 16,
              marginBottom: 12,
              maxHeight: 400,
              overflowY: 'auto',
              whiteSpace: 'pre-wrap',
              fontSize: '0.85rem',
              lineHeight: 1.7,
              fontFamily: "'Georgia', serif",
              color: 'var(--text-secondary)',
            }}>
              {grievanceLetter}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-secondary"
                onClick={() => navigator.clipboard.writeText(grievanceLetter)}
              >
                📋 Copy to Clipboard
              </button>
              <button className="btn-ghost" onClick={() => setGrievanceLetter(null)}>
                Regenerate
              </button>
            </div>
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
