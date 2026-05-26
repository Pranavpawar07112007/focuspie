import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, ListChecks, BarChart3, CalendarDays, Settings, Zap, Sun, Moon, LogOut, User, Users, Menu, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSession } from '../context/SessionContext';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import InteractiveAvatar from './InteractiveAvatar';
import { getXP, getLevelData, getStreak } from '../utils';
import { getSettings } from '../api';

const navItems = [
  { to: '/',         icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/tasks',    icon: ListChecks,      label: 'Tasks' },
  { to: '/insights', icon: BarChart3,       label: 'Insights' },
  { to: '/calendar', icon: CalendarDays,    label: 'Calendar' },
  { to: '/rooms',    icon: Users,           label: 'Rooms' },
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
  const { isActive: sessionActive, onBreak } = useSession();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  
  // Avatar States
  const [avatarStyle, setAvatarStyle] = React.useState('fox');
  const [xp, setXp] = React.useState(() => getXP());
  const [streak, setStreak] = React.useState(() => getStreak());
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const fetchSettings = () => getSettings().then(s => setAvatarStyle(s.avatar_style || 'fox')).catch(() => {});
    fetchSettings();
    window.addEventListener('settingsUpdated', fetchSettings);
    
    const handleStorageChange = () => {
      setXp(getXP());
      setStreak(getStreak());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('settingsUpdated', fetchSettings);
    };
  }, []);

  const levelData = getLevelData(xp);
  const avatarSessionState = sessionActive ? (onBreak ? 'break' : 'focusing') : 'idle';
  const location = useLocation();

  return (
    <div className="min-h-screen transition-colors duration-300">

      {/* ── Ambient Background ──────────────────────── */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] -left-[10%] w-[50vw] h-[50vw] rounded-full bg-brand-blue/10 blur-[120px] animate-float mix-blend-multiply dark:mix-blend-screen" />
        <div className="absolute top-[20%] -right-[15%] w-[45vw] h-[45vw] rounded-full bg-brand-purple/10 blur-[120px] animate-float mix-blend-multiply dark:mix-blend-screen" style={{ animationDelay: '2s' }} />
        <div className="absolute -bottom-[20%] left-[10%] w-[40vw] h-[40vw] rounded-full bg-brand-cyan/10 blur-[100px] animate-float mix-blend-multiply dark:mix-blend-screen" style={{ animationDelay: '1s' }} />
        <div className="absolute bottom-[10%] -right-[10%] w-[35vw] h-[35vw] rounded-full bg-brand-rose/10 blur-[100px] animate-float mix-blend-multiply dark:mix-blend-screen" style={{ animationDelay: '3s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30vw] h-[30vw] rounded-full bg-brand-yellow/10 blur-[120px] animate-float mix-blend-multiply dark:mix-blend-screen" style={{ animationDelay: '4s' }} />
        
        {/* Floating particles */}
        {Array.from({ length: 15 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full bg-brand-blue/30 dark:bg-brand-blue/20"
            style={{
              width: Math.random() * 6 + 2 + 'px',
              height: Math.random() * 6 + 2 + 'px',
              top: Math.random() * 100 + '%',
              left: Math.random() * 100 + '%',
            }}
            animate={{
              y: [0, -100, 0],
              opacity: [0.2, 0.8, 0.2],
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
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
          {/* Mobile Navigation Hamburger */}
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="md:hidden p-2 rounded-xl text-slate-500 hover:text-black dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/[0.03]"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* User Avatar Companion */}
          {user && (
            <div className="hidden sm:block cursor-pointer hover:scale-105 transition-transform" title={`${user.username}'s Companion`}>
              <InteractiveAvatar 
                avatarStyle={avatarStyle} 
                sessionState={avatarSessionState} 
                level={levelData.level} 
                streak={streak.count} 
              />
            </div>
          )}

          {/* Settings Gear */}
          <NavLink
            to="/settings"
            className={({ isActive }) => 
              `p-2.5 rounded-xl border transition-all duration-300 relative overflow-hidden cursor-pointer
              ${isActive 
                ? 'bg-brand-blue/10 border-brand-blue/20 text-brand-blue' 
                : 'bg-slate-100 dark:bg-white/[0.03] border-slate-200/50 dark:border-white/[0.04] text-slate-700 dark:text-slate-400 hover:text-brand-blue dark:hover:text-white hover:bg-slate-200 dark:hover:bg-white/[0.06] hover:scale-105'
              }`
            }
            title="Settings"
          >
            <Settings className="w-4 h-4 transition-transform duration-500 hover:rotate-90" />
          </NavLink>
        </div>

      </header>

      {/* Mobile Side Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMobileMenuOpen(false)}
              className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm md:hidden"
            />
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-64 bg-white dark:bg-[#0a0f1c] shadow-2xl border-r border-slate-200 dark:border-white/[0.05] p-6 flex flex-col md:hidden"
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center">
                    <Zap className="w-4 h-4 text-white" />
                  </div>
                  <span className="text-base font-display font-bold text-black dark:text-white">FOCUSPIE</span>
                </div>
                <button
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex flex-col gap-2">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setIsMobileMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300
                        ${isActive ? 'bg-brand-blue/10 text-brand-blue font-semibold' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/[0.02]'}`
                      }
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </NavLink>
                  );
                })}
              </nav>

              <div className="mt-auto flex justify-center">
                 {user && (
                  <InteractiveAvatar 
                    avatarStyle={avatarStyle} 
                    sessionState={avatarSessionState} 
                    level={levelData.level} 
                    streak={streak.count} 
                  />
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
