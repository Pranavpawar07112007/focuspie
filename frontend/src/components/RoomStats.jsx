import React, { useState, useEffect } from 'react';
import { getRoomInsights } from '../api';
import { Activity, Clock, ShieldAlert, Award, AlertCircle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function RoomStats({ roomId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getRoomInsights(roomId)
      .then(res => {
        setData(res);
        setLoading(false);
      })
      .catch(err => {
        setError('Failed to load room insights.');
        setLoading(false);
      });
  }, [roomId]);

  if (loading) {
    return (
      <div className="flex-1 glass p-8 rounded-2xl flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex-1 glass p-8 rounded-2xl flex flex-col items-center justify-center text-center text-red-500">
        <AlertCircle className="w-12 h-12 mb-2 opacity-80" />
        <p>{error || 'No data available.'}</p>
      </div>
    );
  }

  const { summary, timeline, top_distractions } = data;

  return (
    <div className="flex-1 flex flex-col gap-6 overflow-y-auto animate-fade-in pr-2">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="glass p-5 rounded-2xl border border-brand-emerald/20 bg-brand-emerald/5">
          <div className="flex items-center gap-3 mb-2 text-brand-emerald">
            <Activity className="w-5 h-5" />
            <h3 className="font-bold">Focus Score</h3>
          </div>
          <p className="text-3xl font-display font-bold text-black dark:text-white">
            {summary.focus_score}%
          </p>
        </div>
        <div className="glass p-5 rounded-2xl border border-brand-blue/20 bg-brand-blue/5">
          <div className="flex items-center gap-3 mb-2 text-brand-blue">
            <Clock className="w-5 h-5" />
            <h3 className="font-bold">Total Focus</h3>
          </div>
          <p className="text-3xl font-display font-bold text-black dark:text-white">
            {Math.floor(summary.total_focus_minutes / 60)}h {Math.round(summary.total_focus_minutes % 60)}m
          </p>
        </div>
        <div className="glass p-5 rounded-2xl border border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-3 mb-2 text-red-500">
            <ShieldAlert className="w-5 h-5" />
            <h3 className="font-bold">Distractions</h3>
          </div>
          <p className="text-3xl font-display font-bold text-black dark:text-white">
            {Math.round(summary.total_distraction_minutes)}m
          </p>
        </div>
        <div className="glass p-5 rounded-2xl border border-purple-500/20 bg-purple-500/5">
          <div className="flex items-center gap-3 mb-2 text-purple-500">
            <Award className="w-5 h-5" />
            <h3 className="font-bold">Sessions</h3>
          </div>
          <p className="text-3xl font-display font-bold text-black dark:text-white">
            {summary.total_sessions}
          </p>
        </div>
      </div>

      <div className="glass p-6 rounded-2xl flex-1 min-h-[300px]">
        <h3 className="text-lg font-bold text-black dark:text-white mb-6">Room Focus Timeline</h3>
        <ResponsiveContainer width="100%" height="85%">
          <AreaChart data={timeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorFocus" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorDistraction" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="currentColor" className="opacity-10" />
            <XAxis dataKey="time" stroke="currentColor" className="opacity-50 text-xs" tickLine={false} axisLine={false} />
            <YAxis stroke="currentColor" className="opacity-50 text-xs" tickLine={false} axisLine={false} />
            <Tooltip 
              contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
              itemStyle={{ color: '#fff' }}
            />
            <Area type="monotone" dataKey="Focus" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorFocus)" />
            <Area type="monotone" dataKey="Distraction" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorDistraction)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {top_distractions.length > 0 && (
        <div className="glass p-6 rounded-2xl">
          <h3 className="text-lg font-bold text-black dark:text-white mb-4">Top Distractions in Room</h3>
          <div className="flex flex-wrap gap-3">
            {top_distractions.map(d => (
              <div key={d.name} className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg">
                <span className="font-medium text-sm">{d.name}</span>
                <span className="text-xs opacity-75">{d.minutes}m</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
