import React, { useState } from 'react';
import { Exam, UserProfile } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  Users,
  BookOpen,
  CheckSquare,
  GraduationCap,
  Search,
  Check,
  X,
  Save
} from 'lucide-react';

interface ManageExamAssignmentsModalProps {
  isOpen: boolean;
  exam: Exam | null;
  onClose: () => void;
  onSuccess: () => void;
  users: UserProfile[];
}

export const ManageExamAssignmentsModal: React.FC<ManageExamAssignmentsModalProps> = ({
  isOpen,
  exam,
  onClose,
  onSuccess,
  users,
}) => {
  if (!isOpen || !exam) return null;

  const paperSetters = users.filter((u) => u.role === 'paper_setter');
  const evaluators = users.filter((u) => u.role === 'evaluator');
  const participants = users.filter((u) => u.role === 'participant');

  const [selectedSetterId, setSelectedSetterId] = useState(exam.setterId || '');
  const [selectedEvaluatorId, setSelectedEvaluatorId] = useState(exam.evaluatorId || '');
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(
    exam.assignedParticipantIds || participants.map((p) => p.uid)
  );
  const [candidateSearch, setCandidateSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggleParticipant = (uid: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectAll = () => {
    if (selectedParticipantIds.length === participants.length) {
      setSelectedParticipantIds([]);
    } else {
      setSelectedParticipantIds(participants.map((p) => p.uid));
    }
  };

  const filteredCandidates = participants.filter(
    (p) =>
      p.displayName.toLowerCase().includes(candidateSearch.toLowerCase()) ||
      p.email.toLowerCase().includes(candidateSearch.toLowerCase()) ||
      (p.employeeId && p.employeeId.toLowerCase().includes(candidateSearch.toLowerCase()))
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const setterObj = paperSetters.find((s) => s.uid === selectedSetterId);
    const evaluatorObj = evaluators.find((e) => e.uid === selectedEvaluatorId);

    if (!selectedSetterId) {
      setError('Please assign a Paper Setter.');
      return;
    }

    try {
      setSubmitting(true);
      await examService.updateExamAssignments(exam.id, {
        setterId: selectedSetterId,
        setterName: setterObj?.displayName || exam.setterName,
        evaluatorId: selectedEvaluatorId || undefined,
        evaluatorName: evaluatorObj?.displayName || undefined,
        assignedParticipantIds: selectedParticipantIds,
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to update assignments.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-750/50">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Users className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Manage Role Allocations for Exam
              </h3>
              <p className="text-xs text-slate-500 truncate max-w-sm">{exam.title}</p>
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {/* Paper Setter */}
          <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-1.5">
            <div className="flex items-center space-x-2 text-indigo-700 dark:text-indigo-300">
              <BookOpen className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Assigned Paper Setter
              </span>
            </div>
            <select
              value={selectedSetterId}
              onChange={(e) => setSelectedSetterId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
            >
              {paperSetters.map((ps) => (
                <option key={ps.uid} value={ps.uid}>
                  {ps.displayName} ({ps.employeeId || 'ID: ' + ps.uid.slice(0, 6)}) • {ps.department || 'General'}
                </option>
              ))}
            </select>
          </div>

          {/* Evaluator */}
          <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-1.5">
            <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-300">
              <CheckSquare className="w-4 h-4" />
              <span className="text-xs font-bold uppercase tracking-wider">
                Assigned Evaluator
              </span>
            </div>
            <select
              value={selectedEvaluatorId}
              onChange={(e) => setSelectedEvaluatorId(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-amber-200 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500"
            >
              <option value="">-- No Evaluator Assigned Yet --</option>
              {evaluators.map((ev) => (
                <option key={ev.uid} value={ev.uid}>
                  {ev.displayName} ({ev.employeeId || 'ID: ' + ev.uid.slice(0, 6)}) • {ev.department || 'Grading'}
                </option>
              ))}
            </select>
          </div>

          {/* Assigned Candidates */}
          <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300">
                <GraduationCap className="w-4 h-4" />
                <span className="text-xs font-bold uppercase tracking-wider">
                  Enrolled Candidate Access ({selectedParticipantIds.length} Assigned)
                </span>
              </div>
              <button
                type="button"
                onClick={handleSelectAll}
                className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
              >
                {selectedParticipantIds.length === participants.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Filter candidates..."
                value={candidateSearch}
                onChange={(e) => setCandidateSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
              />
            </div>

            <div className="max-h-48 overflow-y-auto divide-y divide-emerald-100 dark:divide-emerald-900/50 border border-emerald-100 dark:border-emerald-900/80 rounded-xl bg-white dark:bg-slate-850 p-1">
              {filteredCandidates.map((cand) => {
                const isSelected = selectedParticipantIds.includes(cand.uid);
                return (
                  <div
                    key={cand.uid}
                    onClick={() => handleToggleParticipant(cand.uid)}
                    className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                      isSelected
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 font-semibold'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <div
                        className={`w-4 h-4 rounded flex items-center justify-center border ${
                          isSelected
                            ? 'bg-emerald-600 border-emerald-600 text-white'
                            : 'border-slate-300 dark:border-slate-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-3" />}
                      </div>
                      <div>
                        <div>{cand.displayName}</div>
                        <div className="text-[10px] text-slate-500 font-normal">
                          {cand.employeeId ? `Emp ID: ${cand.employeeId} • ` : ''}
                          {cand.email}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-900/30 transition-all disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Save className="w-4 h-4" />
              <span>{submitting ? 'Saving...' : 'Save Role Allocations'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
