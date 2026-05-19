import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext.jsx'
import { ThemeProvider } from './contexts/ThemeContext.jsx'
import { RatingsProvider } from './contexts/RatingsContext.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'
import Landing from './pages/Landing.jsx'
import Dashboard from './pages/Dashboard.jsx'
import MovieDetail from './pages/MovieDetail.jsx'
import Theaters from './pages/Theaters.jsx'
import Watchlist from './pages/Watchlist.jsx'
import MyFilms from './pages/MyFilms.jsx'
import Settings from './pages/Settings.jsx'
import TermsOfService from './pages/TermsOfService.jsx'
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import Suggestions from './pages/Suggestions.jsx'
import Stats from './pages/Stats.jsx'
import ResetPassword from './pages/ResetPassword.jsx'

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <RatingsProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/movie/:id"
              element={
                <ProtectedRoute>
                  <MovieDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/theaters"
              element={
                <ProtectedRoute>
                  <Theaters />
                </ProtectedRoute>
              }
            />
            <Route
              path="/watchlist"
              element={<Navigate to="/my-films" replace />}
            />
            <Route
              path="/my-films"
              element={
                <ProtectedRoute>
                  <MyFilms />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              }
            />
            <Route
              path="/suggestions"
              element={
                <ProtectedRoute>
                  <Suggestions />
                </ProtectedRoute>
              }
            />
            <Route
              path="/stats"
              element={
                <ProtectedRoute>
                  <Stats />
                </ProtectedRoute>
              }
            />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/terms" element={<TermsOfService />} />
            <Route path="/privacy" element={<PrivacyPolicy />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
        </RatingsProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
