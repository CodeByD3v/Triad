import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import SeverityBadge from '../components/SeverityBadge'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function Report() {
  const { uid, isAnonymous }  = useAuth()
  const [image, setImage]     = useState(null)
  const [preview, setPreview] = useState(null)
  const [desc, setDesc]       = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState(null)
  const { queueSubmission, pendingCount } = useOfflineQueue(API_BASE)
  const fileRef  = useRef()
  const navigate = useNavigate()

  function pickImage(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!['image/jpeg','image/png','image/webp'].includes(file.type))
      return setError('Only JPG, PNG or WEBP images are supported')
    if (file.size > 10 * 1024 * 1024)
      return setError('Image must be under 10 MB')
    setImage(file); setPreview(URL.createObjectURL(file))
    setError(null); setResult(null)
  }

  async function submit(e) {
    e.preventDefault()
    if (!image) return setError('Please select an image first')
    setLoading(true); setError(null)

    const pos = await new Promise(res =>
      navigator.geolocation.getCurrentPosition(res, () => res(null), { timeout: 8000 })
    )

    const fd = new FormData()
    fd.append('image',       image)
    fd.append('latitude',    pos?.coords.latitude  ?? 0)
    fd.append('longitude',   pos?.coords.longitude ?? 0)
    fd.append('description', desc)
    fd.append('reported_by', uid)

    if (!navigator.onLine) {
      await queueSubmission(fd)
      setResult({ status: 'offline' })
      setLoading(false)
      return
    }

    try {
      const r = await fetch(`${API_BASE}/api/issues`, { method:'POST', body:fd })
      setResult(await r.json())
    } catch {
      await queueSubmission(fd)
      setResult({ status:'offline' })
    } finally {
      setLoading(false)
    }
  }

  function reset() { setImage(null); setPreview(null); setDesc(''); setResult(null); setError(null) }

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth:560 }}>
      <h1 className="page-title">Report an Issue</h1>
      <p className="page-subtitle">
        Upload a photo — our AI categorizes it and places it on the map instantly.
      </p>

      {isAnonymous && (
        <div className="alert-banner warning" style={{ marginBottom:16 }}>
          ⚠️ Guest mode — <strong style={{ marginLeft:4 }}>sign in to earn XP and badges</strong>
        </div>
      )}

      {pendingCount > 0 && (
        <div className="alert-banner info" style={{ marginBottom:16 }}>
          📡 {pendingCount} report{pendingCount > 1 ? 's' : ''} queued — will sync when online
        </div>
      )}

      {error && (
        <div className="alert-banner error" style={{ marginBottom:16 }}>⚠️ {error}</div>
      )}

      {!result ? (
        <form onSubmit={submit}>
          {/* Upload zone */}
          <div className={`upload-zone${preview ? ' has-image' : ''}`}
            onClick={() => fileRef.current.click()} style={{ marginBottom:18 }}>
            {preview ? (
              <div style={{ position:'relative' }}>
                <img src={preview} alt="" style={{
                  maxHeight:240, maxWidth:'100%', borderRadius:'var(--radius-md)',
                  display:'block', margin:'0 auto',
                }} />
                <button type="button"
                  onClick={e => { e.stopPropagation(); setImage(null); setPreview(null) }}
                  style={{
                    position:'absolute', top:8, right:8, width:28, height:28,
                    borderRadius:'50%', background:'rgba(0,0,0,0.75)',
                    border:'none', color:'#fff', cursor:'pointer', fontSize:'0.9rem',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>✕</button>
              </div>
            ) : (
              <div style={{ pointerEvents:'none' }}>
                <div style={{
                  width:52, height:52, borderRadius:'50%',
                  background:'rgba(99,102,241,0.1)', margin:'0 auto 12px',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.4rem',
                }}>📸</div>
                <p style={{ fontWeight:600, marginBottom:4, fontSize:'0.9rem' }}>
                  Tap to capture or upload
                </p>
                <p style={{ color:'var(--text-muted)', fontSize:'0.78rem', margin:0 }}>
                  JPG · PNG · WEBP · max 10 MB
                </p>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
              capture="environment" style={{ display:'none' }} onChange={pickImage} />
          </div>

          <textarea className="input-field" rows={3} style={{ marginBottom:16 }}
            placeholder="Describe the issue — location details, how long it's been there…"
            value={desc} onChange={e => setDesc(e.target.value)} />

          {/* Location note */}
          <div style={{
            display:'flex', alignItems:'center', gap:10, padding:'10px 14px', marginBottom:20,
            background:'var(--surface-elevated)', borderRadius:'var(--radius-md)',
            border:'1px solid var(--surface-border)', fontSize:'0.82rem',
          }}>
            <span style={{ fontSize:'1.1rem' }}>📍</span>
            <div>
              <div style={{ color:'var(--text-secondary)' }}>GPS location captured automatically</div>
              <div style={{ color:'var(--text-muted)', fontSize:'0.74rem', marginTop:2 }}>
                Used for map placement and duplicate detection
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading || !image} className="btn-primary"
            style={{ width:'100%', padding:'13px 0', fontSize:'0.95rem' }}>
            {loading ? <><div className="spinner" />Analyzing with AI…</> : '🚀 Submit Report'}
          </button>
        </form>

      ) : (
        <div className="animate-slide-up">

          {result.status === 'offline' && (
            <div className="glass-card" style={{ padding:28, textAlign:'center' }}>
              <div style={{ fontSize:'2.2rem', marginBottom:12 }}>📡</div>
              <h2 style={{ fontWeight:700, marginBottom:8 }}>Saved Offline</h2>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.88rem', marginBottom:20 }}>
                Your report will sync automatically when you're back online.
              </p>
              <button className="btn-primary" onClick={reset}>Report Another</button>
            </div>
          )}

          {result.status === 'duplicate_updated' && (
            <div className="glass-card" style={{ padding:24 }}>
              <div className="alert-banner info" style={{ marginBottom:16 }}>
                🔍 Duplicate detected — your report upvoted the existing issue
              </div>
              <p style={{ color:'var(--text-secondary)', fontSize:'0.88rem', marginBottom:18, lineHeight:1.6 }}>
                Our AI found the same issue already reported nearby. Your submission
                increased its community upvote count, boosting its priority.
              </p>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button className="btn-primary" onClick={() => navigate(`/issue/${result.issue_id}`)}>
                  View Issue
                </button>
                <button className="btn-secondary" onClick={reset}>Report Another</button>
              </div>
            </div>
          )}

          {result.status === 'created' && (
            <div className="glass-card" style={{ padding:24 }}>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:18 }}>
                <div style={{
                  width:40, height:40, borderRadius:'50%',
                  background:'rgba(34,197,94,0.15)',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1.2rem', flexShrink:0,
                }}>✅</div>
                <div>
                  <h2 style={{ fontWeight:700, fontSize:'1.05rem', margin:0 }}>Issue Submitted!</h2>
                  <p style={{ color:'var(--text-muted)', fontSize:'0.78rem', margin:0 }}>
                    AI analysis complete{!isAnonymous ? ' · +20 XP' : ''}
                  </p>
                </div>
              </div>

              <div style={{ background:'var(--surface-elevated)', borderRadius:'var(--radius-md)', padding:16, marginBottom:18 }}>
                <p style={{ fontSize:'0.72rem', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:12 }}>
                  🤖 AI Analysis
                </p>
                <div style={{ display:'grid', gap:10 }}>
                  <Row label="Category" value={result.ai_analysis?.category} />
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <span style={{ color:'var(--text-secondary)', fontSize:'0.84rem' }}>Severity</span>
                    <SeverityBadge score={result.ai_analysis?.severity_score} />
                  </div>
                  <div>
                    <span style={{ color:'var(--text-secondary)', fontSize:'0.84rem', display:'block', marginBottom:4 }}>Summary</span>
                    <p style={{ fontSize:'0.88rem', margin:0, lineHeight:1.5 }}>{result.ai_analysis?.summary}</p>
                  </div>
                  {result.ai_analysis?.tags?.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5 }}>
                      {result.ai_analysis.tags.map((t,i) => (
                        <span key={i} style={{
                          padding:'2px 9px', borderRadius:'var(--radius-full)', fontSize:'0.73rem',
                          background:'rgba(99,102,241,0.1)', color:'var(--text-accent)',
                          border:'1px solid rgba(99,102,241,0.2)',
                        }}>#{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                <button className="btn-primary" onClick={() => navigate(`/issue/${result.issue_id}`)}>
                  View on Map
                </button>
                <button className="btn-secondary" onClick={reset}>Report Another</button>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  )
}

function Row({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
      <span style={{ color:'var(--text-secondary)', fontSize:'0.84rem' }}>{label}</span>
      <span style={{ fontWeight:600, fontSize:'0.88rem' }}>{value}</span>
    </div>
  )
}
