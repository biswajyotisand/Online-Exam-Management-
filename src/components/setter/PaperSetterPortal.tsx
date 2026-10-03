import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { examService } from '../../services/examService';
import { Exam, Question, QuestionType } from '../../types/exam';
import {
  BookOpen,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
  Clock,
  HelpCircle,
  FileCheck,
  Eye,
  AlertCircle,
  Sparkles,
  ArrowRight,
  Code2,
  ListOrdered,
  X,
  Lock,
  ShieldAlert,
  Calendar
} from 'lucide-react';
import { ProposeScheduleModal } from './ProposeScheduleModal';

export const PaperSetterPortal: React.FC = () => {
  const { profile, isAdmin, activeRole } = useAuth();
  const isViewOnlyAdmin = (isAdmin || profile?.role === 'admin') && activeRole === 'paper_setter';
  const [exams, setExams] = useState<Exam[]>([]);
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [editingQuestion, setEditingQuestion] = useState<Question | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  // Form states for creating exam
  const [examForm, setExamForm] = useState({
    title: '',
    subject: 'Computer Science',
    description: '',
    durationMinutes: 45,
    totalMarks: 50,
    passingMarks: 25,
    instructions: '1. Attempt all questions.\n2. Do not switch tabs during examination.\n3. Verify all answers before final submission.',
    proctoringEnabled: true,
  });

  // Form states for question
  const [questionForm, setQuestionForm] = useState<{
    title: string;
    type: QuestionType;
    marks: number;
    options: string[];
    correctAnswer: string;
    rubric: string;
    explanation: string;
    starterCode: string;
  }>({
    title: '',
    type: 'mcq',
    marks: 10,
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correctAnswer: 'Option A',
    rubric: '',
    explanation: '',
    starterCode: '',
  });

  const loadExams = async () => {
    try {
      setLoading(true);
      const all = await examService.getAllExams();
      setExams(all);
      if (selectedExam) {
        const refreshed = all.find((e) => e.id === selectedExam.id);
        if (refreshed) {
          setSelectedExam(refreshed);
          const qList = await examService.getQuestions(refreshed.id);
          setQuestions(qList);
        }
      } else if (all.length > 0) {
        setSelectedExam(all[0]);
        const qList = await examService.getQuestions(all[0].id);
        setQuestions(qList);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExams();
  }, []);

  const handleSelectExam = async (exam: Exam) => {
    setSelectedExam(exam);
    try {
      const qList = await examService.getQuestions(exam.id);
      setQuestions(qList);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateExam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnlyAdmin) {
      setErrorNotice('Access Denied: Administrator is in view-only mode and cannot create exams.');
      return;
    }
    if (!examForm.title.trim()) {
      setErrorNotice('Exam title is required');
      return;
    }

    try {
      const newId = 'exam_' + Date.now().toString(36);
      const newExam: Exam = {
        id: newId,
        title: examForm.title.trim(),
        subject: examForm.subject.trim(),
        description: examForm.description.trim(),
        setterId: profile?.uid || 'setter_demo',
        setterName: profile?.displayName || 'Exam Paper Setter',
        status: 'draft',
        durationMinutes: Number(examForm.durationMinutes),
        totalMarks: Number(examForm.totalMarks),
        passingMarks: Number(examForm.passingMarks),
        questionsCount: 0,
        instructions: examForm.instructions,
        proctoringEnabled: examForm.proctoringEnabled,
        createdAt: new Date().toISOString(),
      };

      await examService.createExam(newExam);
      setExamModalOpen(false);
      setExamForm({
        title: '',
        subject: 'Computer Science',
        description: '',
        durationMinutes: 45,
        totalMarks: 50,
        passingMarks: 25,
        instructions: '1. Attempt all questions.\n2. Do not switch tabs during examination.\n3. Verify all answers before final submission.',
        proctoringEnabled: true,
      });

      setSuccessNotice('Exam draft created successfully!');
      setTimeout(() => setSuccessNotice(null), 3000);
      await loadExams();
      setSelectedExam(newExam);
      setQuestions([]);
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to create exam');
    }
  };

  const openAddQuestion = () => {
    if (isViewOnlyAdmin) {
      setErrorNotice('Access Denied: Administrator is in view-only mode and cannot add questions.');
      return;
    }
    setEditingQuestion(null);
    setQuestionForm({
      title: '',
      type: 'mcq',
      marks: 10,
      options: ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: 'Option A',
      rubric: '',
      explanation: '',
      starterCode: '',
    });
    setQuestionModalOpen(true);
  };

  const openEditQuestion = (q: Question) => {
    if (isViewOnlyAdmin) {
      setErrorNotice('Access Denied: Administrator is in view-only mode and cannot alter questions.');
      return;
    }
    setEditingQuestion(q);
    setQuestionForm({
      title: q.title,
      type: q.type,
      marks: q.marks,
      options: q.options || ['Option A', 'Option B', 'Option C', 'Option D'],
      correctAnswer: q.correctAnswer || '',
      rubric: q.rubric || '',
      explanation: q.explanation || '',
      starterCode: q.starterCode || '',
    });
    setQuestionModalOpen(true);
  };

  const handleSaveQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isViewOnlyAdmin) {
      setErrorNotice('Access Denied: Administrator is in view-only mode and cannot save questions.');
      return;
    }
    if (!selectedExam) return;
    if (!questionForm.title.trim()) {
      setErrorNotice('Question text is required');
      return;
    }

    try {
      const qId = editingQuestion ? editingQuestion.id : 'q_' + Date.now().toString(36);
      const order = editingQuestion ? editingQuestion.order : questions.length + 1;

      const newQ: Question = {
        id: qId,
        examId: selectedExam.id,
        order,
        title: questionForm.title.trim(),
        type: questionForm.type,
        marks: Number(questionForm.marks),
        createdAt: editingQuestion?.createdAt || new Date().toISOString(),
      };

      if (questionForm.type === 'mcq' && questionForm.options?.length) {
        newQ.options = questionForm.options;
      }
      if (
        (questionForm.type === 'mcq' || questionForm.type === 'boolean') &&
        questionForm.correctAnswer?.trim()
      ) {
        newQ.correctAnswer = questionForm.correctAnswer.trim();
      }
      if (questionForm.rubric?.trim()) {
        newQ.rubric = questionForm.rubric.trim();
      }
      if (questionForm.explanation?.trim()) {
        newQ.explanation = questionForm.explanation.trim();
      }
      if (questionForm.type === 'code' && questionForm.starterCode?.trim()) {
        newQ.starterCode = questionForm.starterCode.trim();
      }

      await examService.saveQuestion(newQ);
      setQuestionModalOpen(false);
      setSuccessNotice('Question saved successfully!');
      setTimeout(() => setSuccessNotice(null), 3000);

      // Refresh questions
      const updated = await examService.getQuestions(selectedExam.id);
      setQuestions(updated);
      await loadExams();
    } catch (err: any) {
      setErrorNotice(err?.message || 'Error saving question');
    }
  };

  const handleDeleteQuestion = async (qId: string) => {
    if (isViewOnlyAdmin) {
      setErrorNotice('Access Denied: Administrator is in view-only mode and cannot delete questions.');
      return;
    }
    if (!selectedExam) return;
    if (!confirm('Are you sure you want to delete this question?')) return;
    try {
      await examService.deleteQuestion(selectedExam.id, qId);
      const updated = await examService.getQuestions(selectedExam.id);
      setQuestions(updated);
      setSuccessNotice('Question removed.');
      setTimeout(() => setSuccessNotice(null), 2500);
      await loadExams();
    } catch (err) {
      console.error(err);
    }
  };

  const handlePublishExam = async () => {
    if (isViewOnlyAdmin) {
      setErrorNotice('Access Denied: Administrator is in view-only mode and cannot publish exams.');
      return;
    }
    if (!selectedExam) return;
    const currentSum = questions.reduce((acc, q) => acc + (q.marks || 0), 0);
    if (questions.length === 0) {
      setErrorNotice('Cannot publish an exam with no questions.');
      return;
    }

    try {
      await examService.updateExam(selectedExam.id, {
        status: 'published',
        totalMarks: currentSum,
        questionsCount: questions.length,
      });
      setSelectedExam((prev) => (prev ? { ...prev, status: 'published', totalMarks: currentSum } : null));
      setSuccessNotice('Exam is now PUBLISHED and live for student participants!');
      setTimeout(() => setSuccessNotice(null), 4000);
      await loadExams();
    } catch (err: any) {
      setErrorNotice(err?.message || 'Failed to publish exam');
    }
  };

  const currentQuestionsMarksSum = questions.reduce((sum, q) => sum + (q.marks || 0), 0);

  return (
    <div className="space-y-6">
      {/* Administrator View-Only Banner */}
      {isViewOnlyAdmin && (
        <div className="bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/40 rounded-2xl p-4 flex items-center space-x-3 text-amber-900 dark:text-amber-200 text-xs">
          <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0" />
          <div className="flex-1">
            <span className="font-bold">Administrator Inspection Mode (View-Only):</span> You are viewing the Exam Paper Setter portal. As Administrator, you cannot alter, add, edit, or delete any question or exam configuration. Question authoring and publishing are reserved exclusively for authorized Paper Setters.
          </div>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-xl border border-indigo-900/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                <BookOpen className="w-5 h-5" />
              </span>
              <h1 className="text-xl font-bold tracking-tight">Exam Paper Setter Studio</h1>
            </div>
            <p className="text-xs text-indigo-200/80 mt-1 max-w-2xl leading-relaxed">
              Design academic exam papers, author multi-format questions (MCQ, Subjective, Boolean, Code), configure scoring rubrics for evaluators, and publish tests.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {isViewOnlyAdmin ? (
              <div className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white/10 text-slate-300 text-xs font-semibold border border-white/15 cursor-not-allowed">
                <Lock className="w-3.5 h-3.5" />
                <span>View-Only Mode</span>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setExamModalOpen(true)}
                className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold shadow-md shadow-indigo-900/40 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Create New Exam</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifiers */}
        {successNotice && (
          <div className="mt-4 p-2.5 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-xs flex items-center space-x-2 animate-in fade-in">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successNotice}</span>
          </div>
        )}
        {errorNotice && (
          <div className="mt-4 p-2.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-200 text-xs flex items-center space-x-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorNotice}</span>
          </div>
        )}
      </div>

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Col: Exams Drawer */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Examination Papers ({exams.length})
              </h2>
              <span className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold">
                Click to manage
              </span>
            </div>

            <div className="space-y-2">
              {exams.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">
                  No exams yet. Click "Create New Exam" above.
                </div>
              ) : (
                exams.map((exam) => {
                  const isSelected = selectedExam?.id === exam.id;
                  return (
                    <div
                      key={exam.id}
                      onClick={() => handleSelectExam(exam)}
                      className={`p-3.5 rounded-xl border text-left cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-indigo-50/70 border-indigo-500/80 shadow-xs dark:bg-indigo-950/40 dark:border-indigo-600'
                          : 'bg-slate-50/60 dark:bg-slate-750/60 border-slate-200/80 dark:border-slate-700/80 hover:bg-slate-100 dark:hover:bg-slate-700'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-bold text-xs text-slate-900 dark:text-white line-clamp-2">
                          {exam.title}
                        </div>
                        <span
                          className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full shrink-0 ${
                            exam.status === 'published'
                              ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          }`}
                        >
                          {exam.status}
                        </span>
                      </div>

                      <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{exam.subject}</span>
                        <span>{exam.durationMinutes} mins • {exam.totalMarks} Marks</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Col: Question Studio */}
        <div className="lg:col-span-8 space-y-4">
          {selectedExam ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-6 shadow-xs space-y-6">
              {/* Exam Info Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-slate-200 dark:border-slate-700 gap-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
                      {selectedExam.subject}
                    </span>
                    <span className="text-xs text-slate-400">•</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                      Author: {selectedExam.setterName}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-1">
                    {selectedExam.title}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    {selectedExam.description || 'No description provided.'}
                  </p>
                </div>

                <div className="flex items-center space-x-2 shrink-0">
                  {isViewOnlyAdmin ? (
                    <span className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-xs font-semibold flex items-center space-x-1.5">
                      <Lock className="w-3.5 h-3.5" />
                      <span>Questions View-Only</span>
                    </span>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setScheduleModalOpen(true)}
                        className="flex items-center space-x-1.5 px-3 py-2 rounded-xl border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100 transition-all"
                      >
                        <Calendar className="w-4 h-4" />
                        <span>Live Schedule</span>
                      </button>
                      {selectedExam.status === 'draft' && (
                        <button
                          type="button"
                          onClick={handlePublishExam}
                          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs transition-all"
                        >
                          <FileCheck className="w-4 h-4" />
                          <span>Publish Exam</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={openAddQuestion}
                        className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs transition-all"
                      >
                        <Plus className="w-4 h-4" />
                        <span>Add Question</span>
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Mandatory Action Banner: Set Live Date & Time */}
              {!isViewOnlyAdmin && !selectedExam.scheduledStartTime && (
                <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center space-x-2.5">
                    <span className="p-2 rounded-xl bg-amber-500/20 text-amber-700 dark:text-amber-300">
                      <Calendar className="w-5 h-5 text-amber-600" />
                    </span>
                    <div>
                      <h4 className="font-bold text-amber-900 dark:text-amber-200">
                        Action Required: Put Live Date & Time for Participants
                      </h4>
                      <p className="text-amber-800/80 dark:text-amber-300/80 text-[11px] mt-0.5">
                        For this examination, the Paper Setter must put the date & time when the exam will go live for participants. The Administrator will authorize or alter the schedule.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setScheduleModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-900/20 shrink-0"
                  >
                    + Put Live Date & Time
                  </button>
                </div>
              )}

              {/* Live Schedule Status Card */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-750 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-2.5">
                  <span className="p-2 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                    <Calendar className="w-4 h-4" />
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        Live Schedule Window:
                      </span>
                      {selectedExam.scheduleStatus === 'schedule_authorized' ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold text-[10px]">
                          ✓ Authorized by Administrator
                        </span>
                      ) : selectedExam.scheduleStatus === 'schedule_proposed' ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 font-bold text-[10px]">
                          ⏳ Pending Admin Authorization
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-bold text-[10px]">
                          Not Scheduled Yet
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {selectedExam.scheduledStartTime ? (
                        <>
                          Starts: <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date(selectedExam.scheduledStartTime).toLocaleString()}</span>
                          {selectedExam.scheduledEndTime && (
                            <> • Ends: <span className="font-semibold text-slate-700 dark:text-slate-300">{new Date(selectedExam.scheduledEndTime).toLocaleString()}</span></>
                          )}
                        </>
                      ) : (
                        'Paper Setter must submit the date & time when the exam will go live for participants.'
                      )}
                    </p>
                  </div>
                </div>

                {!isViewOnlyAdmin && (
                  <button
                    type="button"
                    onClick={() => setScheduleModalOpen(true)}
                    className="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all shadow-xs self-start sm:self-auto shrink-0"
                  >
                    {selectedExam.scheduledStartTime ? 'Change Live Date & Time' : 'Set Live Date & Time'}
                  </button>
                )}
              </div>

              {/* Marks Summary Pill */}
              <div className="flex flex-wrap items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 text-xs">
                <div className="flex items-center space-x-4">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Total Questions:</span>{' '}
                    <span className="font-bold text-slate-900 dark:text-white">{questions.length}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Target Marks:</span>{' '}
                    <span className="font-bold text-slate-900 dark:text-white">{selectedExam.totalMarks}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Allocated Sum:</span>{' '}
                    <span
                      className={`font-bold ${
                        currentQuestionsMarksSum === selectedExam.totalMarks
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : 'text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {currentQuestionsMarksSum}
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-500">
                  Passing Marks: <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedExam.passingMarks}</span>
                </div>
              </div>

              {/* Questions List */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Question Items ({questions.length})
                </h3>

                {questions.length === 0 ? (
                  <div className="py-12 border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-2xl text-center space-y-3">
                    <HelpCircle className="w-8 h-8 text-slate-400 mx-auto" />
                    <p className="text-xs text-slate-500">
                      This exam has no questions authored yet. Click "Add Question" to start.
                    </p>
                    <button
                      type="button"
                      onClick={openAddQuestion}
                      className="px-3.5 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 text-xs font-bold hover:bg-indigo-100"
                    >
                      + Add First Question
                    </button>
                  </div>
                ) : (
                  questions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-750/40 hover:border-slate-300 dark:hover:border-slate-600 transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start space-x-3">
                          <span className="w-6 h-6 rounded-lg bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 font-bold text-xs flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <div>
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                                {q.type}
                              </span>
                              <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                {q.marks} Marks
                              </span>
                            </div>
                            <p className="text-xs font-semibold text-slate-900 dark:text-white mt-1 leading-relaxed">
                              {q.title}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-1 shrink-0">
                          {isViewOnlyAdmin ? (
                            <span className="p-1.5 text-slate-400 flex items-center space-x-1 text-[11px]" title="Questions cannot be altered in Administrator view-only mode">
                              <Lock className="w-3.5 h-3.5" />
                              <span className="text-[10px]">Read-Only</span>
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => openEditQuestion(q)}
                                className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                                title="Edit Question"
                              >
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteQuestion(q.id)}
                                className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                                title="Delete Question"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Question Details preview */}
                      {q.type === 'mcq' && q.options && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2 border-t border-slate-100 dark:border-slate-700/60">
                          {q.options.map((opt, i) => {
                            const isCorrect = q.correctAnswer === opt;
                            return (
                              <div
                                key={i}
                                className={`p-2 rounded-lg text-xs flex items-center justify-between border ${
                                  isCorrect
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 font-medium'
                                    : 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600'
                                }`}
                              >
                                <span>{opt}</span>
                                {isCorrect && (
                                  <span className="text-[10px] text-emerald-600 font-bold uppercase ml-2">
                                    Correct Answer
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {q.type === 'boolean' && (
                        <div className="text-xs text-slate-500 pt-1 border-t border-slate-100 dark:border-slate-700/60">
                          Correct Answer:{' '}
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {q.correctAnswer}
                          </span>
                        </div>
                      )}

                      {q.rubric && (
                        <div className="p-2.5 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-900 dark:text-amber-200">
                          <span className="font-bold">Evaluator Rubric: </span>
                          <span className="whitespace-pre-line text-[11px]">{q.rubric}</span>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-12 text-center text-slate-400 text-xs">
              Select or create an exam on the left to start authoring questions.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Create Exam */}
      {examModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Create New Examination Paper
              </h3>
              <button
                type="button"
                onClick={() => setExamModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExam} className="space-y-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Exam Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Distributed Computing & Cloud Infrastructure (CS-402)"
                  value={examForm.title}
                  onChange={(e) => setExamForm({ ...examForm, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Subject / Discipline
                  </label>
                  <input
                    type="text"
                    value={examForm.subject}
                    onChange={(e) => setExamForm({ ...examForm, subject: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Duration (Minutes)
                  </label>
                  <input
                    type="number"
                    min="5"
                    max="300"
                    value={examForm.durationMinutes}
                    onChange={(e) => setExamForm({ ...examForm, durationMinutes: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Target Total Marks
                  </label>
                  <input
                    type="number"
                    min="10"
                    value={examForm.totalMarks}
                    onChange={(e) => setExamForm({ ...examForm, totalMarks: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Passing Marks
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={examForm.passingMarks}
                    onChange={(e) => setExamForm({ ...examForm, passingMarks: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white focus:outline-hidden"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Description / Syllabus
                </label>
                <textarea
                  rows={2}
                  placeholder="Summary of topics tested..."
                  value={examForm.description}
                  onChange={(e) => setExamForm({ ...examForm, description: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Instructions for Participants
                </label>
                <textarea
                  rows={3}
                  value={examForm.instructions}
                  onChange={(e) => setExamForm({ ...examForm, instructions: e.target.value })}
                  className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white focus:outline-hidden font-mono text-[11px]"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="proctoringEnabled"
                  checked={examForm.proctoringEnabled}
                  onChange={(e) => setExamForm({ ...examForm, proctoringEnabled: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <label htmlFor="proctoringEnabled" className="text-slate-700 dark:text-slate-300 font-medium">
                  Enable Proctored Integrity Guard (logs tab-switching and window focus loss)
                </label>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setExamModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Create Exam Draft
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add/Edit Question */}
      {questionModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {editingQuestion ? 'Edit Question' : 'Author Question Item'}
              </h3>
              <button
                type="button"
                onClick={() => setQuestionModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuestion} className="space-y-4 mt-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Question Type
                  </label>
                  <select
                    value={questionForm.type}
                    onChange={(e) => setQuestionForm({ ...questionForm, type: e.target.value as QuestionType })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white focus:outline-hidden"
                  >
                    <option value="mcq">Multiple Choice (MCQ)</option>
                    <option value="boolean">True / False</option>
                    <option value="subjective">Subjective / Essay</option>
                    <option value="code">Code / Practical Task</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Marks / Points
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="100"
                    value={questionForm.marks}
                    onChange={(e) => setQuestionForm({ ...questionForm, marks: Number(e.target.value) })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white focus:outline-hidden font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Question Statement / Prompt *
                </label>
                <textarea
                  rows={3}
                  required
                  placeholder="Enter clear, concise question prompt..."
                  value={questionForm.title}
                  onChange={(e) => setQuestionForm({ ...questionForm, title: e.target.value })}
                  className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white focus:outline-hidden"
                />
              </div>

              {/* MCQ Options */}
              {questionForm.type === 'mcq' && (
                <div className="space-y-2">
                  <label className="block font-semibold text-slate-700 dark:text-slate-300">
                    Options & Correct Answer
                  </label>
                  {questionForm.options.map((opt, i) => (
                    <div key={i} className="flex items-center space-x-2">
                      <input
                        type="radio"
                        name="correctAnswerRadio"
                        checked={questionForm.correctAnswer === opt}
                        onChange={() => setQuestionForm({ ...questionForm, correctAnswer: opt })}
                        title="Mark as correct answer"
                      />
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const newOpts = [...questionForm.options];
                          const oldVal = newOpts[i];
                          newOpts[i] = e.target.value;
                          setQuestionForm({
                            ...questionForm,
                            options: newOpts,
                            correctAnswer:
                              questionForm.correctAnswer === oldVal
                                ? e.target.value
                                : questionForm.correctAnswer,
                          });
                        }}
                        className="flex-1 p-2 text-xs rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 text-slate-900 dark:text-white"
                      />
                    </div>
                  ))}
                  <p className="text-[11px] text-slate-400">
                    Select the radio button beside the designated correct option for automatic grading.
                  </p>
                </div>
              )}

              {/* Boolean */}
              {questionForm.type === 'boolean' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Correct Answer
                  </label>
                  <div className="flex space-x-4">
                    {['True', 'False'].map((val) => (
                      <label key={val} className="flex items-center space-x-1.5 cursor-pointer">
                        <input
                          type="radio"
                          name="booleanAnswer"
                          checked={questionForm.correctAnswer === val}
                          onChange={() => setQuestionForm({ ...questionForm, correctAnswer: val })}
                        />
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{val}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {/* Starter Code for Code question */}
              {questionForm.type === 'code' && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Starter Code Template (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="function solution() {\n  // Code here\n}"
                    value={questionForm.starterCode}
                    onChange={(e) => setQuestionForm({ ...questionForm, starterCode: e.target.value })}
                    className="w-full p-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900 text-emerald-400 font-mono text-[11px]"
                  />
                </div>
              )}

              {/* Rubric for Evaluator (Subjective / Code) */}
              {(questionForm.type === 'subjective' || questionForm.type === 'code') && (
                <div>
                  <label className="block font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Evaluator Rubric & Model Answer Guidelines
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Provide specific criteria: e.g. Full marks for handling edge cases, partial for syntax, etc."
                    value={questionForm.rubric}
                    onChange={(e) => setQuestionForm({ ...questionForm, rubric: e.target.value })}
                    className="w-full p-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 text-slate-900 dark:text-white"
                  />
                  <span className="text-[10px] text-slate-400">
                    Visible to Evaluators in their grading portal.
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-slate-100 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => setQuestionModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 hover:bg-slate-50 dark:text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                >
                  Save Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Propose Schedule Modal */}
      <ProposeScheduleModal
        isOpen={scheduleModalOpen}
        exam={selectedExam}
        onClose={() => setScheduleModalOpen(false)}
        onSuccess={async () => {
          setSuccessNotice('Live schedule proposal submitted to Administrator for authorization.');
          setTimeout(() => setSuccessNotice(null), 4000);
          await loadExams();
        }}
        setterName={profile?.displayName || 'Exam Paper Setter'}
      />
    </div>
  );
};
