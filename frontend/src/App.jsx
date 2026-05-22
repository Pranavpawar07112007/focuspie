import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { SessionProvider } from './context/SessionContext';
import { ThemeProvider } from './context/ThemeContext';
import Layout from './components/Layout';
import DistractionOverlay from './components/DistractionOverlay';
import FocusTimer from './components/FocusTimer';
import TodoList from './components/TodoList';
import Insights from './components/Insights';
import CalendarView from './components/CalendarView';

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

        {/* Quick tasks — takes 2 cols */}
        <div className="lg:col-span-2 glass p-6">
          <TodoList compact />
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

// ── App Root ───────────────────────────────────────────
function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <SessionProvider>
          <Layout>
            <Routes>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/tasks" element={<TasksPage />} />
              <Route path="/insights" element={<InsightsPage />} />
              <Route path="/calendar" element={<CalendarPage />} />
            </Routes>
          </Layout>
          <DistractionOverlay />
        </SessionProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
