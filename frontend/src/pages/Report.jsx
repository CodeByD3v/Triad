import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOfflineQueue } from '../hooks/useOfflineQueue'
import SeverityBadge from '../components/SeverityBadge'

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000'

export default function Report() {
  const [image, setImage] = useState(null)
  const [preview, setPreview] = useState(null)
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const { queueSubmission, pendingCount } = useOfflineQueue(API_BASE)
  const fileRef = useRef()
  const navigate = useNavigate()

  function handleImageChange(e) {
    const file = e.target.files[0]
    if (!file) return
    setImage(file)
    setPreview(URL.createObjectURL(file))
    setResult(null)
    setError(null)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!image) {
      setError('Please select an image to analyze')
      return
    }
    setLoading(true)
    setError(null)

    const pos = await new Promise((res, rej) =>
      navigator.geolocation.getCurrentPosition(res, rej, { timeout: 8000 })
    ).catch(() => null)

    const fd = new FormData()
    fd.append('image', image)
    fd.append('latitude', pos ? pos.coords.latitude : 0)
    fd.append('longitude', pos ? pos.coords.longitude : 0)
    fd.append('description', description)

    if (!navigator.onLine) {
      await queueSubmission(fd)
      setLoading(false)
      setResult({ status: 'offline' })
      return
    }

    try {
      const res = await fetch(`${API_BASE}/api/issues`, { method: 'POST', body: fd })
      const data = await res.json()
      setResult(data)
    } catch (err) {
      await queueSubmission(fd)
      setResult({ status: 'offline' })
    } finally {
      setLoading(false)
    }
  }

  function resetForm() {
    setImage(null)
    setPreview(null)
    setDescription('')
    setResult(null)
    setError(null)
  }

  return (
    <div className="page-container animate-fade-in" style={{ maxWidth: 560 }}>
      <h1 className="page-title">Report an Issue</h1>
      <p className="page-subtitle">
        Take a photo of a civic infrastructure problem and our AI will analyze it instantly.
      </p>

      {/* Pending sync banner */}
      {pendingCount > 0 && (
        <div className="alert-banner warning" style={{ marginBottom: 16 }}>
          <span>📡</span>
          <span>{pendingCount} report(s) waiting to sync when online</span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="alert-banner error" style={{ marginBottom: 16 }}>
          <span>⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {!result ? (
        <form onSubmit={handleSubmit}>
          {/* Image Upload Zone */}
          <div
            className={`upload-zone ${preview ? 'has-image' : ''}`}
            onClick={() => fileRef.current.click()}
            style={{ marginBottom: 20 }}
          >
            {preview ? (
              <div style={{ position: 'relative' }}>
                <img
                  src={preview}
                  alt="preview"
                  style={{
                    maxHeight: 260,
                    maxWidth: '100%',
                    borderRadius: 'var(--radius-md)',
                    display: 'block',
                    margin: '0 auto',
                  }}
                />
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setImage(null)
                    setPreview(null)
                  }}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 28,
                    height: 28,
                    borderRadius: '50%',
                    background: 'rgba(0,0,0,0.7)',
                    border: 'none',
                    color: 'white',
                    fontSize: '0.9rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <>
                <div style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'rgba(99, 102, 241, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 12px',
                  fontSize: '1.5rem',
                }}>
                  📸
                </div>
                <p style={{
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  marginBottom: 4,
                  fontSize: '0.95rem',
                }}>
                  Tap to capture or upload a photo
                </p>
                <p style={{
                  color: 'var(--text-muted)',
                  fontSize: '0.8rem',
                  margin: 0,
                }}>
                  JPG, PNG up to 10MB · Camera or gallery
                </p>
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              capture="environment"
              style={{ display: 'none' }}
              onChange={handleImageChange}
            />
          </div>

          {/* Description */}
          <textarea
            className="input-field"
            rows={3}
            placeholder="Describe the issue (optional) — location details, how long it's been there…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            style={{ marginBottom: 20 }}
          />

          {/* Location indicator */}
          <div className="glass-card" style={{
            padding: '12px 16px',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            fontSize: '0.85rem',
          }}>
            <span style={{ fontSize: '1.1rem' }}>📍</span>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Location will be captured automatically</span>
              <span style={{
                display: 'block',
                fontSize: '0.75rem',
                color: 'var(--text-muted)',
                marginTop: 2,
              }}>
                GPS coordinates are used for map placement and duplicate detection
              </span>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || !image}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '14px 24px',
              fontSize: '1rem',
            }}
          >
            {loading ? (
              <>
                <span style={{
                  width: 18,
                  height: 18,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                  display: 'inline-block',
                }} />
                Analyzing with AI…
              </>
            ) : (
              <>🚀 Submit Report</>
            )}
          </button>
        </form>
      ) : (
        /* Result Display */
        <div className="animate-slide-up">
          {result.status === 'offline' ? (
            <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📡</div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: 8 }}>Saved for Offline Sync</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 20 }}>
                Your report will be submitted automatically when your connection restores.
              </p>
              <button className="btn-primary" onClick={resetForm}>Report Another Issue</button>
            </div>
          ) : result.status === 'duplicate_updated' ? (
            <div className="glass-card" style={{ padding: 24 }}>
              <div className="alert-banner info" style={{ marginBottom: 16 }}>
                <span>🔍</span>
                <span>Duplicate detected — upvoted existing report</span>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 16 }}>
                Our AI found this issue has already been reported nearby. Your submission counted as
                an upvote, increasing its visibility and priority.
              </p>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => navigate(`/issue/${result.issue_id}`)}>
                  View Issue
                </button>
                <button className="btn-secondary" onClick={resetForm}>Report Another</button>
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.2rem',
                }}>
                  ✅
                </div>
                <div>
                  <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>Issue Submitted</h2>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    AI analysis complete · +20 XP earned
                  </p>
                </div>
              </div>

              {/* AI Analysis Results */}
              <div style={{
                background: 'var(--surface-elevated)',
                borderRadius: 'var(--radius-md)',
                padding: 16,
                marginBottom: 16,
              }}>
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
                <div style={{ display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Category</span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{result.ai_analysis?.category}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Severity</span>
                    <SeverityBadge score={result.ai_analysis?.severity_score} />
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', display: 'block', marginBottom: 4 }}>
                      Summary
                    </span>
                    <p style={{ fontSize: '0.9rem', margin: 0, lineHeight: 1.5 }}>
                      {result.ai_analysis?.summary}
                    </p>
                  </div>
                  {result.ai_analysis?.tags && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                      {result.ai_analysis.tags.map((tag, i) => (
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
              </div>

              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <button className="btn-primary" onClick={() => navigate(`/issue/${result.issue_id}`)}>
                  View on Map
                </button>
                <button className="btn-secondary" onClick={resetForm}>Report Another</button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
