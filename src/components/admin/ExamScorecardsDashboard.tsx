import React, { useState, useEffect } from 'react';
import { Exam, Submission, UserProfile, Question } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  Award,
  Download,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  ShieldCheck,
  FileSpreadsheet,
  AlertTriangle,
  HelpCircle,
  Eye,
  RefreshCw,
  Sparkles,
  ArrowUpDown,
  BookOpen,
  User,
  ShieldAlert,
  Percent,
  CheckSquare,
  GitCompare,
  History,
  FileText,
  Layers,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { OfficialScorecardModal } from '../participant/OfficialScorecardModal';
import * as XLSX from 'xlsx';

interface ExamScorecardsDashboardProps {
  exams: Exam[];
  submissions: Submission[];
  users: UserProfile[];
  onRefresh: () => void;
  adminName: string;
  adminId: string;
}

export const ExamScorecardsDashboard: React.FC<ExamScorecardsDashboardProps> = ({
  exams,
  submissions,
  users,
  onRefresh,
  adminName,
  adminId,
}) => {
  const [selectedExamId, setSelectedExamId] = useState<string>(exams.length > 0 ? exams[0].id : '');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Ledger View Mode: Post-Resolution vs Pre-Challenge Baseline vs Comparative Audit
  const [ledgerViewMode, setLedgerViewMode] = useState<'post_resolution' | 'pre_challenge' | 'comparison'>('post_resolution');
  // Candidate Audit Sheet modal state
  const [candidateAuditSub, setCandidateAuditSub] = useState<Submission | null>(null);

  // Challenge Window Schedule State
  const [deadlineInput, setDeadlineInput] = useState('');
  const [savingDeadline, setSavingDeadline] = useState(false);
  const [deadlineSuccessNotice, setDeadlineSuccessNotice] = useState<string | null>(null);

  // Question Skipping / Debatable Questions State
  const [skipModalQuestion, setSkipModalQuestion] = useState<Question | null>(null);
  const [skipReason, setSkipReason] = useState('Ambiguity in question prompt / multiple valid interpretations');
  const [submittingSkip, setSubmittingSkip] = useState(false);

  // Scorecard modal state
  const [viewScorecardSub, setViewScorecardSub] = useState<Submission | null>(null);

  const selectedExam = exams.find((e) => e.id === selectedExamId) || null;

  // Sync deadline input when selected exam changes
  useEffect(() => {
    if (selectedExam?.challengeDeadline) {
      // Format for datetime-local input (YYYY-MM-DDTHH:mm)
      try {
        const d = new Date(selectedExam.challengeDeadline);
        const pad = (n: number) => n.toString().padStart(2, '0');
        const formatted = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        setDeadlineInput(formatted);
      } catch {
        setDeadlineInput('');
      }
    } else {
      setDeadlineInput('');
    }
  }, [selectedExamId, selectedExam?.challengeDeadline]);

  // Load questions for selected exam
  useEffect(() => {
    if (selectedExamId) {
      setLoadingQuestions(true);
      examService
        .getQuestions(selectedExamId)
        .then((qs) => setQuestions(qs))
        .catch((err) => console.error(err))
        .finally(() => setLoadingQuestions(false));
    } else {
      setQuestions([]);
    }
  }, [selectedExamId]);

  // Submissions for selected exam
  const examSubmissions = submissions.filter((s) => s.examId === selectedExamId);

  // Calculate statistics
  const totalAttempted = examSubmissions.length;
  const passingMarks = selectedExam?.passingMarks || 25;
  const maxMarks = selectedExam?.totalMarks || 50;

  const passedSubmissions = examSubmissions.filter((s) => {
    const score = s.totalScore ?? 0;
    return s.passed ?? score >= passingMarks;
  });
  const failedSubmissions = examSubmissions.filter((s) => {
    const score = s.totalScore ?? 0;
    return !(s.passed ?? score >= passingMarks);
  });

  const passCount = passedSubmissions.length;
  const failCount = failedSubmissions.length;
  const passRate = totalAttempted > 0 ? Math.round((passCount / totalAttempted) * 100) : 0;
  const avgScore = totalAttempted > 0
    ? (examSubmissions.reduce((sum, s) => sum + (s.totalScore || 0), 0) / totalAttempted).toFixed(1)
    : '0.0';

  const skippedQuestionsCount = selectedExam?.skippedQuestionIds?.length || 0;
  const submissionsWithSnapshots = examSubmissions.filter((s) => Boolean(s.beforeChallengeSnapshot));
  const hasHistoricalSnapshots = submissionsWithSnapshots.length > 0;

  // Filtered submissions for display
  const filteredSubmissions = examSubmissions.filter((s) => {
    const matchesSearch =
      s.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.participantEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (s.id && s.id.toLowerCase().includes(searchTerm.toLowerCase()));

    const score = s.totalScore ?? 0;
    const isPass = s.passed ?? score >= passingMarks;

    if (statusFilter === 'pass') return matchesSearch && isPass;
    if (statusFilter === 'fail') return matchesSearch && !isPass;
    return matchesSearch;
  });

  // Handle saving challenge deadline
  const handleSaveChallengeDeadline = async () => {
    if (!selectedExam) return;
    try {
      setSavingDeadline(true);
      const isoDeadline = deadlineInput ? new Date(deadlineInput).toISOString() : '';
      await examService.setExamChallengeDeadline(
        selectedExam.id,
        isoDeadline,
        Boolean(isoDeadline),
        adminName
      );
      setDeadlineSuccessNotice('Scheduled Challenge Window updated successfully!');
      setTimeout(() => setDeadlineSuccessNotice(null), 4000);
      onRefresh();
    } catch (err: any) {
      alert('Error updating challenge deadline: ' + err.message);
    } finally {
      setSavingDeadline(false);
    }
  };

  // Handle Approving Question Skip and Re-scoring All Candidates
  const handleApproveQuestionSkip = async () => {
    if (!selectedExam || !skipModalQuestion) return;
    try {
      setSubmittingSkip(true);
      const res = await examService.approveSkipQuestionAndReScoreAll(
        selectedExam.id,
        skipModalQuestion.id,
        adminId,
        adminName,
        skipReason
      );
      const originalTotal = selectedExam.originalTotalMarks || selectedExam.totalMarks;
      const originalPassing = selectedExam.originalPassingMarks || selectedExam.passingMarks;
      const newTotal = Math.max(1, selectedExam.totalMarks - skipModalQuestion.marks);
      const newPassing = Math.max(1, Math.round((originalPassing / originalTotal) * newTotal));

      alert(
        `Debatable question "${skipModalQuestion.title}" skipped successfully!\n\n` +
        `• Exam Total Marks: Decreased from ${selectedExam.totalMarks} to ${newTotal}\n` +
        `• Passing Marks: Decreased proportionately from ${selectedExam.passingMarks} to ${newPassing}\n` +
        `• Evaluation: Dropped debatable question from scoring and re-evaluated ${res.affectedCount + res.unattemptedCount} candidate submissions.\n` +
        `• Audit Preservation: Baseline data, marks, scorecards, and answer sheets before challenge are preserved for Administrator review.`
      );
      setSkipModalQuestion(null);
      onRefresh();
      // Reload questions
      const qs = await examService.getQuestions(selectedExam.id);
      setQuestions(qs);
    } catch (err: any) {
      alert('Failed to skip question: ' + err.message);
    } finally {
      setSubmittingSkip(false);
    }
  };

  // Export to Excel format (.xlsx / .xls / .csv) compatible with Microsoft Excel
  const handleDownloadExcel = (
    format: 'xlsx' | 'xls' | 'csv' = 'xlsx',
    mode: 'post_resolution' | 'pre_challenge' | 'comparison' = ledgerViewMode
  ) => {
    if (!selectedExam) return;

    const dateStr = new Date().toISOString().split('T')[0];
    const cleanTitle = selectedExam.title.replace(/[^a-zA-Z0-9_-]/g, '_');

    if (mode === 'comparison') {
      // Comparison Headers: Side-by-Side Before vs After Resolution
      const compHeaders = [
        'Rank',
        'Candidate Name',
        'Candidate Email',
        'Employee ID / Roll',
        'Pre-Challenge Score',
        'Pre-Challenge Max Marks',
        'Pre-Challenge Passing Standard',
        'Pre-Challenge %',
        'Pre-Challenge Result',
        'Post-Resolution Score',
        'Post-Resolution Max Marks',
        'Post-Resolution Passing Standard',
        'Post-Resolution %',
        'Post-Resolution Result',
        'Net Score Delta (Change)',
        'Debatable Questions Skipped',
        'Questions Attempted',
        'Submission Timestamp'
      ];

      const compItems = filteredSubmissions.map((s, idx) => {
        const snap = s.beforeChallengeSnapshot;
        const userObj = users.find((u) => u.uid === s.participantId);
        const empId = userObj?.employeeId || s.participantId.slice(0, 8).toUpperCase();

        const preScore = snap ? snap.totalScore : (s.totalScore ?? 0);
        const preMax = snap ? snap.totalMarks : (selectedExam.originalTotalMarks || maxMarks);
        const prePass = snap ? snap.passingMarks : (selectedExam.originalPassingMarks || passingMarks);
        const prePct = snap ? snap.percentage : (preMax > 0 ? Math.round((preScore / preMax) * 100) : 0);
        const preResult = snap ? (snap.passed ? 'PASS' : 'FAIL') : (preScore >= prePass ? 'PASS' : 'FAIL');

        const postScore = s.totalScore ?? 0;
        const postMax = maxMarks;
        const postPass = passingMarks;
        const postPct = s.percentage ?? (postMax > 0 ? Math.round((postScore / postMax) * 100) : 0);
        const postResult = s.passed ?? (postScore >= postPass) ? 'PASS' : 'FAIL';

        const delta = postScore - preScore;
        const deltaStr = delta > 0 ? `+${delta}` : `${delta}`;
        const attemptedCount = Object.values(s.answers || {}).filter((a) => a.answer && a.answer.trim()).length;

        return {
          rank: idx + 1,
          candidateName: s.participantName,
          candidateEmail: s.participantEmail,
          employeeId: empId,
          preScore,
          preMax,
          prePass,
          prePct: `${prePct}%`,
          preResult,
          postScore,
          postMax,
          postPass,
          postPct: `${postPct}%`,
          postResult,
          deltaStr,
          skippedCount: skippedQuestionsCount,
          attempted: attemptedCount,
          timestamp: s.submittedAt ? new Date(s.submittedAt).toLocaleString() : 'N/A'
        };
      });

      if (format === 'xlsx') {
        const sheetData = compItems.map((d) => ({
          'Rank': d.rank,
          'Candidate Name': d.candidateName,
          'Candidate Email': d.candidateEmail,
          'Employee ID / Roll': d.employeeId,
          'Pre-Challenge Score': d.preScore,
          'Pre-Challenge Max Marks': d.preMax,
          'Pre-Challenge Passing Standard': d.prePass,
          'Pre-Challenge %': d.prePct,
          'Pre-Challenge Result': d.preResult,
          'Post-Resolution Score': d.postScore,
          'Post-Resolution Max Marks': d.postMax,
          'Post-Resolution Passing Standard': d.postPass,
          'Post-Resolution %': d.postPct,
          'Post-Resolution Result': d.postResult,
          'Net Score Delta': d.deltaStr,
          'Debatable Questions Skipped': d.skippedCount,
          'Questions Attempted': d.attempted,
          'Submission Timestamp': d.timestamp,
        }));
        const ws = XLSX.utils.json_to_sheet(sheetData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Comparative_Audit');
        XLSX.writeFile(wb, `ComparativeAudit_${cleanTitle}_${dateStr}.xlsx`);
        return;
      }

      if (format === 'xls') {
        const htmlTable = `
          <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
          <head>
            <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
            <style>
              th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #94a3b8; padding: 8px; }
              td { border: 1px solid #cbd5e1; padding: 6px; }
              .pass { background-color: #dcfce7; color: #166534; font-weight: bold; }
              .fail { background-color: #ffe4e6; color: #9f1239; font-weight: bold; }
              .delta-plus { color: #16a34a; font-weight: bold; }
              .delta-minus { color: #dc2626; font-weight: bold; }
            </style>
          </head>
          <body>
            <h2>Comparative Examination Resolution Ledger (Before vs After Challenge) - ${selectedExam.title}</h2>
            <p>Generated on: ${new Date().toLocaleString()} | Pre-Challenge: ${selectedExam.originalTotalMarks || maxMarks} Marks (Pass: ${selectedExam.originalPassingMarks || passingMarks}) | Post-Resolution: ${maxMarks} Marks (Pass: ${passingMarks})</p>
            <table>
              <thead>
                <tr>
                  ${compHeaders.map((h) => `<th>${h}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${compItems
                  .map(
                    (d) => `
                  <tr>
                    <td>${d.rank}</td>
                    <td><strong>${d.candidateName}</strong></td>
                    <td>${d.candidateEmail}</td>
                    <td>${d.employeeId}</td>
                    <td>${d.preScore}</td>
                    <td>${d.preMax}</td>
                    <td>${d.prePass}</td>
                    <td>${d.prePct}</td>
                    <td class="${d.preResult === 'PASS' ? 'pass' : 'fail'}">${d.preResult}</td>
                    <td><strong>${d.postScore}</strong></td>
                    <td>${d.postMax}</td>
                    <td>${d.postPass}</td>
                    <td><strong>${d.postPct}</strong></td>
                    <td class="${d.postResult === 'PASS' ? 'pass' : 'fail'}">${d.postResult}</td>
                    <td class="${d.deltaStr.startsWith('+') ? 'delta-plus' : d.deltaStr.startsWith('-') ? 'delta-minus' : ''}">${d.deltaStr}</td>
                    <td>${d.skippedCount}</td>
                    <td>${d.attempted}</td>
                    <td>${d.timestamp}</td>
                  </tr>
                `
                  )
                  .join('')}
              </tbody>
            </table>
          </body>
          </html>
        `;

        const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `ComparativeAudit_${cleanTitle}_${dateStr}.xls`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      } else {
        const rows = compItems.map((d) => [
          d.rank,
          `"${d.candidateName.replace(/"/g, '""')}"`,
          `"${d.candidateEmail}"`,
          `"${d.employeeId}"`,
          d.preScore,
          d.preMax,
          d.prePass,
          `"${d.prePct}"`,
          d.preResult,
          d.postScore,
          d.postMax,
          d.postPass,
          `"${d.postPct}"`,
          d.postResult,
          `"${d.deltaStr}"`,
          d.skippedCount,
          d.attempted,
          `"${d.timestamp}"`
        ]);

        const csvContent = '\uFEFF' + [compHeaders.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', `ComparativeAudit_${cleanTitle}_${dateStr}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
      return;
    }

    // Default Single Ledger Export (Post-Resolution or Pre-Challenge)
    const isPre = mode === 'pre_challenge';
    const headers = [
      'Rank',
      'Exam Title',
      'Subject',
      'Candidate Name',
      'Candidate Email',
      'Employee ID / Roll',
      'Questions Attempted',
      'Total Questions',
      'Marks Obtained',
      'Total Marks',
      'Percentage (%)',
      'Pass / Fail Remark',
      'Passing Standard',
      'Evaluator Remarks',
      'Proctoring Violation Strikes',
      'Submission Timestamp'
    ];

    const dataItems = filteredSubmissions.map((s, idx) => {
      const snap = isPre ? s.beforeChallengeSnapshot : null;
      const score = snap ? snap.totalScore : (s.totalScore ?? 0);
      const subMax = snap ? snap.totalMarks : maxMarks;
      const subPassing = snap ? snap.passingMarks : passingMarks;
      const isPass = snap ? snap.passed : (s.passed ?? score >= passingMarks);
      const pct = snap ? snap.percentage : (s.percentage ?? (subMax > 0 ? Math.round((score / subMax) * 100) : 0));
      const userObj = users.find((u) => u.uid === s.participantId);
      const empId = userObj?.employeeId || s.participantId.slice(0, 8).toUpperCase();
      const currentAnswers = snap ? snap.answers : (s.answers || {});
      const attemptedQCount = Object.values(currentAnswers || {}).filter((a) => a.answer && a.answer.trim()).length;

      return {
        rank: idx + 1,
        examTitle: selectedExam.title,
        subject: selectedExam.subject,
        candidateName: s.participantName,
        candidateEmail: s.participantEmail,
        employeeId: empId,
        attempted: attemptedQCount,
        totalQuestions: questions.length || selectedExam.questionsCount,
        marksObtained: score,
        totalMarks: subMax,
        percentage: `${pct}%`,
        remark: isPass ? 'PASS' : 'FAIL',
        passingStandard: `${subPassing} Marks`,
        evaluatorRemarks: s.evaluatorNotes || 'Evaluated',
        violations: s.tabSwitchCount || 0,
        timestamp: s.submittedAt ? new Date(s.submittedAt).toLocaleString() : 'N/A'
      };
    });

    if (format === 'xlsx') {
      const sheetData = dataItems.map((d) => ({
        'Rank': d.rank,
        'Exam Title': d.examTitle,
        'Subject': d.subject,
        'Candidate Name': d.candidateName,
        'Candidate Email': d.candidateEmail,
        'Employee ID / Roll': d.employeeId,
        'Questions Attempted': d.attempted,
        'Total Questions': d.totalQuestions,
        'Marks Obtained': d.marksObtained,
        'Total Marks': d.totalMarks,
        'Percentage (%)': d.percentage,
        'Pass / Fail Remark': d.remark,
        'Passing Standard': d.passingStandard,
        'Evaluator Remarks': d.evaluatorRemarks,
        'Proctoring Violation Strikes': d.violations,
        'Submission Timestamp': d.timestamp,
      }));
      const ws = XLSX.utils.json_to_sheet(sheetData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, isPre ? 'Pre_Challenge_Ledger' : 'Scorecards_Ledger');
      XLSX.writeFile(wb, `ExamScorecards_${isPre ? 'PreChallenge_' : ''}${cleanTitle}_${dateStr}.xlsx`);
      return;
    }

    if (format === 'xls') {
      const htmlTable = `
        <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=utf-8"/>
          <style>
            th { background-color: #1e293b; color: #ffffff; font-weight: bold; border: 1px solid #94a3b8; padding: 8px; }
            td { border: 1px solid #cbd5e1; padding: 6px; }
            .pass { background-color: #dcfce7; color: #166534; font-weight: bold; }
            .fail { background-color: #ffe4e6; color: #9f1239; font-weight: bold; }
          </style>
        </head>
        <body>
          <h2>Institutional Examination Scorecard Ledger ${isPre ? '(Pre-Challenge Baseline)' : '(Post-Resolution)'} - ${selectedExam.title}</h2>
          <p>Generated on: ${new Date().toLocaleString()} | Passing Marks: ${passingMarks} / ${maxMarks}</p>
          <table>
            <thead>
              <tr>
                ${headers.map((h) => `<th>${h}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${dataItems
                .map(
                  (d) => `
                <tr>
                  <td>${d.rank}</td>
                  <td>${d.examTitle}</td>
                  <td>${d.subject}</td>
                  <td><strong>${d.candidateName}</strong></td>
                  <td>${d.candidateEmail}</td>
                  <td>${d.employeeId}</td>
                  <td>${d.attempted}</td>
                  <td>${d.totalQuestions}</td>
                  <td><strong>${d.marksObtained}</strong></td>
                  <td>${d.totalMarks}</td>
                  <td><strong>${d.percentage}</strong></td>
                  <td class="${d.remark === 'PASS' ? 'pass' : 'fail'}">${d.remark}</td>
                  <td>${d.passingStandard}</td>
                  <td>${d.evaluatorRemarks}</td>
                  <td>${d.violations}</td>
                  <td>${d.timestamp}</td>
                </tr>
              `
                )
                .join('')}
            </tbody>
          </table>
        </body>
        </html>
      `;

      const blob = new Blob([htmlTable], { type: 'application/vnd.ms-excel;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ExamScorecards_${isPre ? 'PreChallenge_' : ''}${cleanTitle}_${dateStr}.xls`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } else {
      const rows = dataItems.map((d) => [
        d.rank,
        `"${d.examTitle.replace(/"/g, '""')}"`,
        `"${d.subject.replace(/"/g, '""')}"`,
        `"${d.candidateName.replace(/"/g, '""')}"`,
        `"${d.candidateEmail}"`,
        `"${d.employeeId}"`,
        d.attempted,
        d.totalQuestions,
        d.marksObtained,
        d.totalMarks,
        `"${d.percentage}"`,
        d.remark,
        `"${d.passingStandard}"`,
        `"${d.evaluatorRemarks.replace(/"/g, '""')}"`,
        d.violations,
        `"${d.timestamp}"`
      ]);

      const csvContent = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `ExamScorecards_${isPre ? 'PreChallenge_' : ''}${cleanTitle}_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const isDeadlinePassed = selectedExam?.challengeDeadline
    ? new Date() > new Date(selectedExam.challengeDeadline)
    : false;

  return (
    <div className="space-y-6 animate-in fade-in">
      {/* Top Banner & Exam Selector */}
      <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400">
            <Award className="w-5 h-5" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Exam-Wise Scorecards & Result Management
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            View itemized candidate evaluations, control challenge deadlines, manage debatable questions, and export reports in Excel format.
          </p>
        </div>

        {/* Exam Picker & Export Button */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="w-full sm:w-72">
            <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">
              Select Examination:
            </label>
            <select
              value={selectedExamId}
              onChange={(e) => setSelectedExamId(e.target.value)}
              className="w-full px-3.5 py-2 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            >
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({e.subject})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center space-x-2 mt-auto">
            <button
              type="button"
              onClick={() => handleDownloadExcel('xlsx')}
              disabled={!selectedExam || examSubmissions.length === 0}
              className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/20 transition-all disabled:opacity-40 cursor-pointer"
              title="Download formatted Microsoft Excel (.xlsx) spreadsheet with pass/fail remarks and scorecard ledger"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Download in Excel (.xlsx)</span>
            </button>

            <button
              type="button"
              onClick={() => handleDownloadExcel('csv')}
              disabled={!selectedExam || examSubmissions.length === 0}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-650 text-slate-700 dark:text-slate-200 font-semibold text-xs shadow-2xs transition-all disabled:opacity-40 cursor-pointer"
              title="Download raw CSV file compatible with Excel"
            >
              <Download className="w-3.5 h-3.5" />
              <span>CSV</span>
            </button>
          </div>
        </div>
      </div>

      {selectedExam && (
        <>
          {/* Summary Statistics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3.5">
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Total Attempted</span>
              <div className="text-2xl font-black text-slate-900 dark:text-white">{totalAttempted}</div>
              <span className="text-[11px] text-slate-500">Candidates evaluated</span>
            </div>

            <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/60 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 block mb-1">Passed (Qualified)</span>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{passCount}</div>
              <span className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">{passRate}% pass rate</span>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/60 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/60 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-rose-600 dark:text-rose-400 block mb-1">Failed (Not Qualified)</span>
              <div className="text-2xl font-black text-rose-600 dark:text-rose-400">{failCount}</div>
              <span className="text-[11px] text-rose-700 dark:text-rose-300 font-semibold">
                {totalAttempted > 0 ? (100 - passRate) : 0}% fail rate
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/60 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 block mb-1">Average Score</span>
              <div className="text-2xl font-black text-indigo-600 dark:text-indigo-400">{avgScore}</div>
              <span className="text-[11px] text-indigo-700 dark:text-indigo-300">
                Out of {maxMarks} marks {selectedExam.originalTotalMarks && selectedExam.originalTotalMarks !== maxMarks ? `(reduced from ${selectedExam.originalTotalMarks})` : ''}
              </span>
            </div>

            <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 shadow-xs">
              <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 block mb-1">Skipped Questions</span>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400">{skippedQuestionsCount}</div>
              <span className="text-[11px] text-amber-700 dark:text-amber-300">Debatable / Excluded from Exam</span>
            </div>
          </div>

          {/* Candidate Attempt Regulation Info Banner if set */}
          {selectedExam.maxQuestionsToAttempt && selectedExam.maxQuestionsToAttempt < questions.length && (
            <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 text-xs flex flex-wrap items-center justify-between gap-3 text-indigo-950 dark:text-indigo-200">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-extrabold text-[10px] uppercase">
                  Attempt Rule
                </span>
                <span className="font-semibold">
                  Out of <strong>{questions.length}</strong> questions in paper, candidates are permitted to appear in only <strong>{selectedExam.maxQuestionsToAttempt}</strong> questions.
                </span>
              </div>
              <span className="text-[11px] text-indigo-700 dark:text-indigo-300 font-medium">
                Compulsory Questions: {questions.filter((q: Question) => q.isMandatory).length} (Must Attend)
              </span>
            </div>
          )}

          {/* Scheduled Challenge Deadline Window Management */}
          <div className="p-5 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2 font-bold text-sm text-slate-900 dark:text-white">
                  <Calendar className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  <span>Scheduled Question Challenge Window (Administrator Control)</span>
                </div>
                <p className="text-xs text-slate-500">
                  Candidates can challenge answer keys up to this scheduled date & time in a single batch. On expiry, no further challenges can be submitted.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                {selectedExam.challengeDeadline ? (
                  isDeadlinePassed ? (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                      Challenge Window Expired
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Window Active until {new Date(selectedExam.challengeDeadline).toLocaleString()}</span>
                    </span>
                  )
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    No Deadline Configured
                  </span>
                )}
              </div>
            </div>

            {deadlineSuccessNotice && (
              <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{deadlineSuccessNotice}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <div className="relative">
                <input
                  type="datetime-local"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  className="px-3.5 py-2 text-xs font-medium rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <button
                type="button"
                onClick={handleSaveChallengeDeadline}
                disabled={savingDeadline}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {savingDeadline ? 'Saving...' : 'Set Challenge Window Deadline'}
              </button>

              {selectedExam.challengeDeadline && (
                <button
                  type="button"
                  onClick={() => {
                    setDeadlineInput('');
                    examService.setExamChallengeDeadline(selectedExam.id, '', false, adminName).then(onRefresh);
                  }}
                  className="px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-600 text-xs text-slate-600 dark:text-slate-400 hover:bg-slate-100 transition-colors"
                >
                  Close Window
                </button>
              )}
            </div>
          </div>

          {/* Debatable Question Management Bar (Evaluator Recommendation & Admin Approval) */}
          <div className="p-5 rounded-3xl bg-amber-50/40 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/50 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2 font-bold text-sm text-amber-900 dark:text-amber-200">
                  <AlertTriangle className="w-4 h-4 text-amber-600" />
                  <span>Debatable Question Handling & Global Candidate Re-scoring</span>
                </div>
                <p className="text-xs text-amber-800/80 dark:text-amber-300/80">
                  On Debatable Question Skip, the total marks of the exam are decreased, passing marks are decreased proportionately, and candidate evaluations are recalculated accordingly. All candidate data, marks, scorecards, and answer sheets before the challenge are preserved for Administrator review and comparative audit.
                </p>
              </div>
            </div>

            {/* Questions with recommendations or list */}
            <div className="divide-y divide-amber-200/60 dark:divide-amber-800/40 border border-amber-200 dark:border-amber-800/60 rounded-2xl bg-white dark:bg-slate-800 overflow-hidden text-xs">
              {questions.length === 0 ? (
                <div className="p-4 text-center text-slate-400">Loading exam questions...</div>
              ) : (
                questions.map((q, idx) => {
                  const hasRecommendation = Boolean(q.skipRecommendation && q.skipRecommendation.status === 'pending');
                  const isSkipped = Boolean(q.isSkipped);

                  return (
                    <div key={q.id} className="p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-amber-50/30 dark:hover:bg-amber-950/10">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="font-bold text-slate-900 dark:text-white">
                            Q{idx + 1}. {q.title}
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-mono">
                            {q.marks} Marks • {q.type.toUpperCase()}
                          </span>
                          {isSkipped && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                              Debatable / Skipped (Total & Passing Marks Reduced Proportionately)
                            </span>
                          )}
                          {hasRecommendation && !isSkipped && (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold animate-pulse">
                              Skip Recommended by {q.skipRecommendation?.recommendedBy}
                            </span>
                          )}
                        </div>

                        {q.skipRecommendation && (
                          <div className="text-[11px] text-amber-700 dark:text-amber-300">
                            <strong>Recommendation Reason: </strong>"{q.skipRecommendation.reason}"
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 flex items-center space-x-2">
                        {!isSkipped ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSkipModalQuestion(q);
                              setSkipReason(q.skipRecommendation?.reason || 'Debatable question prompt / ambiguous options');
                            }}
                            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-2xs transition-all cursor-pointer"
                          >
                            {hasRecommendation ? 'Approve Skip & Re-score All' : 'Skip Debatable Question'}
                          </button>
                        ) : (
                          <span className="text-emerald-600 dark:text-emerald-400 font-bold text-xs flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Skipped & Re-evaluated</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Candidate Scorecard & Comparative Audit System */}
          <div className="p-6 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
            {/* Header & Ledger Mode Switcher */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    {ledgerViewMode === 'comparison'
                      ? 'Before vs After Resolution Comparative Audit Ledger'
                      : ledgerViewMode === 'pre_challenge'
                      ? 'Pre-Challenge Baseline Scorecards (Archived State)'
                      : 'Official Post-Resolution Scorecard Ledger'}
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                    {filteredSubmissions.length} Candidates
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  {ledgerViewMode === 'comparison'
                    ? 'Audit delta in marks, passing status, and answer sheets across challenge resolutions & question skips.'
                    : ledgerViewMode === 'pre_challenge'
                    ? `Passing criteria at baseline: Minimum ${selectedExam.originalPassingMarks || passingMarks} / ${selectedExam.originalTotalMarks || maxMarks} Marks`
                    : `Current passing criteria: Minimum ${passingMarks} / ${maxMarks} Marks (${Math.round((passingMarks / maxMarks) * 100)}%)`}
                </p>
              </div>

              {/* View Mode Tabs */}
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center p-1 rounded-2xl bg-slate-100 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 text-xs">
                  <button
                    type="button"
                    onClick={() => setLedgerViewMode('post_resolution')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                      ledgerViewMode === 'post_resolution'
                        ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Award className="w-3.5 h-3.5" />
                    <span>Post-Resolution</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLedgerViewMode('pre_challenge')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                      ledgerViewMode === 'pre_challenge'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <History className="w-3.5 h-3.5" />
                    <span>Pre-Challenge Baseline</span>
                    {hasHistoricalSnapshots && (
                      <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100 font-mono">
                        {submissionsWithSnapshots.length}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setLedgerViewMode('comparison')}
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                      ledgerViewMode === 'comparison'
                        ? 'bg-indigo-600 text-white shadow-xs'
                        : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <GitCompare className="w-3.5 h-3.5" />
                    <span>Comparative Audit</span>
                  </button>
                </div>

                {/* Filters */}
                <div className="flex items-center space-x-2">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Search candidate..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white w-36 sm:w-44"
                    />
                  </div>

                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value as any)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    <option value="all">All Results</option>
                    <option value="pass">PASS Only</option>
                    <option value="fail">FAIL Only</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Context Notice for Modes */}
            {ledgerViewMode === 'comparison' && (
              <div className="p-3.5 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-indigo-950 dark:text-indigo-200">
                <div className="flex items-center space-x-2">
                  <GitCompare className="w-4 h-4 text-indigo-600 shrink-0" />
                  <span>
                    <strong>Resolution Audit Comparison:</strong> Displays each candidate's marks, passing status, and answer sheet before question challenge versus after resolution.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadExcel('xlsx', 'comparison')}
                  className="px-3 py-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shrink-0 self-start sm:self-auto flex items-center space-x-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3 h-3" />
                  <span>Download Comparative Ledger (.xlsx)</span>
                </button>
              </div>
            )}

            {ledgerViewMode === 'pre_challenge' && (
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-amber-950 dark:text-amber-200">
                <div className="flex items-center space-x-2">
                  <History className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>Pre-Challenge Baseline Archive:</strong> Showing original evaluation standards (Total: {selectedExam.originalTotalMarks || maxMarks} Marks, Passing: {selectedExam.originalPassingMarks || passingMarks} Marks) before challenge resolutions or debatable skips.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleDownloadExcel('xlsx', 'pre_challenge')}
                  className="px-3 py-1 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shrink-0 self-start sm:self-auto flex items-center space-x-1 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3 h-3" />
                  <span>Download Baseline (.xlsx)</span>
                </button>
              </div>
            )}

            {/* Table Area */}
            {ledgerViewMode === 'comparison' ? (
              /* Comparative Side-by-Side Table */
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Candidate & Emp ID</th>
                      <th className="py-3 px-4">Pre-Challenge Score</th>
                      <th className="py-3 px-4">Post-Resolution Score</th>
                      <th className="py-3 px-4">Net Change (Delta)</th>
                      <th className="py-3 px-4">Percentage Shift</th>
                      <th className="py-3 px-4">Result Transition</th>
                      <th className="py-3 px-4 text-right">Comparative Audit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                    {filteredSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No candidate scorecard records match your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredSubmissions
                        .sort((a, b) => (b.totalScore || 0) - (a.totalScore || 0))
                        .map((sub, idx) => {
                          const snap = sub.beforeChallengeSnapshot;
                          const userObj = users.find((u) => u.uid === sub.participantId);
                          const empId = userObj?.employeeId || sub.participantId.slice(0, 8).toUpperCase();

                          const preScore = snap ? snap.totalScore : (sub.totalScore ?? 0);
                          const preMax = snap ? snap.totalMarks : (selectedExam.originalTotalMarks || maxMarks);
                          const prePass = snap ? snap.passingMarks : (selectedExam.originalPassingMarks || passingMarks);
                          const prePct = snap ? snap.percentage : (preMax > 0 ? Math.round((preScore / preMax) * 100) : 0);
                          const prePassStatus = snap ? snap.passed : (preScore >= prePass);

                          const postScore = sub.totalScore ?? 0;
                          const postMax = maxMarks;
                          const postPass = passingMarks;
                          const postPct = sub.percentage ?? (postMax > 0 ? Math.round((postScore / postMax) * 100) : 0);
                          const postPassStatus = sub.passed ?? (postScore >= postPass);

                          const delta = postScore - preScore;

                          return (
                            <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50">
                              <td className="py-3 px-4 font-mono font-bold text-slate-400">
                                #{idx + 1}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {sub.participantName}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 font-mono">
                                  <span className="bg-slate-100 dark:bg-slate-700 px-1 rounded">ID: {empId}</span>
                                  <span>•</span>
                                  <span>{sub.participantEmail}</span>
                                </div>
                              </td>

                              {/* Pre-Challenge Score */}
                              <td className="py-3 px-4 font-mono">
                                <span className="text-slate-600 dark:text-slate-300 font-bold">{preScore}</span>
                                <span className="text-slate-400 text-[11px]"> / {preMax}</span>
                                <div className="text-[10px] text-slate-400">Pass Req: {prePass}</div>
                              </td>

                              {/* Post-Resolution Score */}
                              <td className="py-3 px-4 font-mono">
                                <span className="text-indigo-600 dark:text-indigo-400 font-black text-sm">{postScore}</span>
                                <span className="text-slate-400 text-[11px]"> / {postMax}</span>
                                <div className="text-[10px] text-slate-400">Pass Req: {postPass}</div>
                              </td>

                              {/* Delta */}
                              <td className="py-3 px-4 font-mono font-bold">
                                {delta > 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-black">
                                    +{delta}
                                  </span>
                                ) : delta < 0 ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-black">
                                    {delta}
                                  </span>
                                ) : (
                                  <span className="text-slate-400 text-xs">0 (Unchanged)</span>
                                )}
                              </td>

                              {/* Percentage Shift */}
                              <td className="py-3 px-4 font-mono text-xs">
                                <span className="text-slate-500">{prePct}%</span>
                                <span className="text-slate-400 mx-1">→</span>
                                <span className="font-bold text-slate-900 dark:text-white">{postPct}%</span>
                              </td>

                              {/* Result Transition */}
                              <td className="py-3 px-4">
                                {prePassStatus !== postPassStatus ? (
                                  <div className="flex items-center space-x-1.5">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                      prePassStatus ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                    }`}>
                                      {prePassStatus ? 'PASS' : 'FAIL'}
                                    </span>
                                    <ArrowRight className="w-3 h-3 text-indigo-500" />
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black border ${
                                      postPassStatus
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300'
                                        : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300'
                                    }`}>
                                      {postPassStatus ? 'PASS' : 'FAIL'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                    postPassStatus
                                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                      : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                                  }`}>
                                    {postPassStatus ? 'PASS' : 'FAIL'}
                                  </span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center space-x-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setCandidateAuditSub(sub)}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold transition-colors cursor-pointer"
                                  >
                                    <GitCompare className="w-3 h-3" />
                                    <span>Audit Sheet</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => setViewScorecardSub(sub)}
                                    className="inline-flex items-center space-x-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Scorecard</span>
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
            ) : (
              /* Standard Table for Post-Resolution or Pre-Challenge */
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-700">
                    <tr>
                      <th className="py-3 px-4">Rank</th>
                      <th className="py-3 px-4">Candidate & Emp ID</th>
                      <th className="py-3 px-4">Questions Attempted</th>
                      <th className="py-3 px-4">Marks Obtained</th>
                      <th className="py-3 px-4">Percentage</th>
                      <th className="py-3 px-4">Result Remark</th>
                      <th className="py-3 px-4">Proctoring Strikes</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                    {filteredSubmissions.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="py-12 text-center text-slate-400">
                          No candidate scorecard records match your criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredSubmissions
                        .sort((a, b) => {
                          const isPre = ledgerViewMode === 'pre_challenge';
                          const scoreA = isPre ? (a.beforeChallengeSnapshot?.totalScore ?? a.totalScore ?? 0) : (a.totalScore ?? 0);
                          const scoreB = isPre ? (b.beforeChallengeSnapshot?.totalScore ?? b.totalScore ?? 0) : (b.totalScore ?? 0);
                          return scoreB - scoreA;
                        })
                        .map((sub, idx) => {
                          const isPre = ledgerViewMode === 'pre_challenge';
                          const snap = isPre ? sub.beforeChallengeSnapshot : null;

                          const score = snap ? snap.totalScore : (sub.totalScore ?? 0);
                          const subMax = snap ? snap.totalMarks : maxMarks;
                          const subPassing = snap ? snap.passingMarks : passingMarks;
                          const isPass = snap ? snap.passed : (sub.passed ?? score >= passingMarks);
                          const pct = snap ? snap.percentage : (sub.percentage ?? (subMax > 0 ? Math.round((score / subMax) * 100) : 0));
                          const userObj = users.find((u) => u.uid === sub.participantId);
                          const empId = userObj?.employeeId || sub.participantId.slice(0, 8).toUpperCase();
                          const currentAnswers = snap ? snap.answers : (sub.answers || {});
                          const attemptedCount = Object.values(currentAnswers || {}).filter((a) => a.answer && a.answer.trim()).length;

                          return (
                            <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50">
                              <td className="py-3 px-4 font-mono font-bold text-slate-400">
                                #{idx + 1}
                              </td>
                              <td className="py-3 px-4">
                                <div className="font-bold text-slate-900 dark:text-white">
                                  {sub.participantName}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center space-x-1.5 font-mono">
                                  <span className="bg-slate-100 dark:bg-slate-700 px-1 rounded">ID: {empId}</span>
                                  <span>•</span>
                                  <span>{sub.participantEmail}</span>
                                </div>
                              </td>
                              <td className="py-3 px-4 text-slate-600 dark:text-slate-300">
                                {attemptedCount} / {questions.length || selectedExam.questionsCount}
                              </td>
                              <td className="py-3 px-4">
                                <span className="font-mono text-sm font-black text-slate-900 dark:text-white">
                                  {score}
                                </span>
                                <span className="text-[11px] text-slate-400"> / {subMax}</span>
                                {snap && (
                                  <span className="ml-1 text-[9px] px-1 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold">
                                    Baseline
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 font-mono font-bold">
                                {pct}%
                              </td>
                              <td className="py-3 px-4">
                                {isPass ? (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    <span>PASS</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-800">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    <span>FAIL</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4">
                                {sub.tabSwitchCount > 0 ? (
                                  <span className="text-rose-600 font-bold flex items-center space-x-1">
                                    <AlertTriangle className="w-3.5 h-3.5" />
                                    <span>{sub.tabSwitchCount} strike{sub.tabSwitchCount > 1 ? 's' : ''}</span>
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 text-[11px] font-semibold">0 Clean</span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-flex items-center space-x-1.5">
                                  {sub.beforeChallengeSnapshot && (
                                    <button
                                      type="button"
                                      onClick={() => setCandidateAuditSub(sub)}
                                      className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/50 hover:bg-amber-100 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-bold transition-colors cursor-pointer"
                                      title="View side-by-side Before vs After Resolution audit sheet"
                                    >
                                      <GitCompare className="w-3 h-3" />
                                      <span>Audit</span>
                                    </button>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => setViewScorecardSub(sub)}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold transition-colors cursor-pointer"
                                  >
                                    <Eye className="w-3 h-3" />
                                    <span>Scorecard</span>
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
            )}
          </div>
        </>
      )}

      {/* Skip Debatable Question Approval Modal */}
      {skipModalQuestion && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full p-6 space-y-4 border border-amber-300 dark:border-amber-800 shadow-2xl">
            <div className="flex items-center space-x-3">
              <span className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <AlertTriangle className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Approve Debatable Question Skip & Re-score
                </h3>
                <p className="text-xs text-slate-500">
                  Total marks decreased & passing marks decreased proportionately
                </p>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
              <div className="font-bold text-amber-950 dark:text-amber-200">
                {skipModalQuestion.title}
              </div>
              <div className="text-slate-500 text-[11px]">
                Type: {skipModalQuestion.type.toUpperCase()} • Weight: {skipModalQuestion.marks} Marks
              </div>
            </div>

            <div className="space-y-1.5 text-xs">
              <label className="font-bold text-slate-700 dark:text-slate-300">
                Administrative / Evaluator Reason for Skip:
              </label>
              <textarea
                rows={3}
                value={skipReason}
                onChange={(e) => setSkipReason(e.target.value)}
                className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-xs"
                placeholder="State the justification for voiding/skipping this question..."
              />
            </div>

            <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 space-y-1 leading-relaxed">
              <div className="font-bold">Mandatory Institutional Rule:</div>
              <div>• Total marks of exam will decrease from {maxMarks} to {Math.max(1, maxMarks - skipModalQuestion.marks)} marks.</div>
              <div>• Passing marks will decrease proportionately from {passingMarks} to {Math.max(1, Math.round(((selectedExam?.originalPassingMarks || passingMarks) / (selectedExam?.originalTotalMarks || maxMarks)) * Math.max(1, maxMarks - skipModalQuestion.marks)))} marks.</div>
              <div>• The question will be dropped from candidate evaluation, and pre-challenge baseline scorecards/answer sheets will be saved for Administrator audit.</div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSkipModalQuestion(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={submittingSkip}
                onClick={handleApproveQuestionSkip}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-900/30 transition-all cursor-pointer"
              >
                {submittingSkip ? 'Re-scoring All Submissions...' : 'Approve & Re-score All Candidates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Candidate Resolution Audit & Answer Sheet Comparison Modal */}
      {candidateAuditSub && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-4xl w-full p-6 sm:p-8 space-y-6 border border-slate-200 dark:border-slate-800 shadow-2xl my-8">
            {/* Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center space-x-2 text-indigo-600 dark:text-indigo-400 font-bold">
                  <GitCompare className="w-5 h-5" />
                  <span className="text-base">Candidate Resolution Audit & Answer Sheet Comparison</span>
                </div>
                <div className="text-xs text-slate-500">
                  Institutional comparative audit of candidate marks, criteria, and answers before vs after challenge resolution.
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCandidateAuditSub(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Candidate Identity Meta */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Candidate Name</span>
                <span className="font-bold text-sm text-slate-900 dark:text-white">{candidateAuditSub.participantName}</span>
                <div className="text-[11px] text-slate-500">{candidateAuditSub.participantEmail}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Examination</span>
                <span className="font-bold text-slate-900 dark:text-white">{selectedExam?.title}</span>
                <div className="text-[11px] text-slate-500">{selectedExam?.subject}</div>
              </div>
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Submission ID & Time</span>
                <span className="font-mono text-slate-700 dark:text-slate-300">SUB-{candidateAuditSub.id.slice(0, 8).toUpperCase()}</span>
                <div className="text-[11px] text-slate-500">
                  {candidateAuditSub.submittedAt ? new Date(candidateAuditSub.submittedAt).toLocaleString() : 'N/A'}
                </div>
              </div>
            </div>

            {/* Pre vs Post Comparison Metric Cards */}
            {(() => {
              const snap = candidateAuditSub.beforeChallengeSnapshot;
              const preScore = snap ? snap.totalScore : (candidateAuditSub.totalScore ?? 0);
              const preMax = snap ? snap.totalMarks : (selectedExam?.originalTotalMarks || maxMarks);
              const prePass = snap ? snap.passingMarks : (selectedExam?.originalPassingMarks || passingMarks);
              const prePct = snap ? snap.percentage : (preMax > 0 ? Math.round((preScore / preMax) * 100) : 0);
              const preResult = snap ? (snap.passed ? 'PASS' : 'FAIL') : (preScore >= prePass ? 'PASS' : 'FAIL');

              const postScore = candidateAuditSub.totalScore ?? 0;
              const postMax = maxMarks;
              const postPass = passingMarks;
              const postPct = candidateAuditSub.percentage ?? (postMax > 0 ? Math.round((postScore / postMax) * 100) : 0);
              const postResult = candidateAuditSub.passed ?? (postScore >= postPass) ? 'PASS' : 'FAIL';

              const delta = postScore - preScore;

              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Pre-Challenge Baseline */}
                  <div className="p-4 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-amber-800 dark:text-amber-300">
                        1. Pre-Challenge Baseline
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        preResult === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {preResult}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-amber-950 dark:text-amber-100">
                      {preScore} <span className="text-xs font-normal opacity-70">/ {preMax} Marks</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      Percentage: <strong>{prePct}%</strong> • Passing Requirement: <strong>{prePass} Marks</strong>
                    </div>
                  </div>

                  {/* Post-Resolution Outcome */}
                  <div className="p-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold uppercase tracking-wider text-[10px] text-indigo-800 dark:text-indigo-300">
                        2. Post-Resolution Outcome
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black ${
                        postResult === 'PASS' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {postResult}
                      </span>
                    </div>
                    <div className="text-2xl font-black text-indigo-950 dark:text-indigo-100">
                      {postScore} <span className="text-xs font-normal opacity-70">/ {postMax} Marks</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      Percentage: <strong>{postPct}%</strong> • Passing Requirement: <strong>{postPass} Marks</strong>
                    </div>
                  </div>

                  {/* Resolution Impact */}
                  <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
                    <span className="font-bold uppercase tracking-wider text-[10px] text-slate-500">
                      3. Net Resolution Impact
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className={`text-2xl font-black ${
                        delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-rose-600' : 'text-slate-500'
                      }`}>
                        {delta > 0 ? `+${delta}` : delta} Marks
                      </span>
                      <span className="text-[11px] text-slate-500">Net Delta</span>
                    </div>
                    <div className="text-slate-600 dark:text-slate-400">
                      Result: <strong>{preResult} → {postResult}</strong> • Skipped Questions: <strong>{skippedQuestionsCount}</strong>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* Itemized Question-by-Question Comparative Answer Sheet */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Question-by-Question Answer Sheet & Marks Comparison
                </h4>
                <span className="text-[11px] text-slate-400">
                  Examine candidate responses, attempt status, and evaluation changes
                </span>
              </div>

              <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-semibold border-b border-slate-200 dark:border-slate-800">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Question & Weight</th>
                      <th className="py-2.5 px-3">Candidate Response & Status</th>
                      <th className="py-2.5 px-3">Pre-Challenge Marks</th>
                      <th className="py-2.5 px-3">Post-Resolution Marks</th>
                      <th className="py-2.5 px-3">Status / Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-850">
                    {questions.map((q, idx) => {
                      const snap = candidateAuditSub.beforeChallengeSnapshot;
                      const preAns = snap?.answers?.[q.id];
                      const postAns = candidateAuditSub.answers?.[q.id];

                      const preScore = preAns?.marksObtained ?? 0;
                      const postScore = postAns?.marksObtained ?? 0;
                      const deltaQ = postScore - preScore;

                      const studentAnswerText = postAns?.answer || preAns?.answer || '(No response)';
                      const isAttempted = Boolean(
                        studentAnswerText &&
                        studentAnswerText !== '(Unattempted)' &&
                        studentAnswerText !== '(No response)' &&
                        studentAnswerText !== '(None)'
                      );

                      const isSkipped = postAns?.isSkipped || selectedExam?.skippedQuestionIds?.includes(q.id);

                      return (
                        <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-3 px-3 font-mono font-bold text-slate-400">
                            Q{idx + 1}
                          </td>
                          <td className="py-3 px-3 max-w-xs">
                            <div className="font-bold text-slate-900 dark:text-white line-clamp-1">
                              {q.title}
                            </div>
                            <div className="text-[10px] text-slate-400 font-mono">
                              {q.marks} Marks • {q.type.toUpperCase()}
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="font-mono text-slate-900 dark:text-slate-100">
                              "{studentAnswerText}"
                            </div>
                            <div>
                              {isAttempted ? (
                                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold">
                                  ✓ Attempted
                                </span>
                              ) : (
                                <span className="text-[10px] text-slate-400 font-semibold">
                                  — Unattempted
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 font-mono">
                            <span className="font-bold">{preScore}</span> / {q.marks}
                            {preAns?.evaluatorFeedback && (
                              <div className="text-[10px] text-slate-400 line-clamp-1">
                                {preAns.evaluatorFeedback}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono">
                            <span className="font-bold text-indigo-600 dark:text-indigo-400">{postScore}</span> / {q.marks}
                            {deltaQ !== 0 && (
                              <span className={`ml-1 text-[10px] font-black ${
                                deltaQ > 0 ? 'text-emerald-600' : 'text-rose-600'
                              }`}>
                                ({deltaQ > 0 ? `+${deltaQ}` : deltaQ})
                              </span>
                            )}
                            {postAns?.evaluatorFeedback && (
                              <div className="text-[10px] text-slate-400 line-clamp-1">
                                {postAns.evaluatorFeedback}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {isSkipped ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-300">
                                Debatable / Dropped
                              </span>
                            ) : postAns?.challengeStatus ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                                {postAns.challengeStatus.replace(/_/g, ' ')}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Normal Evaluation</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
              <span className="text-slate-500">
                Institutional examination audit trail archived in compliance with evaluation guidelines.
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setCandidateAuditSub(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Close Audit Sheet
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setViewScorecardSub(candidateAuditSub);
                    setCandidateAuditSub(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                >
                  View Official Scorecard
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Official Scorecard Modal */}
      {viewScorecardSub && (
        <OfficialScorecardModal
          isOpen={true}
          submission={viewScorecardSub}
          exam={selectedExam}
          onClose={() => setViewScorecardSub(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  );
};
