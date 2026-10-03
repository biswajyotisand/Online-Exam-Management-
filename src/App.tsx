import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navbar } from './components/common/Navbar';
import { AuthModal } from './components/common/AuthModal';
import { AuthGateway } from './components/auth/AuthGateway';
import { FirstLoginPasswordModal } from './components/common/FirstLoginPasswordModal';
import { OperationalizeModal } from './components/common/OperationalizeModal';
import { RoleBadge } from './components/common/RoleBadge';
import { AdminPortal } from './components/admin/AdminPortal';
import { PaperSetterPortal } from './components/setter/PaperSetterPortal';
import { EvaluatorPortal } from './components/evaluator/EvaluatorPortal';
import { ParticipantPortal } from './components/participant/ParticipantPortal';
import { UserRole } from './types/exam';
import { Sparkles, GraduationCap, Lock, ShieldAlert } from 'lucide-react';

function AppContent() {
  const {
    activeRole,
    setActiveRole,
    profile,
    loading,
    isAuthenticated,
    mustChangePassword,
    isOperational,
    executeRoleSwitch,
    isAdmin,
  } = useAuth();

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [roleNotice, setRoleNotice] = useState<string | null>(null);

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  const handleRequestRoleSwitch = (targetRole: UserRole) => {
    if (targetRole === activeRole) return;
    setRoleNotice(null);

    // Rule: Except administrator no one can switch role.
    if (profile?.role === 'admin' || isAdmin) {
      setActiveRole(targetRole);
      return;
    }

    setRoleNotice('Access Denied: Only the Administrator is authorized to switch portal views.');
    setTimeout(() => setRoleNotice(null), 4000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-xl shadow-indigo-500/30 animate-pulse">
          <GraduationCap className="w-8 h-8" />
        </div>
        <div className="mt-4 text-xs font-semibold tracking-wide text-slate-300 flex items-center space-x-2">
          <div className="w-2 h-2 rounded-full bg-indigo-500 animate-ping" />
          <span>Connecting to Online Exam Secure Portal...</span>
        </div>
      </div>
    );
  }

  // Display Sign Up & Log In section first if not authenticated
  if (!isAuthenticated) {
    return <AuthGateway />;
  }

  const renderActivePortal = () => {
    switch (activeRole) {
      case 'admin':
        return <AdminPortal key={`admin-${refreshKey}`} />;
      case 'paper_setter':
        return <PaperSetterPortal key={`setter-${refreshKey}`} />;
      case 'evaluator':
        return <EvaluatorPortal key={`eval-${refreshKey}`} />;
      case 'participant':
      default:
        return <ParticipantPortal key={`participant-${refreshKey}`} />;
    }
  };

  const isParticipantUser = profile?.role === 'participant';

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation */}
      <Navbar
        onOpenAuthModal={() => setAuthModalOpen(true)}
        onRefreshData={handleRefresh}
        onSwitchRoleRequest={handleRequestRoleSwitch}
      />

      {/* Role Notice Banner if attempted forbidden action */}
      {roleNotice && (
        <div className="bg-amber-500 text-white px-4 py-2 text-xs font-semibold text-center flex items-center justify-center space-x-2 animate-in fade-in">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>{roleNotice}</span>
        </div>
      )}

      {/* Role Quick Selector Banner */}
      <div className="bg-indigo-900/10 dark:bg-indigo-950/40 border-b border-indigo-200/50 dark:border-indigo-900/50 py-2.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
              <span>Active Role Frontend:</span>
            </span>
            <RoleBadge role={activeRole} size="sm" />
            {profile?.employeeId && (
              <span className="font-mono text-[11px] bg-white dark:bg-slate-800 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded border border-indigo-200 dark:border-indigo-800 font-semibold">
                ID: {profile.employeeId}
              </span>
            )}
            {isParticipantUser && (
              <span className="text-[10px] bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-bold px-2 py-0.5 rounded-full">
                Candidate Account (Role Locked)
              </span>
            )}
          </div>

          <div className="flex items-center space-x-1.5 overflow-x-auto">
            <span className="text-slate-500 dark:text-slate-400 hidden sm:inline mr-1 text-[11px]">
              Switch Frontend:
            </span>
            {(['admin', 'paper_setter', 'evaluator', 'participant'] as UserRole[]).map((r) => {
              const isCurrent = activeRole === r;
              const isLockedForParticipant = isParticipantUser && r !== 'participant';

              const labels: Record<UserRole, string> = {
                admin: '1. Administrator',
                paper_setter: '2. Paper Setter',
                evaluator: '3. Evaluator',
                participant: '4. Participant',
              };

              return (
                <button
                  key={r}
                  type="button"
                  disabled={isLockedForParticipant}
                  onClick={() => handleRequestRoleSwitch(r)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center space-x-1 ${
                    isLockedForParticipant
                      ? 'opacity-40 cursor-not-allowed bg-slate-200 dark:bg-slate-800 text-slate-500'
                      : isCurrent
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white/80 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-white dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700'
                  }`}
                  title={
                    isLockedForParticipant
                      ? 'Participants cannot change their role'
                      : (activeRole === 'paper_setter' && r === 'evaluator') ||
                        (activeRole === 'evaluator' && r === 'paper_setter')
                      ? 'Requires Role-Switch Passcode'
                      : undefined
                  }
                >
                  {isLockedForParticipant && <Lock className="w-3 h-3 text-slate-400" />}
                  <span>{labels[r]}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {renderActivePortal()}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white/50 dark:bg-slate-900/50 mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="font-extrabold tracking-tight text-slate-800 dark:text-slate-200">
              Online Exam
            </span>
            <span>•</span>
            <span>Firestore Powered Online Examination Infrastructure</span>
          </div>
          <div className="text-[11px] text-slate-400">
            Multi-Role ABAC & RBAC Security • Role Operationalization Passcodes Enforced
          </div>
        </div>
      </footer>

      {/* 1. Mandatory First Login Password Change Modal */}
      {mustChangePassword && <FirstLoginPasswordModal />}

      {/* 2. Mandatory Role Operationalization Modal for Paper Setter & Evaluator */}
      {!mustChangePassword && !isOperational && (activeRole === 'paper_setter' || activeRole === 'evaluator') && (
        <OperationalizeModal />
      )}

      {/* 3. Auth Modal (for switching accounts while inside) */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
