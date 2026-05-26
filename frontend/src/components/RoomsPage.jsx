import React, { useState, useEffect } from 'react';
import { Users, Plus, Hash, LogIn, DoorOpen } from 'lucide-react';
import { getRooms, createRoom, joinRoom } from '../api';
import { useRoom } from '../context/RoomContext';
import ActiveRoom from './ActiveRoom';

export default function RoomsPage() {
  const { currentRoomId, joinActiveRoom, leaveActiveRoom } = useRoom();
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showCreate, setShowCreate] = useState(false);
  const [showJoin, setShowJoin] = useState(false);
  
  const [newRoomName, setNewRoomName] = useState('');
  const [timerMode, setTimerMode] = useState('individual');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchRooms();
  }, []);

  const fetchRooms = async () => {
    try {
      setLoading(true);
      const data = await getRooms();
      setRooms(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRoom = async (e) => {
    e.preventDefault();
    if (!newRoomName) return;
    try {
      const room = await createRoom({ name: newRoomName, timer_mode: timerMode });
      setRooms([...rooms, room]);
      setShowCreate(false);
      setNewRoomName('');
      setTimerMode('individual');
    } catch (e) {
      setError('Failed to create room.');
    }
  };

  const handleJoinRoom = async (e) => {
    e.preventDefault();
    if (!inviteCode) return;
    try {
      setError(null);
      const room = await joinRoom({ invite_code: inviteCode });
      setRooms([...rooms, room]);
      setShowJoin(false);
      setInviteCode('');
    } catch (e) {
      setError('Invalid invite code or already joined.');
    }
  };

  if (currentRoomId) {
    return <ActiveRoom onLeave={leaveActiveRoom} />;
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-black dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-blue" />
            Focus Rooms
          </h2>
          <p className="text-sm text-slate-500 mt-1">Study and work with your friends in real-time.</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => { setShowJoin(true); setShowCreate(false); setError(null); }}
            className="px-4 py-2 bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 text-slate-700 dark:text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <LogIn className="w-4 h-4" />
            Join Room
          </button>
          <button
            onClick={() => { setShowCreate(true); setShowJoin(false); setError(null); }}
            className="px-4 py-2 bg-brand-blue hover:bg-brand-blue/90 text-white rounded-xl text-sm font-medium transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Create Room
          </button>
        </div>
      </div>

      {showCreate && (
        <form onSubmit={handleCreateRoom} className="glass p-6 rounded-2xl animate-fade-in">
          <h3 className="text-lg font-bold text-black dark:text-white mb-4">Create a New Room</h3>
          <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-4 mb-4">
                <input
                  type="text"
                  placeholder="e.g. Late Night Coding"
                  className="w-full input-field"
                  value={newRoomName}
                  onChange={(e) => setNewRoomName(e.target.value)}
                  autoFocus
                />
                
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    onClick={() => setTimerMode('individual')}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${timerMode === 'individual' ? 'border-brand-blue bg-brand-blue/5' : 'border-slate-200 dark:border-white/5 hover:border-brand-blue/30'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${timerMode === 'individual' ? 'border-brand-blue' : 'border-slate-400'}`}>
                        {timerMode === 'individual' && <div className="w-2 h-2 rounded-full bg-brand-blue" />}
                      </div>
                      <span className={`font-bold ${timerMode === 'individual' ? 'text-brand-blue' : 'text-slate-700 dark:text-slate-300'}`}>Individual Timers</span>
                    </div>
                    <p className="text-xs text-slate-500 pl-6">Every member controls their own focus session inside the room.</p>
                  </div>

                  <div 
                    onClick={() => setTimerMode('global')}
                    className={`cursor-pointer p-4 rounded-xl border-2 transition-all ${timerMode === 'global' ? 'border-brand-blue bg-brand-blue/5' : 'border-slate-200 dark:border-white/5 hover:border-brand-blue/30'}`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${timerMode === 'global' ? 'border-brand-blue' : 'border-slate-400'}`}>
                        {timerMode === 'global' && <div className="w-2 h-2 rounded-full bg-brand-blue" />}
                      </div>
                      <span className={`font-bold ${timerMode === 'global' ? 'text-brand-blue' : 'text-slate-700 dark:text-slate-300'}`}>Global Timer</span>
                    </div>
                    <p className="text-xs text-slate-500 pl-6">Owner controls the timer. Perfect for synced group focus sessions.</p>
                  </div>
                </div>

                <button type="submit" className="w-full py-3 mt-2 bg-brand-blue text-white rounded-xl font-bold hover:bg-brand-blue/90 transition-colors">
                  Create Room
                </button>
              </div>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </form>
      )}

      {showJoin && (
        <form onSubmit={handleJoinRoom} className="glass p-6 rounded-2xl animate-fade-in">
          <h3 className="text-lg font-bold text-black dark:text-white mb-4">Join via Invite Code</h3>
          <div className="flex gap-4">
            <div className="relative flex-1">
              <Hash className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Enter 6-character code"
                className="w-full input-field pl-10 uppercase"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                maxLength={6}
                autoFocus
              />
            </div>
            <button type="submit" className="px-6 py-2 bg-slate-700 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors">
              Join
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </form>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-12 flex justify-center">
            <div className="w-8 h-8 border-3 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
          </div>
        ) : rooms.length === 0 ? (
          <div className="col-span-full py-20 text-center glass rounded-2xl">
            <DoorOpen className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300">No rooms yet</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-md mx-auto">Create a room or join one with an invite code to start focusing with friends.</p>
          </div>
        ) : (
          rooms.map(room => (
            <div key={room.id} className="glass p-6 rounded-2xl flex flex-col justify-between hover:border-brand-blue/30 transition-colors group relative">
              <div className="absolute -top-3 -right-3 px-3 py-1 bg-brand-blue text-white text-[10px] font-bold uppercase rounded-full shadow-lg">
                {room.timer_mode === 'global' ? 'Global Timer' : 'Individual Timers'}
              </div>
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold text-black dark:text-white truncate pr-4">{room.name}</h3>
                  <div className="px-2 py-1 bg-slate-100 dark:bg-white/5 rounded-md text-xs font-mono text-slate-500 dark:text-slate-400">
                    {room.invite_code}
                  </div>
                </div>
                <div className="flex -space-x-2 mb-6">
                  {room.members.slice(0, 5).map((m, i) => (
                    <div key={m.user_id} className="w-8 h-8 rounded-full border-2 border-white dark:border-[#050a18] bg-slate-200 dark:bg-slate-700 flex items-center justify-center overflow-hidden z-10" style={{ zIndex: 10 - i }}>
                      <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${m.username}`} alt={m.username} className="w-full h-full" />
                    </div>
                  ))}
                  {room.members.length > 5 && (
                    <div className="w-8 h-8 rounded-full border-2 border-white dark:border-[#050a18] bg-slate-100 dark:bg-slate-800 text-slate-500 text-[10px] font-bold flex items-center justify-center z-0">
                      +{room.members.length - 5}
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => joinActiveRoom(room.id)}
                className="w-full py-2.5 bg-brand-blue/10 text-brand-blue hover:bg-brand-blue hover:text-white rounded-xl text-sm font-bold transition-colors"
              >
                Enter Room
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
