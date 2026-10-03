import React, { useState } from 'react';
import { Exam, Question, Submission, ChallengeReason } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  HelpCircle,
  X,
  AlertCircle,
  Send,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Clock,
  UserCheck
} from 'lucide-react';

interface ChallengeQuestionModalProps {
  isOpen: boolean;
  question: Question | null;
  submission: Submission | null;
  exam: Exam | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ChallengeQuestionModal: React.FC<ChallengeQuestionModalProps> = ({
  isOpen,
  question,
  submission,
  exam,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState<ChallengeReason>('correct_marked_wrong');
  const [explanation, setExplanation] = useState('');
  const [supportingReference, setSupportingReference] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || !question || !submission || !exam) return null;

  const studentAns = submission.answers?.[question.id];
  const marksAwarded = studentAns?.marksObtained ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!explanation.trim()) {
      setError('Please provide a detailed justification or academic explanation for your challenge.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await examService.submitQuestionChallenge({
        examId: exam.id,
        examTitle: exam.title,
        submissionId: submission.id,
        questionId: question.id,
        questionTitle: question.title,
        questionType: question.type,
        questionMarks: question.marks,
        participantId: submission.participantId,
        participantName: submission.participantName,
        participantEmail: submission.participantEmail,
        candidateAnswer: studentAns?.answer || '(Unattempted)',
        originalMarksAwarded: marksAwarded,
        originalEvaluatorFeedback: studentAns?.evaluatorFeedback,
        challengeReason: reason,
        candidateExplanation: explanation.trim(),
        supportingReference: supportingReference.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to submit question challenge. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <HelpCircle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Challenge Question Evaluation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Official academic appeal for answer key or marking review
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
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

          {/* Question & Current Score Snapshot */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-0.5">
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {question.title}
                </span>
                <p className="text-[11px] text-slate-500">
                  {exam.title} • Subject: {exam.subject}
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs shrink-0">
                Awarded: {marksAwarded} / {question.marks} Pts
              </span>
            </div>

            {/* Candidate response & Evaluator note */}
            <div className="space-y-2 pt-1 border-t border-slate-200 dark:border-slate-700">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                  Your Submitted Response:
                </span>
                <div className="font-mono text-[11px] p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                  {studentAns?.answer || <span className="italic text-slate-400">Unattempted</span>}
                </div>
              </div>

              {studentAns?.evaluatorFeedback && (
                <div>
                  <span className="text-[10px] uppercase font-bold text-purple-500 block mb-0.5">
                    Evaluator's Feedback:
                  </span>
                  <div className="text-[11px] p-2.5 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 text-purple-900 dark:text-purple-200">
                    {studentAns.evaluatorFeedback}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reason for Challenge */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Primary Reason for Challenge <span className="text-rose-500">*</span>
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value as ChallengeReason)}
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            >
              <option value="correct_marked_wrong">Correct answer evaluated as incorrect</option>
              <option value="question_ambiguity">Ambiguity / typographical error in question text or options</option>
              <option value="marking_calculation_error">Marks calculation error or partial credit discrepancy</option>
              <option value="multiple_correct_options">Multiple options are technically valid / key discrepancy</option>
              <option value="other">Other academic or evaluation discrepancy</option>
            </select>
          </div>

          {/* Detailed Explanation */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Detailed Justification / Argument <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={4}
              value={explanation}
              onChange={(e) => setExplanation(e.target.value)}
              placeholder="Clearly explain why the answer key or evaluation is inaccurate. Include derivations, proof steps, or counter-examples..."
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
            />
          </div>

          {/* Academic Source / Citation */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span>Supporting Academic Reference / Textbook Citation</span>
              <span className="text-[10px] text-slate-400 font-normal">Optional</span>
            </label>
            <div className="relative">
              <BookOpen className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                value={supportingReference}
                onChange={(e) => setSupportingReference(e.target.value)}
                placeholder="e.g. Standard Textbook Name, Edition, Chapter 4, Page 112"
                className="w-full text-xs pl-9 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          {/* Visual Chain of Events Explanatory Stepper */}
          <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/70 dark:border-amber-900/40 space-y-2 text-xs text-amber-900 dark:text-amber-200">
            <div className="flex items-center space-x-1.5 font-bold text-amber-800 dark:text-amber-300">
              <ShieldCheck className="w-4 h-4 text-amber-600" />
              <span>Chain of Events After Submitting a Challenge:</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px] pt-1">
              <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-amber-200/50 dark:border-amber-900/40">
                <span className="font-bold text-amber-600 block">1. Lodged</span>
                <span>Challenge sent to evaluator review queue.</span>
              </div>
              <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-amber-200/50 dark:border-amber-900/40">
                <span className="font-bold text-amber-600 block">2. Evaluator Review</span>
                <span>Evaluator examines argument & recommends mark revision.</span>
              </div>
              <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-amber-200/50 dark:border-amber-900/40">
                <span className="font-bold text-amber-600 block">3. Admin Sign-off</span>
                <span>Administrator audits & authorizes final resolution.</span>
              </div>
              <div className="p-2 rounded-xl bg-white/70 dark:bg-slate-800/80 border border-amber-200/50 dark:border-amber-900/40">
                <span className="font-bold text-emerald-600 block">4. Scorecard Update</span>
                <span>Marks recalculated & scorecard endorsed.</span>
              </div>
            </div>
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
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-900/20 transition-all disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting Challenge...' : 'Submit Challenge Ticket'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
