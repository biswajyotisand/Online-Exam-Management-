import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { examService } from '../../services/examService';
import { Exam, Question, Submission, QuestionChallenge } from '../../types/exam';
import { ForwardEvaluationsModal } from './ForwardEvaluationsModal';
import { ReviewChallengeModal } from './ReviewChallengeModal';
import { ChallengeDetailsModal } from '../common/ChallengeDetailsModal';
import {
  CheckSquare,
  Award,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  User,
  Search,
  Filter,
  ArrowLeft,
  Save,
  MessageSquare,
  Sparkles,
  HelpCircle,
  FileText,
  Lock,
  ShieldAlert,
  Send,
  Calendar,
  Layers,
  UserCheck,
  BookOpen
} from 'lucide-react';

export const EvaluatorPortal: React.FC = () => {
  const { profile, isAdmin, activeRole } = useAuth();
  const isViewOnlyAdmin = (isAdmin || profile?.role === 'admin') && activeRole === 'evaluator';
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [challenges, setChallenges] = useState<QuestionChallenge[]>([]);
  const [evaluatorTab, setEvaluatorTab] = useState<'submissions' | 'challenges'>('submissions');
  const [reviewChallengeModalItem, setReviewChallengeModalItem] = useState<QuestionChallenge | null>(null);
  const [viewDetailsChallenge, setViewDetailsChallenge] = useState<QuestionChallenge | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [currentExam, setCurrentExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | 'submitted' | 'evaluated'>('all');
  const [selectedExamFilterId, setSelectedExamFilterId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [gradingState, setGradingState] = useState<Record<string, { marks: number; feedback: string }>>({});
  const [evaluatorNotes, setEvaluatorNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [forwardModalExam, setForwardModalExam] = useState<Exam | null>(null);
  const [examQuestionsMap, setExamQuestionsMap] = useState<Record<string, Question[]>>({});

  // Debatable question skip recommendation state
  const [recommendSkipModalQ, setRecommendSkipModalQ] = useState<Question | null>(null);
  const [skipReasonText, setSkipReasonText] = useState('Ambiguity in question prompt / multiple valid interpretations');
  const [submittingSkipRec, setSubmittingSkipRec] = useState(false);

  const loadSubmissions = async () => {
    try {
      setLoading(true);
      const [allSubs, allExams, allChallenges] = await Promise.all([
        examService.getAllSubmissions(),
        examService.getAllExams(),
        examService.getAllChallenges().catch(() => []),
      ]);
      setSubmissions(allSubs);
      setExams(allExams);
      setChallenges(allChallenges);

      // Load questions for exams to identify objective papers (all MCQ/True-False)
      const qMap: Record<string, Question[]> = {};
      await Promise.all(
        allExams.map(async (ex) => {
          try {
            const qs = await examService.getQuestions(ex.id);
            qMap[ex.id] = qs;
          } catch (e) {
            console.error('Error fetching questions for exam', ex.id, e);
          }
        })
      );
      setExamQuestionsMap(qMap);
    } catch (err) {
      console.error('Error fetching submissions for evaluator:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSubmissions();
  }, []);

  const openGradingWorkbench = async (sub: Submission) => {
    try {
      setSelectedSubmission(sub);
      const exam = await examService.getExamById(sub.examId);
      setCurrentExam(exam);
      const qList = await examService.getQuestions(sub.examId);
      setQuestions(qList);

      // Initialize grading state from submission answers:
      // RULE: For mcq type question & true/false type question evaluator has not to input each score.
      // It is evaluated automatically as the correct option provided by the paper setter.
      // Evaluator has to input marks for descriptive type answers only.
      const initialGrades: Record<string, { marks: number; feedback: string }> = {};
      for (const q of qList) {
        const studentAns = sub.answers?.[q.id];
        const rawAns = (studentAns?.answer || '').trim();
        const isObjective = q.type === 'mcq' || q.type === 'boolean';

        let marks = 0;
        if (isObjective) {
          // Objective: Evaluated automatically according to correct option provided by paper setter
          const isCorrect = Boolean(
            q.correctAnswer &&
            rawAns &&
            rawAns.toLowerCase() === q.correctAnswer.trim().toLowerCase()
          );
          marks = isCorrect ? q.marks : 0;
        } else {
          // Descriptive / subjective: marks input by evaluator
          marks = studentAns?.marksObtained !== undefined ? Number(studentAns.marksObtained) : 0;
        }

        initialGrades[q.id] = {
          marks,
          feedback: studentAns?.evaluatorFeedback || '',
        };
      }
      setGradingState(initialGrades);
      setEvaluatorNotes(sub.evaluatorNotes || '');
    } catch (err) {
      console.error('Error opening grading workbench:', err);
    }
  };

  const handleMarkChange = (qId: string, maxMarks: number, value: number) => {
    if (isViewOnlyAdmin) return;
    const clamped = Math.max(0, Math.min(maxMarks, value));
    setGradingState((prev) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        marks: clamped,
      },
    }));
  };

  const handleFeedbackChange = (qId: string, text: string) => {
    if (isViewOnlyAdmin) return;
    setGradingState((prev) => ({
      ...prev,
      [qId]: {
        ...prev[qId],
        feedback: text,
      },
    }));
  };

  const calculateCurrentScore = () => {
    return Object.values(gradingState).reduce((acc, curr) => acc + (Number(curr.marks) || 0), 0);
  };

  const handleFinalizeEvaluation = async () => {
    if (isViewOnlyAdmin) {
      alert('Access Denied: Administrator is in view-only mode and cannot alter or finalize evaluations.');
      return;
    }
    if (!selectedSubmission || !currentExam) return;
    try {
      setSaving(true);

      // Merge gradingState with existing answers
      // RULE: For mcq type question & true/false type question evaluator has not to input each score.
      // It is evaluated automatically as the correct option provided by the paper setter.
      // Evaluator inputs marks for descriptive type answer only.
      const updatedAnswers: Record<string, any> = {};
      for (const q of questions) {
        const existingAns = selectedSubmission.answers?.[q.id]?.answer || '';
        const rawAns = existingAns.trim();
        const isObjective = q.type === 'mcq' || q.type === 'boolean';

        let marks = 0;
        let feedback = gradingState[q.id]?.feedback ?? '';

        if (isObjective) {
          const isCorrect = Boolean(
            q.correctAnswer &&
            rawAns &&
            rawAns.toLowerCase() === q.correctAnswer.trim().toLowerCase()
          );
          marks = isCorrect ? q.marks : 0;
          if (!feedback) {
            feedback = isCorrect
              ? `Auto-Evaluated: Correct (+${q.marks}/${q.marks}) as per Paper Setter answer key ("${q.correctAnswer}").`
              : rawAns
              ? `Auto-Evaluated: Incorrect (0/${q.marks}). Selected "${rawAns}", Paper Setter key was "${q.correctAnswer}".`
              : `Auto-Evaluated: Question unattempted by candidate (0/${q.marks}).`;
          }
        } else {
          // Descriptive type: evaluator input
          marks = gradingState[q.id]?.marks ?? 0;
        }

        updatedAnswers[q.id] = {
          questionId: q.id,
          answer: existingAns,
          marksObtained: marks,
          evaluatorFeedback: feedback,
          isEvaluated: true,
        };
      }

      const isAllObjective = questions.length > 0 && questions.every(q => q.type === 'mcq' || q.type === 'boolean');
      const defaultNotes = isAllObjective
        ? `Objective question paper evaluated automatically against Paper Setter answer keys; grade finalized and released by ${profile?.displayName || 'Evaluator'}.`
        : evaluatorNotes;

      await examService.evaluateSubmission(
        selectedSubmission.id,
        updatedAnswers,
        currentExam,
        defaultNotes,
        profile?.uid || 'evaluator_demo'
      );

      setSuccessNotice('Evaluation finalized and grade released successfully to candidate!');
      setTimeout(() => setSuccessNotice(null), 3500);

      await loadSubmissions();
      // Update selected submission locally
      const refreshed = await examService.getSubmissionById(selectedSubmission.id);
      setSelectedSubmission(refreshed);
    } catch (err: any) {
      console.error(err);
      alert('Error finalizing evaluation: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleQuickFinalizeObjective = async (sub: Submission) => {
    if (isViewOnlyAdmin) {
      alert('Access Denied: Administrator is in view-only mode.');
      return;
    }
    try {
      setSaving(true);
      await examService.finalizeObjectiveSubmission(
        sub.id,
        profile?.uid || 'evaluator',
        profile?.displayName || 'Academic Evaluator'
      );
      setSuccessNotice(`Grade finalized & released for ${sub.participantName}!`);
      setTimeout(() => setSuccessNotice(null), 3500);
      await loadSubmissions();
    } catch (err: any) {
      alert('Error finalizing objective grade: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBatchFinalizeObjective = async (examId: string) => {
    if (isViewOnlyAdmin) {
      alert('Access Denied: Administrator is in view-only mode.');
      return;
    }
    try {
      setBatchProcessing(true);
      const res = await examService.batchFinalizeObjectiveSubmissions(
        examId,
        profile?.uid || 'evaluator',
        profile?.displayName || 'Academic Evaluator'
      );
      setSuccessNotice(`Batch finalized and released grades for ${res.finalizedCount} objective submissions!`);
      setTimeout(() => setSuccessNotice(null), 4000);
      await loadSubmissions();
    } catch (err: any) {
      alert('Error batch finalizing objective grades: ' + err.message);
    } finally {
      setBatchProcessing(false);
    }
  };

  const filteredSubmissions = submissions.filter((s) => {
    const matchesSearch =
      s.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.examTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.participantEmail.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus =
      filterStatus === 'all' ||
      (filterStatus === 'submitted' && s.status === 'submitted') ||
      (filterStatus === 'evaluated' && s.status === 'evaluated');
    const matchesExam = selectedExamFilterId === 'all' || s.examId === selectedExamFilterId;
    return matchesSearch && matchesStatus && matchesExam;
  });

  const pendingCount = submissions.filter((s) => s.status === 'submitted').length;
  const evaluatedCount = submissions.filter((s) => s.status === 'evaluated').length;

  const relevantChallenges = isViewOnlyAdmin
    ? challenges
    : challenges.filter((c) => exams.some((e) => e.id === c.examId));
  const pendingChallengesCount = relevantChallenges.filter(
    (c) => c.status === 'submitted' || c.status === 'under_evaluator_review'
  ).length;

  const handleRecommendSkipQuestion = async () => {
    if (!currentExam || !recommendSkipModalQ) return;
    try {
      setSubmittingSkipRec(true);
      await examService.recommendSkipQuestion(
        currentExam.id,
        recommendSkipModalQ.id,
        profile?.uid || 'evaluator',
        profile?.displayName || 'Academic Evaluator',
        'evaluator',
        skipReasonText
      );
      setSuccessNotice(`Recommendation to skip question "${recommendSkipModalQ.title}" submitted to Administrator for approval.`);
      setTimeout(() => setSuccessNotice(null), 4000);
      setRecommendSkipModalQ(null);
      // Reload questions
      const qList = await examService.getQuestions(currentExam.id);
      setQuestions(qList);
    } catch (err: any) {
      alert('Failed to submit skip recommendation: ' + err?.message);
    } finally {
      setSubmittingSkipRec(false);
    }
  };

  // Selected exam object for forwarding
  const activeExamForForwarding =
    selectedExamFilterId !== 'all'
      ? exams.find((e) => e.id === selectedExamFilterId) || exams[0]
      : exams[0] || null;

  return (
    <div className="space-y-6">
      {/* Administrator View-Only Banner */}
      {isViewOnlyAdmin && (
        <div className="bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/40 rounded-2xl p-4 flex items-center space-x-3 text-amber-900 dark:text-amber-200 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">Administrator Inspection Mode (View-Only):</span> You are viewing the Evaluator portal. As Administrator, evaluations, scores, and candidate feedback are view-only and cannot be altered or finalized. Marking scripts and publishing results is reserved exclusively for authorized Evaluators.
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-amber-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <CheckSquare className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight">Evaluator & Examiner Center</h1>
            </div>
            <p className="text-xs text-amber-200/80 mt-1 max-w-2xl leading-relaxed">
              Review student answer scripts, verify automated objective marks, assess subjective essays and code with standard rubrics, provide feedback, and publish official scorecards.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 text-xs">
              <span className="text-amber-300 font-bold">{pendingCount}</span> Needs Evaluation
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 text-xs">
              <span className="text-emerald-300 font-bold">{evaluatedCount}</span> Evaluated
            </div>
            <div className="px-3.5 py-2 rounded-xl bg-white/10 backdrop-blur-xs border border-white/10 text-xs">
              <span className="text-purple-300 font-bold">{pendingChallengesCount}</span> Challenges Pending
            </div>
          </div>
        </div>

        {successNotice && (
          <div className="mt-4 p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}
      </div>

      {/* Primary Evaluator Navigation: Submissions Queue vs Question Challenges */}
      {!selectedSubmission && (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 dark:border-slate-700 pb-2">
          <button
            type="button"
            onClick={() => setEvaluatorTab('submissions')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              evaluatorTab === 'submissions'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/20'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            <span>Answer Scripts & Submissions Queue ({filteredSubmissions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setEvaluatorTab('challenges')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 ${
              evaluatorTab === 'challenges'
                ? 'bg-purple-600 text-white shadow-md shadow-purple-900/20'
                : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Candidate Question Challenges ({relevantChallenges.length})</span>
            {pendingChallengesCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-amber-950 font-black">
                {pendingChallengesCount} Pending
              </span>
            )}
          </button>
        </div>
      )}

      {/* Main View: Workbench OR Submissions Queue OR Challenges Queue */}
      {selectedSubmission && currentExam ? (
        /* Grading Workbench */
        <div className="space-y-6 animate-in fade-in">
          {/* Back button & Candidate Header */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <button
                type="button"
                onClick={() => setSelectedSubmission(null)}
                className="p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Back to submissions list"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {selectedSubmission.participantName}
                  </span>
                  <span className="text-[11px] text-slate-500">
                    ({selectedSubmission.participantEmail})
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      selectedSubmission.status === 'evaluated'
                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                        : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                    }`}
                  >
                    {selectedSubmission.status === 'evaluated' ? 'Evaluated' : 'Needs Evaluation'}
                  </span>
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Exam: <span className="font-semibold text-slate-800 dark:text-slate-200">{currentExam.title}</span> • Max Marks: {currentExam.totalMarks} • Pass: {currentExam.passingMarks}
                </div>
              </div>
            </div>

            {/* Score Calculator Pill */}
            <div className="flex items-center space-x-4 bg-slate-50 dark:bg-slate-750 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="text-right">
                <span className="text-[10px] uppercase font-semibold text-slate-400">Total Score</span>
                <div className="text-lg font-extrabold text-indigo-600 dark:text-indigo-400">
                  {calculateCurrentScore()} / {currentExam.totalMarks}
                </div>
              </div>
              <div className="h-8 w-px bg-slate-200 dark:bg-slate-700" />
              {isViewOnlyAdmin ? (
                <div className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-400 text-xs font-semibold cursor-not-allowed">
                  <Lock className="w-3.5 h-3.5" />
                  <span>Evaluations View-Only</span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleFinalizeEvaluation}
                  disabled={saving}
                  className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-900/30 transition-all disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Finalizing...' : 'Finalize & Release Grade'}</span>
                </button>
              )}
            </div>
          </div>

          {/* Anti-cheat alerts banner if any */}
          {selectedSubmission.tabSwitchCount > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 flex items-center space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">Proctoring Flag:</span> Candidate triggered{' '}
                <span className="font-bold underline">{selectedSubmission.tabSwitchCount} tab-switch / focus-loss</span> events during the examination.
              </div>
            </div>
          )}

          {/* Objective vs Descriptive Exam Paper Directive Banner */}
          {(() => {
            const isAllObjectiveExam = questions.length > 0 && questions.every(q => q.type === 'mcq' || q.type === 'boolean');
            const objCount = questions.filter(q => q.type === 'mcq' || q.type === 'boolean').length;
            const descCount = questions.filter(q => q.type !== 'mcq' && q.type !== 'boolean').length;

            if (isAllObjectiveExam) {
              return (
                <div className="p-4 rounded-2xl bg-indigo-50/90 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-xs">
                  <div className="flex items-center space-x-3">
                    <div className="p-2.5 rounded-xl bg-indigo-600 text-white shrink-0 shadow-xs">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center space-x-2">
                        <span>Objective Question Paper (All MCQ & True/False)</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold">
                          100% Auto-Evaluated
                        </span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-300">
                        Evaluator does not need to input individual scores. All questions are evaluated automatically as per the correct option provided by the paper setter. Simply review and click <strong>"Finalize & Release Grade"</strong>.
                      </p>
                    </div>
                  </div>
                  {!isViewOnlyAdmin && (
                    <button
                      type="button"
                      onClick={handleFinalizeEvaluation}
                      disabled={saving}
                      className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/20 transition-all flex items-center space-x-1.5 shrink-0 cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>{saving ? 'Releasing...' : 'Finalize & Release Grade'}</span>
                    </button>
                  )}
                </div>
              );
            }

            return (
              <div className="p-3.5 rounded-2xl bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs flex items-center space-x-3 text-amber-900 dark:text-amber-200">
                <FileText className="w-5 h-5 text-amber-600 shrink-0" />
                <div className="flex-1">
                  <strong>Evaluator Directive ({objCount} Objective, {descCount} Descriptive):</strong> For MCQ and True/False questions, scores are evaluated automatically from the paper setter's answer keys (no score input required). Evaluators only input marks for descriptive type answers.
                </div>
              </div>
            );
          })()}

          {/* Question by question grading cards */}
          <div className="space-y-5">
            {questions.map((q, idx) => {
              const isObjective = q.type === 'mcq' || q.type === 'boolean';
              const studentAnswer = selectedSubmission.answers?.[q.id]?.answer || 'No answer submitted.';
              const currentGrade = gradingState[q.id]?.marks ?? 0;
              const feedback = gradingState[q.id]?.feedback ?? '';

              const rawStudentAns = studentAnswer.trim();
              const isAttempted = Boolean(
                rawStudentAns &&
                rawStudentAns !== 'No answer submitted.' &&
                rawStudentAns !== '(Unattempted)' &&
                rawStudentAns !== '(No response)' &&
                rawStudentAns !== '(None)'
              );
              const isCorrect = isObjective && isAttempted && Boolean(
                q.correctAnswer &&
                rawStudentAns.toLowerCase() === q.correctAnswer.trim().toLowerCase()
              );

              return (
                <div
                  key={q.id}
                  className={`rounded-2xl border p-5 shadow-xs space-y-4 ${
                    isObjective
                      ? 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                      : 'bg-white dark:bg-slate-800 border-amber-200/80 dark:border-amber-800/60 ring-1 ring-amber-500/10'
                  }`}
                >
                  {/* Question header */}
                  <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100 dark:border-slate-700/60">
                    <div className="flex items-start space-x-3">
                      <span className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center shrink-0 ${
                        isObjective
                          ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                          : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                      }`}>
                        {idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {q.type === 'boolean' ? 'True / False' : q.type === 'mcq' ? 'MCQ (Objective)' : 'Descriptive / Subjective'}
                          </span>
                          <span className="text-xs font-bold text-amber-600 dark:text-amber-400">
                            {q.marks} Marks
                          </span>
                          {isObjective && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 font-bold border border-emerald-200 dark:border-emerald-800">
                              Auto-Evaluated
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-slate-900 dark:text-white mt-1 leading-relaxed">
                          {q.title}
                        </p>
                      </div>
                    </div>

                    {/* Scoring Assigner: Auto-Evaluated for Objective vs Evaluator Input for Descriptive */}
                    {isObjective ? (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div
                          className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-xl border text-xs font-bold ${
                            !isAttempted
                              ? 'bg-slate-100 text-slate-700 dark:bg-slate-750 dark:text-slate-300 border-slate-300 dark:border-slate-600'
                              : isCorrect
                              ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300 border-emerald-300 dark:border-emerald-800'
                              : 'bg-rose-50 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300 border-rose-300 dark:border-rose-800'
                          }`}
                        >
                          {!isAttempted ? (
                            <>
                              <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                              <span>Unattempted (0 / {q.marks})</span>
                            </>
                          ) : isCorrect ? (
                            <>
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Auto-Evaluated: Correct (+{q.marks} / {q.marks})</span>
                            </>
                          ) : (
                            <>
                              <XCircle className="w-4 h-4 text-rose-600 shrink-0" />
                              <span>Auto-Evaluated: Incorrect (0 / {q.marks})</span>
                            </>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 font-medium">
                          No evaluator input required
                        </span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1 shrink-0">
                        <div className="flex items-center space-x-2 bg-amber-50 dark:bg-amber-950/40 p-2 rounded-xl border border-amber-300 dark:border-amber-700 shrink-0">
                          <label className="text-xs font-bold text-amber-900 dark:text-amber-200">
                            Award Marks:
                          </label>
                          <input
                            type="number"
                            min="0"
                            max={q.marks}
                            step="0.5"
                            disabled={isViewOnlyAdmin}
                            value={currentGrade}
                            onChange={(e) => handleMarkChange(q.id, q.marks, Number(e.target.value))}
                            className={`w-16 p-1 text-center font-bold text-xs rounded-lg border border-slate-300 dark:border-slate-600 ${
                              isViewOnlyAdmin
                                ? 'bg-slate-100 dark:bg-slate-800 text-slate-500 cursor-not-allowed'
                                : 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500'
                            } focus:outline-hidden`}
                          />
                          <span className="text-xs font-bold text-slate-500">/ {q.marks}</span>
                        </div>
                        <span className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                          Descriptive: Evaluator inputs marks
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Student Answer & Setter Rubric side-by-side / stacked */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Candidate Answer */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-750/70 border border-slate-200 dark:border-slate-700/80 space-y-2">
                      <div className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center justify-between">
                        <span>Candidate's Response</span>
                        {isObjective && (
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            !isAttempted
                              ? 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                              : isCorrect
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                          }`}>
                            {!isAttempted ? 'Not Attempted' : isCorrect ? 'Matches Answer Key' : 'Wrong Choice'}
                          </span>
                        )}
                      </div>
                      {q.type === 'code' ? (
                        <pre className="p-3 rounded-lg bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                          {studentAnswer}
                        </pre>
                      ) : (
                        <p className="text-xs text-slate-800 dark:text-slate-200 whitespace-pre-line leading-relaxed font-medium">
                          {studentAnswer}
                        </p>
                      )}

                      {/* Visual options selector for MCQ */}
                      {q.type === 'mcq' && q.options && q.options.length > 0 && (
                        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 space-y-1">
                          <span className="text-[10px] font-bold text-slate-400 block uppercase">Exam Options:</span>
                          <div className="grid grid-cols-1 gap-1 text-xs">
                            {q.options.map((opt, oIdx) => {
                              const isSelected = rawStudentAns.toLowerCase() === opt.toLowerCase();
                              const isSetterKey = q.correctAnswer && q.correctAnswer.toLowerCase() === opt.toLowerCase();
                              return (
                                <div
                                  key={oIdx}
                                  className={`p-2 rounded-lg text-[11px] border flex items-center justify-between ${
                                    isSetterKey
                                      ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-300 font-bold'
                                      : isSelected
                                      ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-800 dark:text-rose-300 font-medium'
                                      : 'bg-white dark:bg-slate-700/40 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'
                                  }`}
                                >
                                  <span>{opt}</span>
                                  <div className="flex items-center space-x-1">
                                    {isSetterKey && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-200 text-emerald-900 font-bold">
                                        Correct Key
                                      </span>
                                    )}
                                    {isSelected && !isSetterKey && (
                                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-rose-200 text-rose-900 font-bold">
                                        Candidate Selection
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Setter's Rubric / Model Answer */}
                    <div className="p-3.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/60 space-y-2">
                      <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider flex items-center space-x-1">
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>{isObjective ? "Paper Setter's Correct Option & Key" : 'Grading Guide & Model Rubric'}</span>
                      </div>
                      {q.correctAnswer && (
                        <div className="text-xs text-emerald-800 dark:text-emerald-200 font-semibold p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800 flex items-center justify-between">
                          <div>
                            <span className="font-normal text-slate-500 dark:text-slate-400">Correct Option: </span>
                            <span className="font-bold underline text-emerald-900 dark:text-emerald-100">{q.correctAnswer}</span>
                          </div>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">
                            Setter Key
                          </span>
                        </div>
                      )}
                      <p className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                        {q.rubric || q.explanation || (isObjective ? 'Automatic grading applies based on correct option.' : 'No specialized rubric provided by paper setter.')}
                      </p>
                    </div>
                  </div>

                  {/* Question Feedback input */}
                  <div>
                    <input
                      type="text"
                      disabled={isViewOnlyAdmin}
                      readOnly={isViewOnlyAdmin}
                      placeholder={
                        isViewOnlyAdmin
                          ? 'Question feedback is view-only.'
                          : isObjective
                          ? 'Feedback remarks (optional for auto-evaluated objective question)...'
                          : 'Evaluator comments on descriptive answer (optional)...'
                      }
                      value={feedback}
                      onChange={(e) => handleFeedbackChange(q.id, e.target.value)}
                      className={`w-full p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 ${
                        isViewOnlyAdmin
                          ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 cursor-not-allowed'
                          : 'bg-slate-50 dark:bg-slate-750 text-slate-800 dark:text-slate-200'
                      } focus:outline-hidden`}
                    />
                  </div>

                  {/* Debatable Question / Skip Question Recommendation */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-750 text-[11px]">
                    {q.isSkipped ? (
                      <span className="text-purple-600 dark:text-purple-400 font-bold flex items-center space-x-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Question marked debatable & skipped by Administrator (Total marks and passing marks reduced proportionately).</span>
                      </span>
                    ) : q.skipRecommendation?.status === 'pending' ? (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center space-x-1">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Skip recommended by Evaluator ("{q.skipRecommendation.reason}") • Awaiting Admin approval.</span>
                      </span>
                    ) : !isViewOnlyAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          setRecommendSkipModalQ(q);
                          setSkipReasonText('Ambiguity in question prompt / multiple valid interpretations');
                        }}
                        className="text-amber-700 dark:text-amber-400 hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
                      >
                        <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                        <span>Question Debatable? Recommend Skipping Question for All</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Overall Remarks card */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-2">
                <MessageSquare className="w-4 h-4 text-amber-500" />
                <span>Overall Evaluator Remarks & Certification</span>
              </h3>
              <textarea
                rows={3}
                disabled={isViewOnlyAdmin}
                readOnly={isViewOnlyAdmin}
                placeholder={
                  isViewOnlyAdmin
                    ? 'Overall evaluation feedback is view-only for administrator.'
                    : 'Overall performance feedback, strengths, and recommendations for the candidate...'
                }
                value={evaluatorNotes}
                onChange={(e) => setEvaluatorNotes(e.target.value)}
                className={`w-full p-3 rounded-xl border border-slate-200 dark:border-slate-700 ${
                  isViewOnlyAdmin
                    ? 'bg-slate-100 dark:bg-slate-800/80 text-slate-500 cursor-not-allowed'
                    : 'bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white'
                } text-xs focus:outline-hidden`}
              />

              <div className="flex items-center justify-between pt-2">
                <div className="text-xs text-slate-500">
                  Evaluator: <span className="font-semibold">{profile?.displayName || 'Faculty Examiner'}</span>
                </div>
                {isViewOnlyAdmin ? (
                  <div className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-400 text-xs font-semibold cursor-not-allowed">
                    <Lock className="w-3.5 h-3.5" />
                    <span>View-Only Mode</span>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={handleFinalizeEvaluation}
                    disabled={saving}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-900/30 transition-all"
                  >
                    <Save className="w-4 h-4" />
                    <span>{saving ? 'Finalizing...' : 'Save & Publish Evaluation'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : evaluatorTab === 'submissions' ? (
        /* Submissions Queue */
        <div className="space-y-4">
          {/* Institutional Evaluation Forwarding & Scheduling Dossier */}
          {activeExamForForwarding && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <Send className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                      <span>Evaluation Dossier: {activeExamForForwarding.title}</span>
                      <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {activeExamForForwarding.subject}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-500">
                      Forward evaluated scripts to the Administrator with your recommended result publication schedule for authorization.
                    </p>
                  </div>
                </div>

                {!isViewOnlyAdmin && (
                  <button
                    type="button"
                    onClick={() => setForwardModalExam(activeExamForForwarding)}
                    className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 shadow-md shadow-purple-900/20 transition-all shrink-0"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>
                      {activeExamForForwarding.evaluationForwardStatus === 'forwarded_to_admin'
                        ? 'Update Forwarded Schedule'
                        : 'Forward Evaluations to Administrator'}
                    </span>
                  </button>
                )}
              </div>

              {/* Status Callout */}
              {activeExamForForwarding.evaluationForwardStatus === 'forwarded_to_admin' ? (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5">
                      <Clock className="w-4 h-4 text-amber-600" />
                      <span>Evaluations Forwarded to Administrator • Pending Authorisation</span>
                    </div>
                    <div className="text-[11px] text-amber-800 dark:text-amber-300 pl-5">
                      Recommended Publication:{' '}
                      <strong className="underline">
                        {activeExamForForwarding.recommendedResultReleaseTime
                          ? new Date(activeExamForForwarding.recommendedResultReleaseTime).toLocaleString()
                          : 'TBD'}
                      </strong>
                      {activeExamForForwarding.evaluatorRemarks && (
                        <span className="ml-2 italic">"{activeExamForForwarding.evaluatorRemarks}"</span>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 self-start sm:self-auto">
                    Awaiting Admin Approval
                  </span>
                </div>
              ) : activeExamForForwarding.evaluationForwardStatus === 'results_authorized' ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="space-y-0.5">
                    <div className="font-bold text-emerald-900 dark:text-emerald-200 flex items-center space-x-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      <span>Results Publication Authorized by Administrator</span>
                    </div>
                    <div className="text-[11px] text-emerald-800 dark:text-emerald-300 pl-5">
                      Scheduled to release on:{' '}
                      <strong className="underline">
                        {activeExamForForwarding.scheduledResultReleaseTime
                          ? new Date(activeExamForForwarding.scheduledResultReleaseTime).toLocaleString()
                          : 'Authorized'}
                      </strong>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900 self-start sm:self-auto">
                    Scheduled
                  </span>
                </div>
              ) : activeExamForForwarding.evaluationForwardStatus === 'results_published' || activeExamForForwarding.resultsPublished ? (
                <div className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 text-xs flex items-center space-x-2 text-emerald-900 dark:text-emerald-200 font-bold">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Results Officially Published to Candidates (Scorecards Live)</span>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-500 flex items-center justify-between">
                  <span>
                    Grading in progress ({evaluatedCount} of {submissions.length} evaluated). Once complete, click "Forward Evaluations to Administrator" to recommend a release time.
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            {/* Filter Bar */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search candidate or exam..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white w-52 focus:outline-hidden"
                  />
                </div>

                <select
                  value={selectedExamFilterId}
                  onChange={(e) => setSelectedExamFilterId(e.target.value)}
                  className="py-1.5 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-800 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value="all">All Allocated Exams ({exams.length})</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      Exam: {ex.title}
                    </option>
                  ))}
                </select>

                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="py-1.5 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-800 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value="all">All Submissions</option>
                  <option value="submitted">Needs Evaluation ({pendingCount})</option>
                  <option value="evaluated">Evaluated ({evaluatedCount})</option>
                </select>

                {/* Batch Finalize for Selected Objective Exam */}
                {(() => {
                  if (selectedExamFilterId === 'all') return null;
                  const filterQs = examQuestionsMap[selectedExamFilterId] || [];
                  const isObjExam = filterQs.length > 0 && filterQs.every(q => q.type === 'mcq' || q.type === 'boolean');
                  const pendingInExam = filteredSubmissions.filter(s => s.status === 'submitted').length;

                  if (isObjExam && pendingInExam > 0 && !isViewOnlyAdmin) {
                    return (
                      <button
                        type="button"
                        onClick={() => handleBatchFinalizeObjective(selectedExamFilterId)}
                        disabled={batchProcessing}
                        className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                        title="Evaluated automatically against Paper Setter's key. Finalize all grades in 1 click."
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{batchProcessing ? 'Finalizing...' : `Finalize & Release All Objective Grades (${pendingInExam})`}</span>
                      </button>
                    );
                  }
                  return null;
                })()}
              </div>

              <span className="text-xs text-slate-500 font-medium">
                Showing {filteredSubmissions.length} of {submissions.length} submissions
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Candidate</th>
                    <th className="py-3 px-4 font-semibold">Exam Title</th>
                    <th className="py-3 px-4 font-semibold">Proctoring Flags</th>
                    <th className="py-3 px-4 font-semibold">Score / Status</th>
                    <th className="py-3 px-4 font-semibold">Submitted</th>
                    <th className="py-3 px-4 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredSubmissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-slate-400">
                        No candidate submissions found matching filter.
                      </td>
                    </tr>
                  ) : (
                    filteredSubmissions.map((sub) => {
                      const isEvaluated = sub.status === 'evaluated';
                      const subExamQs = examQuestionsMap[sub.examId] || [];
                      const isObjectivePaper = subExamQs.length > 0 && subExamQs.every(q => q.type === 'mcq' || q.type === 'boolean');

                      return (
                        <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {sub.participantName}
                            </div>
                            <div className="text-[11px] text-slate-500">{sub.participantEmail}</div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-medium text-slate-700 dark:text-slate-300">
                              {sub.examTitle}
                            </div>
                            {isObjectivePaper && (
                              <span className="inline-flex items-center space-x-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60 mt-0.5">
                                <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                                <span>Objective Paper (Auto-Evaluated)</span>
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {sub.tabSwitchCount > 0 ? (
                              <span className="inline-flex items-center space-x-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950 px-2 py-0.5 rounded-full border border-amber-300 dark:border-amber-800">
                                <AlertTriangle className="w-3 h-3" />
                                <span>{sub.tabSwitchCount} Tab Blur</span>
                              </span>
                            ) : (
                              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-medium">
                                Clean session
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {isEvaluated ? (
                              <div className="flex items-center space-x-2">
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {sub.totalScore}/{sub.maxScore}
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    sub.passed
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  }`}
                                >
                                  {sub.passed ? 'PASSED' : 'FAILED'}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-medium">
                                Pending Grading
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-500 text-[11px]">
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleString() : 'In Progress'}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center space-x-2">
                              {!isEvaluated && isObjectivePaper && !isViewOnlyAdmin && (
                                <button
                                  type="button"
                                  onClick={() => handleQuickFinalizeObjective(sub)}
                                  disabled={saving}
                                  className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                                  title="Paper setter's answer keys applied automatically. Finalize and release grade now."
                                >
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  <span>Finalize & Release</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => openGradingWorkbench(sub)}
                                className={`px-3 py-1.5 rounded-lg font-bold text-xs shadow-xs transition-colors cursor-pointer ${
                                  isEvaluated
                                    ? 'bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200'
                                    : isObjectivePaper
                                    ? 'bg-indigo-600 hover:bg-indigo-500 text-white'
                                    : 'bg-amber-600 hover:bg-amber-500 text-white'
                                }`}
                              >
                                {isEvaluated
                                  ? 'Review Marks'
                                  : isObjectivePaper
                                  ? 'Review & Release'
                                  : 'Grade Submission'}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* Question Challenges & Academic Appeals Desk */
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                  <HelpCircle className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span>Candidate Answer Key & Question Challenges</span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                      Academic Review Desk
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Review student contestations against published answer keys and evaluation markings, provide academic feedback, and recommend score revisions to the Administrator.
                  </p>
                </div>
              </div>

              <div className="text-xs font-mono font-bold px-3 py-1.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border border-purple-200 dark:border-purple-800 self-start sm:self-auto">
                {pendingChallengesCount} Pending Action
              </div>
            </div>

            {/* Chain of events reminder card */}
            <div className="p-3.5 rounded-xl bg-purple-50/70 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900/40 text-xs text-purple-900 dark:text-purple-200 flex items-start space-x-2.5">
              <UserCheck className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold">Chain of Events: </span>
                <span>
                  Candidate Challenges Answer ➔ <strong>Evaluator Reviews & Recommends Revision (or Upholding)</strong> ➔ Forwarded to Administrator ➔ Admin Authorizes Final Resolution ➔ Scorecard Updated Automatically.
                </span>
              </div>
            </div>
          </div>

          {/* Challenges List Card */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {relevantChallenges.length === 0 ? (
                <div className="py-16 text-center text-slate-400 text-xs space-y-2">
                  <HelpCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                  <p className="font-medium text-slate-500">No question challenges lodged for your assigned examinations.</p>
                  <p className="text-[11px] text-slate-400">
                    When candidates contest a question after results publication, their tickets will appear here for academic review.
                  </p>
                </div>
              ) : (
                relevantChallenges.map((ch) => {
                  const isPending = ch.status === 'submitted';
                  const isForwarded = ch.status === 'forwarded_to_admin';
                  const isAccepted = ch.status === 'resolved_accepted';
                  const isRejected = ch.status === 'resolved_rejected';

                  return (
                    <div
                      key={ch.id}
                      className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition-colors"
                    >
                      <div className="space-y-2 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                            {ch.questionTitle}
                          </span>
                          {isAccepted ? (
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Accepted: Revised to {ch.finalAwardedMarks} Pts</span>
                            </span>
                          ) : isRejected ? (
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center space-x-1">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Rejected: Original Mark Upheld</span>
                            </span>
                          ) : isForwarded ? (
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-purple-600" />
                              <span>Forwarded to Admin ({ch.evaluatorDecision === 'recommend_accept' ? `Rec: ${ch.evaluatorRecommendedMarks} pts` : 'Rec: Reject'})</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Needs Evaluator Review</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Exam: <strong className="text-slate-700 dark:text-slate-300">{ch.examTitle}</strong></span>
                          <span>• Candidate: <strong className="text-slate-700 dark:text-slate-300">{ch.participantName}</strong> ({ch.participantEmail})</span>
                          <span>• Current Mark: <strong className="text-slate-700 dark:text-slate-300">{ch.originalMarksAwarded} / {ch.questionMarks} Pts</strong></span>
                          <span>• Lodged: {new Date(ch.submittedAt).toLocaleDateString()}</span>
                        </div>

                        {/* Candidate response & appeal note */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1 text-xs">
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block mb-0.5">
                              Student's Answer:
                            </span>
                            <p className="font-mono text-[11px] text-slate-700 dark:text-slate-300 line-clamp-2">
                              {ch.candidateAnswer}
                            </p>
                          </div>

                          <div className="p-2.5 rounded-xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40">
                            <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 block mb-0.5">
                              Appeal Justification ({ch.challengeReason}):
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 line-clamp-2">
                              "{ch.candidateExplanation}"
                            </p>
                          </div>
                        </div>

                        {ch.supportingReference && (
                          <div className="flex items-center space-x-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                            <BookOpen className="w-3.5 h-3.5 shrink-0" />
                            <span className="font-semibold">Reference:</span>
                            <span>{ch.supportingReference}</span>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col sm:flex-row lg:flex-col items-stretch lg:items-end gap-2 shrink-0">
                        {isPending && !isViewOnlyAdmin ? (
                          <button
                            type="button"
                            onClick={() => setReviewChallengeModalItem(ch)}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-900/20 transition-all flex items-center justify-center space-x-1.5"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Review & Recommend Revision</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setViewDetailsChallenge(ch)}
                            className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center space-x-1.5"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>View Challenge Dossier</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Forward Evaluations Modal */}
      {forwardModalExam && (
        <ForwardEvaluationsModal
          isOpen={Boolean(forwardModalExam)}
          exam={forwardModalExam}
          submissions={submissions}
          evaluatorName={profile?.displayName || 'Evaluator'}
          evaluatorId={profile?.uid || 'evaluator'}
          onClose={() => setForwardModalExam(null)}
          onSuccess={(msg) => {
            setSuccessNotice(msg);
            setTimeout(() => setSuccessNotice(null), 5000);
            loadSubmissions();
          }}
        />
      )}

      {/* Review Challenge Modal */}
      {reviewChallengeModalItem && (
        <ReviewChallengeModal
          isOpen={Boolean(reviewChallengeModalItem)}
          challenge={reviewChallengeModalItem}
          evaluatorId={profile?.uid || 'evaluator'}
          evaluatorName={profile?.displayName || 'Evaluator'}
          onClose={() => setReviewChallengeModalItem(null)}
          onSuccess={() => {
            setSuccessNotice('Challenge recommendation submitted and forwarded to Administrator.');
            setTimeout(() => setSuccessNotice(null), 5000);
            loadSubmissions();
          }}
        />
      )}

      {/* View Challenge Details Modal */}
      {viewDetailsChallenge && (
        <ChallengeDetailsModal
          isOpen={Boolean(viewDetailsChallenge)}
          challenge={viewDetailsChallenge}
          onClose={() => setViewDetailsChallenge(null)}
        />
      )}

      {/* Recommend Skip Debatable Question Modal */}
      {recommendSkipModalQ && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="flex items-center space-x-3 pb-3 border-b border-slate-100 dark:border-slate-800">
              <span className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Recommend Skipping Debatable Question
                </h3>
                <p className="text-xs text-slate-500">
                  Academic recommendation for Institutional Administrator approval
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs space-y-1">
              <span className="font-bold text-slate-900 dark:text-white">
                {recommendSkipModalQ.title}
              </span>
              <p className="text-[11px] text-slate-500">
                {recommendSkipModalQ.marks} Marks • Type: {recommendSkipModalQ.type}
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              If approved by the Administrator, this debatable question will be excluded from the examination. Total exam marks will decrease by {recommendSkipModalQ.marks} marks and passing marks will be proportionately reduced. All candidate submissions will be re-evaluated accordingly, and pre-challenge scorecards and answer sheets will be preserved for administrator audit.
            </p>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Reason / Academic Grounds for Skipping:
              </label>
              <textarea
                rows={3}
                value={skipReasonText}
                onChange={(e) => setSkipReasonText(e.target.value)}
                placeholder="Explain why this question is ambiguous, flawed, or has multiple correct answers..."
                className="w-full p-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-amber-500"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRecommendSkipModalQ(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingSkipRec || !skipReasonText.trim()}
                onClick={handleRecommendSkipQuestion}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-900/20 disabled:opacity-50 transition-all cursor-pointer"
              >
                {submittingSkipRec ? 'Submitting...' : 'Submit Recommendation to Admin'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
