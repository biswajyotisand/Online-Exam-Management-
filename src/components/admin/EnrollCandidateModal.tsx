import React, { useState, useEffect } from 'react';
import { Exam } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  GraduationCap,
  X,
  User,
  IdCard,
  Lock,
  Mail,
  Building,
  Sparkles,
  Eye,
  EyeOff,
  Copy,
  Check,
  FileSpreadsheet,
  AlertCircle,
  BookOpen,
  KeyRound,
  ShieldCheck
} from 'lucide-react';

interface EnrollCandidateModalProps {
  isOpen: boolean;
  exams: Exam[];
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const EnrollCandidateModal: React.FC<EnrollCandidateModalProps> = ({
  isOpen,
  exams,
  onClose,
  onSuccess,
}) => {
  const [tab, setTab] = useState<'single' | 'bulk'>('single');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Single candidate state
  const [name, setName] = useState('');
  const [empId, setEmpId] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [selectedExamId, setSelectedExamId] = useState(exams[0]?.id || '');
  const [defaultPassword, setDefaultPassword] = useState('Candidate@2026');

  // Bulk enrollment state
  const [bulkText, setBulkText] = useState(
    'Alex Morgan, EMP-2001, alex.morgan@acme.org, Engineering\nSophia Chen, EMP-2002, sophia.chen@acme.org, Product Design\nMarcus Vance, EMP-2003, marcus.vance@acme.org, Operations'
  );
  const [bulkExamId, setBulkExamId] = useState(exams[0]?.id || '');
  const [bulkDefaultPassword, setBulkDefaultPassword] = useState('Candidate@2026');

  useEffect(() => {
    examService.getParticipantDefaultPassword().then((pwd) => {
      setDefaultPassword(pwd);
      setBulkDefaultPassword(pwd);
    });
  }, []);

  if (!isOpen) return null;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !empId.trim()) {
      setError('Please provide Candidate Full Name and Employee ID / Roll Number.');
      return;
    }
    if (!defaultPassword || defaultPassword.length < 4) {
      setError('Default password must be at least 4 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      const chosenExam = exams.find((x) => x.id === selectedExamId);

      await examService.provisionUserByAdmin({
        displayName: name.trim(),
        employeeId: empId.trim(),
        role: 'participant',
        defaultPassword: defaultPassword.trim(),
        email: email.trim() || undefined,
        department: department.trim() || 'General Operations',
        assignedExamId: chosenExam?.id,
        assignedExamTitle: chosenExam?.title,
      });

      onSuccess(
        `Candidate "${name}" enrolled successfully with standard default password: ${defaultPassword.trim()}`
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to enroll candidate.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const lines = bulkText.split('\n').filter((l) => l.trim().length > 0);
    if (lines.length === 0) {
      setError('Please enter at least one candidate record.');
      return;
    }

    const chosenExam = exams.find((x) => x.id === bulkExamId);
    const parsedList = lines.map((line) => {
      const parts = line.split(',').map((p) => p.trim());
      const candidateName = parts[0] || 'Candidate';
      const candidateEmpId = parts[1] || `EMP-${Math.floor(1000 + Math.random() * 9000)}`;
      const candidateEmail = parts[2] || undefined;
      const candidateDept = parts[3] || 'Academic Assessment';

      return {
        displayName: candidateName,
        employeeId: candidateEmpId,
        email: candidateEmail,
        department: candidateDept,
        role: 'participant' as const,
        defaultPassword: bulkDefaultPassword.trim(),
        assignedExamId: chosenExam?.id,
        assignedExamTitle: chosenExam?.title,
      };
    });

    try {
      setSubmitting(true);
      const res = await examService.provisionBulkUsersByAdmin(parsedList);
      if (res.errors.length > 0 && res.created === 0) {
        setError(`Failed: ${res.errors.join('; ')}`);
        return;
      }

      onSuccess(
        `Successfully enrolled ${res.created} candidate(s) for exam "${chosenExam?.title || 'General'}". Default password: ${bulkDefaultPassword}`
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Bulk candidate enrollment failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-xl w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-750/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Input Candidates & Set Default Password
              </h3>
              <p className="text-[11px] text-slate-500">
                Administrator Participant Section Provisioning
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch between Single and Bulk */}
        <div className="p-4 pb-0">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-750 p-1">
            <button
              type="button"
              onClick={() => setTab('single')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                tab === 'single'
                  ? 'bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              <span>Single Candidate Input</span>
            </button>
            <button
              type="button"
              onClick={() => setTab('bulk')}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                tab === 'bulk'
                  ? 'bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Bulk / Batch Candidates Input</span>
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-5 space-y-4">
          {/* Uniform Password Policy Notice */}
          <div className="p-3 rounded-2xl bg-indigo-50/80 dark:bg-indigo-950/50 border border-indigo-200/80 dark:border-indigo-900/60 flex items-start space-x-2.5">
            <ShieldCheck className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="flex-1 text-xs">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-indigo-950 dark:text-indigo-200">
                  Uniform Candidate Default Password:
                </span>
                <span className="font-mono font-bold bg-white dark:bg-slate-800 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300">
                  {defaultPassword}
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(defaultPassword)}
                  className="inline-flex items-center space-x-1 text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400"
                >
                  {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <p className="text-[11px] text-slate-600 dark:text-slate-400 mt-1">
                The default password is the same for all candidates. After first login with their Employee ID, each candidate is required to set their own private password.
              </p>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {tab === 'single' ? (
            <form onSubmit={handleSingleSubmit} className="space-y-3.5">
              {/* Exam selection */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign to Exam <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <select
                    value={selectedExamId}
                    onChange={(e) => setSelectedExamId(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  >
                    <option value="">General Candidate Pool (All Exams)</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.subject})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Candidate Full Name <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. David Miller"
                      className="block w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Employee ID / Roll Number <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <IdCard className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      required
                      value={empId}
                      onChange={(e) => setEmpId(e.target.value.toUpperCase())}
                      placeholder="e.g. CAND-1024 or EMP-3040"
                      className="block w-full pl-9 pr-3 py-2 text-xs uppercase font-mono bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Department / Class / Faculty
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Building className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="e.g. Engineering & IT"
                      className="block w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Email Address (Optional)
                  </label>
                  <div className="relative rounded-xl shadow-xs">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Mail className="w-4 h-4" />
                    </div>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. candidate@university.edu"
                      className="block w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Default Password Section */}
              <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center space-x-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Candidate Default Password <span className="text-slate-400 font-normal">(Same for all candidates)</span></span>
                  </label>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(defaultPassword)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center space-x-1"
                    title="Copy Default Password to share with candidate"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy Password'}</span>
                  </button>
                </div>

                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={defaultPassword}
                    onChange={(e) => {
                      setDefaultPassword(e.target.value);
                      setBulkDefaultPassword(e.target.value);
                    }}
                    placeholder="Candidate default password"
                    className="block w-full pl-9 pr-10 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="mt-1.5 text-[10px] text-indigo-700 dark:text-indigo-300">
                  This standard default password is assigned to all enrolled candidates. Each candidate must change it upon first login.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
                >
                  {submitting ? 'Enrolling Candidate...' : 'Enroll Candidate'}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleBulkSubmit} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Assign Batch to Exam <span className="text-rose-500">*</span>
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <BookOpen className="w-4 h-4" />
                  </div>
                  <select
                    value={bulkExamId}
                    onChange={(e) => setBulkExamId(e.target.value)}
                    className="block w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                  >
                    <option value="">General Candidate Pool (All Exams)</option>
                    {exams.map((ex) => (
                      <option key={ex.id} value={ex.id}>
                        {ex.title} ({ex.subject})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Paste Candidate List (1 per line: Name, ID, Email, Department)
                  </label>
                  <span className="text-[10px] text-slate-400">Format: Name, ID, Email, Dept</span>
                </div>
                <textarea
                  rows={5}
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder="e.g.&#10;Alex Morgan, EMP-2001, alex@company.com, IT&#10;Sophia Chen, EMP-2002, sophia@company.com, Design"
                  className="w-full p-3 text-xs font-mono bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:text-white"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/30 border border-indigo-200/70 dark:border-indigo-900/50">
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold text-indigo-950 dark:text-indigo-200 flex items-center space-x-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                    <span>Batch Candidate Default Password <span className="text-slate-400 font-normal">(Same for all candidates)</span></span>
                  </label>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(bulkDefaultPassword)}
                    className="text-[11px] text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 flex items-center space-x-1"
                    title="Copy Default Password to share with candidates"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy Password'}</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={bulkDefaultPassword}
                  onChange={(e) => {
                    setBulkDefaultPassword(e.target.value);
                    setDefaultPassword(e.target.value);
                  }}
                  className="block w-full px-3 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl dark:text-white focus:ring-2 focus:ring-indigo-500"
                />
                <p className="mt-1.5 text-[10px] text-indigo-700 dark:text-indigo-300">
                  Every candidate in this batch receives this identical default password and will be prompted to set their private password upon first login.
                </p>
              </div>

              <div className="pt-2 flex items-center justify-end space-x-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-sm"
                >
                  {submitting ? 'Enrolling Batch...' : 'Enroll Candidates Batch'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
