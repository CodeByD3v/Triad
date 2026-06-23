import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Dashboard from './pages/Dashboard'
import Report from './pages/Report'
import IssueDetail from './pages/IssueDetail'
import Leaderboard from './pages/Leaderboard'

export default function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/report" element={<Report />} />
          <Route path="/issue/:id" element={<IssueDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}
