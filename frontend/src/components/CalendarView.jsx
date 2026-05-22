import React, { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Clock, Flag, Zap, CalendarDays } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getCalendar } from '../api';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

const PRIORITY_DOT = { high: '#f43f5e', medium: '#f59e0b', low: '#3B82F6' };
const TYPE_COLORS = { task: '#f59e0b', session: '#a855f7', task_created: '#334155' };

export default function CalendarView() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => { fetchEvents(); }, []);

  const fetchEvents = async () => {
    try {
      const data = await getCalendar();
      setEvents(data.events || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days = [];

    // Previous month padding
    for (let i = firstDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, inMonth: false, date: null });
    }
    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      days.push({ day: d, inMonth: true, date: dateStr });
    }
    // Next month padding
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) {
      days.push({ day: i, inMonth: false, date: null });
    }

    return days;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map = {};
    events.forEach(e => {
      if (!e.date) return;
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [events]);

  const todayStr = new Date().toISOString().split('T')[0];
  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] || []) : [];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday = () => { setCurrentDate(new Date()); setSelectedDate(todayStr); };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-display font-bold text-black dark:text-white">Calendar</h2>
          <p className="text-sm text-slate-500 mt-1">Tasks and sessions at a glance</p>
        </div>
        <button onClick={goToday}
          className="text-xs font-semibold px-4 py-2 rounded-xl bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.06] text-slate-600 dark:text-slate-400
            hover:bg-brand-blue/10 hover:text-brand-blue hover:border-brand-blue/20 transition-all">
          Today
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar grid */}
        <div className="lg:col-span-2 glass p-6">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-6">
            <button onClick={prevMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-display font-bold text-black dark:text-white">
              {MONTHS[month]} {year}
            </h3>
            <button onClick={nextMonth} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-white/[0.06] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-all">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-semibold uppercase tracking-wider text-slate-600 py-2">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((cell, i) => {
              const dayEvents = cell.date ? (eventsByDate[cell.date] || []) : [];
              const isToday = cell.date === todayStr;
              const isSelected = cell.date === selectedDate;
              const hasTask = dayEvents.some(e => e.type === 'task');
              const hasSession = dayEvents.some(e => e.type === 'session');
              const hasOverdue = dayEvents.some(e => e.deadline_warning === 'overdue');

              return (
                <button
                  key={i}
                  onClick={() => cell.date && setSelectedDate(cell.date)}
                  disabled={!cell.inMonth}
                  className={`
                    relative aspect-square rounded-xl text-sm font-medium transition-all duration-200
                    flex flex-col items-center justify-center gap-1
                    ${!cell.inMonth ? 'text-slate-300 dark:text-slate-850 cursor-default' : 'cursor-pointer hover:bg-slate-100 dark:hover:bg-white/[0.04]'}
                    ${isToday ? 'bg-brand-blue/10 text-brand-blue font-bold ring-1 ring-brand-blue/20' : ''}
                    ${isSelected && !isToday ? 'bg-slate-200 dark:bg-white/[0.06] text-black dark:text-white ring-1 ring-slate-300 dark:ring-white/10' : ''}
                    ${cell.inMonth && !isToday && !isSelected ? 'text-slate-600 dark:text-slate-300' : ''}
                  `}
                >
                  <span>{cell.day}</span>
                  {/* Event dots */}
                  {dayEvents.length > 0 && cell.inMonth && (
                    <div className="flex gap-0.5">
                      {hasOverdue && <div className="w-1.5 h-1.5 rounded-full bg-brand-rose animate-pulse" />}
                      {hasTask && !hasOverdue && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                      {hasSession && <div className="w-1.5 h-1.5 rounded-full bg-brand-purple" />}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex items-center gap-5 mt-5 pt-4 border-t border-slate-200 dark:border-white/[0.04]">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <div className="w-2 h-2 rounded-full bg-amber-400" /> Task deadline
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <div className="w-2 h-2 rounded-full bg-brand-purple" /> Focus session
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
              <div className="w-2 h-2 rounded-full bg-brand-rose animate-pulse" /> Overdue
            </div>
          </div>
        </div>

        {/* Sidebar: selected day events */}
        <div className="glass p-6">
          <h4 className="text-sm font-semibold text-black dark:text-white mb-1">
            {selectedDate
              ? new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
              : 'Select a date'}
          </h4>
          <p className="text-xs text-slate-500 mb-5">
            {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
          </p>

          <div className="space-y-3 custom-scroll overflow-y-auto max-h-[500px]">
            <AnimatePresence>
              {selectedEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-slate-700">
                  <CalendarDays className="w-8 h-8 mb-2" />
                  <p className="text-xs">Nothing scheduled</p>
                </div>
              ) : (
                selectedEvents
                  .filter(e => e.type !== 'task_created')
                  .map((evt) => (
                  <motion.div
                    key={evt.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3.5 rounded-xl border transition-all"
                    style={{
                      background: `${TYPE_COLORS[evt.type] || '#334155'}08`,
                      borderColor: `${TYPE_COLORS[evt.type] || '#334155'}20`,
                    }}
                  >
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ background: `${TYPE_COLORS[evt.type] || '#334155'}15` }}>
                        {evt.type === 'session'
                          ? <Zap className="w-3.5 h-3.5" style={{ color: TYPE_COLORS[evt.type] }} />
                          : <Flag className="w-3.5 h-3.5" style={{ color: PRIORITY_DOT[evt.priority] || '#f59e0b' }} />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-black dark:text-slate-200 leading-snug">{evt.title}</p>
                        <div className="flex items-center gap-2 mt-1.5">
                          {evt.time && (
                            <span className="text-[10px] text-slate-500 flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {evt.time}
                            </span>
                          )}
                          {evt.priority && evt.type === 'task' && (
                            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded"
                              style={{ color: PRIORITY_DOT[evt.priority], background: `${PRIORITY_DOT[evt.priority]}15` }}>
                              {evt.priority}
                            </span>
                          )}
                          {evt.deadline_warning && (
                            <span className="text-[10px] font-semibold text-brand-rose animate-pulse">
                              {evt.deadline_warning === 'overdue' ? '⚠ Overdue' : '⏰ Due soon'}
                            </span>
                          )}
                          {evt.duration_minutes != null && (
                            <span className="text-[10px] text-slate-500">{evt.duration_minutes}m</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
