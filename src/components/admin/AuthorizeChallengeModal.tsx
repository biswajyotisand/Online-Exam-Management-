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
  FileCheck,
  AlertTriangle,
  RotateCcw,
  Users,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Download
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
  const [decision, setDecision] = useState<
    'accept_revision' | 'uphold_original' | 'alter_key_all' | 'approve_skip_all'
  >('accept_revision');
  const [finalMarks, setFinalMarks] = useState<number>(0);
  const [newCorrectAnswer, setNewCorrectAnswer] = useState<string>('');
  const [adminNotes, setAdminNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (challenge) {
      const isRecommendAccept = challenge.evaluatorDecision === 'recommend_accept';
      const isRecommendSkip = challenge.setterDecision === 'recommend_skip_question' || challenge.evaluatorDecision === 'recommend_skip_question';
      const isRecommendAlterKey = challenge.setterDecision === 'recommend_alter_key';

      if (isRecommendSkip) {
        setDecision('approve_skip_all');
      } else if (isRecommendAlterKey) {
        setDecision('alter_key_all');
        setNewCorrectAnswer(challenge.setterProposedAnswer || '');
      } else if (isRecommendAccept) {
        setDecision('accept_revision');
      } else {
        setDecision('uphold_original');
      }

      setFinalMarks(
        challenge.evaluatorRecommendedMarks !== undefined
          ? challenge.evaluatorRecommendedMarks
          : challenge.originalMarksAwarded
      );
      setAdminNotes(
        isRecommendSkip
          ? 'Approved skipping debatable question following academic board recommendation. Total marks and passing marks decreased proportionately across the exam.'
          : isRecommendAlterKey
          ? `Altered answer key to "${challenge.setterProposedAnswer || 'revised option'}" following Paper Setter review. Re-scored across all candidates.`
          : isRecommendAccept
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

    setSubmitting(true);
    setError(null);
    try {
      if (decision === 'alter_key_all') {
        if (!newCorrectAnswer.trim()) {
          setError('Please specify the new correct answer key to re-score all candidates.');
          setSubmitting(false);
          return;
        }

        // Alter answer key across all candidates (excluding descriptive answers)
        const res = await examService.alterAnswerKeyAndReScoreAll(
          challenge.examId,
          challenge.questionId,
          newCorrectAnswer.trim(),
          adminId,
          adminName,
          adminNotes.trim()
        );

        // Also mark this challenge ticket as resolved
        await examService.adminResolveChallenge(challenge.id, {
          adminId,
          adminName,
          decision: 'accept_revision',
          finalAwardedMarks: challenge.questionMarks,
          adminNotes: `[Answer Key Altered]: ${adminNotes.trim()} (${res.affectedCount} candidates who attempted re-scored: ${res.increasedCount} increased, ${res.decreasedCount} decreased, ${res.unattemptedCount} unattempted kept at 0).`,
        });

        alert(`Answer key updated to "${newCorrectAnswer.trim()}". Out of ${res.affectedCount + res.unattemptedCount} candidates, ${res.affectedCount} who attempted this question had marks updated (${res.increasedCount} increased, ${res.decreasedCount} decreased, and ${res.unattemptedCount} unattempted remained at 0 marks)!`);
      } else if (decision === 'approve_skip_all') {
        // Approve skip of question for all candidates
        const res = await examService.approveSkipQuestionAndReScoreAll(
          challenge.examId,
          challenge.questionId,
          adminId,
          adminName,
          adminNotes.trim()
        );

        // Mark this challenge ticket as resolved
        await examService.adminResolveChallenge(challenge.id, {
          adminId,
          adminName,
          decision: 'accept_revision',
          finalAwardedMarks: 0,
          adminNotes: `[Debatable Question Skipped]: ${adminNotes.trim()} (Question excluded from exam scoring; exam total marks and passing marks reduced proportionately. Baseline data, marks, scorecard, and answer sheets before challenge preserved for audit).`,
        });

        alert(`Debatable question "${challenge.questionTitle}" skipped successfully!\n\n• Exam total marks decreased by ${challenge.questionMarks} points\n• Passing marks decreased proportionately\n• Evaluated candidate submissions recalculated\n• Pre-challenge scorecards, data, marks, and answer sheets preserved for Administrator audit.`);
      } else {
        // Standard resolution for single candidate
        await examService.adminResolveChallenge(challenge.id, {
          adminId,
          adminName,
          decision,
          finalAwardedMarks: decision === 'accept_revision' ? Number(finalMarks) : challenge.originalMarksAwarded,
          adminNotes: adminNotes.trim(),
        });
      }

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
                Institutional determination, setter review integration & global candidate re-scoring
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

            {/* Candidate Response & Explanation */}
            <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Candidate Argument:</span>
                <span className="text-[10px] text-amber-600 font-bold uppercase">{challenge.challengeReason.replace(/_/g, ' ')}</span>
              </div>
              <p className="text-slate-800 dark:text-slate-200 italic leading-relaxed">
                "{challenge.candidateExplanation}"
              </p>
              {challenge.supportingReference && (
                <div className="text-[11px] text-slate-500 pt-1">
                  <strong>Academic Reference:</strong> {challenge.supportingReference}
                </div>
              )}
              {challenge.candidateAttachment && (
                <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-1.5 truncate">
                    {challenge.candidateAttachment.type.includes('image') ? (
                      <ImageIcon className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    ) : (
                      <FileText className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                    )}
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                      Candidate Proof: {challenge.candidateAttachment.name}
                    </span>
                  </div>
                  <a
                    href={challenge.candidateAttachment.dataUrl}
                    download={challenge.candidateAttachment.name}
                    className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-indigo-600 font-semibold text-[11px] flex items-center space-x-1"
                  >
                    <Download className="w-3 h-3" />
                    <span>View / Download</span>
                  </a>
                </div>
              )}
            </div>

            {/* Paper Setter's Recommendation Section (Since Paper Setter authored the question and selected key) */}
            {challenge.setterReviewedAt ? (
              <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 space-y-1 text-xs">
                <div className="flex items-center justify-between text-indigo-900 dark:text-indigo-200">
                  <span className="font-bold flex items-center space-x-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Paper Setter Recommendation ({challenge.setterName || 'Designated Setter'}):</span>
                  </span>
                  <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                    {challenge.setterDecision === 'recommend_alter_key'
                      ? 'Recommend Alter Answer Key'
                      : challenge.setterDecision === 'recommend_skip_question'
                      ? 'Recommend Question Skip (Debatable)'
                      : 'Uphold Original Key'}
                  </span>
                </div>
                {challenge.setterProposedAnswer && (
                  <div className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
                    Setter Proposed Correct Key: "{challenge.setterProposedAnswer}"
                  </div>
                )}
                {challenge.setterReviewNotes && (
                  <p className="text-slate-700 dark:text-slate-300 text-xs italic">
                    "{challenge.setterReviewNotes}"
                  </p>
                )}
                {challenge.setterAttachment && (
                  <div className="mt-1 pt-1.5 border-t border-indigo-100 dark:border-indigo-850 flex items-center justify-between text-xs">
                    <span className="font-semibold text-indigo-900 dark:text-indigo-300 truncate">
                      Setter Proof: {challenge.setterAttachment.name}
                    </span>
                    <a
                      href={challenge.setterAttachment.dataUrl}
                      download={challenge.setterAttachment.name}
                      className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-indigo-600 font-semibold text-[11px] flex items-center space-x-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-[11px] text-slate-400 italic">
                Paper Setter review pending or bypassed.
              </div>
            )}

            {/* Evaluator's Recommendation */}
            {challenge.evaluatorReviewedAt && (
              <div className="p-3 rounded-xl bg-purple-50/60 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60 space-y-1 text-xs">
                <div className="flex items-center justify-between text-purple-900 dark:text-purple-200">
                  <span className="font-bold flex items-center space-x-1.5">
                    <UserCheck className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    <span>Evaluator Recommendation ({challenge.evaluatorName || 'Academic Evaluator'}):</span>
                  </span>
                  <span className="font-bold uppercase text-[10px] px-2 py-0.5 rounded bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200">
                    {challenge.evaluatorDecision === 'recommend_accept'
                      ? `Revise to ${challenge.evaluatorRecommendedMarks} Pts`
                      : challenge.evaluatorDecision === 'recommend_skip_question'
                      ? 'Recommend Question Skip'
                      : 'Uphold Original'}
                  </span>
                </div>
                {challenge.evaluatorReviewNotes && (
                  <p className="text-slate-700 dark:text-slate-300 text-xs italic">
                    "{challenge.evaluatorReviewNotes}"
                  </p>
                )}
                {challenge.evaluatorAttachment && (
                  <div className="mt-1 pt-1.5 border-t border-purple-100 dark:border-purple-850 flex items-center justify-between text-xs">
                    <span className="font-semibold text-purple-900 dark:text-purple-300 truncate">
                      Evaluator Reference: {challenge.evaluatorAttachment.name}
                    </span>
                    <a
                      href={challenge.evaluatorAttachment.dataUrl}
                      download={challenge.evaluatorAttachment.name}
                      className="px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-purple-600 font-semibold text-[11px] flex items-center space-x-1"
                    >
                      <Download className="w-3 h-3" />
                      <span>Download</span>
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Admin Decision Options */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Administrator Final Determination & Scope <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setDecision('accept_revision')}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-3 transition-all cursor-pointer ${
                  decision === 'accept_revision'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${decision === 'accept_revision' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold block">1. Revise Marks (Candidate Only)</span>
                  <span className="text-[11px] opacity-80">Approve score adjustment for this specific candidate appeal.</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecision('uphold_original')}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-3 transition-all cursor-pointer ${
                  decision === 'uphold_original'
                    ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30 text-rose-950 dark:text-rose-100 ring-2 ring-rose-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <XCircle className={`w-5 h-5 shrink-0 ${decision === 'uphold_original' ? 'text-rose-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold block">2. Uphold Original Score</span>
                  <span className="text-[11px] opacity-80">Dismiss challenge appeal and maintain existing evaluation mark.</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecision('alter_key_all')}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-3 transition-all cursor-pointer ${
                  decision === 'alter_key_all'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <Users className={`w-5 h-5 shrink-0 ${decision === 'alter_key_all' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold block">3. Alter Answer Key (Attempted Candidates)</span>
                  <span className="text-[11px] opacity-80">Modify key: numbers increased/decreased strictly for candidates who attempted the question.</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecision('approve_skip_all')}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-3 transition-all cursor-pointer ${
                  decision === 'approve_skip_all'
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-950/30 text-amber-950 dark:text-amber-100 ring-2 ring-amber-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <AlertTriangle className={`w-5 h-5 shrink-0 ${decision === 'approve_skip_all' ? 'text-amber-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold block">4. Skip Debatable Question</span>
                  <span className="text-[11px] opacity-80">Decreases exam total marks and proportionately lowers passing marks; all candidates re-evaluated without question; pre-challenge baseline preserved.</span>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Input based on decision */}
          {decision === 'accept_revision' && (
            <div className="space-y-1.5 p-4 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/60">
              <label className="text-xs font-bold text-emerald-900 dark:text-emerald-200 flex items-center justify-between">
                <span>Final Authorized Marks for Candidate (Max: {challenge.questionMarks} Pts)</span>
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
                    ? `+${(finalMarks - challenge.originalMarksAwarded).toFixed(1)} points added to candidate scorecard`
                    : 'Adjustment applied to candidate'}
                </span>
              </div>
            </div>
          )}

          {decision === 'alter_key_all' && (
            <div className="space-y-2 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60">
              <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                New Correct Answer Key (Will re-score all candidate objective submissions):
              </label>
              <input
                type="text"
                value={newCorrectAnswer}
                onChange={(e) => setNewCorrectAnswer(e.target.value)}
                placeholder="e.g. Option B"
                className="w-full text-xs font-semibold px-3.5 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                Note: Evaluated descriptive and code questions will remain unaffected. All matching MCQ and boolean answers will be automatically updated across all candidate scorecards.
              </p>
            </div>
          )}

          {decision === 'approve_skip_all' && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <span className="font-bold flex items-center space-x-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Debatable Question Skipping Rule:</span>
              </span>
              <p className="text-[11px] leading-relaxed">
                Full marks ({challenge.questionMarks} marks) will be awarded to all candidates who attempted the exam. Each candidate's score will be recalculated and rounded off to the next nearest integer.
              </p>
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

          {/* Actions */}
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
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{submitting ? 'Authorizing & Re-scoring...' : 'Authorize Determination & Apply Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
