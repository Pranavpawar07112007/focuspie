import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
}

// ─── Web Audio API Sound Synthesizer ─────────────────────────────────
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playSound(type) {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    if (type === 'click') {
      // Soft crisp UI tap
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.type = 'sine';
      osc.frequency.setValueAtTime(800, now);
      osc.frequency.exponentialRampToValueAtTime(150, now + 0.05);

      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      osc.start(now);
      osc.stop(now + 0.05);
    } 
    else if (type === 'complete') {
      // Uplifting ascending major C-chord chime arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.07;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);

        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.1, now + timeOffset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.35);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.4);
      });
    } 
    else if (type === 'celebrate') {
      // Triumphant cascading synth fanfare arpeggio
      const notes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50, 1318.51]; // C4 to E6
      const duration = 0.8;
      
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.08;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        
        osc.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);

        osc.type = idx % 2 === 0 ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2000, now + timeOffset);
        filter.frequency.exponentialRampToValueAtTime(800, now + timeOffset + 0.4);

        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.08, now + timeOffset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + duration);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + duration + 0.1);
      });
    }
    else if (type === 'levelup') {
      // Ascending retro synthesized scale with echo
      const notes = [523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, 1046.50, 1174.66, 1318.51]; // C5 to E6
      notes.forEach((freq, idx) => {
        const timeOffset = idx * 0.05;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + timeOffset);
        
        gain.gain.setValueAtTime(0, now + timeOffset);
        gain.gain.linearRampToValueAtTime(0.12, now + timeOffset + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + timeOffset + 0.25);

        osc.start(now + timeOffset);
        osc.stop(now + timeOffset + 0.3);
      });
    }
  } catch (e) {
    console.warn("Failed to play synthesized sound:", e);
  }
}

// ─── Focus XP & Leveling Gamification Layer ───────────────────────────
function getUserId() {
  try {
    const user = JSON.parse(localStorage.getItem('focuspie_user'));
    return user?.username || 'anonymous';
  } catch (e) {
    return 'anonymous';
  }
}

export function getXP() {
  const userId = getUserId();
  return parseInt(localStorage.getItem(`focus_xp_${userId}`) || '0', 10);
}

export function addXP(amount) {
  const userId = getUserId();
  const current = getXP();
  const next = current + amount;
  localStorage.setItem(`focus_xp_${userId}`, next.toString());
  
  // Return true if level up occurred
  const currentLevel = Math.floor(Math.log2(current / 500 + 1)) + 1;
  const nextLevel = Math.floor(Math.log2(next / 500 + 1)) + 1;
  return nextLevel > currentLevel;
}

export function getLevelData(xp) {
  const level = Math.floor(Math.log2(xp / 500 + 1)) + 1;
  const currentLevelThreshold = 500 * (Math.pow(2, level - 1) - 1);
  const nextLevelThreshold = 500 * (Math.pow(2, level) - 1);
  const levelXP = xp - currentLevelThreshold;
  const levelTotalNeeded = nextLevelThreshold - currentLevelThreshold;
  const progress = Math.min(100, Math.max(0, (levelXP / levelTotalNeeded) * 100));
  
  return {
    level,
    progress,
    levelXP,
    levelTotalNeeded,
    title: getLevelTitle(level)
  };
}

function getLevelTitle(level) {
  const titles = [
    "Focus Novice",
    "Deep Work Disciple",
    "Time Mastery Apprentice",
    "Distraction Destroyer",
    "Focus Elite",
    "Zen Flow Master",
    "Hyper-Focus Sage",
    "Transcendent Flow Legend",
    "Chronos Vanguard",
    "Grandmaster of Concentration",
    "The Unbreakable Mind",
    "Apex of Productivity",
    "Time Lord",
    "Ascended Architect",
    "Supreme Entity of Focus",
    "God of Deep Work",
    "Infinite Flow Sovereign",
    "Singularity of Concentration",
    "Omniscient Focus Avatar",
    "The Unwavering Absolute"
  ];
  return titles[Math.min(level - 1, titles.length - 1)];
}

// ─── Daily Streak Tracker ─────────────────────────────────────────────
export function getStreak() {
  const userId = getUserId();
  const defaultStreak = { count: 0, lastDate: null, todayCompleted: false };
  try {
    const data = localStorage.getItem(`focus_streak_${userId}`);
    if (!data) return defaultStreak;

    const streak = JSON.parse(data);
    const todayStr = new Date().toDateString();

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    let updated = { ...streak };
    let changed = false;

    if (streak.lastDate === todayStr) {
      // Opened today and already completed today.
      if (!streak.todayCompleted) {
        updated.todayCompleted = true;
        changed = true;
      }
    } else if (streak.lastDate === yesterdayStr) {
      // Completed yesterday. Streak is active, but today is not completed yet!
      if (streak.todayCompleted) {
        updated.todayCompleted = false;
        changed = true;
      }
    } else {
      // Streak broken (last completed date is older than yesterday, or null)
      if (streak.count > 0 || streak.todayCompleted) {
        updated.count = 0;
        updated.todayCompleted = false;
        changed = true;
      }
    }

    if (changed) {
      localStorage.setItem(`focus_streak_${userId}`, JSON.stringify(updated));
    }
    return updated;
  } catch (e) {
    return defaultStreak;
  }
}

export function completeDayStreak() {
  const userId = getUserId();
  const streak = getStreak();
  const todayStr = new Date().toDateString();

  if (streak.lastDate === todayStr && streak.todayCompleted) {
    return streak; // Already completed today
  }

  let newCount = streak.count;
  const lastDateObj = streak.lastDate ? new Date(streak.lastDate) : null;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toDateString();

  if (!lastDateObj) {
    newCount = 1;
  } else if (streak.lastDate === yesterdayStr) {
    newCount += 1;
  } else if (streak.lastDate !== todayStr) {
    newCount = 1; // broken streak
  }

  const updated = { count: newCount, lastDate: todayStr, todayCompleted: true };
  localStorage.setItem(`focus_streak_${userId}`, JSON.stringify(updated));
  return updated;
}
