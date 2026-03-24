import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import PublicPage from './pages/PublicPage';
import AdminPage from './pages/AdminPage';
import AuctionHistoryPage from './pages/AuctionHistoryPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="App">
        <Routes>
          <Route path="/" element={<PublicPage />} />
          <Route path="/list" element={<AdminPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/auction-history" element={<AuctionHistoryPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
