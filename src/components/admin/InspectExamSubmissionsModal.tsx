import React, { useState } from 'react';
import { Exam, Submission, Question } from '../../types/exam';
import {
  FileText,
  Lock,
  X,
  CheckCircle,
  Clock,
  Printer,
  ShieldAlert,
  AlertTriangle,
  Search
} from 'lucide-react';
import { ExamAttemptSlipModal } from '../participant/ExamAttemptSlipModal';

interface InspectExamSubmissionsModalProps {
  isOpen: boolean;
  exam: Exam | null;
  submissions: Submission[];
  onClose: () => void;
}

export const InspectExamSubmissionsModal: React.FC<InspectExamSubmissionsModalProps> = ({
  isOpen,
  exam,
  submissions,
  onClose,
}) => {
  const [selectedSubForSlip, setSelectedSubForSlip] = useState<Submission | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen || !exam) return null;

  const examSubmissions = submissions.filter((s) => s.examId === exam.id);
  const filtered = examSubmissions.filter(
    (s) =>
      s.participantName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.participantEmail.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
        <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 my-8 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-750/50">
            <div className="flex items-center space-x-2.5">
              <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <FileText className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Candidate Submissions & Attempt Records
                  </h3>
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                    <Lock className="w-3 h-3" />
                    <span>Admin View-Only</span>
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-sm">
                  {exam.title} • Assigned Evaluator: {exam.evaluatorName || 'Not Assigned'}
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

          {/* View-Only Policy Notice Banner */}
          <div className="p-4 mx-6 mt-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center space-x-3 text-xs text-amber-900 dark:text-amber-200">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Institutional Governance:</strong> The Administrator has view-only access to submissions. Marking and evaluation is reserved exclusively for the designated Evaluator ({exam.evaluatorName || 'Board Evaluator'}).
            </span>
          </div>

          {/* Search bar */}
          <div className="p-6 pb-2">
            <div className="relative">
              <input
                type="text"
                placeholder="Search candidate by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>

          {/* Submissions List */}
          <div className="p-6 pt-2 max-h-[55vh] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="py-12 text-center text-slate-400 text-xs">
                No candidate submissions found for this exam.
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/60 border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-750 text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-3 px-4 font-semibold">Candidate</th>
                      <th className="py-3 px-4 font-semibold">Submission Status</th>
                      <th className="py-3 px-4 font-semibold">Proctoring Flags</th>
                      <th className="py-3 px-4 font-semibold">Score (Staff Only)</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60 bg-white dark:bg-slate-800">
                    {filtered.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50 dark:hover:bg-slate-750/50">
                        <td className="py-3 px-4">
                          <div className="font-semibold text-slate-900 dark:text-white">
                            {sub.participantName}
                          </div>
                          <div className="text-[11px] text-slate-400">{sub.participantEmail}</div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              sub.status === 'evaluated'
                                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                                : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                            }`}
                          >
                            {sub.status === 'evaluated' ? 'Evaluated & Graded' : 'Pending Evaluation'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          {sub.tabSwitchCount > 0 ? (
                            <span className="inline-flex items-center space-x-1 text-rose-600 font-semibold">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>{sub.tabSwitchCount} tab switch(es)</span>
                            </span>
                          ) : (
                            <span className="text-emerald-600 flex items-center space-x-1">
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Clean Session</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-700 dark:text-slate-300">
                          {sub.totalScore !== undefined
                            ? `${sub.totalScore} / ${sub.maxScore || exam.totalMarks} pts`
                            : '—'}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedSubForSlip(sub)}
                            className="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                          >
                            View Attempt Slip
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-750/50">
            <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Evaluation & mark modification restricted to Evaluator</span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              Close
            </button>
          </div>
        </div>
      </div>

      {selectedSubForSlip && (
        <ExamAttemptSlipModal
          submission={selectedSubForSlip}
          exam={exam}
          questions={[]}
          onClose={() => setSelectedSubForSlip(null)}
        />
      )}
    </>
  );
};
