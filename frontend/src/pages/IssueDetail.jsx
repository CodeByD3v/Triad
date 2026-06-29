import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import SeverityBadge from '../components/SeverityBadge'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'
const sc = s => s?.toLowerCase().replace(/[^a-z]/g, '-') || 'reported'

export default function IssueDetail() {
  const { id }               = useParams()
  const navigate             = useNavigate()
  const { uid, isAnonymous } = useAuth()
  const [issue, setIssue]     = useState(null)
  const [loading, setLoading] = useState(true)
  const [letter, setLetter]   = useState('')
  const [genLoading, setGen]  = useState(false)
  const [copied, setCopied]   = useState(false)
  const [upvoted, setUpvoted] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified]   = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/issues/${id}`)
      .then(r => r.json())
      .then(d => { setIssue(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

  async function handleUpvote() {
    if (upvoted) return
    await fetch(`${API_BASE}/api/issues/${id}/upvote`, {
      method: 'POST',
      body: new URLSearchParams({ user_id: uid }),
    })
    setUpvoted(true)
    setIssue(p => ({ ...p, upvotes: (p.upvotes || 0) + 1 }))
  }

  async function handleVerify() {
    if (verifying || verified) return
    setVerifying(true)
    const pos = await new Promise(res =>
      navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 6000 })
    )
    const fd = new URLSearchParams({
      user_id:   uid,
      latitude:  pos?.coords.latitude  ?? 0,
      longitude: pos?.coords.longitude ?? 0,
    })
    const r = await fetch(`${API_BASE}/api/issues/${id}/verify`, { method: 'POST', body: fd })
    const d = await r.json()
    setVerified(true)
    setVerifying(false)
    if (d.status === 'verified') {
      setIssue(p => ({ ...p, status: 'Verified' }))
    }
  }

  async function generateLetter() {
    setGen(true); setLetter('')
    try {
      const r = await fetch(`${API_BASE}/api/issues/${id}/grievance`, { method: 'POST' })
      const d = await r.json()
      setLetter(d.letter || 'Generation failed — please try again.')
    } catch { setLetter('Generation failed — please try again.') }
    finally { setGen(false) }
  }

  function copyLetter() {
    navigator.clipboard.writeText(letter)
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  function emailAuthority() {
    window.open(`mailto:?subject=${encodeURIComponent(`Community Issue — ${issue?.category}`)}&body=${encodeURIComponent(letter)}`)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:260, gap:12, color:'var(--text-secondary)' }}>
      <div className="spinner dark" /> Loading…
    </div>
  )

  if (!issue) return (
    <div className="page-container" style={{ textAlign:'center' }}>
      <p style={{ color:'var(--text-secondary)', marginBottom:16 }}>Issue not found.</p>
      <button className="btn-secondary" onClick={() => navigate('/')}>← Back to map</button>
    </div>
  )

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth:700 }}>

      <button className="btn-ghost" onClick={() => navigate(-1)}
        style={{ marginBottom:20, paddingLeft:0, fontSize:'0.85rem' }}>
        ← Back
      </button>

      {/* ── Main card ── */}
      <div className="glass-card" style={{ overflow:'hidden', marginBottom:14 }}>
        {issue.image_url && (
          <img src={issue.image_url} alt="Issue"
            style={{ width:'100%', height:230, objectFit:'cover', display:'block' }} />
        )}
        <div style={{ padding:22 }}>

          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, marginBottom:14 }}>
            <h1 style={{ fontSize:'1.15rem', fontWeight:700, margin:0, flex:1, lineHeight:1.3 }}>
              {issue.title}
            </h1>
            <span className={`status-badge ${sc(issue.status)}`} style={{ flexShrink:0, marginTop:2 }}>
              {issue.status}
            </span>
          </div>

          <p style={{ color:'var(--text-secondary)', fontSize:'0.88rem', marginBottom:16, lineHeight:1.6 }}>
            {issue.summary}
          </p>

          {/* Meta */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 18px', fontSize:'0.83rem', color:'var(--text-secondary)', marginBottom:14, alignItems:'center' }}>
            <SeverityBadge score={issue.severity_score} />
            <span>📍 {issue.location?.ward_name || 'Unknown'}</span>
            <span>👍 {issue.upvotes} upvotes</span>
            <span>🏷 {issue.category}</span>
          </div>

          {/* Tags */}
          {issue.tags?.length > 0 && (
            <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:18 }}>
              {issue.tags.map(t => (
                <span key={t} style={{
                  padding:'2px 9px', borderRadius:'var(--radius-full)', fontSize:'0.73rem',
                  background:'rgba(99,102,241,0.1)', color:'var(--text-accent)',
                  border:'1px solid rgba(99,102,241,0.2)',
                }}>#{t}</span>
              ))}
            </div>
          )}

          {/* Action buttons */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            <button onClick={handleUpvote} disabled={upvoted}
              className="btn-secondary"
              style={upvoted ? { borderColor:'rgba(34,197,94,0.3)', color:'#86efac', background:'rgba(34,197,94,0.08)' } : {}}>
              {upvoted ? '✓ Upvoted' : '👍 Upvote'}
              {!isAnonymous && !upvoted && <span style={{ fontSize:'0.7rem', opacity:0.6, marginLeft:4 }}>+2 XP</span>}
            </button>
            <button onClick={handleVerify} disabled={verifying || verified}
              className="btn-secondary"
              style={verified ? { borderColor:'rgba(59,130,246,0.3)', color:'#93c5fd', background:'rgba(59,130,246,0.08)' } : {}}>
              {verifying ? <><div className="spinner dark" style={{ width:14, height:14 }} /> Verifying…</>
               : verified ? '✓ Verified'
               : '📍 Verify Location'}
              {!isAnonymous && !verified && !verifying && <span style={{ fontSize:'0.7rem', opacity:0.6, marginLeft:4 }}>+5 XP</span>}
            </button>
          </div>
        </div>
      </div>

      {/* ── AI Analysis ── */}
      {issue.ai_analysis && (
        <div className="glass-card" style={{ padding:18, marginBottom:14, borderColor:'rgba(99,102,241,0.2)' }}>
          <p style={{ fontSize:'0.72rem', fontWeight:700, color:'var(--color-primary-400)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
            🤖 AI Analysis
          </p>
          <p style={{ fontSize:'0.88rem', color:'var(--text-secondary)', margin:0, lineHeight:1.6 }}>
            {issue.ai_analysis.summary}
          </p>
        </div>
      )}

      {/* ── Escalation notice ── */}
      {issue.status === 'Escalated' && issue.escalation_reason && (
        <div className="alert-banner error" style={{ marginBottom:14, borderRadius:'var(--radius-lg)', padding:16, alignItems:'flex-start', flexDirection:'column', gap:6 }}>
          <strong>🚨 Escalated to Authorities</strong>
          <p style={{ margin:0, fontSize:'0.84rem', opacity:0.88, lineHeight:1.5 }}>{issue.escalation_reason}</p>
        </div>
      )}

      {/* ── Grievance Letter ── */}
      <div className="glass-card" style={{ padding:22 }}>
        <h2 style={{ fontSize:'1rem', fontWeight:700, margin:'0 0 5px' }}>
          📄 Generate Grievance Letter
        </h2>
        <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', margin:'0 0 16px' }}>
          Gemini Pro drafts a formal letter to the Municipal Corporation
        </p>

        <button onClick={generateLetter} disabled={genLoading}
          className="btn-primary" style={{ width:'100%', marginBottom: letter ? 16 : 0 }}>
          {genLoading
            ? <><div className="spinner" style={{ width:16, height:16 }} /> Drafting with Gemini Pro…</>
            : 'Generate Official Letter'}
        </button>

        {letter && (
          <>
            <div style={{
              background:'var(--surface-elevated)', borderRadius:'var(--radius-md)',
              padding:16, marginBottom:12, border:'1px solid var(--surface-border)',
              maxHeight:320, overflowY:'auto',
            }}>
              <pre style={{
                fontSize:'0.78rem', color:'var(--text-secondary)',
                whiteSpace:'pre-wrap', fontFamily:'monospace', margin:0, lineHeight:1.65,
              }}>{letter}</pre>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={copyLetter} className="btn-secondary" style={{ flex:1 }}>
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
              <button onClick={emailAuthority} className="btn-primary" style={{ flex:1 }}>
                ✉️ Email Authority
              </button>
            </div>
          </>
        )}
      </div>

    </div>
  )
}
