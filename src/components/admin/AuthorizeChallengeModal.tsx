import React, { useState, useEffect } from 'react';
import { QuestionChallenge } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  ShieldCheck,
  X,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Award,
  BookOpen,
  UserCheck,
  Check,
  FileCheck
} from 'lucide-react';

interface AuthorizeChallengeModalProps {
  isOpen: boolean;
  challenge: QuestionChallenge | null;
  adminId: string;
  adminName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AuthorizeChallengeModal: React.FC<AuthorizeChallengeModalProps> = ({
  isOpen,
  challenge,
  adminId,
  adminName,
  onClose,
  onSuccess,
}) => {
  const [decision, setDecision] = useState<'accept_revision' | 'uphold_original'>('accept_revision');
  const [finalMarks, setFinalMarks] = useState<number>(0);
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (challenge) {
      const isRecommendAccept = challenge.evaluatorDecision === 'recommend_accept';
      setDecision(isRecommendAccept ? 'accept_revision' : 'uphold_original');
      setFinalMarks(
        challenge.evaluatorRecommendedMarks !== undefined
          ? challenge.evaluatorRecommendedMarks
          : challenge.originalMarksAwarded
      );
      setAdminNotes(
        isRecommendAccept
          ? `Authorized based on evaluator recommendation (${challenge.evaluatorName || 'Academic Evaluator'}).`
          : 'Original score upheld following academic review.'
      );
    }
  }, [challenge]);

  if (!isOpen || !challenge) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminNotes.trim()) {
      setError('Please provide administrative remarks for this final determination.');
      return;
    }

    if (decision === 'accept_revision') {
      if (finalMarks < 0 || finalMarks > challenge.questionMarks) {
        setError(`Final marks must be between 0 and ${challenge.questionMarks}.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      await examService.adminResolveChallenge(challenge.id, {
        adminId,
        adminName,
        decision,
        finalAwardedMarks: decision === 'accept_revision' ? Number(finalMarks) : challenge.originalMarksAwarded,
        adminNotes: adminNotes.trim(),
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to authorize challenge resolution.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Authorize Question Challenge Resolution
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional review & final scorecard revision determination
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

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center space-x-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Dossier Summary Card */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {challenge.questionTitle}
                </span>
                <p className="text-[11px] text-slate-500">
                  Exam: {challenge.examTitle} • Candidate: <span className="font-semibold text-slate-800 dark:text-slate-200">{challenge.participantName}</span>
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 shrink-0">
                Original: {challenge.originalMarksAwarded} / {challenge.questionMarks} Pts
              </span>
            </div>

            {/* Candidate Answer */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                Candidate's Answer:
              </span>
              <div className="font-mono text-[11px] p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {challenge.candidateAnswer}
              </div>
            </div>

            {/* Candidate Appeal */}
            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40">
              <span className="text-[10px] uppercase font-bold text-amber-900 dark:text-amber-300 block mb-0.5">
                Candidate Appeal ({challenge.challengeReason}):
              </span>
              <p className="text-slate-800 dark:text-slate-200 text-xs">
                "{challenge.candidateExplanation}"
              </p>
            </div>

            {/* Evaluator's Recommendation */}
            <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 space-y-1">
              <div className="flex items-center justify-between text-xs font-bold text-purple-950 dark:text-purple-200">
                <span className="flex items-center space-x-1.5">
                  <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                  <span>Evaluator Recommendation ({challenge.evaluatorName || 'Academic Evaluator'}):</span>
                </span>
                <span className={`px-2 py-0.5 rounded-md text-[10px] ${
                  challenge.evaluatorDecision === 'recommend_accept'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}>
                  {challenge.evaluatorDecision === 'recommend_accept'
                    ? `Recommended: ${challenge.evaluatorRecommendedMarks} / ${challenge.questionMarks} Pts`
                    : 'Recommended: Uphold Original'}
                </span>
              </div>
              {challenge.evaluatorReviewNotes && (
                <p className="text-slate-700 dark:text-slate-300 text-xs italic">
                  "{challenge.evaluatorReviewNotes}"
                </p>
              )}
            </div>
          </div>

          {/* Admin Decision Options */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Administrator Final Determination <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setDecision('accept_revision')}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-3 transition-all ${
                  decision === 'accept_revision'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${decision === 'accept_revision' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold block">Authorize Score Revision</span>
                  <span className="text-[11px] opacity-80">Approve score adjustment and immediately update candidate scorecard.</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecision('uphold_original')}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-3 transition-all ${
                  decision === 'uphold_original'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <XCircle className={`w-5 h-5 shrink-0 ${decision === 'uphold_original' ? 'text-rose-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold block">Uphold Original Score</span>
                  <span className="text-[11px] opacity-80">Dismiss challenge appeal and maintain existing evaluation mark.</span>
                </div>
              </button>
            </div>
          </div>

          {/* If Authorizing Revision: Final Awarded Marks */}
          {decision === 'accept_revision' && (
            <div className="space-y-1.5 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60">
              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                <span>Final Authorized Marks (Max: {challenge.questionMarks} Pts)</span>
                <span className="text-[11px] font-normal">Original: {challenge.originalMarksAwarded} Pts</span>
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min={0}
                  max={challenge.questionMarks}
                  step={0.5}
                  value={finalMarks}
                  onChange={(e) => setFinalMarks(parseFloat(e.target.value) || 0)}
                  className="w-32 text-sm font-bold px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <span className="text-xs text-emerald-800 dark:text-emerald-300">
                  {finalMarks > challenge.originalMarksAwarded
                    ? `+${(finalMarks - challenge.originalMarksAwarded).toFixed(1)} points will be added to total score`
                    : finalMarks < challenge.originalMarksAwarded
                    ? `${(finalMarks - challenge.originalMarksAwarded).toFixed(1)} points adjustment`
                    : 'No net mark change'}
                </span>
              </div>
            </div>
          )}

          {/* Admin Decision Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Official Determination Endorsement / Notes <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="Official institutional sign-off notes (will be appended to the scorecard)..."
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
            />
          </div>

          {/* Automated Action Note */}
          <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-900 dark:text-emerald-300 flex items-center space-x-2">
            <Award className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              On authorization, the candidate's submission score, percentage, and pass/fail standing will be automatically recomputed in Firestore.
            </span>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/20 transition-all disabled:opacity-50"
            >
              <FileCheck className="w-3.5 h-3.5" />
              <span>{submitting ? 'Authorizing & Updating...' : 'Authorize Final Decision'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
