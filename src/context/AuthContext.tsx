import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';
import { auth, googleProvider } from '../lib/firebase';
import { UserProfile, UserRole } from '../types/exam';
import { examService } from '../services/examService';
import { hashPassword, verifyPassword } from '../lib/authCrypto';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  activeRole: UserRole;
  loading: boolean;
  isAdmin: boolean;
  isAuthenticated: boolean;
  mustChangePassword: boolean;
  isOperational: boolean;
  signInWithGoogle: () => Promise<boolean>;
  signInWithEmployeeId: (employeeId: string, password: string) => Promise<UserProfile>;
  signUpWithEmployeeId: (data: {
    name: string;
    employeeId: string;
    password: string;
    department?: string;
    email?: string;
    role?: UserRole;
  }) => Promise<UserProfile>;
  signInAsDemoRole: (role: UserRole) => Promise<void>;
  signOut: () => Promise<void>;
  setActiveRole: (role: UserRole) => void;
  refreshProfile: () => Promise<void>;
  completePasswordChange: (newPassword: string) => Promise<void>;
  operationalizeAccount: (passcode: string) => Promise<boolean>;
  executeRoleSwitch: (targetRole: UserRole, passcode?: string) => Promise<boolean>;
}

const BOOTSTRAP_ADMIN_EMAILS = [
  'biswajyoti.sand@gmail.com',
  'biswajyoti.office@gmail.com',
];

function isBootstrapAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return BOOTSTRAP_ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === email.toLowerCase());
}

const SESSION_STORAGE_KEY = 'online_exam_user_session';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [activeRole, setActiveRoleState] = useState<UserRole>('participant');
  const [loading, setLoading] = useState<boolean>(true);

  const persistSession = (p: UserProfile | null) => {
    if (p) {
      localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(p));
    } else {
      localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  };

  const fetchProfileForUser = async (u: User) => {
    try {
      let p = await examService.getUserProfile(u.uid);
      const isSystemAdminEmail = isBootstrapAdminEmail(u.email);

      if (!p) {
        // Initial setup for new user
        const initialRole: UserRole = isSystemAdminEmail ? 'admin' : 'participant';
        p = {
          uid: u.uid,
          email: u.email || 'user@onlineexam.internal',
          displayName: u.displayName || u.email?.split('@')[0] || 'Exam Candidate',
          employeeId: 'EMP-' + Math.floor(1000 + Math.random() * 9000),
          photoURL: u.photoURL || undefined,
          role: initialRole,
          department: 'Academic Computing & Assessment',
          isOperational: initialRole === 'admin' || initialRole === 'participant',
          createdAt: new Date().toISOString(),
        };
        await examService.createUserProfile(p);
      } else if (isSystemAdminEmail && p.role !== 'admin') {
        // Guarantee bootstrap admin privileges
        await examService.updateUserRole(u.uid, 'admin');
        p.role = 'admin';
        p.isOperational = true;
      }

      setProfile(p);
      setActiveRoleState(p.role);
      persistSession(p);
    } catch (err) {
      console.warn('Network issue fetching user profile, using authenticated user identity:', err);
      const isSystemAdminEmail = isBootstrapAdminEmail(u.email);
      const fallback: UserProfile = {
        uid: u.uid,
        email: u.email || 'biswajyoti.sand@gmail.com',
        displayName: u.displayName || u.email?.split('@')[0] || 'Administrator',
        employeeId: 'EMP-' + u.uid.substring(0, 6).toUpperCase(),
        photoURL: u.photoURL || undefined,
        role: isSystemAdminEmail ? 'admin' : 'participant',
        department: isSystemAdminEmail ? 'Academic Computing & System Security' : 'Candidate Assessment',
        isOperational: true,
        createdAt: new Date().toISOString(),
      };
      setProfile(fallback);
      setActiveRoleState(fallback.role);
      persistSession(fallback);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        await fetchProfileForUser(currentUser);
      } else {
        // Check saved session in localStorage
        const saved = localStorage.getItem(SESSION_STORAGE_KEY);
        if (saved) {
          try {
            const savedProfile: UserProfile = JSON.parse(saved);
            if (savedProfile.uid === 'demo_admin_user' || savedProfile.uid === 'admin_primary_user') {
              localStorage.removeItem(SESSION_STORAGE_KEY);
              setProfile(null);
            } else {
              setProfile(savedProfile);
              setActiveRoleState(savedProfile.role);
            }
          } catch {
            setProfile(null);
          }
        } else {
          setProfile(null);
        }
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async (): Promise<boolean> => {
    try {
      const res = await signInWithPopup(auth, googleProvider);
      if (res.user) {
        await fetchProfileForUser(res.user);
        return true;
      }
      return false;
    } catch (err: any) {
      // User closed popup or cancelled sign-in
      if (
        err?.code === 'auth/popup-closed-by-user' ||
        err?.code === 'auth/cancelled-popup-request' ||
        err?.message?.includes('popup-closed-by-user') ||
        err?.message?.includes('cancelled-popup-request')
      ) {
        console.info('Google sign-in popup was dismissed by the user.');
        return false;
      }

      if (err?.code === 'auth/popup-blocked') {
        const errorMsg = 'Google sign-in popup was blocked by browser. Please enable popups or try again.';
        console.warn(errorMsg);
        throw new Error(errorMsg);
      }

      console.error('Google sign-in error:', err?.message || err);
      throw err;
    }
  };

  const signInWithEmployeeId = async (employeeId: string, password: string): Promise<UserProfile> => {
    const trimmedId = employeeId.trim();
    if (!trimmedId) {
      throw new Error('Please enter your Employee ID or Email');
    }
    if (!password) {
      throw new Error('Please enter your password');
    }

    // Lookup user in Firestore
    const existing = await examService.getUserByEmployeeId(trimmedId);
    if (!existing) {
      throw new Error(`Access Denied: No account found for "${trimmedId}". Only candidates and staff pre-enrolled by the Administrator can log in. Please contact your examination administrator.`);
    }

    if (existing.passwordHash) {
      const matches = await verifyPassword(password, existing.passwordHash);
      if (!matches) {
        throw new Error('Incorrect password. Please verify and try again.');
      }
    } else {
      // If user was created without password, set the password now
      const newHash = await hashPassword(password);
      await examService.updateUserProfile(existing.uid, { passwordHash: newHash });
      existing.passwordHash = newHash;
    }

    setProfile(existing);
    setActiveRoleState(existing.role);
    persistSession(existing);
    return existing;
  };

  const signUpWithEmployeeId = async (data: {
    name: string;
    employeeId: string;
    password: string;
    department?: string;
    email?: string;
    role?: UserRole;
  }): Promise<UserProfile> => {
    if (!data.name.trim()) throw new Error('Please enter candidate full name');
    if (!data.employeeId.trim()) throw new Error('Please enter Employee ID');
    if (!data.password || data.password.length < 4) {
      throw new Error('Password must be at least 4 characters');
    }

    // Check if Employee ID is already registered
    const existing = await examService.getUserByEmployeeId(data.employeeId);
    if (existing) {
      throw new Error(`An account with Employee ID "${data.employeeId.trim()}" already exists. Please log in.`);
    }

    const hashed = await hashPassword(data.password);
    const newProfile = await examService.registerCandidate({
      displayName: data.name,
      employeeId: data.employeeId,
      passwordHash: hashed,
      department: data.department,
      email: data.email,
      role: data.role || 'participant',
    });

    setProfile(newProfile);
    setActiveRoleState(newProfile.role);
    persistSession(newProfile);
    return newProfile;
  };

  const signInAsDemoRole = async (role: UserRole) => {
    if (role === 'admin') {
      throw new Error('Demo accounts are strictly disabled for the Administrator role. Administrators must authenticate with verified credentials or Google.');
    }

    const roleLabels: Record<Exclude<UserRole, 'admin'>, { name: string; email: string; empId: string }> = {
      paper_setter: { name: 'Prof. Alan Vance', email: 'alan.vance@faculty.edu', empId: 'EMP-SETTER01' },
      evaluator: { name: 'Dr. Sarah Connor', email: 'sarah.connor@evaluation.edu', empId: 'EMP-EVAL01' },
      participant: { name: 'David K. Miller', email: 'david.miller@student.edu', empId: 'EMP-STUDENT01' },
    };

    const info = roleLabels[role as Exclude<UserRole, 'admin'>];
    const demoProfile: UserProfile = {
      uid: `demo_${role}_user`,
      email: info.email,
      employeeId: info.empId,
      displayName: info.name,
      role: role,
      department: role === 'participant' ? 'Faculty of Engineering' : 'Department of Assessment',
      isOperational: true,
      createdAt: new Date().toISOString(),
    };

    setProfile(demoProfile);
    setActiveRoleState(role);
    persistSession(demoProfile);
  };

  const signOut = async () => {
    persistSession(null);
    await fbSignOut(auth).catch(() => {});
    setUser(null);
    setProfile(null);
    setActiveRoleState('participant');
  };

  const setActiveRole = (role: UserRole) => {
    const isUserAdmin =
      profile?.role === 'admin' ||
      isBootstrapAdminEmail(user?.email);

    if (!isUserAdmin) {
      console.warn('Unauthorized role switch attempt rejected. Only the Administrator can switch portal views.');
      return;
    }
    setActiveRoleState(role);
  };

  const completePasswordChange = async (newPassword: string) => {
    if (!profile) return;
    await examService.changeUserPassword(profile.uid, newPassword);
    const updated: UserProfile = {
      ...profile,
      mustChangePassword: false,
      defaultPasswordAssigned: '',
      updatedAt: new Date().toISOString(),
    };
    setProfile(updated);
    persistSession(updated);
  };

  const operationalizeAccount = async (passcode: string): Promise<boolean> => {
    if (!profile) return false;
    const ok = await examService.operationalizeUserRole(profile.uid, activeRole, passcode);
    if (ok) {
      const updated: UserProfile = {
        ...profile,
        isOperational: true,
        operationalizedAt: new Date().toISOString(),
      };
      setProfile(updated);
      persistSession(updated);
      return true;
    }
    return false;
  };

  const executeRoleSwitch = async (targetRole: UserRole, _passcode?: string): Promise<boolean> => {
    if (targetRole === activeRole) return true;

    // Strict Rule: Except administrator no one can switch role.
    const isUserAdmin =
      profile?.role === 'admin' ||
      isBootstrapAdminEmail(user?.email);

    if (!isUserAdmin) {
      throw new Error('Access Denied: Only the Administrator is authorized to switch portal views.');
    }

    setActiveRoleState(targetRole);
    return true;
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfileForUser(user);
    } else if (profile) {
      const refreshed = await examService.getUserProfile(profile.uid);
      if (refreshed) {
        setProfile(refreshed);
        persistSession(refreshed);
      }
    }
  };

  const isAdmin = profile?.role === 'admin' || isBootstrapAdminEmail(user?.email);
  const isAuthenticated = profile !== null || user !== null;
  const mustChangePassword = Boolean(profile?.mustChangePassword);

  // Operational status: admin & participant are always operational; paper setter and evaluator must be operationalized
  const isOperational =
    activeRole === 'admin' ||
    activeRole === 'participant' ||
    Boolean(profile?.isOperational);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        activeRole,
        loading,
        isAdmin,
        isAuthenticated,
        mustChangePassword,
        isOperational,
        signInWithGoogle,
        signInWithEmployeeId,
        signUpWithEmployeeId,
        signInAsDemoRole,
        signOut,
        setActiveRole,
        refreshProfile,
        completePasswordChange,
        operationalizeAccount,
        executeRoleSwitch,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
