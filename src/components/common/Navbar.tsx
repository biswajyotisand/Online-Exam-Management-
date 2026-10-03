import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { RoleBadge } from './RoleBadge';
import { UserRole } from '../../types/exam';
import {
  Shield,
  BookOpen,
  CheckSquare,
  GraduationCap,
  LogOut,
  Sparkles,
  ChevronDown,
  Layers,
  UserCheck
} from 'lucide-react';

interface NavbarProps {
  onOpenAuthModal: () => void;
  onRefreshData?: () => void;
  onSwitchRoleRequest?: (role: UserRole) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenAuthModal,
  onRefreshData,
  onSwitchRoleRequest,
}) => {
  const { profile, activeRole, setActiveRole, signOut, isAdmin } = useAuth();
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);

  const isParticipantAccount = profile?.role === 'participant';

  const roles: { role: UserRole; label: string; desc: string; icon: React.ReactNode }[] = [
    {
      role: 'admin',
      label: 'Administrator',
      desc: 'System governance, candidate rosters & audit logs',
      icon: <Shield className="w-4 h-4 text-rose-500" />,
    },
    {
      role: 'paper_setter',
      label: 'Exam Paper Setter',
      desc: 'Inspect authored questions & rubrics (View-Only)',
      icon: <BookOpen className="w-4 h-4 text-indigo-500" />,
    },
    {
      role: 'evaluator',
      label: 'Evaluator',
      desc: 'Inspect answer scripts & rubrics (View-Only)',
      icon: <CheckSquare className="w-4 h-4 text-amber-500" />,
    },
    {
      role: 'participant',
      label: 'Participant',
      desc: 'Inspect student exam portal (View-Only; cannot participate)',
      icon: <GraduationCap className="w-4 h-4 text-emerald-500" />,
    },
  ];

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Portal Branding */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-700 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 font-bold text-xl">
              OE
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-slate-900 to-slate-700 dark:from-white dark:to-slate-300 bg-clip-text text-transparent">
                  Online Exam
                </span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300 px-1.5 py-0.5 rounded">
                  v2.0
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium hidden sm:block">
                Secure Multi-Role Examination Platform
              </p>
            </div>
          </div>

          {/* Center: Role Display (Admin can switch view; all other roles are strictly fixed) */}
          <div className="flex items-center space-x-2">
            {profile && (isAdmin || profile.role === 'admin') ? (
              /* Administrator View Switcher */
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setRoleMenuOpen(!roleMenuOpen)}
                  className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/60 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-950 dark:text-indigo-200 text-xs font-semibold transition-colors shadow-xs"
                  title="Administrator Portal Inspection Mode"
                >
                  <Shield className="w-3.5 h-3.5 text-rose-500" />
                  <span className="hidden md:inline text-slate-500 dark:text-slate-400 font-normal">Admin View:</span>
                  <RoleBadge role={activeRole} size="sm" />
                  {activeRole !== 'admin' && (
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-950/80 px-1.5 py-0.5 rounded border border-amber-300 dark:border-amber-800">
                      View-Only
                    </span>
                  )}
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                </button>

                {roleMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-30"
                      onClick={() => setRoleMenuOpen(false)}
                    />
                    <div className="absolute left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-0 mt-2 w-72 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xl z-40 p-2 text-left animate-in fade-in zoom-in-95 duration-100">
                      <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700/60 mb-1">
                        <div className="flex items-center space-x-1.5">
                          <Shield className="w-3.5 h-3.5 text-rose-500" />
                          <p className="text-[11px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                            Administrator View Inspector
                          </p>
                        </div>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          Inspect portals as different roles (Admin exclusive):
                        </p>
                      </div>

                      <div className="space-y-1">
                        {roles.map((item) => {
                          const isCurrent = activeRole === item.role;

                          return (
                            <button
                              key={item.role}
                              type="button"
                              onClick={() => {
                                setRoleMenuOpen(false);
                                if (onSwitchRoleRequest) {
                                  onSwitchRoleRequest(item.role);
                                } else {
                                  setActiveRole(item.role);
                                }
                              }}
                              className={`w-full flex items-start space-x-2.5 p-2 rounded-xl text-left transition-all ${
                                isCurrent
                                  ? 'bg-indigo-50 dark:bg-indigo-950/60 border border-indigo-200 dark:border-indigo-800 text-indigo-950 dark:text-indigo-200 font-semibold'
                                  : 'hover:bg-slate-50 dark:hover:bg-slate-700/60 text-slate-700 dark:text-slate-300'
                              }`}
                            >
                              <div className="mt-0.5 p-1 rounded-lg bg-white dark:bg-slate-700 shadow-xs border border-slate-100 dark:border-slate-600">
                                {item.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold">{item.label}</span>
                                  {isCurrent && (
                                    <span className="text-[9px] bg-indigo-600 text-white font-bold px-1.5 py-0.5 rounded-full">
                                      VIEWING
                                    </span>
                                  )}
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                  {item.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : profile ? (
              /* Non-Admin: Fixed, non-switchable role badge */
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80 shadow-xs">
                <span className="hidden sm:inline text-xs text-slate-400 font-medium">Assigned Role:</span>
                <RoleBadge role={profile.role} size="sm" />
              </div>
            ) : null}
          </div>

          {/* Right: Auth Profile / Sign In */}
          <div className="flex items-center space-x-3">
            {profile ? (
              <div className="flex items-center space-x-3">
                <div className="hidden sm:flex flex-col text-right">
                  <div className="flex items-center space-x-1.5 justify-end">
                    <span className="text-xs font-semibold text-slate-900 dark:text-white truncate max-w-[140px]">
                      {profile.displayName}
                    </span>
                    {profile.employeeId && (
                      <span className="font-mono text-[10px] bg-slate-100 dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.2 rounded border border-slate-200 dark:border-slate-700">
                        {profile.employeeId}
                      </span>
                    )}
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400 truncate max-w-[140px]">
                    {profile.email}
                  </span>
                </div>

                <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-xs text-slate-700 dark:text-slate-200 ring-2 ring-indigo-500/30">
                  {profile.displayName?.[0]?.toUpperCase() || 'U'}
                </div>

                <button
                  type="button"
                  onClick={signOut}
                  className="flex items-center space-x-1 px-2.5 py-1.5 text-xs text-slate-600 dark:text-slate-300 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors"
                  title="Sign Out to Sign In screen"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenAuthModal}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-sm transition-all"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Sign In / Switch Role</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
