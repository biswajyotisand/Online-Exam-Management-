import React, { useState } from 'react';
import { Exam, UserProfile } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  Link2,
  GraduationCap,
  BookOpen,
  CheckCircle2,
  Clock,
  X,
  AlertCircle,
  Unlink,
  Search,
  Sparkles
} from 'lucide-react';

interface LinkCandidateToExamModalProps {
  isOpen: boolean;
  candidate: UserProfile | null;
  candidates?: UserProfile[]; // For bulk linking if multiple selected
  exams: Exam[];
  onClose: () => void;
  onSuccess: (message: string) => void;
}

export const LinkCandidateToExamModal: React.FC<LinkCandidateToExamModalProps> = ({
  isOpen,
  candidate,
  candidates,
  exams,
  onClose,
  onSuccess,
}) => {
  const isBulk = Boolean(candidates && candidates.length > 1);
  const targetCandidates = isBulk && candidates ? candidates : candidate ? [candidate] : [];

  const [selectedExamId, setSelectedExamId] = useState<string>(
    exams.length > 0 ? exams[0].id : ''
  );
  const [examSearch, setExamSearch] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen || targetCandidates.length === 0) return null;

  const currentCandidate = targetCandidates[0];
  const currentlyAssignedExam = exams.find(
    (e) => e.id === currentCandidate.assignedExamId
  );

  const filteredExams = exams.filter(
    (e) =>
      e.title.toLowerCase().includes(examSearch.toLowerCase()) ||
      e.subject.toLowerCase().includes(examSearch.toLowerCase()) ||
      e.setterName.toLowerCase().includes(examSearch.toLowerCase())
  );

  const handleLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamId) {
      setError('Please select an examination to link.');
      return;
    }

    const targetExam = exams.find((e) => e.id === selectedExamId);
    if (!targetExam) {
      setError('Selected examination not found.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      if (isBulk && candidates) {
        const uids = candidates.map((c) => c.uid);
        await examService.linkMultipleParticipantsToExam(
          uids,
          targetExam.id,
          targetExam.title
        );
        onSuccess(
          `Successfully linked ${candidates.length} candidates to "${targetExam.title}"!`
        );
      } else {
        await examService.linkParticipantToExam(
          currentCandidate.uid,
          targetExam.id,
          targetExam.title
        );
        onSuccess(
          `Candidate "${currentCandidate.displayName}" (${currentCandidate.employeeId || 'ID'}) successfully linked to "${targetExam.title}"!`
        );
      }

      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to link candidate to exam.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlink = async () => {
    if (
      !window.confirm(
        `Unlink "${currentCandidate.displayName}" from "${currentlyAssignedExam?.title || 'Exam'}" and return to the General Candidate Pool?`
      )
    ) {
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await examService.unlinkParticipantFromExam(
        currentCandidate.uid,
        currentCandidate.assignedExamId
      );
      onSuccess(
        `Candidate "${currentCandidate.displayName}" returned to General Candidate Pool.`
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to unlink candidate.');
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
              <Link2 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                {isBulk
                  ? `Link ${targetCandidates.length} Candidates to Exam`
                  : 'Link Participant to Particular Exam'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Institutional Candidate Allocation Control
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

        {/* Candidate Info Summary Box */}
        <div className="p-4 mx-6 mt-4 rounded-2xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {isBulk ? 'Selected Candidates:' : 'Candidate Information:'}
          </div>

          {isBulk ? (
            <div className="space-y-1">
              <div className="font-bold text-slate-900 dark:text-white">
                {targetCandidates.length} candidates selected from general pool
              </div>
              <div className="text-slate-500 truncate max-w-lg">
                {targetCandidates.map((c) => c.displayName).join(', ')}
              </div>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="font-bold text-slate-900 dark:text-white text-sm">
                  {currentCandidate.displayName}
                </div>
                <div className="text-slate-500">
                  Employee ID:{' '}
                  <span className="font-mono font-semibold text-indigo-600 dark:text-indigo-400">
                    {currentCandidate.employeeId || 'NO-ID'}
                  </span>{' '}
                  • {currentCandidate.email}
                </div>
              </div>

              <div>
                {currentlyAssignedExam ? (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    <BookOpen className="w-3 h-3 text-indigo-600" />
                    <span>Linked to: {currentlyAssignedExam.title}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="w-3 h-3 text-amber-600" />
                    <span>General Candidate Pool (Unassigned)</span>
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Form Body */}
        <form onSubmit={handleLink} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Select Particular Examination to Link *
              </label>
              <span className="text-[11px] text-slate-400">
                {exams.length} exam(s) available
              </span>
            </div>

            {/* Quick search if multiple exams */}
            {exams.length > 4 && (
              <div className="relative mb-2">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Filter exams by title or subject..."
                  value={examSearch}
                  onChange={(e) => setExamSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white"
                />
              </div>
            )}

            {exams.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
                No examinations found. Please generate an examination first in the Exam Command Center.
              </div>
            ) : (
              <div className="max-h-60 overflow-y-auto space-y-2 border border-slate-200 dark:border-slate-700 rounded-2xl p-2 bg-slate-50/50 dark:bg-slate-750/30">
                {filteredExams.map((ex) => {
                  const isSelected = selectedExamId === ex.id;
                  const isCurrent = currentCandidate.assignedExamId === ex.id;

                  return (
                    <div
                      key={ex.id}
                      onClick={() => setSelectedExamId(ex.id)}
                      className={`p-3 rounded-xl border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/80 border-indigo-500/80 dark:bg-indigo-950/40 dark:border-indigo-600 shadow-xs'
                          : 'bg-white dark:bg-slate-800 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-50 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-slate-900 dark:text-white">
                              {ex.title}
                            </span>
                            {isCurrent && (
                              <span className="text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                                Current
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {ex.subject} • {ex.durationMinutes}m • Total: {ex.totalMarks} Marks • Setter: {ex.setterName}
                          </div>
                        </div>

                        <div className="shrink-0 pt-0.5">
                          <input
                            type="radio"
                            name="targetExamRadio"
                            checked={isSelected}
                            onChange={() => setSelectedExamId(ex.id)}
                            className="rounded-full text-indigo-600 focus:ring-indigo-500"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-200/60 dark:border-indigo-900/40 text-[11px] text-indigo-900 dark:text-indigo-200 leading-relaxed">
            <span className="font-bold">Linking Effect:</span> Once linked, this candidate will be authorized to access and take this specific examination during its scheduled live window using their Employee ID & password.
          </div>

          {/* Footer Actions */}
          <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-2">
            <div>
              {!isBulk && currentlyAssignedExam && (
                <button
                  type="button"
                  onClick={handleUnlink}
                  disabled={submitting}
                  className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/40 flex items-center space-x-1"
                >
                  <Unlink className="w-3.5 h-3.5" />
                  <span>Unlink to Pool</span>
                </button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || exams.length === 0}
                className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-900/30 transition-all disabled:opacity-50 flex items-center space-x-1.5"
              >
                <Link2 className="w-3.5 h-3.5" />
                <span>{submitting ? 'Linking...' : 'Confirm Link to Exam'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
