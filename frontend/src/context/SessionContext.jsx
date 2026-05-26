import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  startSession as apiStart, 
  stopSession as apiStop, 
  pauseSession as apiPause, 
  resumeSession as apiResume, 
  sessionStatus, 
  getSettings,
  updateSettings,
  WS_ALERTS 
} from '../api';
import { addXP } from '../utils';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const isMiniPlayer = window.location.hash.includes('miniplayer');

  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [alert, setAlert] = useState(null);
  
  // Pomodoro and Custom Mode states
  const [timerMode, setTimerMode] = useState('standard'); // 'standard', 'pomodoro'
  const [pomodoroState, setPomodoroState] = useState('focus'); // 'focus', 'short_break', 'long_break'
  const [pomodoroCycle, setPomodoroCycle] = useState(1);
  const [pomodoroIntervals, setPomodoroIntervals] = useState(4);
  const [focusDuration, setFocusDuration] = useState(25);
  const [shortBreakDuration, setShortBreakDuration] = useState(5);
  const [longBreakDuration, setLongBreakDuration] = useState(15);
  const [onBreak, setOnBreak] = useState(false);

  const wsRef = useRef(null);
  const intervalRef = useRef(null);
  const breakNoticeFiredRef = useRef(false);
  const timerExpectedEndRef = useRef(null);
  const channelRef = useRef(null);

  // Keep a ref of all state for syncing
  const stateRef = useRef({
    isActive, isPaused, isLocked, timeLeft, totalTime, timerMode, pomodoroState, pomodoroCycle, onBreak, timerExpectedEnd: timerExpectedEndRef.current
  });

  useEffect(() => {
    stateRef.current = {
      isActive, isPaused, isLocked, timeLeft, totalTime, timerMode, pomodoroState, pomodoroCycle, onBreak, timerExpectedEnd: timerExpectedEndRef.current
    };
  }, [isActive, isPaused, isLocked, timeLeft, totalTime, timerMode, pomodoroState, pomodoroCycle, onBreak]);

  const broadcastState = useCallback((updates = {}) => {
    // Only the main window broadcasts its state as the absolute source of truth
    if (!isMiniPlayer && channelRef.current) {
      channelRef.current.postMessage({
        type: 'SYNC_STATE',
        payload: { ...stateRef.current, ...updates }
      });
    }
  }, [isMiniPlayer]);

  // Define action handlers so the message listener can call them
  const actionHandlers = useRef({});

  useEffect(() => {
    channelRef.current = new BroadcastChannel('focuspie_session');
    
    channelRef.current.onmessage = (event) => {
      const { type, payload, action } = event.data;
      
      if (type === 'REQUEST_SYNC' && !isMiniPlayer) {
        // Main window always replies with current state
        channelRef.current.postMessage({
          type: 'SYNC_STATE',
          payload: stateRef.current
        });
      } else if (type === 'SYNC_STATE' && isMiniPlayer) {
        // Mini player blindly adopts state
        setIsActive(payload.isActive);
        setIsPaused(payload.isPaused);
        setIsLocked(payload.isLocked || false);
        setTimeLeft(payload.timeLeft);
        setTotalTime(payload.totalTime);
        setTimerMode(payload.timerMode);
        setPomodoroState(payload.pomodoroState);
        setPomodoroCycle(payload.pomodoroCycle);
        setOnBreak(payload.onBreak);
        timerExpectedEndRef.current = payload.timerExpectedEnd;
      } else if (type === 'ACTION' && !isMiniPlayer) {
        // Main window executes the action requested by the miniplayer
        if (action === 'start' && actionHandlers.current.start) {
          actionHandlers.current.start(payload.minutes, payload.mode, payload.roomId);
        } else if (action === 'pause' && actionHandlers.current.pause) {
          actionHandlers.current.pause();
        } else if (action === 'resume' && actionHandlers.current.resume) {
          actionHandlers.current.resume();
        } else if (action === 'stop' && actionHandlers.current.stop) {
          actionHandlers.current.stop();
        }
      }
    };

    if (isMiniPlayer) {
      channelRef.current.postMessage({ type: 'REQUEST_SYNC' });
    } else {
      // Main window broadcasts its initial state to catch any waiting miniplayers
      setTimeout(() => broadcastState(), 500); 
    }

    return () => {
      if (channelRef.current) {
        channelRef.current.close();
      }
    };
  }, [isMiniPlayer, broadcastState]);

  const updatePomodoroIntervals = useCallback(async (n) => {
    setPomodoroIntervals(n);
    if (!isMiniPlayer) {
      try { await updateSettings({ pomodoro_intervals: n }); } catch (e) {}
    }
  }, [isMiniPlayer]);

  const updateFocusDuration = useCallback(async (n) => {
    setFocusDuration(n);
    if (!isMiniPlayer) {
      try { await updateSettings({ focus_duration: n }); } catch (e) {}
    }
  }, [isMiniPlayer]);

  const updateShortBreakDuration = useCallback(async (n) => {
    setShortBreakDuration(n);
    if (!isMiniPlayer) {
      try { await updateSettings({ short_break_duration: n }); } catch (e) {}
    }
  }, [isMiniPlayer]);

  const updateLongBreakDuration = useCallback(async (n) => {
    setLongBreakDuration(n);
    if (!isMiniPlayer) {
      try { await updateSettings({ long_break_duration: n }); } catch (e) {}
    }
  }, [isMiniPlayer]);

  const start = useCallback(async (minutes = 25, mode = 'standard', roomId = null) => {
    if (isLocked) return;
    if (isMiniPlayer) {
      channelRef.current.postMessage({ type: 'ACTION', action: 'start', payload: { minutes, mode, roomId } });
      return;
    }
    try {
      if (!isActive) await apiStart(roomId ? { room_id: roomId } : {});
      setTimerMode(mode);
      setPomodoroState('focus');
      setOnBreak(false);
      
      let newTotal = minutes * 60;
      let newCycle = 1;
      
      if (mode === 'pomodoro') {
        newTotal = focusDuration * 60;
        setTotalTime(newTotal);
        setTimeLeft(newTotal);
        setPomodoroCycle(1);
      } else {
        setTotalTime(newTotal);
        setTimeLeft(newTotal);
        newCycle = stateRef.current.pomodoroCycle;
      }
      setIsActive(true);
      setIsPaused(false);
      timerExpectedEndRef.current = null;
      
      broadcastState({
        isActive: true,
        isPaused: false,
        timerMode: mode,
        pomodoroState: 'focus',
        onBreak: false,
        totalTime: newTotal,
        timeLeft: newTotal,
        pomodoroCycle: newCycle,
        timerExpectedEnd: null
      });
    } catch (e) {
      setIsActive(true);
      setIsPaused(false);
      broadcastState({ isActive: true, isPaused: false });
    }
  }, [isActive, focusDuration, broadcastState, isMiniPlayer]);

  const pause = useCallback(async () => {
    if (isLocked) return;
    if (isMiniPlayer) {
      channelRef.current.postMessage({ type: 'ACTION', action: 'pause' });
      return;
    }
    try {
      await apiPause();
    } catch (e) {}
    setIsPaused(true);
    timerExpectedEndRef.current = null;
    broadcastState({ isPaused: true, timerExpectedEnd: null });
  }, [broadcastState, isMiniPlayer]);

  const resume = useCallback(async () => {
    if (isLocked) return;
    if (isMiniPlayer) {
      channelRef.current.postMessage({ type: 'ACTION', action: 'resume' });
      return;
    }
    try {
      await apiResume();
    } catch (e) {}
    setIsPaused(false);
    timerExpectedEndRef.current = null; 
    broadcastState({ isPaused: false, timerExpectedEnd: null });
  }, [broadcastState, isMiniPlayer]);

  const stop = useCallback(async () => {
    if (isLocked) return;
    if (isMiniPlayer) {
      channelRef.current.postMessage({ type: 'ACTION', action: 'stop' });
      return;
    }
    const elapsedSeconds = totalTime - timeLeft;
    if (isActive && !onBreak && elapsedSeconds >= 60) {
      const minutes = Math.floor(elapsedSeconds / 60);
      const xpReward = Math.floor(minutes * 0.5); 
      if (xpReward > 0) {
        addXP(xpReward);
        window.dispatchEvent(new Event('storage'));
        if (Notification.permission === 'granted') {
          new Notification("XP Earned! ⚡", {
            body: `You completed ${minutes} focus minutes and earned +${xpReward} Focus XP!`
          });
        }
      }
    }

    try {
      if (isActive) await apiStop();
    } catch {}
    setIsActive(false);
    setIsPaused(false);
    setOnBreak(false);
    setTimerMode('standard');
    setPomodoroState('focus');
    setPomodoroCycle(1);
    setTimeLeft(focusDuration * 60);
    setTotalTime(focusDuration * 60);
    timerExpectedEndRef.current = null;
    
    broadcastState({
      isActive: false,
      isPaused: false,
      onBreak: false,
      timerMode: 'standard',
      pomodoroState: 'focus',
      pomodoroCycle: 1,
      timeLeft: focusDuration * 60,
      totalTime: focusDuration * 60,
      timerExpectedEnd: null
    });
  }, [isActive, onBreak, totalTime, timeLeft, focusDuration, broadcastState, isMiniPlayer]);

  // Bind actions to ref for dynamic message handler access
  useEffect(() => {
    actionHandlers.current = { start, pause, resume, stop };
  }, [start, pause, resume, stop]);

  const dismissAlert = useCallback(() => setAlert(null), []);

  useEffect(() => {
    if (!isMiniPlayer && 'Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, [isMiniPlayer]);

  useEffect(() => {
    if (isMiniPlayer) return;

    const fetchSettings = () => {
      getSettings().then((s) => {
        if (s.pomodoro_intervals) setPomodoroIntervals(s.pomodoro_intervals);
        if (s.short_break_duration) setShortBreakDuration(s.short_break_duration);
        if (s.long_break_duration) setLongBreakDuration(s.long_break_duration);
        if (s.focus_duration) {
          setFocusDuration(s.focus_duration);
          if (!stateRef.current.isActive && !stateRef.current.isPaused && !stateRef.current.onBreak && stateRef.current.timerMode !== 'custom') {
            setTimeLeft(s.focus_duration * 60);
            setTotalTime(s.focus_duration * 60);
          }
        }
      }).catch(() => {});
    };
    
    fetchSettings();
    window.addEventListener('settingsUpdated', fetchSettings);

    sessionStatus().then((s) => {
      if (s.is_active && !stateRef.current.isActive) {
        setIsActive(true);
        setOnBreak(s.on_break);
        if (s.on_break) {
          setIsPaused(true);
        }
      }
    }).catch(() => {});
    
    return () => window.removeEventListener('settingsUpdated', fetchSettings);
  }, [isMiniPlayer]);

  const handlePomodoroTransition = useCallback(async () => {
    if (isMiniPlayer) return;

    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); 
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}

    if (pomodoroState === 'focus') {
      const xpReward = Math.floor(focusDuration * 0.5); 
      addXP(xpReward);
      window.dispatchEvent(new Event('storage'));
      
      if (Notification.permission === 'granted') {
        new Notification("Pomodoro Cycle Completed! 🎉", {
          body: `Superb! You finished your ${focusDuration}-minute Pomodoro focus interval and earned +${xpReward} XP!`
        });
      }

      if (pomodoroCycle >= pomodoroIntervals) {
        setPomodoroState('long_break');
        setOnBreak(true);
        setTimeLeft(longBreakDuration * 60);
        setTotalTime(longBreakDuration * 60);
        timerExpectedEndRef.current = null;
        broadcastState({ pomodoroState: 'long_break', onBreak: true, timeLeft: longBreakDuration * 60, totalTime: longBreakDuration * 60, timerExpectedEnd: null });
        try { await apiPause(); } catch {}
        if (Notification.permission === 'granted') {
          new Notification("Long Break Started 🌟", { body: `Time for a ${longBreakDuration}-minute break!` });
        }
      } else {
        setPomodoroState('short_break');
        setOnBreak(true);
        setTimeLeft(shortBreakDuration * 60);
        setTotalTime(shortBreakDuration * 60);
        timerExpectedEndRef.current = null;
        broadcastState({ pomodoroState: 'short_break', onBreak: true, timeLeft: shortBreakDuration * 60, totalTime: shortBreakDuration * 60, timerExpectedEnd: null });
        try { await apiPause(); } catch {}
        if (Notification.permission === 'granted') {
          new Notification("Short Break Started ⚡", { body: `Time for a ${shortBreakDuration}-minute break. Stretch and relax!` });
        }
      }
    } else {
      if (pomodoroState === 'long_break') {
        stop();
        if (Notification.permission === 'granted') {
          new Notification("Session Complete! 🏆", { body: "You've completed your Pomodoro session." });
        }
        return;
      }

      setPomodoroState('focus');
      setOnBreak(false);
      setTimeLeft(focusDuration * 60);
      setTotalTime(focusDuration * 60);
      setPomodoroCycle((c) => c + 1);
      timerExpectedEndRef.current = null;
      broadcastState({ pomodoroState: 'focus', onBreak: false, timeLeft: focusDuration * 60, totalTime: focusDuration * 60, pomodoroCycle: stateRef.current.pomodoroCycle + 1, timerExpectedEnd: null });
      
      try { await apiResume(); } catch {}
      if (Notification.permission === 'granted') {
        new Notification("Focus Session Started 🎯", { body: "Break's over! Let's get back to work." });
      }
    }
  }, [pomodoroState, pomodoroCycle, pomodoroIntervals, focusDuration, shortBreakDuration, longBreakDuration, stop, broadcastState, isMiniPlayer]);

  useEffect(() => {
    if (isActive && !isPaused && timeLeft > 0) {
      if (!timerExpectedEndRef.current) {
        timerExpectedEndRef.current = Date.now() + (timeLeft * 1000);
        if (!isMiniPlayer) {
          broadcastState({ timerExpectedEnd: timerExpectedEndRef.current });
        }
      }

      intervalRef.current = setInterval(() => {
        if (!timerExpectedEndRef.current) return;
        
        const now = Date.now();
        const remainingSeconds = Math.max(0, Math.round((timerExpectedEndRef.current - now) / 1000));
        
        setTimeLeft(remainingSeconds);

        if (remainingSeconds === 15 && onBreak && !breakNoticeFiredRef.current && !isMiniPlayer) {
          breakNoticeFiredRef.current = true;
          if (Notification.permission === 'granted') {
            new Notification("Break ending soon! ⏳", { body: "Your break will be over in 15 seconds. Get ready!" });
          }
        }

        if (remainingSeconds === 0) {
          clearInterval(intervalRef.current);
          timerExpectedEndRef.current = null;
          breakNoticeFiredRef.current = false;
          
          if (!isMiniPlayer) {
            if (timerMode === 'pomodoro') {
              handlePomodoroTransition();
            } else {
              stop();
            }
          }
        }
      }, 200); 
    } else {
      timerExpectedEndRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, isPaused, timerMode, handlePomodoroTransition, stop, broadcastState, isMiniPlayer]); 

  useEffect(() => {
    if (isMiniPlayer) return;
    let active = true;
    function connect() {
      if (!active) return;
      wsRef.current = new WebSocket(WS_ALERTS);
      wsRef.current.onmessage = (e) => {
        if (!active) return;
        const data = JSON.parse(e.data);
        if (data.type === 'distraction') {
          setAlert(data);
          setTimeout(() => {
            if (active) setAlert(null);
          }, 15000);
        }
      };
      wsRef.current.onclose = () => {
        if (active) {
          setTimeout(connect, 3000); 
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
  }, [isMiniPlayer]);

  const forceSyncState = useCallback((payload) => {
    if (payload.isActive !== undefined) setIsActive(payload.isActive);
    if (payload.isPaused !== undefined) setIsPaused(payload.isPaused);
    if (payload.timeLeft !== undefined) setTimeLeft(payload.timeLeft);
    if (payload.totalTime !== undefined) setTotalTime(payload.totalTime);
    if (payload.timerMode !== undefined) setTimerMode(payload.timerMode);
    if (payload.pomodoroState !== undefined) setPomodoroState(payload.pomodoroState);
    if (payload.pomodoroCycle !== undefined) setPomodoroCycle(payload.pomodoroCycle);
    if (payload.onBreak !== undefined) setOnBreak(payload.onBreak);
    if (payload.timerExpectedEnd !== undefined) timerExpectedEndRef.current = payload.timerExpectedEnd;
  }, []);

  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  return (
    <SessionContext.Provider value={{
      isActive, isPaused, isLocked, setIsLocked, timeLeft, totalTime, progress, alert,
      timerMode, pomodoroState, pomodoroCycle, pomodoroIntervals, onBreak,
      focusDuration, shortBreakDuration, longBreakDuration,
      start, pause, resume, stop, dismissAlert, setTimeLeft, setTotalTime, 
      setPomodoroIntervals: updatePomodoroIntervals,
      setFocusDuration: updateFocusDuration,
      setShortBreakDuration: updateShortBreakDuration,
      setLongBreakDuration: updateLongBreakDuration,
      forceSyncState
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
