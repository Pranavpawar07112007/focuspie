import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { 
  startSession as apiStart, 
  stopSession as apiStop, 
  pauseSession as apiPause, 
  resumeSession as apiResume, 
  sessionStatus, 
  WS_ALERTS 
} from '../api';
import { addXP } from '../utils';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [alert, setAlert] = useState(null);
  
  // Pomodoro and Custom Mode states
  const [timerMode, setTimerMode] = useState('standard'); // 'standard', 'pomodoro'
  const [pomodoroState, setPomodoroState] = useState('focus'); // 'focus', 'short_break', 'long_break'
  const [pomodoroCycle, setPomodoroCycle] = useState(1);
  const [pomodoroIntervals, setPomodoroIntervals] = useState(4);
  const [onBreak, setOnBreak] = useState(false);

  const wsRef = useRef(null);
  const intervalRef = useRef(null);

  // Request browser notification permissions on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // Poll backend session status on mount to sync across pages
  useEffect(() => {
    sessionStatus().then((s) => {
      if (s.is_active) {
        setIsActive(true);
        setOnBreak(s.on_break);
        if (s.on_break) {
          setIsPaused(true);
        }
      }
    }).catch(() => {});
  }, []);

  // Handle Pomodoro automatic transitions when timer ends
  const handlePomodoroTransition = useCallback(async () => {
    // Play transition sound using browser synthesizer
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.3);
    } catch (e) {}

    if (pomodoroState === 'focus') {
      // Focus ended -> Start Break
      // Reward XP for completing Pomodoro Focus cycle!
      const xpReward = 25 * 5; // 25 minutes * 5 XP = 125 XP!
      addXP(xpReward);
      window.dispatchEvent(new Event('storage'));
      
      if (Notification.permission === 'granted') {
        new Notification("Pomodoro Cycle Completed! 🎉", {
          body: `Superb! You finished your 25-minute Pomodoro focus interval and earned +${xpReward} XP!`
        });
      }

      if (pomodoroCycle >= pomodoroIntervals) {
        setPomodoroState('long_break');
        setOnBreak(true);
        setTimeLeft(15 * 60);
        setTotalTime(15 * 60);
        try { await apiPause(); } catch {}
        if (Notification.permission === 'granted') {
          new Notification("Long Break Started ☕", { body: "Amazing work completing 4 focus cycles! Take a 15-minute long break." });
        }
      } else {
        setPomodoroState('short_break');
        setOnBreak(true);
        setTimeLeft(5 * 60);
        setTotalTime(5 * 60);
        try { await apiPause(); } catch {}
        if (Notification.permission === 'granted') {
          new Notification("Short Break Started ⚡", { body: "Time for a 5-minute break. Stretch and relax!" });
        }
      }
    } else {
      // Break ended -> Start Focus
      setPomodoroState('focus');
      setOnBreak(false);
      setTimeLeft(25 * 60);
      setTotalTime(25 * 60);
      if (pomodoroState === 'long_break') {
        setPomodoroCycle(1);
      } else {
        setPomodoroCycle((c) => c + 1);
      }
      try { await apiResume(); } catch {}
      if (Notification.permission === 'granted') {
        new Notification("Focus Session Started 🎯", { body: "Break's over! Let's get back to work." });
      }
    }
  }, [pomodoroState, pomodoroCycle, pomodoroIntervals]);

  // Timer countdown - Fix for 50-60 min timer bug (interval drift)
  const timerExpectedEndRef = useRef(null);

  useEffect(() => {
    if (isActive && !isPaused && timeLeft > 0) {
      // Set expected end time based on current time + remaining seconds
      if (!timerExpectedEndRef.current) {
        timerExpectedEndRef.current = Date.now() + (timeLeft * 1000);
      }

      intervalRef.current = setInterval(() => {
        if (!timerExpectedEndRef.current) return;
        
        const now = Date.now();
        const remainingSeconds = Math.max(0, Math.round((timerExpectedEndRef.current - now) / 1000));
        
        setTimeLeft(remainingSeconds);

        if (remainingSeconds === 0) {
          clearInterval(intervalRef.current);
          timerExpectedEndRef.current = null;
          
          if (timerMode === 'pomodoro') {
            handlePomodoroTransition();
          } else {
            stop();
          }
        }
      }, 200); // Check more frequently (every 200ms) for accuracy
    } else {
      // If paused or inactive, clear expected end time so it recalculates on resume
      timerExpectedEndRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, isPaused, timerMode, handlePomodoroTransition, stop]); // Removed timeLeft from dependencies to prevent constant resetting
  useEffect(() => {
    let active = true;
    function connect() {
      if (!active) return;
      wsRef.current = new WebSocket(WS_ALERTS);
      wsRef.current.onmessage = (e) => {
        if (!active) return;
        const data = JSON.parse(e.data);
        if (data.type === 'distraction') {
          setAlert(data);
          // Set to 15 seconds to match the return timer duration perfectly
          setTimeout(() => {
            if (active) setAlert(null);
          }, 15000);
        }
      };
      wsRef.current.onclose = () => {
        if (active) {
          setTimeout(connect, 3000); // auto-reconnect
        }
      };
    }
    connect();
    
    // Clean up to prevent WebSocket memory leak and duplicate reconnect loop
    return () => { 
      active = false;
      if (wsRef.current) {
        wsRef.current.onclose = null; // Unbind callback first
        wsRef.current.close(); 
      }
    };
  }, []);

  const start = useCallback(async (minutes = 25, mode = 'standard') => {
    try {
      if (!isActive) await apiStart();
      setTimerMode(mode);
      setPomodoroState('focus');
      setOnBreak(false);
      
      if (mode === 'pomodoro') {
        setTotalTime(25 * 60);
        setTimeLeft(25 * 60);
        setPomodoroCycle(1);
      } else {
        setTotalTime(minutes * 60);
        setTimeLeft(minutes * 60);
      }
      setIsActive(true);
      setIsPaused(false);
    } catch (e) {
      // Session might already be active
      setIsActive(true);
      setIsPaused(false);
    }
  }, [isActive]);

  const pause = useCallback(async () => {
    try {
      await apiPause();
    } catch (e) {}
    setIsPaused(true);
  }, []);

  const resume = useCallback(async () => {
    try {
      await apiResume();
    } catch (e) {}
    setIsPaused(false);
  }, []);

  const stop = useCallback(async () => {
    // Reward XP for completed focus minutes before resetting
    const elapsedSeconds = totalTime - timeLeft;
    if (isActive && !onBreak && elapsedSeconds >= 60) {
      const minutes = Math.floor(elapsedSeconds / 60);
      const xpReward = minutes * 5;
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
    setTimeLeft(25 * 60);
    setTotalTime(25 * 60);
  }, [isActive, onBreak, totalTime, timeLeft]);

  const dismissAlert = useCallback(() => setAlert(null), []);

  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  return (
    <SessionContext.Provider value={{
      isActive, isPaused, timeLeft, totalTime, progress, alert,
      timerMode, pomodoroState, pomodoroCycle, pomodoroIntervals, onBreak,
      start, pause, resume, stop, dismissAlert, setTimeLeft, setTotalTime, setPomodoroIntervals
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
