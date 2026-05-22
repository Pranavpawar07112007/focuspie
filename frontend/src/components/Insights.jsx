import React, { useState, useEffect } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Clock, Target, Activity } from 'lucide-react';
import { getInsights } from '../api';

const COLORS = ['#f43f5e', '#a855f7', '#3B82F6', '#34d399', '#f59e0b', '#ec4899'];

function StatCard({ icon: Icon, label, value, unit, color, glowClass }) {
  return (
    <div className={`glass glass-hover p-5 ${glowClass || ''}`}>
      <div className="flex items-center gap-2 mb-3">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center`}
          style={{ background: `${color}15` }}>
          <Icon className="w-4 h-4" style={{ color }} />
        </div>
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
      </div>
      <div className="text-3xl font-display font-black text-white">
        {value}<span className="text-lg text-slate-500 ml-1">{unit}</span>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass px-4 py-3 text-xs border border-white/10" style={{ backdropFilter: 'blur(16px)' }}>
      <p className="text-slate-400 mb-1.5 font-medium">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-white">{entry.name}: {entry.value} min</span>
        </div>
      ))}
    </div>
  );
};

export default function Insights({ compact = false }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const d = await getInsights();
      setData(d);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-slate-700 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-slate-600">
        <Activity className="w-10 h-10 mb-3" />
        <p className="text-sm">No data available yet</p>
        <p className="text-xs text-slate-700 mt-1">Complete a focus session to see insights</p>
      </div>
    );
  }

  const { summary, timeline, top_distractions } = data;

  if (compact) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-display font-bold text-white">Quick Stats</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="glass p-4 text-center">
            <p className="text-2xl font-display font-black text-gradient">{summary.total_focus_minutes}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Focus min</p>
          </div>
          <div className="glass p-4 text-center">
            <p className="text-2xl font-display font-black text-gradient-rose">{summary.total_distraction_minutes}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Distracted min</p>
          </div>
          <div className="glass p-4 text-center">
            <p className="text-2xl font-display font-black text-white">{summary.total_sessions}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Sessions</p>
          </div>
          <div className="glass p-4 text-center">
            <p className="text-2xl font-display font-black text-brand-emerald">{summary.focus_score}%</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mt-1">Focus Score</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-display font-bold text-white">Insights</h2>
        <p className="text-sm text-slate-500 mt-1">Your productivity analytics, powered by real session data</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Clock} label="Focus Time" value={summary.total_focus_minutes} unit="min" color="#3B82F6" glowClass="glow-blue" />
        <StatCard icon={TrendingDown} label="Distracted" value={summary.total_distraction_minutes} unit="min" color="#f43f5e" />
        <StatCard icon={Target} label="Sessions" value={summary.total_sessions} unit="" color="#a855f7" />
        <StatCard icon={TrendingUp} label="Focus Score" value={summary.focus_score} unit="%" color="#34d399" glowClass="glow-cyan" />
      </div>

      {/* Timeline chart */}
      <div className="glass p-6">
        <h4 className="text-sm font-semibold text-white mb-1">Focus vs Distraction</h4>
        <p className="text-xs text-slate-500 mb-6">Minutes per hour from your session data</p>
        <div style={{ width: '100%', height: 280 }}>
          {timeline.length > 0 ? (
            <ResponsiveContainer>
              <AreaChart data={timeline} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <defs>
                  <linearGradient id="gFocus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#a855f7" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#a855f7" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gDistract" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" vertical={false} />
                <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="Focus" stroke="#a855f7" strokeWidth={2.5} fill="url(#gFocus)" />
                <Area type="monotone" dataKey="Distraction" stroke="#f43f5e" strokeWidth={2.5} fill="url(#gDistract)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-600 text-sm">
              No timeline data yet — start a focus session
            </div>
          )}
        </div>
      </div>

      {/* Top distractions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass p-6">
          <h4 className="text-sm font-semibold text-white mb-1">Top Distractions</h4>
          <p className="text-xs text-slate-500 mb-6">Applications that pulled your focus</p>
          <div style={{ width: '100%', height: 220 }}>
            {top_distractions.length > 0 ? (
              <ResponsiveContainer>
                <BarChart layout="vertical" data={top_distractions} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" horizontal={false} />
                  <XAxis type="number" stroke="#475569" fontSize={11} hide />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={11} width={90} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="minutes" name="Minutes" radius={[0, 6, 6, 0]}>
                    {top_distractions.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                No distractions recorded
              </div>
            )}
          </div>
        </div>

        {/* Pie chart */}
        <div className="glass p-6">
          <h4 className="text-sm font-semibold text-white mb-1">Time Distribution</h4>
          <p className="text-xs text-slate-500 mb-6">Focus vs distraction breakdown</p>
          <div style={{ width: '100%', height: 220 }}>
            {(summary.total_focus_minutes > 0 || summary.total_distraction_minutes > 0) ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Focus', value: summary.total_focus_minutes || 0 },
                      { name: 'Distraction', value: summary.total_distraction_minutes || 0 },
                    ]}
                    cx="50%" cy="50%"
                    innerRadius={60} outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill="#a855f7" />
                    <Cell fill="#f43f5e" />
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-600 text-sm">
                No data yet
              </div>
            )}
          </div>
          <div className="flex justify-center gap-6 mt-2">
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-2.5 h-2.5 rounded-full bg-brand-purple" /> Focus
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <div className="w-2.5 h-2.5 rounded-full bg-brand-rose" /> Distraction
            </div>
          </div>
        </div>
      </div>

      {/* Recent sessions */}
      {data.recent_sessions?.length > 0 && (
        <div className="glass p-6">
          <h4 className="text-sm font-semibold text-white mb-4">Recent Sessions</h4>
          <div className="space-y-2">
            {data.recent_sessions.map((s) => (
              <div key={s.id} className="flex items-center justify-between py-2.5 px-4 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-brand-blue" />
                  <span className="text-sm text-slate-300">
                    {s.start_time ? new Date(s.start_time).toLocaleString() : 'Unknown'}
                  </span>
                </div>
                <span className="text-sm font-semibold text-white">{s.duration_minutes} min</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
