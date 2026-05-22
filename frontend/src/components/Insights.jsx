import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { 
  TrendingUp, TrendingDown, Clock, Target, Activity, Calendar, 
  ChevronRight, Brain, Info, Sparkles, Coffee, ShieldAlert, Award, ArrowLeft
} from 'lucide-react';
import { getInsights, getSessions, getSession, getMlForecast } from '../api';

const COLORS = ['#3B82F6', '#a855f7', '#fb7185', '#34d399', '#f59e0b', '#ec4899'];
const CATEGORY_COLORS = {
  'Work': '#34d399',
  'Entertainment': '#fb7185',
  'Social Media': '#a855f7',
  'Communication': '#3B82F6',
  'Utilities': '#94a3b8'
};

function StatCard({ icon: Icon, label, value, unit, color, glowClass }) {
  return (
    <div className={`glass glass-hover p-5 transition-all duration-300 relative overflow-hidden group ${glowClass || ''}`}>
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.03] to-transparent pointer-events-none" />
      <div className="flex items-center gap-2.5 mb-3">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-300 group-hover:scale-105"
          style={{ background: `${color}15` }}>
          <Icon className="w-4.5 h-4.5 transition-transform group-hover:rotate-6" style={{ color }} />
        </div>
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-widest">{label}</span>
      </div>
      <div className="text-3xl font-display font-bold text-black dark:text-white tabular-nums flex items-baseline">
        {value}
        {unit && <span className="text-sm font-semibold text-slate-500 ml-1 font-sans">{unit}</span>}
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-4 py-3 text-xs border border-slate-200 dark:border-white/10 shadow-lg" style={{ backdropFilter: 'blur(20px)' }}>
      <p className="text-slate-500 dark:text-slate-400 mb-1.5 font-semibold">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 mt-1">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: entry.color || entry.payload.fill }} />
          <span className="text-slate-700 dark:text-slate-300 font-medium">
            {entry.name}: <strong className="text-black dark:text-white font-semibold">{entry.value} {entry.name === 'Focus Score' ? '%' : 'min'}</strong>
          </span>
        </div>
      ))}
    </div>
  );
};

export default function Insights({ compact = false }) {
  const [viewMode, setViewMode] = useState('overview'); // 'overview', 'explorer'
  const [data, setData] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [mlData, setMlData] = useState(null);
  const [loading, setLoading] = useState(true);

  // Explorer states
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [insightsRes, sessionsRes, mlRes] = await Promise.all([
        getInsights().catch(() => null),
        getSessions().catch(() => []),
        getMlForecast().catch(() => null)
      ]);
      setData(insightsRes);
      setSessions(sessionsRes);
      setMlData(mlRes);
    } catch (e) {
      console.error("Error loading insights data", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSelectSession = async (id) => {
    setSelectedSessionId(id);
    setLoadingSession(true);
    try {
      const details = await getSession(id);
      setSelectedSession(details);
    } catch (e) {
      console.error("Error loading session details", e);
    } finally {
      setLoadingSession(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-32 space-y-4">
        <div className="w-10 h-10 border-2 border-slate-300 border-t-brand-blue rounded-full animate-spin" />
        <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase animate-pulse">Analyzing Session Intelligence...</p>
      </div>
    );
  }

  if (!data || sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-500">
        <Activity className="w-12 h-12 mb-4 text-brand-blue opacity-55 animate-float" />
        <h3 className="text-base font-semibold text-black dark:text-white">No Productivity Logs Found</h3>
        <p className="text-xs text-slate-700 mt-1 max-w-sm text-center">Complete your first focus session to generate rich ML forecasts, timeline analytics, and activity classifications!</p>
      </div>
    );
  }

  const { summary, timeline, top_distractions } = data;

  if (compact) {
    return (
      <div className="space-y-4">
        <h3 className="text-sm font-display font-bold text-black dark:text-white tracking-wide">Quick Stats</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass p-4 text-center">
            <p className="text-2xl font-display font-bold text-brand-blue">{summary.total_focus_minutes}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-bold">Focus min</p>
          </div>
          <div className="glass p-4 text-center">
            <p className="text-2xl font-display font-bold text-brand-rose">{summary.total_distraction_minutes}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-bold">Distracted</p>
          </div>
          <div className="glass p-4 text-center">
            <p className="text-2xl font-display font-bold text-black dark:text-white">{summary.total_sessions}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-bold">Sessions</p>
          </div>
          <div className="glass p-4 text-center">
            <p className="text-2xl font-display font-bold text-brand-emerald">{summary.focus_score}%</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1 font-bold">Focus Score</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Page header with sub-tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-display font-bold text-black dark:text-white flex items-center gap-2">
            Focus Intelligence Dashboard
            <span className="text-[10px] tracking-wider uppercase font-semibold bg-brand-blue/10 border border-brand-blue/20 text-brand-blue px-2 py-0.5 rounded-full font-sans">AI Powered</span>
          </h2>
          <p className="text-sm text-slate-500 mt-1">Deep circadian analysis, machine learning forecasts, and multi-session timeline drill downs.</p>
        </div>

        {/* View toggles */}
        <div className="flex bg-slate-100 dark:bg-white/[0.04] p-1 rounded-xl border border-slate-200/50 dark:border-white/[0.06]">
          <button
            onClick={() => setViewMode('overview')}
            className={`py-2 px-4 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 flex items-center gap-1.5 ${
              viewMode === 'overview'
                ? 'bg-white dark:bg-white/[0.08] text-brand-blue shadow-sm border border-slate-200/20'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            Aggregate Analytics
          </button>
          <button
            onClick={() => {
              setViewMode('explorer');
              // Auto-select first session if none selected
              if (!selectedSessionId && sessions.length > 0) {
                handleSelectSession(sessions[0].id);
              }
            }}
            className={`py-2 px-4 rounded-lg text-xs font-semibold tracking-wide transition-all duration-200 flex items-center gap-1.5 ${
              viewMode === 'explorer'
                ? 'bg-white dark:bg-white/[0.08] text-brand-blue shadow-sm border border-slate-200/20'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            Session Explorer
          </button>
        </div>
      </div>

      {viewMode === 'overview' ? (
        <>
          {/* Stat cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard icon={Clock} label="Focus Time" value={summary.total_focus_minutes} unit="min" color="#3B82F6" glowClass="glow-blue" />
            <StatCard icon={TrendingDown} label="Distracted" value={summary.total_distraction_minutes} unit="min" color="#fb7185" />
            <StatCard icon={Target} label="Sessions Completed" value={summary.total_sessions} unit="" color="#a855f7" />
            <StatCard icon={TrendingUp} label="Avg Focus Score" value={summary.focus_score} unit="%" color="#34d399" glowClass="glow-cyan" />
          </div>

          {/* AI Focus Forecast Widget */}
          {mlData && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              
              {/* Prediction circular stats card */}
              <div className="glass p-6 flex flex-col justify-between glow-blue relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-brand-blue/[0.03] rounded-full blur-2xl pointer-events-none" />
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-bold tracking-widest text-slate-500 uppercase flex items-center gap-1.5">
                      <Brain className="w-3.5 h-3.5 text-brand-blue" />
                      Circadian Focus Forecast
                    </span>
                    <span className="text-[9px] bg-brand-blue/10 text-brand-blue px-2 py-0.5 rounded-full font-bold font-sans">KNN Model</span>
                  </div>
                  
                  <div className="flex items-center gap-5 my-4">
                    <div className="relative w-20 h-20 flex items-center justify-center">
                      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(148, 163, 184, 0.08)" strokeWidth="6" />
                        <circle cx="50" cy="50" r="42" fill="none" stroke="#3B82F6" strokeWidth="6" strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42 - (mlData.predicted_score / 100) * (2 * Math.PI * 42)} strokeLinecap="round" />
                      </svg>
                      <span className="text-xl font-display font-bold text-brand-blue">{mlData.predicted_score}%</span>
                    </div>
                    <div>
                      <h5 className="text-sm font-semibold text-black dark:text-white">Optimal Focus Period</h5>
                      <p className="text-[11px] text-slate-500 mt-0.5">Based on historical hourly circadian flow patterns.</p>
                    </div>
                  </div>
                </div>

                <div className="bg-brand-blue/5 border border-brand-blue/10 rounded-xl p-3.5 mt-2 flex gap-2.5 items-start">
                  <Sparkles className="w-4 h-4 text-brand-blue shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <h6 className="text-[11px] font-bold text-brand-blue uppercase tracking-wider">AI Forecast Insight</h6>
                    <p className="text-xs text-slate-700 dark:text-slate-300 mt-0.5 leading-relaxed">{mlData.advice}</p>
                  </div>
                </div>
              </div>

              {/* Weekly focus score trend line chart */}
              <div className="glass p-6 lg:col-span-2">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h4 className="text-sm font-semibold text-black dark:text-white">Daily Focus Velocity</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Average focus scores over your last 7 active tracking days</p>
                  </div>
                  <span className="text-[9px] bg-slate-100 dark:bg-white/[0.04] px-2 py-0.5 rounded-full text-slate-400 font-semibold border border-slate-200/20 font-sans">Cubic Spline Curve</span>
                </div>
                
                <div style={{ width: '100%', height: 160 }}>
                  {mlData.trend?.length > 0 ? (
                    <ResponsiveContainer>
                      <LineChart data={mlData.trend} margin={{ top: 5, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
                        <XAxis dataKey="date" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <YAxis domain={[0, 100]} stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="Score" stroke="#a855f7" strokeWidth={3} dot={{ fill: '#a855f7', strokeWidth: 0, r: 4 }} activeDot={{ r: 6, strokeWidth: 0 }} name="Focus Score" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-full text-slate-600 text-xs italic">No daily trends recorded yet.</div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* Timeline & distribution charts */}
          <div className="glass p-6">
            <h4 className="text-sm font-semibold text-black dark:text-white mb-1">Focus Bins & Circadian Profile</h4>
            <p className="text-xs text-slate-500 mb-6">Cumulative focus vs. distraction minutes across the hours of the day</p>
            <div style={{ width: '100%', height: 280 }}>
              {timeline.length > 0 ? (
                <ResponsiveContainer>
                  <AreaChart data={timeline} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gFocus" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="gDistract" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#fb7185" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Focus" stroke="#3B82F6" strokeWidth={2.5} fill="url(#gFocus)" name="Focus Time" />
                    <Area type="monotone" dataKey="Distraction" stroke="#fb7185" strokeWidth={2.5} fill="url(#gDistract)" name="Distracted Time" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                  No timeline data logged — complete a session to initialize charts.
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Top Distractions apps bar chart */}
            <div className="glass p-6">
              <h4 className="text-sm font-semibold text-black dark:text-white mb-1">Dominant Distractions</h4>
              <p className="text-xs text-slate-500 mb-6">Applications and websites logged as distraction vectors</p>
              <div style={{ width: '100%', height: 220 }}>
                {top_distractions.length > 0 ? (
                  <ResponsiveContainer>
                    <BarChart layout="vertical" data={top_distractions} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" horizontal={false} />
                      <XAxis type="number" stroke="#94a3b8" fontSize={10} hide />
                      <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={10} width={110} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="minutes" name="Time" radius={[0, 6, 6, 0]}>
                        {top_distractions.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                    Excellent! No distractions recorded yet.
                  </div>
                )}
              </div>
            </div>

            {/* Global Naive Bayes activity distribution */}
            <div className="glass p-6 flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-center mb-1">
                  <h4 className="text-sm font-semibold text-black dark:text-white">AI Classification Profile</h4>
                  <span className="text-[9px] bg-brand-emerald/10 text-brand-emerald px-2 py-0.5 rounded-full font-bold font-sans">Naive Bayes</span>
                </div>
                <p className="text-xs text-slate-500 mb-4">Semantic breakdown of all active windows and tabs logged since installation</p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-6 justify-center">
                {mlData && mlData.distribution?.length > 0 ? (
                  <>
                    <div style={{ width: 160, height: 160 }} className="relative">
                      <ResponsiveContainer>
                        <PieChart>
                          <Pie
                            data={mlData.distribution}
                            cx="50%" cy="50%"
                            innerRadius={50} outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                            strokeWidth={0}
                          >
                            {mlData.distribution.map((entry, idx) => (
                              <Cell key={idx} fill={CATEGORY_COLORS[entry.name] || COLORS[idx % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<CustomTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="grid grid-cols-2 sm:flex sm:flex-col gap-2.5">
                      {mlData.distribution.map((entry, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-400">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ background: CATEGORY_COLORS[entry.name] || COLORS[idx % COLORS.length] }} />
                          <span className="font-medium">{entry.name}</span>
                          <span className="font-mono text-slate-500 text-[10px] ml-1">({entry.value})</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-10 text-slate-600 text-xs w-full flex items-center justify-center">
                    Naive Bayes model learning pending focus logs...
                  </div>
                )}
              </div>
            </div>

          </div>
        </>
      ) : (
        /* ==================== SESSION EXPLORER VIEW ==================== */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* Left Column - completed sessions list */}
          <div className="lg:col-span-4 space-y-3 max-h-[680px] overflow-y-auto pr-1.5 custom-scroll">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1 mb-2">Focus Sessions</h4>
            {sessions.map((s) => {
              const isSelected = selectedSessionId === s.id;
              return (
                <div
                  key={s.id}
                  onClick={() => handleSelectSession(s.id)}
                  className={`p-4 rounded-xl border transition-all duration-300 cursor-pointer flex flex-col justify-between ${
                    isSelected
                      ? 'bg-brand-blue/10 border-brand-blue/40 shadow-sm text-brand-blue font-semibold'
                      : 'bg-white/50 dark:bg-slate-900/40 border-slate-200/50 dark:border-white/[0.04] hover:bg-white/80 dark:hover:bg-slate-900/60'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded ${
                      isSelected ? 'bg-brand-blue/15 text-brand-blue' : 'bg-slate-100 dark:bg-white/[0.06] text-slate-500'
                    }`}>
                      SESSION #{s.id}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      s.focus_score >= 80 
                        ? 'bg-brand-emerald/10 text-brand-emerald border border-brand-emerald/20' 
                        : s.focus_score >= 50 
                          ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                          : 'bg-brand-rose/10 text-brand-rose border border-brand-rose/20'
                    }`}>
                      {s.focus_score}% Focus
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center mt-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-black dark:text-slate-200">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      {s.duration_minutes} min
                    </div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-400" />
                      {s.start_time ? new Date(s.start_time).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Unknown'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Right Column - granular details explorer */}
          <div className="lg:col-span-8">
            {loadingSession ? (
              <div className="glass p-12 flex flex-col items-center justify-center min-h-[400px]">
                <div className="w-8 h-8 border-2 border-slate-300 border-t-brand-blue rounded-full animate-spin mb-4" />
                <p className="text-xs text-slate-500 font-semibold tracking-wider uppercase animate-pulse">Extracting Granular Logs...</p>
              </div>
            ) : selectedSession ? (
              <div className="space-y-6">
                
                {/* Granular statistics bar */}
                <div className="glass p-6 grid grid-cols-2 md:grid-cols-4 gap-4 bg-gradient-to-r from-slate-900/5 via-transparent to-transparent">
                  <div className="text-center border-r border-slate-200/50 dark:border-white/[0.04]">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Focus Rating</span>
                    <h5 className={`text-2xl font-display font-bold mt-1 ${
                      selectedSession.focus_score >= 80 ? 'text-brand-emerald' : selectedSession.focus_score >= 50 ? 'text-amber-500' : 'text-brand-rose'
                    }`}>{selectedSession.focus_score}%</h5>
                  </div>
                  <div className="text-center md:border-r border-slate-200/50 dark:border-white/[0.04]">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Total Duration</span>
                    <h5 className="text-2xl font-display font-bold text-black dark:text-white mt-1">{selectedSession.summary.total_minutes}m</h5>
                  </div>
                  <div className="text-center border-r border-slate-200/50 dark:border-white/[0.04]">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Focus Time</span>
                    <h5 className="text-2xl font-display font-bold text-brand-blue mt-1">{selectedSession.summary.focus_minutes}m</h5>
                  </div>
                  <div className="text-center">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Distracted Time</span>
                    <h5 className="text-2xl font-display font-bold text-brand-rose mt-1">{selectedSession.summary.distraction_minutes}m</h5>
                  </div>
                </div>

                {/* Minute binned timeline */}
                <div className="glass p-6">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h4 className="text-sm font-semibold text-black dark:text-white">Session Focus Waveform</h4>
                      <p className="text-xs text-slate-500 mt-0.5">Focus vs. distraction activity throughout this session timeline</p>
                    </div>
                    <span className="text-[9px] bg-brand-blue/15 text-brand-blue px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider font-sans">1m Intervals</span>
                  </div>
                  
                  <div style={{ width: '100%', height: 220 }}>
                    {selectedSession.timeline?.length > 0 ? (
                      <ResponsiveContainer>
                        <AreaChart data={selectedSession.timeline} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                          <defs>
                            <linearGradient id="sesFocus" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#3B82F6" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="sesDistract" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#fb7185" stopOpacity={0.4} />
                              <stop offset="95%" stopColor="#fb7185" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
                          <XAxis dataKey="time" stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                          <YAxis stroke="#94a3b8" fontSize={9} tickLine={false} axisLine={false} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="Focus" stroke="#3B82F6" strokeWidth={2} fill="url(#sesFocus)" name="Focus Time" />
                          <Area type="monotone" dataKey="Distraction" stroke="#fb7185" strokeWidth={2} fill="url(#sesDistract)" name="Distracted Time" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-600 text-xs italic">No waveform coordinates binned.</div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  
                  {/* Top session distractions */}
                  <div className="glass p-6">
                    <h4 className="text-sm font-semibold text-black dark:text-white mb-1">Session Top Distractions</h4>
                    <p className="text-xs text-slate-500 mb-4">Application focus leakage breakdown</p>
                    
                    <div style={{ width: '100%', height: 180 }}>
                      {selectedSession.top_distractions?.length > 0 ? (
                        <ResponsiveContainer>
                          <BarChart layout="vertical" data={selectedSession.top_distractions} margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" horizontal={false} />
                            <XAxis type="number" hide />
                            <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={9} width={100} tickLine={false} axisLine={false} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="minutes" name="Time" radius={[0, 4, 4, 0]}>
                              {selectedSession.top_distractions.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 text-xs italic flex items-center justify-center gap-1">No distractions logged! Amazing job!</div>
                      )}
                    </div>
                  </div>

                  {/* AI Categories for session */}
                  <div className="glass p-6 flex flex-col justify-between">
                    <div>
                      <h4 className="text-sm font-semibold text-black dark:text-white mb-1">AI Session Classification</h4>
                      <p className="text-xs text-slate-500 mb-4">Categorization of your window focus during this specific cycle</p>
                    </div>

                    <div className="flex items-center gap-4 justify-center">
                      {selectedSession.ai_categories?.length > 0 ? (
                        <>
                          <div style={{ width: 120, height: 120 }}>
                            <ResponsiveContainer>
                              <PieChart>
                                <Pie
                                  data={selectedSession.ai_categories}
                                  cx="50%" cy="50%"
                                  innerRadius={38} outerRadius={55}
                                  paddingAngle={2}
                                  dataKey="value"
                                  strokeWidth={0}
                                >
                                  {selectedSession.ai_categories.map((entry, idx) => (
                                    <Cell key={idx} fill={CATEGORY_COLORS[entry.name] || COLORS[idx % COLORS.length]} />
                                  ))}
                                </Pie>
                                <Tooltip content={<CustomTooltip />} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            {selectedSession.ai_categories.map((entry, idx) => (
                              <div key={idx} className="flex items-center gap-1.5 text-[11px] text-slate-700 dark:text-slate-400">
                                <div className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: CATEGORY_COLORS[entry.name] || COLORS[idx % COLORS.length] }} />
                                <span className="font-semibold">{entry.name}</span>
                                <span className="font-mono text-slate-500 text-[9px]">({entry.value})</span>
                              </div>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className="text-center py-6 text-slate-600 text-xs w-full italic">No semantic tracking context.</div>
                      )}
                    </div>
                  </div>

                </div>

                {/* Detailed Incident Log Table */}
                <div className="glass p-6">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-4 h-4 text-brand-rose" />
                    <h4 className="text-sm font-semibold text-black dark:text-white">Precise Distraction Logs</h4>
                  </div>
                  <p className="text-xs text-slate-500 mb-4">Chronological feed of specific website tabs and applications opened during this session</p>

                  <div className="overflow-x-auto max-h-[300px] overflow-y-auto pr-1.5 custom-scroll">
                    {selectedSession.incidents?.length > 0 ? (
                      <table className="w-full text-left text-xs text-slate-700 dark:text-slate-400 border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200/50 dark:border-white/[0.04] text-[10px] uppercase font-bold text-slate-500 tracking-wider">
                            <th className="py-2.5 px-3 w-20">Time</th>
                            <th className="py-2.5 px-3 w-32">App/Process</th>
                            <th className="py-2.5 px-3">Specific Activity / Website Tab</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSession.incidents.map((inc, i) => (
                            <tr key={i} className="border-b border-slate-100 dark:border-white/[0.02] hover:bg-slate-50 dark:hover:bg-white/[0.01] transition-colors">
                              <td className="py-2.5 px-3 font-mono font-medium text-slate-600 dark:text-slate-500">{inc.time}</td>
                              <td className="py-2.5 px-3">
                                <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-white/[0.05] text-[10px] text-slate-700 dark:text-slate-300 font-semibold border border-slate-200/20">
                                  {inc.app}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-medium text-black dark:text-white truncate max-w-[280px]" title={inc.title}>
                                {inc.title || 'Untitled Activity'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-8 text-slate-500 text-xs italic flex items-center justify-center gap-1.5">
                        <Award className="w-4 h-4 text-brand-emerald animate-bounce" />
                        Flawless Session! Absolutely zero distraction incidents logged.
                      </div>
                    )}
                  </div>
                </div>

              </div>
            ) : (
              <div className="glass p-12 flex flex-col items-center justify-center min-h-[400px] text-slate-500">
                <Info className="w-10 h-10 text-slate-400 mb-3 animate-float" />
                <h5 className="text-sm font-semibold text-black dark:text-white">Select a Focus Cycle</h5>
                <p className="text-xs text-slate-700 mt-1 max-w-sm text-center">Drill down into individual focus session waveforms, category breakdowns, and precise active website tab audits.</p>
              </div>
            )}
          </div>

        </div>
      )}

    </div>
  );
}
