import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Keywords from './pages/Keywords';
import Companies from './pages/Companies';
import BatchJobs from './pages/BatchJobs';
import Settings from './pages/Settings';
import { ThemeProvider } from './context/ThemeContext';
import { TokenProvider } from './context/TokenContext';

function App() {
  return (
    <ThemeProvider>
      <TokenProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<Navigate to="/keywords" replace />} />
              <Route path="keywords" element={<Keywords />} />
              <Route path="companies" element={<Companies />} />
              <Route path="batch-jobs" element={<BatchJobs />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </TokenProvider>
    </ThemeProvider>
  );
}

export default App;
