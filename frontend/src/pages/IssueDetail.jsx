import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

const API_BASE = import.meta.env.VITE_API_BASE

const STATUS_COLORS = {
  Reported:    'bg-yellow-100 text-yellow-800 border-yellow-200',
  Verified:    'bg-blue-100 text-blue-800 border-blue-200',
  'In-Progress': 'bg-purple-100 text-purple-800 border-purple-200',
  Escalated:   'bg-orange-100 text-orange-800 border-orange-200',
  Resolved:    'bg-green-100 text-green-800 border-green-200',
}

const SEVERITY_COLOR = (s) =>
  s >= 8 ? 'text-red-600' : s >= 5 ? 'text-amber-600' : 'text-green-600'

export default function IssueDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [issue, setIssue]       = useState(null)
  const [loading, setLoading]   = useState(true)
  const [letter, setLetter]     = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [copied, setCopied]     = useState(false)
  const [upvoted, setUpvoted]   = useState(false)

  useEffect(() => {
    fetch(`${API_BASE}/api/issues/${id}`)
      .then(r => r.json())
      .then(d => { setIssue(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [id])

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

  async function handleUpvote() {
    await fetch(`${API_BASE}/api/issues/${id}/upvote`, {
      method: 'POST',
      body: new URLSearchParams({ user_id: 'anonymous' }),
    })
    setUpvoted(true)
    setIssue(prev => ({ ...prev, upvotes: (prev.upvotes || 0) + 1 }))
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

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
    </div>
  )

  if (!issue) return (
    <div className="max-w-2xl mx-auto p-6 text-center">
      <p className="text-gray-500">Issue not found.</p>
      <button onClick={() => navigate('/')} className="mt-4 text-blue-600 underline">
        Back to map
      </button>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">

      {/* Back */}
      <button onClick={() => navigate(-1)} className="text-blue-600 text-sm flex items-center gap-1">
        ← Back
      </button>

      {/* Header card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {issue.image_url && (
          <img src={issue.image_url} alt="Issue" className="w-full h-56 object-cover" />
        )}
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-xl font-semibold text-gray-900">{issue.title}</h1>
            <span className={`text-xs px-2 py-1 rounded-full border font-medium shrink-0
              ${STATUS_COLORS[issue.status] || 'bg-gray-100 text-gray-700'}`}>
              {issue.status}
            </span>
          </div>

          <p className="text-gray-600 text-sm">{issue.summary}</p>

          {/* Meta row */}
          <div className="flex flex-wrap gap-4 text-sm text-gray-500 pt-1">
            <span>
              Severity:{' '}
              <span className={`font-semibold ${SEVERITY_COLOR(issue.severity_score)}`}>
                {issue.severity_score}/10
              </span>
            </span>
            <span>📍 {issue.location?.ward_name}</span>
            <span>👍 {issue.upvotes} upvotes</span>
            <span>🏷 {issue.category}</span>
          </div>

          {/* Tags */}
          {issue.tags?.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-1">
              {issue.tags.map(tag => (
                <span key={tag}
                  className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          )}

          {/* Upvote */}
          <button
            onClick={handleUpvote}
            disabled={upvoted}
            className={`w-full mt-2 py-2 rounded-xl text-sm font-medium transition
              ${upvoted
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-gray-50 text-gray-700 border border-gray-200 hover:bg-gray-100'}`}
          >
            {upvoted ? '✓ Upvoted' : '👍 Confirm this issue exists'}
          </button>
        </div>
      </div>

      {/* AI Analysis card */}
      {issue.ai_analysis && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">
            AI Analysis
          </p>
          <p className="text-sm text-blue-900">{issue.ai_analysis.summary}</p>
        </div>
      )}

      {/* Escalation notice */}
      {issue.status === 'Escalated' && issue.escalation_reason && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-4">
          <p className="text-xs font-semibold text-orange-600 uppercase tracking-wide mb-2">
            🚨 Escalated to Authorities
          </p>
          <p className="text-sm text-orange-900">{issue.escalation_reason}</p>
        </div>
      )}

      {/* Grievance Letter Generator */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4">
        <div>
          <h2 className="font-semibold text-gray-900">Generate Grievance Letter</h2>
          <p className="text-xs text-gray-500 mt-1">
            Gemini Pro drafts a formal letter to the Municipal Corporation
          </p>
        </div>

        <button
          onClick={handleGenerateLetter}
          disabled={genLoading}
          className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium
                     hover:bg-blue-700 disabled:opacity-50 transition flex items-center justify-center gap-2"
        >
          {genLoading
            ? <><span className="animate-spin">⏳</span> Drafting with Gemini Pro…</>
            : '📄 Generate Official Grievance Letter'}
        </button>

        {letter && (
          <div className="space-y-3">
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
              <pre className="text-xs text-gray-800 whitespace-pre-wrap font-mono leading-relaxed">
                {letter}
              </pre>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex-1 py-2 rounded-xl border border-gray-200 text-sm
                           hover:bg-gray-50 transition font-medium"
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
              <button
                onClick={handleEmailAuthority}
                className="flex-1 py-2 rounded-xl bg-green-600 text-white text-sm
                           hover:bg-green-700 transition font-medium"
              >
                ✉️ Email Authority
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
