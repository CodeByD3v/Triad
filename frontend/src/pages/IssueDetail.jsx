import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SeverityBadge from '../components/SeverityBadge'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

const STATUS_STYLE = {
  Reported:      { bg: 'rgba(99,102,241,0.15)',  color: '#a5b4fc' },
  Verified:      { bg: 'rgba(59,130,246,0.15)',  color: '#93c5fd' },
  'In-Progress': { bg: 'rgba(245,158,11,0.15)',  color: '#fcd34d' },
  Escalated:     { bg: 'rgba(239,68,68,0.15)',   color: '#fca5a5' },
  Resolved:      { bg: 'rgba(34,197,94,0.15)',   color: '#86efac' },
}

export default function IssueDetail() {
  const { id }                          = useParams()
  const navigate                        = useNavigate()
  const { uid, isAnonymous }            = useAuth()
  const [issue, setIssue]               = useState(null)
  const [loading, setLoading]           = useState(true)
  const [letter, setLetter]             = useState('')
  const [genLoading, setGenLoading]     = useState(false)
  const [copied, setCopied]             = useState(false)
  const [upvoted, setUpvoted]           = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/issues/${id}`)
      .then(r => r.json())
      .then(d => { setIssue(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function handleUpvote() {
    if (upvoted) return
    const fd = new URLSearchParams({ user_id: uid })  // ← real UID
    await fetch(`${API_BASE}/api/issues/${id}/upvote`, { method: 'POST', body: fd })
    setUpvoted(true)
    setIssue(prev => ({ ...prev, upvotes: (prev.upvotes || 0) + 1 }))
  }

  async function handleGenerateLetter() {
    setGenLoading(true)
    setLetter('')
    try {
      const res  = await fetch(`${API_BASE}/api/issues/${id}/grievance`, { method: 'POST' })
      const data = await res.json()
      setLetter(data.letter || '')
    } catch {
      setLetter('Failed to generate letter. Please try again.')
    } finally {
      setGenLoading(false)
    }
  }

  function handleCopy() {
    navigator.clipboard.writeText(letter)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleEmailAuthority() {
    const subject = encodeURIComponent(`Community Issue Report — ${issue?.category}`)
    const body    = encodeURIComponent(letter)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  const statusStyle = STATUS_STYLE[issue?.status] || { bg: 'rgba(99,102,241,0.1)', color: '#a5b4fc' }
  const statusClass = issue?.status?.toLowerCase().replace(/[^a-z]/g, '-') || 'reported'

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 260, gap: 12, color: 'var(--text-secondary)' }}>
      <div style={{
        width: 24, height: 24, border: '3px solid var(--surface-border)',
        borderTopColor: 'var(--color-primary-500)', borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }} />
      Loading issue…
    </div>
  )

  if (!issue) return (
    <div className="page-container" style={{ textAlign: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>Issue not found.</p>
      <button className="btn-secondary" onClick={() => navigate('/')} style={{ marginTop: 16 }}>
        ← Back to map
      </button>
    </div>
  )

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: 680 }}>

      {/* Back */}
      <button className="btn-ghost" onClick={() => navigate(-1)} style={{ marginBottom: 16, paddingLeft: 0 }}>
        ← Back
      </button>

      {/* Header card */}
      <div className="glass-card" style={{ overflow: 'hidden', marginBottom: 16 }}>
        {issue.image_url && (
          <img src={issue.image_url} alt="Issue"
            style={{ width: '100%', height: 220, objectFit: 'cover', display: 'block' }} />
        )}
        <div style={{ padding: 20 }}>
          {/* Title + status */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
            <h1 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)', flex: 1 }}>
              {issue.title}
            </h1>
            <span className={`status-badge ${statusClass}`} style={{ flexShrink: 0 }}>
              {issue.status}
            </span>
          </div>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 14, lineHeight: 1.6 }}>
            {issue.summary}
          </p>

          {/* Meta row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: 14 }}>
            <span>Severity: <SeverityBadge score={issue.severity_score} /></span>
            <span>📍 {issue.location?.ward_name || 'Unknown'}</span>
            <span>👍 {issue.upvotes} upvotes</span>
            <span>🏷 {issue.category}</span>
          </div>

          {/* Tags */}
          {issue.tags?.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {issue.tags.map(tag => (
                <span key={tag} style={{
                  padding: '2px 10px', borderRadius: 'var(--radius-full)',
                  fontSize: '0.75rem', background: 'rgba(99,102,241,0.1)',
                  color: 'var(--text-accent)', border: '1px solid rgba(99,102,241,0.2)',
                }}>#{tag}</span>
              ))}
            </div>
          )}

          {/* Upvote button */}
          <button onClick={handleUpvote} disabled={upvoted}
            className={upvoted ? 'btn-secondary' : 'btn-secondary'}
            style={{
              width: '100%',
              background: upvoted ? 'rgba(34,197,94,0.1)' : undefined,
              borderColor: upvoted ? 'rgba(34,197,94,0.3)' : undefined,
              color: upvoted ? '#86efac' : undefined,
            }}>
            {upvoted ? '✓ Confirmed' : '👍 Confirm this issue exists'}
            {!isAnonymous && !upvoted && <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginLeft: 4 }}>+2 XP</span>}
          </button>
        </div>
      </div>

      {/* AI Analysis */}
      {issue.ai_analysis && (
        <div className="glass-card" style={{ padding: 16, marginBottom: 16, borderColor: 'rgba(99,102,241,0.25)' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-primary-400)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
            🤖 AI Analysis
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.6 }}>
            {issue.ai_analysis.summary}
          </p>
        </div>
      )}

      {/* Escalation notice */}
      {issue.status === 'Escalated' && issue.escalation_reason && (
        <div className="alert-banner error" style={{ marginBottom: 16, borderRadius: 'var(--radius-lg)', padding: 16 }}>
          <div>
            <p style={{ fontWeight: 600, margin: '0 0 4px' }}>🚨 Escalated to Authorities</p>
            <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.85 }}>{issue.escalation_reason}</p>
          </div>
        </div>
      )}

      {/* Grievance Letter Generator */}
      <div className="glass-card" style={{ padding: 20 }}>
        <h2 style={{ fontSize: '1rem', fontWeight: 700, margin: '0 0 4px', color: 'var(--text-primary)' }}>
          Generate Grievance Letter
        </h2>
        <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
          Gemini Pro drafts a formal letter to the Municipal Corporation
        </p>

        <button onClick={handleGenerateLetter} disabled={genLoading}
          className="btn-primary" style={{ width: '100%', marginBottom: letter ? 16 : 0 }}>
          {genLoading
            ? <><span style={{ animation: 'spin 0.8s linear infinite', display: 'inline-block' }}>⏳</span> Drafting with Gemini Pro…</>
            : '📄 Generate Official Grievance Letter'}
        </button>

        {letter && (
          <>
            <div style={{
              background: 'var(--surface-elevated)', borderRadius: 'var(--radius-md)',
              padding: 16, marginBottom: 12, border: '1px solid var(--surface-border)',
            }}>
              <pre style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', fontFamily: 'monospace', margin: 0, lineHeight: 1.6 }}>
                {letter}
              </pre>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={handleCopy} className="btn-secondary" style={{ flex: 1 }}>
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
              <button onClick={handleEmailAuthority} className="btn-primary" style={{ flex: 1 }}>
                ✉️ Email Authority
              </button>
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
