import React, { useState } from 'react';
import { Lock, Eye, EyeOff, AlertCircle, ShieldCheck, X } from 'lucide-react';

interface LoginModalProps {
  isOpen: boolean;
  targetTabName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  targetTabName,
  onSuccess,
  onCancel
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!password.trim()) {
      setErrorMsg('Please enter the access password');
      return;
    }

    setIsSubmitting(true);
    // Universal access password check (in-memory authentication only)
    if (password === 'dqms123') {
      setPassword('');
      setErrorMsg('');
      setIsSubmitting(false);
      onSuccess();
    } else {
      setIsSubmitting(false);
      setErrorMsg('Invalid access password');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-slate-800 text-amber-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight">Staff Authentication</h3>
              <p className="text-[11px] text-slate-400">Access Restricted Area</p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content & Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="text-xs text-slate-600 leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-3">
            <span className="font-semibold text-slate-800 block mb-0.5">
              Portal: {targetTabName}
            </span>
            Enter camp operator passcode to proceed to station desk and supervisor controls.
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Access Passcode
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                autoFocus
                required
                placeholder="Enter password..."
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (errorMsg) setErrorMsg('');
                }}
                className="w-full text-sm bg-white border border-slate-200 rounded-lg pl-3 pr-10 py-2.5 text-slate-900 focus:border-slate-900 focus:outline-hidden font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-700 transition-colors p-0.5"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              <span>Unlock Access</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
