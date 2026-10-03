import React, { useState } from 'react';
import { Exam } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  Calendar,
  Clock,
  Send,
  X,
  ShieldCheck,
  AlertCircle
} from 'lucide-react';

interface ProposeScheduleModalProps {
  isOpen: boolean;
  exam: Exam | null;
  onClose: () => void;
  onSuccess: () => void;
  setterName: string;
}

export const ProposeScheduleModal: React.FC<ProposeScheduleModalProps> = ({
  isOpen,
  exam,
  onClose,
  onSuccess,
  setterName,
}) => {
  if (!isOpen || !exam) return null;

  const now = new Date();
  now.setHours(now.getHours() + 2);
  now.setMinutes(0);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!startTime || !endTime) {
      setError('Please select both Start and End date & time.');
      return;
    }

    if (new Date(endTime).getTime() <= new Date(startTime).getTime()) {
      setError('Live End Time must be later than Start Time.');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      await examService.proposeExamSchedule(exam.id, {
        scheduledStartTime: startTime,
        scheduledEndTime: endTime,
        proposedBy: setterName,
        notes: notes.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to submit proposed schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 dark:border-slate-700 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-750/50">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Propose Live Date & Time
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[240px]">
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
            As Paper Setter, designate the exact date and time window when this examination should go live for enrolled student participants.
          </p>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Goes Live At (Start Time) *
            </label>
            <input
              type="datetime-local"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Live Window Closes At (End Time) *
            </label>
            <input
              type="datetime-local"
              required
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Notes for Administrator (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Scheduled to coincide with Batch 2026 lab session"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
            <div className="flex items-center space-x-1.5 font-bold">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Administrator Authorization Required</span>
            </div>
            <p>
              Your proposed schedule will be submitted directly to the Administrator dashboard. The examination will not become live for participants until authorized.
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
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-md shadow-indigo-900/30 transition-all disabled:opacity-50 flex items-center space-x-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{submitting ? 'Submitting...' : 'Submit Schedule to Admin'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
