import React from 'react';
import { Play, Pause, Square, Maximize2 } from 'lucide-react';
import { useSession } from '../context/SessionContext';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function MiniPlayer() {
  const { 
    isActive, 
    isPaused, 
    isLocked,
    timeLeft,
    alert,
    onBreak, 
    resume, 
    pause, 
    stop 
  } = useSession();

  const handleExpand = () => {
    if (window.electronAPI && window.electronAPI.closeMiniPlayer) {
      window.electronAPI.closeMiniPlayer();
    }
  };

  // Determine current status tag
  let statusTag = 'Ready';
  let tagColor = 'bg-slate-700 text-slate-300';

  if (isActive) {
    if (alert) {
      statusTag = 'Distracted';
      tagColor = 'bg-red-500/20 text-red-400 border border-red-500/30';
    } else if (onBreak) {
      statusTag = 'Break';
      tagColor = 'bg-brand-emerald/20 text-brand-emerald border border-brand-emerald/30';
    } else if (isPaused) {
      statusTag = 'Paused';
      tagColor = 'bg-amber-500/20 text-amber-400 border border-amber-500/30';
    } else {
      statusTag = 'Focusing';
      tagColor = 'bg-brand-blue/20 text-brand-blue border border-brand-blue/30';
    }
  }

  return (
    <div 
      className="w-full h-screen bg-[#050a18]/95 backdrop-blur-xl flex flex-row items-center justify-between px-3 border border-white/10 rounded-xl shadow-2xl relative overflow-hidden"
      style={{ WebkitAppRegion: 'drag' }}
    >
      {/* Status Tag */}
      <div className={`text-[10px] font-bold tracking-wider uppercase px-2 py-0.5 rounded-md ${tagColor}`}>
        {statusTag}
      </div>

      {/* Timer Text */}
      <div className={`text-xl font-display font-bold tracking-tight tabular-nums transition-colors ${
        onBreak ? 'text-brand-emerald' : 'text-white'
      }`}>
        {formatTime(timeLeft)}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' }}>
        {isActive && (
          <>
            {isPaused ? (
              <button
                onClick={resume}
                disabled={isLocked}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  isLocked 
                    ? 'bg-white/5 text-white/30 cursor-not-allowed' 
                    : 'bg-brand-blue/20 text-brand-blue hover:bg-brand-blue hover:text-white'
                }`}
                title="Resume"
              >
                <Play className="w-3.5 h-3.5 ml-0.5" />
              </button>
            ) : (
              <button
                onClick={pause}
                disabled={isLocked}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                  isLocked 
                    ? 'bg-white/5 text-white/30 cursor-not-allowed' 
                    : 'bg-white/10 text-white hover:bg-amber-500/20 hover:text-amber-400'
                }`}
                title="Pause"
              >
                <Pause className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={stop}
              disabled={isLocked}
              className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors ${
                isLocked 
                  ? 'bg-white/5 text-white/30 cursor-not-allowed' 
                  : 'bg-white/10 text-white hover:bg-brand-rose/20 hover:text-brand-rose'
              }`}
              title="Stop"
            >
              <Square className="w-3 h-3 fill-current" />
            </button>
          </>
        )}
        
        {/* Divider */}
        <div className="w-px h-5 bg-white/10 mx-1"></div>

        <button 
          onClick={handleExpand}
          className="w-7 h-7 flex items-center justify-center text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          title="Return to Main Window"
        >
          <Maximize2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
