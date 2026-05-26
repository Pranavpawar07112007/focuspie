import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, NavLink } from 'react-router-dom';
import { Users } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SessionProvider } from './context/SessionContext';
import { RoomProvider, useRoom } from './context/RoomContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import DistractionOverlay from './components/DistractionOverlay';
import LoginPage from './components/LoginPage';
import SettingsPage from './components/SettingsPage';
import FocusTimer from './components/FocusTimer';
import TodoList from './components/TodoList';
import MiniPlayer from './components/MiniPlayer';
import Insights from './components/Insights';
import CalendarView from './components/CalendarView';
import LiveSessionTimeline from './components/LiveSessionTimeline';
import RoomsPage from './components/RoomsPage';
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


class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ error, errorInfo });
    console.error("React Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: 'red', background: 'white', height: '100vh' }}>
          <h1>Something went wrong.</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Dashboard Page ─────────────────────────────────────
function DashboardPage() {
  const { currentRoomId } = useRoom();

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-display font-bold text-black dark:text-white">Dashboard</h2>
        <p className="text-sm text-slate-500 mt-1">Your productivity command center</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Timer — takes 3 cols */}
        <div className="lg:col-span-3">
          {currentRoomId ? (
            <div className="glass p-8 rounded-3xl flex flex-col items-center justify-center text-center h-full min-h-[300px]">
              <div className="w-16 h-16 bg-brand-blue/10 rounded-full flex items-center justify-center mb-4">
                <Users className="w-8 h-8 text-brand-blue" />
              </div>
              <h3 className="text-xl font-bold text-black dark:text-white mb-2">You are in a Room</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm">
                Your focus timer is currently managed inside your active room.
              </p>
              <NavLink to="/rooms" className="px-6 py-3 bg-brand-blue text-white rounded-xl font-bold hover:bg-brand-blue/90 transition-colors shadow-lg shadow-brand-blue/20">
                Go to Room
              </NavLink>
            </div>
          ) : (
            <FocusTimer />
          )}
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


function MainApp() {
  return (
    <SessionProvider>
      <RoomProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/calendar" element={<CalendarPage />} />
            <Route path="/settings" element={<SettingsPageWrapper />} />
            <Route path="/rooms" element={<RoomsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        <DistractionOverlay />
      </RoomProvider>
    </SessionProvider>
  );
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
      <Route path="/miniplayer" element={
        <ProtectedRoute>
          <SessionProvider>
            <MiniPlayer />
          </SessionProvider>
        </ProtectedRoute>
      } />
      <Route path="/*" element={
        <ProtectedRoute>
          <MainApp />
        </ProtectedRoute>
      } />
    </Routes>
  );
}


// ── App Root ───────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <HashRouter>
        <ThemeProvider>
          <AuthProvider>
            <AppContent />
          </AuthProvider>
        </ThemeProvider>
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
