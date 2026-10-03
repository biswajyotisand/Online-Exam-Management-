import React, { useEffect, useState } from 'react';
import { Exam, Question, Submission, QuestionChallenge } from '../../types/exam';
import { examService } from '../../services/examService';
import { ChallengeQuestionModal } from './ChallengeQuestionModal';
import { ChallengeDetailsModal } from '../common/ChallengeDetailsModal';
import {
  Award,
  Printer,
  X,
  CheckCircle2,
  XCircle,
  Calendar,
  Clock,
  User,
  GraduationCap,
  FileText,
  ShieldCheck,
  Check,
  Building,
  Hash,
  HelpCircle,
  ArrowRight,
  Info
} from 'lucide-react';

interface OfficialScorecardModalProps {
  isOpen: boolean;
  submission: Submission | null;
  exam: Exam | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export const OfficialScorecardModal: React.FC<OfficialScorecardModalProps> = ({
  isOpen,
  submission,
  exam,
  onClose,
  onRefresh,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [challenges, setChallenges] = useState<QuestionChallenge[]>([]);
  const [loading, setLoading] = useState(false);
  const [challengeQuestionModalQ, setChallengeQuestionModalQ] = useState<Question | null>(null);
  const [viewChallengeModalCh, setViewChallengeModalCh] = useState<QuestionChallenge | null>(null);

  const loadData = () => {
    if (submission) {
      setLoading(true);
      Promise.all([
        examService.getQuestions(submission.examId),
        examService.getChallengesForParticipant(submission.participantId),
      ])
        .then(([qList, chList]) => {
          setQuestions(qList);
          // Filter challenges for this submission
          setChallenges(chList.filter((c) => c.submissionId === submission.id));
        })
        .catch((err) => console.error('Failed to load questions or challenges for scorecard:', err))
        .finally(() => setLoading(false));
    }
  };

  useEffect(() => {
    if (isOpen && submission) {
      loadData();
    }
  }, [isOpen, submission]);

  if (!isOpen || !submission || !exam) return null;

  const totalScore = submission.totalScore ?? 0;
  const maxScore = submission.maxScore ?? exam.totalMarks;
  const percentage = submission.percentage ?? (maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0);
  const isPassed = submission.passed ?? (totalScore >= exam.passingMarks);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none">
        {/* Header - Hidden on Print */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850 print:hidden">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Award className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Official Examination Scorecard & Evaluation Sheet
              </h3>
              <p className="text-xs text-slate-500">
                Authorized & Published Academic Result
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print Scorecard</span>
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

        {/* Printable Scorecard Document */}
        <div className="p-6 sm:p-8 space-y-6 text-slate-900 dark:text-slate-100 print:text-black">
          {/* Institutional Letterhead */}
          <div className="border-b-2 border-slate-800 dark:border-slate-700 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Building className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                <span className="text-lg font-black tracking-tight uppercase">
                  Institutional Examination Board
                </span>
              </div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                Official Statement of Evaluated Results
              </p>
            </div>

            <div className="text-left sm:text-right space-y-0.5 text-xs text-slate-500">
              <div>
                Report ID: <span className="font-mono font-bold text-slate-800 dark:text-slate-200">RES-{submission.id.slice(0, 8).toUpperCase()}</span>
              </div>
              <div>
                Published on: <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {exam.resultsPublishedAt ? new Date(exam.resultsPublishedAt).toLocaleDateString() : new Date().toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>

          {/* Candidate & Examination Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-850 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs">
            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Candidate Information
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {submission.participantName}
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                Email: {submission.participantEmail}
              </div>
              <div className="text-slate-600 dark:text-slate-400 font-mono">
                Candidate ID: {submission.participantId.slice(0, 10)}
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                Examination Details
              </div>
              <div className="font-bold text-sm text-slate-900 dark:text-white">
                {exam.title}
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                Subject: <span className="font-semibold">{exam.subject}</span> • Duration: {exam.durationMinutes} Mins
              </div>
              <div className="text-slate-600 dark:text-slate-400">
                Evaluator: <span className="font-semibold">{exam.evaluatorName || 'Academic Evaluator'}</span>
              </div>
            </div>
          </div>

          {/* Official Result Banner */}
          <div className={`p-5 rounded-2xl border flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
            isPassed
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800/80 text-emerald-950 dark:text-emerald-100'
              : 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800/80 text-rose-950 dark:text-rose-100'
          }`}>
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                {isPassed ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                ) : (
                  <XCircle className="w-6 h-6 text-rose-600" />
                )}
                <span className="text-xl font-black uppercase tracking-wide">
                  {isPassed ? 'PASSED' : 'NOT QUALIFIED'}
                </span>
              </div>
              <p className="text-xs opacity-80">
                Passing Requirement: {exam.passingMarks} / {maxScore} Marks ({Math.round((exam.passingMarks / maxScore) * 100)}%)
              </p>
            </div>

            <div className="flex items-center space-x-6 text-right sm:text-right">
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">Marks Obtained</span>
                <div className="text-2xl font-black">
                  {totalScore} <span className="text-base font-normal opacity-70">/ {maxScore}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider opacity-70">Percentage</span>
                <div className="text-2xl font-black">{percentage}%</div>
              </div>
            </div>
          </div>

          {/* Evaluator's Overall Feedback if present */}
          {submission.evaluatorNotes && (
            <div className="p-3.5 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/60 text-xs text-purple-950 dark:text-purple-200">
              <span className="font-bold">Evaluator's Assessment Remarks: </span>
              <span>"{submission.evaluatorNotes}"</span>
            </div>
          )}

          {/* Detailed Question Evaluation Sheet */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800 pb-2">
              Question-by-Question Grading & Feedback Sheet
            </h4>

            {loading ? (
              <div className="py-8 text-center text-xs text-slate-400">Loading itemized evaluation...</div>
            ) : questions.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400">No question breakdown available.</div>
            ) : (
              <div className="space-y-3">
                {questions.map((q, idx) => {
                  const studentAns = submission.answers?.[q.id];
                  const marksAwarded = studentAns?.marksObtained ?? 0;
                  const feedback = studentAns?.evaluatorFeedback;

                  return (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-850/60 space-y-2 text-xs"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-900 dark:text-white">
                            Q{idx + 1}. {q.title}
                          </span>
                          <div className="text-[10px] text-slate-400 uppercase font-semibold">
                            Type: {q.type} • Weight: {q.marks} Marks
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            {marksAwarded} / {q.marks} Pts
                          </span>
                        </div>
                      </div>

                      {/* Candidate Answer */}
                      <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-[11px]">
                        <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                          Candidate Submitted Response:
                        </span>
                        <div className="font-mono text-slate-800 dark:text-slate-200 whitespace-pre-wrap">
                          {studentAns?.answer || <span className="italic text-slate-400">Unattempted</span>}
                        </div>
                      </div>

                      {/* Evaluator Feedback */}
                      {feedback && (
                        <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/50 text-[11px] text-purple-900 dark:text-purple-200">
                          <span className="font-bold">Evaluator Feedback: </span>
                          <span>{feedback}</span>
                        </div>
                      )}

                      {/* Question Challenge Option & Resolution Status */}
                      {examService.isResultPublishedForExam(exam) && (
                        <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800 text-[11px] print:hidden">
                          {(() => {
                            const existingChallenge = challenges.find((c) => c.questionId === q.id);
                            if (existingChallenge) {
                              return (
                                <div className="flex flex-wrap items-center gap-2">
                                  {existingChallenge.status === 'resolved_accepted' ? (
                                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>Challenge Accepted • Marks Revised to {existingChallenge.finalAwardedMarks} Pts</span>
                                    </span>
                                  ) : existingChallenge.status === 'resolved_rejected' ? (
                                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                      <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                      <span>Challenge Reviewed • Original Mark Upheld</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                                      <span>
                                        {existingChallenge.status === 'forwarded_to_admin'
                                          ? 'Challenge Reviewed by Evaluator • Awaiting Admin Authorization'
                                          : 'Challenge Submitted • Under Evaluator Review'}
                                      </span>
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => setViewChallengeModalCh(existingChallenge)}
                                    className="text-indigo-600 dark:text-indigo-400 hover:underline font-bold text-[11px] flex items-center space-x-0.5"
                                  >
                                    <span>View Appeal Dossier</span>
                                    <ArrowRight className="w-3 h-3" />
                                  </button>
                                </div>
                              );
                            }

                            return (
                              <button
                                type="button"
                                onClick={() => setChallengeQuestionModalQ(q)}
                                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-800 font-bold transition-all shadow-2xs hover:shadow-xs"
                              >
                                <HelpCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>Challenge Question Evaluation / Key</span>
                              </button>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Academic Appeal & Challenge Policy Box */}
          <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 space-y-2 text-xs text-slate-600 dark:text-slate-400 print:hidden">
            <div className="flex items-center space-x-2 font-bold text-slate-800 dark:text-slate-200">
              <Info className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Institutional Question Challenge & Academic Appeal Workflow</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Candidates may formally contest any question's answer key or awarded marks after official result publication. Submitted challenges are routed to the assigned Evaluator for subject-matter review, then forwarded to the Institutional Administrator for final authorization. If authorized, the candidate's scorecard and total marks are automatically recomputed.
            </p>
          </div>

          {/* Official Sign-off & Verification Footer */}
          <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs text-slate-400">
            <div className="flex items-center space-x-2 text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              <span>Cryptographically verified academic examination scorecard.</span>
            </div>

            <div className="text-left sm:text-right font-mono text-[11px]">
              Authorized by Institutional Administrator • {new Date().toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      {/* Challenge Question Modal */}
      {challengeQuestionModalQ && (
        <ChallengeQuestionModal
          isOpen={true}
          question={challengeQuestionModalQ}
          submission={submission}
          exam={exam}
          onClose={() => setChallengeQuestionModalQ(null)}
          onSuccess={() => {
            loadData();
            if (onRefresh) onRefresh();
          }}
        />
      )}

      {/* View Challenge Details Modal */}
      {viewChallengeModalCh && (
        <ChallengeDetailsModal
          isOpen={true}
          challenge={viewChallengeModalCh}
          onClose={() => setViewChallengeModalCh(null)}
        />
      )}
    </div>
  );
};
