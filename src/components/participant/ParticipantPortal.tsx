import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { examService } from '../../services/examService';
import { Exam, Question, Submission, UserProfile, QuestionChallenge } from '../../types/exam';
import { ExamTakingView } from './ExamTakingView';
import { ExamAttemptSlipModal } from './ExamAttemptSlipModal';
import { OfficialScorecardModal } from './OfficialScorecardModal';
import { ChallengeDetailsModal } from '../common/ChallengeDetailsModal';
import {
  GraduationCap,
  Clock,
  BookOpen,
  Award,
  CheckCircle2,
  XCircle,
  Play,
  FileCheck,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  RefreshCw,
  X,
  Lock,
  ShieldAlert,
  Calendar,
  Printer
} from 'lucide-react';

export const ParticipantPortal: React.FC = () => {
  const { profile, isAdmin, activeRole } = useAuth();
  const isViewOnlyAdmin = (isAdmin || profile?.role === 'admin') && activeRole === 'participant';
  const [activeTab, setActiveTab] = useState<'available' | 'results' | 'challenges'>('available');
  const [exams, setExams] = useState<Exam[]>([]);
  const [mySubmissions, setMySubmissions] = useState<Submission[]>([]);
  const [myChallenges, setMyChallenges] = useState<QuestionChallenge[]>([]);
  const [selectedChallengeForModal, setSelectedChallengeForModal] = useState<QuestionChallenge | null>(null);
  const [loading, setLoading] = useState(true);

  // Active taking session
  const [activeTakingSession, setActiveTakingSession] = useState<{
    exam: Exam;
    submission: Submission;
    questions: Question[];
  } | null>(null);

  // Instructions modal before exam start
  const [selectedExamToStart, setSelectedExamToStart] = useState<Exam | null>(null);
  const [integrityPledgeChecked, setIntegrityPledgeChecked] = useState(false);
  const [starting, setStarting] = useState(false);

  // Attempt slip modal (no marks, questions attempted/unattempted)
  const [attemptSlipSubmission, setAttemptSlipSubmission] = useState<{
    submission: Submission;
    exam: Exam | null;
    questions: Question[];
  } | null>(null);

  // Official evaluated scorecard modal (when results are published)
  const [officialScorecardModal, setOfficialScorecardModal] = useState<{
    submission: Submission;
    exam: Exam | null;
  } | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const allExams = await examService.getPublishedExams().catch(() => []);
      const allSubs = profile?.uid
        ? await examService.getSubmissionsByParticipant(profile.uid).catch(() => [])
        : [];
      const allChallenges = profile?.uid
        ? await examService.getChallengesForParticipant(profile.uid).catch(() => [])
        : [];
      setExams(allExams || []);
      setMySubmissions(allSubs || []);
      setMyChallenges(allChallenges || []);
    } catch (err) {
      console.error('Error loading participant portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [profile?.uid]);

  const handleStartExamFlow = (exam: Exam) => {
    if (isViewOnlyAdmin) {
      alert('Access Denied: Administrator is in view-only inspection mode and cannot participate in examinations.');
      return;
    }
    if (!profile || !examService.isParticipantEnrolled(exam, profile)) {
      alert('Access Denied: You are not enrolled in this examination. Candidates must be linked by the Administrator to participate.');
      return;
    }
    setSelectedExamToStart(exam);
    setIntegrityPledgeChecked(false);
  };

  const handleConfirmStartExam = async () => {
    if (isViewOnlyAdmin) {
      alert('Access Denied: Administrator is in view-only inspection mode and cannot participate in examinations.');
      return;
    }
    if (!selectedExamToStart) return;
    if (!profile || !examService.isParticipantEnrolled(selectedExamToStart, profile)) {
      alert('Access Denied: You are not enrolled in this examination.');
      return;
    }
    try {
      setStarting(true);
      const activeCandidateProfile: UserProfile = profile || {
        uid: 'candidate_' + Math.random().toString(36).substring(2, 8),
        displayName: 'Guest Candidate',
        email: 'candidate@examforge.internal',
        role: 'participant',
        createdAt: new Date().toISOString(),
      };

      // Start or resume submission
      const sub = await examService.startSubmission(selectedExamToStart, activeCandidateProfile);
      const qList = await examService.getQuestionsForCandidate(selectedExamToStart.id);

      setSelectedExamToStart(null);
      setActiveTakingSession({
        exam: selectedExamToStart,
        submission: sub,
        questions: qList,
      });
    } catch (err: any) {
      console.error(err);
      alert('Could not start exam: ' + err.message);
    } finally {
      setStarting(false);
    }
  };

  const handleResumeSubmission = async (sub: Submission) => {
    if (isViewOnlyAdmin) {
      alert('Access Denied: Administrator is in view-only inspection mode and cannot participate in examinations.');
      return;
    }
    try {
      setLoading(true);
      const exam = await examService.getExamById(sub.examId);
      if (!exam) return;
      if (!profile || !examService.isParticipantEnrolled(exam, profile)) {
        alert('Access Denied: You are not enrolled in this examination.');
        return;
      }
      const qList = await examService.getQuestionsForCandidate(sub.examId);
      setActiveTakingSession({
        exam,
        submission: sub,
        questions: qList,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAttemptSlip = async (sub: Submission) => {
    try {
      setLoading(true);
      const exam = await examService.getExamById(sub.examId);
      const qList = await examService.getQuestionsForCandidate(sub.examId);
      setAttemptSlipSubmission({
        submission: sub,
        exam,
        questions: qList,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenOfficialScorecard = async (sub: Submission) => {
    try {
      setLoading(true);
      const exam = await examService.getExamById(sub.examId);
      setOfficialScorecardModal({
        submission: sub,
        exam,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleExamFinished = (updatedSub: Submission) => {
    setActiveTakingSession(null);
    loadData();
    // Open Attempt Slip immediately to view/print attempted & unattempted questions
    handleOpenAttemptSlip(updatedSub);
  };

  // Filter exams that this candidate is explicitly enrolled in by Administrator
  const allocatedExams = exams.filter((exam) => {
    if (isViewOnlyAdmin) return true;
    if (!profile) return false;
    return examService.isParticipantEnrolled(exam, profile);
  });

  // If candidate is actively taking an exam:
  if (activeTakingSession) {
    return (
      <ExamTakingView
        exam={activeTakingSession.exam}
        submission={activeTakingSession.submission}
        questions={activeTakingSession.questions}
        onFinish={handleExamFinished}
        onExit={() => {
          if (confirm('Are you sure you want to pause exam session? Answers are auto-saved.')) {
            setActiveTakingSession(null);
            loadData();
          }
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Administrator View-Only Banner */}
      {isViewOnlyAdmin && (
        <div className="bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/40 rounded-2xl p-4 flex items-center space-x-3 text-amber-900 dark:text-amber-200 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">Administrator Inspection Mode (View-Only):</span> You are previewing the Candidate Examination portal. As Administrator, you cannot start, take, or submit examinations. Examination participation is reserved exclusively for enrolled Candidates.
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-emerald-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <GraduationCap className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight">Participant Examination Portal</h1>
            </div>
            <p className="text-xs text-emerald-200/80 mt-1 max-w-2xl leading-relaxed">
              Welcome, <span className="font-bold underline">{profile?.displayName || 'Candidate'}</span>. Access your scheduled examinations, take tests in a secure proctored environment, and review your evaluated scorecards.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-semibold backdrop-blur-xs transition-colors self-start md:self-auto"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Portal</span>
          </button>
        </div>

        {/* Quick summary tabs */}
        <div className="flex space-x-4 mt-6 pt-5 border-t border-white/10 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('available')}
            className={`font-semibold pb-1 border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'available'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-white/70 hover:text-white'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Allocated Tests ({allocatedExams.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('results')}
            className={`font-semibold pb-1 border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'results'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-white/70 hover:text-white'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>My Results & Scorecards ({mySubmissions.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('challenges')}
            className={`font-semibold pb-1 border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'challenges'
                ? 'border-emerald-400 text-emerald-300'
                : 'border-transparent text-white/70 hover:text-white'
            }`}
          >
            <HelpCircle className="w-4 h-4" />
            <span>Question Challenges & Appeals ({myChallenges.length})</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Available Tests */}
      {activeTab === 'available' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Allocated Examinations & Live Schedule
            </h2>
            <span className="text-xs text-slate-500">
              Select any allocated live test to review instructions and start
            </span>
          </div>

          {allocatedExams.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-10 sm:p-12 text-center text-slate-500 dark:text-slate-400 text-xs shadow-xs space-y-3">
              <div className="w-14 h-14 rounded-3xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto border border-indigo-200 dark:border-indigo-800">
                <GraduationCap className="w-7 h-7" />
              </div>
              <h3 className="font-extrabold text-slate-900 dark:text-white text-base">
                No Allocated Examinations Found
              </h3>
              <p className="max-w-md mx-auto text-slate-500 dark:text-slate-400 leading-relaxed text-xs">
                You are registered in the general candidate pool, but you have not been linked to any examination paper. Only candidates explicitly enrolled by the Administrator can view and take scheduled examinations.
              </p>
              <div className="pt-2">
                <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-[11px] font-mono font-bold bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  <span>Candidate ID: {profile?.employeeId || profile?.uid.slice(0, 8)}</span>
                  <span>•</span>
                  <span>Status: General Pool (Unlinked)</span>
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {allocatedExams.map((exam) => {
                  const existingSub = mySubmissions.find((s) => s.examId === exam.id);
                  const isFinished = existingSub && existingSub.status !== 'in_progress';
                  const isInProgress = existingSub && existingSub.status === 'in_progress';

                  // Live Schedule calculations
                  const isAuthorized = exam.scheduleStatus === 'schedule_authorized';
                  const nowMs = Date.now();
                  const startMs = exam.scheduledStartTime ? new Date(exam.scheduledStartTime).getTime() : null;
                  const endMs = exam.scheduledEndTime ? new Date(exam.scheduledEndTime).getTime() : null;

                  const isUpcoming = isAuthorized && startMs && nowMs < startMs;
                  const isLive = isAuthorized && (!startMs || nowMs >= startMs) && (!endMs || nowMs <= endMs);
                  const isExpired = isAuthorized && endMs && nowMs > endMs;

                  return (
                    <div
                      key={exam.id}
                      className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col justify-between hover:shadow-md transition-shadow group"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                              {exam.subject}
                            </span>
                            {exam.assignedParticipantIds?.includes(profile?.uid || '') && (
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                Allocated
                              </span>
                            )}
                            {exam.negativeMarkingEnabled && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                -{exam.negativeMarksPerQuestion || '0.25'} Negative Marking
                              </span>
                            )}
                          </div>
                          {exam.proctoringEnabled && (
                            <span className="flex items-center space-x-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-400">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Proctored</span>
                            </span>
                          )}
                        </div>

                        <h3 className="text-sm font-bold text-slate-900 dark:text-white line-clamp-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                          {exam.title}
                        </h3>

                        <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                          {exam.description || 'Comprehensive evaluation covering course objectives.'}
                        </p>

                        {/* Live Schedule Status Indicator */}
                        <div className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-750 text-[11px] space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500 flex items-center space-x-1">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              <span>Live Schedule:</span>
                            </span>
                            {isLive ? (
                              <span className="px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[9px] animate-pulse">
                                🟢 LIVE NOW
                              </span>
                            ) : isUpcoming ? (
                              <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-bold text-[9px]">
                                UPCOMING
                              </span>
                            ) : isExpired ? (
                              <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300 font-bold text-[9px]">
                                CLOSED
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold text-[9px]">
                                PENDING ADMIN APPROVAL
                              </span>
                            )}
                          </div>

                          {exam.scheduledStartTime && (
                            <div className="text-[10px] text-slate-600 dark:text-slate-300">
                              Window: {new Date(exam.scheduledStartTime).toLocaleString()}
                              {exam.scheduledEndTime ? ` to ${new Date(exam.scheduledEndTime).toLocaleTimeString()}` : ''}
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60 text-center text-[11px]">
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-750">
                            <span className="text-slate-400 block">Duration</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {exam.durationMinutes}m
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-750">
                            <span className="text-slate-400 block">Questions</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {exam.questionsCount || 'TBD'}
                            </span>
                          </div>
                          <div className="p-2 rounded-xl bg-slate-50 dark:bg-slate-750">
                            <span className="text-slate-400 block">Max Marks</span>
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">
                              {exam.totalMarks} pts
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700">
                        {isFinished ? (
                          <div className="space-y-2">
                            <button
                              type="button"
                              onClick={() => handleOpenAttemptSlip(existingSub)}
                              className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl border border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 transition-colors"
                            >
                              <FileCheck className="w-3.5 h-3.5" />
                              <span>View / Print Attempt Slip</span>
                            </button>
                            {examService.isResultPublishedForExam(exam) && (
                              <button
                                type="button"
                                onClick={() => handleOpenOfficialScorecard(existingSub)}
                                className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/20 transition-all"
                              >
                                <Award className="w-3.5 h-3.5" />
                                <span>View Evaluated Scorecard</span>
                              </button>
                            )}
                          </div>
                        ) : isViewOnlyAdmin ? (
                          <div className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-750 text-slate-400 text-xs font-semibold cursor-not-allowed">
                            <Lock className="w-3.5 h-3.5" />
                            <span>View-Only (Admin Cannot Participate)</span>
                          </div>
                        ) : !isAuthorized ? (
                          <div className="w-full text-center py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-medium cursor-not-allowed">
                            Schedule Pending Authorization
                          </div>
                        ) : isUpcoming ? (
                          <div className="w-full text-center py-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 text-xs font-medium cursor-not-allowed">
                            Scheduled: Opens {new Date(exam.scheduledStartTime!).toLocaleTimeString()}
                          </div>
                        ) : isExpired ? (
                          <div className="w-full text-center py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-medium cursor-not-allowed">
                            Exam Window Closed
                          </div>
                        ) : isInProgress ? (
                          <button
                            type="button"
                            onClick={() => handleResumeSubmission(existingSub)}
                            className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold shadow-md shadow-amber-900/30 transition-all"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Resume Ongoing Exam</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartExamFlow(exam)}
                            className="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/20 transition-all animate-pulse"
                          >
                            <Play className="w-3.5 h-3.5 fill-current" />
                            <span>Begin Examination</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Response Receipts & Attempt Slips */}
      {activeTab === 'results' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                My Examination Response Submissions
              </h3>
              <p className="text-xs text-slate-500">
                Official candidate attempt slips • Marks withheld as per academic evaluation policy
              </p>
            </div>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {mySubmissions.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                You have not attempted any exams yet. Start an exam from the "Allocated Examinations" tab.
              </div>
            ) : (
              mySubmissions.map((sub) => {
                const subExam = exams.find((e) => e.id === sub.examId);
                const isResultPublished = examService.isResultPublishedForExam(subExam);
                const attemptedCount = Object.values(sub.answers || {}).filter(
                  (a) => a?.answer?.trim()
                ).length;

                return (
                  <div
                    key={sub.id}
                    className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-750/50 transition-colors"
                  >
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {sub.examTitle}
                        </span>
                        {isResultPublished ? (
                          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1">
                            <Award className="w-3 h-3 text-emerald-600" />
                            <span>Official Result Published</span>
                          </span>
                        ) : subExam?.scheduledResultReleaseTime && subExam.evaluationForwardStatus === 'results_authorized' ? (
                          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-purple-600" />
                            <span>Results Scheduled: {new Date(subExam.scheduledResultReleaseTime).toLocaleDateString()} at {new Date(subExam.scheduledResultReleaseTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-750 dark:text-slate-300">
                            Under Evaluation (Confidential)
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">
                        Submitted: {new Date(sub.submittedAt || sub.startedAt).toLocaleString()}
                        <span className="ml-2 font-medium text-indigo-600 dark:text-indigo-400">
                          • {attemptedCount} Questions Attempted
                        </span>
                        {sub.tabSwitchCount > 0 && (
                          <span className="ml-2 text-amber-600 font-medium">
                            • {sub.tabSwitchCount} tab switch logged
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenAttemptSlip(sub)}
                        className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold text-xs transition-colors flex items-center space-x-1.5"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print Attempt Slip</span>
                      </button>

                      {isResultPublished && (
                        <button
                          type="button"
                          onClick={() => handleOpenOfficialScorecard(sub)}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/20 transition-all flex items-center space-x-1.5"
                        >
                          <Award className="w-3.5 h-3.5" />
                          <span>View Evaluated Scorecard</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Question Challenges & Academic Appeals */}
      {activeTab === 'challenges' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                My Question Challenges & Answer Key Appeals
              </h3>
              <p className="text-xs text-slate-500">
                Official institutional review progress across all contested examination items
              </p>
            </div>
            <span className="text-xs font-mono font-bold px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
              {myChallenges.length} Total Appeals
            </span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {myChallenges.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs space-y-2">
                <HelpCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                <p>You have not lodged any question challenges yet.</p>
                <p className="text-[11px] text-slate-500">
                  To challenge a question, open any published result scorecard and click "Challenge Question Evaluation / Key".
                </p>
              </div>
            ) : (
              myChallenges.map((ch) => {
                return (
                  <div
                    key={ch.id}
                    className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-slate-750/50 transition-colors"
                  >
                    <div className="space-y-1.5 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-xs sm:text-sm text-slate-900 dark:text-white">
                          {ch.questionTitle}
                        </span>
                        {ch.status === 'resolved_accepted' ? (
                          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                            <span>Accepted • Revised: {ch.finalAwardedMarks} Pts</span>
                          </span>
                        ) : ch.status === 'resolved_rejected' ? (
                          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center space-x-1">
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>Rejected • Original Upheld</span>
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-amber-600" />
                            <span>
                              {ch.status === 'forwarded_to_admin'
                                ? 'Evaluator Reviewed • Awaiting Admin'
                                : 'Under Evaluator Review'}
                            </span>
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>Exam: <strong className="text-slate-700 dark:text-slate-300">{ch.examTitle}</strong></span>
                        <span>• Original Score: <strong className="text-slate-700 dark:text-slate-300">{ch.originalMarksAwarded} / {ch.questionMarks} Pts</strong></span>
                        <span>• Lodged: {new Date(ch.submittedAt).toLocaleDateString()}</span>
                      </div>

                      <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-1 italic bg-slate-50 dark:bg-slate-800/80 p-2 rounded-lg border border-slate-200 dark:border-slate-700">
                        "{ch.candidateExplanation}"
                      </p>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSelectedChallengeForModal(ch)}
                        className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center space-x-1.5"
                      >
                        <HelpCircle className="w-3.5 h-3.5" />
                        <span>View Full Dossier</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Pre-Exam Instructions & Integrity Pledge Modal */}
      {selectedExamToStart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                  <ShieldCheck className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Examination Guidelines & Integrity Pledge
                  </h3>
                  <p className="text-[11px] text-slate-500">{selectedExamToStart.title}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedExamToStart(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-750 text-xs text-slate-700 dark:text-slate-300 space-y-2 leading-relaxed">
              <div className="font-bold text-slate-900 dark:text-white uppercase tracking-wider text-[11px]">
                Exam Instructions:
              </div>
              <div className="whitespace-pre-line font-mono text-[11px] text-slate-600 dark:text-slate-400">
                {selectedExamToStart.instructions || 'Answer all questions. Ensure stable connection.'}
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300">
                Duration: <span className="font-bold">{selectedExamToStart.durationMinutes} Minutes</span> • Total Marks: <span className="font-bold">{selectedExamToStart.totalMarks}</span> • Passing: <span className="font-bold text-emerald-600">{selectedExamToStart.passingMarks}</span>
              </div>
            </div>

            {selectedExamToStart.proctoringEnabled && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-200 flex items-start space-x-2.5">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                <span>
                  Anti-Cheating Policy: Switching browser tabs or minimizing the window will be automatically logged and flagged to the examiner.
                </span>
              </div>
            )}

            <label className="flex items-start space-x-2.5 cursor-pointer pt-2">
              <input
                type="checkbox"
                checked={integrityPledgeChecked}
                onChange={(e) => setIntegrityPledgeChecked(e.target.checked)}
                className="mt-0.5 rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                I hereby pledge that I will complete this assessment independently with integrity, following all testing rules.
              </span>
            </label>

            <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100 dark:border-slate-700">
              <button
                type="button"
                onClick={() => setSelectedExamToStart(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!integrityPledgeChecked || starting}
                onClick={handleConfirmStartExam}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/30 transition-all disabled:opacity-40"
              >
                {starting ? 'Initializing Session...' : 'I Agree & Start Test'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Response & Attempt Slip Modal (No marks shown) */}
      {attemptSlipSubmission && (
        <ExamAttemptSlipModal
          submission={attemptSlipSubmission.submission}
          exam={attemptSlipSubmission.exam}
          questions={attemptSlipSubmission.questions}
          onClose={() => setAttemptSlipSubmission(null)}
        />
      )}

      {/* Official Evaluated Scorecard Modal (When Results are Published) */}
      {officialScorecardModal && (
        <OfficialScorecardModal
          isOpen={Boolean(officialScorecardModal)}
          submission={officialScorecardModal.submission}
          exam={officialScorecardModal.exam}
          onClose={() => setOfficialScorecardModal(null)}
          onRefresh={loadData}
        />
      )}

      {/* Challenge Details Modal */}
      {selectedChallengeForModal && (
        <ChallengeDetailsModal
          isOpen={Boolean(selectedChallengeForModal)}
          challenge={selectedChallengeForModal}
          onClose={() => setSelectedChallengeForModal(null)}
        />
      )}
    </div>
  );
};
