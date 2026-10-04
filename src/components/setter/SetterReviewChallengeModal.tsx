import React, { useState } from 'react';
import { QuestionChallenge, ChallengeAttachment } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  BookOpen,
  X,
  AlertCircle,
  Send,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Check,
  Paperclip,
  FileText,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';

interface SetterReviewChallengeModalProps {
  isOpen: boolean;
  challenge: QuestionChallenge | null;
  setterId: string;
  setterName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const SetterReviewChallengeModal: React.FC<SetterReviewChallengeModalProps> = ({
  isOpen,
  challenge,
  setterId,
  setterName,
  onClose,
  onSuccess,
}) => {
  const [decision, setDecision] = useState<
    'recommend_alter_key' | 'uphold_original' | 'recommend_skip_question'
  >('uphold_original');
  const [proposedAnswer, setProposedAnswer] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [attachment, setAttachment] = useState<ChallengeAttachment | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (challenge) {
      setDecision('uphold_original');
      setProposedAnswer('');
      setReviewNotes('');
      setAttachment(undefined);
    }
  }, [challenge]);

  if (!isOpen || !challenge) return null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds 2MB limit. Please upload a smaller image or compressed PDF.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAttachment({
        name: file.name,
        type: file.type || 'application/octet-stream',
        dataUrl: reader.result as string,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewNotes.trim()) {
      setError('Please provide paper setter notes explaining your recommendation.');
      return;
    }

    if (decision === 'recommend_alter_key' && !proposedAnswer.trim()) {
      setError('Please provide the revised answer key that should be accepted.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await examService.setterReviewChallenge(challenge.id, {
        setterId,
        setterName,
        setterDecision: decision,
        setterProposedAnswer: decision === 'recommend_alter_key' ? proposedAnswer.trim() : undefined,
        setterReviewNotes: reviewNotes.trim(),
        setterAttachment: attachment,
      });

      // If recommending skip, also attach skip recommendation to the question
      if (decision === 'recommend_skip_question') {
        await examService.recommendSkipQuestion(
          challenge.examId,
          challenge.questionId,
          setterId,
          setterName,
          'paper_setter',
          reviewNotes.trim()
        );
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to submit setter challenge review.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-indigo-50/50 dark:bg-indigo-950/20">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Paper Setter Question & Key Review
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Author technical verification of question answer key and validity
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

          {/* Question & Challenge Snapshot */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="font-bold text-slate-900 dark:text-white text-sm">
                  {challenge.questionTitle}
                </span>
                <p className="text-[11px] text-slate-500">
                  Exam: {challenge.examTitle} • Question Type: {challenge.questionType?.toUpperCase()} ({challenge.questionMarks} Marks)
                </p>
              </div>
              <span className="px-2.5 py-1 rounded-lg font-mono font-bold bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-slate-200 shrink-0">
                Candidate Score: {challenge.originalMarksAwarded} / {challenge.questionMarks}
              </span>
            </div>

            {/* Candidate Submitted Response */}
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                Candidate Submitted Response:
              </span>
              <div className="font-mono text-[11px] p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-750 text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                {challenge.candidateAnswer || <span className="italic text-slate-400">Unattempted</span>}
              </div>
            </div>

            {/* Candidate Justification */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-slate-400">Candidate Stated Challenge:</span>
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
          </div>

          {/* Setter Recommendation Options */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Paper Setter Determination & Recommendation <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setDecision('uphold_original')}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-2.5 transition-all cursor-pointer ${
                  decision === 'uphold_original'
                    ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-950 dark:text-emerald-100 ring-2 ring-emerald-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <CheckCircle2 className={`w-5 h-5 shrink-0 ${decision === 'uphold_original' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold block">Uphold Answer Key</span>
                  <span className="text-[10px] opacity-80">Confirm that original question and answer key are 100% correct.</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setDecision('recommend_alter_key')}
                className={`p-3.5 rounded-2xl border text-left flex items-start space-x-2.5 transition-all cursor-pointer ${
                  decision === 'recommend_alter_key'
                    ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/30 text-indigo-950 dark:text-indigo-100 ring-2 ring-indigo-500/20'
                    : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                }`}
              >
                <RotateCcw className={`w-5 h-5 shrink-0 ${decision === 'recommend_alter_key' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <div>
                  <span className="font-bold block">Recommend Alter Key</span>
                  <span className="text-[10px] opacity-80">Propose revised correct key for all candidate scoring.</span>
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
                  <span className="font-bold block">Recommend Skip Question</span>
                  <span className="text-[10px] opacity-80">Question is debatable/defective: recommend skipping for all.</span>
                </div>
              </button>
            </div>
          </div>

          {/* Conditional Input for Altering Key */}
          {decision === 'recommend_alter_key' && (
            <div className="space-y-1.5 p-4 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800/60">
              <label className="text-xs font-bold text-indigo-900 dark:text-indigo-200">
                Proposed Correct Answer Key:
              </label>
              <input
                type="text"
                value={proposedAnswer}
                onChange={(e) => setProposedAnswer(e.target.value)}
                placeholder="e.g. Option B"
                className="w-full text-xs font-semibold px-3.5 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <p className="text-[11px] text-indigo-700 dark:text-indigo-300">
                If authorized by the Administrator, this updated key will be used to re-evaluate all candidates who attempted the exam.
              </p>
            </div>
          )}

          {decision === 'recommend_skip_question' && (
            <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-1">
              <span className="font-bold flex items-center space-x-1">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <span>Question Debatability Acknowledgment:</span>
              </span>
              <p className="text-[11px] leading-relaxed">
                As Paper Setter, acknowledging question ambiguity allows the Administrator to void the question and award full credit across all candidates, rounding scores to the next nearest integer.
              </p>
            </div>
          )}

          {/* Review Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
              Technical Justification / Setter Explanation <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="State the syllabus reference, derivation, or reason for key confirmation or revision..."
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            />
          </div>

          {/* Supporting Image / PDF Attachment */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center justify-between">
              <span className="flex items-center space-x-1">
                <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                <span>Attach Syllabus Page, Textbook Solution or PDF Proof (Optional)</span>
              </span>
              <span className="text-[10px] text-slate-400 font-normal">Max 2MB (.png, .jpg, .pdf)</span>
            </label>

            {attachment ? (
              <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2 truncate">
                  {attachment.type.includes('image') ? (
                    <ImageIcon className="w-4 h-4 text-indigo-600 shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                  )}
                  <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                    {attachment.name}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0">
                    ({Math.round((attachment.size || 0) / 1024)} KB)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setAttachment(undefined)}
                  className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                  title="Remove attachment"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <label className="flex items-center space-x-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs cursor-pointer transition-colors">
                <Paperclip className="w-3.5 h-3.5 text-indigo-600" />
                <span>Select Proof Image or PDF File...</span>
                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            )}
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
              className="flex items-center space-x-1.5 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-900/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <Check className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting Setter Review...' : 'Submit Key Verification'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
