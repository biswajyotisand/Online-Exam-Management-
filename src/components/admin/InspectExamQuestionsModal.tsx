import React, { useEffect, useState } from 'react';
import { Exam, Question } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  BookOpen,
  Lock,
  X,
  FileText,
  CheckCircle2,
  Code2,
  HelpCircle,
  ShieldAlert,
  Clock,
  Award
} from 'lucide-react';

interface InspectExamQuestionsModalProps {
  isOpen: boolean;
  exam: Exam | null;
  onClose: () => void;
}

export const InspectExamQuestionsModal: React.FC<InspectExamQuestionsModalProps> = ({
  isOpen,
  exam,
  onClose,
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && exam) {
      setLoading(true);
      examService
        .getQuestions(exam.id)
        .then((qList) => setQuestions(qList))
        .catch((err) => console.error('Failed to load questions:', err))
        .finally(() => setLoading(false));
    }
  }, [isOpen, exam]);

  if (!isOpen || !exam) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in overflow-y-auto">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-3xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 my-8 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-750/50">
          <div className="flex items-center space-x-2.5">
            <span className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <BookOpen className="w-5 h-5" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Exam Question Paper Inspection
                </h3>
                <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <Lock className="w-3 h-3" />
                  <span>Admin View-Only</span>
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-sm">
                {exam.title} • Authored by: {exam.setterName}
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
            <strong>Institutional Governance:</strong> The Administrator has read-only access to question papers. Questions and marking weights can only be authored and modified by the designated Exam Paper Setter ({exam.setterName}).
          </span>
        </div>

        {/* Exam Metadata Summary */}
        <div className="px-6 pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[11px]">Subject</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{exam.subject}</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[11px]">Duration</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{exam.durationMinutes} mins</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[11px]">Total Marks</span>
            <span className="font-bold text-indigo-600 dark:text-indigo-400">{exam.totalMarks} pts</span>
          </div>
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700">
            <span className="text-slate-400 block text-[11px]">Questions Count</span>
            <span className="font-bold text-slate-800 dark:text-slate-200">{questions.length} items</span>
          </div>
        </div>

        {/* Questions Body */}
        <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">Loading questions...</div>
          ) : questions.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-xs space-y-2">
              <FileText className="w-8 h-8 mx-auto text-slate-300 dark:text-slate-600" />
              <p>No questions have been authored yet for this examination.</p>
              <p className="text-[11px] text-slate-400">
                The designated Paper Setter ({exam.setterName}) will author questions in their portal.
              </p>
            </div>
          ) : (
            questions.map((q, idx) => (
              <div
                key={q.id}
                className="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-750 space-y-3 text-xs"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start space-x-2.5">
                    <span className="w-6 h-6 rounded-lg bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                      {idx + 1}
                    </span>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                          {q.type}
                        </span>
                        <span className="text-slate-400">•</span>
                        <span className="font-bold text-indigo-600 dark:text-indigo-400">
                          {q.marks} Marks
                        </span>
                      </div>
                      <h4 className="font-semibold text-slate-900 dark:text-white mt-1.5 text-sm">
                        {q.title}
                      </h4>
                    </div>
                  </div>
                </div>

                {/* Question Details / Options */}
                {q.type === 'mcq' && q.options && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                    {q.options.map((opt, optIdx) => {
                      const isCorrect = opt === q.correctAnswer;
                      return (
                        <div
                          key={optIdx}
                          className={`p-2.5 rounded-xl border text-xs flex items-center justify-between ${
                            isCorrect
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200 font-semibold'
                              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          <span>{opt}</span>
                          {isCorrect && (
                            <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                              (Correct Answer)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {q.type === 'boolean' && (
                  <div className="pt-1 text-slate-600 dark:text-slate-300">
                    Correct Value:{' '}
                    <span className="font-bold text-emerald-600">{q.correctAnswer}</span>
                  </div>
                )}

                {q.type === 'code' && q.starterCode && (
                  <div className="pt-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Starter Code:
                    </span>
                    <pre className="p-3 rounded-xl bg-slate-900 text-emerald-400 font-mono text-[11px] overflow-x-auto">
                      {q.starterCode}
                    </pre>
                  </div>
                )}

                {q.rubric && (
                  <div className="p-2.5 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 text-[11px] text-slate-600 dark:text-slate-300">
                    <strong className="text-indigo-700 dark:text-indigo-400">Evaluator Rubric:</strong>{' '}
                    {q.rubric}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-750/50">
          <div className="text-[11px] text-slate-400 flex items-center space-x-1.5">
            <Lock className="w-3.5 h-3.5" />
            <span>Inspection Only • Alterations locked to Exam Paper Setter</span>
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
  );
};
