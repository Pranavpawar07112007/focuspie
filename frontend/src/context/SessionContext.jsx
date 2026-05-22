import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { startSession as apiStart, stopSession as apiStop, sessionStatus, WS_ALERTS } from '../api';

const SessionContext = createContext(null);

export function SessionProvider({ children }) {
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [timeLeft, setTimeLeft] = useState(25 * 60);
  const [totalTime, setTotalTime] = useState(25 * 60);
  const [alert, setAlert] = useState(null);
  const wsRef = useRef(null);
  const intervalRef = useRef(null);

  // Poll backend session status on mount to sync across pages
  useEffect(() => {
    sessionStatus().then((s) => {
      if (s.is_active) {
        setIsActive(true);
      }
    }).catch(() => {});
  }, []);

  // Timer countdown
  useEffect(() => {
    if (isActive && !isPaused && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((t) => t - 1);
      }, 1000);
    } else if (timeLeft === 0 && isActive) {
      stop();
    }
    return () => clearInterval(intervalRef.current);
  }, [isActive, isPaused, timeLeft]);

  // WebSocket connection for distraction alerts
  useEffect(() => {
    function connect() {
      wsRef.current = new WebSocket(WS_ALERTS);
      wsRef.current.onmessage = (e) => {
        const data = JSON.parse(e.data);
        if (data.type === 'distraction') {
          setAlert(data);
          setTimeout(() => setAlert(null), 6000);
        }
      };
      wsRef.current.onclose = () => {
        setTimeout(connect, 3000); // auto-reconnect
      };
    }
    connect();
    return () => { if (wsRef.current) wsRef.current.close(); };
  }, []);

  const start = useCallback(async (minutes = 25) => {
    try {
      if (!isActive) await apiStart();
      setTotalTime(minutes * 60);
      setTimeLeft(minutes * 60);
      setIsActive(true);
      setIsPaused(false);
    } catch (e) {
      // Session might already be active
      setIsActive(true);
      setIsPaused(false);
    }
  }, [isActive]);

  const pause = useCallback(() => setIsPaused(true), []);
  const resume = useCallback(() => setIsPaused(false), []);

  const stop = useCallback(async () => {
    try {
      if (isActive) await apiStop();
    } catch {}
    setIsActive(false);
    setIsPaused(false);
    setTimeLeft(25 * 60);
    setTotalTime(25 * 60);
  }, [isActive]);

  const dismissAlert = useCallback(() => setAlert(null), []);

  const progress = totalTime > 0 ? ((totalTime - timeLeft) / totalTime) * 100 : 0;

  return (
    <SessionContext.Provider value={{
      isActive, isPaused, timeLeft, totalTime, progress, alert,
      start, pause, resume, stop, dismissAlert,
    }}>
      {children}
    </SessionContext.Provider>
  );
}

export const useSession = () => useContext(SessionContext);
