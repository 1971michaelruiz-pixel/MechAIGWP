import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import HomePage from './pages/HomePage'
import SessionWorkflowPage from './pages/SessionWorkflowPage'

function App() {
  return (
    <BrowserRouter>
      <nav style={{ padding: '0.5rem 2rem', borderBottom: '1px solid #e5e7eb', display: 'flex', gap: '1.5rem' }}>
        <Link to="/" style={navLink}>Home</Link>
        <Link to="/session" style={{ ...navLink, fontWeight: 600, color: '#3b82d4' }}>
          New Session
        </Link>
      </nav>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/session" element={<SessionWorkflowPage />} />
      </Routes>
    </BrowserRouter>
  )
}

const navLink: React.CSSProperties = {
  fontSize: '0.875rem',
  color: '#1f2328',
  textDecoration: 'none',
  fontWeight: 500,
}

export default App
