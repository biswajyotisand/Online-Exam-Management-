import React, { useEffect, useState } from 'react';
import { Exam, Question, Submission } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  FileText,
  Printer,
  X,
  CheckCircle2,
  Clock,
  User,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  Hash
} from 'lucide-react';

interface ExamAttemptSlipModalProps {
  submission: Submission;
  exam: Exam | null;
  questions?: Question[];
  onClose: () => void;
}

export const ExamAttemptSlipModal: React.FC<ExamAttemptSlipModalProps> = ({
  submission,
  exam,
  questions: initialQuestions = [],
  onClose,
}) => {
  const [questions, setQuestions] = useState<Question[]>(initialQuestions);
  const [loading, setLoading] = useState(initialQuestions.length === 0);

  useEffect(() => {
    if (initialQuestions.length > 0) {
      setQuestions(initialQuestions);
      setLoading(false);
    } else if (submission.examId) {
      setLoading(true);
      examService
        .getQuestions(submission.examId)
        .then((qList) => setQuestions(qList))
        .catch((err) => console.error('Failed to load questions for slip:', err))
        .finally(() => setLoading(false));
    }
  }, [initialQuestions, submission.examId]);

  const handlePrint = () => {
    window.print();
  };

  const totalQuestions = questions.length;
  let attemptedCount = 0;
  let unattemptedCount = 0;
  let compulsoryTotal = 0;
  let compulsoryAttempted = 0;

  for (const q of questions) {
    const ans = submission.answers?.[q.id]?.answer;
    const isAtt = Boolean(ans && ans.trim().length > 0);
    if (isAtt) {
      attemptedCount++;
    } else {
      unattemptedCount++;
    }
    if (q.isMandatory) {
      compulsoryTotal++;
      if (isAtt) compulsoryAttempted++;
    }
  }

  const formattedSubmittedAt = submission.submittedAt
    ? new Date(submission.submittedAt).toLocaleString()
    : new Date().toLocaleString();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-850 rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 my-8 overflow-hidden print:m-0 print:border-none print:shadow-none print:w-full print:max-w-none">
        {/* Modal Top Bar (Hidden during print) */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 print:hidden">
          <div className="flex items-center space-x-2">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Official Examination Response & Attempt Slip
              </h3>
              <p className="text-xs text-slate-500">
                Institutional Candidate Response Record • Results Withheld as per Academic Policy
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Download Slip</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Official Slip Content */}
        <div className="p-6 sm:p-8 space-y-6 max-h-[82vh] overflow-y-auto print:max-h-none print:p-0 print:overflow-visible text-slate-900 dark:text-slate-100">
          {/* Institutional Header Slip */}
          <div className="border-b-2 border-slate-900 dark:border-slate-400 pb-5 text-center space-y-2">
            <div className="inline-flex items-center space-x-1.5 text-xs font-extrabold uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-4 h-4" />
              <span>Online Examination System • Official Academic Assessment</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
              CANDIDATE RESPONSE & ATTEMPT SLIP
            </h1>
            <p className="text-xs text-slate-500 max-w-xl mx-auto">
              This document serves as the official verifiable acknowledgment of answers submitted by the candidate. Examination scores and evaluations are withheld and will be released separately by the institutional examination board.
            </p>
          </div>

          {/* Candidate & Exam Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs">
            <div className="space-y-1.5">
              <div>
                <span className="text-slate-500">Examination Title:</span>{' '}
                <span className="font-bold text-slate-900 dark:text-white">
                  {submission.examTitle}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Subject / Course:</span>{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {exam?.subject || 'Academic Assessment'}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Submission Timestamp:</span>{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {formattedSubmittedAt}
                </span>
              </div>
            </div>

            <div className="space-y-1.5">
              <div>
                <span className="text-slate-500">Candidate Name:</span>{' '}
                <span className="font-bold text-slate-900 dark:text-white">
                  {submission.participantName}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Candidate Email / UID:</span>{' '}
                <span className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                  {submission.participantEmail}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Submission Reference ID:</span>{' '}
                <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400">
                  {submission.id}
                </span>
              </div>
            </div>
          </div>

          {/* Attempt Statistics Summary Cards */}
          <div className={`grid ${compulsoryTotal > 0 || (exam?.maxQuestionsToAttempt && exam.maxQuestionsToAttempt < totalQuestions) ? 'grid-cols-2 sm:grid-cols-4' : 'grid-cols-3'} gap-3 text-center`}>
            <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
              <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                Total Pool
              </span>
              <span className="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100">
                {totalQuestions}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">Questions</span>
            </div>

            <div className="p-3 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/20">
              <span className="text-[10px] font-semibold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider block">
                Permitted Attempt
              </span>
              <span className="text-xl sm:text-2xl font-black text-indigo-600 dark:text-indigo-400">
                {exam?.maxQuestionsToAttempt || totalQuestions}
              </span>
              <span className="text-[10px] text-indigo-500/80 block mt-0.5">Max allowed</span>
            </div>

            <div className="p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800 bg-emerald-50/40 dark:bg-emerald-950/20">
              <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider block">
                Attempted
              </span>
              <span className="text-xl sm:text-2xl font-black text-emerald-600 dark:text-emerald-400">
                {attemptedCount}
              </span>
              <span className="text-[10px] text-emerald-600/80 block mt-0.5">Responses</span>
            </div>

            {compulsoryTotal > 0 ? (
              <div className="p-3 rounded-2xl border border-amber-200 dark:border-amber-800 bg-amber-50/40 dark:bg-amber-950/20">
                <span className="text-[10px] font-semibold text-amber-700 dark:text-amber-400 uppercase tracking-wider block">
                  ★ Compulsory
                </span>
                <span className="text-xl sm:text-2xl font-black text-amber-600 dark:text-amber-400">
                  {compulsoryAttempted} / {compulsoryTotal}
                </span>
                <span className="text-[10px] text-amber-600/80 block mt-0.5">Must attend</span>
              </div>
            ) : (
              <div className="p-3 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider block">
                  Unattempted
                </span>
                <span className="text-xl sm:text-2xl font-black text-slate-600 dark:text-slate-300">
                  {unattemptedCount}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Skipped</span>
              </div>
            )}
          </div>

          {/* Question by Question Response Log */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 pb-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                Itemized Question Response Sheet
              </h2>
              <span className="text-[11px] text-slate-500">
                Recorded candidate answers as submitted
              </span>
            </div>

            <div className="space-y-3">
              {loading ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  Loading examination questions & responses...
                </div>
              ) : questions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No questions found for this examination submission.
                </div>
              ) : (
                questions.map((q, idx) => {
                  const answerText = submission.answers?.[q.id]?.answer;
                  const isAttempted = Boolean(answerText && answerText.trim().length > 0);

                  return (
                    <div
                      key={q.id}
                      className={`p-4 rounded-xl border text-xs space-y-2 transition-all print:break-inside-avoid ${
                        isAttempted
                          ? 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                          : 'border-dashed border-amber-200 dark:border-amber-800/80 bg-amber-50/20 dark:bg-amber-950/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start space-x-2.5">
                          <span className="w-5 h-5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-[11px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                {q.type}
                              </span>
                              {q.isMandatory ? (
                                <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800 flex items-center space-x-1">
                                  <span>★ COMPULSORY (Must Attend)</span>
                                </span>
                              ) : (
                                <span className="text-[9px] font-medium uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-750 text-slate-400">
                                  ELECTIVE
                                </span>
                              )}
                            </div>
                            <p className="font-semibold text-slate-900 dark:text-white mt-1">
                              {q.title}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0">
                          {isAttempted ? (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>ATTEMPTED</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              <AlertCircle className="w-3 h-3 text-amber-600" />
                              <span>UNATTEMPTED</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Candidate's submitted response display */}
                      <div className="pl-7 pt-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                          Candidate's Recorded Answer:
                        </div>
                        {isAttempted ? (
                          q.type === 'code' ? (
                            <pre className="p-3 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                              {answerText}
                            </pre>
                          ) : (
                            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 font-medium text-slate-800 dark:text-slate-200">
                              {answerText}
                            </div>
                          )
                        ) : (
                          <div className="p-2 rounded-lg bg-amber-50/40 dark:bg-amber-950/20 text-slate-400 italic text-[11px]">
                            — [Not Attempted / Left Blank] —
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Verification & Academic Policy Footnote */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="text-center sm:text-left space-y-0.5">
              <p className="font-semibold text-slate-700 dark:text-slate-300">
                Verified Candidate Electronic Response Slip
              </p>
              <p className="text-[11px]">
                Generated automatically upon test submission • Security Verified
              </p>
            </div>

            <div className="text-right">
              <button
                type="button"
                onClick={handlePrint}
                className="print:hidden px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center space-x-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print Official Slip</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
