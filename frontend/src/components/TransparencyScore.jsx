import { useEffect, useRef } from 'react'

export default function TransparencyScore({ score = 0, size = 100, label = '' }) {
  const circleRef = useRef(null)
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (score / 100) * circumference

  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'

  useEffect(() => {
    if (circleRef.current) {
      circleRef.current.style.strokeDashoffset = circumference
      requestAnimationFrame(() => {
        circleRef.current.style.strokeDashoffset = offset
      })
    }
  }, [score, offset, circumference])

  return (
    <div style={{ textAlign: 'center' }}>
      <div className="score-ring" style={{ width: size, height: size, margin: '0 auto' }}>
        <svg width={size} height={size}>
          <circle
            className="ring-bg"
            cx={size / 2}
            cy={size / 2}
            r={radius}
          />
          <circle
            ref={circleRef}
            className="ring-fill"
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
          />
        </svg>
        <div className="ring-value" style={{ color }}>
          {score}%
        </div>
      </div>
      {label && (
        <p style={{
          marginTop: 8,
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
          fontWeight: 500,
        }}>
          {label}
        </p>
      )}
    </div>
  )
}
