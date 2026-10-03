import React, { useState, useEffect, useRef } from 'react';
import { Exam, Question, Submission } from '../../types/exam';
import { examService } from '../../services/examService';
import confetti from 'canvas-confetti';
import {
  Clock,
  AlertTriangle,
  Flag,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Send,
  Save,
  ShieldAlert,
  HelpCircle,
  Code2,
  FileCheck
} from 'lucide-react';

interface ExamTakingViewProps {
  exam: Exam;
  submission: Submission;
  questions: Question[];
  onFinish: (updatedSub: Submission) => void;
  onExit: () => void;
}

export const ExamTakingView: React.FC<ExamTakingViewProps> = ({
  exam,
  submission,
  questions,
  onFinish,
  onExit,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { answer: string; isFlagged: boolean }>>(() => {
    const initial: Record<string, { answer: string; isFlagged: boolean }> = {};
    for (const q of questions) {
      initial[q.id] = {
        answer: submission.answers?.[q.id]?.answer || '',
        isFlagged: submission.answers?.[q.id]?.isFlagged || false,
      };
    }
    return initial;
  });

  // Calculate remaining time from startedAt or duration
  const totalSeconds = (exam.durationMinutes || 45) * 60;
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (submission.startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(submission.startedAt).getTime()) / 1000);
      return Math.max(0, totalSeconds - elapsed);
    }
    return totalSeconds;
  });

  const [tabSwitches, setTabSwitches] = useState<number>(submission.tabSwitchCount || 0);
  const [showIntegrityAlert, setShowIntegrityAlert] = useState(false);
  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>('Just now');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      handleFinalSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Anti-cheat Window Blur / Tab Switch detection
  useEffect(() => {
    if (!exam.proctoringEnabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        setTabSwitches((prev) => {
          const updated = prev + 1;
          examService.saveDraftAnswer(submission.id, answers, updated);
          return updated;
        });
        setShowIntegrityAlert(true);
      }
    };

    const handleWindowBlur = () => {
      setTabSwitches((prev) => {
        const updated = prev + 1;
        examService.saveDraftAnswer(submission.id, answers, updated);
        return updated;
      });
      setShowIntegrityAlert(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [answers, exam.proctoringEnabled, submission.id]);

  // Periodic Auto-Save
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      examService.saveDraftAnswer(submission.id, answers, tabSwitches);
      setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 15000);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [answers, submission.id, tabSwitches]);

  const currentQ = questions[currentIdx] || null;

  const handleAnswerChange = (val: string) => {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        answer: val,
      },
    }));
  };

  const handleToggleFlag = () => {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        isFlagged: !prev[currentQ.id]?.isFlagged,
      },
    }));
  };

  const handleClearAnswer = () => {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        answer: '',
      },
    }));
  };

  const handleFinalSubmit = async () => {
    try {
      setSubmitting(true);
      const updatedSub = await examService.submitExam(
        submission.id,
        answers,
        exam,
        questions,
        tabSwitches
      );

      // Trigger Confetti!
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Safe fallback
      }

      onFinish(updatedSub);
    } catch (err: any) {
      console.error(err);
      alert('Error submitting exam: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const answeredCount = questions.filter((q) => answers[q.id]?.answer?.trim()).length;
  const flaggedCount = questions.filter((q) => answers[q.id]?.isFlagged).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900 flex flex-col overflow-hidden animate-in fade-in">
      {/* Top Proctored Header */}
      <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            EF
          </div>
          <div>
            <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1">
              {exam.title}
            </div>
            <div className="text-[11px] text-slate-500">
              Candidate: {submission.participantName} • Auto-saved: {lastSaved}
            </div>
          </div>
        </div>

        {/* Center: Live Timer */}
        <div className="flex items-center space-x-3">
          <div
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-full font-mono text-sm font-bold border transition-colors ${
              timeLeft < 300
                ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse'
                : timeLeft < 600
                ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTimer(timeLeft)}</span>
          </div>
        </div>

        {/* Right: Submit Button */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setSubmitConfirmOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/20 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Finish & Submit</span>
          </button>
        </div>
      </header>

      {/* Main Examination Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / Center Area: Question Canvas */}
        <main className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col justify-between">
          {currentQ ? (
            <div className="space-y-6">
              {/* Question Number & Points Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-3">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center">
                    {currentIdx + 1}
                  </span>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Question {currentIdx + 1} of {questions.length}
                    </span>
                    <span className="text-xs text-slate-400 ml-2">({currentQ.type.toUpperCase()})</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    {currentQ.marks} Marks
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleFlag}
                    className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      answers[currentQ.id]?.isFlagged
                        ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{answers[currentQ.id]?.isFlagged ? 'Flagged' : 'Flag for Review'}</span>
                  </button>
                </div>
              </div>

              {/* Question Statement */}
              <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-relaxed">
                {currentQ.title}
              </div>

              {/* Input Workspace based on question type */}
              <div className="pt-2">
                {/* MCQ Options */}
                {currentQ.type === 'mcq' && currentQ.options && (
                  <div className="space-y-3">
                    {currentQ.options.map((option, i) => {
                      const isSelected = answers[currentQ.id]?.answer === option;
                      return (
                        <div
                          key={i}
                          onClick={() => handleAnswerChange(option)}
                          className={`p-4 rounded-2xl border text-xs sm:text-sm font-medium cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-600 text-indigo-950 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-500 shadow-sm font-semibold'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span
                              className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 text-slate-500'
                              }`}
                            >
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span>{option}</span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Boolean Options */}
                {currentQ.type === 'boolean' && (
                  <div className="grid grid-cols-2 gap-4">
                    {['True', 'False'].map((val) => {
                      const isSelected = answers[currentQ.id]?.answer === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleAnswerChange(val)}
                          className={`p-5 rounded-2xl border text-sm font-bold transition-all ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Subjective Essay */}
                {currentQ.type === 'subjective' && (
                  <div className="space-y-2">
                    <textarea
                      rows={8}
                      placeholder="Type your comprehensive structured answer here..."
                      value={answers[currentQ.id]?.answer || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed font-sans shadow-xs"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Rich academic response field</span>
                      <span>
                        {(answers[currentQ.id]?.answer || '').trim().split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>
                  </div>
                )}

                {/* Code Practical Task */}
                {currentQ.type === 'code' && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-slate-500 font-mono">
                      <span>Code Workspace</span>
                      {currentQ.starterCode && (
                        <button
                          type="button"
                          onClick={() => handleAnswerChange(currentQ.starterCode || '')}
                          className="text-indigo-600 hover:underline"
                        >
                          Reset to starter code
                        </button>
                      )}
                    </div>
                    <textarea
                      rows={10}
                      placeholder="Write code solution here..."
                      value={answers[currentQ.id]?.answer || currentQ.starterCode || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      className="w-full p-4 rounded-2xl border border-slate-300 dark:border-slate-700 bg-slate-900 text-emerald-400 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-inner"
                    />
                  </div>
                )}
              </div>

              {/* Bottom Navigation Toolbar */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleClearAnswer}
                  className="text-xs text-slate-500 hover:text-rose-600 transition-colors"
                >
                  Clear Selection
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    disabled={currentIdx === 0}
                    onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                    className="flex items-center space-x-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <button
                    type="button"
                    disabled={currentIdx === questions.length - 1}
                    onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                    className="flex items-center space-x-1 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-40 shadow-xs"
                  >
                    <span>Next Question</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400">Loading exam question...</div>
          )}
        </main>

        {/* Right Rail: Questions Palette Grid */}
        <aside className="w-72 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-5 hidden md:flex flex-col justify-between shrink-0">
          <div className="space-y-5">
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                Question Palette
              </h3>
              <p className="text-xs text-slate-500">Jump directly to any question</p>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-4 gap-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIdx;
                const isAnswered = Boolean(answers[q.id]?.answer?.trim());
                const isFlagged = Boolean(answers[q.id]?.isFlagged);

                let bgClasses = 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
                if (isAnswered) {
                  bgClasses = 'bg-emerald-500 text-white font-bold shadow-xs';
                }
                if (isFlagged) {
                  bgClasses = 'bg-amber-500 text-white font-bold';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    className={`h-10 rounded-xl text-xs font-bold transition-all relative ${bgClasses} ${
                      isCurrent ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
                    }`}
                  >
                    {idx + 1}
                    {isFlagged && (
                      <span className="w-2 h-2 rounded-full bg-amber-200 absolute top-1 right-1" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="space-y-2 text-xs pt-4 border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                <span className="w-3 h-3 rounded bg-emerald-500 shrink-0" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                <span className="w-3 h-3 rounded bg-amber-500 shrink-0" />
                <span>Flagged for Review ({flaggedCount})</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                <span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700 shrink-0" />
                <span>Unanswered ({questions.length - answeredCount})</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setSubmitConfirmOpen(true)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors"
            >
              Submit Examination
            </button>
          </div>
        </aside>
      </div>

      {/* Integrity Alert Modal (Proctoring Violation) */}
      {showIntegrityAlert && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 text-center space-y-4 border border-amber-300 dark:border-amber-800 shadow-2xl">
            <div className="w-12 h-12 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Proctoring Integrity Warning
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                A window focus loss or browser tab switch was detected. This incident has been logged onto your submission record (Total strikes: <span className="font-bold text-rose-600">{tabSwitches}</span>).
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowIntegrityAlert(false)}
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold transition-all"
            >
              I Understand & Resume Examination
            </button>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {submitConfirmOpen && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="flex items-center space-x-3">
              <span className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <FileCheck className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Final Exam Submission
                </h3>
                <p className="text-xs text-slate-500">Review your test progress before submitting</p>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Answered Questions:</span>
                <span className="font-bold text-emerald-600">{answeredCount} of {questions.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Flagged for Review:</span>
                <span className="font-bold text-amber-600">{flaggedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Unanswered Questions:</span>
                <span className="font-bold text-slate-700 dark:text-slate-300">{questions.length - answeredCount}</span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Once submitted, your answers will be locked and routed for objective auto-scoring and manual evaluation.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSubmitConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                Back to Exam
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 transition-all"
              >
                {submitting ? 'Submitting...' : 'Yes, Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
