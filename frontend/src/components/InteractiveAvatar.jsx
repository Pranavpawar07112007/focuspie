import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles, Flame, Crown, Zap, Coffee, Shield, Ghost, Cpu, Smile } from 'lucide-react';

// Character maps mapping state to emoji/icon components
const CHARACTERS = {
  fox: {
    idle: '🦊',
    focusing: '🦊🔥',
    break: '🦊💤',
    name: 'Firefox Companion'
  },
  robot: {
    idle: '🤖',
    focusing: '🤖⚡',
    break: '🤖🔋',
    name: 'Focus Bot'
  },
  wizard: {
    idle: '🧙‍♂️',
    focusing: '🧙‍♂️✨',
    break: '🧙‍♂️🍵',
    name: 'Time Wizard'
  },
  ninja: {
    idle: '🥷',
    focusing: '🥷⚔️',
    break: '🥷🍃',
    name: 'Task Ninja'
  },
  emoji: {
    idle: '🙂',
    focusing: '😤',
    break: '😌',
    name: 'Classic Emoji'
  }
};

export default function InteractiveAvatar({ 
  avatarStyle = 'fox', 
  sessionState = 'idle', // 'idle' | 'focusing' | 'break'
  level = 1,
  streak = 0
}) {
  const character = CHARACTERS[avatarStyle] || CHARACTERS['fox'];
  const currentFace = character[sessionState];

  // Base animation depends on the state
  const getAnimation = () => {
    switch (sessionState) {
      case 'focusing':
        return {
          y: [0, -4, 0],
          scale: [1, 1.05, 1],
          transition: { duration: 1.5, repeat: Infinity, ease: 'easeInOut' }
        };
      case 'break':
        return {
          y: [0, 2, 0],
          rotate: [-2, 2, -2],
          transition: { duration: 3, repeat: Infinity, ease: 'easeInOut' }
        };
      case 'idle':
      default:
        return {
          y: [0, -2, 0],
          transition: { duration: 4, repeat: Infinity, ease: 'easeInOut' }
        };
    }
  };

  return (
    <div className="relative group flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/[0.05] shadow-inner">
      {/* Level / Status Aura */}
      {sessionState === 'focusing' && (
        <motion.div 
          className="absolute inset-0 rounded-full border-2 border-brand-blue/30 dark:border-brand-blue/50"
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      )}

      {/* Streak Fire Particles */}
      {streak > 1 && sessionState === 'focusing' && (
        <motion.div 
          className="absolute -bottom-2 -right-2 text-orange-500"
          animate={{ y: [0, -5, 0], opacity: [0.7, 1, 0.7], scale: [1, 1.2, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          <Flame className="w-4 h-4 fill-orange-500" />
        </motion.div>
      )}

      {/* High Level Crown */}
      {level >= 5 && (
        <motion.div 
          className="absolute -top-3 text-amber-400 drop-shadow-md z-10"
          animate={{ y: [0, -2, 0], rotate: [-5, 5, -5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        >
          <Crown className="w-5 h-5 fill-amber-400" />
        </motion.div>
      )}

      {/* Main Avatar Character */}
      <motion.div
        className="text-2xl select-none relative z-0 flex items-center justify-center drop-shadow-sm"
        animate={getAnimation()}
      >
        {currentFace}
      </motion.div>

      {/* Tooltip */}
      <div className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap bg-black/80 text-white text-[10px] font-bold px-2 py-1 rounded-md pointer-events-none z-50">
        {character.name} {sessionState !== 'idle' ? `(${sessionState})` : ''}
      </div>
    </div>
  );
}
