import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Settings, Clock, Shield, Palette, AlertTriangle, Download, Trash2,
  Plus, X, Save, CheckCircle, FileJson, FileSpreadsheet, LogOut, Info, RefreshCw, Smile
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { getSettings, updateSettings, exportData, deleteAccount } from '../api';

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [newKeyword, setNewKeyword] = useState('');
  const [newBlockedSite, setNewBlockedSite] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(null);
  
  const [appVersion, setAppVersion] = useState('');
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('');

  // Load settings on mount
  useEffect(() => {
    getSettings()
      .then((data) => setSettings(data))
      .catch(() => {
        // Use defaults if settings not found
        setSettings({
          focus_duration: 25,
          short_break_duration: 5,
          long_break_duration: 15,
          distraction_keywords: [
            'YouTube', 'Netflix', 'Twitch', 'Facebook', 'Instagram',
            'Reddit', 'Twitter', 'x.com', 'Pinterest', 'LinkedIn',
            'WhatsApp', 'Discord', 'Spotify', 'Steam', 'Roblox', 'TikTok'
          ],
          blocked_websites: [],
          theme: 'light',
        });
      })
      .finally(() => setLoading(false));
      
    if (window.electronAPI) {
      window.electronAPI.getAppVersion().then(v => setAppVersion(v));
    }
  }, []);

  const handleSave = useCallback(async (updatedSettings) => {
    setSaving(true);
    try {
      const data = await updateSettings(updatedSettings || settings);
      setSettings(data);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      window.dispatchEvent(new Event('settingsUpdated'));
    } catch (err) {
      console.error('Failed to save settings:', err);
    } finally {
      setSaving(false);
    }
  }, [settings]);

  const updateField = (field, value) => {
    const updated = { ...settings, [field]: value };
    setSettings(updated);
  };

  const addKeyword = () => {
    const kw = newKeyword.trim();
    if (!kw || settings.distraction_keywords.includes(kw)) return;
    const updated = { ...settings, distraction_keywords: [...settings.distraction_keywords, kw] };
    setSettings(updated);
    setNewKeyword('');
    handleSave(updated);
  };

  const removeKeyword = (kw) => {
    const updated = {
      ...settings,
      distraction_keywords: settings.distraction_keywords.filter(k => k !== kw),
    };
    setSettings(updated);
    handleSave(updated);
  };

  const addBlockedSite = () => {
    const site = newBlockedSite.trim().toLowerCase();
    const blocked_websites = settings.blocked_websites || [];
    if (!site || blocked_websites.includes(site)) return;
    const updated = { ...settings, blocked_websites: [...blocked_websites, site] };
    setSettings(updated);
    setNewBlockedSite('');
    handleSave(updated);
  };

  const removeBlockedSite = (site) => {
    const updated = {
      ...settings,
      blocked_websites: (settings.blocked_websites || []).filter(s => s !== site),
    };
    setSettings(updated);
    handleSave(updated);
  };

  const handleExport = async (format) => {
    setExporting(format);
    try {
      const blob = await exportData(format);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `focuspie_export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(null);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== user?.username) return;
    setDeleting(true);
    try {
      await deleteAccount();
      logout();
    } catch (err) {
      console.error('Delete account failed:', err);
    } finally {
      setDeleting(false);
    }
  };

  const handleThemeToggle = () => {
    toggleTheme();
    const newTheme = theme === 'light' ? 'dark' : 'light';
    handleSave({ ...settings, theme: newTheme });
  };

  const handleCheckUpdate = async () => {
    if (!window.electronAPI) {
      alert('Update checking is not available in the web version.');
      return;
    }
    setCheckingUpdate(true);
    try {
      const res = await window.electronAPI.checkForUpdates();
      if (!res.success) {
        alert('Update check failed: ' + res.error);
      }
    } catch (err) {
      alert('Error checking for updates.');
    } finally {
      setCheckingUpdate(false);
    }
  };

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-display font-bold text-black dark:text-white flex items-center gap-2">
            <Settings className="w-6 h-6 text-brand-blue" />
            Settings
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Signed in as <span className="font-semibold text-brand-blue">{user?.username}</span>
          </p>
        </div>
        <AnimatePresence>
          {saved && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-brand-emerald/10 text-brand-emerald text-xs font-bold border border-brand-emerald/20"
            >
              <CheckCircle className="w-3.5 h-3.5" />
              Saved
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Distraction Keywords */}
      <section className="glass p-6" id="keyword-settings">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="w-4.5 h-4.5 text-brand-rose" />
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-black dark:text-white">
            Distraction Keywords
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Apps and websites matching these keywords will be flagged as distractions during focus sessions.
        </p>

        {/* Add new keyword */}
        <div className="flex gap-2 mb-4">
          <input
            id="new-keyword-input"
            type="text"
            placeholder="Add keyword..."
            value={newKeyword}
            onChange={(e) => setNewKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addKeyword()}
            className="flex-1 px-3.5 py-2.5 rounded-xl text-sm font-medium
              bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]
              text-black dark:text-white placeholder-slate-400
              focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue/50
              transition-all duration-200"
          />
          <button
            id="add-keyword-btn"
            onClick={addKeyword}
            disabled={!newKeyword.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs
              bg-brand-blue text-white hover:bg-brand-blue-light
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {/* Keywords tags */}
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {settings.distraction_keywords.map((kw) => (
              <motion.div
                key={kw}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                layout
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                  bg-brand-rose/8 text-brand-rose border border-brand-rose/15
                  hover:bg-brand-rose/15 transition-all duration-200"
              >
                <span>{kw}</span>
                <button
                  onClick={() => removeKeyword(kw)}
                  className="w-4 h-4 rounded-full flex items-center justify-center
                    opacity-50 group-hover:opacity-100 hover:bg-brand-rose/20
                    transition-all duration-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* Website Blocking */}
      <section className="glass p-6" id="blocking-settings">
        <div className="flex items-center gap-2 mb-5">
          <Shield className="w-4.5 h-4.5 text-brand-rose" />
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-black dark:text-white">
            Website Blocking (Hosts File)
          </h3>
        </div>
        <div className="mb-4">
          <p className="text-xs text-slate-500">
            These websites will be blocked system-wide when a focus session is active.
          </p>
          <div className="bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 p-2 rounded-lg mt-2 text-[10px] flex gap-1.5 items-start">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            <p>Note: Modifying the hosts file requires FocusPie backend to be running as Administrator.</p>
          </div>
        </div>

        {/* Add new site */}
        <div className="flex gap-2 mb-4">
          <input
            id="new-blocked-site-input"
            type="text"
            placeholder="e.g. youtube.com"
            value={newBlockedSite}
            onChange={(e) => setNewBlockedSite(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addBlockedSite()}
            className="flex-1 px-3.5 py-2.5 rounded-xl text-sm font-medium
              bg-slate-50 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]
              text-black dark:text-white placeholder-slate-400
              focus:outline-none focus:ring-2 focus:ring-brand-blue/30 focus:border-brand-blue/50
              transition-all duration-200"
          />
          <button
            id="add-blocked-site-btn"
            onClick={addBlockedSite}
            disabled={!newBlockedSite.trim()}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs
              bg-brand-rose text-white hover:bg-brand-rose-light
              disabled:opacity-40 disabled:cursor-not-allowed
              transition-all duration-200 hover:scale-[1.03] active:scale-[0.97]"
          >
            <Plus className="w-3.5 h-3.5" />
            Add
          </button>
        </div>

        {/* Blocked Sites tags */}
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {(settings.blocked_websites || []).map((site) => (
              <motion.div
                key={site}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                layout
                className="group flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold
                  bg-brand-rose/8 text-brand-rose border border-brand-rose/15
                  hover:bg-brand-rose/15 transition-all duration-200"
              >
                <span>{site}</span>
                <button
                  onClick={() => removeBlockedSite(site)}
                  className="w-4 h-4 rounded-full flex items-center justify-center
                    opacity-50 group-hover:opacity-100 hover:bg-brand-rose/20
                    transition-all duration-200"
                >
                  <X className="w-3 h-3" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </section>

      {/* Appearance */}
      <section className="glass p-6" id="appearance-settings">
        <div className="flex items-center gap-2 mb-5">
          <Palette className="w-4.5 h-4.5 text-brand-purple" />
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-black dark:text-white">
            Appearance
          </h3>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-black dark:text-white">Theme</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Currently using <span className="font-semibold">{theme === 'dark' ? 'Dark' : 'Light'}</span> mode
            </p>
          </div>
          <button
            id="theme-toggle-btn"
            onClick={handleThemeToggle}
            className={`relative w-14 h-7 rounded-full transition-all duration-300 ${
              theme === 'dark'
                ? 'bg-brand-blue shadow-[0_0_12px_rgba(59,130,246,0.3)]'
                : 'bg-slate-200'
            }`}
          >
            <motion.div
              layout
              className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md ${
                theme === 'dark' ? 'left-[calc(100%-1.625rem)]' : 'left-0.5'
              }`}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
          </button>
        </div>
      </section>

      {/* Interactive Avatar Companion */}
      <section className="glass p-6" id="avatar-settings">
        <div className="flex items-center gap-2 mb-5">
          <Smile className="w-4.5 h-4.5 text-orange-500" />
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-black dark:text-white">
            Companion Avatar
          </h3>
        </div>
        <p className="text-xs text-slate-500 mb-4">
          Choose your companion. They will react to your focus sessions, levels, and streaks.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { value: 'fox', label: 'Firefox', icon: '🦊' },
            { value: 'robot', label: 'Focus Bot', icon: '🤖' },
            { value: 'wizard', label: 'Wizard', icon: '🧙‍♂️' },
            { value: 'ninja', label: 'Ninja', icon: '🥷' },
            { value: 'emoji', label: 'Emoji', icon: '🙂' },
          ].map((avatar) => (
            <button
              key={avatar.value}
              onClick={() => {
                const updated = { ...settings, avatar_style: avatar.value };
                setSettings(updated);
                handleSave(updated);
              }}
              className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-all duration-200 cursor-pointer ${
                settings.avatar_style === avatar.value
                  ? 'bg-brand-blue/10 border-brand-blue/30 shadow-[0_0_12px_rgba(59,130,246,0.15)] scale-105'
                  : 'bg-slate-50 dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.05] hover:bg-slate-100 dark:hover:bg-white/[0.05]'
              }`}
            >
              <span className="text-3xl mb-2">{avatar.icon}</span>
              <span className="text-[10px] font-bold text-slate-600 dark:text-slate-300">{avatar.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* About & Updates */}
      <section className="glass p-6" id="about-settings">
        <div className="flex items-center gap-2 mb-5">
          <Info className="w-4.5 h-4.5 text-brand-emerald" />
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-black dark:text-white">
            About & Updates
          </h3>
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-black dark:text-white">FocusPie Version</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {appVersion ? `v${appVersion}` : 'Web Version'}
            </p>
          </div>
          <div className="flex flex-col items-end">
            <button
              onClick={handleCheckUpdate}
              disabled={checkingUpdate || !window.electronAPI}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]
                text-black dark:text-white hover:bg-brand-emerald/10 hover:text-brand-emerald hover:border-brand-emerald/30
                disabled:opacity-50 transition-all duration-200"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin text-brand-emerald' : ''}`} />
              Check for Updates
            </button>
            {updateMessage && (
              <p className="text-[10px] text-brand-emerald mt-1 absolute -bottom-5">{updateMessage}</p>
            )}
          </div>
        </div>
      </section>

      {/* Danger Zone */}
      <section className="glass p-6 border-2 !border-brand-rose/20" id="danger-zone">
        <div className="flex items-center gap-2 mb-5">
          <AlertTriangle className="w-4.5 h-4.5 text-brand-rose" />
          <h3 className="text-sm font-display font-bold uppercase tracking-wider text-brand-rose">
            Danger Zone
          </h3>
        </div>

        {/* Export Data */}
        <div className="mb-6">
          <p className="text-sm font-semibold text-black dark:text-white mb-1">Export Your Data</p>
          <p className="text-xs text-slate-500 mb-3">Download all your sessions, tasks, and settings.</p>
          <div className="flex gap-2">
            <button
              id="export-json-btn"
              onClick={() => handleExport('json')}
              disabled={!!exporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs
                bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]
                text-black dark:text-white hover:bg-slate-200 dark:hover:bg-white/[0.08]
                disabled:opacity-50 transition-all duration-200 hover:scale-[1.02]"
            >
              {exporting === 'json' ? (
                <div className="w-4 h-4 border-2 border-slate-300 border-t-brand-blue rounded-full animate-spin" />
              ) : (
                <FileJson className="w-4 h-4 text-brand-blue" />
              )}
              Export JSON
            </button>
            <button
              id="export-csv-btn"
              onClick={() => handleExport('csv')}
              disabled={!!exporting}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs
                bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]
                text-black dark:text-white hover:bg-slate-200 dark:hover:bg-white/[0.08]
                disabled:opacity-50 transition-all duration-200 hover:scale-[1.02]"
            >
              {exporting === 'csv' ? (
                <div className="w-4 h-4 border-2 border-slate-300 border-t-brand-emerald rounded-full animate-spin" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-brand-emerald" />
              )}
              Export CSV
            </button>
          </div>
        </div>

        {/* Delete Account */}
        <div className="pt-5 border-t border-brand-rose/10">
          <p className="text-sm font-semibold text-brand-rose mb-1">Delete Account</p>
          <p className="text-xs text-slate-500 mb-3">
            Permanently delete your account and erase all local data. This action cannot be undone.
          </p>
          <button
            id="delete-account-btn"
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-xs
              bg-brand-rose/10 border border-brand-rose/20 text-brand-rose
              hover:bg-brand-rose hover:text-white hover:border-brand-rose
              transition-all duration-200 hover:scale-[1.02]"
          >
            <Trash2 className="w-4 h-4" />
            Delete My Account
          </button>
        </div>
      </section>

      {/* Logout */}
      <div className="flex justify-end">
        <button
          id="logout-btn"
          onClick={logout}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs
            bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]
            text-slate-600 dark:text-slate-400 hover:text-brand-rose hover:border-brand-rose/30
            transition-all duration-200"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {createPortal(
        <AnimatePresence>
          {showDeleteModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
              onClick={() => setShowDeleteModal(false)}
            >
              <motion.div
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.9, y: 20 }}
                className="glass p-6 max-w-sm mx-4 border-2 !border-brand-rose/30"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-10 h-10 rounded-full bg-brand-rose/10 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-brand-rose" />
                  </div>
                  <div>
                    <h3 className="text-sm font-display font-bold text-brand-rose">Confirm Deletion</h3>
                    <p className="text-xs text-slate-500">This action is permanent</p>
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
                  Type <span className="font-bold text-brand-rose">{user?.username}</span> to confirm account deletion.
                </p>

                <input
                  id="delete-confirm-input"
                  type="text"
                  placeholder="Type username to confirm"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl text-sm font-medium mb-4
                    bg-slate-50 dark:bg-white/[0.04] border border-brand-rose/20
                    text-black dark:text-white placeholder-slate-400
                    focus:outline-none focus:ring-2 focus:ring-brand-rose/30 focus:border-brand-rose/50
                    transition-all duration-200"
                />

                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); }}
                    className="flex-1 px-4 py-2.5 rounded-xl font-semibold text-xs
                      bg-slate-100 dark:bg-white/[0.04] border border-slate-200 dark:border-white/[0.08]
                      text-black dark:text-white hover:bg-slate-200 transition-all duration-200"
                  >
                    Cancel
                  </button>
                  <button
                    id="confirm-delete-btn"
                    onClick={handleDeleteAccount}
                    disabled={deleteConfirmText !== user?.username || deleting}
                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-xs
                      bg-brand-rose text-white hover:bg-brand-rose-light
                      disabled:opacity-40 disabled:cursor-not-allowed
                      transition-all duration-200"
                  >
                    {deleting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Forever
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  );
}
