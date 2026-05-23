import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListChecks, BarChart3, CalendarDays, Settings, Zap, Sun, Moon, LogOut, User } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from '../context/SessionContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';

const navItems = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks',    icon: ListChecks,      label: 'Tasks' },
  { to: '/insights', icon: BarChart3,       label: 'Insights' },
  { to: '/calendar', icon: CalendarDays,    label: 'Calendar' },
  { to: '/settings', icon: Settings,        label: 'Settings' },
];

function NavItem({ to, icon: Icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `group flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold tracking-wide transition-all duration-300 relative overflow-visible
        ${isActive
          ? 'text-brand-blue font-bold'
          : 'text-slate-600 hover:text-black dark:text-slate-400 dark:hover:text-white hover:bg-slate-100/50 dark:hover:bg-white/[0.03]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.div
              layoutId="nav-pill-top"
              className="absolute inset-0 rounded-full bg-brand-blue/10 -z-10"
              transition={{ type: 'spring', stiffness: 350, damping: 30 }}
            />
          )}
          <Icon className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${isActive ? 'text-brand-blue' : 'text-slate-400 dark:text-slate-500'}`} />
          <span>{label}</span>
        </>
      )}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { isActive: sessionActive } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-white dark:bg-[#050a18] transition-colors duration-300">

      {/* ── Ambient Background ──────────────────────── */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -left-[20%] w-[60vw] h-[60vw] rounded-full bg-brand-blue/[0.04] blur-[120px] animate-float" />
        <div className="absolute -bottom-[30%] -right-[15%] w-[50vw] h-[50vw] rounded-full bg-brand-purple/[0.04] blur-[120px] animate-float-delay" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[40vw] h-[40vw] rounded-full bg-brand-cyan/[0.02] blur-[100px]" />
      </div>

      {/* ── Top Floating Glassmorphic Navbar ─────────── */}
      <header className="fixed top-4 left-4 right-4 z-40 h-16 glass backdrop-blur-xl border border-slate-200/50 dark:border-white/[0.06] rounded-full px-6 flex items-center justify-between shadow-lg">
        
        {/* Left Section: Logo & Status Badge */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center shadow-lg shadow-brand-blue/20">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm md:text-base font-display font-bold tracking-tight text-black dark:text-white">
              FOCUSPIE
            </span>
          </div>
          
          {/* Breathing Session Indicator */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider transition-colors
            ${sessionActive
              ? 'bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20 shadow-[0_0_12px_rgba(52,211,153,0.15)]'
              : 'bg-slate-100 dark:bg-white/[0.03] text-slate-500 dark:text-slate-400 border border-slate-200/50 dark:border-white/[0.04]'
            }`}
          >
            <div className={`w-1.5 h-1.5 rounded-full ${sessionActive ? 'bg-brand-emerald animate-pulse-glow' : 'bg-slate-400 dark:bg-slate-600'}`} />
            <span className="hidden sm:inline">{sessionActive ? 'Session Active' : 'Idle'}</span>
          </div>
        </div>

        {/* Center Section: Navigation Links Horizontal Layout */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-100/50 dark:bg-white/[0.02] border border-slate-200/20 dark:border-white/[0.03] p-1 rounded-full">
          {navItems.map((item) => (
            <NavItem key={item.to} {...item} />
          ))}
        </nav>

        {/* Right Section: User Badge, Mobile Nav & Theme Toggle */}
        <div className="flex items-center gap-3">
          {/* Mobile Navigation */}
          <nav className="flex md:hidden items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) =>
                    `p-2 rounded-xl transition-all duration-300 relative
                    ${isActive ? 'text-brand-blue bg-brand-blue/10' : 'text-slate-500 hover:text-black dark:hover:text-white'}`
                  }
                  title={item.label}
                >
                  <Icon className="w-4 h-4" />
                </NavLink>
              );
            })}
          </nav>

          {/* User Badge */}
          {user && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/30 dark:border-white/[0.05]">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-brand-blue to-brand-purple flex items-center justify-center">
                <span className="text-[9px] font-bold text-white uppercase">{user.username?.[0]}</span>
              </div>
              <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-400 max-w-[60px] truncate">
                {user.username}
              </span>
            </div>
          )}

          {/* Micro-Animated Premium Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-xl bg-slate-100 dark:bg-white/[0.03] border border-slate-200/50 dark:border-white/[0.04] text-slate-700 dark:text-slate-400 hover:text-brand-blue dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/[0.06] hover:scale-105 transition-all duration-300 relative overflow-hidden cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={theme}
                initial={{ y: -15, opacity: 0, rotate: -40 }}
                animate={{ y: 0, opacity: 1, rotate: 0 }}
                exit={{ y: 15, opacity: 0, rotate: 40 }}
                transition={{ duration: 0.2, ease: "easeInOut" }}
              >
                {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-brand-blue" />}
              </motion.div>
            </AnimatePresence>
          </button>
        </div>

      </header>

      {/* ── Main Viewport Content ────────────────────── */}
      <main className="pt-24 pb-8 px-4 md:px-8 max-w-[1400px] mx-auto min-h-screen">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        >
          {children}
        </motion.div>
      </main>
      
    </div>
  );
}
