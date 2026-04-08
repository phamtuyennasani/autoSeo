import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Keywords from './pages/Keywords';
import Companies from './pages/Companies';
import BatchJobs from './pages/BatchJobs';
import Settings from './pages/Settings';
import Help from './pages/Help';
import Login from './pages/Login';
import LoginV2 from './pages/LoginV2';
import Users from './pages/Users';
import TokenStats from './pages/TokenStats';
import HopDong from './pages/HopDong';
import WebhookEvents from './pages/WebhookEvents';
import ErrorLogs from './pages/ErrorLogs';
import ServerLogs from './pages/ServerLogs';
import KeywordPlanner from './pages/KeywordPlanner';
import WebsiteAnalysis from './pages/WebsiteAnalysis';
import { Toaster } from 'sonner';

const LOGIN_THEME = import.meta.env.VITE_LOGIN_THEME || 'modern';
const LoginComponent = LOGIN_THEME === 'nasani' ? LoginV2 : Login;
import { ThemeProvider } from './context/ThemeContext';
import { TokenProvider } from './context/TokenContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ConfirmProvider } from './context/ConfirmContext';
import ChatBot from './components/ChatBot';
import apiClient from './config/api';

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

// PublicRoute: redirect về / nếu đã đăng nhập
function PublicRoute({ children }) {
  const { user, loading, authEnabled } = useAuth();
  if (loading) return null;
  if (authEnabled && user) return <Navigate to="/" replace />;
  return children;
}

// RootRoute: chỉ cho phép role === 'root', redirect về / nếu không đủ quyền
function RootRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user || user.role !== 'root') return <Navigate to="/" replace />;
  return children;
}

// ChatBotWrapper: chỉ hiển thị khi đã đăng nhập + có API key
function ChatBotWrapper() {
  const { user, loading, authEnabled } = useAuth();
  const [available, setAvailable] = React.useState(null); // null=loading, true/false

  React.useEffect(() => {
    async function checkStatus() {
      try {
        const res = await apiClient.get('/api/chat/status');
        setAvailable(res.data.available);
      } catch {
        setAvailable(false);
      }
    }
    if (!loading) {
      if (!authEnabled || user) {
        checkStatus();
      } else {
        setAvailable(false);
      }
    }
  }, [loading, user, authEnabled]);

  if (loading || available === null) return null;
  if (!available) return null;
  return <ChatBot />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginComponent /></PublicRoute>} />
      <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
        <Route index element={<Navigate to="/keywords" replace />} />
        <Route path="keywords"   element={<Keywords />} />
        <Route path="companies"  element={<Companies />} />
        <Route path="batch-jobs"   element={<BatchJobs />} />
        <Route path="token-stats" element={<TokenStats />} />
        <Route path="settings"    element={<Settings />} />
        <Route path="help"        element={<Help />} />
        <Route path="users"          element={<Users />} />
        <Route path="hop-dong"       element={<RootRoute><HopDong /></RootRoute>} />
        <Route path="webhook-events" element={<RootRoute><WebhookEvents /></RootRoute>} />
        <Route path="error-logs"     element={<RootRoute><ErrorLogs /></RootRoute>} />
        <Route path="server-logs"    element={<RootRoute><ServerLogs /></RootRoute>} />
        <Route path="keyword-planner"   element={<KeywordPlanner />} />
        <Route path="website-analysis"  element={<WebsiteAnalysis />} />
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
            <ConfirmProvider>
              <AppRoutes />
              <Toaster richColors position="top-right" />
              <ChatBotWrapper />
            </ConfirmProvider>
          </BrowserRouter>
        </AuthProvider>
      </TokenProvider>
    </ThemeProvider>
  );
}

export default App;
