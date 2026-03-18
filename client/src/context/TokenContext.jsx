import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_STATS = 'http://localhost:3001/api/stats/tokens';

const TokenContext = createContext(null);

export const TokenProvider = ({ children }) => {
  const [tokenStats, setTokenStats] = useState({
    total_input: 0,
    total_output: 0,
    total_tokens: 0,
    total_calls: 0,
  });

  const fetchStats = useCallback(async () => {
    try {
      const res = await axios.get(API_STATS);
      setTokenStats(res.data);
    } catch (err) {
      // Server có thể chưa chạy, bỏ qua lỗi
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Tự động refresh mỗi 30 giây
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [fetchStats]);

  return (
    <TokenContext.Provider value={{ tokenStats, refreshStats: fetchStats }}>
      {children}
    </TokenContext.Provider>
  );
};

export const useToken = () => useContext(TokenContext);
