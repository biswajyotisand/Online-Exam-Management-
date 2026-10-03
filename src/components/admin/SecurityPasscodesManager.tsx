import React, { useState, useEffect } from 'react';
import { examService } from '../../services/examService';
import { SystemPasscodes } from '../../types/exam';
import {
  KeyRound,
  ShieldCheck,
  Save,
  Copy,
  Check,
  RefreshCw,
  Sparkles,
  BookOpen,
  CheckSquare,
  Lock,
  AlertCircle
} from 'lucide-react';

export const SecurityPasscodesManager: React.FC = () => {
  const [passcodes, setPasscodes] = useState<SystemPasscodes | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Form inputs
  const [setterPass, setSetterPass] = useState('');
  const [evaluatorPass, setEvaluatorPass] = useState('');
  const [switchPass, setSwitchPass] = useState('');

  const loadPasscodes = async () => {
    try {
      setLoading(true);
      const data = await examService.getSystemPasscodes();
      setPasscodes(data);
      setSetterPass(data.paperSetterOperationalPasscode || '');
      setEvaluatorPass(data.evaluatorOperationalPasscode || '');
      setSwitchPass(data.roleSwitchPasscode || '');
    } catch (err) {
      console.error('Failed to load passcodes:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPasscodes();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setterPass.trim() || !evaluatorPass.trim()) {
      return;
    }

    try {
      setSaving(true);
      await examService.updateSystemPasscodes({
        paperSetterOperationalPasscode: setterPass.trim().toUpperCase(),
        evaluatorOperationalPasscode: evaluatorPass.trim().toUpperCase(),
      });
      setSuccess('Security operational passcodes updated successfully in Firestore.');
      setTimeout(() => setSuccess(null), 3500);
      await loadPasscodes();
    } catch (err) {
      console.error('Error saving passcodes:', err);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-xs text-slate-400">
        <RefreshCw className="w-5 h-5 mx-auto animate-spin mb-2 text-rose-500" />
        <span>Loading system security passcodes...</span>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
      <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50 dark:bg-slate-750/50">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Role Operationalization & Switch Passcodes
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Administrator authority over staff account operationalization and role-switching keys
            </p>
          </div>
        </div>

        <div className="text-[11px] text-slate-500">
          Last updated: {passcodes?.updatedAt ? new Date(passcodes.updatedAt).toLocaleString() : 'System Default'}
        </div>
      </div>

      <div className="p-6">
        {success && (
          <div className="mb-6 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300 text-xs font-semibold flex items-center space-x-2">
            <Check className="w-4 h-4 text-emerald-600" />
            <span>{success}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* 1. Exam Paper Setter Operational Passcode */}
            <div className="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/30 dark:bg-indigo-950/20 space-y-3">
              <div className="flex items-center space-x-2 text-indigo-700 dark:text-indigo-300">
                <BookOpen className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Paper Setter Operational Passcode
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed min-h-[38px]">
                Required by Exam Paper Setters to operationalize their account before authoring exams and questions.
              </p>
              <div className="relative rounded-xl">
                <input
                  type="text"
                  required
                  value={setterPass}
                  onChange={(e) => setSetterPass(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs uppercase font-mono font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(setterPass, 'setter')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Copy Passcode"
                >
                  {copiedKey === 'setter' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* 2. Evaluator Operational Passcode */}
            <div className="p-4 rounded-2xl border border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/20 space-y-3">
              <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-300">
                <CheckSquare className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Evaluator Operational Passcode
                </span>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed min-h-[38px]">
                Required by Evaluators to operationalize their account before grading submissions and awarding marks.
              </p>
              <div className="relative rounded-xl">
                <input
                  type="text"
                  required
                  value={evaluatorPass}
                  onChange={(e) => setEvaluatorPass(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-xs uppercase font-mono font-bold bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-amber-500 text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => copyToClipboard(evaluatorPass, 'eval')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                  title="Copy Passcode"
                >
                  {copiedKey === 'eval' ? (
                    <Check className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            {/* 3. Role-Switch Authorization Policy */}
            <div className="p-4 rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/30 dark:bg-rose-950/20 space-y-3">
              <div className="flex items-center space-x-2 text-rose-700 dark:text-rose-300">
                <ShieldCheck className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Role Switch Governance
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed min-h-[38px]">
                Strict Institutional Isolation: Except for the Administrator, no user can switch roles.
              </p>
              <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-800/60 text-xs">
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 mb-1">
                  Administrator Exclusive
                </span>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Candidates, Paper Setters & Evaluators are locked to their authorized portals. Only you (the Administrator) can inspect different views from the navbar.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="flex items-center space-x-2 text-xs text-slate-500">
              <Lock className="w-3.5 h-3.5" />
              <span>Passcodes are stored in Firestore system configuration and audited upon update.</span>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="flex items-center space-x-2 px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 shadow-md shadow-rose-600/20 transition-all"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Saving Passcodes...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>Save Passcode Configuration</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
