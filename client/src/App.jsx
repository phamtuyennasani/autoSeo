import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Keywords from './pages/Keywords';
import Companies from './pages/Companies';
import BatchJobs from './pages/BatchJobs';
import Settings from './pages/Settings';
import Help from './pages/Help';
import Login from './pages/Login';
import Users from './pages/Users';
import TokenStats from './pages/TokenStats';
import { ThemeProvider } from './context/ThemeContext';
import { TokenProvider } from './context/TokenContext';
import { AuthProvider, useAuth } from './context/AuthContext';

// PrivateRoute: redirect /login nếu AUTH=true và chưa đăng nhập
function PrivateRoute({ children }) {
  const { user, loading, authEnabled } = useAuth();
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: 'var(--bg-main)', color: 'var(--text-secondary)',
        fontSize: '14px', gap: '10px',
      }}>
        <div style={{
          width: '18px', height: '18px',
          border: '2px solid var(--border)',
          borderTopColor: 'var(--accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        Đang tải...
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (authEnabled && !user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/keywords" replace />} />
        <Route path="keywords"   element={<Keywords />} />
        <Route path="companies"  element={<Companies />} />
        <Route path="batch-jobs"   element={<BatchJobs />} />
        <Route path="token-stats" element={<TokenStats />} />
        <Route path="settings"    element={<Settings />} />
        <Route path="help"        element={<Help />} />
        <Route path="users"       element={<Users />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <ThemeProvider>
      <TokenProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TokenProvider>
    </ThemeProvider>
  );
}

export default App;
