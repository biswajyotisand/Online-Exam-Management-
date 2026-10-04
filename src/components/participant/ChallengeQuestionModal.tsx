import React, { useState, useEffect } from 'react';
import { Exam, Question, Submission, ChallengeReason, ChallengeAttachment } from '../../types/exam';
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
  UserCheck,
  AlertTriangle,
  Lock,
  Calendar,
  CheckSquare,
  Paperclip,
  Image as ImageIcon,
  Trash2
} from 'lucide-react';

interface ChallengeQuestionModalProps {
  isOpen: boolean;
  question?: Question | null;
  allQuestions?: Question[];
  submission: Submission | null;
  exam: Exam | null;
  onClose: () => void;
  onSuccess: () => void;
}

export const ChallengeQuestionModal: React.FC<ChallengeQuestionModalProps> = ({
  isOpen,
  question,
  allQuestions = [],
  submission,
  exam,
  onClose,
  onSuccess,
}) => {
  const [selectedQuestionIds, setSelectedQuestionIds] = useState<string[]>([]);
  const [challengeData, setChallengeData] = useState<
    Record<string, { reason: ChallengeReason; explanation: string; supportingReference: string; attachment?: ChallengeAttachment }>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Available questions pool: either passed in allQuestions or singleton question
  const questionsPool = allQuestions.length > 0 ? allQuestions : question ? [question] : [];

  // File upload handler
  const handleFileUpload = (qId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('File size exceeds 2MB limit. Please upload a smaller image or compressed PDF.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      setChallengeData((prev) => ({
        ...prev,
        [qId]: {
          ...(prev[qId] || { reason: 'correct_marked_wrong', explanation: '', supportingReference: '' }),
          attachment: {
            name: file.name,
            type: file.type || 'application/octet-stream',
            dataUrl,
            size: file.size,
          },
        },
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeAttachment = (qId: string) => {
    setChallengeData((prev) => ({
      ...prev,
      [qId]: {
        ...(prev[qId] || { reason: 'correct_marked_wrong', explanation: '', supportingReference: '' }),
        attachment: undefined,
      },
    }));
  };

  // Initialize selected questions on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      if (question) {
        setSelectedQuestionIds([question.id]);
        setChallengeData((prev) => ({
          ...prev,
          [question.id]: prev[question.id] || {
            reason: 'correct_marked_wrong',
            explanation: '',
            supportingReference: '',
          },
        }));
      } else if (questionsPool.length > 0 && selectedQuestionIds.length === 0) {
        // Default to first question if none selected
        setSelectedQuestionIds([questionsPool[0].id]);
        setChallengeData((prev) => ({
          ...prev,
          [questionsPool[0].id]: {
            reason: 'correct_marked_wrong',
            explanation: '',
            supportingReference: '',
          },
        }));
      }
    }
  }, [isOpen, question]);

  if (!isOpen || !submission || !exam) return null;

  // Deadline & Single Submission Enforcement
  const isDeadlinePassed = exam.challengeDeadline
    ? new Date() > new Date(exam.challengeDeadline)
    : false;

  const isAlreadySubmitted = Boolean(submission.challengeSubmitted);

  const toggleQuestionSelection = (qId: string) => {
    setSelectedQuestionIds((prev) => {
      const isSelected = prev.includes(qId);
      if (isSelected) {
        return prev.filter((id) => id !== qId);
      } else {
        // Add question and initialize its data
        setChallengeData((d) => ({
          ...d,
          [qId]: d[qId] || {
            reason: 'correct_marked_wrong',
            explanation: '',
            supportingReference: '',
          },
        }));
        return [...prev, qId];
      }
    });
  };

  const updateItemData = (
    qId: string,
    field: 'reason' | 'explanation' | 'supportingReference',
    value: string
  ) => {
    setChallengeData((prev) => ({
      ...prev,
      [qId]: {
        ...(prev[qId] || { reason: 'correct_marked_wrong', explanation: '', supportingReference: '' }),
        [field]: value,
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (isDeadlinePassed) {
      setError('The scheduled challenge deadline has passed. Under regulations, no one can challenge questions after the deadline.');
      return;
    }

    if (isAlreadySubmitted) {
      setError('Challenges have already been submitted for this exam. Regulations require challenge submission at a single time.');
      return;
    }

    if (selectedQuestionIds.length === 0) {
      setError('Please select at least one question to challenge.');
      return;
    }

    // Validate that each selected question has an explanation
    for (const qId of selectedQuestionIds) {
      const item = challengeData[qId];
      const qObj = questionsPool.find((q) => q.id === qId);
      if (!item || !item.explanation?.trim()) {
        setError(`Please provide an academic justification/explanation for Question "${qObj?.title || qId}".`);
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const batchItems = selectedQuestionIds.map((qId) => {
        const qObj = questionsPool.find((q) => q.id === qId);
        const studentAns = submission.answers?.[qId];
        const item = challengeData[qId] || {
          reason: 'correct_marked_wrong',
          explanation: '',
          supportingReference: '',
        };

        return {
          questionId: qId,
          questionTitle: qObj?.title || 'Question item',
          questionType: qObj?.type,
          questionMarks: qObj?.marks || 0,
          candidateAnswer: studentAns?.answer || '(Unattempted)',
          originalMarksAwarded: studentAns?.marksObtained ?? 0,
          originalEvaluatorFeedback: studentAns?.evaluatorFeedback,
          challengeReason: item.reason,
          candidateExplanation: item.explanation.trim(),
          supportingReference: item.supportingReference?.trim() || undefined,
          candidateAttachment: item.attachment,
        };
      });

      await examService.submitBatchChallenges(
        submission.id,
        exam.id,
        exam.title,
        submission.participantId,
        submission.participantName,
        submission.participantEmail,
        batchItems
      );

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to submit challenges. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100 dark:border-slate-800 bg-amber-50/60 dark:bg-amber-950/20">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              <HelpCircle className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Official Answer Key & Question Challenge
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Lodge formal academic appeals for questions of {exam.title}
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
        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 flex items-center space-x-2.5 text-xs text-rose-700 dark:text-rose-300">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Condition 1: Already Submitted Banner (Single Time Enforcement) */}
          {isAlreadySubmitted ? (
            <div className="p-5 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
                <CheckSquare className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-indigo-950 dark:text-indigo-200">
                Challenges Already Lodged (Single Submission Completed)
              </h4>
              <p className="text-xs text-indigo-900/80 dark:text-indigo-300/80 max-w-lg mx-auto leading-relaxed">
                In accordance with Examination Regulations, candidates can challenge answers of question(s) <strong>at a single time</strong>. Your challenge dossier was submitted on{' '}
                <span className="font-semibold">
                  {submission.challengeSubmittedAt ? new Date(submission.challengeSubmittedAt).toLocaleString() : 'earlier'}
                </span>
                . It is currently under review by the Paper Setter and Evaluator.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  Close & View Scorecard
                </button>
              </div>
            </div>
          ) : isDeadlinePassed ? (
            /* Condition 2: Deadline Expired Banner */
            <div className="p-5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-center space-y-3">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
                <Lock className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-rose-950 dark:text-rose-200">
                Challenge Submission Window Expired
              </h4>
              <p className="text-xs text-rose-900/80 dark:text-rose-300/80 max-w-lg mx-auto leading-relaxed">
                The scheduled date & time set by the Administrator expired on{' '}
                <span className="font-semibold">
                  {exam.challengeDeadline ? new Date(exam.challengeDeadline).toLocaleString() : 'the cutoff time'}
                </span>
                . On expiry of the scheduled date & time, no candidate can challenge any question.
              </p>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs"
                >
                  Acknowledge & Close
                </button>
              </div>
            </div>
          ) : (
            /* Condition 3: Active Challenge Form */
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Policy & Deadline Info Box */}
              <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 flex items-start space-x-3 text-xs">
                <Calendar className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-bold text-amber-900 dark:text-amber-200">
                      Challenge Window Active
                    </span>
                    {exam.challengeDeadline && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-200 dark:bg-amber-900/60 text-amber-900 dark:text-amber-200 font-mono text-[10px] font-semibold">
                        Deadline: {new Date(exam.challengeDeadline).toLocaleString()}
                      </span>
                    )}
                  </div>
                  <p className="text-amber-800/90 dark:text-amber-300/90 text-[11px] leading-relaxed">
                    <strong>Rule:</strong> You may challenge any answer(s) of question(s) up to the scheduled deadline and <strong>at a single time</strong>. Select all the questions you wish to dispute and submit your dossier together. Re-submission will be locked after this.
                  </p>
                </div>
              </div>

              {/* Step 1: Select Questions to Challenge */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Step 1: Select Questions to Challenge ({selectedQuestionIds.length} Selected)
                  </label>
                  <span className="text-[11px] text-slate-400">
                    Tick all questions you want to dispute
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-2xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {questionsPool.map((q, idx) => {
                    const isSelected = selectedQuestionIds.includes(q.id);
                    const studentAns = submission.answers?.[q.id];
                    const marks = studentAns?.marksObtained ?? 0;

                    return (
                      <div
                        key={q.id}
                        onClick={() => toggleQuestionSelection(q.id)}
                        className={`p-3 flex items-start space-x-3 cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-amber-50/80 dark:bg-amber-950/30'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-850'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by parent onClick
                          className="mt-1 rounded text-amber-600 focus:ring-amber-500 h-4 w-4 border-slate-300"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
                              Q{idx + 1}. {q.title}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-mono">
                              {q.type}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 text-[11px] text-slate-500">
                            <span>Your Answer: <span className="font-mono font-medium text-slate-700 dark:text-slate-300 truncate max-w-xs">{studentAns?.answer || '(None)'}</span></span>
                            <span>Score: <span className="font-bold text-slate-700 dark:text-slate-300">{marks} / {q.marks} Pts</span></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Step 2: Fill Details for Each Selected Question */}
              <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block">
                  Step 2: Provide Academic Grounds for Selected Questions
                </label>

                {selectedQuestionIds.length === 0 ? (
                  <div className="p-6 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400">
                    No questions selected above. Please select one or more questions to dispute.
                  </div>
                ) : (
                  selectedQuestionIds.map((qId, qIdx) => {
                    const qObj = questionsPool.find((q) => q.id === qId);
                    const itemData = challengeData[qId] || {
                      reason: 'correct_marked_wrong',
                      explanation: '',
                      supportingReference: '',
                    };

                    return (
                      <div
                        key={qId}
                        className="p-4 rounded-2xl border border-amber-200 dark:border-amber-800/80 bg-slate-50/50 dark:bg-slate-850/50 space-y-3"
                      >
                        <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                          <span className="font-bold text-xs text-slate-900 dark:text-white">
                            Challenge #{qIdx + 1}: {qObj?.title || qId} ({qObj?.marks || 0} Pts)
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleQuestionSelection(qId)}
                            className="text-rose-500 hover:text-rose-700 text-[11px] font-semibold"
                          >
                            Remove
                          </button>
                        </div>

                        {/* Reason Selector */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Grounds / Reason for Challenge
                          </label>
                          <select
                            value={itemData.reason}
                            onChange={(e) =>
                              updateItemData(qId, 'reason', e.target.value as ChallengeReason)
                            }
                            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                          >
                            <option value="correct_marked_wrong">
                              Candidate Answer is Correct / Evaluated Wrongly
                            </option>
                            <option value="question_ambiguity">
                              Question Ambiguity / Flawed Prompt
                            </option>
                            <option value="multiple_correct_options">
                              Multiple Correct Options (Debatable Key)
                            </option>
                            <option value="marking_calculation_error">
                              Marking / Calculation Discrepancy
                            </option>
                            <option value="other">
                              Other Academic Grounds
                            </option>
                          </select>
                        </div>

                        {/* Explanation */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Academic Explanation & Proof <span className="text-rose-500">*</span>
                          </label>
                          <textarea
                            rows={3}
                            placeholder="Explain step-by-step why the key is wrong or why full marks should be awarded..."
                            value={itemData.explanation}
                            onChange={(e) => updateItemData(qId, 'explanation', e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                            required
                          />
                        </div>

                        {/* Supporting Reference */}
                        <div>
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                            Textbook / Standard Reference Citation (Optional)
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Standard Operating Procedure Ch. 4, Pg. 12"
                            value={itemData.supportingReference}
                            onChange={(e) => updateItemData(qId, 'supportingReference', e.target.value)}
                            className="w-full p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                          />
                        </div>

                        {/* Image / PDF Attachment Upload */}
                        <div className="space-y-1.5 pt-1">
                          <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 flex items-center justify-between">
                            <span className="flex items-center space-x-1">
                              <Paperclip className="w-3.5 h-3.5 text-amber-600" />
                              <span>Attach Image or PDF Proof (Optional)</span>
                            </span>
                            <span className="text-[10px] text-slate-400 font-normal">Max 2MB (.png, .jpg, .pdf)</span>
                          </label>

                          {itemData.attachment ? (
                            <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex items-center justify-between text-xs">
                              <div className="flex items-center space-x-2 truncate">
                                {itemData.attachment.type.includes('image') ? (
                                  <ImageIcon className="w-4 h-4 text-amber-600 shrink-0" />
                                ) : (
                                  <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                                )}
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {itemData.attachment.name}
                                </span>
                                <span className="text-[10px] text-slate-400 shrink-0">
                                  ({Math.round((itemData.attachment.size || 0) / 1024)} KB)
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeAttachment(qId)}
                                className="p-1 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                                title="Remove attachment"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ) : (
                            <label className="flex items-center space-x-2 px-3 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-amber-400 dark:hover:border-amber-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 text-xs cursor-pointer transition-colors">
                              <Paperclip className="w-3.5 h-3.5 text-amber-600" />
                              <span>Select Image or PDF File...</span>
                              <input
                                type="file"
                                accept="image/*,.pdf"
                                onChange={(e) => handleFileUpload(qId, e)}
                                className="hidden"
                              />
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Submission is final and locked once sent.</span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || selectedQuestionIds.length === 0}
                    className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-900/20 disabled:opacity-50 transition-all cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {submitting
                        ? 'Submitting Single Dossier...'
                        : `Submit Official Challenge (${selectedQuestionIds.length} Qs)`}
                    </span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
