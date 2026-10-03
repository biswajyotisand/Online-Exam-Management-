import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { ShieldAlert, KeyRound, CheckCircle2, Lock, ArrowRight, HelpCircle } from 'lucide-react';

export const OperationalizeModal: React.FC = () => {
  const { profile, activeRole, operationalizeAccount, signOut } = useAuth();
  const [passcode, setPasscode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleTitle = activeRole === 'paper_setter' ? 'Exam Paper Setter' : 'Exam Evaluator';

  const handleOperationalize = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!passcode.trim()) {
      setError('Please enter the operationalization passcode.');
      return;
    }

    try {
      setSubmitting(true);
      const success = await operationalizeAccount(passcode.trim());
      if (!success) {
        setError('Incorrect operationalization passcode. Please contact your system administrator.');
      }
    } catch (err: any) {
      setError(err?.message || 'Verification failed. Please contact your administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full shadow-2xl border border-indigo-200 dark:border-indigo-900/80 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold tracking-tight">
              Operational Authorization Required
            </h3>
            <p className="text-xs text-indigo-100 mt-0.5">
              Role Activation for {roleTitle}
            </p>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-900/60 text-xs text-indigo-900 dark:text-indigo-200 leading-relaxed">
            <div className="flex items-start space-x-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-indigo-600 dark:text-indigo-400" />
              <div>
                To make your account operational for the role of{' '}
                <strong className="font-bold underline">{roleTitle}</strong>, you must enter the
                pre-set authorization passcode assigned by the Administrator.
              </div>
            </div>
            <div className="mt-2.5 pt-2.5 border-t border-indigo-200/60 dark:border-indigo-800/60 text-[11px] text-indigo-700 dark:text-indigo-300">
              Account: <strong>{profile?.displayName}</strong> ({profile?.employeeId || profile?.email})
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <form onSubmit={handleOperationalize} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Enter {roleTitle} Operational Passcode <span className="text-rose-500">*</span>
              </label>
              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <KeyRound className="w-4 h-4" />
                </div>
                <input
                  type="text"
                  required
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  placeholder={
                    activeRole === 'paper_setter'
                      ? 'e.g. SETTER-OPERATE-2026'
                      : 'e.g. EVAL-OPERATE-2026'
                  }
                  className="block w-full pl-9 pr-3 py-2.5 text-sm uppercase font-mono bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 dark:text-white"
                />
              </div>
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-slate-400">
                <span>Passcode is pre-configured by the system administrator</span>
                <button
                  type="button"
                  onClick={() => {
                    const sample =
                      activeRole === 'paper_setter'
                        ? 'SETTER-OPERATE-2026'
                        : 'EVAL-OPERATE-2026';
                    setPasscode(sample);
                  }}
                  className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline"
                >
                  Fill Default Passcode
                </button>
              </div>
            </div>

            <div className="pt-2 flex items-center space-x-3">
              <button
                type="button"
                onClick={signOut}
                className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Sign Out
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center py-2.5 px-4 rounded-xl text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-all shadow-md shadow-indigo-600/25 disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Verifying Authorization...</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-2">
                    <span>Authorize & Make Account Operational</span>
                    <ArrowRight className="w-4 h-4" />
                  </span>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
