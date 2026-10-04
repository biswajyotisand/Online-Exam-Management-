import React, { useState } from 'react';
import { Exam, UserProfile } from '../../types/exam';
import {
  X,
  Printer,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Calendar,
  Clock,
  IdCard,
  User,
  GraduationCap,
  Building,
  Award,
  AlertCircle,
  QrCode,
  FileText
} from 'lucide-react';

interface AdmitCardModalProps {
  isOpen: boolean;
  exam: Exam | null;
  candidates: UserProfile[];
  initialCandidateId?: string;
  onClose: () => void;
}

export const AdmitCardModal: React.FC<AdmitCardModalProps> = ({
  isOpen,
  exam,
  candidates,
  initialCandidateId,
  onClose,
}) => {
  const [selectedUid, setSelectedUid] = useState<string>(
    initialCandidateId || (candidates.length > 0 ? candidates[0].uid : '')
  );
  const [printAllMode, setPrintAllMode] = useState<boolean>(false);

  // Sync if initialCandidateId changes
  React.useEffect(() => {
    if (initialCandidateId) {
      setSelectedUid(initialCandidateId);
    } else if (candidates.length > 0 && !selectedUid) {
      setSelectedUid(candidates[0].uid);
    }
  }, [initialCandidateId, candidates]);

  if (!isOpen || !exam) return null;

  const currentIndex = candidates.findIndex((c) => c.uid === selectedUid);
  const currentCandidate = candidates[currentIndex] || candidates[0];

  const handleNext = () => {
    if (currentIndex < candidates.length - 1) {
      setSelectedUid(candidates[currentIndex + 1].uid);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setSelectedUid(candidates[currentIndex - 1].uid);
    }
  };

  const handlePrint = (all: boolean = false) => {
    setPrintAllMode(all);
    setTimeout(() => {
      window.print();
    }, 150);
  };

  const renderSingleAdmitCard = (cand: UserProfile, isBatch: boolean = false) => {
    const cardId = `ADM-${exam.id.slice(-4).toUpperCase()}-${cand.employeeId || cand.uid.slice(-4).toUpperCase()}`;
    const startTimeFormatted = exam.scheduledStartTime
      ? new Date(exam.scheduledStartTime).toLocaleString([], {
          dateStyle: 'full',
          timeStyle: 'short',
        })
      : 'Date & Time to be notified';
    const reportingTimeFormatted = exam.scheduledStartTime
      ? new Date(new Date(exam.scheduledStartTime).getTime() - 30 * 60000).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })
      : '30 mins before start';

    return (
      <div
        key={cand.uid}
        className={`bg-white text-slate-900 border-2 border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl max-w-2xl mx-auto my-4 print:my-0 print:border-2 print:border-black print:rounded-xl print:shadow-none print:max-w-none print:w-full ${
          isBatch ? 'break-after-page mb-8 print:mb-0' : ''
        }`}
      >
        {/* Institutional Header */}
        <div className="border-b-2 border-slate-800 pb-4 text-center space-y-1 relative">
          <div className="flex items-center justify-center space-x-2 text-indigo-900 font-extrabold uppercase tracking-wider text-xs">
            <GraduationCap className="w-5 h-5 text-indigo-700" />
            <span>INSTITUTIONAL EXAMINATION BOARD & ASSESSMENT CONTROLLER</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
            Official Examination Admit Card
          </h1>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-widest">
            Hall Ticket / Authorization Slip • Computer-Based Examination (CBT)
          </p>

          <div className="absolute right-0 top-0 hidden sm:block">
            <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
              <ShieldCheck className="w-3 h-3 text-emerald-700" />
              <span>VERIFIED & AUTHORIZED</span>
            </span>
          </div>
        </div>

        {/* Top Info Bar */}
        <div className="flex flex-wrap items-center justify-between py-3 border-b border-slate-200 text-xs gap-2">
          <div>
            <span className="text-slate-500 font-medium">Admit Card No: </span>
            <span className="font-mono font-extrabold text-indigo-900">{cardId}</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Academic Session: </span>
            <span className="font-bold text-slate-800">2026 - 2027</span>
          </div>
          <div>
            <span className="text-slate-500 font-medium">Proctoring Mode: </span>
            <span className="font-bold text-indigo-700">Online Full-Screen Monitored</span>
          </div>
        </div>

        {/* Candidate & Exam Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 py-5 border-b border-slate-200">
          {/* Candidate Details */}
          <div className="sm:col-span-2 space-y-2.5 text-xs">
            <h3 className="text-[11px] font-black uppercase text-indigo-900 tracking-wider flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-indigo-700" />
              <span>Candidate Identification</span>
            </h3>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Candidate Name</span>
                <span className="font-bold text-slate-900 text-sm">{cand.displayName}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Employee / Roll ID</span>
                <span className="font-mono font-bold text-indigo-900 text-sm bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 inline-block">
                  {cand.employeeId || 'EMP-UNASSIGNED'}
                </span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Registered Email</span>
                <span className="text-slate-700 font-medium">{cand.email}</span>
              </div>

              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Department / Unit</span>
                <span className="text-slate-700 font-medium">{cand.department || 'General Assessment'}</span>
              </div>
            </div>
          </div>

          {/* Photo & Barcode Placeholder */}
          <div className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50 text-center">
            {cand.photoURL ? (
              <img
                src={cand.photoURL}
                alt={cand.displayName}
                className="w-20 h-20 rounded-xl object-cover border border-slate-300 mb-1"
              />
            ) : (
              <div className="w-16 h-16 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center font-bold text-xl mb-1 border border-slate-300">
                {cand.displayName.charAt(0).toUpperCase()}
              </div>
            )}
            <span className="text-[9px] uppercase font-bold text-slate-400 tracking-wider">Candidate Photo</span>

            {/* Faux Barcode */}
            <div className="mt-2 w-full pt-1.5 border-t border-slate-200 flex flex-col items-center">
              <div className="flex items-center space-x-0.5 h-6">
                {[4, 2, 5, 1, 3, 2, 4, 1, 5, 2, 3, 4, 2, 1, 4, 3, 2, 5].map((w, idx) => (
                  <span
                    key={idx}
                    className="bg-slate-800"
                    style={{ width: `${w}px`, height: '100%' }}
                  />
                ))}
              </div>
              <span className="font-mono text-[8px] text-slate-500 tracking-widest mt-0.5">{cardId}</span>
            </div>
          </div>
        </div>

        {/* Examination Schedule Details */}
        <div className="py-4 border-b border-slate-200 space-y-2 text-xs">
          <h3 className="text-[11px] font-black uppercase text-indigo-900 tracking-wider flex items-center space-x-1.5">
            <Award className="w-3.5 h-3.5 text-indigo-700" />
            <span>Examination Schedule & Paper Specifications</span>
          </h3>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Examination Title</span>
              <span className="font-bold text-slate-900">{exam.title}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Subject / Syllabus</span>
              <span className="font-semibold text-slate-800">{exam.subject}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Paper Setter</span>
              <span className="font-medium text-slate-700">{exam.setterName}</span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Marks Benchmark</span>
              <span className="font-semibold text-slate-800">
                {exam.totalMarks} Marks (Pass: {exam.passingMarks})
              </span>
            </div>

            <div className="col-span-2">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Scheduled Date & Time</span>
              <span className="font-bold text-indigo-900 flex items-center space-x-1 mt-0.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>{startTimeFormatted}</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Duration</span>
              <span className="font-bold text-slate-800 flex items-center space-x-1 mt-0.5">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>{exam.durationMinutes} Minutes</span>
              </span>
            </div>

            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block">Reporting Time</span>
              <span className="font-bold text-amber-800">{reportingTimeFormatted}</span>
            </div>
          </div>
        </div>

        {/* Candidate Rules & Instructions */}
        <div className="py-4 border-b border-slate-200 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
          <span className="font-bold uppercase text-[10px] text-slate-800 block">
            Mandatory Instructions for the Candidate:
          </span>
          <ol className="list-decimal list-inside space-y-0.5 text-[10px] text-slate-600">
            <li>Candidates must present this official Admit Card along with institutional photo ID for entry/access.</li>
            <li>Examination will begin precisely at the scheduled date and time. Late entry is not permitted.</li>
            <li>Tab switching, browser minimizing, or background multi-tasking is tracked and recorded as an anti-malpractice strike.</li>
            <li>Do not refresh or close the browser window while an active examination attempt is in progress.</li>
            <li>Ensure all required questions are answered before submitting. Unanswered questions will receive zero marks.</li>
          </ol>
        </div>

        {/* Signatures & Seal */}
        <div className="pt-6 grid grid-cols-2 gap-8 items-end">
          <div className="text-center space-y-1">
            <div className="h-9 border-b border-dashed border-slate-400 mx-auto w-40" />
            <span className="text-[10px] uppercase font-bold text-slate-500 block">Candidate Signature</span>
            <span className="text-[9px] text-slate-400 block">(To be signed during assessment)</span>
          </div>

          <div className="text-center space-y-1">
            <div className="h-9 flex items-center justify-center mx-auto w-44">
              <span className="font-serif italic font-extrabold text-indigo-900 text-sm tracking-wide">
                
              </span>
            </div>
            <div className="border-b-2 border-slate-800 mx-auto w-44" />
            <span className="text-[10px] uppercase font-black text-slate-800 block">
              Controlling Officer
            </span>
            <span className="text-[9px] font-mono text-emerald-700 font-semibold block">
              
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in overflow-y-auto print:p-0 print:bg-white print:static print:overflow-visible">
      <div className="bg-slate-100 dark:bg-slate-900 rounded-3xl max-w-4xl w-full shadow-2xl border border-slate-300 dark:border-slate-800 my-8 overflow-hidden print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:bg-white">
        {/* Top Control Bar (Hidden during printing) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 gap-3 print:hidden">
          <div className="flex items-center space-x-3">
            <span className="p-2.5 rounded-2xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
              <IdCard className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <span>Admit Card Generation & Verification</span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-200">
                  {candidates.length} Enrolled
                </span>
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Examination: <span className="font-semibold text-slate-700 dark:text-slate-300">{exam.title}</span> ({exam.subject})
              </p>
            </div>
          </div>

          {/* Action Buttons & Candidate Navigator */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Candidate Selector */}
            {candidates.length > 1 && !printAllMode && (
              <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={handlePrev}
                  disabled={currentIndex <= 0}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-30 cursor-pointer"
                  title="Previous Candidate"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={selectedUid}
                  onChange={(e) => setSelectedUid(e.target.value)}
                  className="px-2 py-1 font-semibold text-xs rounded-lg bg-transparent text-slate-800 dark:text-white border-none focus:ring-0 max-w-[150px] truncate"
                >
                  {candidates.map((c, i) => (
                    <option key={c.uid} value={c.uid}>
                      {i + 1}. {c.displayName} ({c.employeeId || 'ID'})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleNext}
                  disabled={currentIndex >= candidates.length - 1}
                  className="p-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-600 disabled:opacity-30 cursor-pointer"
                  title="Next Candidate"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Print Current Admit Card */}
            <button
              type="button"
              onClick={() => handlePrint(false)}
              className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print This Admit Card</span>
            </button>

            {/* Batch Print All Cards */}
            {candidates.length > 1 && (
              <button
                type="button"
                onClick={() => handlePrint(true)}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs shadow-xs transition-all cursor-pointer"
                title="Print Admit Cards for all enrolled candidates in one click"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Print All ({candidates.length})</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Admit Card Sheet Body */}
        <div className="p-4 sm:p-6 overflow-y-auto max-h-[80vh] print:max-h-none print:p-0 print:overflow-visible">
          {candidates.length === 0 ? (
            <div className="p-12 text-center bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 space-y-3">
              <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
                No Candidates Enrolled for this Examination
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Please enroll candidates to this examination from the Participants Section or Role Allocations modal to generate their official admit cards.
              </p>
            </div>
          ) : printAllMode ? (
            <div>{candidates.map((c) => renderSingleAdmitCard(c, true))}</div>
          ) : currentCandidate ? (
            renderSingleAdmitCard(currentCandidate, false)
          ) : null}
        </div>
      </div>
    </div>
  );
};
