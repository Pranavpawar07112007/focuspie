import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';
import { useSession } from '../context/SessionContext';

export default function DistractionOverlay() {
  const { alert, dismissAlert } = useSession();

  return (
    <AnimatePresence>
      {alert && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          style={{ background: 'rgba(5, 10, 24, 0.92)', backdropFilter: 'blur(24px)' }}
        >
          {/* Scan line effect */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-brand-rose to-transparent animate-scan opacity-40" />
          </div>

          <motion.div
            initial={{ scale: 0.85, y: 30 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: -20 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="text-center max-w-xl px-8"
          >
            {/* Pulsing icon */}
            <div className="relative mx-auto w-28 h-28 mb-8">
              <div className="absolute inset-0 rounded-full bg-brand-rose/20 animate-ping" />
              <div className="relative w-full h-full rounded-full bg-brand-rose/10 border border-brand-rose/30 flex items-center justify-center glow-rose">
                <AlertTriangle className="w-12 h-12 text-brand-rose" />
              </div>
            </div>

            <h1 className="text-6xl md:text-7xl font-display font-black uppercase tracking-tighter leading-[0.9] text-gradient-rose mb-6">
              Get Back<br/>To Work
            </h1>

            <p className="text-lg text-slate-400 mb-2">Distraction detected</p>
            <p className="text-white font-mono text-sm bg-white/5 rounded-lg px-4 py-2 inline-block mb-10 border border-white/10">
              {alert.title}
            </p>

            <div>
              <button
                onClick={dismissAlert}
                className="group relative inline-flex items-center gap-2 px-8 py-3.5 rounded-full font-semibold text-sm uppercase tracking-wider
                  border border-brand-rose/40 text-brand-rose hover:bg-brand-rose hover:text-white
                  transition-all duration-300 hover:shadow-[0_0_30px_rgba(244,63,94,0.3)]"
              >
                <span>I'm on it</span>
                <X className="w-4 h-4 transition-transform group-hover:rotate-90" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
