export default function SeverityBadge({ score }) {
  const level = score >= 8 ? 'high' : score >= 5 ? 'medium' : 'low'
  const colors = {
    high: { bg: 'rgba(239, 68, 68, 0.15)', text: '#fca5a5', border: 'rgba(239, 68, 68, 0.3)' },
    medium: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fcd34d', border: 'rgba(245, 158, 11, 0.3)' },
    low: { bg: 'rgba(34, 197, 94, 0.15)', text: '#86efac', border: 'rgba(34, 197, 94, 0.3)' },
  }
  const c = colors[level]

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '3px 10px',
      borderRadius: 'var(--radius-full)',
      fontSize: '0.75rem',
      fontWeight: 700,
      background: c.bg,
      color: c.text,
      border: `1px solid ${c.border}`,
    }}>
      <span className={`severity-dot ${level}`} />
      {score}/10
    </span>
  )
}
