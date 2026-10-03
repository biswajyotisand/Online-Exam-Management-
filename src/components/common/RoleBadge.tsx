import React from 'react';
import { UserRole } from '../../types/exam';
import { Shield, BookOpen, CheckSquare, GraduationCap } from 'lucide-react';

interface RoleBadgeProps {
  role: UserRole;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

export const RoleBadge: React.FC<RoleBadgeProps> = ({ role, size = 'md', showIcon = true }) => {
  const configs: Record<
    UserRole,
    { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
  > = {
    admin: {
      label: 'Administrator',
      bg: 'bg-rose-500/10',
      text: 'text-rose-600 dark:text-rose-400',
      border: 'border-rose-500/30',
      icon: <Shield className="w-3.5 h-3.5 mr-1" />,
    },
    paper_setter: {
      label: 'Exam Paper Setter',
      bg: 'bg-indigo-500/10',
      text: 'text-indigo-600 dark:text-indigo-400',
      border: 'border-indigo-500/30',
      icon: <BookOpen className="w-3.5 h-3.5 mr-1" />,
    },
    evaluator: {
      label: 'Evaluator',
      bg: 'bg-amber-500/10',
      text: 'text-amber-600 dark:text-amber-400',
      border: 'border-amber-500/30',
      icon: <CheckSquare className="w-3.5 h-3.5 mr-1" />,
    },
    participant: {
      label: 'Participant',
      bg: 'bg-emerald-500/10',
      text: 'text-emerald-600 dark:text-emerald-400',
      border: 'border-emerald-500/30',
      icon: <GraduationCap className="w-3.5 h-3.5 mr-1" />,
    },
  };

  const current = configs[role] || configs.participant;

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5 font-medium',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${current.bg} ${current.text} ${current.border} ${sizeClasses[size]}`}
    >
      {showIcon && current.icon}
      {current.label}
    </span>
  );
};
