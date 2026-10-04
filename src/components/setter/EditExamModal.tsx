import React, { useState, useEffect } from 'react';
import { Exam } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  X,
  Edit3,
  Clock,
  BookOpen,
  Award,
  Layers,
  FileText,
  ShieldCheck,
  Save,
  AlertCircle,
  Lock
} from 'lucide-react';

interface EditExamModalProps {
  isOpen: boolean;
  exam: Exam | null;
  onClose: () => void;
  onSuccess: (updatedExam: Exam) => void;
}

export const EditExamModal: React.FC<EditExamModalProps> = ({
  isOpen,
  exam,
  onClose,
  onSuccess,
}) => {
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [totalMarks, setTotalMarks] = useState(50);
  const [passingMarks, setPassingMarks] = useState(25);
  const [maxQuestionsToAttempt, setMaxQuestionsToAttempt] = useState<string>('');
  const [instructions, setInstructions] = useState('');
  const [proctoringEnabled, setProctoringEnabled] = useState(true);
  const [negativeMarkingEnabled, setNegativeMarkingEnabled] = useState(false);
  const [negativeMarksPerQuestion, setNegativeMarksPerQuestion] = useState('0.25');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (exam) {
      setTitle(exam.title || '');
      setSubject(exam.subject || '');
      setDescription(exam.description || '');
      setDurationMinutes(exam.durationMinutes || 45);
      setTotalMarks(exam.totalMarks || 50);
      setPassingMarks(exam.passingMarks || 25);
      setNegativeMarkingEnabled(Boolean(exam.negativeMarkingEnabled));
      setNegativeMarksPerQuestion(
        exam.negativeMarksPerQuestion !== undefined && exam.negativeMarksPerQuestion !== null
          ? String(exam.negativeMarksPerQuestion)
          : '0.25'
      );
      setMaxQuestionsToAttempt(
        exam.maxQuestionsToAttempt !== undefined && exam.maxQuestionsToAttempt !== null
          ? String(exam.maxQuestionsToAttempt)
          : ''
      );
      setInstructions(
        exam.instructions ||
          '1. Attempt all questions.\n2. Do not switch tabs during examination.\n3. Verify all answers before final submission.'
      );
      setProctoringEnabled(exam.proctoringEnabled ?? true);
      setError(null);
    }
  }, [exam, isOpen]);

  if (!isOpen || !exam) return null;

  const isAuthorized = exam.scheduleStatus === 'schedule_authorized';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isAuthorized) {
      setError('Action Denied: This examination paper has been finally authorised by the Administrator and is locked against alterations.');
      return;
    }
    if (!title.trim()) {
      setError('Examination title cannot be empty.');
      return;
    }
    if (!subject.trim()) {
      setError('Subject / Syllabus cannot be empty.');
      return;
    }
    if (durationMinutes <= 0) {
      setError('Duration must be greater than 0 minutes.');
      return;
    }
    if (totalMarks <= 0) {
      setError('Total marks must be greater than 0.');
      return;
    }
    if (passingMarks <= 0 || passingMarks > totalMarks) {
      setError(`Passing marks must be between 1 and ${totalMarks}.`);
      return;
    }

    const maxAttemptVal = maxQuestionsToAttempt.trim() ? Number(maxQuestionsToAttempt) : null;
    if (maxAttemptVal !== null && (isNaN(maxAttemptVal) || maxAttemptVal <= 0)) {
      setError('Maximum questions to attempt must be a valid positive number.');
      return;
    }

    let parsedNegMarks: number | undefined = undefined;
    if (negativeMarkingEnabled) {
      const val = Number(negativeMarksPerQuestion);
      if (isNaN(val) || val <= 0) {
        setError('Please specify a valid positive deduction amount for negative marking (e.g. 0.25, 0.33, 0.5, 1).');
        return;
      }
      if (val > totalMarks) {
        setError(`Negative mark deduction (${val}) cannot exceed total marks (${totalMarks}).`);
        return;
      }
      parsedNegMarks = val;
    }

    try {
      setSubmitting(true);
      setError(null);

      const updates: Partial<Exam> = {
        title: title.trim(),
        subject: subject.trim(),
        description: description.trim(),
        durationMinutes: Number(durationMinutes),
        totalMarks: Number(totalMarks),
        passingMarks: Number(passingMarks),
        maxQuestionsToAttempt: maxAttemptVal ?? undefined,
        instructions: instructions.trim(),
        proctoringEnabled,
        negativeMarkingEnabled,
        negativeMarksPerQuestion: negativeMarkingEnabled ? parsedNegMarks : undefined,
        updatedAt: new Date().toISOString(),
      };

      await examService.updateExam(exam.id, updates);

      const updatedExam: Exam = {
        ...exam,
        ...updates,
      };

      onSuccess(updatedExam);
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Failed to update examination details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-900 rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-200 dark:border-slate-800 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-800 bg-indigo-50/50 dark:bg-indigo-950/20">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
              <Edit3 className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>Edit Examination Paper Details</span>
                {isAuthorized && (
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                    ✓ Authorised & Locked
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isAuthorized
                  ? 'This examination paper has been officially authorised by the Administrator. Settings are permanently locked.'
                  : 'Modify examination title, duration, syllabus, benchmark scores, and instructions'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isAuthorized && (
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-900 dark:text-emerald-200 text-xs flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Administrator Final Authorization Completed:</strong> Question paper parameters, time, syllabus, and marks are sealed and cannot be altered.
              </span>
            </div>
          )}

          {error && (
            <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Exam Title */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Examination Title / Name *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Mid-Term Examination 2026"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Subject / Syllabus */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Subject / Syllabus *
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="e.g. Computer Science & Data Structures"
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>Exam Time / Duration (Minutes) *</span>
              </label>
              <input
                type="number"
                min="5"
                max="600"
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Total Marks */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1">
                <Award className="w-3.5 h-3.5 text-slate-400" />
                <span>Total Marks *</span>
              </label>
              <input
                type="number"
                min="1"
                max="1000"
                value={totalMarks}
                onChange={(e) => setTotalMarks(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Passing Marks */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Passing Marks *
              </label>
              <input
                type="number"
                min="1"
                max={totalMarks}
                value={passingMarks}
                onChange={(e) => setPassingMarks(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Negative Marking Configuration */}
            <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    Negative Marking *
                  </label>
                  <select
                    value={negativeMarkingEnabled ? 'yes' : 'no'}
                    onChange={(e) => setNegativeMarkingEnabled(e.target.value === 'yes')}
                    disabled={isAuthorized}
                    className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-750 text-slate-900 dark:text-white font-semibold focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                  >
                    <option value="no">No (No marks deducted for wrong answers)</option>
                    <option value="yes">Yes (Deduct marks for wrong answers)</option>
                  </select>
                </div>

                {negativeMarkingEnabled ? (
                  <div className="animate-in fade-in">
                    <label className="block text-xs font-bold text-rose-700 dark:text-rose-300 mb-1">
                      Negative Marks Deducted per Wrong Answer *
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        min="0.01"
                        max={totalMarks}
                        required
                        disabled={isAuthorized}
                        placeholder="e.g. 0.25, 0.33, 0.5, 1"
                        value={negativeMarksPerQuestion}
                        onChange={(e) => setNegativeMarksPerQuestion(e.target.value)}
                        className="w-full pl-3.5 pr-24 py-2.5 text-xs rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-slate-750 text-slate-900 dark:text-white font-bold focus:ring-2 focus:ring-rose-500 disabled:opacity-60"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-bold text-rose-600 dark:text-rose-400 pointer-events-none">
                        marks / wrong
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center text-[11px] text-slate-500 pt-5">
                    Standard grading: Incorrect answers award 0 marks without negative deduction.
                  </div>
                )}
              </div>

              {negativeMarkingEnabled && (
                <p className="text-[11px] text-rose-600 dark:text-rose-400">
                  ⚠️ Negative marking rule: For every incorrect objective answer, <strong>{negativeMarksPerQuestion || '0'}</strong> mark will be deducted. Unattempted questions incur 0 deduction.
                </p>
              )}
            </div>

            {/* Maximum Questions to Attempt */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Max Questions to Attempt (Optional)
              </label>
              <input
                type="number"
                min="1"
                placeholder="Leave blank to attempt all"
                value={maxQuestionsToAttempt}
                onChange={(e) => setMaxQuestionsToAttempt(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-[10px] text-slate-400">e.g. attempt 100 out of 110</span>
            </div>

            {/* Proctoring Toggle */}
            <div className="flex items-center space-x-2.5 pt-4">
              <input
                type="checkbox"
                id="proctoringEnabled"
                checked={proctoringEnabled}
                onChange={(e) => setProctoringEnabled(e.target.checked)}
                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <label htmlFor="proctoringEnabled" className="text-xs font-bold text-slate-700 dark:text-slate-300 cursor-pointer">
                Enable Full-Screen Tab-Switch Proctoring
              </label>
            </div>

            {/* Detailed Description / Syllabus Topics */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Syllabus Topics & Paper Overview
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g. Unit 1: Data Structures, Unit 2: Algorithms, Unit 3: System Design..."
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Instructions */}
            <div className="sm:col-span-2 space-y-1">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Examination Instructions
              </label>
              <textarea
                rows={3}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {isAuthorized ? 'Close' : 'Cancel'}
            </button>
            {isAuthorized ? (
              <span
                className="px-5 py-2 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 flex items-center space-x-1.5 cursor-not-allowed"
                title="Paper parameters cannot be altered after Administrator final authorization"
              >
                <Lock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Paper Locked (Authorised)</span>
              </span>
            ) : (
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{submitting ? 'Saving Changes...' : 'Save Exam Details'}</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
