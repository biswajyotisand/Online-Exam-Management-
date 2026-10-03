import React, { useState } from 'react';
import { Exam, Submission } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  Send,
  Calendar,
  Clock,
  X,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Sparkles,
  Info
} from 'lucide-react';

interface ForwardEvaluationsModalProps {
  isOpen: boolean;
  exam: Exam | null;
  submissions: Submission[];
  evaluatorName: string;
  evaluatorId: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const ForwardEvaluationsModal: React.FC<ForwardEvaluationsModalProps> = ({
  isOpen,
  exam,
  submissions,
  evaluatorName,
  evaluatorId,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !exam) return null;

  // Calculate default recommended release: e.g. 24 hours from now
  const defaultRecommendedDate = () => {
    if (exam.recommendedResultReleaseTime) {
      try {
        const d = new Date(exam.recommendedResultReleaseTime);
        if (!isNaN(d.getTime())) {
          return d.toISOString().slice(0, 16);
        }
      } catch {}
    }
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    // Round to top of hour
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [recommendedTime, setRecommendedTime] = useState<string>(defaultRecommendedDate());
  const [remarks, setRemarks] = useState<string>(
    exam.evaluatorRemarks || 'All submitted candidate scripts have been evaluated and verified for grading accuracy. Ready for administrative publication.'
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const examSubs = submissions.filter((s) => s.examId === exam.id);
  const evaluatedCount = examSubs.filter((s) => s.status === 'evaluated').length;
  const pendingCount = examSubs.length - evaluatedCount;

  // Preset quick helpers
  const handleSetPresetHours = (hours: number) => {
    const d = new Date(Date.now() + hours * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setRecommendedTime(localIso);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recommendedTime) {
      setError('Please select a recommended result release date and time.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Convert to full ISO string
      const releaseIso = new Date(recommendedTime).toISOString();

      await examService.forwardEvaluationsToAdmin(exam.id, {
        evaluatorId,
        evaluatorName,
        recommendedResultReleaseTime: releaseIso,
        evaluatorRemarks: remarks.trim(),
      });

      onSuccess(
        `Evaluations for "${exam.title}" successfully forwarded to Administrator with recommended release on ${new Date(releaseIso).toLocaleString()}!`
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to forward evaluations to administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-750/50">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Send className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Forward Evaluations to Administrator
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-sm">
                Exam: {exam.title} ({exam.subject})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Evaluation Summary Banner */}
        <div className="p-4 mx-6 mt-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-900/60 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-purple-950 dark:text-purple-200 flex items-center space-x-1.5">
              <FileCheck className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <span>Evaluation Status Breakdown</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200 text-purple-900 dark:bg-purple-900 dark:text-purple-200">
              Evaluator: {evaluatorName}
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2 pt-1 text-center">
            <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-purple-100 dark:border-purple-900/50">
              <div className="text-[10px] text-slate-400">Total Scripts</div>
              <div className="text-sm font-extrabold text-slate-900 dark:text-white">{examSubs.length}</div>
            </div>
            <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-purple-100 dark:border-purple-900/50">
              <div className="text-[10px] text-emerald-600 font-semibold">Graded</div>
              <div className="text-sm font-extrabold text-emerald-600 dark:text-emerald-400">{evaluatedCount}</div>
            </div>
            <div className="p-2 bg-white dark:bg-slate-800 rounded-xl border border-purple-100 dark:border-purple-900/50">
              <div className="text-[10px] text-amber-600 font-semibold">Pending</div>
              <div className="text-sm font-extrabold text-amber-600 dark:text-amber-400">{pendingCount}</div>
            </div>
          </div>

          {pendingCount > 0 && (
            <div className="flex items-center space-x-1.5 text-[11px] text-amber-700 dark:text-amber-300 pt-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" />
              <span>Note: {pendingCount} candidate submission(s) remain unfinalized. You may still forward the evaluations dossier for administrative review.</span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Recommended Result Release Date & Time */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Recommended Result Publication Date & Time <span className="text-rose-500">*</span>
            </label>
            <p className="text-[11px] text-slate-500">
              Recommend when the final marks and scorecards should be published to candidates. The Administrator will review and authorize this schedule.
            </p>

            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="datetime-local"
                required
                value={recommendedTime}
                onChange={(e) => setRecommendedTime(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Quick Preset Buttons */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-400">Quick presets:</span>
              <button
                type="button"
                onClick={() => handleSetPresetHours(24)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
              >
                +24 Hours (Tomorrow)
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetHours(48)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
              >
                +48 Hours (2 Days)
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetHours(72)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
              >
                +3 Days
              </button>
              <button
                type="button"
                onClick={() => handleSetPresetHours(168)}
                className="px-2.5 py-1 rounded-lg text-[10px] font-semibold bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-300 transition-colors"
              >
                +1 Week
              </button>
            </div>
          </div>

          {/* Evaluator Remarks */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Evaluator Remarks & Recommendations for Administrator
            </label>
            <textarea
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="e.g. Grading completed, average marks 78%, recommended release on Friday at 4 PM..."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 flex items-start space-x-2 text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
            <Info className="w-4 h-4 text-purple-500 shrink-0 mt-0.5" />
            <div>
              <strong>Institutional Policy:</strong> Forwarding notifies the Administrator that evaluations are complete. The Administrator has full authority to authorize or adjust the scheduled release date/time before clicking <strong>Publish Results to Candidates</strong>.
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-900/30 transition-all disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Forwarding...' : 'Forward to Administrator'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
