import React, { useState } from 'react';
import { Exam, UserRole } from '../../types/exam';
import { examService } from '../../services/examService';
import {
  BookOpen,
  CheckSquare,
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
  AlertCircle
} from 'lucide-react';

interface AddStaffModalProps {
  isOpen: boolean;
  exams: Exam[];
  initialRole?: 'paper_setter' | 'evaluator';
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export const AddStaffModal: React.FC<AddStaffModalProps> = ({
  isOpen,
  exams,
  initialRole = 'paper_setter',
  onClose,
  onSuccess,
}) => {
  const [role, setRole] = useState<'paper_setter' | 'evaluator'>(initialRole);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form fields
  const [name, setName] = useState('');
  const [empId, setEmpId] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [assignedExamId, setAssignedExamId] = useState('');
  const [defaultPassword, setDefaultPassword] = useState(
    initialRole === 'paper_setter' ? 'SetterPass@2026' : 'EvalPass@2026'
  );

  if (!isOpen) return null;

  const roleTitle = role === 'paper_setter' ? 'Exam Paper Setter' : 'Evaluator';

  const generateRandomPassword = (roleKey: string) => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 6; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    const prefix = roleKey === 'paper_setter' ? 'Setter' : 'Eval';
    return `${prefix}${res}!`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !empId.trim()) {
      setError('Please provide Staff Full Name and Employee / Faculty ID.');
      return;
    }
    if (!defaultPassword || defaultPassword.length < 4) {
      setError('Default password must be at least 4 characters long.');
      return;
    }

    try {
      setSubmitting(true);
      const chosenExam = exams.find((x) => x.id === assignedExamId);

      await examService.provisionUserByAdmin({
        displayName: name.trim(),
        employeeId: empId.trim(),
        role: role,
        defaultPassword: defaultPassword.trim(),
        email: email.trim() || undefined,
        department: department.trim() || (role === 'paper_setter' ? 'Academic Faculty' : 'Examination Board'),
        assignedExamId: chosenExam?.id,
        assignedExamTitle: chosenExam?.title,
      });

      onSuccess(
        `${roleTitle} "${name}" provisioned successfully. Default password: ${defaultPassword}`
      );
      onClose();
    } catch (err: any) {
      setError(err?.message || `Failed to add ${roleTitle}.`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white dark:bg-slate-800 rounded-3xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between bg-slate-50/50 dark:bg-slate-750/50">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400">
              {role === 'paper_setter' ? <BookOpen className="w-5 h-5" /> : <CheckSquare className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Add {roleTitle} & Set Default Password
              </h3>
              <p className="text-[11px] text-slate-500">
                Administrator Staff Section Provisioning
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

        {/* Role Toggle */}
        <div className="p-5 pb-0">
          <div className="flex rounded-xl bg-slate-100 dark:bg-slate-750 p-1">
            <button
              type="button"
              onClick={() => {
                setRole('paper_setter');
                setDefaultPassword(generateRandomPassword('paper_setter'));
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                role === 'paper_setter'
                  ? 'bg-white dark:bg-slate-850 text-indigo-600 dark:text-indigo-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Exam Paper Setter Section</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setRole('evaluator');
                setDefaultPassword(generateRandomPassword('evaluator'));
              }}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all flex items-center justify-center space-x-1.5 ${
                role === 'evaluator'
                  ? 'bg-white dark:bg-slate-850 text-purple-600 dark:text-purple-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900'
              }`}
            >
              <CheckSquare className="w-3.5 h-3.5" />
              <span>Evaluator Section</span>
            </button>
          </div>
        </div>

        {/* Form Body */}
        <div className="p-5 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Full Name <span className="text-rose-500">*</span>
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
                    placeholder={role === 'paper_setter' ? 'e.g. Prof. Alan Vance' : 'e.g. Dr. Sarah Connor'}
                    className="block w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Employee / Staff ID <span className="text-rose-500">*</span>
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
                    placeholder={role === 'paper_setter' ? 'e.g. EMP-SETTER02' : 'e.g. EMP-EVAL02'}
                    className="block w-full pl-9 pr-3 py-2 text-xs uppercase font-mono bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:text-white"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Department / Faculty
                </label>
                <div className="relative rounded-xl shadow-xs">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <Building className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    placeholder="e.g. Computer Science & AI"
                    className="block w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:text-white"
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
                    placeholder="e.g. faculty@institution.edu"
                    className="block w-full pl-9 pr-3 py-2 text-xs bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:text-white"
                  />
                </div>
              </div>
            </div>

            {/* Assigned Exam */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Designated Exam (Optional)
              </label>
              <select
                value={assignedExamId}
                onChange={(e) => setAssignedExamId(e.target.value)}
                className="block w-full px-3 py-2 text-xs bg-slate-50 dark:bg-slate-750 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:text-white"
              >
                <option value="">All Exams / General Staff</option>
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.title} ({ex.subject})
                  </option>
                ))}
              </select>
            </div>

            {/* Default Password Section */}
            <div className="p-3.5 rounded-2xl bg-purple-50/50 dark:bg-purple-950/30 border border-purple-200/70 dark:border-purple-900/50">
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-bold text-purple-950 dark:text-purple-200">
                  Administrator Default Password <span className="text-rose-500">*</span>
                </label>
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setDefaultPassword(generateRandomPassword(role))}
                    className="text-[11px] text-purple-600 dark:text-purple-400 hover:underline flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>Generate</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(defaultPassword)}
                    className="text-[11px] text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center space-x-1"
                    title="Copy Default Password to share with staff member"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              <div className="relative rounded-xl shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={defaultPassword}
                  onChange={(e) => setDefaultPassword(e.target.value)}
                  placeholder="Set default password"
                  className="block w-full pl-9 pr-10 py-2 text-xs font-mono bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-xl focus:ring-2 focus:ring-purple-500 dark:text-white"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="mt-1 text-[10px] text-purple-700 dark:text-purple-300">
                Share this default password with the {roleTitle}. They will be required to change it on their first login.
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
                className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-purple-600 hover:bg-purple-700 disabled:opacity-50 shadow-sm"
              >
                {submitting ? 'Adding...' : `Add ${roleTitle}`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
