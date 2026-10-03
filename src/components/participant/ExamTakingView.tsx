import React, { useState, useEffect, useRef } from 'react';
import { Exam, Question, Submission } from '../../types/exam';
import { examService } from '../../services/examService';
import confetti from 'canvas-confetti';
import {
  Clock,
  AlertTriangle,
  Flag,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Send,
  Save,
  ShieldAlert,
  HelpCircle,
  Code2,
  FileCheck,
  Maximize2,
  Play,
  RotateCcw,
  Terminal,
  Trash2,
  Lock,
  EyeOff,
  Star
} from 'lucide-react';

interface ExamTakingViewProps {
  exam: Exam;
  submission: Submission;
  questions: Question[];
  onFinish: (updatedSub: Submission) => void;
  onExit: () => void;
}

interface LogEntry {
  type: 'log' | 'info' | 'warn' | 'error' | 'result';
  text: string;
  time: string;
}

export const ExamTakingView: React.FC<ExamTakingViewProps> = ({
  exam,
  submission,
  questions,
  onFinish,
  onExit,
}) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { answer: string; isFlagged: boolean }>>(() => {
    const initial: Record<string, { answer: string; isFlagged: boolean }> = {};
    for (const q of questions) {
      initial[q.id] = {
        answer: submission.answers?.[q.id]?.answer || (q.type === 'code' ? q.starterCode || '' : ''),
        isFlagged: submission.answers?.[q.id]?.isFlagged || false,
      };
    }
    return initial;
  });

  // Calculate remaining time from startedAt or duration
  const totalSeconds = (exam.durationMinutes || 45) * 60;
  const [timeLeft, setTimeLeft] = useState<number>(() => {
    if (submission.startedAt) {
      const elapsed = Math.floor((Date.now() - new Date(submission.startedAt).getTime()) / 1000);
      return Math.max(0, totalSeconds - elapsed);
    }
    return totalSeconds;
  });

  // Proctoring & Integrity Violation Tracking
  const [tabSwitches, setTabSwitches] = useState<number>(submission.tabSwitchCount || 0);
  const [showIntegrityAlert, setShowIntegrityAlert] = useState(false);
  const [integrityReason, setIntegrityReason] = useState<string>('Window focus loss or tab switch detected.');
  const [clipboardNotice, setClipboardNotice] = useState<string | null>(null);

  // Fullscreen Lockdown State
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [showFullscreenGate, setShowFullscreenGate] = useState<boolean>(true);

  // In-Browser Code Sandbox State
  const [codeLogs, setCodeLogs] = useState<Record<string, LogEntry[]>>({});
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [runDuration, setRunDuration] = useState<number | null>(null);

  const [submitConfirmOpen, setSubmitConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState<string>('Just now');
  const [attemptNotice, setAttemptNotice] = useState<string | null>(null);
  const [paletteFilter, setPaletteFilter] = useState<'all' | 'compulsory' | 'answered' | 'unanswered' | 'flagged'>('all');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // --- Mandatory Fullscreen Management ---
  const requestFullscreenLock = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      }
      setIsFullscreen(true);
      setShowFullscreenGate(false);
    } catch (err) {
      console.warn('Fullscreen entry prevented or unsupported:', err);
      // Fallback: dismiss gate anyway
      setShowFullscreenGate(false);
    }
  };

  useEffect(() => {
    // Attempt auto fullscreen on load
    requestFullscreenLock();

    const handleFullscreenChange = () => {
      const isFull = Boolean(document.fullscreenElement || (document as any).webkitFullscreenElement);
      setIsFullscreen(isFull);

      if (!isFull) {
        // Fullscreen was exited! Trigger integrity strike
        setTabSwitches((prev) => {
          const updated = prev + 1;
          examService.saveDraftAnswer(submission.id, answers, updated);
          return updated;
        });
        setIntegrityReason('Exiting Mandatory Fullscreen or pressing Escape is an examination violation. Your strike has been recorded.');
        setShowIntegrityAlert(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // --- Anti-Cheat Lockdown: Block Copy, Cut, Paste, Right Click, & DevTools Shortcuts ---
  useEffect(() => {
    const handleCopyCutPaste = (e: ClipboardEvent) => {
      e.preventDefault();
      setClipboardNotice('Clipboard action (Copy/Cut/Paste) is blocked for exam integrity.');
      setTimeout(() => setClipboardNotice(null), 3500);
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      setClipboardNotice('Context Menu (Right Click) is disabled during the examination.');
      setTimeout(() => setClipboardNotice(null), 3000);
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // F12 Developer Tools
      if (e.key === 'F12') {
        e.preventDefault();
        recordViolation('Developer Tools shortcut (F12) intercepted.');
        return;
      }
      // Ctrl+Shift+I / J / C (DevTools inspector) or Cmd+Option+I / J / C
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'I', 'j', 'J', 'c', 'C'].includes(e.key)) {
        e.preventDefault();
        recordViolation('Developer Inspection shortcut (Ctrl+Shift+I/J/C) intercepted.');
        return;
      }
      // Ctrl+U (View Source)
      if ((e.ctrlKey || e.metaKey) && ['u', 'U'].includes(e.key)) {
        e.preventDefault();
        recordViolation('View Source shortcut (Ctrl+U) intercepted.');
        return;
      }
      // Escape key warning
      if (e.key === 'Escape' && document.fullscreenElement) {
        // Notice: Fullscreen change will trigger separately
        setClipboardNotice('Pressing Escape will exit fullscreen and trigger an integrity strike.');
        setTimeout(() => setClipboardNotice(null), 3000);
      }
    };

    document.addEventListener('copy', handleCopyCutPaste);
    document.addEventListener('cut', handleCopyCutPaste);
    document.addEventListener('paste', handleCopyCutPaste);
    document.addEventListener('contextmenu', handleContextMenu);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('copy', handleCopyCutPaste);
      document.removeEventListener('cut', handleCopyCutPaste);
      document.removeEventListener('paste', handleCopyCutPaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [answers, submission.id]);

  const recordViolation = (reason: string) => {
    setTabSwitches((prev) => {
      const updated = prev + 1;
      examService.saveDraftAnswer(submission.id, answers, updated);
      return updated;
    });
    setIntegrityReason(reason);
    setShowIntegrityAlert(true);
  };

  // Anti-cheat Window Blur / Tab Switch detection
  useEffect(() => {
    if (!exam.proctoringEnabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        recordViolation('Tab switch or minimized browser window detected.');
      }
    };

    const handleWindowBlur = () => {
      recordViolation('Browser window lost active focus.');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleWindowBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [answers, exam.proctoringEnabled, submission.id]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) {
      handleFinalSubmit();
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinalSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft]);

  // Periodic Auto-Save
  useEffect(() => {
    autoSaveTimerRef.current = setInterval(() => {
      examService.saveDraftAnswer(submission.id, answers, tabSwitches);
      setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 15000);

    return () => {
      if (autoSaveTimerRef.current) clearInterval(autoSaveTimerRef.current);
    };
  }, [answers, submission.id, tabSwitches]);

  const currentQ = questions[currentIdx] || null;

  // Attempt Rules Computation (e.g. out of 110 question candidate can appear only in 100 questions)
  const maxAttemptsAllowed =
    exam.maxQuestionsToAttempt && exam.maxQuestionsToAttempt > 0
      ? exam.maxQuestionsToAttempt
      : questions.length;

  const compulsoryQuestions = questions.filter((q) => Boolean(q.isMandatory));
  const compulsoryTotalCount = compulsoryQuestions.length;

  const answeredCount = questions.filter((q) => Boolean(answers[q.id]?.answer?.trim())).length;
  const flaggedCount = questions.filter((q) => Boolean(answers[q.id]?.isFlagged)).length;
  const isAtMaxAttempts = answeredCount >= maxAttemptsAllowed;
  const compulsoryAnsweredCount = compulsoryQuestions.filter((q) => Boolean(answers[q.id]?.answer?.trim())).length;
  const unattemptedCompulsory = compulsoryQuestions.filter((q) => !answers[q.id]?.answer?.trim());

  const handleAnswerChange = (val: string) => {
    if (!currentQ) return;
    const currentVal = answers[currentQ.id]?.answer?.trim() || '';
    const nextVal = val?.trim() || '';

    // Enforce max attempts: if candidate tries to answer a new question when max limit is already reached
    if (!currentVal && nextVal && answeredCount >= maxAttemptsAllowed) {
      setAttemptNotice(
        `Attempt Limit Reached (${maxAttemptsAllowed}/${maxAttemptsAllowed}): You can appear in at most ${maxAttemptsAllowed} out of ${questions.length} questions. Please deselect or clear an answer on another optional question if you wish to attempt this one.`
      );
      setTimeout(() => setAttemptNotice(null), 6000);
      return;
    }

    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        answer: val,
      },
    }));
  };

  const handleToggleFlag = () => {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        isFlagged: !prev[currentQ.id]?.isFlagged,
      },
    }));
  };

  const handleClearAnswer = () => {
    if (!currentQ) return;
    setAnswers((prev) => ({
      ...prev,
      [currentQ.id]: {
        ...prev[currentQ.id],
        answer: currentQ.type === 'code' ? currentQ.starterCode || '' : '',
      },
    }));
  };

  // --- Live In-Browser Code Sandbox Runner ---
  const handleRunCode = (code: string) => {
    if (!currentQ) return;
    setIsRunningCode(true);
    const logs: LogEntry[] = [];
    const startTime = performance.now();

    try {
      const customConsole = {
        log: (...args: any[]) => {
          logs.push({
            type: 'log',
            text: args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          });
        },
        info: (...args: any[]) => {
          logs.push({
            type: 'info',
            text: args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          });
        },
        warn: (...args: any[]) => {
          logs.push({
            type: 'warn',
            text: args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          });
        },
        error: (...args: any[]) => {
          logs.push({
            type: 'error',
            text: args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '),
            time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          });
        },
      };

      // Wrap in sandbox function
      const runner = new Function('console', `
        "use strict";
        try {
          ${code}
        } catch(err) {
          console.error(err.message || String(err));
        }
      `);

      const res = runner(customConsole);
      if (res !== undefined) {
        logs.push({
          type: 'result',
          text: `[Output Return]: ${typeof res === 'object' ? JSON.stringify(res, null, 2) : String(res)}`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      }

      if (logs.length === 0) {
        logs.push({
          type: 'info',
          text: 'Code executed successfully without any console output.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        });
      }
    } catch (err: any) {
      logs.push({
        type: 'error',
        text: `Execution / Syntax Error: ${err?.message || String(err)}`,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      });
    } finally {
      const duration = Math.round(performance.now() - startTime);
      setRunDuration(duration);
      setCodeLogs((prev) => ({ ...prev, [currentQ.id]: logs }));
      setIsRunningCode(false);
    }
  };

  const handleClearTerminal = () => {
    if (!currentQ) return;
    setCodeLogs((prev) => ({ ...prev, [currentQ.id]: [] }));
    setRunDuration(null);
  };

  const handleFinalSubmit = async () => {
    try {
      setSubmitting(true);
      const updatedSub = await examService.submitExam(
        submission.id,
        answers,
        exam,
        questions,
        tabSwitches
      );

      // Trigger Confetti!
      try {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      } catch {
        // Safe fallback
      }

      // Exit fullscreen gracefully upon submission
      if (document.fullscreenElement) {
        document.exitFullscreen().catch(() => {});
      }

      onFinish(updatedSub);
    } catch (err: any) {
      console.error(err);
      alert('Error submitting exam: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const formatTimer = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const activeLogs = currentQ ? codeLogs[currentQ.id] || [] : [];

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-100 dark:bg-slate-900 flex flex-col overflow-hidden animate-in fade-in select-none"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Clipboard / Anti-cheat Warning Toast */}
      {clipboardNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-70 bg-rose-600 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xl flex items-center space-x-2 animate-in fade-in slide-in-from-top-4">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{clipboardNotice}</span>
        </div>
      )}

      {/* Attempt Limit Warning Toast */}
      {attemptNotice && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-70 bg-amber-600 text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-2xl flex items-center space-x-2.5 animate-in fade-in slide-in-from-top-4 max-w-xl border border-amber-300">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-200" />
          <span className="leading-snug">{attemptNotice}</span>
        </div>
      )}

      {/* Top Proctored Header */}
      <header className="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 flex items-center justify-between shrink-0 shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
            EF
          </div>
          <div>
            <div className="font-extrabold text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-1">
              {exam.title}
            </div>
            <div className="text-[11px] text-slate-500 flex items-center space-x-2">
              <span>Candidate: {submission.participantName}</span>
              <span>•</span>
              <span>Auto-saved: {lastSaved}</span>
              {exam.proctoringEnabled && (
                <>
                  <span>•</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                    <Maximize2 className="w-3 h-3" />
                    <span>Fullscreen Locked</span>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Center: Live Timer & Strikes */}
        <div className="flex items-center space-x-4">
          {tabSwitches > 0 && (
            <div className="hidden sm:flex items-center space-x-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-bold">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{tabSwitches} Violation Strike{tabSwitches > 1 ? 's' : ''}</span>
            </div>
          )}

          <div
            className={`flex items-center space-x-2 px-4 py-1.5 rounded-full font-mono text-sm font-bold border transition-colors ${
              timeLeft < 300
                ? 'bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/60 dark:text-rose-300 animate-pulse'
                : timeLeft < 600
                ? 'bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300'
                : 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>{formatTimer(timeLeft)}</span>
          </div>
        </div>

        {/* Right: Submit Button */}
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => setSubmitConfirmOpen(true)}
            className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-900/20 transition-all cursor-pointer"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Finish & Submit</span>
          </button>
        </div>
      </header>

      {/* Main Examination Viewport */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left / Center Area: Question Canvas */}
        <main className="flex-1 p-6 overflow-y-auto max-w-4xl mx-auto w-full flex flex-col justify-between">
          {currentQ ? (
            <div className="space-y-6">
              {/* Candidate Attempt Regulation Banner (e.g. out of 110 question candidate can appear only in 100 questions) */}
              {exam.maxQuestionsToAttempt && exam.maxQuestionsToAttempt < questions.length && (
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-indigo-50/90 via-purple-50/70 to-indigo-50/90 dark:from-indigo-950/50 dark:via-purple-950/40 dark:to-indigo-950/50 border border-indigo-200 dark:border-indigo-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-extrabold text-[10px] uppercase tracking-wider">
                        Attempt Policy
                      </span>
                      <span className="font-bold text-slate-800 dark:text-slate-100">
                        Appear in maximum <strong className="text-indigo-600 dark:text-indigo-400">{maxAttemptsAllowed}</strong> of <strong className="text-slate-600 dark:text-slate-300">{questions.length}</strong> questions
                      </span>
                    </div>
                    {compulsoryTotalCount > 0 && (
                      <p className="text-[11px] text-amber-900 dark:text-amber-300 font-medium flex items-center space-x-1">
                        <Star className="w-3 h-3 fill-current text-amber-500 shrink-0" />
                        <span>
                          {compulsoryTotalCount} selective question{compulsoryTotalCount > 1 ? 's are' : ' is'} <strong>Compulsory (Must Attend)</strong> • {compulsoryAnsweredCount}/{compulsoryTotalCount} attended
                        </span>
                      </p>
                    )}
                  </div>

                  <div className="flex items-center space-x-3 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Candidate Attempted</span>
                      <span className={`font-mono text-xs font-black ${isAtMaxAttempts ? 'text-amber-600 dark:text-amber-400' : 'text-indigo-600 dark:text-indigo-400'}`}>
                        {answeredCount} / {maxAttemptsAllowed}
                      </span>
                    </div>
                    <div className="w-20 sm:w-28 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          isAtMaxAttempts ? 'bg-amber-500' : 'bg-indigo-600'
                        }`}
                        style={{ width: `${Math.min(100, Math.round((answeredCount / maxAttemptsAllowed) * 100))}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Question Number & Points Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center space-x-3">
                  <span className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-extrabold text-sm flex items-center justify-center">
                    {currentIdx + 1}
                  </span>
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Question {currentIdx + 1} of {questions.length}
                      </span>
                      <span className="text-xs text-slate-400">({currentQ.type.toUpperCase()})</span>
                      {currentQ.isMandatory ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center space-x-1 animate-pulse">
                          <Star className="w-3 h-3 fill-current text-amber-500" />
                          <span>Compulsory (Must Attend)</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          Elective (Optional)
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 px-2.5 py-1 rounded-lg border border-indigo-200 dark:border-indigo-800">
                    {currentQ.marks} Marks
                  </span>
                  <button
                    type="button"
                    onClick={handleToggleFlag}
                    className={`flex items-center space-x-1 px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                      answers[currentQ.id]?.isFlagged
                        ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200'
                        : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100'
                    }`}
                  >
                    <Flag className="w-3.5 h-3.5" />
                    <span>{answers[currentQ.id]?.isFlagged ? 'Flagged' : 'Flag for Review'}</span>
                  </button>
                </div>
              </div>

              {/* Question Statement */}
              <div className="text-sm sm:text-base font-semibold text-slate-900 dark:text-white leading-relaxed">
                {currentQ.title}
              </div>

              {/* Input Workspace based on question type */}
              <div className="pt-2">
                {/* MCQ Options */}
                {currentQ.type === 'mcq' && currentQ.options && (
                  <div className="space-y-3">
                    {currentQ.options.map((option, i) => {
                      const isSelected = answers[currentQ.id]?.answer === option;
                      return (
                        <div
                          key={i}
                          onClick={() => handleAnswerChange(isSelected ? '' : option)}
                          className={`p-4 rounded-2xl border text-xs sm:text-sm font-medium cursor-pointer transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-indigo-50/80 border-indigo-600 text-indigo-950 dark:bg-indigo-950/60 dark:text-indigo-200 dark:border-indigo-500 shadow-sm font-semibold'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-750'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            <span
                              className={`w-6 h-6 rounded-full border flex items-center justify-center text-xs font-bold ${
                                isSelected
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-slate-300 text-slate-500'
                              }`}
                            >
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span>{option}</span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-5 h-5 text-indigo-600" />}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Boolean Options */}
                {currentQ.type === 'boolean' && (
                  <div className="grid grid-cols-2 gap-4">
                    {['True', 'False'].map((val) => {
                      const isSelected = answers[currentQ.id]?.answer === val;
                      return (
                        <button
                          key={val}
                          type="button"
                          onClick={() => handleAnswerChange(isSelected ? '' : val)}
                          className={`p-5 rounded-2xl border text-sm font-bold transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-600 shadow-md'
                              : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          {val}
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Subjective Essay */}
                {currentQ.type === 'subjective' && (
                  <div className="space-y-2">
                    <textarea
                      rows={8}
                      placeholder="Type your comprehensive structured answer here..."
                      value={answers[currentQ.id]?.answer || ''}
                      onChange={(e) => handleAnswerChange(e.target.value)}
                      className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs sm:text-sm text-slate-900 dark:text-white focus:outline-hidden focus:ring-2 focus:ring-indigo-500 leading-relaxed font-sans shadow-xs"
                    />
                    <div className="flex justify-between text-[11px] text-slate-400">
                      <span>Rich academic response field (Copy/Paste disabled)</span>
                      <span>
                        {(answers[currentQ.id]?.answer || '').trim().split(/\s+/).filter(Boolean).length} words
                      </span>
                    </div>
                  </div>
                )}

                {/* Live In-Browser Code Sandbox */}
                {currentQ.type === 'code' && (
                  <div className="space-y-4">
                    {/* Sandbox Controls Bar */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-slate-700 text-xs">
                      <div className="flex items-center space-x-2 text-indigo-300 font-mono">
                        <Code2 className="w-4 h-4 text-emerald-400" />
                        <span className="font-bold">Interactive Sandbox Environment</span>
                        <span className="text-[10px] text-slate-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-700">JavaScript / Logic</span>
                      </div>

                      <div className="flex items-center space-x-2">
                        {currentQ.starterCode && (
                          <button
                            type="button"
                            onClick={() => handleAnswerChange(currentQ.starterCode || '')}
                            className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-slate-300 hover:text-white bg-slate-700 hover:bg-slate-650 transition-colors text-[11px]"
                          >
                            <RotateCcw className="w-3 h-3" />
                            <span>Reset Starter Code</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={isRunningCode}
                          onClick={() => handleRunCode(answers[currentQ.id]?.answer || '')}
                          className="flex items-center space-x-1.5 px-4 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950 transition-all disabled:opacity-50 cursor-pointer"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{isRunningCode ? 'Executing...' : 'Run & Test Code'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Code Editor */}
                    <div className="relative">
                      <textarea
                        rows={11}
                        placeholder="// Write your code solution here and click 'Run & Test Code' below..."
                        value={answers[currentQ.id]?.answer || ''}
                        onChange={(e) => handleAnswerChange(e.target.value)}
                        className="w-full p-4 rounded-2xl border border-slate-700 bg-slate-950 text-emerald-400 font-mono text-xs focus:outline-hidden focus:ring-2 focus:ring-emerald-500 shadow-inner leading-relaxed"
                        spellCheck={false}
                      />
                    </div>

                    {/* Integrated Live Terminal Window */}
                    <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
                      <div className="px-4 py-2.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs">
                        <div className="flex items-center space-x-2">
                          <div className="flex space-x-1.5">
                            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
                            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
                            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
                          </div>
                          <span className="text-slate-400 font-mono text-[11px] ml-2 flex items-center space-x-1">
                            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
                            <span>Sandbox Terminal Output</span>
                          </span>
                        </div>

                        <div className="flex items-center space-x-3">
                          {runDuration !== null && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              Execution: <span className="text-emerald-400 font-semibold">{runDuration}ms</span>
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={handleClearTerminal}
                            className="text-slate-400 hover:text-slate-200 flex items-center space-x-1 text-[11px]"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Clear</span>
                          </button>
                        </div>
                      </div>

                      <div className="p-4 max-h-48 overflow-y-auto font-mono text-xs space-y-1.5">
                        {activeLogs.length === 0 ? (
                          <div className="text-slate-500 text-[11px] italic py-3 text-center">
                            Press "Run & Test Code" to execute code and view real-time console logs, results, or syntax errors.
                          </div>
                        ) : (
                          activeLogs.map((log, lIdx) => (
                            <div
                              key={lIdx}
                              className={`flex items-start space-x-2 text-[11px] leading-relaxed ${
                                log.type === 'error'
                                  ? 'text-rose-400 font-semibold'
                                  : log.type === 'warn'
                                  ? 'text-amber-400'
                                  : log.type === 'result'
                                  ? 'text-cyan-300 font-bold'
                                  : 'text-emerald-400'
                              }`}
                            >
                              <span className="text-slate-600 select-none text-[10px] shrink-0 font-mono">
                                [{log.time}]
                              </span>
                              <span className="whitespace-pre-wrap">{log.text}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Bottom Navigation Toolbar */}
              <div className="flex items-center justify-between pt-6 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleClearAnswer}
                  className="text-xs text-slate-500 hover:text-rose-600 transition-colors"
                >
                  Clear Selection
                </button>

                <div className="flex items-center space-x-3">
                  <button
                    type="button"
                    disabled={currentIdx === 0}
                    onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                    className="flex items-center space-x-1 px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs font-semibold disabled:opacity-40 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Previous</span>
                  </button>

                  <button
                    type="button"
                    disabled={currentIdx === questions.length - 1}
                    onClick={() => setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))}
                    className="flex items-center space-x-1 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-40 shadow-xs cursor-pointer"
                  >
                    <span>Next Question</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-20 text-slate-400">Loading exam question...</div>
          )}
        </main>

        {/* Right Rail: Questions Palette Grid */}
        <aside className="w-76 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-4 hidden md:flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Question Palette
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 font-bold">
                  {answeredCount} / {maxAttemptsAllowed} Used
                </span>
              </div>
              <p className="text-[11px] text-slate-500">Jump directly to any assessment item</p>
            </div>

            {/* Quick Filter Tabs */}
            <div className="flex flex-wrap gap-1 p-1 bg-slate-100 dark:bg-slate-750 rounded-xl text-[11px]">
              <button
                type="button"
                onClick={() => setPaletteFilter('all')}
                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  paletteFilter === 'all'
                    ? 'bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                All ({questions.length})
              </button>
              {compulsoryTotalCount > 0 && (
                <button
                  type="button"
                  onClick={() => setPaletteFilter('compulsory')}
                  className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                    paletteFilter === 'compulsory'
                      ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 shadow-2xs'
                      : 'text-amber-700 dark:text-amber-400 hover:text-amber-900'
                  }`}
                >
                  <Star className="w-2.5 h-2.5 fill-current" />
                  <span>Compulsory ({compulsoryTotalCount})</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setPaletteFilter('answered')}
                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  paletteFilter === 'answered'
                    ? 'bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Done ({answeredCount})
              </button>
              <button
                type="button"
                onClick={() => setPaletteFilter('flagged')}
                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  paletteFilter === 'flagged'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                Flagged ({flaggedCount})
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-4 gap-2">
              {questions.map((q, idx) => {
                const isCurrent = idx === currentIdx;
                const isAnswered = Boolean(answers[q.id]?.answer?.trim());
                const isFlagged = Boolean(answers[q.id]?.isFlagged);
                const isMandatory = Boolean(q.isMandatory);

                // Filter check
                if (paletteFilter === 'compulsory' && !isMandatory) return null;
                if (paletteFilter === 'answered' && !isAnswered) return null;
                if (paletteFilter === 'unanswered' && isAnswered) return null;
                if (paletteFilter === 'flagged' && !isFlagged) return null;

                let bgClasses = 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300';
                if (isAnswered) {
                  bgClasses = 'bg-emerald-500 text-white font-bold shadow-xs';
                }
                if (isFlagged) {
                  bgClasses = 'bg-amber-500 text-white font-bold';
                }

                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => setCurrentIdx(idx)}
                    title={`Question ${idx + 1}${isMandatory ? ' (Compulsory / Must Attend)' : ' (Elective)'}${isAnswered ? ' - Answered' : ' - Unanswered'}`}
                    className={`h-10 rounded-xl text-xs font-bold transition-all relative cursor-pointer ${bgClasses} ${
                      isCurrent ? 'ring-2 ring-indigo-500 ring-offset-2' : ''
                    } ${isMandatory && !isAnswered ? 'border-2 border-amber-400 dark:border-amber-500' : ''}`}
                  >
                    {idx + 1}
                    {isMandatory && (
                      <span className="absolute top-0.5 left-1 text-[9px] text-amber-300 font-black">
                        ★
                      </span>
                    )}
                    {isFlagged && (
                      <span className="w-2 h-2 rounded-full bg-amber-200 absolute top-1 right-1" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="space-y-2 text-xs pt-3 border-t border-slate-100 dark:border-slate-700">
              {compulsoryTotalCount > 0 && (
                <div className="p-2 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-900 dark:text-amber-200 flex items-center justify-between">
                  <span className="flex items-center space-x-1.5 font-bold">
                    <Star className="w-3.5 h-3.5 fill-current text-amber-500" />
                    <span>Compulsory:</span>
                  </span>
                  <span className="font-mono font-bold">
                    {compulsoryAnsweredCount} / {compulsoryTotalCount} Attended
                  </span>
                </div>
              )}

              {exam.maxQuestionsToAttempt && exam.maxQuestionsToAttempt < questions.length && (
                <div className="p-2 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 text-[11px] text-indigo-950 dark:text-indigo-200 flex items-center justify-between">
                  <span className="font-bold">Max Attempt Rule:</span>
                  <span className="font-mono font-bold">
                    {answeredCount} / {maxAttemptsAllowed}
                  </span>
                </div>
              )}

              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                <span className="w-3 h-3 rounded bg-emerald-500 shrink-0" />
                <span>Answered ({answeredCount})</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                <span className="w-3 h-3 rounded bg-amber-500 shrink-0" />
                <span>Flagged for Review ({flaggedCount})</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                <span className="w-3 h-3 rounded bg-slate-200 dark:bg-slate-700 shrink-0" />
                <span>Unanswered ({questions.length - answeredCount})</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setSubmitConfirmOpen(true)}
              className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
            >
              Submit Examination
            </button>
          </div>
        </aside>
      </div>

      {/* Mandatory Fullscreen Entry Gate */}
      {showFullscreenGate && !isFullscreen && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-950/90 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-5 border border-indigo-500/40 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
              <Maximize2 className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Mandatory Fullscreen Security Lockdown
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-2 leading-relaxed">
                To guarantee assessment integrity, this examination operates exclusively in Fullscreen Mode. Exiting full-screen, pressing Escape, or switching windows will automatically increment proctoring violation strikes.
              </p>
            </div>
            <button
              type="button"
              onClick={requestFullscreenLock}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/30 transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <Maximize2 className="w-4 h-4" />
              <span>Enter Fullscreen & Begin Assessment</span>
            </button>
          </div>
        </div>
      )}

      {/* Integrity Alert Modal (Proctoring Violation / Fullscreen Exit) */}
      {showIntegrityAlert && (
        <div className="fixed inset-0 z-80 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-md w-full p-6 text-center space-y-4 border border-rose-400 dark:border-rose-800 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-950 text-rose-600 dark:text-rose-400 flex items-center justify-center mx-auto">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Proctoring Integrity Warning
              </h3>
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-200 mt-2 text-left">
                <span className="font-bold">Incident Reason: </span>
                <span>{integrityReason}</span>
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-3 leading-relaxed">
                This event has been permanently appended to your official submission audit log. Total recorded violation strikes: <span className="font-bold text-rose-600 text-sm">{tabSwitches}</span>.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setShowIntegrityAlert(false);
                if (!document.fullscreenElement) {
                  requestFullscreenLock();
                }
              }}
              className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold transition-all shadow-md shadow-rose-900/30 cursor-pointer"
            >
              I Acknowledge & Return to Fullscreen
            </button>
          </div>
        </div>
      )}

      {/* Submit Confirmation Modal */}
      {submitConfirmOpen && (
        <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="flex items-center space-x-3">
              <span className="p-2.5 rounded-xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <FileCheck className="w-5 h-5" />
              </span>
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Confirm Final Exam Submission
                </h3>
                <p className="text-xs text-slate-500">Review your test progress & attempt rules before submitting</p>
              </div>
            </div>

            {/* Incomplete Compulsory Alert */}
            {unattemptedCompulsory.length > 0 && (
              <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center space-x-2 font-bold">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>Compulsory Question Attendance Requirement</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  You have <strong>{unattemptedCompulsory.length}</strong> unattempted Compulsory (Must Attend) question{unattemptedCompulsory.length > 1 ? 's' : ''}:{' '}
                  <span className="font-mono font-bold">
                    {unattemptedCompulsory.map((q) => `Q${questions.findIndex((x) => x.id === q.id) + 1}`).join(', ')}
                  </span>
                  . Candidates are required to attend all compulsory questions before submitting.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    const firstIdx = questions.findIndex((x) => x.id === unattemptedCompulsory[0].id);
                    if (firstIdx !== -1) setCurrentIdx(firstIdx);
                    setSubmitConfirmOpen(false);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shadow-xs cursor-pointer flex items-center space-x-1"
                >
                  <span>Jump to Unattended Compulsory Question (Q{questions.findIndex((x) => x.id === unattemptedCompulsory[0].id) + 1})</span>
                </button>
              </div>
            )}

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-750 border border-slate-200 dark:border-slate-700 space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Total Paper Questions:</span>
                <span className="font-bold text-slate-800 dark:text-slate-200">{questions.length} Questions</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Max Permitted Attempt:</span>
                <span className="font-bold text-indigo-600 dark:text-indigo-400">
                  {maxAttemptsAllowed} {maxAttemptsAllowed < questions.length ? `(Out of ${questions.length})` : 'Questions'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Candidate Answered:</span>
                <span className={`font-bold ${isAtMaxAttempts ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
                  {answeredCount} of {maxAttemptsAllowed} max allowed
                </span>
              </div>
              {compulsoryTotalCount > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Compulsory (Must Attend):</span>
                  <span className={`font-bold ${unattemptedCompulsory.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600'}`}>
                    {compulsoryAnsweredCount} of {compulsoryTotalCount} attended {unattemptedCompulsory.length > 0 ? `(${unattemptedCompulsory.length} pending)` : '✓'}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-500">Flagged for Review:</span>
                <span className="font-bold text-amber-600">{flaggedCount}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Proctoring Strikes:</span>
                <span className={`font-bold ${tabSwitches > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                  {tabSwitches} strike{tabSwitches !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Once submitted, your answers will be locked and routed for objective auto-scoring and manual evaluation.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setSubmitConfirmOpen(false)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50"
              >
                Back to Exam
              </button>
              <button
                type="button"
                onClick={handleFinalSubmit}
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
              >
                {submitting ? 'Submitting...' : 'Yes, Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
