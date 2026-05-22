import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListChecks, BarChart3, CalendarDays, Zap, Sun, Moon } from 'lucide-react';
import { motion } from 'framer-motion';
import { useSession } from '../context/SessionContext';
import { useTheme } from '../context/ThemeContext';

const navItems = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks',    icon: ListChecks,      label: 'Tasks' },
  { to: '/insights', icon: BarChart3,       label: 'Insights' },
  { to: '/calendar', icon: CalendarDays,    label: 'Calendar' },
];

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden
        ${isActive
          ? 'bg-brand-blue/10 text-brand-blue'
          : 'text-slate-600 hover:text-black dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.04]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="nav-pill"
              className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full bg-brand-blue"
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
          )}
          <Icon className={`w-[18px] h-[18px] transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-brand-blue' : ''}`} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { isActive: sessionActive } = useSession();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-white dark:bg-[#050a18] transition-colors duration-300">

      {/* ── Ambient Background ──────────────────────── */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[60vw] h-[60vw] rounded-full bg-brand-blue/[0.04] blur-[120px] animate-float" />
        <div className="absolute -bottom-[30%] -right-[15%] w-[50vw] h-[50vw] rounded-full bg-brand-purple/[0.04] blur-[120px] animate-float-delay" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full bg-brand-cyan/[0.02] blur-[100px]" />
      </div>

      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="w-[240px] flex-shrink-0 flex flex-col h-full border-r border-slate-200 dark:border-white/[0.06] bg-white/80 dark:bg-[#050a18]/80 backdrop-blur-xl relative z-10 transition-colors duration-300">

        {/* Logo */}
        <div className="px-6 pt-7 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center shadow-lg shadow-brand-blue/20">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-display font-bold tracking-tight text-black dark:text-white">
              FOCUSPIE
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-1">
          <p className="px-4 mb-3 text-[10px] font-semibold tracking-[0.15em] uppercase text-slate-500">
            Menu
          </p>
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Session status indicator */}
        <div className="px-4 pb-6">
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl text-xs font-medium transition-colors
            ${sessionActive
              ? 'bg-brand-emerald/10 text-brand-emerald'
              : 'bg-slate-100 dark:bg-white/[0.03] text-slate-600 dark:text-slate-400'
            }`}
          >
            <div className={`w-2 h-2 rounded-full ${sessionActive ? 'bg-brand-emerald animate-pulse-glow' : 'bg-slate-400 dark:bg-slate-600'}`} />
            {sessionActive ? 'Session Active' : 'No Active Session'}
          </div>

          <button
            onClick={toggleTheme}
            className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-medium bg-slate-100 dark:bg-white/[0.03] text-black dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/[0.06] transition-all"
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            {theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </aside>

      {/* ── Main Content ────────────────────────────── */}
      <main className="flex-1 overflow-y-auto custom-scroll">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="p-8 max-w-[1400px] mx-auto"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
