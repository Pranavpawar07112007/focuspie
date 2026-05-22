import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Check, Trash2, ListChecks, Clock, AlertTriangle, Flag, ArrowRight, CalendarDays, Flame, Sparkles, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTodos, createTodo, updateTodo, deleteTodo } from '../api';
import TaskModal from './TaskModal';
import { playSound, getXP, addXP, getLevelData, getStreak, completeDayStreak } from '../utils';

const PRIORITY_COLORS = {
  high:   { dot: '#f43f5e', bg: 'rgba(244,63,94,0.08)', border: 'rgba(244,63,94,0.15)', text: '#fb7185' },
  medium: { dot: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.15)', text: '#fbbf24' },
  low:    { dot: '#3B82F6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
};

const WARNING_LABELS = {
  overdue: { label: 'Overdue', color: '#f43f5e', icon: AlertTriangle },
  due_within_1h: { label: 'Due <1h', color: '#f43f5e', icon: Clock },
  due_today: { label: 'Due today', color: '#f59e0b', icon: Clock },
  due_tomorrow: { label: 'Tomorrow', color: '#3B82F6', icon: Clock },
};

function TaskCard({ todo, onToggle, onDelete, onStatusChange }) {
  const pc = PRIORITY_COLORS[todo.priority] || PRIORITY_COLORS.medium;
  const warning = todo.deadline_warning ? WARNING_LABELS[todo.deadline_warning] : null;
  const WarningIcon = warning?.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="group relative p-4 rounded-xl transition-all duration-200"
      style={{
        background: pc.bg,
        border: `1px solid ${pc.border}`,
      }}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        <button
          onClick={() => onToggle(todo)}
          className="mt-0.5 w-[18px] h-[18px] rounded flex-shrink-0 flex items-center justify-center border-2 transition-all cursor-pointer"
          style={{
            borderColor: todo.status === 'completed' ? '#3B82F6' : 'rgba(148,163,184,0.2)',
            background: todo.status === 'completed' ? '#3B82F6' : 'transparent',
          }}
        >
          {todo.status === 'completed' && <Check className="w-2.5 h-2.5 text-white" strokeWidth={3} />}
        </button>

        <div className="flex-1 min-w-0">
          {/* Task text */}
          <p className={`text-sm leading-snug transition-all ${
            todo.status === 'completed' ? 'line-through text-slate-500' : 'text-black dark:text-slate-200'
          }`}>
            {todo.task}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-2 mt-2">
            {/* Priority badge */}
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full"
              style={{ color: pc.text, background: pc.bg, border: `1px solid ${pc.border}` }}>
              {todo.priority}
            </span>

            {/* Deadline */}
            {todo.deadline && (
              <span className="text-[10px] text-slate-500 flex items-center gap-1">
                <Clock className="w-2.5 h-2.5" />
                {new Date(todo.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                {' '}
                {new Date(todo.deadline).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}

            {/* Deadline warning */}
            {warning && (
              <span className="text-[10px] font-semibold flex items-center gap-1 px-2 py-0.5 rounded-full animate-pulse"
                style={{ color: warning.color, background: `${warning.color}15` }}>
                <WarningIcon className="w-2.5 h-2.5" />
                {warning.label}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {todo.status === 'pending' && (
            <button onClick={() => onStatusChange(todo.id, 'ongoing')}
              title="Move to Ongoing"
              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-all cursor-pointer">
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {todo.status === 'ongoing' && (
            <button onClick={() => onStatusChange(todo.id, 'completed')}
              title="Mark Complete"
              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-emerald hover:bg-brand-emerald/10 transition-all cursor-pointer">
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => onDelete(todo.id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-rose hover:bg-brand-rose/10 transition-all cursor-pointer">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function Column({ title, count, color, children }) {
  return (
    <div className="flex-1 min-w-[280px]">
      <div className="flex items-center gap-2 mb-4 px-1">
        <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
        <h4 className="text-sm font-semibold text-black dark:text-white">{title}</h4>
        <span className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-white/[0.04] px-2 py-0.5 rounded-full ml-auto">
          {count}
        </span>
      </div>
      <div className="space-y-2.5 min-h-[100px]">
        <AnimatePresence mode="popLayout">
          {children}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function TodoList({ compact = false }) {
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Gamification States
  const [xp, setXp] = useState(() => getXP());
  const [streak, setStreak] = useState(() => getStreak());
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);

  // Date Filter State
  const [dateFilter, setDateFilter] = useState('all');
  const [customFilterDate, setCustomFilterDate] = useState(() => {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });

  useEffect(() => { 
    fetchTodos();
    // Listen for XP and Streak updates across components
    const handleStorageChange = () => {
      setXp(getXP());
      setStreak(getStreak());
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const fetchTodos = async () => {
    try {
      setTodos(await getTodos());
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleCreate = async (data) => {
    try {
      const todo = await createTodo(data);
      setTodos([todo, ...todos]);
      playSound('click');
    } catch (e) { console.error(e); }
  };

  const handleAddXP = (amount, todoId = null) => {
    if (todoId) {
      let awardedIds = [];
      try {
        awardedIds = JSON.parse(localStorage.getItem('awarded_todo_ids') || '[]');
      } catch (e) {
        awardedIds = [];
      }
      if (awardedIds.includes(todoId)) {
        return; // XP already awarded for this task!
      }
      awardedIds.push(todoId);
      localStorage.setItem('awarded_todo_ids', JSON.stringify(awardedIds));
    }

    const isLevelUp = addXP(amount);
    setXp(getXP());
    if (isLevelUp) {
      setTimeout(() => {
        playSound('levelup');
        setShowLevelUp(true);
      }, 500);
    }
  };

  const checkDayCompletion = (completedTodoId, currentTodos) => {
    const todayTodos = filterTodosByDate(currentTodos, 'today');
    const activeToday = todayTodos.filter(t => t.status !== 'completed');
    const activeBoard = currentTodos.filter(t => t.status !== 'completed');

    let shouldCelebrate = false;

    if (todayTodos.length > 0 && activeToday.length === 0) {
      shouldCelebrate = true;
      const updatedStreak = completeDayStreak();
      setStreak(updatedStreak);
    } else if (currentTodos.length > 0 && activeBoard.length === 0) {
      shouldCelebrate = true;
    }

    if (shouldCelebrate) {
      setTimeout(() => {
        playSound('celebrate');
        setShowCelebration(true);
      }, 400);
    }
  };

  const handleToggle = async (todo) => {
    const newStatus = todo.status === 'completed' ? 'pending' : 'completed';
    try {
      const updated = await updateTodo(todo.id, { status: newStatus });
      const newTodos = todos.map(t => t.id === todo.id ? updated : t);
      setTodos(newTodos);

      if (newStatus === 'completed') {
        playSound('complete');
        const xpReward = todo.priority === 'high' ? 30 : todo.priority === 'low' ? 10 : 20;
        handleAddXP(xpReward, todo.id);
        checkDayCompletion(todo.id, newTodos);
      } else {
        playSound('click');
      }
    } catch (e) { console.error(e); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const updated = await updateTodo(id, { status });
      const oldTodo = todos.find(t => t.id === id);
      const newTodos = todos.map(t => t.id === id ? updated : t);
      setTodos(newTodos);

      if (status === 'completed') {
        playSound('complete');
        const xpReward = oldTodo?.priority === 'high' ? 30 : oldTodo?.priority === 'low' ? 10 : 20;
        handleAddXP(xpReward, id);
        checkDayCompletion(id, newTodos);
      } else {
        playSound('click');
      }
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTodo(id);
      setTodos(todos.filter(t => t.id !== id));
      playSound('click');
    } catch (e) { console.error(e); }
  };

  // Date boundary filtering logic
  const filterTodosByDate = (todosList, filter) => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    
    const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowEnd = new Date(todayEnd.getTime() + 24 * 60 * 60 * 1000);

    return todosList.filter(todo => {
      if (filter === 'all') return true;
      if (filter === 'no_deadline') return !todo.deadline;
      if (!todo.deadline) return false;

      const deadlineDate = new Date(todo.deadline);
      if (filter === 'today') {
        return deadlineDate >= todayStart && deadlineDate <= todayEnd;
      }
      if (filter === 'tomorrow') {
        return deadlineDate >= tomorrowStart && deadlineDate <= tomorrowEnd;
      }
      if (filter === 'upcoming') {
        return deadlineDate > tomorrowEnd;
      }
      if (filter === 'overdue') {
        return deadlineDate < todayStart && todo.status !== 'completed';
      }
      if (filter === 'custom') {
        if (!customFilterDate) return false;
        const [year, month, day] = customFilterDate.split('-').map(Number);
        const customStart = new Date(year, month - 1, day, 0, 0, 0, 0);
        const customEnd = new Date(year, month - 1, day, 23, 59, 59, 999);
        return deadlineDate >= customStart && deadlineDate <= customEnd;
      }
      return true;
    });
  };

  // Date filters definition
  const dateFiltersList = [
    { id: 'all', label: 'All', icon: ListChecks },
    { id: 'today', label: 'Today', icon: CalendarDays },
    { id: 'tomorrow', label: 'Tomorrow', icon: ArrowRight },
    { id: 'upcoming', label: 'Upcoming', icon: Clock },
    { id: 'overdue', label: 'Overdue', icon: AlertTriangle },
    { id: 'no_deadline', label: 'No Deadline', icon: Flag },
    { id: 'custom', label: 'Custom Date', icon: CalendarDays }
  ];

  const filteredTodos = filterTodosByDate(todos, dateFilter);

  const pending   = filteredTodos.filter(t => t.status === 'pending');
  const ongoing   = filteredTodos.filter(t => t.status === 'ongoing');
  const completed = filteredTodos.filter(t => t.status === 'completed');

  const levelData = getLevelData(xp);

  // ── Render XP & level progress banner ─────────────────────────────
  const renderXpBanner = (isCompact = false) => {
    if (isCompact) {
      return (
        <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-brand-blue/5 via-brand-purple/5 to-brand-cyan/2 border border-brand-blue/10 dark:border-white/[0.04] mb-4">
          <div className="flex items-center gap-2">
            <span className="text-[9px] font-bold text-brand-blue bg-brand-blue/15 px-2 py-0.5 rounded-md">
              LVL {levelData.level}
            </span>
            <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">
              {levelData.title}
            </span>
          </div>
          <div className="flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 font-bold">
            <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500 animate-pulse" />
            <span>{streak.count}d Streak</span>
          </div>
        </div>
      );
    }

    return (
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden p-5 rounded-2xl border border-brand-blue/10 dark:border-white/[0.05] bg-gradient-to-r from-brand-blue/[0.04] via-brand-purple/[0.04] to-brand-cyan/[0.02] flex flex-col md:flex-row items-center justify-between gap-4 mb-6 shadow-sm"
      >
        <div className="absolute top-0 right-1/4 w-[150px] h-[150px] bg-brand-blue/[0.04] blur-[30px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[150px] h-[150px] bg-brand-purple/[0.04] blur-[30px] rounded-full pointer-events-none" />

        <div className="flex items-center gap-4 w-full md:w-auto">
          {/* Glowing animated badge */}
          <div className="relative w-14 h-14 rounded-full bg-gradient-to-tr from-brand-blue to-brand-purple flex items-center justify-center shadow-lg shadow-brand-blue/15 flex-shrink-0 group">
            <div className="absolute inset-[2px] rounded-full bg-white dark:bg-[#070e20] flex items-center justify-center font-display font-black text-lg text-brand-blue dark:text-brand-blue-light transition-all group-hover:scale-105">
              {levelData.level}
            </div>
          </div>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-bold text-sm text-black dark:text-white leading-tight">
                {levelData.title}
              </h3>
              <span className="text-[10px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase">
                {levelData.levelXP} / {levelData.levelTotalNeeded} XP
              </span>
            </div>
            {/* Smooth animated progress line */}
            <div className="w-full md:w-64 h-2 bg-slate-100 dark:bg-white/[0.06] rounded-full mt-2 overflow-hidden border border-slate-200/20 dark:border-white/[0.02]">
              <motion.div 
                className="h-full bg-gradient-to-r from-brand-blue to-brand-purple rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${levelData.progress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>

        {/* Streaks stats row */}
        <div className="flex items-center gap-4 w-full md:w-auto justify-end border-t md:border-t-0 border-slate-100 dark:border-white/[0.05] pt-3 md:pt-0">
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04] shadow-sm select-none">
            <Flame className="w-5 h-5 text-orange-500 fill-orange-500 animate-bounce" style={{ animationDuration: '2s' }} />
            <div className="text-left">
              <p className="text-xs font-black text-black dark:text-white leading-tight">{streak.count} Days</p>
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Streak</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-white/[0.03] border border-slate-100 dark:border-white/[0.04] shadow-sm select-none">
            <Sparkles className="w-5 h-5 text-amber-500 fill-amber-500/20 animate-pulse" />
            <div className="text-left">
              <p className="text-xs font-black text-black dark:text-white leading-tight">{xp} XP</p>
              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Total Power</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  // ── Render horizontal date filter pills ───────────────────────────
  const renderDateFilters = () => (
    <div className="space-y-3 mb-6">
      <div className="flex gap-1.5 overflow-x-auto pb-1.5 custom-scroll select-none scrollbar-none">
        {dateFiltersList.map(f => {
          const Icon = f.icon;
          const isSel = dateFilter === f.id;
          return (
            <button
              key={f.id}
              onClick={() => { playSound('click'); setDateFilter(f.id); }}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 cursor-pointer ${
                isSel
                  ? 'bg-brand-blue text-white shadow-md shadow-brand-blue/25 scale-[1.02]'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-white/[0.03] dark:hover:bg-white/[0.08] dark:text-slate-300 border border-transparent dark:border-white/[0.02]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {f.label}
            </button>
          );
        })}
      </div>
      
      <AnimatePresence>
        {dateFilter === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0, y: -5 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={{ opacity: 0, height: 0, y: -5 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-3 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/50 dark:border-white/[0.05] p-3 rounded-2xl w-full max-w-sm"
          >
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 whitespace-nowrap flex items-center gap-1.5">
              <CalendarDays className="w-4 h-4 text-brand-blue" /> Choose Date:
            </span>
            <input
              type="date"
              value={customFilterDate}
              onChange={(e) => {
                playSound('click');
                setCustomFilterDate(e.target.value);
              }}
              className="flex-1 bg-slate-100 dark:bg-white/[0.04] text-xs font-bold text-black dark:text-white border border-slate-200/50 dark:border-white/[0.05] rounded-xl px-3 py-2 outline-none focus:border-brand-blue transition-all"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  // ── Celebration and Level-up modal overlays ──────────────────────
  const renderCelebrationModal = () => (
    <AnimatePresence>
      {showCelebration && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md overflow-hidden"
        >
          {/* confetti floating effects */}
          <div className="absolute inset-0 pointer-events-none">
            {Array.from({ length: 30 }).map((_, i) => {
              const delay = Math.random() * 2;
              const duration = 3 + Math.random() * 3;
              const scale = 0.5 + Math.random() * 1.2;
              const xStart = Math.random() * window.innerWidth;
              const xEnd = xStart + (Math.random() - 0.5) * 200;
              const shapes = ['🎉', '✨', '🔥', '🏆', '⭐', '🎈', '⚡'];
              const shape = shapes[Math.floor(Math.random() * shapes.length)];
              
              return (
                <motion.div
                  key={i}
                  initial={{ y: window.innerHeight + 50, x: xStart, opacity: 1, scale: 0 }}
                  animate={{ 
                    y: -100, 
                    x: xEnd, 
                    opacity: [1, 1, 0],
                    scale: scale,
                    rotate: Math.random() * 360
                  }}
                  transition={{ 
                    duration: duration, 
                    delay: delay, 
                    repeat: Infinity,
                    ease: "easeOut"
                  }}
                  className="absolute text-lg select-none"
                >
                  {shape}
                </motion.div>
              );
            })}
          </div>

          <motion.div
            initial={{ scale: 0.9, y: 30, opacity: 0 }}
            animate={{ 
              scale: 1, 
              y: 0, 
              opacity: 1,
              transition: { type: "spring", damping: 15, stiffness: 200 }
            }}
            exit={{ scale: 0.95, y: 15, opacity: 0 }}
            className="w-full max-w-md bg-white dark:bg-[#0b142c] p-8 rounded-3xl border border-brand-blue/20 dark:border-white/10 shadow-2xl relative text-center overflow-hidden"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-gradient-to-tr from-brand-blue/15 to-brand-purple/15 blur-[50px] pointer-events-none" />

            <div className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/25 mb-6 animate-float relative">
              <Trophy className="w-10 h-10 text-white" strokeWidth={2} />
              <div className="absolute inset-0 rounded-2xl bg-white/20 animate-ping pointer-events-none" style={{ animationDuration: '2s' }} />
            </div>

            <h2 className="text-3xl font-display font-extrabold text-black dark:text-white tracking-tight leading-tight">
              Day Complete!
            </h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 font-medium">
              Absolutely outstanding work. You crushed all your scheduled tasks today!
            </p>

            <div className="grid grid-cols-2 gap-3 my-6">
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] text-center">
                <div className="flex justify-center mb-1">
                  <Flame className="w-6 h-6 text-orange-500 fill-orange-500 animate-pulse" />
                </div>
                <p className="text-lg font-black text-black dark:text-white leading-tight">{streak.count} Days</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Active Streak</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04] text-center">
                <div className="flex justify-center mb-1">
                  <Sparkles className="w-6 h-6 text-amber-500 fill-amber-500/10 animate-bounce" />
                </div>
                <p className="text-lg font-black text-black dark:text-white leading-tight">+{streak.count > 0 ? streak.count * 15 : 25} XP</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Streak Bonus</p>
              </div>
            </div>

            <p className="text-xs text-slate-400 font-medium italic mb-6">
              "Focus is a muscle. Today, you trained it to perfection."
            </p>

            <button
              onClick={() => {
                playSound('click');
                setShowCelebration(false);
                const bonus = streak.count > 0 ? streak.count * 15 : 25;
                handleAddXP(bonus);
              }}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl font-bold text-sm
                bg-gradient-to-r from-brand-blue to-brand-purple text-white shadow-lg shadow-brand-blue/25
                hover:shadow-brand-blue/45 hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 cursor-pointer"
            >
              Claim Streak Bonus & Continue
            </button>
          </motion.div>
        </motion.div>,
        document.body
      )}
    </AnimatePresence>
  );

  const renderLevelUpModal = () => (
    <AnimatePresence>
      {showLevelUp && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.85, rotate: -5, opacity: 0 }}
            animate={{ 
              scale: 1, 
              rotate: 0,
              opacity: 1,
              transition: { type: "spring", damping: 12, stiffness: 180 }
            }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-sm bg-gradient-to-b from-[#0f1b3e] to-[#080f25] p-8 rounded-3xl border border-brand-purple/35 shadow-2xl relative text-center overflow-hidden"
          >
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[350px] h-[350px] rounded-full bg-gradient-to-r from-brand-blue/20 to-brand-purple/20 blur-[60px] animate-spin pointer-events-none" style={{ animationDuration: '8s' }} />

            <div className="w-18 h-18 mx-auto rounded-full bg-gradient-to-tr from-brand-blue to-brand-purple flex items-center justify-center shadow-lg shadow-brand-purple/40 mb-6">
              <Sparkles className="w-9 h-9 text-white animate-pulse" />
            </div>

            <span className="text-[10px] font-black tracking-[0.2em] uppercase text-brand-purple-light px-3 py-1 bg-brand-purple/10 border border-brand-purple/20 rounded-full">
              LEVEL UP!
            </span>

            <h2 className="text-3xl font-display font-black text-white tracking-tight leading-none mt-4">
              Level {levelData.level}
            </h2>
            <p className="text-sm font-bold text-brand-blue-light mt-1">
              {levelData.title}
            </p>

            <p className="text-xs text-slate-400 mt-4 px-2 leading-relaxed">
              Congratulations! Your focus capability has grown. You have unlocked the rank of <strong className="text-slate-200">{levelData.title}</strong>!
            </p>

            <button
              onClick={() => { playSound('click'); setShowLevelUp(false); }}
              className="mt-6 w-full py-3 px-6 rounded-xl font-bold text-sm bg-white hover:bg-slate-100 text-black shadow-lg transition-all active:scale-[0.98] cursor-pointer"
            >
              Sensational!
            </button>
          </motion.div>
        </motion.div>,
        document.body
      )}
    </AnimatePresence>
  );

  // ── Compact mode for dashboard ──────────────────────
  if (compact) {
    const activeFiltered = filterTodosByDate(todos, dateFilter);
    const urgentTasks = activeFiltered.filter(t => t.status !== 'completed').slice(0, 4);
    
    return (
      <div className="flex flex-col h-full min-h-[300px]">
        {/* Compact gamification indicator */}
        {renderXpBanner(true)}

        <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100 dark:border-white/[0.05]">
          <div className="flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-brand-blue" />
            <h3 className="text-sm font-display font-bold text-black dark:text-white">Active Tasks</h3>
          </div>
          <button 
            onClick={() => setModalOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-brand-blue/10 hover:bg-brand-blue/20 text-brand-blue dark:text-brand-blue-light transition-all text-xs font-semibold cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        </div>

        {/* Date Filter pills */}
        {renderDateFilters()}

        {loading ? (
          <div className="flex-1 flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-slate-300 border-t-brand-blue rounded-full animate-spin" />
          </div>
        ) : urgentTasks.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center py-8 text-center">
            <div className="w-10 h-10 rounded-full bg-brand-emerald/10 flex items-center justify-center mb-2 animate-bounce">
              <Check className="w-5 h-5 text-brand-emerald" strokeWidth={3} />
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">All caught up!</p>
            <p className="text-[10px] text-slate-400">Enjoy your focus time.</p>
          </div>
        ) : (
          <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[250px] pr-1 custom-scroll">
            <AnimatePresence mode="popLayout">
              {urgentTasks.map(t => {
                const pc = PRIORITY_COLORS[t.priority] || PRIORITY_COLORS.medium;
                const warning = t.deadline_warning ? WARNING_LABELS[t.deadline_warning] : null;
                const WarningIcon = warning?.icon;
                return (
                  <motion.div
                    key={t.id}
                    layout
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    className="p-3 rounded-xl border border-slate-100 dark:border-white/[0.04] bg-slate-50/50 dark:bg-white/[0.01] hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-all flex items-start gap-2.5 group"
                  >
                    {/* Checkbox */}
                    <button
                      onClick={() => handleToggle(t)}
                      className="mt-0.5 w-[16px] h-[16px] rounded flex-shrink-0 flex items-center justify-center border transition-all cursor-pointer"
                      style={{
                        borderColor: t.status === 'completed' ? '#3B82F6' : 'rgba(148,163,184,0.3)',
                        background: t.status === 'completed' ? '#3B82F6' : 'transparent',
                      }}
                    >
                      {t.status === 'completed' && <Check className="w-2 text-white" strokeWidth={4} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug transition-all ${
                        t.status === 'completed' ? 'line-through text-slate-500' : 'text-slate-800 dark:text-slate-200'
                      }`}>
                        {t.task}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <div className="flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pc.dot }} />
                          <span className="text-[9px] font-semibold text-slate-400 capitalize">{t.priority}</span>
                        </div>

                        {t.deadline && (
                          <span className="text-[9px] text-slate-400 flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" />
                            {new Date(t.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                        )}

                        {warning && (
                          <span className="text-[9px] font-semibold flex items-center gap-0.5 text-brand-rose animate-pulse">
                            <WarningIcon className="w-2 h-2" />
                            {warning.label}
                          </span>
                        )}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDelete(t.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-brand-rose/10 hover:text-brand-rose text-slate-400 dark:text-slate-600 transition-all cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}

        <AnimatePresence>
          {modalOpen && (
            <TaskModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} />
          )}
        </AnimatePresence>
        
        {renderCelebrationModal()}
        {renderLevelUpModal()}
      </div>
    );
  }

  // ── Full Kanban board ───────────────────────────────
  return (
    <div className="animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-black dark:text-white flex items-center gap-2">
            Task Board
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            {todos.length} tasks · {pending.length} pending · {ongoing.length} in progress
          </p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
            bg-gradient-to-r from-brand-blue to-brand-blue-light text-white
            shadow-lg shadow-brand-blue/20
            hover:shadow-brand-blue/35 hover:scale-[1.02]
            active:scale-[0.98] transition-all duration-200 cursor-pointer">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

      {/* Gamification Dashboard */}
      {renderXpBanner()}

      {/* Date Filters Pills */}
      {renderDateFilters()}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-slate-700 border-t-brand-blue rounded-full animate-spin" />
        </div>
      ) : (
        <div className="flex gap-5 overflow-x-auto pb-4 custom-scroll">
          <Column title="Pending" count={pending.length} color="#f59e0b">
            {pending.map(t => (
              <TaskCard key={t.id} todo={t} onToggle={handleToggle} onDelete={handleDelete} onStatusChange={handleStatusChange} />
            ))}
          </Column>
          <Column title="In Progress" count={ongoing.length} color="#3B82F6">
            {ongoing.map(t => (
              <TaskCard key={t.id} todo={t} onToggle={handleToggle} onDelete={handleDelete} onStatusChange={handleStatusChange} />
            ))}
          </Column>
          <Column title="Completed" count={completed.length} color="#34d399">
            {completed.map(t => (
              <TaskCard key={t.id} todo={t} onToggle={handleToggle} onDelete={handleDelete} onStatusChange={handleStatusChange} />
            ))}
          </Column>
        </div>
      )}

      <AnimatePresence>
        {modalOpen && (
          <TaskModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} />
        )}
      </AnimatePresence>

      {renderCelebrationModal()}
      {renderLevelUpModal()}
    </div>
  );
}
