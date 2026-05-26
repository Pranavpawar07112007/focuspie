import React, { useState } from 'react';
import { Play, Pause, Square, Sliders, Flame, Coffee, Clock, PictureInPicture2 } from 'lucide-react';
import { useSession } from '../context/SessionContext';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function FocusTimer() {
  const { 
    isActive, 
    isPaused, 
    isLocked,
    timeLeft, 
    progress, 
    timerMode, 
    pomodoroState, 
    pomodoroCycle, 
    pomodoroIntervals,
    onBreak, 
    start, 
    pause, 
    resume, 
    stop, 
    setTimeLeft, 
    setTotalTime,
    setPomodoroIntervals,
    setFocusDuration,
    setShortBreakDuration,
    setLongBreakDuration,
    focusDuration,
    shortBreakDuration,
    longBreakDuration
  } = useSession();

  const { roomDetails, ownerOffline } = useRoom();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState('standard'); // 'standard', 'pomodoro', 'custom'
  const [standardMinutes, setStandardMinutes] = useState(25);
  const [customMinutes, setCustomMinutes] = useState(25);

  const radius = 140;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  // Sync mode tab with active session state if session is running
  const currentTab = isActive ? (timerMode === 'pomodoro' ? 'pomodoro' : (timeLeft === customMinutes * 60 ? 'custom' : 'standard')) : activeTab;

  const handleTabChange = (tab) => {
    if (isActive) return;
    setActiveTab(tab);
    if (tab === 'standard') {
      setTimeLeft(standardMinutes * 60);
      setTotalTime(standardMinutes * 60);
    } else if (tab === 'pomodoro') {
      setTimeLeft(focusDuration * 60);
      setTotalTime(focusDuration * 60);
    } else if (tab === 'custom') {
      setTimeLeft(customMinutes * 60);
      setTotalTime(customMinutes * 60);
    }
  };

  const handleStart = () => {
    if (currentTab === 'pomodoro') {
      start(focusDuration, 'pomodoro');
    } else if (currentTab === 'custom') {
      start(customMinutes, 'standard');
    } else {
      start(standardMinutes, 'standard');
    }
  };

  // Generate cycle dots array based on selected intervals
  const cycleDots = Array.from({ length: pomodoroIntervals }, (_, i) => i + 1);

  return (
    <div className="glass p-8 md:p-10 flex flex-col items-center relative overflow-hidden">

      {/* Ambient glow behind timer */}
      {isActive && (
        <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full blur-[80px] pointer-events-none transition-all duration-500 ${
          onBreak ? 'bg-brand-emerald/[0.08]' : 'bg-brand-blue/[0.08]'
        }`} />
      )}

      {/* Miniplayer Button */}
      <div className="absolute top-6 right-6 z-20">
        <button
          onClick={() => {
            if (window.electronAPI && window.electronAPI.openMiniPlayer) {
              window.electronAPI.openMiniPlayer();
            }
          }}
          className="p-2 rounded-xl text-slate-400 hover:text-brand-blue hover:bg-brand-blue/10 transition-colors"
          title="Open Miniplayer"
        >
          <PictureInPicture2 className="w-5 h-5" />
        </button>
      </div>

      {/* Premium Tab Picker for Inactive Timer */}
      {!isActive && (
        <div className="flex bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl mb-6 w-full max-w-[320px] border border-slate-200/50 dark:border-white/[0.06]">
          {[
            { id: 'standard', label: 'Standard', icon: Clock },
            { id: 'pomodoro', label: 'Pomodoro', icon: Flame },
            { id: 'custom', label: 'Custom', icon: Sliders },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSel = currentTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 ${
                  isSel 
                    ? 'bg-white dark:bg-white/[0.08] text-brand-blue shadow-sm border border-slate-200/20' 
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isSel ? 'text-brand-blue' : ''}`} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-slate-500 mb-6">
        {onBreak ? '☕ Break Time' : '🎯 Focus Session'}
      </p>

      {/* Circular progress ring */}
      <div className="relative w-[320px] h-[320px] flex items-center justify-center mb-6">
        <svg className="absolute inset-0 -rotate-90" viewBox="0 0 320 320">
          {/* Track */}
          <circle
            cx="160" cy="160" r={radius}
            fill="none"
            stroke="rgba(148, 163, 184, 0.06)"
            strokeWidth={stroke}
          />
          {/* Progress */}
          <circle
            cx="160" cy="160" r={radius}
            fill="none"
            stroke="url(#progress-gradient)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s linear' }}
          />
          <defs>
            <linearGradient id="progress-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
              {onBreak ? (
                <>
                  <stop offset="0%" stopColor="#10B981" />
                  <stop offset="100%" stopColor="#34D399" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#3B82F6" />
                  <stop offset="100%" stopColor="#C9FFED" />
                </>
              )}
            </linearGradient>
          </defs>
        </svg>

        {/* Timer text */}
        <div className="text-center z-10">
          <div className={`text-[4.5rem] leading-none font-display font-bold tracking-tight tabular-nums transition-colors duration-300 ${
            onBreak ? 'text-brand-emerald' : 'text-black dark:text-white'
          }`}>
            {formatTime(timeLeft)}
          </div>
          <p className="mt-2 text-xs text-slate-500 font-semibold tracking-wider">
            {isActive ? (
              onBreak ? (
                pomodoroState === 'long_break' ? 'LONG BREAK' : 'SHORT BREAK'
              ) : (
                isPaused ? 'PAUSED' : 'FOCUSING'
              )
            ) : 'READY'}
          </p>
        </div>
      </div>

      {/* Pomodoro Cycle Indicators */}
      {currentTab === 'pomodoro' && (
        <div className="flex flex-col items-center mb-6 w-full max-w-[320px]">
          {/* Interval selector (only when NOT active) */}
          {!isActive && (
            <div className="flex flex-col gap-4 mb-5 w-full bg-slate-50 dark:bg-white/[0.02] p-4 rounded-xl border border-slate-200 dark:border-white/[0.05]">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Intervals</span>
                <div className="flex gap-1">
                  {[2, 3, 4, 5, 6, 8].map((n) => (
                    <button
                      key={n}
                      onClick={() => setPomodoroIntervals(n)}
                      className={`w-6 h-6 rounded-md text-[10px] font-bold transition-all duration-200 border ${
                        pomodoroIntervals === n
                          ? 'bg-brand-blue/15 border-brand-blue text-brand-blue shadow-sm'
                          : 'bg-white dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.06] text-slate-500 hover:bg-brand-blue/10 hover:text-brand-blue hover:border-brand-blue/20'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>

              {[
                { label: 'Focus', val: focusDuration, set: setFocusDuration, min: 1, max: 120, color: 'brand-blue' },
                { label: 'Short Break', val: shortBreakDuration, set: setShortBreakDuration, min: 1, max: 30, color: 'brand-emerald' },
                { label: 'Long Break', val: longBreakDuration, set: setLongBreakDuration, min: 1, max: 60, color: 'brand-purple' }
              ].map(({ label, val, set, min, max, color }) => (
                <div key={label} className="w-full">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{label}</span>
                    <span className={`text-[10px] font-bold text-${color}`}>{val}m</span>
                  </div>
                  <input
                    type="range"
                    min={min}
                    max={max}
                    value={val}
                    onChange={(e) => {
                      const v = parseInt(e.target.value, 10);
                      set(v);
                      if (label === 'Focus') {
                        setTimeLeft(v * 60);
                        setTotalTime(v * 60);
                      }
                    }}
                    className={`w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-${color}`}
                  />
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2.5 items-center mb-1">
            {cycleDots.map((c) => {
              const isActiveCycle = isActive && pomodoroCycle === c;
              const isCompletedCycle = isActive && pomodoroCycle > c;
              return (
                <div
                  key={c}
                  className={`w-3.5 h-3.5 rounded-full border transition-all duration-300 flex items-center justify-center text-[8px] font-bold ${
                    isActiveCycle 
                      ? 'bg-brand-blue border-brand-blue text-white scale-110 shadow-sm animate-pulse'
                      : isCompletedCycle 
                        ? 'bg-brand-emerald border-brand-emerald text-white' 
                        : 'border-slate-300 dark:border-white/10 text-slate-400 dark:text-slate-600'
                  }`}
                >
                  {c}
                </div>
              );
            })}
          </div>
          <span className="text-[10px] text-slate-500 font-medium">
            {isActive 
              ? `${onBreak ? 'Resting' : 'Focusing'} on Interval ${pomodoroCycle} of ${pomodoroIntervals}`
              : `${pomodoroIntervals} Intervals (${focusDuration}m Focus / ${shortBreakDuration}m Break)`
            }
          </span>
        </div>
      )}

      {/* Duration presets for Standard Mode */}
      {!isActive && currentTab === 'standard' && (
        <div className="flex gap-2 mb-6">
          {[15, 25, 45, 60].map((m) => {
            const isSel = standardMinutes === m;
            return (
              <button
                key={m}
                onClick={() => {
                  setStandardMinutes(m);
                  setTimeLeft(m * 60);
                  setTotalTime(m * 60);
                }}
                className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all duration-200 ${
                  isSel 
                    ? 'bg-brand-blue/15 border-brand-blue text-brand-blue shadow-sm'
                    : 'bg-slate-100 dark:bg-white/[0.04] border-slate-200 dark:border-white/[0.06] text-black dark:text-slate-400 hover:bg-brand-blue/10 hover:text-brand-blue hover:border-brand-blue/20'
                }`}
              >
                {m}m
              </button>
            );
          })}
        </div>
      )}

      {/* Custom Duration Slider */}
      {!isActive && currentTab === 'custom' && (
        <div className="w-full max-w-[300px] px-2 mb-6">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider">Duration</span>
            <span className="text-xs font-bold text-brand-blue dark:text-brand-blue-light">{customMinutes}m</span>
          </div>
          <input
            type="range"
            min="1"
            max="180"
            value={customMinutes}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              setCustomMinutes(val);
              setTimeLeft(val * 60);
              setTotalTime(val * 60);
            }}
            className="w-full h-1 bg-slate-200 dark:bg-white/10 rounded-lg appearance-none cursor-pointer accent-brand-blue"
          />
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        {!isActive ? (
          <button
            onClick={handleStart}
            disabled={isLocked}
            className={`group flex items-center gap-2.5 px-8 py-3.5 rounded-full font-semibold text-sm transition-all duration-300 ${
              isLocked 
                ? 'bg-slate-300 dark:bg-white/10 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-brand-blue to-brand-blue-light text-white shadow-lg shadow-brand-blue/25 hover:shadow-brand-blue/40 hover:scale-[1.03] active:scale-[0.97]'
            }`}
          >
            <Play className="w-4 h-4 fill-current" />
            Start Session
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={resume}
                disabled={isLocked}
                className={`group flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                  isLocked
                    ? 'bg-slate-300 dark:bg-white/10 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                    : 'bg-gradient-to-r from-brand-blue to-brand-blue-light text-white shadow-lg shadow-brand-blue/25 hover:shadow-brand-blue/40 hover:scale-[1.03] active:scale-[0.97]'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                Resume
              </button>
            ) : (
              <button
                onClick={pause}
                disabled={isLocked}
                className={`flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                  isLocked
                    ? 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-black dark:text-white hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-600 dark:hover:text-amber-400'
                }`}
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
            <button
              onClick={stop}
              disabled={isLocked}
              className={`flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm transition-all duration-300 ${
                isLocked
                  ? 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 cursor-not-allowed'
                  : 'bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/[0.08] text-black dark:text-white hover:bg-brand-rose/10 hover:border-brand-rose/20 hover:text-brand-rose'
              }`}
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  );
}

