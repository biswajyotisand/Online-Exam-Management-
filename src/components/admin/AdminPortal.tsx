import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { examService } from '../../services/examService';
import { Exam, Submission, UserProfile, AuditLog, UserRole } from '../../types/exam';
import { RoleBadge } from '../common/RoleBadge';
import {
  Shield,
  Users,
  FileText,
  Activity,
  CheckCircle,
  Clock,
  Trash2,
  Edit,
  RefreshCw,
  Search,
  Filter,
  AlertTriangle,
  Award,
  BookOpen,
  KeyRound,
  Lock,
  Check,
  ShieldAlert,
  Sparkles,
  UserPlus,
  GraduationCap,
  CheckSquare,
  Copy,
  Building,
  Mail,
  IdCard,
  PlusCircle,
  Eye,
  EyeOff,
  X,
  ShieldCheck,
  Calendar,
  Play,
  CheckCircle2,
  ExternalLink,
  Layers,
  Plus,
  Link2,
  Unlink,
  Zap,
  HelpCircle,
  XCircle,
  UserCheck,
  ArrowRight
} from 'lucide-react';
import { SetDefaultPasswordModal } from './SetDefaultPasswordModal';
import { SecurityPasscodesManager } from './SecurityPasscodesManager';
import { EnrollCandidateModal } from './EnrollCandidateModal';
import { AddStaffModal } from './AddStaffModal';
import { GenerateExamModal } from './GenerateExamModal';
import { ManageExamAssignmentsModal } from './ManageExamAssignmentsModal';
import { AlterExamScheduleModal } from './AlterExamScheduleModal';
import { InspectExamQuestionsModal } from './InspectExamQuestionsModal';
import { InspectExamSubmissionsModal } from './InspectExamSubmissionsModal';
import { LinkCandidateToExamModal } from './LinkCandidateToExamModal';
import { AuthorizeResultsPublicationModal } from './AuthorizeResultsPublicationModal';
import { AuthorizeChallengeModal } from './AuthorizeChallengeModal';
import { ChallengeDetailsModal } from '../common/ChallengeDetailsModal';
import { ExamScorecardsDashboard } from './ExamScorecardsDashboard';
import { AdmitCardModal } from './AdmitCardModal';
import { QuestionChallenge } from '../../types/exam';

export const AdminPortal: React.FC = () => {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState<
    'exams' | 'overview' | 'participants' | 'paper_setters' | 'evaluators' | 'challenges' | 'scorecards' | 'security' | 'logs'
  >('exams');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [exams, setExams] = useState<Exam[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [challenges, setChallenges] = useState<QuestionChallenge[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  // Search & Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [examFilter, setExamFilter] = useState<string>('all');
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Candidate linking state
  const [linkCandidateModalUser, setLinkCandidateModalUser] = useState<UserProfile | null>(null);
  const [selectedCandidateUids, setSelectedCandidateUids] = useState<string[]>([]);
  const [bulkLinkModalOpen, setBulkLinkModalOpen] = useState(false);

  // Exam Command Center state
  const [examSearchQuery, setExamSearchQuery] = useState('');
  const [examStatusFilter, setExamStatusFilter] = useState<string>('all');
  const [generateExamModalOpen, setGenerateExamModalOpen] = useState(false);
  const [manageAssignmentsExam, setManageAssignmentsExam] = useState<Exam | null>(null);
  const [alterScheduleExam, setAlterScheduleExam] = useState<Exam | null>(null);
  const [inspectQuestionsExam, setInspectQuestionsExam] = useState<Exam | null>(null);
  const [inspectSubmissionsExam, setInspectSubmissionsExam] = useState<Exam | null>(null);
  const [authorizeResultsExam, setAuthorizeResultsExam] = useState<Exam | null>(null);
  const [authorizeChallengeModalItem, setAuthorizeChallengeModalItem] = useState<QuestionChallenge | null>(null);
  const [viewChallengeDetailsAdmin, setViewChallengeDetailsAdmin] = useState<QuestionChallenge | null>(null);

  // Admit Card Generation Modal state
  const [admitCardExam, setAdmitCardExam] = useState<Exam | null>(null);
  const [admitCardCandidateId, setAdmitCardCandidateId] = useState<string | undefined>(undefined);

  // Modals state
  const [passwordModalUser, setPasswordModalUser] = useState<UserProfile | null>(null);
  const [enrollCandidateModalOpen, setEnrollCandidateModalOpen] = useState(false);
  const [addStaffModalOpen, setAddStaffModalOpen] = useState(false);
  const [staffModalRole, setStaffModalRole] = useState<'paper_setter' | 'evaluator'>('paper_setter');
  const [candidateDefaultPassword, setCandidateDefaultPassword] = useState('Candidate@2026');
  const [syncAllModalOpen, setSyncAllModalOpen] = useState(false);
  const [newBulkPassword, setNewBulkPassword] = useState('Candidate@2026');
  const [syncingAll, setSyncingAll] = useState(false);

  // Copy indicator state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const [u, e, s, l, defPass, chList] = await Promise.all([
        examService.getAllUsers(),
        examService.getAllExams(),
        examService.getAllSubmissions(),
        examService.getAuditLogs(),
        examService.getParticipantDefaultPassword(),
        examService.getAllChallenges().catch(() => []),
      ]);
      setUsers(u);
      setExams(e);
      setSubmissions(s);
      setLogs(l);
      setCandidateDefaultPassword(defPass);
      setNewBulkPassword(defPass);
      setChallenges(chList);
    } catch (err) {
      console.error('Error loading admin portal data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSyncAllCandidates = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBulkPassword.trim()) return;
    try {
      setSyncingAll(true);
      const count = await examService.syncDefaultPasswordForAllParticipants(newBulkPassword.trim());
      setCandidateDefaultPassword(newBulkPassword.trim());
      setActionSuccess(
        `Default password "${newBulkPassword.trim()}" successfully synchronized for all ${count} candidates.`
      );
      setTimeout(() => setActionSuccess(null), 4000);
      setSyncAllModalOpen(false);
      await loadData();
    } catch (err: any) {
      alert(`Sync failed: ${err?.message || 'Error'}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const handleToggleOperational = async (uid: string, currentStatus?: boolean) => {
    try {
      await examService.adminToggleOperationalStatus(uid, !currentStatus);
      setActionSuccess(`Operational status updated for staff member.`);
      setTimeout(() => setActionSuccess(null), 3000);
      await loadData();
    } catch (err) {
      console.error('Failed to toggle operational status:', err);
    }
  };

  const handleUnlinkCandidate = async (u: UserProfile) => {
    const assignedExam = exams.find(
      (e) =>
        e.id === u.assignedExamId ||
        (e.assignedParticipantIds && e.assignedParticipantIds.includes(u.uid))
    );
    if (
      !window.confirm(
        `Are you sure you want to unlink candidate "${u.displayName}" (${u.employeeId || 'ID'}) from "${assignedExam?.title || 'Exam'}"?\n\nThis will remove them from the enrolled candidates for this examination and return them to the general pool.`
      )
    ) {
      return;
    }

    try {
      await examService.unlinkParticipantFromExam(u.uid, assignedExam?.id || u.assignedExamId);
      setActionSuccess(
        `Candidate "${u.displayName}" unlinked from examination. Enrolled candidate roster updated.`
      );
      setTimeout(() => setActionSuccess(null), 3500);
      await loadData();
    } catch (err: any) {
      alert(`Failed to unlink candidate: ${err?.message || 'Error'}`);
    }
  };

  const handleDeleteUser = async (uid: string, name: string) => {
    if (!window.confirm(`Are you sure you want to remove "${name}"? This action will revoke their access.`)) {
      return;
    }
    try {
      await examService.deleteUserByAdmin(uid);
      setActionSuccess(`User "${name}" removed successfully.`);
      setTimeout(() => setActionSuccess(null), 3000);
      await loadData();
    } catch (err: any) {
      alert(`Failed to delete user: ${err?.message || 'Error'}`);
    }
  };

  const handleAuthorizeProposedSchedule = async (exam: Exam) => {
    try {
      await examService.authorizeExamSchedule(exam.id, profile?.displayName || 'Administrator');
      setActionSuccess(`Live schedule for "${exam.title}" successfully authorized & published!`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadData();
    } catch (err: any) {
      alert(`Failed to authorize schedule: ${err?.message || 'Error'}`);
    }
  };

  const handlePublishResultsImmediately = async (exam: Exam) => {
    if (
      !window.confirm(
        `Are you sure you want to publish results immediately for "${exam.title}"? Candidates will be able to view their evaluated scorecards right now.`
      )
    ) {
      return;
    }
    try {
      await examService.publishResultsImmediately(exam.id, profile?.displayName || 'Administrator');
      setActionSuccess(`Results published live to candidates for "${exam.title}"!`);
      setTimeout(() => setActionSuccess(null), 4000);
      await loadData();
    } catch (err: any) {
      alert(`Failed to publish results: ${err?.message || 'Error'}`);
    }
  };

  const handleDeleteExam = async (examId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to delete exam "${title}"? All associated questions will be deleted.`)) {
      return;
    }
    try {
      await examService.deleteExam(examId);
      setActionSuccess(`Exam "${title}" deleted successfully.`);
      setTimeout(() => setActionSuccess(null), 3000);
      await loadData();
    } catch (err: any) {
      alert(`Failed to delete exam: ${err?.message || 'Error'}`);
    }
  };

  const handleToggleSelectCandidate = (uid: string) => {
    setSelectedCandidateUids((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectAllFilteredCandidates = () => {
    if (selectedCandidateUids.length === filteredParticipants.length) {
      setSelectedCandidateUids([]);
    } else {
      setSelectedCandidateUids(filteredParticipants.map((p) => p.uid));
    }
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Grouped user lists
  const participants = users.filter((u) => u.role === 'participant');
  const paperSetters = users.filter((u) => u.role === 'paper_setter');
  const evaluators = users.filter((u) => u.role === 'evaluator');

  // Filtered lists based on search and exam filter
  const filterList = (list: UserProfile[]) => {
    return list.filter((u) => {
      const matchSearch =
        u.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.employeeId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.department?.toLowerCase().includes(searchTerm.toLowerCase());

      const targetExam = exams.find((e) => e.id === examFilter);
      const matchExam =
        examFilter === 'all' ||
        u.assignedExamId === examFilter ||
        (targetExam?.assignedParticipantIds && targetExam.assignedParticipantIds.includes(u.uid));
      return matchSearch && matchExam;
    });
  };

  const filteredParticipants = filterList(participants);
  const filteredPaperSetters = filterList(paperSetters);
  const filteredEvaluators = filterList(evaluators);

  // Statistics
  const totalExams = exams.length;
  const publishedExams = exams.filter((e) => e.status === 'published' || e.status === 'in_progress').length;
  const totalSubmissions = submissions.length;
  const pendingEvaluations = submissions.filter((s) => s.status === 'submitted').length;
  const completedEvaluations = submissions.filter((s) => s.status === 'evaluated').length;

  return (
    <div className="space-y-6">
      {/* Top Banner Card */}
      <div className="bg-gradient-to-r from-rose-900 via-rose-800 to-slate-900 rounded-3xl p-6 sm:p-8 text-white shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-semibold mb-3">
              <Shield className="w-3.5 h-3.5" />
              <span>Institutional Assessment Governance</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Administrator Master Control
            </h1>
            <p className="text-rose-100 text-xs sm:text-sm mt-1 max-w-xl">
              Exam-based management hub: Generate exams, designate Paper Setters, Evaluators & Candidates per exam, authorize or alter live date & time schedules, and control multiple exams simultaneously.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="flex items-center space-x-2 px-3.5 py-2.5 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white backdrop-blur-xs transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {actionSuccess && (
          <div className="mt-4 p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center space-x-2 animate-in fade-in">
            <CheckCircle className="w-4 h-4 shrink-0" />
            <span>{actionSuccess}</span>
          </div>
        )}

        {/* Quick Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-6 border-t border-white/10">
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[11px] font-medium text-slate-300">Total Exams</span>
            <div className="text-2xl font-bold mt-1 text-white">{totalExams}</div>
            <span className="text-[10px] text-emerald-400">{publishedExams} Active Published</span>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[11px] font-medium text-slate-300">Candidates Enrolled</span>
            <div className="text-2xl font-bold mt-1 text-white">{participants.length}</div>
            <span className="text-[10px] text-indigo-300">Participant Section</span>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[11px] font-medium text-slate-300">Paper Setters</span>
            <div className="text-2xl font-bold mt-1 text-white">{paperSetters.length}</div>
            <span className="text-[10px] text-amber-300">Setter Section</span>
          </div>
          <div className="p-3 rounded-xl bg-white/5 border border-white/5">
            <span className="text-[11px] font-medium text-slate-300">Evaluators</span>
            <div className="text-2xl font-bold mt-1 text-white">{evaluators.length}</div>
            <span className="text-[10px] text-purple-300">Evaluator Section</span>
          </div>
        </div>
      </div>

      {/* Navigation Tabs - Primary Exam-Based Hub First */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto">
        {/* 1. Exam Command Center */}
        <button
          type="button"
          onClick={() => setActiveTab('exams')}
          className={`py-3 px-4 font-bold text-xs border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'exams'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>1. Exam Command Center ({exams.length})</span>
        </button>

        {/* 2. Participant Section */}
        <button
          type="button"
          onClick={() => setActiveTab('participants')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'participants'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <GraduationCap className="w-4 h-4" />
          <span>2. Participant Section ({participants.length})</span>
        </button>

        {/* 3. Exam Paper Setter Section */}
        <button
          type="button"
          onClick={() => setActiveTab('paper_setters')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'paper_setters'
              ? 'border-amber-600 text-amber-600 dark:text-amber-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>3. Paper Setter Section ({paperSetters.length})</span>
        </button>

        {/* 4. Evaluator Section */}
        <button
          type="button"
          onClick={() => setActiveTab('evaluators')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'evaluators'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <CheckSquare className="w-4 h-4" />
          <span>4. Evaluator Section ({evaluators.length})</span>
        </button>

        {/* 5. Question Challenges & Appeals Section */}
        <button
          type="button"
          onClick={() => setActiveTab('challenges')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'challenges'
              ? 'border-purple-600 text-purple-600 dark:text-purple-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>5. Challenges & Appeals ({challenges.length})</span>
          {challenges.filter((c) => c.status === 'forwarded_to_admin').length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400 text-amber-950 font-black">
              {challenges.filter((c) => c.status === 'forwarded_to_admin').length} Action Required
            </span>
          )}
        </button>

        {/* 6. Scorecards & Excel Export */}
        <button
          type="button"
          onClick={() => setActiveTab('scorecards')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'scorecards'
              ? 'border-emerald-600 text-emerald-600 dark:text-emerald-400 font-bold'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Award className="w-4 h-4" />
          <span>6. Scorecards & Excel Export</span>
        </button>

        {/* System Overview */}
        <button
          type="button"
          onClick={() => setActiveTab('overview')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'overview'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>System Overview</span>
        </button>

        {/* Security & Passcodes */}
        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'security'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <KeyRound className="w-4 h-4" />
          <span>Role Passcodes</span>
        </button>

        {/* Audit Trail */}
        <button
          type="button"
          onClick={() => setActiveTab('logs')}
          className={`py-3 px-4 font-semibold text-xs border-b-2 flex items-center space-x-2 transition-colors whitespace-nowrap ${
            activeTab === 'logs'
              ? 'border-rose-600 text-rose-600 dark:text-rose-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Audit Trail ({logs.length})</span>
        </button>
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Recent Submissions */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2 mb-4">
                <Award className="w-4 h-4 text-rose-500" />
                <span>Recent Exam Activity & Submissions</span>
              </h3>
              {submissions.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No candidate submissions recorded yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <tr>
                        <th className="py-2.5 px-3">Candidate</th>
                        <th className="py-2.5 px-3">Exam</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Score</th>
                        <th className="py-2.5 px-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {submissions.slice(0, 6).map((sub) => (
                        <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50">
                          <td className="py-2.5 px-3">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {sub.participantName}
                            </span>
                            <div className="text-[11px] text-slate-400">{sub.participantEmail}</div>
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                            {sub.examTitle}
                          </td>
                          <td className="py-2.5 px-3">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                sub.status === 'evaluated'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                              }`}
                            >
                              {sub.status === 'evaluated' ? 'Evaluated' : 'Awaiting Grading'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold">
                            {sub.totalScore !== undefined
                              ? `${sub.totalScore} pts`
                              : '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                            {sub.submittedAt ? new Date(sub.submittedAt).toLocaleDateString() : 'In Progress'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Quick Provisioning Shortcuts */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('participants');
                  setEnrollCandidateModalOpen(true);
                }}
                className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 text-left hover:scale-[1.02] transition-transform"
              >
                <GraduationCap className="w-5 h-5 text-indigo-600 dark:text-indigo-400 mb-2" />
                <h4 className="text-xs font-bold text-indigo-950 dark:text-indigo-200">
                  Input Candidates
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Enroll candidates for an exam & set default password.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('paper_setters');
                  setStaffModalRole('paper_setter');
                  setAddStaffModalOpen(true);
                }}
                className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/40 border border-amber-200/80 dark:border-amber-900/60 text-left hover:scale-[1.02] transition-transform"
              >
                <BookOpen className="w-5 h-5 text-amber-600 dark:text-amber-400 mb-2" />
                <h4 className="text-xs font-bold text-amber-950 dark:text-amber-200">
                  Input Paper Setters
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Add authoring faculty & assign default password.
                </p>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('evaluators');
                  setStaffModalRole('evaluator');
                  setAddStaffModalOpen(true);
                }}
                className="p-4 rounded-2xl bg-purple-50/60 dark:bg-purple-950/40 border border-purple-200/80 dark:border-purple-900/60 text-left hover:scale-[1.02] transition-transform"
              >
                <CheckSquare className="w-5 h-5 text-purple-600 dark:text-purple-400 mb-2" />
                <h4 className="text-xs font-bold text-purple-950 dark:text-purple-200">
                  Input Evaluators
                </h4>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Add examiners & assign default password.
                </p>
              </button>
            </div>
          </div>

          {/* Right Column: Security Status */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2 mb-3">
                <Shield className="w-4 h-4 text-rose-500" />
                <span>Default Password & Access Policy</span>
              </h3>
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                    <span>Admin-Only Provisioning</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Public sign up is disabled. Only users pre-enrolled in the Administrator dashboard can log in.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-amber-500" />
                    <span>Forced First-Login Change</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Users log in with their administrator-set default password, then immediately set their personalized password.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Role Passcodes</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-relaxed">
                    Paper Setters & Evaluators require the operational passcode to activate their workspace.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: PARTICIPANTS SECTION */}
      {activeTab === 'participants' && (
        <div className="space-y-4">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <GraduationCap className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                <span>Participant Section: Candidates & Employees ({participants.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Input candidates for a particular exam. Default password is the same for all candidates. Only enrolled candidates can log in.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setEnrollCandidateModalOpen(true)}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition-all shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Input Candidates for Exam</span>
            </button>
          </div>

          {/* Institutional Uniform Default Password Card (Same for all candidates) */}
          <div className="bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 rounded-2xl p-4 sm:p-5 text-white shadow-lg border border-indigo-700/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1.5">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/30 text-indigo-200 border border-indigo-400/30 flex items-center space-x-1">
                  <ShieldCheck className="w-3 h-3 text-indigo-300" />
                  <span>Participant Uniform Password Policy</span>
                </span>
                <span className="text-xs text-indigo-200 font-medium">
                  Default password is the same for all candidates
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <span className="text-xs text-slate-200">Standard Default Password:</span>
                <div className="inline-flex items-center space-x-2 bg-black/40 px-3 py-1.5 rounded-xl border border-indigo-400/40">
                  <KeyRound className="w-3.5 h-3.5 text-indigo-400" />
                  <span className="font-mono text-xs font-bold text-white tracking-wider">
                    {candidateDefaultPassword}
                  </span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(candidateDefaultPassword, 'global_candidate_default_pass')}
                    className="p-1 text-indigo-300 hover:text-white transition-colors"
                    title="Copy standard default password to share with all candidates"
                  >
                    {copiedKey === 'global_candidate_default_pass' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                {copiedKey === 'global_candidate_default_pass' && (
                  <span className="text-[11px] text-emerald-400 font-semibold animate-in fade-in">
                    Copied to clipboard!
                  </span>
                )}
              </div>
              <p className="text-[11px] text-indigo-200/80 max-w-2xl">
                Every candidate is provisioned with this identical default password alongside their Employee ID. Upon their first login, candidates are required to set their personalized private password.
              </p>
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewBulkPassword(candidateDefaultPassword);
                  setSyncAllModalOpen(true);
                }}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all shadow-xs backdrop-blur-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync / Change Default Password</span>
              </button>
            </div>
          </div>

          {/* Search & Exam Filter */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search candidate by name, ID, or email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white w-64 focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <select
                  value={examFilter}
                  onChange={(e) => setExamFilter(e.target.value)}
                  className="py-1.5 px-3 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-800 dark:text-slate-200 focus:outline-hidden"
                >
                  <option value="all">All Exams Filter</option>
                  <option value="unassigned">General Candidate Pool Only</option>
                  {exams.map((ex) => (
                    <option key={ex.id} value={ex.id}>
                      Exam: {ex.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center space-x-3">
                <span className="text-xs text-slate-500 font-medium">
                  Showing {filteredParticipants.length} of {participants.length} candidates
                </span>
              </div>
            </div>

            {/* Bulk Action Bar when candidates are selected */}
            {selectedCandidateUids.length > 0 && (
              <div className="p-3 bg-indigo-50 dark:bg-indigo-950/60 border-b border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span className="font-bold text-indigo-900 dark:text-indigo-200">
                    {selectedCandidateUids.length} candidate(s) selected
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setBulkLinkModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs flex items-center space-x-1.5 transition-colors"
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    <span>Link Selected to Particular Exam</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedCandidateUids([])}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    Clear Selection
                  </button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-3 w-8">
                      <input
                        type="checkbox"
                        checked={
                          filteredParticipants.length > 0 &&
                          selectedCandidateUids.length === filteredParticipants.length
                        }
                        onChange={handleSelectAllFilteredCandidates}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                    </th>
                    <th className="py-3 px-4 font-semibold">Candidate</th>
                    <th className="py-3 px-4 font-semibold">Employee ID / Roll</th>
                    <th className="py-3 px-4 font-semibold">Assigned Exam (Particular Exam Link)</th>
                    <th className="py-3 px-4 font-semibold">Department</th>
                    <th className="py-3 px-4 font-semibold">Candidate Default Password</th>
                    <th className="py-3 px-4 font-semibold">Password Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredParticipants.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No candidates found. Click "+ Input Candidates for Exam" to enroll candidates.
                      </td>
                    </tr>
                  ) : (
                    filteredParticipants.map((u) => {
                      const assignedExam = exams.find(
                        (e) =>
                          e.id === u.assignedExamId ||
                          (e.assignedParticipantIds && e.assignedParticipantIds.includes(u.uid))
                      );
                      const displayPassword = u.defaultPasswordAssigned || candidateDefaultPassword;
                      const isSelected = selectedCandidateUids.includes(u.uid);

                      return (
                        <tr
                          key={u.uid}
                          className={`hover:bg-slate-50 dark:hover:bg-slate-750/50 ${
                            isSelected ? 'bg-indigo-50/40 dark:bg-indigo-950/20' : ''
                          }`}
                        >
                          <td className="py-3 px-3">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleSelectCandidate(u.uid)}
                              className="rounded text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {u.displayName}
                            </div>
                            <div className="text-[11px] text-slate-500">{u.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              {u.employeeId || 'NO-ID'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {assignedExam ? (
                              <div className="flex items-center space-x-1.5">
                                <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                                  <BookOpen className="w-3 h-3 text-indigo-600 shrink-0" />
                                  <span className="max-w-[130px] truncate">{assignedExam.title}</span>
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setLinkCandidateModalUser(u)}
                                  className="p-1 rounded-md text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                                  title="Change Exam"
                                >
                                  <Edit className="w-3 h-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleUnlinkCandidate(u)}
                                  className="p-1 rounded-md text-rose-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                                  title="Unlink Candidate from this Exam (Removes from exam enrolled list)"
                                >
                                  <Unlink className="w-3 h-3" />
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setLinkCandidateModalUser(u)}
                                className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 dark:hover:bg-amber-900/60 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-800/80 transition-all shadow-xs"
                                title="Link this candidate from general candidate pool to a particular exam"
                              >
                                <Link2 className="w-3 h-3 text-amber-600" />
                                <span>+ Link to Exam</span>
                              </button>
                            )}
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {u.department || 'General'}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {u.mustChangePassword !== false ? (
                                <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-750 px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-600">
                                  <KeyRound className="w-3 h-3 text-indigo-500" />
                                  <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                    {displayPassword}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(displayPassword, `cand_${u.uid}`)}
                                    className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                                    title="Copy Default Password to share with candidate"
                                  >
                                    {copiedKey === `cand_${u.uid}` ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                  <CheckCircle className="w-3.5 h-3.5" />
                                  <span>Personal Password</span>
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {u.mustChangePassword !== false ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                Default (Awaiting 1st Login)
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Password Secured
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              {assignedExam && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setAdmitCardExam(assignedExam);
                                    setAdmitCardCandidateId(u.uid);
                                  }}
                                  className="p-1 rounded-lg text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                                  title={`Generate / View Admit Card for "${assignedExam.title}"`}
                                >
                                  <IdCard className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {assignedExam ? (
                                <button
                                  type="button"
                                  onClick={() => handleUnlinkCandidate(u)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                  title="Unlink Candidate from Exam (Removes from enrolled list)"
                                >
                                  <Unlink className="w-3.5 h-3.5" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setLinkCandidateModalUser(u)}
                                  className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                  title="Link Candidate to Exam"
                                >
                                  <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setPasswordModalUser(u)}
                                className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Reset / Change Default Password"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.uid, u.displayName)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Remove candidate"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* Tab 3: EXAM PAPER SETTER SECTION */}
      {activeTab === 'paper_setters' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <BookOpen className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>Exam Paper Setter Section ({paperSetters.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Input authoring faculty & assign default passwords. Paper setters operationalize their account via passcode.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setStaffModalRole('paper_setter');
                setAddStaffModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 shadow-md shadow-amber-600/20 transition-all shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Input Exam Paper Setter</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Paper Setter</th>
                    <th className="py-3 px-4 font-semibold">Faculty / Staff ID</th>
                    <th className="py-3 px-4 font-semibold">Department</th>
                    <th className="py-3 px-4 font-semibold">Assigned Exam</th>
                    <th className="py-3 px-4 font-semibold">Operational Status</th>
                    <th className="py-3 px-4 font-semibold">Default Password Control</th>
                    <th className="py-3 px-4 font-semibold">Password Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredPaperSetters.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No paper setters registered. Click "+ Input Exam Paper Setter" to add staff.
                      </td>
                    </tr>
                  ) : (
                    filteredPaperSetters.map((u) => {
                      const isOperational = u.isOperational ?? false;
                      const assignedExam = exams.find((e) => e.id === u.assignedExamId);

                      return (
                        <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-750/50">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {u.displayName}
                            </div>
                            <div className="text-[11px] text-slate-500">{u.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                              {u.employeeId || 'NO-ID'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {u.department || 'Faculty'}
                          </td>
                          <td className="py-3 px-4">
                            {assignedExam ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                {assignedExam.title}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">All Exams</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isOperational
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                              >
                                {isOperational ? 'Operational' : 'Pending Passcode'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleOperational(u.uid, isOperational)}
                                className="text-[10px] text-slate-500 hover:text-amber-600 underline font-medium"
                              >
                                {isOperational ? 'Deactivate' : 'Authorize'}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {u.defaultPasswordAssigned ? (
                                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-750 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600">
                                  <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                    {u.defaultPasswordAssigned}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(u.defaultPasswordAssigned!, `setter_${u.uid}`)}
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                    title="Copy Default Password to share with paper setter"
                                  >
                                    {copiedKey === `setter_${u.uid}` ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPasswordModalUser(u)}
                                  className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  <span>Set Default Password</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {u.mustChangePassword ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                Must Change on First Login
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Personal Password Active
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                type="button"
                                onClick={() => setPasswordModalUser(u)}
                                className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Reset / Change Default Password"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.uid, u.displayName)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Remove staff account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* Tab 4: EVALUATOR SECTION */}
      {activeTab === 'evaluators' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <CheckSquare className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                <span>Evaluator Section ({evaluators.length})</span>
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Input examination evaluators/examiners & set default passwords. Evaluators operationalize via passcode.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setStaffModalRole('evaluator');
                setAddStaffModalOpen(true);
              }}
              className="flex items-center space-x-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 shadow-md shadow-purple-600/20 transition-all shrink-0"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>+ Input Evaluator</span>
            </button>
          </div>

          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Evaluator</th>
                    <th className="py-3 px-4 font-semibold">Examiner ID</th>
                    <th className="py-3 px-4 font-semibold">Department</th>
                    <th className="py-3 px-4 font-semibold">Assigned Exam</th>
                    <th className="py-3 px-4 font-semibold">Operational Status</th>
                    <th className="py-3 px-4 font-semibold">Default Password Control</th>
                    <th className="py-3 px-4 font-semibold">Password Status</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {filteredEvaluators.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-slate-400">
                        No evaluators registered. Click "+ Input Evaluator" to add examiners.
                      </td>
                    </tr>
                  ) : (
                    filteredEvaluators.map((u) => {
                      const isOperational = u.isOperational ?? false;
                      const assignedExam = exams.find((e) => e.id === u.assignedExamId);

                      return (
                        <tr key={u.uid} className="hover:bg-slate-50 dark:hover:bg-slate-750/50">
                          <td className="py-3 px-4">
                            <div className="font-semibold text-slate-900 dark:text-white">
                              {u.displayName}
                            </div>
                            <div className="text-[11px] text-slate-500">{u.email}</div>
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                              {u.employeeId || 'NO-ID'}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                            {u.department || 'Examination Board'}
                          </td>
                          <td className="py-3 px-4">
                            {assignedExam ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200">
                                {assignedExam.title}
                              </span>
                            ) : (
                              <span className="text-[11px] text-slate-400">All Exams</span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  isOperational
                                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                    : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                                }`}
                              >
                                {isOperational ? 'Operational' : 'Pending Passcode'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleToggleOperational(u.uid, isOperational)}
                                className="text-[10px] text-slate-500 hover:text-purple-600 underline font-medium"
                              >
                                {isOperational ? 'Deactivate' : 'Authorize'}
                              </button>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center space-x-2">
                              {u.defaultPasswordAssigned ? (
                                <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-750 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600">
                                  <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200">
                                    {u.defaultPasswordAssigned}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => copyToClipboard(u.defaultPasswordAssigned!, `eval_${u.uid}`)}
                                    className="p-1 text-slate-400 hover:text-slate-600"
                                    title="Copy Default Password to share with evaluator"
                                  >
                                    {copiedKey === `eval_${u.uid}` ? (
                                      <Check className="w-3 h-3 text-emerald-500" />
                                    ) : (
                                      <Copy className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setPasswordModalUser(u)}
                                  className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg text-[11px] font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800"
                                >
                                  <KeyRound className="w-3 h-3" />
                                  <span>Set Default Password</span>
                                </button>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            {u.mustChangePassword ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                                Must Change on First Login
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                Personal Password Active
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end space-x-1.5">
                              <button
                                type="button"
                                onClick={() => setPasswordModalUser(u)}
                                className="p-1 rounded-lg text-slate-400 hover:text-purple-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Reset / Change Default Password"
                              >
                                <KeyRound className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u.uid, u.displayName)}
                                className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                title="Remove evaluator account"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
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
      )}

      {/* Tab: QUESTION CHALLENGES & ACADEMIC APPEALS */}
      {activeTab === 'challenges' && (
        <div className="space-y-6">
          {/* Header & Stats Banner */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center space-x-3">
                <span className="p-2.5 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                  <HelpCircle className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span>Institutional Question Challenges & Result Appeals Desk</span>
                    <span className="text-[10px] uppercase font-bold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                      Administrative Adjudication
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Audit candidate appeals against published answer keys, review Evaluator recommendations, authorize score adjustments, and update student scorecards in real time.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={loadData}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold self-start md:self-auto"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Refresh Appeals</span>
              </button>
            </div>

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100 dark:border-slate-750">
              <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-750/70 border border-slate-200 dark:border-slate-700/80">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Total Appeals Lodged</span>
                <span className="text-lg font-black text-slate-900 dark:text-white">{challenges.length}</span>
              </div>
              <div className="p-3 rounded-2xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/60">
                <span className="text-[10px] uppercase font-bold text-purple-700 dark:text-purple-400 block">Forwarded by Evaluators</span>
                <span className="text-lg font-black text-purple-700 dark:text-purple-300">
                  {challenges.filter((c) => c.status === 'forwarded_to_admin').length} Action Required
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60">
                <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 block">Authorized Revisions</span>
                <span className="text-lg font-black text-emerald-700 dark:text-emerald-300">
                  {challenges.filter((c) => c.status === 'resolved_accepted').length} Accepted
                </span>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60">
                <span className="text-[10px] uppercase font-bold text-rose-700 dark:text-rose-400 block">Dismissed / Upheld</span>
                <span className="text-lg font-black text-rose-700 dark:text-rose-300">
                  {challenges.filter((c) => c.status === 'resolved_rejected').length} Original Upheld
                </span>
              </div>
            </div>

            {/* Chain of Events Visual Stepper */}
            <div className="p-4 rounded-2xl bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/40 text-xs text-purple-950 dark:text-purple-200 space-y-2">
              <div className="flex items-center space-x-2 font-bold text-purple-900 dark:text-purple-300">
                <ShieldCheck className="w-4 h-4 text-purple-600" />
                <span>Question Challenge Chain of Events:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px] pt-1">
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-purple-200/60 dark:border-purple-900/40">
                  <span className="font-bold text-purple-600 block">1. Result Published</span>
                  <span>Candidate reviews scorecard and submits challenge with academic justification.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-purple-200/60 dark:border-purple-900/40">
                  <span className="font-bold text-purple-600 block">2. Evaluator Review</span>
                  <span>Evaluator verifies student response and submits recommendation (revision or uphold).</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-purple-200/60 dark:border-purple-900/40">
                  <span className="font-bold text-purple-600 block">3. Admin Authorization</span>
                  <span>Administrator reviews dossier and gives formal sign-off on final marks.</span>
                </div>
                <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800/90 border border-purple-200/60 dark:border-purple-900/40">
                  <span className="font-bold text-emerald-600 block">4. Scorecard Update</span>
                  <span>Scorecard total score, percentage, and pass/fail recomputed automatically.</span>
                </div>
              </div>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search appeals by candidate, question, or exam..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={examFilter}
                onChange={(e) => setExamFilter(e.target.value)}
                className="text-xs px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="all">All Examinations</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Appeals List */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {(() => {
                const filteredChallenges = challenges.filter((c) => {
                  const matchesSearch =
                    c.candidateExplanation.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    c.questionTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    c.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    c.examTitle.toLowerCase().includes(searchTerm.toLowerCase());
                  const matchesExam = examFilter === 'all' || c.examId === examFilter;
                  return matchesSearch && matchesExam;
                });

                if (filteredChallenges.length === 0) {
                  return (
                    <div className="py-16 text-center text-slate-400 text-xs space-y-2">
                      <HelpCircle className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
                      <p className="font-semibold text-slate-500">No question challenges matching the filter criteria.</p>
                      <p className="text-[11px] text-slate-400">
                        When candidates appeal question evaluations, they will be listed here for institutional sign-off.
                      </p>
                    </div>
                  );
                }

                return filteredChallenges.map((ch) => {
                  const isForwarded = ch.status === 'forwarded_to_admin';
                  const isAccepted = ch.status === 'resolved_accepted';
                  const isRejected = ch.status === 'resolved_rejected';
                  const isSubmitted = ch.status === 'submitted';

                  return (
                    <div
                      key={ch.id}
                      className="p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-5 hover:bg-slate-50/80 dark:hover:bg-slate-750/50 transition-colors"
                    >
                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-bold text-sm text-slate-900 dark:text-white">
                            {ch.questionTitle}
                          </span>
                          {isAccepted ? (
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Resolution Authorized: Revised to {ch.finalAwardedMarks} Pts</span>
                            </span>
                          ) : isRejected ? (
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800 flex items-center space-x-1">
                              <XCircle className="w-3 h-3 text-rose-600" />
                              <span>Dismissed: Original Score Upheld ({ch.originalMarksAwarded} Pts)</span>
                            </span>
                          ) : isForwarded ? (
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300 dark:border-amber-800 flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Evaluator Forwarded • Admin Authorization Required</span>
                            </span>
                          ) : (
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border border-purple-300 dark:border-purple-800 flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-purple-600" />
                              <span>Under Evaluator Review</span>
                            </span>
                          )}
                        </div>

                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span>Exam: <strong className="text-slate-800 dark:text-slate-200">{ch.examTitle}</strong></span>
                          <span>• Candidate: <strong className="text-slate-800 dark:text-slate-200">{ch.participantName}</strong> ({ch.participantEmail})</span>
                          <span>• Weight: <strong className="text-slate-800 dark:text-slate-200">{ch.questionMarks} Pts</strong></span>
                          <span>• Original Awarded: <strong className="text-slate-800 dark:text-slate-200">{ch.originalMarksAwarded} Pts</strong></span>
                          <span>• Lodged: {new Date(ch.submittedAt).toLocaleDateString()}</span>
                        </div>

                        {/* Student response & justification */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-slate-400 block">
                              Candidate's Response:
                            </span>
                            <p className="font-mono text-[11px] text-slate-800 dark:text-slate-200 line-clamp-2">
                              {ch.candidateAnswer}
                            </p>
                          </div>

                          <div className="p-3 rounded-2xl bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 dark:border-amber-900/40 space-y-1">
                            <span className="text-[10px] uppercase font-bold text-amber-800 dark:text-amber-300 block">
                              Candidate Challenge Justification ({ch.challengeReason}):
                            </span>
                            <p className="text-slate-700 dark:text-slate-300 line-clamp-2">
                              "{ch.candidateExplanation}"
                            </p>
                            {ch.supportingReference && (
                              <div className="flex items-center space-x-1 text-[10px] text-amber-800 dark:text-amber-300 pt-0.5">
                                <BookOpen className="w-3 h-3" />
                                <span className="font-semibold">Ref:</span>
                                <span>{ch.supportingReference}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Evaluator Recommendation Dossier */}
                        {ch.evaluatorReviewedAt && (
                          <div className="p-3 rounded-2xl bg-purple-50/60 dark:bg-purple-950/20 border border-purple-200/80 dark:border-purple-900/50 text-xs space-y-1">
                            <div className="flex items-center justify-between text-purple-950 dark:text-purple-200">
                              <span className="font-bold flex items-center space-x-1.5">
                                <UserCheck className="w-3.5 h-3.5 text-purple-600" />
                                <span>Evaluator Recommendation ({ch.evaluatorName || 'Academic Evaluator'}):</span>
                              </span>
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                ch.evaluatorDecision === 'recommend_accept'
                                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                              }`}>
                                {ch.evaluatorDecision === 'recommend_accept'
                                  ? `Recommend Revision to ${ch.evaluatorRecommendedMarks} / ${ch.questionMarks} Pts`
                                  : 'Recommend Uphold Original Mark'}
                              </span>
                            </div>
                            {ch.evaluatorReviewNotes && (
                              <p className="text-slate-700 dark:text-slate-300 text-[11px] italic">
                                "{ch.evaluatorReviewNotes}"
                              </p>
                            )}
                          </div>
                        )}

                        {/* Administrator Sign-off details if resolved */}
                        {ch.resolvedAt && (
                          <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-750 text-[11px] text-slate-600 dark:text-slate-400 flex items-center space-x-2">
                            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              Authorized by {ch.adminName || 'Administrator'} on {new Date(ch.resolvedAt).toLocaleString()}: "{ch.adminDecisionNotes}"
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex flex-col sm:flex-row xl:flex-col items-stretch xl:items-end gap-2 shrink-0">
                        {isForwarded || isSubmitted ? (
                          <button
                            type="button"
                            onClick={() => setAuthorizeChallengeModalItem(ch)}
                            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-900/20 transition-all flex items-center justify-center space-x-1.5"
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Authorize Final Determination</span>
                          </button>
                        ) : null}

                        <button
                          type="button"
                          onClick={() => setViewChallengeDetailsAdmin(ch)}
                          className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors flex items-center justify-center space-x-1.5"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                          <span>View Full Dossier</span>
                        </button>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Tab 1 / Central Hub: EXAM COMMAND CENTER */}
      {activeTab === 'exams' && (
        <div className="space-y-6">
          {/* Exam Hub Action Header */}
          <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                  <Layers className="w-5 h-5" />
                </span>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-white">
                    Institutional Exam Command Centre
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Exam-based control: Generate exams, assign Paper Setters, Evaluators & Candidates, and authorize/alter live exam schedules.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setGenerateExamModalOpen(true)}
                className="flex items-center justify-center px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 shadow-md shadow-rose-600/20 hover:scale-[1.02] transition-all"
              >
                <span>+ Generate New Exam</span>
              </button>
            </div>
          </div>

          {/* Search & Quick Filter Controls */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white dark:bg-slate-800 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700">
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search exams by title, subject, setter, or evaluator..."
                value={examSearchQuery}
                onChange={(e) => setExamSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setExamStatusFilter('all')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                  examStatusFilter === 'all'
                    ? 'bg-rose-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                All ({exams.length})
              </button>
              <button
                type="button"
                onClick={() => setExamStatusFilter('proposed')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                  examStatusFilter === 'proposed'
                    ? 'bg-amber-600 text-white'
                    : 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100'
                }`}
              >
                ⏳ Needs Authorization ({exams.filter((e) => e.scheduleStatus === 'schedule_proposed').length})
              </button>
              <button
                type="button"
                onClick={() => setExamStatusFilter('authorized')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                  examStatusFilter === 'authorized'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100'
                }`}
              >
                ✓ Authorized Live ({exams.filter((e) => e.scheduleStatus === 'schedule_authorized').length})
              </button>
              <button
                type="button"
                onClick={() => setExamStatusFilter('evaluations_forwarded')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                  examStatusFilter === 'evaluations_forwarded'
                    ? 'bg-purple-600 text-white'
                    : 'bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 hover:bg-purple-100'
                }`}
              >
                📋 Evaluations Forwarded ({exams.filter((e) => e.evaluationForwardStatus === 'forwarded_to_admin').length})
              </button>
              <button
                type="button"
                onClick={() => setExamStatusFilter('results_published')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                  examStatusFilter === 'results_published'
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800/60 hover:bg-emerald-100'
                }`}
              >
                🏆 Results Published ({exams.filter((e) => examService.isResultPublishedForExam(e)).length})
              </button>
              <button
                type="button"
                onClick={() => setExamStatusFilter('draft')}
                className={`px-3 py-1.5 rounded-xl font-bold transition-colors ${
                  examStatusFilter === 'draft'
                    ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900'
                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200'
                }`}
              >
                Drafts ({exams.filter((e) => e.status === 'draft').length})
              </button>
            </div>
          </div>

          {/* Multi-Exam Simultaneous Control Grid */}
          {exams.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 p-12 text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400 mx-auto flex items-center justify-center">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  No Institutional Examinations Created
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  At first, the Administrator generates an examination and sets its designated Paper Setter, Evaluator, and Candidates.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setGenerateExamModalOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold shadow-md shadow-rose-600/20 inline-flex items-center space-x-1.5"
              >
                <Plus className="w-4 h-4" />
                <span>Generate First Exam</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              {exams
                .filter((exam) => {
                  const q = examSearchQuery.toLowerCase();
                  const matchSearch =
                    exam.title.toLowerCase().includes(q) ||
                    exam.subject.toLowerCase().includes(q) ||
                    exam.setterName.toLowerCase().includes(q) ||
                    (exam.evaluatorName && exam.evaluatorName.toLowerCase().includes(q));

                  let matchStatus = true;
                  if (examStatusFilter === 'proposed') {
                    matchStatus = exam.scheduleStatus === 'schedule_proposed';
                  } else if (examStatusFilter === 'authorized') {
                    matchStatus = exam.scheduleStatus === 'schedule_authorized';
                  } else if (examStatusFilter === 'evaluations_forwarded') {
                    matchStatus = exam.evaluationForwardStatus === 'forwarded_to_admin';
                  } else if (examStatusFilter === 'results_published') {
                    matchStatus = examService.isResultPublishedForExam(exam);
                  } else if (examStatusFilter === 'draft') {
                    matchStatus = exam.status === 'draft';
                  }
                  return matchSearch && matchStatus;
                })
                .map((exam) => {
                  const examSubs = submissions.filter((s) => s.examId === exam.id);
                  const examEnrolledCandidates = participants.filter((p) => {
                    const fromRoster = exam.assignedParticipantIds || [];
                    return fromRoster.includes(p.uid) || p.assignedExamId === exam.id;
                  });
                  const assignedCount = examEnrolledCandidates.length;

                  // Real-time live window status
                  const nowMs = Date.now();
                  const startMs = exam.scheduledStartTime ? new Date(exam.scheduledStartTime).getTime() : 0;
                  const endMs = exam.scheduledEndTime ? new Date(exam.scheduledEndTime).getTime() : 0;
                  const isLiveNow = startMs && endMs && nowMs >= startMs && nowMs <= endMs;
                  const isUpcoming = startMs && nowMs < startMs;
                  const isConcluded = endMs && nowMs > endMs;

                  return (
                    <div
                      key={exam.id}
                      className="bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-xs hover:shadow-md transition-shadow p-5 flex flex-col justify-between space-y-4"
                    >
                      {/* Top Exam Header */}
                      <div className="space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1">
                              <span className="px-2.5 py-0.5 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-[10px] uppercase border border-rose-200 dark:border-rose-900/60">
                                {exam.subject}
                              </span>
                              {exam.status === 'published' ? (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                                  PUBLISHED
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                  DRAFT
                                </span>
                              )}
                              {exam.negativeMarkingEnabled && (
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                                  -{exam.negativeMarksPerQuestion || '0.25'} NEGATIVE MARKING
                                </span>
                              )}
                            </div>
                            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                              {exam.title}
                            </h3>
                            <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">
                              {exam.description || 'No description provided.'}
                            </p>
                          </div>

                          {/* Live Schedule Status Pill */}
                          <div className="shrink-0 text-right">
                            {exam.scheduleStatus === 'schedule_proposed' ? (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800 animate-pulse">
                                <Clock className="w-3.5 h-3.5 text-amber-600" />
                                <span>Schedule Proposed</span>
                              </span>
                            ) : exam.scheduleStatus === 'schedule_authorized' ? (
                              isLiveNow ? (
                                <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-900 border border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800">
                                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                                  <span>LIVE NOW</span>
                                </span>
                              ) : isUpcoming ? (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-purple-100 text-purple-900 border border-purple-300 dark:bg-purple-950 dark:text-purple-200 dark:border-purple-800">
                                  <Clock className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Upcoming</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300">
                                  <span>Concluded</span>
                                </span>
                              )
                            ) : (
                              <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                                <span>Unscheduled</span>
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Specs row */}
                        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] text-slate-500 dark:text-slate-400">
                          <span>Duration: <strong className="text-slate-800 dark:text-slate-200">{exam.durationMinutes} mins</strong></span>
                          <span>•</span>
                          <span>Total Marks: <strong className="text-indigo-600 dark:text-indigo-400">{exam.totalMarks} pts</strong></span>
                          <span>•</span>
                          <span>Passing: <strong className="text-slate-800 dark:text-slate-200">{exam.passingMarks} pts</strong></span>
                          <span>•</span>
                          <span>Submissions: <strong className="text-slate-800 dark:text-slate-200">{examSubs.length}</strong></span>
                          <span>•</span>
                          <span>
                            Negative Marking:{' '}
                            {exam.negativeMarkingEnabled ? (
                              <strong className="text-rose-600 dark:text-rose-400">
                                Yes (-{exam.negativeMarksPerQuestion || '0.25'} / wrong)
                              </strong>
                            ) : (
                              <strong className="text-slate-600 dark:text-slate-400">No</strong>
                            )}
                          </span>
                        </div>
                      </div>

                      {/* 1. Exam Role Allocations (Paper Setter, Evaluator, Candidates) */}
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-750/70 border border-slate-200/80 dark:border-slate-700 space-y-2.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center space-x-1">
                            <Users className="w-3.5 h-3.5" />
                            <span>Designated Exam Roles & Candidates</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setManageAssignmentsExam(exam)}
                            className="text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center space-x-1"
                          >
                            <Edit className="w-3 h-3" />
                            <span>Set / Change Roles</span>
                          </button>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                          {/* Paper Setter */}
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <div className="text-[10px] font-bold text-amber-700 dark:text-amber-400 flex items-center space-x-1 mb-1">
                              <BookOpen className="w-3 h-3" />
                              <span>Paper Setter</span>
                            </div>
                            <div className="font-semibold text-slate-900 dark:text-white truncate">
                              {exam.setterName}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              Authors questions & sets live time
                            </div>
                          </div>

                          {/* Evaluator */}
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <div className="text-[10px] font-bold text-purple-700 dark:text-purple-400 flex items-center space-x-1 mb-1">
                              <CheckSquare className="w-3 h-3" />
                              <span>Evaluator</span>
                            </div>
                            <div className="font-semibold text-slate-900 dark:text-white truncate">
                              {exam.evaluatorName || 'Not Designated'}
                            </div>
                            <div className="text-[10px] text-slate-400 truncate">
                              Grades scripts & releases marks
                            </div>
                          </div>

                          {/* Candidates */}
                          <div className="p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                            <div className="text-[10px] font-bold text-indigo-700 dark:text-indigo-400 flex items-center space-x-1 mb-1">
                              <GraduationCap className="w-3 h-3" />
                              <span>Candidates</span>
                            </div>
                            <div className="font-semibold text-slate-900 dark:text-white truncate">
                              {assignedCount} Enrolled
                            </div>
                            <div className="pt-1 flex flex-col space-y-0.5">
                              <button
                                type="button"
                                onClick={() => setManageAssignmentsExam(exam)}
                                className="text-[10px] text-indigo-600 dark:text-indigo-400 font-bold hover:underline text-left flex items-center space-x-1"
                              >
                                <Link2 className="w-2.5 h-2.5" />
                                <span>Link / Manage Pool</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setAdmitCardExam(exam);
                                  setAdmitCardCandidateId(undefined);
                                }}
                                className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold hover:underline text-left flex items-center space-x-1"
                                title="Generate Admit Cards for enrolled candidates"
                              >
                                <IdCard className="w-2.5 h-2.5" />
                                <span>Admit Cards ({assignedCount})</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveTab('participants');
                                  setExamFilter(exam.id);
                                }}
                                className="text-[10px] text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 underline text-left"
                              >
                                Roster ({assignedCount}) →
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* 2. Live Date & Time Schedule Card */}
                      <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                        {exam.scheduleStatus === 'schedule_proposed' ? (
                          <div className="p-3 rounded-xl bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-amber-800 dark:text-amber-300 flex items-center space-x-1.5">
                                <Clock className="w-4 h-4 text-amber-600 animate-spin" />
                                <span>Live Schedule Proposed by Paper Setter ({exam.scheduleProposedBy || exam.setterName})</span>
                              </span>
                              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-200 text-amber-900 font-bold">
                                Action Required
                              </span>
                            </div>

                            <div className="text-amber-950 dark:text-amber-100 font-medium space-y-0.5 pl-5">
                              <div>
                                Start:{' '}
                                <strong className="underline">
                                  {exam.scheduledStartTime ? new Date(exam.scheduledStartTime).toLocaleString() : 'TBD'}
                                </strong>
                              </div>
                              <div>
                                End:{' '}
                                <strong className="underline">
                                  {exam.scheduledEndTime ? new Date(exam.scheduledEndTime).toLocaleString() : 'TBD'}
                                </strong>
                              </div>
                              {exam.scheduleNotes && (
                                <div className="text-[11px] italic text-amber-800 dark:text-amber-300 pt-0.5">
                                  Note: "{exam.scheduleNotes}"
                                </div>
                              )}
                            </div>

                            <div className="pt-2 flex flex-wrap items-center gap-2 justify-end">
                              <button
                                type="button"
                                onClick={() => handleAuthorizeProposedSchedule(exam)}
                                className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-xs transition-colors flex items-center space-x-1.5"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Authorize Schedule</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setAlterScheduleExam(exam)}
                                className="px-3.5 py-1.5 rounded-xl border border-purple-300 dark:border-purple-700 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 font-bold text-xs hover:bg-purple-100 transition-colors flex items-center space-x-1.5"
                              >
                                <Calendar className="w-3.5 h-3.5" />
                                <span>Alter Date & Time</span>
                              </button>
                            </div>
                          </div>
                        ) : exam.scheduleStatus === 'schedule_authorized' ? (
                          <div className="p-3 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-1.5 font-bold text-emerald-900 dark:text-emerald-200">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Authorized Live Window:</span>
                              </div>
                              <div className="text-emerald-950 dark:text-emerald-100 pl-5 text-[11px]">
                                <span>{exam.scheduledStartTime ? new Date(exam.scheduledStartTime).toLocaleString() : ''}</span>
                                <span className="mx-1">to</span>
                                <span>{exam.scheduledEndTime ? new Date(exam.scheduledEndTime).toLocaleString() : ''}</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setAlterScheduleExam(exam)}
                              className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-50 shrink-0 flex items-center space-x-1 self-start sm:self-auto"
                            >
                              <Calendar className="w-3 h-3" />
                              <span>Alter Date & Time</span>
                            </button>
                          </div>
                        ) : (
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <div className="font-bold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-500" />
                                <span>Live Schedule Not Set Yet</span>
                              </div>
                              <p className="text-[11px] text-slate-500 pl-5 mt-0.5">
                                Paper Setter ({exam.setterName}) will propose live date & time, or Administrator can set directly.
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => setAlterScheduleExam(exam)}
                              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs shrink-0 flex items-center space-x-1 self-start sm:self-auto"
                            >
                              <Calendar className="w-3 h-3" />
                              <span>Set Live Date & Time</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 3. Evaluator Forwarding & Result Publication Dossier */}
                      <div className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-xs space-y-2">
                        {exam.evaluationForwardStatus === 'forwarded_to_admin' ? (
                          <div className="p-3.5 rounded-xl bg-amber-50/90 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-900/60 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-amber-900 dark:text-amber-200 flex items-center space-x-1.5">
                                <Award className="w-4 h-4 text-amber-600 animate-bounce" />
                                <span>Evaluations Forwarded by Evaluator ({exam.evaluatorName || 'Evaluator'}) • Action Required</span>
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                                Pending Authorisation
                              </span>
                            </div>

                            <div className="text-amber-950 dark:text-amber-100 font-medium space-y-0.5 pl-5">
                              <div>
                                Recommended Result Release Date & Time:{' '}
                                <strong className="underline">
                                  {exam.recommendedResultReleaseTime
                                    ? new Date(exam.recommendedResultReleaseTime).toLocaleString()
                                    : 'TBD'}
                                </strong>
                              </div>
                              {exam.evaluatorRemarks && (
                                <div className="text-[11px] italic text-amber-800 dark:text-amber-300 pt-0.5">
                                  Evaluator Remarks: "{exam.evaluatorRemarks}"
                                </div>
                              )}
                              <div className="text-[10px] text-amber-700 dark:text-amber-400">
                                Candidate Submissions: {examSubs.filter((s) => s.status === 'evaluated').length} of {examSubs.length} evaluated.
                              </div>
                            </div>

                            <div className="pt-2 flex justify-end">
                              <button
                                type="button"
                                onClick={() => setAuthorizeResultsExam(exam)}
                                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/20 transition-all flex items-center space-x-1.5"
                              >
                                <Award className="w-3.5 h-3.5" />
                                <span>Authorize & Publish Results to Candidates</span>
                              </button>
                            </div>
                          </div>
                        ) : exam.evaluationForwardStatus === 'results_authorized' ? (
                          <div className="p-3.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center space-x-1.5 font-bold text-emerald-900 dark:text-emerald-200">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span>Results Publication Authorized & Scheduled:</span>
                              </div>
                              <div className="text-emerald-950 dark:text-emerald-100 pl-5 text-[11px]">
                                Scheduled Release:{' '}
                                <strong>
                                  {exam.scheduledResultReleaseTime
                                    ? new Date(exam.scheduledResultReleaseTime).toLocaleString()
                                    : 'Authorized'}
                                </strong>
                              </div>
                              {examService.isResultPublishedForExam(exam) ? (
                                <div className="text-[11px] text-emerald-700 dark:text-emerald-400 pl-5 font-semibold">
                                  ✓ Live now: Candidates can view their evaluated scorecards.
                                </div>
                              ) : (
                                <div className="text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                                  Scorecards will automatically unlock for candidates at this authorized timestamp.
                                </div>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
                              {!examService.isResultPublishedForExam(exam) && (
                                <button
                                  type="button"
                                  onClick={() => handlePublishResultsImmediately(exam)}
                                  className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-xs flex items-center space-x-1"
                                >
                                  <Zap className="w-3 h-3 fill-current" />
                                  <span>Publish Now</span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setAuthorizeResultsExam(exam)}
                                className="px-3 py-1.5 rounded-xl border border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-800 text-emerald-800 dark:text-emerald-300 font-bold text-xs hover:bg-emerald-50 flex items-center space-x-1"
                              >
                                <Calendar className="w-3 h-3" />
                                <span>Alter Schedule</span>
                              </button>
                            </div>
                          </div>
                        ) : exam.evaluationForwardStatus === 'results_published' || exam.resultsPublished ? (
                          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 flex items-center justify-between">
                            <div className="flex items-center space-x-2 text-emerald-900 dark:text-emerald-200 font-bold text-xs">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                              <span>Official Results Published to Candidates (Scorecards Live)</span>
                            </div>
                            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                              Published
                            </span>
                          </div>
                        ) : (
                          <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-slate-500">
                            <span className="text-[11px]">
                              {examSubs.length > 0
                                ? `${examSubs.filter((s) => s.status === 'evaluated').length} of ${examSubs.length} scripts evaluated. Awaiting Evaluator (${exam.evaluatorName || 'Evaluator'}) to forward dossier.`
                                : `Evaluations not started. Evaluator (${exam.evaluatorName || 'Not Assigned'}) will evaluate submitted scripts.`}
                            </span>
                            {examSubs.length > 0 && (
                              <button
                                type="button"
                                onClick={() => setAuthorizeResultsExam(exam)}
                                className="text-[11px] text-purple-600 dark:text-purple-400 font-bold hover:underline shrink-0 text-left"
                              >
                                Authorize / Set Schedule Directly →
                              </button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Candidate Question Challenges Callout on Exam Card */}
                      {(() => {
                        const examChallenges = challenges.filter((c) => c.examId === exam.id);
                        if (examChallenges.length === 0) return null;
                        const pendingCount = examChallenges.filter(
                          (c) => c.status === 'forwarded_to_admin' || c.status === 'submitted'
                        ).length;

                        return (
                          <div className="p-3 rounded-2xl border border-purple-200 dark:border-purple-800 bg-purple-50/60 dark:bg-purple-950/30 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="space-y-0.5">
                              <div className="font-bold text-purple-900 dark:text-purple-200 flex items-center space-x-1.5">
                                <HelpCircle className="w-4 h-4 text-purple-600" />
                                <span>Candidate Question Challenges ({examChallenges.length} Total)</span>
                              </div>
                              <div className="text-[11px] text-purple-800 dark:text-purple-300">
                                {pendingCount > 0
                                  ? `${pendingCount} challenge(s) awaiting review / administrative authorization.`
                                  : `All ${examChallenges.length} challenges reviewed and adjudicated.`}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                setActiveTab('challenges');
                                setExamFilter(exam.id);
                              }}
                              className="px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-xs self-start sm:self-auto flex items-center space-x-1"
                            >
                              <span>Review Appeals ({pendingCount})</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })()}

                      {/* 4. View-Only Inspection & Submissions Bar */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setInspectQuestionsExam(exam)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center space-x-1.5"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-rose-500" />
                            <span>Inspect Questions (View Only)</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setInspectSubmissionsExam(exam)}
                            className="px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold text-xs flex items-center space-x-1.5"
                          >
                            <FileText className="w-3.5 h-3.5 text-purple-500" />
                            <span>Submissions ({examSubs.length})</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setAdmitCardExam(exam);
                              setAdmitCardCandidateId(undefined);
                            }}
                            className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center space-x-1.5 shadow-2xs"
                            title="Generate and print official Admit Cards for all enrolled candidates"
                          >
                            <IdCard className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Admit Cards ({assignedCount})</span>
                          </button>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteExam(exam.id, exam.title)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                          title="Delete Exam"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* Tab: SCORECARDS & EXCEL EXPORT */}
      {activeTab === 'scorecards' && (
        <ExamScorecardsDashboard
          exams={exams}
          submissions={submissions}
          users={users}
          onRefresh={loadData}
          adminName={profile?.displayName || 'Administrator'}
          adminId={profile?.uid || 'admin'}
        />
      )}

      {/* Tab 6: SECURITY PASSCODES */}
      {activeTab === 'security' && (
        <div className="space-y-4">
          <SecurityPasscodesManager />
        </div>
      )}

      {/* Tab 7: AUDIT LOGS */}
      {activeTab === 'logs' && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xs overflow-hidden">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <FileText className="w-4 h-4 text-rose-500" />
              <span>Immutable Audit Trail ({logs.length})</span>
            </h3>
            <button
              type="button"
              onClick={loadData}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-[500px] overflow-y-auto">
            {logs.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No audit entries recorded yet.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-4 flex items-start space-x-3 text-xs">
                  <span className="p-1 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono text-[10px]">
                    {log.action}
                  </span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-slate-200">
                      {log.details}
                    </p>
                    <span className="text-[11px] text-slate-400">
                      by {log.userEmail} • {new Date(log.timestamp).toLocaleString()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Set Default Password Modal */}
      {passwordModalUser && (
        <SetDefaultPasswordModal
          user={passwordModalUser}
          onClose={() => setPasswordModalUser(null)}
          onSuccess={(msg) => {
            setActionSuccess(msg);
            setTimeout(() => setActionSuccess(null), 4000);
            loadData();
          }}
        />
      )}

      {/* Enroll Candidates Modal (Participant Section) */}
      <EnrollCandidateModal
        isOpen={enrollCandidateModalOpen}
        exams={exams}
        onClose={() => setEnrollCandidateModalOpen(false)}
        onSuccess={(msg) => {
          setActionSuccess(msg);
          setTimeout(() => setActionSuccess(null), 5000);
          loadData();
        }}
      />

      {/* Add Staff Modal (Paper Setter & Evaluator Section) */}
      <AddStaffModal
        isOpen={addStaffModalOpen}
        exams={exams}
        initialRole={staffModalRole}
        onClose={() => setAddStaffModalOpen(false)}
        onSuccess={(msg) => {
          setActionSuccess(msg);
          setTimeout(() => setActionSuccess(null), 5000);
          loadData();
        }}
      />

      {/* Sync All Candidates to Uniform Default Password Modal */}
      {syncAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-750/50">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Set Uniform Default Password
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Applies identical default password to all {participants.length} candidates
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSyncAllModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSyncAllCandidates} className="p-5 space-y-4">
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-900/60 text-xs">
                <p className="font-bold text-indigo-950 dark:text-indigo-200 mb-1 flex items-center space-x-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  <span>Uniform Candidate Password Policy</span>
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  This sets the default password to be the same for all candidates. Any candidate who has not yet logged in will use this exact password with their Employee ID, and will be prompted to create their private password on first login.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Uniform Default Password for All Candidates <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newBulkPassword}
                  onChange={(e) => setNewBulkPassword(e.target.value)}
                  placeholder="e.g. Candidate@2026"
                  className="block w-full px-3 py-2 text-xs font-mono bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setSyncAllModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={syncingAll}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm flex items-center space-x-1.5"
                >
                  {syncingAll && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                  <span>{syncingAll ? 'Applying...' : 'Apply to All Candidates'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Generate Exam Modal */}
      {generateExamModalOpen && (
        <GenerateExamModal
          isOpen={generateExamModalOpen}
          onClose={() => setGenerateExamModalOpen(false)}
          onSuccess={(newExam) => {
            setActionSuccess(`Exam "${newExam.title}" generated successfully with assigned roles!`);
            setTimeout(() => setActionSuccess(null), 4000);
            loadData();
          }}
          users={users}
        />
      )}

      {/* Manage Exam Assignments Modal */}
      {manageAssignmentsExam && (
        <ManageExamAssignmentsModal
          isOpen={Boolean(manageAssignmentsExam)}
          exam={manageAssignmentsExam}
          onClose={() => setManageAssignmentsExam(null)}
          onSuccess={() => {
            setActionSuccess(`Role assignments updated for "${manageAssignmentsExam.title}".`);
            setTimeout(() => setActionSuccess(null), 4000);
            loadData();
          }}
          users={users}
        />
      )}

      {/* Alter Exam Schedule Modal */}
      {alterScheduleExam && (
        <AlterExamScheduleModal
          isOpen={Boolean(alterScheduleExam)}
          exam={alterScheduleExam}
          onClose={() => setAlterScheduleExam(null)}
          onSuccess={() => {
            setActionSuccess(`Live schedule updated & authorized for "${alterScheduleExam.title}".`);
            setTimeout(() => setActionSuccess(null), 4000);
            loadData();
          }}
          adminName={profile?.displayName || 'Administrator'}
        />
      )}

      {/* Inspect Questions Modal (View Only) */}
      {inspectQuestionsExam && (
        <InspectExamQuestionsModal
          isOpen={Boolean(inspectQuestionsExam)}
          exam={inspectQuestionsExam}
          onClose={() => setInspectQuestionsExam(null)}
        />
      )}

      {/* Inspect Submissions Modal (View Only) */}
      {inspectSubmissionsExam && (
        <InspectExamSubmissionsModal
          isOpen={Boolean(inspectSubmissionsExam)}
          exam={inspectSubmissionsExam}
          submissions={submissions}
          onClose={() => setInspectSubmissionsExam(null)}
        />
      )}

      {/* Authorize & Publish Results to Candidates Modal */}
      {authorizeResultsExam && (
        <AuthorizeResultsPublicationModal
          isOpen={Boolean(authorizeResultsExam)}
          exam={authorizeResultsExam}
          submissions={submissions}
          adminName={profile?.displayName || 'Administrator'}
          onClose={() => setAuthorizeResultsExam(null)}
          onSuccess={(msg) => {
            setActionSuccess(msg);
            setTimeout(() => setActionSuccess(null), 5000);
            loadData();
          }}
        />
      )}

      {/* Link Single Candidate from General Pool to Particular Exam */}
      {linkCandidateModalUser && (
        <LinkCandidateToExamModal
          isOpen={Boolean(linkCandidateModalUser)}
          candidate={linkCandidateModalUser}
          exams={exams}
          onClose={() => setLinkCandidateModalUser(null)}
          onSuccess={(msg) => {
            setActionSuccess(msg);
            setTimeout(() => setActionSuccess(null), 4000);
            loadData();
          }}
        />
      )}

      {/* Bulk Link Candidates to Particular Exam */}
      {bulkLinkModalOpen && (
        <LinkCandidateToExamModal
          isOpen={bulkLinkModalOpen}
          candidate={null}
          candidates={participants.filter((p) => selectedCandidateUids.includes(p.uid))}
          exams={exams}
          onClose={() => {
            setBulkLinkModalOpen(false);
            setSelectedCandidateUids([]);
          }}
          onSuccess={(msg) => {
            setActionSuccess(msg);
            setTimeout(() => setActionSuccess(null), 4000);
            setSelectedCandidateUids([]);
            loadData();
          }}
        />
      )}

      {/* Authorize Question Challenge Resolution Modal */}
      {authorizeChallengeModalItem && (
        <AuthorizeChallengeModal
          isOpen={Boolean(authorizeChallengeModalItem)}
          challenge={authorizeChallengeModalItem}
          adminId={profile?.uid || 'admin'}
          adminName={profile?.displayName || 'Administrator'}
          onClose={() => setAuthorizeChallengeModalItem(null)}
          onSuccess={() => {
            setActionSuccess('Challenge resolution authorized and candidate scorecard updated successfully.');
            setTimeout(() => setActionSuccess(null), 5000);
            loadData();
          }}
        />
      )}

      {/* View Challenge Details Modal */}
      {viewChallengeDetailsAdmin && (
        <ChallengeDetailsModal
          isOpen={Boolean(viewChallengeDetailsAdmin)}
          challenge={viewChallengeDetailsAdmin}
          onClose={() => setViewChallengeDetailsAdmin(null)}
        />
      )}

      {/* Admit Card Generation & Verification Modal */}
      {admitCardExam && (
        <AdmitCardModal
          isOpen={Boolean(admitCardExam)}
          exam={admitCardExam}
          candidates={participants.filter((p) => {
            const fromRoster = admitCardExam.assignedParticipantIds || [];
            return fromRoster.includes(p.uid) || p.assignedExamId === admitCardExam.id;
          })}
          initialCandidateId={admitCardCandidateId}
          onClose={() => {
            setAdmitCardExam(null);
            setAdmitCardCandidateId(undefined);
          }}
        />
      )}
    </div>
  );
};
