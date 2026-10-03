import React from 'react';
import { QuestionChallenge } from '../../types/exam';
import {
  HelpCircle,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  ShieldCheck,
  BookOpen,
  ArrowRight,
  Award
} from 'lucide-react';

interface ChallengeDetailsModalProps {
  isOpen: boolean;
  challenge: QuestionChallenge | null;
  onClose: () => void;
}

export const ChallengeDetailsModal: React.FC<ChallengeDetailsModalProps> = ({
  isOpen,
  challenge,
  onClose,
}) => {
  if (!isOpen || !challenge) return null;

  const getStatusBadge = () => {
    switch (challenge.status) {
      case 'submitted':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center space-x-1.5">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Submitted • Awaiting Evaluator Review</span>
          </span>
        );
      case 'forwarded_to_admin':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 dark:bg-purple-950/60 text-purple-800 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center space-x-1.5">
            <UserCheck className="w-3.5 h-3.5 text-purple-600" />
            <span>Evaluator Reviewed • Awaiting Administrator Authorization</span>
          </span>
        );
      case 'resolved_accepted':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            <span>Challenge Accepted • Marks Revised to {challenge.finalAwardedMarks} Pts</span>
          </span>
        );
      case 'resolved_rejected':
        return (
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center space-x-1.5">
            <XCircle className="w-3.5 h-3.5 text-rose-600" />
            <span>Challenge Resolved • Original Mark Upheld ({challenge.originalMarksAwarded} Pts)</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getReasonLabel = (reason: string) => {
    switch (reason) {
      case 'correct_marked_wrong':
        return 'Correct answer evaluated as incorrect';
      case 'question_ambiguity':
        return 'Ambiguity / typographical error in question';
      case 'marking_calculation_error':
        return 'Marks calculation error / partial credit discrepancy';
      case 'multiple_correct_options':
        return 'Multiple options valid / key discrepancy';
      default:
        return 'Other academic discrepancy';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-850">
          <div className="space-y-1">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <HelpCircle className="w-5 h-5" />
              </span>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Question Challenge Dossier
              </h3>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
              Ticket ID: {challenge.id} • Exam: {challenge.examTitle}
            </p>
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
        <div className="p-6 space-y-5 text-xs">
          {/* Status banner */}
          <div className="flex items-center justify-between">
            {getStatusBadge()}
            <span className="text-[11px] text-slate-400">
              Submitted: {new Date(challenge.submittedAt).toLocaleString()}
            </span>
          </div>

          {/* Question Details */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <span className="font-bold text-sm text-slate-900 dark:text-white">
                  {challenge.questionTitle}
                </span>
                <p className="text-[11px] text-slate-500">
                  Question Max Weight: {challenge.questionMarks} Pts
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200">
                Awarded: {challenge.originalMarksAwarded} / {challenge.questionMarks} Pts
              </span>
            </div>

            {/* Candidate answer */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                Candidate's Submitted Response:
              </span>
              <div className="font-mono text-[11px] p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {challenge.candidateAnswer}
              </div>
            </div>
          </div>

          {/* Candidate Appeal & Argument */}
          <div className="p-4 rounded-2xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/50 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-900 dark:text-amber-300">
                Candidate Appeal & Justification
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/60 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300">
                {getReasonLabel(challenge.challengeReason)}
              </span>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-amber-200/40 dark:border-amber-900/30">
              "{challenge.candidateExplanation}"
            </p>
            {challenge.supportingReference && (
              <div className="flex items-center space-x-1.5 text-[11px] text-amber-800 dark:text-amber-400 pt-1">
                <BookOpen className="w-3.5 h-3.5 shrink-0" />
                <span className="font-semibold">Academic Reference:</span>
                <span>{challenge.supportingReference}</span>
              </div>
            )}
          </div>

          {/* Evaluator Review Section */}
          {challenge.evaluatorReviewedAt ? (
            <div className="p-4 rounded-2xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200/70 dark:border-purple-900/50 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-bold text-purple-900 dark:text-purple-300">
                  <UserCheck className="w-4 h-4 text-purple-600" />
                  <span>Evaluator Review & Recommendation ({challenge.evaluatorName || 'Academic Evaluator'})</span>
                </div>
                <span className="text-[10px] text-purple-500 font-medium">
                  {new Date(challenge.evaluatorReviewedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center space-x-3 text-xs">
                <span className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                  challenge.evaluatorDecision === 'recommend_accept'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                    : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                }`}>
                  {challenge.evaluatorDecision === 'recommend_accept'
                    ? `Recommended Revision: ${challenge.evaluatorRecommendedMarks} / ${challenge.questionMarks} Pts`
                    : 'Recommended Upholding Original Mark'}
                </span>
              </div>
              {challenge.evaluatorReviewNotes && (
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-purple-200/40 dark:border-purple-900/30">
                  "{challenge.evaluatorReviewNotes}"
                </p>
              )}
            </div>
          ) : (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 text-slate-500 flex items-center space-x-2">
              <Clock className="w-4 h-4 text-amber-500 animate-spin" />
              <span>Evaluator is currently reviewing the challenge submission.</span>
            </div>
          )}

          {/* Administrator Final Decision Section */}
          {challenge.resolvedAt ? (
            <div className={`p-4 rounded-2xl border space-y-2 ${
              challenge.adminDecision === 'accept_revision'
                ? 'bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800'
                : 'bg-rose-50/50 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1.5 font-bold text-slate-900 dark:text-white">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Institutional Administrator Final Authorization ({challenge.adminName || 'Admin'})</span>
                </div>
                <span className="text-[10px] text-slate-400">
                  {new Date(challenge.resolvedAt).toLocaleString()}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                  challenge.adminDecision === 'accept_revision'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-700 text-white'
                }`}>
                  {challenge.adminDecision === 'accept_revision'
                    ? `Official Final Marks: ${challenge.finalAwardedMarks} / ${challenge.questionMarks} Pts`
                    : 'Official Decision: Original Score Upheld'}
                </span>
              </div>
              {challenge.adminDecisionNotes && (
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-900/60 p-3 rounded-xl border border-slate-200 dark:border-slate-700">
                  "{challenge.adminDecisionNotes}"
                </p>
              )}
            </div>
          ) : (
            challenge.evaluatorReviewedAt && (
              <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800 text-purple-900 dark:text-purple-300 flex items-center space-x-2">
                <Clock className="w-4 h-4 text-purple-600" />
                <span>Forwarded to Institutional Administrator for final authorization and scorecard update.</span>
              </div>
            )
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-slate-850">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 transition-colors"
          >
            Close Dossier
          </button>
        </div>
      </div>
    </div>
  );
};
