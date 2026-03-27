import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

// Pages
import Register from './pages/register';
import Login from './pages/login';
import Dashboard from './pages/Dashboard';


// ProtectedRoute: redirects to /login if user is not logged in
const ProtectedRoute = ({ children }) => {
  const { user } = useAuth();

  if (!user) {
    // Not logged in — send to login page
    return <Navigate to="/login" replace />;
  }

  // Logged in — show the page
  return children;
};

function App() {
  return (
    // AuthProvider wraps everything so all pages can access user/token
    <AuthProvider>
      <Router>
        <Routes>

          {/* Public routes — anyone can visit */}
          <Route path="/" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />

          {/* Protected route — must be logged in */}
          
          {/* Redirect root / to login */}
          <Route path="/" element={<Navigate to="/login" replace />} />

        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;