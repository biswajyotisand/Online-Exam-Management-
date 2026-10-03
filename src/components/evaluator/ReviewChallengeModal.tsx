import React, { useState } from 'react';
import { QuestionChallenge } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  HelpCircle,
  X,
  AlertCircle,
  Send,
  UserCheck,
  CheckCircle2,
  XCircle,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

interface ReviewChallengeModalProps {
  isOpen: boolean;
  challenge: QuestionChallenge | null;
  evaluatorId: string;
  evaluatorName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const ReviewChallengeModal: React.FC<ReviewChallengeModalProps> = ({
  isOpen,
  challenge,
  evaluatorId,
  evaluatorName,
  onClose,
  onSuccess,
}) => {
  const [decision, setDecision] = useState<'recommend_accept' | 'recommend_reject' | 'recommend_skip_question'>('recommend_accept');
  const [recommendedMarks, setRecommendedMarks] = useState<number>(challenge?.originalMarksAwarded ?? 0);
  const [reviewNotes, setReviewNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync recommended marks when modal opens or challenge changes
  React.useEffect(() => {
    if (challenge) {
      setRecommendedMarks(challenge.originalMarksAwarded);
      setReviewNotes('');
      if (challenge.setterDecision === 'recommend_skip_question') {
        setDecision('recommend_skip_question');
      } else {
        setDecision('recommend_accept');
      }
    }
  }, [challenge]);

  if (!isOpen || !challenge) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewNotes.trim()) {
      setError('Please provide evaluator remarks explaining your recommendation to the Administrator.');
      return;
    }

    if (decision === 'recommend_accept') {
      if (recommendedMarks < 0 || recommendedMarks > challenge.questionMarks) {
        setError(`Recommended marks must be between 0 and ${challenge.questionMarks}.`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      await examService.evaluatorReviewChallenge(challenge.id, {
        evaluatorId,
        evaluatorName,
        evaluatorDecision: decision,
        evaluatorRecommendedMarks: decision === 'recommend_accept' ? Number(recommendedMarks) : challenge.originalMarksAwarded,
        evaluatorReviewNotes: reviewNotes.trim(),
      });

      // If evaluator recommends skipping the question, also lodge a recommendation on the exam question
      if (decision === 'recommend_skip_question') {
        await examService.recommendSkipQuestion(
          challenge.examId,
          challenge.questionId,
          evaluatorId,
          evaluatorName,
          'evaluator',
          reviewNotes.trim()
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to submit challenge review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-purple-50/50 dark:bg-purple-950/20">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              <UserCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Evaluator Review of Question Challenge
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Assess candidate appeal & forward recommendation to Administrator
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

          {/* Candidate & Appeal Snapshot */}
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
                Original Score: {challenge.originalMarksAwarded} / {challenge.questionMarks} Pts
              </span>
            </div>

            {/* Candidate Submitted Response */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                Candidate's Submitted Answer:
              </span>
              <div className="font-mono text-[11px] p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {challenge.candidateAnswer || <span className="italic text-slate-400">Unattempted</span>}
              </div>
            </div>

            {/* Candidate Justification */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Candidate's Stated Argument:</span>
                <span className="text-[10px] text-amber-600 font-bold uppercase">{challenge.challengeReason.replace(/_/g, ' ')}</span>
              </div>
              <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 text-slate-800 dark:text-slate-200 italic leading-relaxed">
                "{challenge.candidateExplanation}"
              </div>
              {challenge.supportingReference && (
                <div className="text-[11px] text-slate-500 pt-0.5">
                  <strong>Academic Citation:</strong> {challenge.supportingReference}
                </div>
              )}
            </div>

            {/* Paper Setter Recommendation (if reviewed) */}
            {challenge.setterReviewedAt && (
              <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-1 text-xs">
                <div className="flex items-center justify-between text-indigo-900 dark:text-indigo-200">
                  <span className="font-bold flex items-center space-x-1">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Paper Setter Recommendation ({challenge.setterName || 'Setter'}):</span>
                  </span>
                  <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                    {challenge.setterDecision?.replace(/_/g, ' ')}
                  </span>
                </div>
                {challenge.setterProposedAnswer && (
                  <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                    Setter Proposed Answer Key: "{challenge.setterProposedAnswer}"
                  </div>
                )}
                {challenge.setterReviewNotes && (
                  <p className="text-slate-700 dark:text-slate-300 text-xs italic">
                    "{challenge.setterReviewNotes}"
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Evaluator Recommendation Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Evaluator Recommendation to Administrator <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setDecision('recommend_accept')}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-2.5 transition-all cursor-pointer ${
                  decision === 'recommend_accept'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${decision === 'recommend_accept' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold block">Recommend Mark Revision</span>
                  <span className="text-[10px] opacity-80">Recommend revising score for this candidate.</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecision('recommend_reject')}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-2.5 transition-all cursor-pointer ${
                  decision === 'recommend_reject'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <XCircle className={`w-5 h-5 shrink-0 ${decision === 'recommend_reject' ? 'text-rose-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold block">Uphold Original Mark</span>
                  <span className="text-[10px] opacity-80">Recommend upholding the original evaluation score.</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecision('recommend_skip_question')}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-2.5 transition-all cursor-pointer ${
                  decision === 'recommend_skip_question'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 shrink-0 ${decision === 'recommend_skip_question' ? 'text-amber-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold block">Recommend Question Skip</span>
                  <span className="text-[10px] opacity-80">Debatable question: recommend admin skip for all candidates.</span>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Input for Recommended Marks */}
          {decision === 'recommend_accept' && (
            <div className="space-y-1.5 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60">
              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                <span>Recommended Revised Marks (Max: {challenge.questionMarks} Pts)</span>
                <span className="text-[11px] font-normal">Original: {challenge.originalMarksAwarded} Pts</span>
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="number"
                  min={0}
                  max={challenge.questionMarks}
                  step={0.5}
                  value={recommendedMarks}
                  onChange={(e) => setRecommendedMarks(parseFloat(e.target.value) || 0)}
                  className="w-32 text-sm font-bold px-3.5 py-2 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:outline-hidden"
                />
                <span className="text-xs text-emerald-800 dark:text-emerald-300">
                  {recommendedMarks > challenge.originalMarksAwarded
                    ? `+${(recommendedMarks - challenge.originalMarksAwarded).toFixed(1)} points proposed addition`
                    : 'Score adjustment proposed'}
                </span>
              </div>
            </div>
          )}

          {decision === 'recommend_skip_question' && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <span className="font-bold flex items-center space-x-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Question Debatability Policy:</span>
              </span>
              <p className="text-[11px] leading-relaxed">
                If approved by the Administrator, this question will be marked as debatable, full marks ({challenge.questionMarks} Pts) will be credited to all candidates, and scores will be rounded off to the next nearest integer.
              </p>
            </div>
          )}

          {/* Review Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Evaluator Subject-Matter Remarks for Administrator <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="State your technical evaluation, reason for recommended adjustment or question skip..."
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-purple-500 focus:outline-hidden"
            />
          </div>

          {/* Action Buttons */}
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
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-900/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting Review...' : 'Forward to Administrator'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
