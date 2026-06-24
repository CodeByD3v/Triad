import { useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_BASE

const BADGE_META = {
  first_reporter:   { icon: '🌱', label: 'First Reporter',   desc: 'Submitted your first issue' },
  community_helper: { icon: '🤝', label: 'Community Helper', desc: 'Confirmed 10+ existing issues' },
  civic_champion:   { icon: '🏆', label: 'Civic Champion',   desc: 'Earned 200+ XP' },
  ward_guardian:    { icon: '🛡️', label: 'Ward Guardian',    desc: 'Earned 500+ XP' },
}

const XP_ACTIONS = [
  { action: 'Submit a new issue',        xp: '+20 XP' },
  { action: 'Confirm an existing issue', xp: '+5 XP'  },
  { action: 'Issue gets verified',       xp: '+10 XP' },
  { action: 'Upvote a report',           xp: '+2 XP'  },
]

export default function Leaderboard() {
  const [users, setUsers]         = useState([])
  const [wards, setWards]         = useState([])
  const [tab, setTab]             = useState('citizens')
  const [loading, setLoading]     = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/api/leaderboard?limit=20`).then(r => r.json()),
      fetch(`${API_BASE}/api/analytics/transparency`).then(r => r.json()),
    ]).then(([lb, tr]) => {
      setUsers(lb.leaderboard || [])
      setWards(tr.wards || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Community Leaderboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Earn XP by reporting and verifying civic issues
        </p>
      </div>

      {/* XP guide */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4">
        <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-3">
          How to earn XP
        </p>
        <div className="grid grid-cols-2 gap-2">
          {XP_ACTIONS.map(({ action, xp }) => (
            <div key={action} className="flex items-center justify-between
                                         bg-white rounded-xl px-3 py-2 text-sm">
              <span className="text-gray-700">{action}</span>
              <span className="font-semibold text-blue-600 ml-2 shrink-0">{xp}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-gray-100 rounded-xl p-1">
        {[
          { key: 'citizens', label: '👤 Citizens' },
          { key: 'wards',    label: '🏘 Wards'    },
          { key: 'badges',   label: '🏅 Badges'   },
        ].map(({ key, label }) => (
          <button key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition
              ${tab === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500'}`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
        </div>
      )}

      {/* Citizens tab */}
      {!loading && tab === 'citizens' && (
        <div className="space-y-2">
          {users.length === 0 && (
            <p className="text-center text-gray-400 py-8">No citizens yet — be the first!</p>
          )}
          {users.map((user, i) => (
            <div key={user.uid}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4
                         flex items-center gap-4">
              {/* Rank */}
              <div className={`w-9 h-9 rounded-full flex items-center justify-center
                               font-bold text-sm shrink-0
                ${i === 0 ? 'bg-yellow-100 text-yellow-700' :
                  i === 1 ? 'bg-gray-100 text-gray-600' :
                  i === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-blue-50 text-blue-600'}`}>
                {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">
                  {user.display_name || user.uid?.slice(0, 8) || 'Anonymous'}
                </p>
                {/* Badges */}
                {user.badges?.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {user.badges.map(b => (
                      <span key={b} className="text-xs bg-gray-50 border border-gray-100
                                               rounded-full px-2 py-0.5">
                        {BADGE_META[b]?.icon} {BADGE_META[b]?.label || b}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* XP */}
              <div className="text-right shrink-0">
                <p className="font-bold text-blue-600">{user.xp || 0}</p>
                <p className="text-xs text-gray-400">XP</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Wards tab — Civic Transparency Score */}
      {!loading && tab === 'wards' && (
        <div className="space-y-2">
          <p className="text-xs text-gray-500 px-1">
            Transparency Score = issues resolved in last 30 days ÷ issues raised × 100
          </p>
          {wards.length === 0 && (
            <p className="text-center text-gray-400 py-8">No ward data yet</p>
          )}
          {wards.map((ward, i) => {
            const score = ward.transparency_score || 0
            const color = score >= 70 ? 'bg-green-500'
                        : score >= 40 ? 'bg-amber-500'
                        : 'bg-red-500'
            return (
              <div key={ward.ward_name}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium text-gray-900">
                      #{i + 1} {ward.ward_name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {ward.issues_resolved}/{ward.issues_raised} issues resolved
                    </p>
                  </div>
                  <span className={`text-white text-sm font-bold px-3 py-1 rounded-full ${color}`}>
                    {score}%
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${color}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Badges tab */}
      {!loading && tab === 'badges' && (
        <div className="grid grid-cols-2 gap-3">
          {Object.entries(BADGE_META).map(([key, { icon, label, desc }]) => (
            <div key={key}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 text-center">
              <div className="text-3xl mb-2">{icon}</div>
              <p className="font-semibold text-gray-900 text-sm">{label}</p>
              <p className="text-xs text-gray-400 mt-1">{desc}</p>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}
