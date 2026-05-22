import React from 'react';
import { Play, Pause, Square, RotateCcw } from 'lucide-react';
import { useSession } from '../context/SessionContext';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function FocusTimer() {
  const { isActive, isPaused, timeLeft, progress, start, pause, resume, stop } = useSession();

  const radius = 140;
  const stroke = 6;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="glass p-8 md:p-10 flex flex-col items-center relative overflow-hidden">

      {/* Ambient glow behind timer */}
      {isActive && (
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[320px] h-[320px] rounded-full bg-brand-blue/[0.06] blur-[80px] pointer-events-none" />
      )}

      <p className="text-[11px] font-semibold tracking-[0.2em] uppercase text-slate-500 mb-8">
        Focus Session
      </p>

      {/* Circular progress ring */}
      <div className="relative w-[320px] h-[320px] flex items-center justify-center mb-8">
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
              <stop offset="0%" stopColor="#3B82F6" />
              <stop offset="100%" stopColor="#C9FFED" />
            </linearGradient>
          </defs>
        </svg>

        {/* Timer text */}
        <div className="text-center z-10">
          <div className="text-[4.5rem] leading-none font-display font-black tracking-tighter text-white tabular-nums">
            {formatTime(timeLeft)}
          </div>
          <p className="mt-2 text-xs text-slate-500 font-medium">
            {isActive ? (isPaused ? 'PAUSED' : 'FOCUSING') : 'READY'}
          </p>
        </div>
      </div>

      {/* Duration presets */}
      {!isActive && (
        <div className="flex gap-2 mb-6">
          {[15, 25, 45, 60].map((m) => (
            <button
              key={m}
              onClick={() => start(m)}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-white/[0.04] border border-white/[0.06] text-slate-400
                hover:bg-brand-blue/10 hover:text-brand-blue hover:border-brand-blue/20 transition-all duration-200"
            >
              {m}m
            </button>
          ))}
        </div>
      )}

      {/* Controls */}
      <div className="flex gap-3">
        {!isActive ? (
          <button
            onClick={() => start()}
            className="group flex items-center gap-2.5 px-8 py-3.5 rounded-full font-semibold text-sm
              bg-gradient-to-r from-brand-blue to-brand-blue-light text-white
              shadow-lg shadow-brand-blue/25
              hover:shadow-brand-blue/40 hover:scale-[1.03]
              active:scale-[0.97] transition-all duration-300"
          >
            <Play className="w-4 h-4 fill-current" />
            Start Focus
          </button>
        ) : (
          <>
            {isPaused ? (
              <button
                onClick={resume}
                className="group flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm
                  bg-gradient-to-r from-brand-blue to-brand-blue-light text-white
                  shadow-lg shadow-brand-blue/25 hover:shadow-brand-blue/40
                  hover:scale-[1.03] active:scale-[0.97] transition-all duration-300"
              >
                <Play className="w-4 h-4 fill-current" />
                Resume
              </button>
            ) : (
              <button
                onClick={pause}
                className="flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm
                  bg-white/[0.06] border border-white/[0.08] text-white
                  hover:bg-amber-500/10 hover:border-amber-500/20 hover:text-amber-400
                  transition-all duration-300"
              >
                <Pause className="w-4 h-4" />
                Pause
              </button>
            )}
            <button
              onClick={stop}
              className="flex items-center gap-2 px-6 py-3.5 rounded-full font-semibold text-sm
                bg-white/[0.06] border border-white/[0.08] text-white
                hover:bg-brand-rose/10 hover:border-brand-rose/20 hover:text-brand-rose
                transition-all duration-300"
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
