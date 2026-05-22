import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CalendarDays, Flag, Zap } from 'lucide-react';

const PRIORITIES = [
  { value: 'high',   label: 'High',   color: '#f43f5e', bg: 'rgba(244,63,94,0.1)' },
  { value: 'medium', label: 'Medium', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
  { value: 'low',    label: 'Low',    color: '#3B82F6', bg: 'rgba(59,130,246,0.1)' },
];

export default function TaskModal({ isOpen, onClose, onSubmit }) {
  const [task, setTask] = useState('');
  const [priority, setPriority] = useState('medium');
  const [deadlineDate, setDeadlineDate] = useState('');
  const [deadlineTime, setDeadlineTime] = useState('23:59');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!task.trim()) return;

    const data = {
      task: task.trim(),
      priority,
      status: 'pending',
      completed: false,
      deadline: deadlineDate ? `${deadlineDate}T${deadlineTime || '23:59'}:00` : null,
    };

    onSubmit(data);
    setTask('');
    setPriority('medium');
    setDeadlineDate('');
    setDeadlineTime('23:59');
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          style={{ background: 'rgba(5,10,24,0.8)', backdropFilter: 'blur(8px)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="glass w-full max-w-md p-6 relative"
            style={{ border: '1px solid rgba(148,163,184,0.1)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/10 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-blue to-brand-cyan flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <h3 className="text-base font-display font-bold text-white">New Task</h3>
                <p className="text-xs text-slate-500">Set details for your task</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Task name */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Task Name
                </label>
                <input
                  type="text"
                  value={task}
                  onChange={(e) => setTask(e.target.value)}
                  placeholder="What do you need to do?"
                  autoFocus
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl py-3 px-4
                    text-sm text-white placeholder-slate-600
                    focus:outline-none focus:border-brand-blue/40 focus:shadow-[0_0_0_3px_rgba(59,130,246,0.08)]
                    transition-all"
                />
              </div>

              {/* Priority */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  <Flag className="w-3 h-3 inline mr-1 -mt-0.5" /> Priority
                </label>
                <div className="flex gap-2">
                  {PRIORITIES.map((p) => (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className="flex-1 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 border"
                      style={{
                        background: priority === p.value ? p.bg : 'rgba(255,255,255,0.02)',
                        borderColor: priority === p.value ? p.color + '40' : 'rgba(255,255,255,0.06)',
                        color: priority === p.value ? p.color : '#64748b',
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Deadline */}
              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  <CalendarDays className="w-3 h-3 inline mr-1 -mt-0.5" /> Deadline
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={deadlineDate}
                    onChange={(e) => setDeadlineDate(e.target.value)}
                    className="bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3
                      text-sm text-white
                      focus:outline-none focus:border-brand-blue/40 transition-all
                      [color-scheme:dark]"
                  />
                  <input
                    type="time"
                    value={deadlineTime}
                    onChange={(e) => setDeadlineTime(e.target.value)}
                    className="bg-white/[0.04] border border-white/[0.08] rounded-xl py-2.5 px-3
                      text-sm text-white
                      focus:outline-none focus:border-brand-blue/40 transition-all
                      [color-scheme:dark]"
                  />
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                className="w-full py-3 rounded-xl font-semibold text-sm
                  bg-gradient-to-r from-brand-blue to-brand-blue-light text-white
                  shadow-lg shadow-brand-blue/20
                  hover:shadow-brand-blue/35 hover:scale-[1.01]
                  active:scale-[0.98] transition-all duration-200"
              >
                Create Task
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
