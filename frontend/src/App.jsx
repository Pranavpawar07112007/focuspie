import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SessionProvider } from './context/SessionContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import DistractionOverlay from './components/DistractionOverlay';
import LoginPage from './components/LoginPage';
import SettingsPage from './components/SettingsPage';
import FocusTimer from './components/FocusTimer';
import TodoList from './components/TodoList';
import Insights from './components/Insights';
import CalendarView from './components/CalendarView';
import LiveSessionTimeline from './components/LiveSessionTimeline';
import { playSound } from './utils';


// ── Protected Route Wrapper ───────────────────────────
function ProtectedRoute({ children }) {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#050a18]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
}


// ── Dashboard Page ─────────────────────────────────────
function DashboardPage() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-display font-bold text-black dark:text-white">Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">Your productivity command center</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Timer — takes 3 cols */}
        <div className="lg:col-span-3">
          <FocusTimer />
        </div>

        {/* Column for tasks and live activity tracking timeline — takes 2 cols */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="glass p-6">
            <TodoList compact />
          </div>
          <div className="glass p-6">
            <LiveSessionTimeline />
          </div>
        </div>
      </div>

      {/* Quick insights */}
      <div className="glass p-6">
        <Insights compact />
      </div>
    </div>
  );
}

// ── Tasks Page ─────────────────────────────────────────
function TasksPage() {
  return <TodoList />;
}

// ── Insights Page ──────────────────────────────────────
function InsightsPage() {
  return <Insights />;
}

// ── Calendar Page ──────────────────────────────────────
function CalendarPage() {
  return <CalendarView />;
}

// ── Settings Page ──────────────────────────────────────
function SettingsPageWrapper() {
  return <SettingsPage />;
}


// ── App Content (needs auth context) ──────────────────
function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    const handleGlobalClick = (e) => {
      const interactiveEl = e.target.closest('button, a, input, select, textarea, [role="button"], .cursor-pointer');
      if (interactiveEl) {
        playSound('click');
      }
    };
    window.addEventListener('click', handleGlobalClick, { capture: true });
    return () => {
      window.removeEventListener('click', handleGlobalClick, { capture: true });
    };
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-[#050a18]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
          <p className="text-xs font-semibold text-slate-500">Starting FocusPie...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={
        isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
      } />
      <Route path="/" element={
        <ProtectedRoute>
          <SessionProvider>
            <Layout>
              <DashboardPage />
            </Layout>
            <DistractionOverlay />
          </SessionProvider>
        </ProtectedRoute>
      } />
      <Route path="/tasks" element={
        <ProtectedRoute>
          <SessionProvider>
            <Layout>
              <TasksPage />
            </Layout>
            <DistractionOverlay />
          </SessionProvider>
        </ProtectedRoute>
      } />
      <Route path="/insights" element={
        <ProtectedRoute>
          <SessionProvider>
            <Layout>
              <InsightsPage />
            </Layout>
            <DistractionOverlay />
          </SessionProvider>
        </ProtectedRoute>
      } />
      <Route path="/calendar" element={
        <ProtectedRoute>
          <SessionProvider>
            <Layout>
              <CalendarPage />
            </Layout>
            <DistractionOverlay />
          </SessionProvider>
        </ProtectedRoute>
      } />
      <Route path="/settings" element={
        <ProtectedRoute>
          <SessionProvider>
            <Layout>
              <SettingsPageWrapper />
            </Layout>
            <DistractionOverlay />
          </SessionProvider>
        </ProtectedRoute>
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}


// ── App Root ───────────────────────────────────────────
function App() {
  return (
    <HashRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </HashRouter>
  );
}

export default App;
