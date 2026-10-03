import React, { useState } from 'react';
import { Exam, Submission } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  Award,
  Calendar,
  Clock,
  X,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Send,
  Zap,
  Info
} from 'lucide-react';

interface AuthorizeResultsPublicationModalProps {
  isOpen: boolean;
  exam: Exam | null;
  submissions: Submission[];
  adminName: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const AuthorizeResultsPublicationModal: React.FC<AuthorizeResultsPublicationModalProps> = ({
  isOpen,
  exam,
  submissions,
  adminName,
  onClose,
  onSuccess,
}) => {
  if (!isOpen || !exam) return null;

  // Initial scheduled time: recommended time or now + 24 hrs
  const getInitialTime = () => {
    if (exam.scheduledResultReleaseTime) {
      try {
        const d = new Date(exam.scheduledResultReleaseTime);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 16);
      } catch {}
    }
    if (exam.recommendedResultReleaseTime) {
      try {
        const d = new Date(exam.recommendedResultReleaseTime);
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 16);
      } catch {}
    }
    const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
    d.setMinutes(0, 0, 0);
    return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  };

  const [scheduledTime, setScheduledTime] = useState<string>(getInitialTime());
  const [adminNotes, setAdminNotes] = useState<string>(exam.adminResultNotes || '');
  const [publishImmediately, setPublishImmediately] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const examSubs = submissions.filter((s) => s.examId === exam.id);
  const evaluatedCount = examSubs.filter((s) => s.status === 'evaluated').length;

  const handleApplyRecommended = () => {
    if (exam.recommendedResultReleaseTime) {
      const d = new Date(exam.recommendedResultReleaseTime);
      const localIso = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
      setScheduledTime(localIso);
      setPublishImmediately(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!publishImmediately && !scheduledTime) {
      setError('Please specify a scheduled publication date and time or choose to publish immediately.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const releaseIso = publishImmediately ? new Date().toISOString() : new Date(scheduledTime).toISOString();

      await examService.authorizeAndScheduleResultPublication(exam.id, {
        adminName,
        scheduledResultReleaseTime: releaseIso,
        adminResultNotes: adminNotes.trim(),
        publishImmediately,
      });

      if (publishImmediately) {
        onSuccess(`Results for "${exam.title}" are now published live to candidates!`);
      } else {
        onSuccess(
          `Results publication schedule for "${exam.title}" authorized and set for ${new Date(releaseIso).toLocaleString()}!`
        );
      }
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to authorize and schedule result publication.');
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
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Authorize & Publish Results to Candidates
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

        {/* Evaluator's Recommendation Callout */}
        <div className="p-4 mx-6 mt-4 rounded-2xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5">
              <FileCheck className="w-4 h-4 text-amber-600" />
              <span>Evaluator Forwarding Dossier ({exam.evaluatorName || 'Designated Evaluator'})</span>
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
              {evaluatedCount} of {examSubs.length} Graded
            </span>
          </div>

          <div className="text-amber-950 dark:text-amber-100 font-medium space-y-1 pl-5">
            <div>
              Recommended Release Date & Time:{' '}
              <strong className="underline">
                {exam.recommendedResultReleaseTime
                  ? new Date(exam.recommendedResultReleaseTime).toLocaleString()
                  : 'Not specified'}
              </strong>
            </div>
            {exam.evaluatorRemarks && (
              <div className="text-[11px] italic text-amber-800 dark:text-amber-300 pt-0.5">
                Evaluator Remarks: "{exam.evaluatorRemarks}"
              </div>
            )}
            {exam.evaluationForwardedAt && (
              <div className="text-[10px] text-amber-700/80 dark:text-amber-400">
                Forwarded on: {new Date(exam.evaluationForwardedAt).toLocaleString()}
              </div>
            )}
          </div>

          {exam.recommendedResultReleaseTime && (
            <div className="pt-1 flex justify-end">
              <button
                type="button"
                onClick={handleApplyRecommended}
                className="px-3 py-1 rounded-lg text-[11px] font-bold bg-amber-200 hover:bg-amber-300 text-amber-900 transition-colors"
              >
                Apply Evaluator's Recommended Schedule
              </button>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Option: Publish Immediately or Schedule */}
          <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={publishImmediately}
                  onChange={(e) => setPublishImmediately(e.target.checked)}
                  className="rounded text-emerald-600 focus:ring-emerald-500 w-4 h-4"
                />
                <span className="flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5 text-amber-500 fill-current" />
                  <span>Publish Results to Candidates Immediately</span>
                </span>
              </label>
              <span className="text-[10px] text-slate-400">Skip future schedule countdown</span>
            </div>

            {!publishImmediately && (
              <div className="space-y-1.5 pt-1 border-t border-slate-200 dark:border-slate-700">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  Authorized Result Publication Date & Time <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="datetime-local"
                    required={!publishImmediately}
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  You can alter or authorize the date and time. Candidate scorecards will unlock automatically when this time is reached.
                </p>
              </div>
            )}
          </div>

          {/* Admin Publication Remarks */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
              Administrator Publication Notes (Optional)
            </label>
            <input
              type="text"
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="e.g. Approved by Academic Board. All re-evaluations resolved."
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-start space-x-2 text-[11px] text-emerald-900 dark:text-emerald-200 leading-relaxed">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <strong>Candidate Privacy Guaranteed:</strong> Marks and scorecards remain strictly locked until the authorized date & time is reached (or immediately if chosen). Prior to that timestamp, candidates can only access their un-scored Attempt Slip.
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
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/30 transition-all disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Award className="w-3.5 h-3.5" />
              <span>
                {submitting
                  ? 'Authorizing...'
                  : publishImmediately
                  ? 'Publish Results to Candidates Now'
                  : 'Authorize & Schedule Result Publication'}
              </span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
