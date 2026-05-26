import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { WS_ROOMS, getRoom } from '../api';
import { useAuth } from './AuthContext';
import { useSession } from './SessionContext';

const RoomContext = createContext(null);

export function RoomProvider({ children }) {
  const { user } = useAuth();

  const [currentRoomId, setCurrentRoomId] = useState(null);
  const [roomDetails, setRoomDetails] = useState(null);
  
  const [memberStates, setMemberStates] = useState({});
  const [ownerOffline, setOwnerOffline] = useState(false);
  const wsRef = useRef(null);
  
  const { 
    isActive, isPaused, onBreak, timeLeft, alert, 
    totalTime, timerMode, pomodoroState, pomodoroCycle, forceSyncState, setIsLocked
  } = useSession();

  useEffect(() => {
    if (roomDetails && roomDetails.timer_mode === 'global' && roomDetails.owner_id !== user?.id) {
      setIsLocked(!ownerOffline);
    } else {
      setIsLocked(false);
    }
  }, [roomDetails, user, ownerOffline, setIsLocked]);

  // Reconnect when room changes
  useEffect(() => {
    if (!currentRoomId || !user) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setRoomDetails(null);
      setMemberStates({});
      setOwnerOffline(false);
      return;
    }

    let active = true;

    // Fetch room members
    const fetchRoom = () => {
      getRoom(currentRoomId).then((r) => {
        if (active) setRoomDetails(r);
      }).catch(console.error);
    };
    fetchRoom();

    function connect() {
      if (!active) return;
      wsRef.current = new WebSocket(`${WS_ROOMS}/${currentRoomId}?user_id=${user.id}`);
      
      wsRef.current.onopen = () => {
        // Send our initial state as soon as we connect
        broadcastMyState();
      };

      wsRef.current.onmessage = (e) => {
        if (!active) return;
        try {
          const data = JSON.parse(e.data);
          
          if (data.type === 'MEMBER_LEFT') {
             fetchRoom();
          } else if (data.type === 'ROOM_DELETED') {
             leaveActiveRoom();
          } else if (data.type === 'MEMBER_KICKED') {
             if (data.user_id === user.id) {
                 leaveActiveRoom();
             } else {
                 fetchRoom();
             }
          } else if (data.type === 'OWNER_OFFLINE') {
             setOwnerOffline(true);
          } else if (data.type === 'OWNER_ONLINE') {
             setOwnerOffline(false);
          } else if (data.type === 'GLOBAL_TIMER_SYNC') {
            // Hijack the local session if this room is in global mode and we are not the owner
            if (roomDetails?.timer_mode === 'global' && roomDetails?.owner_id !== user.id) {
              forceSyncState(data.payload);
            }
          } else if (data && data.user_id && data.user_id !== user.id) {
            // Normal status update
            setMemberStates(prev => ({
              ...prev,
              [data.user_id]: { ...data, lastUpdated: Date.now() }
            }));
          }
        } catch (err) {}
      };

      wsRef.current.onclose = () => {
        if (active) {
          setTimeout(connect, 3000); // auto-reconnect
        }
      };
    }
    connect();

    return () => {
      active = false;
      if (wsRef.current) {
        wsRef.current.onclose = null;
        wsRef.current.close();
      }
    };
  }, [currentRoomId, user, roomDetails?.timer_mode, roomDetails?.owner_id, forceSyncState]);

  // Broadcast my state to the room whenever my session changes
  const broadcastMyState = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN && user) {
      let statusTag = 'Ready';
      if (isActive) {
        if (alert) statusTag = 'Distracted';
        else if (onBreak) statusTag = 'Break';
        else if (isPaused) statusTag = 'Paused';
        else statusTag = 'Focusing';
      }

      wsRef.current.send(JSON.stringify({
        user_id: user.id,
        status: statusTag,
        timeLeft: timeLeft
      }));
      
      // If we are the owner and it's a global timer room, broadcast the global timer state
      if (roomDetails?.timer_mode === 'global' && roomDetails?.owner_id === user.id) {
        wsRef.current.send(JSON.stringify({
          type: 'GLOBAL_TIMER_SYNC',
          payload: {
            isActive,
            isPaused,
            timeLeft,
            totalTime,
            timerMode,
            pomodoroState,
            pomodoroCycle,
            onBreak
          }
        }));
      }
    }
  }, [isActive, isPaused, onBreak, timeLeft, alert, user, roomDetails, totalTime, timerMode, pomodoroState, pomodoroCycle]);

  // Effect to trigger broadcast when local state changes
  useEffect(() => {
    broadcastMyState();
  }, [broadcastMyState]);

  const joinActiveRoom = (roomId) => {
    setCurrentRoomId(roomId);
  };

  const leaveActiveRoom = () => {
    setCurrentRoomId(null);
  };

  return (
    <RoomContext.Provider value={{
      currentRoomId,
      roomDetails,
      memberStates,
      ownerOffline,
      joinActiveRoom,
      leaveActiveRoom
    }}>
      {children}
    </RoomContext.Provider>
  );
}

export const useRoom = () => useContext(RoomContext);
