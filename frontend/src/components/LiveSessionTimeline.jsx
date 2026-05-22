import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, Clock, AlertTriangle, CheckCircle, 
  Sparkles, TrendingUp, Monitor, Zap, HelpCircle 
} from 'lucide-react';
import { getLiveTimeline } from '../api';
import { useSession } from '../context/SessionContext';

export default function LiveSessionTimeline() {
  const { isActive: sessionActive } = useSession();
  const [data, setData] = useState({ active: false, timeline: [], stats: null, elapsed_formatted: '0s' });
  const [loading, setLoading] = useState(false);

  // Poll active session timeline
  useEffect(() => {
    let active = true;
    let timer = null;

    const fetchTimeline = async () => {
      if (!sessionActive) {
        if (active) {
          setData(prev => ({ ...prev, active: false }));
        }
        return;
      }
      try {
        const res = await getLiveTimeline();
        if (active) {
          setData(res);
        }
      } catch (e) {
        console.error('Error fetching live timeline:', e);
      }
    };

    fetchTimeline();

    // Poll every 4 seconds for a highly responsive real-time feel
    if (sessionActive) {
      timer = setInterval(fetchTimeline, 4000);
    }

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, [sessionActive]);

  // Determine if we should show the timeline content
  const hasTimelineData = data.active && data.timeline && data.timeline.length > 0;

  return (
    <div className="flex flex-col h-full min-h-[360px]">
      {/* Widget Header */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100 dark:border-white/[0.05]">
        <div className="flex items-center gap-2">
          <div className="relative flex items-center justify-center">
            {sessionActive && (
              <span className="absolute inline-flex h-2.5 w-2.5 rounded-full bg-brand-emerald animate-ping" />
            )}
            <span className={`relative inline-flex rounded-full h-2 w-2 ${sessionActive ? 'bg-brand-emerald' : 'bg-slate-400 dark:bg-slate-600'}`} />
          </div>
          <h3 className="text-sm font-display font-bold text-black dark:text-white flex items-center gap-1.5">
            Live Activity Timeline
            {sessionActive && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-brand-emerald/10 text-brand-emerald font-semibold uppercase tracking-wider scale-90 origin-left animate-pulse">
                Live
              </span>
            )}
          </h3>
        </div>
        
        {sessionActive && data.elapsed_formatted && (
          <div className="flex items-center gap-1 text-xs text-slate-500 font-mono bg-slate-100 dark:bg-white/[0.04] px-2.5 py-1 rounded-lg">
            <Clock className="w-3.5 h-3.5" />
            <span>{data.elapsed_formatted}</span>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {!sessionActive ? (
          /* ── Idle State (No Active Session) ── */
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex-1 flex flex-col items-center justify-center text-center p-6 border border-dashed border-slate-200 dark:border-white/[0.08] rounded-2xl bg-slate-50/30 dark:bg-slate-900/10"
          >
            <div className="w-12 h-12 rounded-full bg-brand-blue/10 flex items-center justify-center mb-3 text-brand-blue animate-float">
              <Zap className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-display font-bold text-slate-700 dark:text-slate-200 mb-1">
              Ready to Capture Focus
            </h4>
            <p className="text-xs text-slate-500 max-w-[260px] leading-normal">
              Start a Focus Session above. We will track your active applications and display a live timeline of your work here!
            </p>
          </motion.div>
        ) : !hasTimelineData ? (
          /* ── Session Just Started, Waiting for Data ── */
          <motion.div
            key="waiting"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6 text-center"
          >
            <div className="w-8 h-8 rounded-full border-2 border-slate-200 border-t-brand-blue animate-spin mb-3" />
            <h4 className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Initializing Live Log...
            </h4>
            <p className="text-[10px] text-slate-500 mt-1 max-w-[200px]">
              Capturing window focus in real time. Your active activities will appear shortly!
            </p>
          </motion.div>
        ) : (
          /* ── Active Timeline Content ── */
          <motion.div
            key="timeline"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex-1 flex flex-col space-y-4"
          >
            {/* Session stats overview */}
            {data.stats && (
              <div className="grid grid-cols-3 gap-2.5 p-3 rounded-2xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-white/[0.04]">
                <div className="text-center">
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Focus Score</span>
                  <span className="text-sm font-display font-black text-brand-blue dark:text-brand-blue-light">{data.stats.focus_score}%</span>
                </div>
                <div className="text-center border-x border-slate-200/50 dark:border-white/[0.04]">
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Focused</span>
                  <span className="text-sm font-display font-black text-brand-emerald">{data.stats.focus_minutes}m</span>
                </div>
                <div className="text-center">
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Distracted</span>
                  <span className="text-sm font-display font-black text-brand-rose">{data.stats.distraction_minutes}m</span>
                </div>
              </div>
            )}

            {/* Scrollable vertical timeline path */}
            <div className="flex-1 overflow-y-auto max-h-[220px] pr-1.5 custom-scroll relative">
              <div className="absolute left-3.5 top-2 bottom-2 w-0.5 bg-slate-200 dark:bg-white/[0.08]" />

              <div className="space-y-4 relative z-10 pl-8">
                <AnimatePresence initial={false}>
                  {data.timeline.slice().reverse().map((item, index) => {
                    const isDist = item.is_distraction;
                    return (
                      <motion.div
                        key={`${item.app}-${item.start_time}-${index}`}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        className="relative group"
                      >
                        {/* Timeline Node Point */}
                        <span className={`absolute -left-[28px] top-1 w-3.5 h-3.5 rounded-full border-2 bg-white dark:bg-[#050a18] transition-all flex items-center justify-center
                          ${isDist 
                            ? 'border-brand-rose shadow-[0_0_8px_rgba(244,63,94,0.4)]' 
                            : 'border-brand-blue shadow-[0_0_8px_rgba(59,130,246,0.3)]'
                          }`}
                        >
                          <span className={`w-1 h-1 rounded-full ${isDist ? 'bg-brand-rose' : 'bg-brand-blue'}`} />
                        </span>

                        {/* Card Entry */}
                        <div className={`p-2.5 rounded-xl border transition-all duration-200 flex flex-col gap-1
                          ${isDist 
                            ? 'bg-brand-rose/[0.02] dark:bg-brand-rose/[0.01] border-brand-rose/15 hover:border-brand-rose/30' 
                            : 'bg-brand-blue/[0.01] dark:bg-white/[0.01] border-slate-100 dark:border-white/[0.04] hover:bg-slate-50 dark:hover:bg-white/[0.03] hover:border-slate-200 dark:hover:border-white/[0.08]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-[11px] font-bold tracking-tight uppercase truncate flex items-center gap-1.5
                              ${isDist ? 'text-brand-rose-light' : 'text-brand-blue dark:text-brand-blue-light'}`}
                            >
                              <Monitor className="w-3 h-3 text-slate-400" />
                              {item.app}
                            </span>
                            
                            <span className="text-[9px] text-slate-400 font-mono bg-slate-100 dark:bg-white/[0.04] px-1.5 py-0.5 rounded">
                              {item.duration_formatted}
                            </span>
                          </div>

                          <span className="text-[11px] font-medium leading-normal text-slate-700 dark:text-slate-300 break-words line-clamp-1 group-hover:line-clamp-none transition-all">
                            {item.title}
                          </span>

                          <span className="text-[9px] text-slate-400/80 font-semibold self-start tracking-wide mt-0.5">
                            {item.start_time} - {item.end_time}
                          </span>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
