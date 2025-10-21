import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import './App.css';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import Dashboard from './pages/Dashboard';
import WorkOrders from './pages/WorkOrders';
import WorkOrderDetails from './pages/WorkOrderDetails';
import CreateWorkOrder from './pages/CreateWorkOrder';
import PreventiveMaintenance from './pages/PreventiveMaintenance';
import Reports from './pages/Reports';
import Users from './pages/Users';
import Settings from './pages/Settings';
import NotificationsPage from './pages/NotificationsPage';

const ProtectedRoute = ({ children }) => {
  const { user, loading, processingSession } = useAuth();

  if (loading || processingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return user ? children : <Navigate to="/login" />;
};

const PublicRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return user ? <Navigate to="/dashboard" /> : children;
};

const SessionHandler = () => {
  const { user, processGoogleSession, processingSession } = useAuth();

  useEffect(() => {
    const handleSession = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes('session_id=')) {
        const sessionId = hash.split('session_id=')[1].split('&')[0];
        if (sessionId) {
          await processGoogleSession(sessionId);
        }
      }
    };

    if (!user) {
      handleSession();
    }
  }, [user, processGoogleSession]);

  if (processingSession) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mb-4"></div>
        <p className="text-gray-600">Authenticating...</p>
      </div>
    );
  }

  return null;
};

function AppContent() {
  return (
    <>
      <SessionHandler />
      <Routes>
        <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
        <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
        <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
        <Route path="/work-orders" element={<ProtectedRoute><WorkOrders /></ProtectedRoute>} />
        <Route path="/work-orders/new" element={<ProtectedRoute><CreateWorkOrder /></ProtectedRoute>} />
        <Route path="/work-orders/:id" element={<ProtectedRoute><WorkOrderDetails /></ProtectedRoute>} />
        <Route path="/preventive-maintenance" element={<ProtectedRoute><PreventiveMaintenance /></ProtectedRoute>} />
        <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
        <Route path="/users" element={<ProtectedRoute><Users /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
        <Route path="/notifications" element={<ProtectedRoute><NotificationsPage /></ProtectedRoute>} />
        <Route path="/" element={<Navigate to="/dashboard" />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;