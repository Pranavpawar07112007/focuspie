import React, { useState, useEffect } from 'react';
import { Plus, Check, Trash2, ListChecks, Clock, AlertTriangle, Flag, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getTodos, createTodo, updateTodo, deleteTodo } from '../api';
import TaskModal from './TaskModal';

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
          className="mt-0.5 w-[18px] h-[18px] rounded flex-shrink-0 flex items-center justify-center border-2 transition-all"
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
              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-blue hover:bg-brand-blue/10 transition-all">
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
          {todo.status === 'ongoing' && (
            <button onClick={() => onStatusChange(todo.id, 'completed')}
              title="Mark Complete"
              className="p-1.5 rounded-lg text-slate-500 hover:text-brand-emerald hover:bg-brand-emerald/10 transition-all">
              <Check className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={() => onDelete(todo.id)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-brand-rose hover:bg-brand-rose/10 transition-all">
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

  useEffect(() => { fetchTodos(); }, []);

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
    } catch (e) { console.error(e); }
  };

  const handleToggle = async (todo) => {
    const newStatus = todo.status === 'completed' ? 'pending' : 'completed';
    try {
      const updated = await updateTodo(todo.id, { status: newStatus });
      setTodos(todos.map(t => t.id === todo.id ? updated : t));
    } catch (e) { console.error(e); }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const updated = await updateTodo(id, { status });
      setTodos(todos.map(t => t.id === id ? updated : t));
    } catch (e) { console.error(e); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteTodo(id);
      setTodos(todos.filter(t => t.id !== id));
    } catch (e) { console.error(e); }
  };

  const pending   = todos.filter(t => t.status === 'pending');
  const ongoing   = todos.filter(t => t.status === 'ongoing');
  const completed = todos.filter(t => t.status === 'completed');

  // ── Compact mode for dashboard ──────────────────────
  if (compact) {
    const urgentTasks = todos.filter(t => t.status !== 'completed').slice(0, 4);
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-display font-bold text-black dark:text-white">Tasks</h3>
          <button onClick={() => setModalOpen(true)}
            className="p-1.5 rounded-lg bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white transition-all">
            <Plus className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-2">
          {urgentTasks.length === 0 ? (
            <p className="text-xs text-slate-600 text-center py-6">No pending tasks</p>
          ) : urgentTasks.map(todo => (
            <TaskCard key={todo.id} todo={todo} onToggle={handleToggle} onDelete={handleDelete} onStatusChange={handleStatusChange} />
          ))}
        </div>
        <TaskModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} />
      </div>
    );
  }

  // ── Full Kanban board ───────────────────────────────
  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-black dark:text-white">Task Board</h2>
          <p className="text-sm text-slate-500 mt-1">
            {todos.length} tasks · {pending.length} pending · {ongoing.length} in progress
          </p>
        </div>
        <button onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm
            bg-gradient-to-r from-brand-blue to-brand-blue-light text-white
            shadow-lg shadow-brand-blue/20
            hover:shadow-brand-blue/35 hover:scale-[1.02]
            active:scale-[0.98] transition-all duration-200">
          <Plus className="w-4 h-4" /> New Task
        </button>
      </div>

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

      <TaskModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} />
    </div>
  );
}
