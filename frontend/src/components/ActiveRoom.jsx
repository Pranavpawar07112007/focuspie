import React, { useState, useEffect, useRef } from 'react';
import { LogOut, Link2, Clock, CheckCircle2, AlertTriangle, Coffee, BarChart2, WifiOff, Trash2, UserX } from 'lucide-react';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { leaveRoom, deleteRoom, kickMember } from '../api';
import InteractiveAvatar from './InteractiveAvatar';
import RoomStats from './RoomStats';
import FocusTimer from './FocusTimer';
import RoomChat from './RoomChat';

function formatTime(seconds) {
  if (typeof seconds !== 'number' || isNaN(seconds)) return '00:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function ActiveRoom({ onLeave }) {
  const { roomDetails, memberStates, ownerOffline } = useRoom();
  const { user } = useAuth();
  
  const [showStats, setShowStats] = useState(false);
  const [toasts, setToasts] = useState([]);
  const previousStates = useRef({});

  useEffect(() => {
    if (!roomDetails) return;
    Object.keys(memberStates).forEach(userId => {
      const currentState = memberStates[userId];
      const prevState = previousStates.current[userId];
      if (currentState.status === 'Distracted' && (!prevState || prevState.status !== 'Distracted')) {
        // play sound
        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = audioCtx.createOscillator();
          const gainNode = audioCtx.createGain();
          oscillator.connect(gainNode);
          gainNode.connect(audioCtx.destination);
          oscillator.type = 'triangle';
          oscillator.frequency.setValueAtTime(440, audioCtx.currentTime); 
          gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
          oscillator.start();
          oscillator.stop(audioCtx.currentTime + 0.5);
        } catch(e) {}
        
        const member = roomDetails.members.find(m => m.user_id == userId);
        if (member) {
          const id = Date.now();
          setToasts(prev => [...prev, {id, msg: `${member.username} got distracted!` }]);
          setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 5000);
        }
      }
    });
    previousStates.current = memberStates;
  }, [memberStates, roomDetails]);

  if (!roomDetails) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-3 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  const handleCopyInvite = () => {
    navigator.clipboard.writeText(roomDetails.invite_code);
  };
  
  const handleLeaveRoom = async () => {
    try {
      await leaveRoom(roomDetails.id);
      onLeave();
    } catch(e) {
      console.error("Failed to leave room", e);
    }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm("Are you sure you want to delete this room? Everyone will be kicked.")) return;
    try {
      await deleteRoom(roomDetails.id);
      onLeave();
    } catch(e) {
      console.error("Failed to delete room", e);
    }
  };

  const handleKickMember = async (memberId, memberName) => {
    if (!window.confirm(`Kick ${memberName} from the room?`)) return;
    try {
      await kickMember(roomDetails.id, memberId);
    } catch(e) {
      console.error("Failed to kick member", e);
    }
  };

  const isOwner = roomDetails?.owner_id === user?.id;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl mx-auto h-[calc(100vh-8rem)] flex flex-col relative">
      {/* Header */}
      <div className="glass p-6 rounded-2xl flex items-center justify-between shrink-0">
        <div>
          <h2 className="text-2xl font-display font-bold text-black dark:text-white flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-brand-emerald animate-pulse" />
            {roomDetails.name}
            {roomDetails.timer_mode === 'global' && (
              <span className="px-2 py-0.5 ml-2 text-xs font-bold uppercase bg-brand-blue/20 text-brand-blue rounded">
                Global Timer
              </span>
            )}
          </h2>
          <div className="flex items-center gap-4 mt-2">
            <p className="text-sm text-slate-500">
              {roomDetails.members.length} {roomDetails.members.length === 1 ? 'member' : 'members'}
            </p>
            <button 
              onClick={handleCopyInvite}
              className="text-xs font-mono px-2 py-1 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded hover:bg-slate-200 dark:hover:bg-white/10 transition-colors flex items-center gap-1.5"
            >
              <Link2 className="w-3 h-3" />
              Invite: {roomDetails.invite_code}
            </button>
          </div>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setShowStats(!showStats)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2 ${showStats ? 'bg-brand-blue text-white' : 'bg-brand-blue/10 text-brand-blue hover:bg-brand-blue/20'}`}
          >
            <BarChart2 className="w-4 h-4" />
            {showStats ? 'View Room' : 'Room Stats'}
          </button>
          {isOwner && (
            <button
              onClick={handleDeleteRoom}
              className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          )}
          <button
            onClick={handleLeaveRoom}
            className="px-4 py-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <LogOut className="w-4 h-4" />
            Leave
          </button>
        </div>
      </div>

      {showStats ? (
        <RoomStats roomId={roomDetails.id} />
      ) : (
        <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
          {/* Main Area: Timer + Members */}
          <div className="flex-1 overflow-y-auto flex flex-col gap-6">
            {/* Timer Section */}
            <div className="shrink-0">
              <FocusTimer />
            </div>

            {/* Members Section */}
            <div className="glass p-8 rounded-2xl">
              {roomDetails.timer_mode === 'global' && (
                <div className="mb-8 p-4 bg-brand-blue/5 border border-brand-blue/20 rounded-xl text-center">
                  <h3 className="text-brand-blue font-bold flex items-center justify-center gap-2 mb-1">
                    <Clock className="w-4 h-4" />
                    Global Timer Active
                  </h3>
                  <p className="text-sm text-slate-500">
                    {roomDetails.owner_id === user.id ? 
                      "You are the room owner. Start a session from the timer above to sync everyone." : 
                      "The room owner controls the timer. Your timer will sync automatically."}
                  </p>
                </div>
              )}
              
              {roomDetails.timer_mode === 'global' && !isOwner && ownerOffline && (
                <div className="mb-8 p-4 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center animate-fade-in">
                  <h3 className="text-amber-600 font-bold flex items-center justify-center gap-2 mb-1">
                    <WifiOff className="w-4 h-4" />
                    Owner Offline
                  </h3>
                  <p className="text-sm text-amber-700/80">
                    The room owner has disconnected. Global timer sync is paused and your timer controls have been unlocked.
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6">
                {roomDetails.members.map((member) => {
                  const isMe = member.user_id === user.id;
                  const state = isMe ? null : memberStates[member.user_id];
                  
                  let status = 'Ready';
                  let timeLeft = 0;
                  let statusColor = 'text-slate-400';
                  let StatusIcon = CheckCircle2;

                  if (state) {
                    status = state.status;
                    timeLeft = state.timeLeft;
                    
                    if (status === 'Focusing') {
                      statusColor = 'text-brand-blue';
                      StatusIcon = Clock;
                    } else if (status === 'Break') {
                      statusColor = 'text-brand-emerald';
                      StatusIcon = Coffee;
                    } else if (status === 'Distracted') {
                      statusColor = 'text-red-500';
                      StatusIcon = AlertTriangle;
                    } else if (status === 'Paused') {
                      statusColor = 'text-amber-500';
                      StatusIcon = Clock;
                    }
                  }

                  return (
                    <div key={member.user_id} className="relative flex flex-col items-center gap-4 p-6 rounded-2xl bg-white/5 border border-slate-200 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/10 transition-colors group">
                      {isOwner && !isMe && (
                        <button 
                          onClick={() => handleKickMember(member.user_id, member.username)}
                          className="absolute top-2 right-2 p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                          title="Kick Member"
                        >
                          <UserX className="w-4 h-4" />
                        </button>
                      )}
                      
                      <div className="relative">
                        <div className="w-20 h-20 relative pointer-events-none">
                          <InteractiveAvatar 
                            isTracking={status === 'Focusing'}
                            isPaused={status === 'Paused'}
                            onBreak={status === 'Break'}
                            alert={status === 'Distracted' ? {type: 'distraction'} : null}
                          />
                        </div>
                        
                        <div className={`absolute bottom-0 right-0 w-3.5 h-3.5 border-2 border-white dark:border-[#050a18] rounded-full ${state || isMe ? 'bg-brand-emerald' : 'bg-slate-500'}`} />
                      </div>
                      
                      <div className="text-center w-full">
                        <h3 className="font-bold text-black dark:text-white flex items-center justify-center gap-2 truncate">
                          {member.username}
                          {isMe && <span className="text-[10px] px-1.5 py-0.5 bg-brand-blue/20 text-brand-blue rounded-md uppercase shrink-0">You</span>}
                        </h3>
                        
                        {!isMe && (
                          <div className={`flex items-center justify-center gap-1.5 mt-1 text-xs font-medium ${statusColor}`}>
                            <StatusIcon className="w-3.5 h-3.5" />
                            {status}
                            {status !== 'Ready' && (
                              <span className="tabular-nums font-mono opacity-80 ml-1">
                                {formatTime(timeLeft)}
                              </span>
                            )}
                          </div>
                        )}
                        {isMe && (
                          <div className="text-[10px] text-slate-500 mt-1">
                            (Status broadcasted)
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Chat Sidebar */}
          <div className="lg:w-80 h-[400px] lg:h-full shrink-0">
            <RoomChat />
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 flex flex-col gap-2 z-50 pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="bg-red-500 text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-3 animate-fade-in pointer-events-auto">
            <AlertTriangle className="w-5 h-5" />
            <span className="font-medium">{toast.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
