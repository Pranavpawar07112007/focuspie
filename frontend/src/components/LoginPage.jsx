import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, User, Lock, ArrowRight, Sparkles, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { login, signup } = useAuth();
  const [isSignup, setIsSignup] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Please fill in all fields');
      return;
    }

    if (isSignup && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (isSignup && password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        await signup(username.trim(), password);
      } else {
        await login(username.trim(), password);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const toggleMode = () => {
    setIsSignup(!isSignup);
    setError('');
    setConfirmPassword('');
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-white dark:bg-[#050a18]">
      {/* Ambient background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div className="absolute -top-[30%] -left-[20%] w-[60vw] h-[60vw] rounded-full bg-brand-blue/[0.06] blur-[140px] animate-float" />
        <div className="absolute -bottom-[20%] -right-[10%] w-[50vw] h-[50vw] rounded-full bg-brand-purple/[0.06] blur-[140px] animate-float-delay" />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[30vw] h-[30vw] rounded-full bg-brand-cyan/[0.04] blur-[100px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        className="w-full max-w-md mx-4"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 200, damping: 15 }}
            className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-blue to-brand-cyan shadow-xl shadow-brand-blue/25 mb-4"
          >
            <Zap className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-3xl font-display font-bold text-black dark:text-white tracking-tight">
            FocusPie
          </h1>
          <p className="text-sm text-slate-500 mt-1">Your productivity command center</p>
        </div>

        {/* Card */}
        <div className="glass p-8 relative overflow-hidden">
          {/* Decorative corner */}
          <div className="absolute -top-12 -right-12 w-24 h-24 rounded-full bg-brand-blue/[0.06] blur-[40px]" />

          <AnimatePresence mode="wait">
            <motion.div
              key={isSignup ? 'signup' : 'login'}
              initial={{ opacity: 0, x: isSignup ? 30 : -30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: isSignup ? -30 : 30 }}
              transition={{ duration: 0.25 }}
            >
              <div className="flex items-center gap-2 mb-6">
                <Sparkles className="w-4 h-4 text-brand-blue" />
                <h2 className="text-lg font-display font-bold text-black dark:text-white">
                  {isSignup ? 'Create Account' : 'Welcome Back'}
                </h2>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4" id="auth-form">
                {/* Username */}
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="username-input"
                    type="text"
                    placeholder="Username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium
                      bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]
                      text-black dark:text-white placeholder-slate-400
                      focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue/50
                      transition-all duration-200"
                    autoComplete="username"
                  />
                </div>

                {/* Password */}
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    id="password-input"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-11 pr-11 py-3 rounded-xl text-sm font-medium
                      bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]
                      text-black dark:text-white placeholder-slate-400
                      focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue/50
                      transition-all duration-200"
                    autoComplete={isSignup ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Confirm Password (signup only) */}
                <AnimatePresence>
                  {isSignup && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          id="confirm-password-input"
                          type={showPassword ? 'text' : 'password'}
                          placeholder="Confirm Password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 rounded-xl text-sm font-medium
                            bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]
                            text-black dark:text-white placeholder-slate-400
                            focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue/50
                            transition-all duration-200"
                          autoComplete="new-password"
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Error */}
                <AnimatePresence>
                  {error && (
                    <motion.p
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="text-xs font-semibold text-brand-rose bg-brand-rose/10 rounded-lg px-3 py-2 border border-brand-rose/20"
                    >
                      {error}
                    </motion.p>
                  )}
                </AnimatePresence>

                {/* Submit */}
                <button
                  id="auth-submit-btn"
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold text-sm
                    bg-gradient-to-r from-brand-blue to-brand-blue-light text-white
                    shadow-lg shadow-brand-blue/25 hover:shadow-brand-blue/40
                    hover:scale-[1.02] active:scale-[0.98]
                    disabled:opacity-50 disabled:cursor-not-allowed
                    transition-all duration-300"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{isSignup ? 'Create Account' : 'Sign In'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Toggle */}
              <div className="mt-6 text-center">
                <p className="text-xs text-slate-500">
                  {isSignup ? 'Already have an account?' : "Don't have an account?"}
                  <button
                    id="auth-toggle-btn"
                    onClick={toggleMode}
                    className="ml-1 font-semibold text-brand-blue hover:text-brand-blue-light transition-colors"
                  >
                    {isSignup ? 'Sign In' : 'Sign Up'}
                  </button>
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
