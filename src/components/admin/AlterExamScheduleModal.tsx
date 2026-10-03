import React, { useState } from 'react';
import { Exam } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  X,
  AlertCircle,
  HelpCircle
} from 'lucide-react';

interface AlterExamScheduleModalProps {
  isOpen: boolean;
  exam: Exam | null;
  onClose: () => void;
  onSuccess: () => void;
  adminName: string;
}

export const AlterExamScheduleModal: React.FC<AlterExamScheduleModalProps> = ({
  isOpen,
  exam,
  onClose,
  onSuccess,
  adminName,
}) => {
  if (!isOpen || !exam) return null;

  // Initial values from proposed or existing schedule or current time
  const now = new Date();
  now.setMinutes(now.getMinutes() + 30);
  const defaultStart = now.toISOString().slice(0, 16);

  const defaultEndObj = new Date(now.getTime() + (exam.durationMinutes || 60) * 60 * 1000);
  const defaultEnd = defaultEndObj.toISOString().slice(0, 16);

  const [startTime, setStartTime] = useState(
    exam.scheduledStartTime ? exam.scheduledStartTime.slice(0, 16) : defaultStart
  );
  const [endTime, setEndTime] = useState(
    exam.scheduledEndTime ? exam.scheduledEndTime.slice(0, 16) : defaultEnd
  );
  const [notes, setNotes] = useState(exam.scheduleNotes || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasProposedSchedule =
    exam.scheduleStatus === 'schedule_proposed' &&
    exam.scheduledStartTime &&
    exam.scheduledEndTime;

  const handleAuthorizeExisting = async () => {
    try {
      setSubmitting(true);
      setError(null);
      await examService.authorizeExamSchedule(exam.id, adminName);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to authorize schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime || !endTime) {
      setError('Please provide both Start and End date & time.');
      return;
    }

    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      setError('Live End Time must be later than Start Time.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await examService.alterExamSchedule(exam.id, {
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        alteredBy: adminName,
        notes: notes.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to alter exam schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-750/50">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Authorize or Alter Exam Live Schedule
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                {exam.title}
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

        {/* Paper Setter's Proposed Schedule Banner if exists */}
        {hasProposedSchedule && (
          <div className="p-4 mx-6 mt-6 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wider text-[10px]">
                Proposed by Paper Setter ({exam.scheduleProposedBy || exam.setterName})
              </span>
              <span className="text-[10px] text-amber-600">Pending Authorization</span>
            </div>
            <div className="text-amber-950 dark:text-amber-100 font-semibold space-y-0.5">
              <div>
                Start: <span className="underline">{new Date(exam.scheduledStartTime!).toLocaleString()}</span>
              </div>
              <div>
                End: <span className="underline">{new Date(exam.scheduledEndTime!).toLocaleString()}</span>
              </div>
              {exam.scheduleNotes && (
                <div className="text-[11px] font-normal text-amber-800/80 dark:text-amber-300/80 italic pt-1">
                  Note: "{exam.scheduleNotes}"
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={handleAuthorizeExisting}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-colors flex items-center space-x-1.5"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Authorize Proposed Time As-Is</span>
              </button>
            </div>
          </div>
        )}

        <form onSubmit={handleSaveAndAuthorize} className="p-6 space-y-4">
          <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            {hasProposedSchedule
              ? 'Or alter & customize the live date and time:'
              : 'Set or reschedule live date & time for participants:'}
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Goes Live At (Start Time) *
              </label>
              <input
                type="datetime-local"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                Window Closes (End Time) *
              </label>
              <input
                type="datetime-local"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Administrator Schedule Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Rescheduled as per Dean circular #2026/A"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3.5 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
            <div className="flex items-center space-x-1.5 font-semibold text-slate-700 dark:text-slate-300">
              <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
              <span>Institutional Governance Rule</span>
            </div>
            <p>
              Once authorized by Administrator, the exam is published. Assigned participants can begin the exam strictly during this authorized window.
            </p>
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
              className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-900/30 transition-all disabled:opacity-50"
            >
              {submitting ? 'Authorizing...' : 'Save & Authorize Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
