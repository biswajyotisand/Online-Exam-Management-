import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { UserRole } from '../../types/exam';
import { RoleBadge } from './RoleBadge';
import { Shield, BookOpen, CheckSquare, GraduationCap, X, LogIn, AlertCircle } from 'lucide-react';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose }) => {
  const { signInWithGoogle, signInAsDemoRole } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError(null);
      const success = await signInWithGoogle();
      if (success) {
        onClose();
      }
    } catch (err: any) {
      if (
        !err?.message?.includes('closed-by-user') &&
        !err?.message?.includes('cancelled')
      ) {
        setError(err?.message || 'Google sign in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDemoSignIn = async (role: UserRole) => {
    try {
      setLoading(true);
      setError(null);
      await signInAsDemoRole(role);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to switch role');
    } finally {
      setLoading(false);
    }
  };

  const roleOptions: {
    role: UserRole;
    title: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      role: 'paper_setter',
      title: 'Exam Paper Setter',
      description: 'Author new examination papers, design MCQs & subjective questions, and set grading rubrics.',
      icon: <BookOpen className="w-5 h-5 text-indigo-500" />,
    },
    {
      role: 'evaluator',
      title: 'Evaluator / Examiner',
      description: 'Review student answer sheets, grade subjective & code tasks, provide feedback, and publish marks.',
      icon: <CheckSquare className="w-5 h-5 text-amber-500" />,
    },
    {
      role: 'participant',
      title: 'Exam Participant (Student)',
      description: 'Access scheduled tests, complete exams in proctored mode, and view instant/final scorecards.',
      icon: <GraduationCap className="w-5 h-5 text-emerald-500" />,
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Online Exam Access Portal
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Switch role perspective or sign in with Google
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Real Google Auth */}
          <div>
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
              Option 1: Firebase Google Authentication
            </label>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading}
              className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 hover:bg-slate-50 dark:hover:bg-slate-600 text-slate-800 dark:text-white text-sm font-semibold shadow-xs transition-all disabled:opacity-60"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.14z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.03 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>{loading ? 'Connecting...' : 'Sign in with Google Account'}</span>
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200 dark:border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-800 px-3 text-slate-400 font-medium">
                Or Instant Role Preview
              </span>
            </div>
          </div>

          {/* Quick Demo Roles for Instant Testing of All 4 Frontends */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Option 2: Select One of the 4 User Roles
            </label>
            <div className="grid grid-cols-1 gap-2">
              {roleOptions.map((item) => (
                <button
                  key={item.role}
                  type="button"
                  onClick={() => handleDemoSignIn(item.role)}
                  disabled={loading}
                  className="w-full flex items-start space-x-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-750 hover:bg-indigo-50/50 hover:border-indigo-300 dark:hover:bg-slate-700 transition-all text-left group"
                >
                  <div className="p-2 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-xs group-hover:scale-105 transition-transform">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        {item.title}
                      </span>
                      <RoleBadge role={item.role} size="sm" showIcon={false} />
                    </div>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-relaxed">
                      {item.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
