import React, { useState } from 'react';
import { UserProfile, Exam } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  Sparkles,
  BookOpen,
  Users,
  CheckSquare,
  GraduationCap,
  Clock,
  ShieldCheck,
  X,
  Plus,
  Search,
  Check
} from 'lucide-react';

interface GenerateExamModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newExam: Exam) => void;
  users: UserProfile[];
}

export const GenerateExamModal: React.FC<GenerateExamModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  users,
}) => {
  const paperSetters = users.filter((u) => u.role === 'paper_setter');
  const evaluators = users.filter((u) => u.role === 'evaluator');
  const participants = users.filter((u) => u.role === 'participant');

  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('Computer Science & Engineering');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [totalMarks, setTotalMarks] = useState(50);
  const [passingMarks, setPassingMarks] = useState(25);
  const [instructions, setInstructions] = useState(
    '1. Attempt all questions within the allocated duration.\n2. Do not switch tabs or minimize window during proctored assessment.\n3. Upon completion, response receipt slip will be generated for verification.'
  );
  const [proctoringEnabled, setProctoringEnabled] = useState(true);

  // Role Allocation State
  const [selectedSetterId, setSelectedSetterId] = useState(
    paperSetters.length > 0 ? paperSetters[0].uid : ''
  );
  const [selectedEvaluatorId, setSelectedEvaluatorId] = useState(
    evaluators.length > 0 ? evaluators[0].uid : ''
  );
  const [selectedParticipantIds, setSelectedParticipantIds] = useState<string[]>(
    participants.map((p) => p.uid) // Default all enrolled participants
  );
  const [candidateSearch, setCandidateSearch] = useState('');

  if (!isOpen) return null;

  const handleToggleParticipant = (uid: string) => {
    setSelectedParticipantIds((prev) =>
      prev.includes(uid) ? prev.filter((id) => id !== uid) : [...prev, uid]
    );
  };

  const handleSelectAllParticipants = () => {
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

    if (!title.trim()) {
      setError('Please provide an exam title.');
      setStep(1);
      return;
    }

    if (!selectedSetterId) {
      setError('Please designate an Exam Paper Setter.');
      setStep(2);
      return;
    }

    const setterObj = paperSetters.find((s) => s.uid === selectedSetterId);
    const evaluatorObj = evaluators.find((e) => e.uid === selectedEvaluatorId);

    try {
      setSubmitting(true);
      const newExamId = 'exam_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6);

      const newExam: Exam = {
        id: newExamId,
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim(),
        setterId: selectedSetterId,
        setterName: setterObj?.displayName || 'Designated Paper Setter',
        evaluatorId: selectedEvaluatorId || undefined,
        evaluatorName: evaluatorObj?.displayName || undefined,
        assignedParticipantIds: selectedParticipantIds,
        status: 'draft',
        durationMinutes: Number(durationMinutes),
        totalMarks: Number(totalMarks),
        passingMarks: Number(passingMarks),
        questionsCount: 0,
        instructions: instructions.trim(),
        proctoringEnabled,
        scheduleStatus: 'unscheduled',
        createdAt: new Date().toISOString(),
      };

      await examService.createExam(newExam);
      onSuccess(newExam);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to generate exam. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700/80 bg-slate-50/60 dark:bg-slate-750/60">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Generate New Examination & Assign Roles
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Administrator Exam Control Center • Step {step} of 2
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

        {/* Step Tabs */}
        <div className="flex border-b border-slate-100 dark:border-slate-700 bg-slate-50/30 dark:bg-slate-800 text-xs">
          <button
            type="button"
            onClick={() => setStep(1)}
            className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-colors ${
              step === 1
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            1. Exam Details & Structure
          </button>
          <button
            type="button"
            onClick={() => {
              if (title.trim()) setStep(2);
            }}
            className={`flex-1 py-2.5 text-center font-bold border-b-2 transition-colors ${
              step === 2
                ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            2. Assign Paper Setter, Evaluator & Candidates
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4 animate-in fade-in">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Exam Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. End-Term Computer Networks & Security 2026"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Subject / Domain
                  </label>
                  <input
                    type="text"
                    required
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Minutes)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="5"
                      max="360"
                      value={durationMinutes}
                      onChange={(e) => setDurationMinutes(Number(e.target.value))}
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                    />
                    <Clock className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Target Total Marks
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={totalMarks}
                    onChange={(e) => setTotalMarks(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Passing Marks
                  </label>
                  <input
                    type="number"
                    min="0"
                    max={totalMarks}
                    value={passingMarks}
                    onChange={(e) => setPassingMarks(Number(e.target.value))}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Syllabus
                </label>
                <textarea
                  rows={2}
                  placeholder="Overview of syllabus, modules, and prerequisites..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="proctorToggle"
                  checked={proctoringEnabled}
                  onChange={(e) => setProctoringEnabled(e.target.checked)}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                />
                <label htmlFor="proctorToggle" className="text-xs font-medium text-slate-700 dark:text-slate-300">
                  Enable Proctored Integrity Monitoring (Detect tab switching & focus loss)
                </label>
              </div>

              <div className="flex justify-end pt-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!title.trim()) {
                      setError('Please enter an exam title.');
                      return;
                    }
                    setError(null);
                    setStep(2);
                  }}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-md shadow-indigo-900/30"
                >
                  Continue to Role Allocation →
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4 animate-in fade-in">
              {/* Paper Setter Selector */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-indigo-700 dark:text-indigo-300">
                    <BookOpen className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Designate Exam Paper Setter *
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">Responsible for authoring questions & live date/time</span>
                </div>

                <select
                  required
                  value={selectedSetterId}
                  onChange={(e) => setSelectedSetterId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-indigo-200 dark:border-indigo-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  {paperSetters.length === 0 ? (
                    <option value="">No Paper Setters registered yet</option>
                  ) : (
                    paperSetters.map((ps) => (
                      <option key={ps.uid} value={ps.uid}>
                        {ps.displayName} ({ps.employeeId || 'ID: ' + ps.uid.slice(0, 6)}) • {ps.department || 'General'}
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Evaluator Selector */}
              <div className="p-3.5 rounded-2xl bg-amber-50/50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-amber-700 dark:text-amber-300">
                    <CheckSquare className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Designate Exam Evaluator
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500">Responsible for grading answers & releasing marks</span>
                </div>

                <select
                  value={selectedEvaluatorId}
                  onChange={(e) => setSelectedEvaluatorId(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-amber-200 dark:border-amber-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- No Evaluator Assigned Yet (Can assign later) --</option>
                  {evaluators.map((ev) => (
                    <option key={ev.uid} value={ev.uid}>
                      {ev.displayName} ({ev.employeeId || 'ID: ' + ev.uid.slice(0, 6)}) • {ev.department || 'Grading'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Participant Candidates Picker */}
              <div className="p-3.5 rounded-2xl bg-emerald-50/50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-emerald-700 dark:text-emerald-300">
                    <GraduationCap className="w-4 h-4" />
                    <span className="text-xs font-bold uppercase tracking-wider">
                      Assign Candidate Participants ({selectedParticipantIds.length} Selected)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleSelectAllParticipants}
                    className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 hover:underline"
                  >
                    {selectedParticipantIds.length === participants.length ? 'Deselect All' : 'Select All Candidates'}
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search candidate by name or employee ID..."
                    value={candidateSearch}
                    onChange={(e) => setCandidateSearch(e.target.value)}
                    className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>

                <div className="max-h-48 overflow-y-auto divide-y divide-emerald-100 dark:divide-emerald-900/50 border border-emerald-100 dark:border-emerald-900/80 rounded-xl bg-white dark:bg-slate-850 p-1">
                  {filteredCandidates.length === 0 ? (
                    <div className="p-4 text-center text-xs text-slate-400">
                      No candidates match your search.
                    </div>
                  ) : (
                    filteredCandidates.map((cand) => {
                      const isSelected = selectedParticipantIds.includes(cand.uid);
                      return (
                        <div
                          key={cand.uid}
                          onClick={() => handleToggleParticipant(cand.uid)}
                          className={`flex items-center justify-between p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                            isSelected
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <div className="flex items-center space-x-2.5">
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
                              <div className="font-bold">{cand.displayName}</div>
                              <div className="text-[10px] text-slate-500">
                                {cand.employeeId ? `Emp ID: ${cand.employeeId} • ` : ''}
                                {cand.email}
                              </div>
                            </div>
                          </div>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {cand.department || 'Enrolled'}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between pt-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100"
                >
                  ← Back to Details
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-900/30 transition-all disabled:opacity-50"
                >
                  {submitting ? 'Generating Exam...' : 'Generate Exam & Confirm Allocations'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
