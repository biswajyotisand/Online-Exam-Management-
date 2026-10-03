import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrors';
import { Exam, Question, Submission, UserProfile, AuditLog, UserRole, SystemPasscodes, QuestionChallenge, ChallengeStatus, ChallengeReason, CandidateChallengeSnapshot } from '../types/exam';
import { hashPassword } from '../lib/authCrypto';

const USERS_COL = 'users';
const ADMINS_COL = 'admins';
const EXAMS_COL = 'exams';
const SUBMISSIONS_COL = 'submissions';
const CHALLENGES_COL = 'challenges';
const AUDIT_COL = 'audit_logs';
const SETTINGS_COL = 'system_settings';
const PASSCODES_DOC = 'security_passcodes';

const DEFAULT_PASSCODES: SystemPasscodes = {
  paperSetterOperationalPasscode: 'SETTER-OPERATE-2026',
  evaluatorOperationalPasscode: 'EVAL-OPERATE-2026',
  roleSwitchPasscode: 'SWITCH-STAFF-7788',
  participantDefaultPassword: 'Candidate@2026',
  updatedAt: new Date().toISOString(),
  updatedBy: 'System Administrator',
};

export function cleanFirestoreData<T extends Record<string, any>>(obj: T): any {
  if (obj === null || obj === undefined || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj
      .filter((item) => item !== undefined)
      .map((item) => (typeof item === 'object' && item !== null ? cleanFirestoreData(item) : item));
  }
  if (obj instanceof Date) {
    return obj;
  }

  const cleaned: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) {
      continue;
    }
    if (value !== null && typeof value === 'object' && !(value instanceof Date)) {
      cleaned[key] = cleanFirestoreData(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

export const examService = {
  // ---- Audit Logs ----
  async logAction(action: string, details: string) {
    const user = auth.currentUser;
    if (!user) return;
    const logId = 'log_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
    const logData: AuditLog = {
      id: logId,
      action,
      userId: user.uid,
      userEmail: user.email || 'anonymous',
      details,
      timestamp: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, AUDIT_COL, logId), logData);
    } catch (err) {
      console.warn('Could not write audit log:', err);
    }
  },

  async getAuditLogs(): Promise<AuditLog[]> {
    try {
      const q = query(collection(db, AUDIT_COL), orderBy('timestamp', 'desc'), limit(50));
      const snap = await getDocs(q);
      return snap.docs.map((d) => d.data() as AuditLog);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, AUDIT_COL);
      return [];
    }
  },

  // ---- Users & RBAC ----
  async getUserProfile(uid: string): Promise<UserProfile | null> {
    try {
      const snap = await getDoc(doc(db, USERS_COL, uid));
      if (snap.exists()) {
        return snap.data() as UserProfile;
      }
      return null;
    } catch (error: any) {
      if (
        error?.message?.includes('offline') ||
        error?.message?.includes('client is offline') ||
        error?.code === 'unavailable'
      ) {
        console.warn(`Firestore is offline or connecting; falling back gracefully for ${uid}:`, error?.message);
        return null;
      }
      handleFirestoreError(error, OperationType.GET, `${USERS_COL}/${uid}`);
      return null;
    }
  },

  async createUserProfile(profile: UserProfile): Promise<void> {
    try {
      await setDoc(doc(db, USERS_COL, profile.uid), profile);
      // If admin role is assigned, write to admins collection too
      if (profile.role === 'admin') {
        await setDoc(doc(db, ADMINS_COL, profile.uid), {
          email: profile.email,
          assignedAt: new Date().toISOString(),
        });
      }
      await this.logAction('USER_REGISTERED', `User ${profile.email} profile created with role ${profile.role}`).catch(() => {});
    } catch (error: any) {
      if (
        error?.message?.includes('offline') ||
        error?.message?.includes('client is offline') ||
        error?.code === 'unavailable'
      ) {
        console.warn(`Firestore write queued while offline for ${profile.uid}:`, error?.message);
        return;
      }
      handleFirestoreError(error, OperationType.CREATE, `${USERS_COL}/${profile.uid}`);
    }
  },

  async updateUserRole(uid: string, newRole: UserRole): Promise<void> {
    try {
      await updateDoc(doc(db, USERS_COL, uid), {
        role: newRole,
        updatedAt: new Date().toISOString(),
      });
      if (newRole === 'admin') {
        await setDoc(doc(db, ADMINS_COL, uid), {
          email: auth.currentUser?.email || '',
          assignedAt: new Date().toISOString(),
        });
      } else {
        try {
          await deleteDoc(doc(db, ADMINS_COL, uid));
        } catch {
          // Ignore if admin doc doesn't exist
        }
      }
      await this.logAction('ROLE_UPDATED', `User ${uid} assigned new role: ${newRole}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COL}/${uid}`);
    }
  },

  async updateUserProfile(uid: string, updates: Partial<UserProfile>): Promise<void> {
    try {
      await updateDoc(doc(db, USERS_COL, uid), {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COL}/${uid}`);
    }
  },

  // ---- Security Passcodes & Operationalization ----
  async getSystemPasscodes(): Promise<SystemPasscodes> {
    try {
      const snap = await getDoc(doc(db, SETTINGS_COL, PASSCODES_DOC));
      if (snap.exists()) {
        return snap.data() as SystemPasscodes;
      }
      // Bootstrap default passcodes
      await setDoc(doc(db, SETTINGS_COL, PASSCODES_DOC), DEFAULT_PASSCODES);
      return DEFAULT_PASSCODES;
    } catch (error) {
      console.warn('Error reading system passcodes, falling back to defaults:', error);
      return DEFAULT_PASSCODES;
    }
  },

  async updateSystemPasscodes(passcodes: Partial<SystemPasscodes>): Promise<void> {
    try {
      const current = await this.getSystemPasscodes();
      const updated: SystemPasscodes = {
        ...current,
        ...passcodes,
        updatedAt: new Date().toISOString(),
        updatedBy: auth.currentUser?.email || 'Administrator',
      };
      await setDoc(doc(db, SETTINGS_COL, PASSCODES_DOC), updated);
      await this.logAction(
        'SECURITY_PASSCODES_UPDATED',
        'Administrator updated system passcodes for Paper Setter, Evaluator, or Role Switching.'
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SETTINGS_COL}/${PASSCODES_DOC}`);
    }
  },

  async getParticipantDefaultPassword(): Promise<string> {
    try {
      const passcodes = await this.getSystemPasscodes();
      return passcodes.participantDefaultPassword || 'Candidate@2026';
    } catch {
      return 'Candidate@2026';
    }
  },

  async setParticipantDefaultPassword(newDefaultPassword: string): Promise<void> {
    const cleanPassword = newDefaultPassword.trim();
    if (!cleanPassword) throw new Error('Default password cannot be empty');
    await this.updateSystemPasscodes({
      participantDefaultPassword: cleanPassword,
    });
  },

  async syncDefaultPasswordForAllParticipants(defaultPassword: string): Promise<number> {
    try {
      const cleanPassword = defaultPassword.trim();
      if (!cleanPassword) throw new Error('Default password cannot be empty');

      const q = query(collection(db, USERS_COL), where('role', '==', 'participant'));
      const snap = await getDocs(q);
      const hashedPassword = await hashPassword(cleanPassword);
      let count = 0;

      for (const d of snap.docs) {
        await updateDoc(d.ref, {
          passwordHash: hashedPassword,
          mustChangePassword: true,
          defaultPasswordAssigned: cleanPassword,
          updatedAt: new Date().toISOString(),
        });
        count++;
      }

      await this.setParticipantDefaultPassword(cleanPassword);
      await this.logAction(
        'BATCH_DEFAULT_PASSWORD_SYNC',
        `Admin synchronized uniform default password "${cleanPassword}" for all ${count} participants.`
      );
      return count;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COL}`);
      return 0;
    }
  },

  async setDefaultPasswordForUser(uid: string, defaultPassword: string): Promise<void> {
    try {
      const hashedPassword = await hashPassword(defaultPassword);
      await updateDoc(doc(db, USERS_COL, uid), {
        passwordHash: hashedPassword,
        mustChangePassword: true,
        defaultPasswordAssigned: defaultPassword,
        updatedAt: new Date().toISOString(),
      });
      await this.logAction(
        'DEFAULT_PASSWORD_ASSIGNED',
        `Admin assigned default temporary password for user ${uid}. User must change upon first login.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COL}/${uid}`);
    }
  },

  async changeUserPassword(uid: string, newPassword: string): Promise<void> {
    try {
      const hashedPassword = await hashPassword(newPassword);
      await updateDoc(doc(db, USERS_COL, uid), {
        passwordHash: hashedPassword,
        mustChangePassword: false,
        defaultPasswordAssigned: '',
        updatedAt: new Date().toISOString(),
      });
      await this.logAction(
        'PASSWORD_CHANGED',
        `User ${uid} successfully changed and set their personalized password.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COL}/${uid}`);
    }
  },

  async operationalizeUserRole(uid: string, role: UserRole, enteredPasscode: string): Promise<boolean> {
    const passcodes = await this.getSystemPasscodes();
    const cleanPass = enteredPasscode.trim();

    let targetPasscode = '';
    if (role === 'paper_setter') {
      targetPasscode = passcodes.paperSetterOperationalPasscode.trim();
    } else if (role === 'evaluator') {
      targetPasscode = passcodes.evaluatorOperationalPasscode.trim();
    } else {
      // Participant or admin does not need operational passcodes
      return true;
    }

    if (cleanPass !== targetPasscode) {
      throw new Error(`Invalid operationalization passcode for ${role === 'paper_setter' ? 'Exam Paper Setter' : 'Evaluator'}. Please request the operational passcode from the Administrator.`);
    }

    try {
      await updateDoc(doc(db, USERS_COL, uid), {
        isOperational: true,
        operationalizedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      await this.logAction(
        'STAFF_OPERATIONALIZED',
        `User ${uid} validated passcode and operationalized account for role: ${role}`
      );
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COL}/${uid}`);
      return false;
    }
  },

  async verifyRoleSwitchPasscode(enteredPasscode: string): Promise<boolean> {
    const passcodes = await this.getSystemPasscodes();
    return enteredPasscode.trim() === passcodes.roleSwitchPasscode.trim();
  },

  async adminToggleOperationalStatus(uid: string, isOperational: boolean): Promise<void> {
    try {
      await updateDoc(doc(db, USERS_COL, uid), {
        isOperational,
        operationalizedAt: isOperational ? new Date().toISOString() : null,
        updatedAt: new Date().toISOString(),
      });
      await this.logAction(
        'ADMIN_TOGGLED_OPERATIONAL',
        `Administrator set operational status to ${isOperational} for user ${uid}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COL}/${uid}`);
    }
  },

  async getAllUsers(): Promise<UserProfile[]> {
    try {
      const snap = await getDocs(collection(db, USERS_COL));
      return snap.docs.map((d) => d.data() as UserProfile);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, USERS_COL);
      return [];
    }
  },

  async getUserByEmployeeId(employeeId: string): Promise<UserProfile | null> {
    try {
      const snap = await getDocs(collection(db, USERS_COL));
      const target = employeeId.trim().toLowerCase();
      const match = snap.docs
        .map((d) => d.data() as UserProfile)
        .find(
          (u) =>
            u.employeeId?.trim().toLowerCase() === target ||
            u.email?.trim().toLowerCase() === target ||
            u.uid?.trim().toLowerCase() === target
        );
      return match || null;
    } catch (error) {
      console.error('Error finding user by employee ID:', error);
      return null;
    }
  },

  async registerCandidate(data: {
    displayName: string;
    employeeId: string;
    passwordHash: string;
    email?: string;
    department?: string;
    role?: UserRole;
  }): Promise<UserProfile> {
    const cleanEmpId = data.employeeId.trim().toUpperCase();
    const uid = 'emp_' + cleanEmpId.replace(/[^A-Za-z0-9_-]/g, '_');
    const email = data.email?.trim() || `${cleanEmpId.toLowerCase()}@onlineexam.internal`;
    const role: UserRole = data.role || 'participant';

    const profile: UserProfile = {
      uid,
      employeeId: cleanEmpId,
      displayName: data.displayName.trim(),
      email,
      role,
      department: data.department?.trim() || 'General Operations',
      passwordHash: data.passwordHash,
      createdAt: new Date().toISOString(),
    };

    await setDoc(doc(db, USERS_COL, uid), profile);
    if (role === 'admin') {
      await setDoc(doc(db, ADMINS_COL, uid), {
        email,
        assignedAt: new Date().toISOString(),
      });
    }

    await this.logAction(
      'USER_REGISTERED',
      `Candidate/Employee registered: ${profile.displayName} (Employee ID: ${cleanEmpId}, Role: ${role})`
    );

    return profile;
  },

  async provisionUserByAdmin(data: {
    displayName: string;
    employeeId: string;
    role: UserRole;
    defaultPassword: string;
    email?: string;
    department?: string;
    assignedExamId?: string;
    assignedExamTitle?: string;
  }): Promise<UserProfile> {
    const cleanEmpId = data.employeeId.trim().toUpperCase();
    const uid = 'emp_' + cleanEmpId.replace(/[^A-Za-z0-9_-]/g, '_');
    const email = data.email?.trim() || `${cleanEmpId.toLowerCase()}@onlineexam.internal`;
    const hashedPassword = await hashPassword(data.defaultPassword);

    const profile: UserProfile = {
      uid,
      employeeId: cleanEmpId,
      displayName: data.displayName.trim(),
      email,
      role: data.role,
      department: data.department?.trim() || 'General Operations',
      passwordHash: hashedPassword,
      mustChangePassword: true,
      defaultPasswordAssigned: data.defaultPassword,
      isOperational: data.role === 'participant' || data.role === 'admin' ? true : false,
      createdAt: new Date().toISOString(),
    };

    if (data.assignedExamId?.trim()) {
      profile.assignedExamId = data.assignedExamId.trim();
    }
    if (data.assignedExamTitle?.trim()) {
      profile.assignedExamTitle = data.assignedExamTitle.trim();
    }

    await setDoc(doc(db, USERS_COL, uid), profile);
    if (data.role === 'admin') {
      await setDoc(doc(db, ADMINS_COL, uid), {
        email,
        assignedAt: new Date().toISOString(),
      });
    }

    await this.logAction(
      'USER_PROVISIONED_BY_ADMIN',
      `Admin provisioned ${data.role} account for ${profile.displayName} (ID: ${cleanEmpId}). Default password set with forced first-login change.`
    );

    return profile;
  },

  async provisionBulkUsersByAdmin(
    users: Array<{
      displayName: string;
      employeeId: string;
      role: UserRole;
      defaultPassword: string;
      email?: string;
      department?: string;
      assignedExamId?: string;
      assignedExamTitle?: string;
    }>
  ): Promise<{ created: number; errors: string[] }> {
    let created = 0;
    const errors: string[] = [];

    for (const item of users) {
      try {
        if (!item.displayName?.trim() || !item.employeeId?.trim()) {
          errors.push(`Skipped row: missing name or employee ID`);
          continue;
        }
        await this.provisionUserByAdmin(item);
        created++;
      } catch (err: any) {
        errors.push(`Failed to enroll ${item.displayName} (${item.employeeId}): ${err?.message || 'Error'}`);
      }
    }

    return { created, errors };
  },

  async deleteUserByAdmin(uid: string): Promise<void> {
    try {
      await deleteDoc(doc(db, USERS_COL, uid));
      try {
        await deleteDoc(doc(db, ADMINS_COL, uid));
      } catch {}
      await this.logAction('USER_DELETED_BY_ADMIN', `User profile ${uid} deleted by administrator.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${USERS_COL}/${uid}`);
    }
  },

  async linkParticipantToExam(participantUid: string, examId: string, examTitle: string): Promise<void> {
    try {
      // 1. Update candidate profile
      await updateDoc(doc(db, USERS_COL, participantUid), {
        assignedExamId: examId,
        assignedExamTitle: examTitle,
        updatedAt: new Date().toISOString(),
      });

      // 2. Add to exam's assignedParticipantIds
      const examSnap = await getDoc(doc(db, EXAMS_COL, examId));
      if (examSnap.exists()) {
        const examData = examSnap.data() as Exam;
        const currentParticipants = examData.assignedParticipantIds || [];
        if (!currentParticipants.includes(participantUid)) {
          await updateDoc(doc(db, EXAMS_COL, examId), {
            assignedParticipantIds: [...currentParticipants, participantUid],
            updatedAt: new Date().toISOString(),
          });
        }
      }

      await this.logAction(
        'PARTICIPANT_LINKED_TO_EXAM',
        `Linked candidate ${participantUid} from general candidate pool to exam: "${examTitle}" (${examId})`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COL}/${participantUid}`);
    }
  },

  async unlinkParticipantFromExam(participantUid: string, examId?: string): Promise<void> {
    try {
      // 1. Update candidate profile to clear assignedExamId & assignedExamTitle
      await updateDoc(doc(db, USERS_COL, participantUid), {
        assignedExamId: deleteField(),
        assignedExamTitle: deleteField(),
        updatedAt: new Date().toISOString(),
      });

      // 2. Remove from exam's assignedParticipantIds if examId is provided
      if (examId) {
        const examSnap = await getDoc(doc(db, EXAMS_COL, examId));
        if (examSnap.exists()) {
          const examData = examSnap.data() as Exam;
          const currentParticipants = examData.assignedParticipantIds || [];
          await updateDoc(doc(db, EXAMS_COL, examId), {
            assignedParticipantIds: currentParticipants.filter((id) => id !== participantUid),
            updatedAt: new Date().toISOString(),
          });
        }
      }

      await this.logAction(
        'PARTICIPANT_UNLINKED_FROM_EXAM',
        `Unlinked candidate ${participantUid} from exam to general candidate pool`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${USERS_COL}/${participantUid}`);
    }
  },

  async linkMultipleParticipantsToExam(
    participantUids: string[],
    examId: string,
    examTitle: string
  ): Promise<number> {
    let count = 0;
    try {
      // 1. Update all participants
      for (const uid of participantUids) {
        await updateDoc(doc(db, USERS_COL, uid), {
          assignedExamId: examId,
          assignedExamTitle: examTitle,
          updatedAt: new Date().toISOString(),
        });
        count++;
      }

      // 2. Update exam's assignedParticipantIds
      const examSnap = await getDoc(doc(db, EXAMS_COL, examId));
      if (examSnap.exists()) {
        const examData = examSnap.data() as Exam;
        const currentParticipants = new Set(examData.assignedParticipantIds || []);
        participantUids.forEach((id) => currentParticipants.add(id));
        await updateDoc(doc(db, EXAMS_COL, examId), {
          assignedParticipantIds: Array.from(currentParticipants),
          updatedAt: new Date().toISOString(),
        });
      }

      await this.logAction(
        'BULK_PARTICIPANTS_LINKED_TO_EXAM',
        `Linked ${count} candidate(s) from candidate pool to exam: "${examTitle}" (${examId})`
      );
      return count;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
      return count;
    }
  },

  // ---- Exams ----
  async getAllExams(): Promise<Exam[]> {
    try {
      const snap = await getDocs(collection(db, EXAMS_COL));
      return snap.docs.map((d) => d.data() as Exam);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, EXAMS_COL);
    }
  },

  async getPublishedExams(): Promise<Exam[]> {
    try {
      const snap = await getDocs(collection(db, EXAMS_COL));
      const all = snap.docs.map((d) => d.data() as Exam);
      return all.filter((e) => e.status === 'published' || e.status === 'in_progress');
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, EXAMS_COL);
    }
  },

  async getExamsBySetter(setterId: string): Promise<Exam[]> {
    try {
      const snap = await getDocs(collection(db, EXAMS_COL));
      const all = snap.docs.map((d) => d.data() as Exam);
      return all.filter((e) => e.setterId === setterId);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, EXAMS_COL);
    }
  },

  async getExamById(examId: string): Promise<Exam | null> {
    try {
      const snap = await getDoc(doc(db, EXAMS_COL, examId));
      if (snap.exists()) {
        return snap.data() as Exam;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${EXAMS_COL}/${examId}`);
    }
  },

  async createExam(exam: Exam): Promise<void> {
    try {
      const cleaned = cleanFirestoreData(exam);
      await setDoc(doc(db, EXAMS_COL, exam.id), cleaned);
      await this.logAction('EXAM_CREATED', `Exam created: "${exam.title}" by ${exam.setterName}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${EXAMS_COL}/${exam.id}`);
    }
  },

  async updateExam(examId: string, updates: Partial<Exam>): Promise<void> {
    try {
      const cleaned = cleanFirestoreData({
        ...updates,
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, EXAMS_COL, examId), cleaned);
      await this.logAction('EXAM_UPDATED', `Exam ${examId} updated`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
    }
  },

  async proposeExamSchedule(
    examId: string,
    data: {
      scheduledStartTime: string;
      scheduledEndTime: string;
      proposedBy: string;
      notes?: string;
    }
  ): Promise<void> {
    try {
      const updates = cleanFirestoreData({
        scheduledStartTime: data.scheduledStartTime,
        scheduledEndTime: data.scheduledEndTime,
        scheduleStatus: 'schedule_proposed',
        scheduleProposedAt: new Date().toISOString(),
        scheduleProposedBy: data.proposedBy,
        scheduleNotes: data.notes || '',
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, EXAMS_COL, examId), updates);
      await this.logAction(
        'EXAM_SCHEDULE_PROPOSED',
        `Paper Setter ${data.proposedBy} proposed live window for exam ${examId}: ${data.scheduledStartTime} to ${data.scheduledEndTime}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
    }
  },

  async authorizeExamSchedule(examId: string, authorizedBy: string): Promise<void> {
    try {
      const updates = cleanFirestoreData({
        scheduleStatus: 'schedule_authorized',
        status: 'published',
        scheduleAuthorizedAt: new Date().toISOString(),
        scheduleAuthorizedBy: authorizedBy,
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, EXAMS_COL, examId), updates);
      await this.logAction(
        'EXAM_SCHEDULE_AUTHORIZED',
        `Administrator ${authorizedBy} authorized live schedule for exam ${examId}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
    }
  },

  async alterExamSchedule(
    examId: string,
    data: {
      scheduledStartTime: string;
      scheduledEndTime: string;
      alteredBy: string;
      notes?: string;
    }
  ): Promise<void> {
    try {
      const updates = cleanFirestoreData({
        scheduledStartTime: data.scheduledStartTime,
        scheduledEndTime: data.scheduledEndTime,
        scheduleStatus: 'schedule_authorized',
        status: 'published',
        scheduleAuthorizedAt: new Date().toISOString(),
        scheduleAuthorizedBy: data.alteredBy,
        scheduleNotes: data.notes || '',
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, EXAMS_COL, examId), updates);
      await this.logAction(
        'EXAM_SCHEDULE_ALTERED',
        `Administrator ${data.alteredBy} altered & authorized live schedule for exam ${examId}: ${data.scheduledStartTime} to ${data.scheduledEndTime}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
    }
  },

  async forwardEvaluationsToAdmin(
    examId: string,
    data: {
      evaluatorId: string;
      evaluatorName: string;
      recommendedResultReleaseTime: string;
      evaluatorRemarks?: string;
    }
  ): Promise<void> {
    try {
      const updates = cleanFirestoreData({
        evaluationForwardStatus: 'forwarded_to_admin',
        evaluationForwardedAt: new Date().toISOString(),
        evaluationForwardedBy: data.evaluatorName,
        recommendedResultReleaseTime: data.recommendedResultReleaseTime,
        evaluatorRemarks: data.evaluatorRemarks || '',
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, EXAMS_COL, examId), updates);
      await this.logAction(
        'EVALUATION_FORWARDED_TO_ADMIN',
        `Evaluator ${data.evaluatorName} forwarded evaluations for exam ${examId} with recommended release: ${data.recommendedResultReleaseTime}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
    }
  },

  async authorizeAndScheduleResultPublication(
    examId: string,
    data: {
      adminName: string;
      scheduledResultReleaseTime: string;
      adminResultNotes?: string;
      publishImmediately?: boolean;
    }
  ): Promise<void> {
    try {
      const isImmediate = Boolean(
        data.publishImmediately ||
        (data.scheduledResultReleaseTime && new Date(data.scheduledResultReleaseTime).getTime() <= Date.now())
      );

      const updates = cleanFirestoreData({
        evaluationForwardStatus: isImmediate ? 'results_published' : 'results_authorized',
        scheduledResultReleaseTime: data.scheduledResultReleaseTime,
        resultsAuthorizedAt: new Date().toISOString(),
        resultsAuthorizedBy: data.adminName,
        resultsPublished: isImmediate,
        resultsPublishedAt: isImmediate ? new Date().toISOString() : '',
        adminResultNotes: data.adminResultNotes || '',
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, EXAMS_COL, examId), updates);
      await this.logAction(
        isImmediate ? 'RESULTS_PUBLISHED_IMMEDIATELY' : 'RESULTS_PUBLICATION_AUTHORIZED',
        `Administrator ${data.adminName} authorized result publication for exam ${examId} (${isImmediate ? 'Live Immediately' : 'Scheduled: ' + data.scheduledResultReleaseTime})`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
    }
  },

  async publishResultsImmediately(examId: string, adminName: string): Promise<void> {
    try {
      const updates = cleanFirestoreData({
        evaluationForwardStatus: 'results_published',
        resultsPublished: true,
        resultsPublishedAt: new Date().toISOString(),
        resultsAuthorizedBy: adminName,
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, EXAMS_COL, examId), updates);
      await this.logAction(
        'RESULTS_PUBLISHED_IMMEDIATELY',
        `Administrator ${adminName} unlocked & published results immediately for exam ${examId}`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
    }
  },

  isResultPublishedForExam(exam?: Exam | null): boolean {
    if (!exam) return false;
    if (exam.resultsPublished === true || exam.evaluationForwardStatus === 'results_published') {
      return true;
    }
    if (
      exam.evaluationForwardStatus === 'results_authorized' &&
      exam.scheduledResultReleaseTime
    ) {
      const releaseTime = new Date(exam.scheduledResultReleaseTime).getTime();
      return !isNaN(releaseTime) && Date.now() >= releaseTime;
    }
    return false;
  },

  async updateExamAssignments(
    examId: string,
    data: {
      setterId: string;
      setterName: string;
      evaluatorId?: string;
      evaluatorName?: string;
      assignedParticipantIds: string[];
    }
  ): Promise<void> {
    try {
      const updates = cleanFirestoreData({
        setterId: data.setterId,
        setterName: data.setterName,
        evaluatorId: data.evaluatorId || '',
        evaluatorName: data.evaluatorName || '',
        assignedParticipantIds: data.assignedParticipantIds || [],
        updatedAt: new Date().toISOString(),
      });
      await updateDoc(doc(db, EXAMS_COL, examId), updates);
      await this.logAction(
        'EXAM_ASSIGNMENTS_UPDATED',
        `Administrator updated role assignments for exam ${examId} (Setter: ${data.setterName}, Evaluator: ${data.evaluatorName || 'None'}, Candidates: ${data.assignedParticipantIds.length})`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
    }
  },

  async deleteExam(examId: string): Promise<void> {
    try {
      // Delete questions first
      const questionsSnap = await getDocs(collection(db, EXAMS_COL, examId, 'questions'));
      for (const qDoc of questionsSnap.docs) {
        await deleteDoc(qDoc.ref);
      }
      await deleteDoc(doc(db, EXAMS_COL, examId));
      await this.logAction('EXAM_DELETED', `Exam ${examId} deleted`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${EXAMS_COL}/${examId}`);
    }
  },

  // ---- Questions ----
  async getQuestions(examId: string, forCandidate: boolean = false): Promise<Question[]> {
    const path = `${EXAMS_COL}/${examId}/questions`;
    try {
      const snap = await getDocs(collection(db, EXAMS_COL, examId, 'questions'));
      const questions = snap.docs.map((d) => d.data() as Question);
      const sorted = questions.sort((a, b) => a.order - b.order);

      if (forCandidate) {
        // Leak Prevention: Strip correct answers, rubrics, and explanations before reaching the candidate's browser
        return sorted.map((q) => {
          const sanitized: Question = {
            ...q,
            correctAnswer: undefined,
            rubric: undefined,
            explanation: undefined,
          };
          delete (sanitized as any).correctAnswer;
          delete (sanitized as any).rubric;
          delete (sanitized as any).explanation;
          return sanitized;
        });
      }

      return sorted;
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
      return [];
    }
  },

  async getQuestionsForCandidate(examId: string): Promise<Question[]> {
    return this.getQuestions(examId, true);
  },

  async saveQuestion(question: Question): Promise<void> {
    const path = `${EXAMS_COL}/${question.examId}/questions/${question.id}`;
    try {
      const cleaned = cleanFirestoreData(question);
      await setDoc(doc(db, EXAMS_COL, question.examId, 'questions', question.id), cleaned);
      // Update exam question count and total marks if exam exists
      try {
        const examDoc = await getDoc(doc(db, EXAMS_COL, question.examId));
        if (examDoc.exists()) {
          const questions = await this.getQuestions(question.examId);
          const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
          await updateDoc(doc(db, EXAMS_COL, question.examId), {
            questionsCount: questions.length,
            totalMarks: totalMarks,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('Could not update exam statistics:', err);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async deleteQuestion(examId: string, questionId: string): Promise<void> {
    const path = `${EXAMS_COL}/${examId}/questions/${questionId}`;
    try {
      await deleteDoc(doc(db, EXAMS_COL, examId, 'questions', questionId));
      try {
        const examDoc = await getDoc(doc(db, EXAMS_COL, examId));
        if (examDoc.exists()) {
          const questions = await this.getQuestions(examId);
          const totalMarks = questions.reduce((sum, q) => sum + (q.marks || 0), 0);
          await updateDoc(doc(db, EXAMS_COL, examId), {
            questionsCount: questions.length,
            totalMarks: totalMarks,
            updatedAt: new Date().toISOString(),
          });
        }
      } catch (err) {
        console.warn('Could not update exam statistics:', err);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  async batchSaveQuestions(examId: string, newQuestions: Question[]): Promise<void> {
    try {
      for (const q of newQuestions) {
        const cleaned = cleanFirestoreData(q);
        await setDoc(doc(db, EXAMS_COL, examId, 'questions', q.id), cleaned);
      }
      // Update exam question count and total marks
      const allQs = await this.getQuestions(examId);
      const totalMarks = allQs.reduce((sum, q) => sum + (q.marks || 0), 0);
      await updateDoc(doc(db, EXAMS_COL, examId), {
        questionsCount: allQs.length,
        totalMarks: totalMarks,
        updatedAt: new Date().toISOString(),
      });
      await this.logAction('BATCH_QUESTIONS_IMPORTED', `Imported ${newQuestions.length} questions into exam ${examId}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${EXAMS_COL}/${examId}/questions`);
      throw error;
    }
  },

  async updateExamAttemptRules(
    examId: string,
    maxQuestionsToAttempt?: number | null
  ): Promise<void> {
    try {
      const updates: any = {
        updatedAt: new Date().toISOString(),
      };
      if (maxQuestionsToAttempt !== undefined) {
        updates.maxQuestionsToAttempt = maxQuestionsToAttempt && maxQuestionsToAttempt > 0 ? maxQuestionsToAttempt : null;
      }
      await updateDoc(doc(db, EXAMS_COL, examId), updates);
      await this.logAction('EXAM_ATTEMPT_RULES_UPDATED', `Updated maxQuestionsToAttempt to ${maxQuestionsToAttempt} for exam ${examId}`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
      throw error;
    }
  },

  // ---- Submissions ----
  async getSubmissionsByParticipant(participantId: string): Promise<Submission[]> {
    try {
      const snap = await getDocs(collection(db, SUBMISSIONS_COL));
      const all = snap.docs.map((d) => d.data() as Submission);
      return all
        .filter((s) => s.participantId === participantId)
        .sort((a, b) => (b.submittedAt || b.startedAt).localeCompare(a.submittedAt || a.startedAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, SUBMISSIONS_COL);
    }
  },

  async getAllSubmissions(): Promise<Submission[]> {
    try {
      const snap = await getDocs(collection(db, SUBMISSIONS_COL));
      return snap.docs
        .map((d) => d.data() as Submission)
        .sort((a, b) => (b.submittedAt || b.startedAt).localeCompare(a.submittedAt || a.startedAt));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, SUBMISSIONS_COL);
    }
  },

  async getSubmissionsForExam(examId: string): Promise<Submission[]> {
    try {
      const snap = await getDocs(collection(db, SUBMISSIONS_COL));
      return snap.docs
        .map((d) => d.data() as Submission)
        .filter((s) => s.examId === examId);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, SUBMISSIONS_COL);
    }
  },

  async getSubmissionById(submissionId: string): Promise<Submission | null> {
    try {
      const snap = await getDoc(doc(db, SUBMISSIONS_COL, submissionId));
      if (snap.exists()) {
        return snap.data() as Submission;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `${SUBMISSIONS_COL}/${submissionId}`);
    }
  },

  async startSubmission(exam: Exam, user: UserProfile): Promise<Submission> {
    const submissionId = `sub_${exam.id}_${user.uid}`;
    const path = `${SUBMISSIONS_COL}/${submissionId}`;
    try {
      // Check if existing
      const existing = await getDoc(doc(db, SUBMISSIONS_COL, submissionId));
      if (existing.exists()) {
        return existing.data() as Submission;
      }

      const newSubmission: Submission = {
        id: submissionId,
        examId: exam.id,
        examTitle: exam.title,
        participantId: user.uid,
        participantName: user.displayName,
        participantEmail: user.email,
        status: 'in_progress',
        answers: {},
        tabSwitchCount: 0,
        startedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, SUBMISSIONS_COL, submissionId), newSubmission);
      await this.logAction('EXAM_STARTED', `${user.displayName} started exam "${exam.title}"`);
      return newSubmission;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async saveDraftAnswer(submissionId: string, answers: Record<string, any>, tabSwitchCount?: number): Promise<void> {
    try {
      const updates: any = {
        answers,
        updatedAt: new Date().toISOString(),
      };
      if (tabSwitchCount !== undefined) {
        updates.tabSwitchCount = tabSwitchCount;
      }
      await updateDoc(doc(db, SUBMISSIONS_COL, submissionId), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SUBMISSIONS_COL}/${submissionId}`);
    }
  },

  async submitExam(
    submissionId: string,
    answers: Record<string, any>,
    exam: Exam,
    questions: Question[],
    tabSwitchCount: number
  ): Promise<Submission> {
    try {
      // Auto-grade objective questions (mcq, boolean)
      let autoTotalScore = 0;
      let hasSubjective = false;

      const scoredAnswers: Record<string, any> = {};

      for (const q of questions) {
        const studentAns = answers[q.id]?.answer?.trim() || '';
        let marks = 0;
        let isEvaluated = false;

        if (q.type === 'mcq' || q.type === 'boolean') {
          isEvaluated = true;
          if (q.correctAnswer && studentAns.toLowerCase() === q.correctAnswer.trim().toLowerCase()) {
            marks = q.marks;
            autoTotalScore += marks;
          }
        } else {
          hasSubjective = true;
          // Remains pending for evaluator
          isEvaluated = false;
        }

        scoredAnswers[q.id] = {
          questionId: q.id,
          answer: studentAns,
          marksObtained: marks,
          isEvaluated: isEvaluated,
          evaluatorFeedback: answers[q.id]?.evaluatorFeedback || '',
        };
      }

      // If exam has no subjective questions, it can be marked 'evaluated' immediately!
      const status = hasSubjective ? 'submitted' : 'evaluated';
      const percentage = exam.totalMarks > 0 ? Math.round((autoTotalScore / exam.totalMarks) * 100) : 0;
      const passed = autoTotalScore >= exam.passingMarks;

      const attemptedQuestionsCount = questions.filter((q) => Boolean(answers[q.id]?.answer?.trim())).length;
      const compulsoryQuestions = questions.filter((q) => Boolean(q.isMandatory));
      const compulsoryAttemptedCount = compulsoryQuestions.filter((q) => Boolean(answers[q.id]?.answer?.trim())).length;

      const updates: Partial<Submission> = {
        answers: scoredAnswers,
        status,
        submittedAt: new Date().toISOString(),
        tabSwitchCount,
        totalScore: autoTotalScore,
        maxScore: exam.totalMarks,
        percentage,
        passed: !hasSubjective ? passed : false,
        attemptedQuestionsCount,
        compulsoryAttemptedCount,
        compulsoryTotalCount: compulsoryQuestions.length,
        updatedAt: new Date().toISOString(),
        ...(status === 'evaluated' ? { evaluatedAt: new Date().toISOString() } : {}),
      };

      await updateDoc(doc(db, SUBMISSIONS_COL, submissionId), updates);
      await this.logAction('EXAM_SUBMITTED', `Submission completed for exam "${exam.title}" (Score: ${autoTotalScore}/${exam.totalMarks})`);

      const updatedSnap = await getDoc(doc(db, SUBMISSIONS_COL, submissionId));
      return updatedSnap.data() as Submission;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SUBMISSIONS_COL}/${submissionId}`);
    }
  },

  async evaluateSubmission(
    submissionId: string,
    answers: Record<string, any>,
    exam: Exam,
    evaluatorNotes: string,
    evaluatorId: string
  ): Promise<void> {
    try {
      let finalTotalScore = 0;
      for (const qId in answers) {
        finalTotalScore += Number(answers[qId].marksObtained || 0);
      }

      const percentage = exam.totalMarks > 0 ? Math.round((finalTotalScore / exam.totalMarks) * 100) : 0;
      const passed = finalTotalScore >= exam.passingMarks;

      const updates: Partial<Submission> = {
        answers,
        totalScore: finalTotalScore,
        maxScore: exam.totalMarks,
        percentage,
        passed,
        status: 'evaluated',
        evaluatorId,
        evaluatorNotes,
        evaluatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(doc(db, SUBMISSIONS_COL, submissionId), updates);
      await this.logAction('SUBMISSION_EVALUATED', `Submission ${submissionId} evaluated. Final score: ${finalTotalScore}/${exam.totalMarks} (${passed ? 'PASSED' : 'FAILED'})`);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SUBMISSIONS_COL}/${submissionId}`);
    }
  },

  // Finalize and release grade for objective question papers (MCQ / True-False)
  // RULE: Evaluator does not input each score for MCQ & True/False; evaluated automatically against Paper Setter's key.
  async finalizeObjectiveSubmission(
    submissionId: string,
    evaluatorId: string,
    evaluatorName: string,
    evaluatorNotes?: string
  ): Promise<Submission> {
    try {
      const subRef = doc(db, SUBMISSIONS_COL, submissionId);
      const subSnap = await getDoc(subRef);
      if (!subSnap.exists()) throw new Error('Submission not found');
      const sub = subSnap.data() as Submission;

      const examRef = doc(db, EXAMS_COL, sub.examId);
      const examSnap = await getDoc(examRef);
      if (!examSnap.exists()) throw new Error('Exam not found');
      const exam = examSnap.data() as Exam;

      const questions = await this.getQuestions(sub.examId);
      const updatedAnswers: Record<string, any> = { ...(sub.answers || {}) };

      let totalScore = 0;
      for (const q of questions) {
        const currentAnsItem = updatedAnswers[q.id];
        const studentAns = (currentAnsItem?.answer || '').trim();

        if (q.type === 'mcq' || q.type === 'boolean') {
          // Evaluated automatically according to correct option provided by paper setter
          const isCorrect = q.correctAnswer && studentAns.toLowerCase() === q.correctAnswer.trim().toLowerCase();
          const marks = isCorrect ? q.marks : 0;
          totalScore += marks;

          updatedAnswers[q.id] = {
            ...(currentAnsItem || { questionId: q.id, answer: studentAns }),
            marksObtained: marks,
            isEvaluated: true,
            evaluatorFeedback: isCorrect
              ? `Auto-evaluated: Correct as per Paper Setter answer key ("${q.correctAnswer}"). Full marks awarded.`
              : studentAns
              ? `Auto-evaluated: Incorrect. Selected "${studentAns}", correct option was "${q.correctAnswer}".`
              : `Auto-evaluated: Question unattempted by candidate.`,
          };
        } else {
          // Descriptive: keep existing evaluated marks or 0
          totalScore += Number(currentAnsItem?.marksObtained || 0);
        }
      }

      const effectiveTotalMarks = exam.totalMarks || sub.maxScore || 100;
      const effectivePassingMarks = exam.passingMarks || Math.round(effectiveTotalMarks * 0.4);
      const percentage = effectiveTotalMarks > 0 ? Math.round((totalScore / effectiveTotalMarks) * 100) : 0;
      const passed = totalScore >= effectivePassingMarks;

      const updates: Partial<Submission> = {
        answers: updatedAnswers,
        totalScore,
        maxScore: effectiveTotalMarks,
        percentage,
        passed,
        status: 'evaluated',
        evaluatorId,
        evaluatorNotes: evaluatorNotes || `Evaluated automatically from Paper Setter answer keys and grade finalized by ${evaluatorName}.`,
        evaluatedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await updateDoc(subRef, updates);
      await this.logAction(
        'OBJECTIVE_PAPER_FINALIZED',
        `Evaluator ${evaluatorName} finalized & released grade for submission ${sub.id} (Candidate: ${sub.participantName}, Score: ${totalScore}/${effectiveTotalMarks}).`
      );

      const updatedSnap = await getDoc(subRef);
      return updatedSnap.data() as Submission;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${SUBMISSIONS_COL}/${submissionId}`);
      throw error;
    }
  },

  // Batch finalize all pending objective submissions for an exam
  async batchFinalizeObjectiveSubmissions(
    examId: string,
    evaluatorId: string,
    evaluatorName: string
  ): Promise<{ finalizedCount: number }> {
    try {
      const subs = await this.getSubmissionsForExam(examId);
      const pendingSubs = subs.filter((s) => s.status === 'submitted');
      let finalizedCount = 0;

      for (const s of pendingSubs) {
        await this.finalizeObjectiveSubmission(s.id, evaluatorId, evaluatorName);
        finalizedCount++;
      }

      return { finalizedCount };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
      throw error;
    }
  },

  // ---- Question Challenges & Result Appeals Workflow ----
  async submitQuestionChallenge(data: {
    examId: string;
    examTitle: string;
    submissionId: string;
    questionId: string;
    questionTitle: string;
    questionType?: string;
    questionMarks: number;
    participantId: string;
    participantName: string;
    participantEmail: string;
    candidateAnswer: string;
    originalMarksAwarded: number;
    originalEvaluatorFeedback?: string;
    challengeReason: ChallengeReason;
    candidateExplanation: string;
    supportingReference?: string;
  }): Promise<QuestionChallenge> {
    try {
      const challengeId = 'ch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
      const challenge: QuestionChallenge = {
        ...data,
        id: challengeId,
        status: 'submitted',
        submittedAt: new Date().toISOString(),
      };

      await setDoc(doc(db, CHALLENGES_COL, challengeId), cleanFirestoreData(challenge));

      // Update the submission's answer item to track challenge
      const subRef = doc(db, SUBMISSIONS_COL, data.submissionId);
      const subSnap = await getDoc(subRef);
      if (subSnap.exists()) {
        const subData = subSnap.data() as Submission;
        const answers = { ...(subData.answers || {}) };
        if (answers[data.questionId]) {
          answers[data.questionId] = {
            ...answers[data.questionId],
            challengeId,
            challengeStatus: 'submitted',
          };
          await updateDoc(subRef, { answers });
        }
      }

      await this.logAction(
        'QUESTION_CHALLENGE_SUBMITTED',
        `Candidate ${data.participantName} challenged question "${data.questionTitle}" in exam "${data.examTitle}" (Reason: ${data.challengeReason})`
      );

      return challenge;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, CHALLENGES_COL);
      throw error;
    }
  },

  async getChallengesForParticipant(participantId: string): Promise<QuestionChallenge[]> {
    try {
      const snap = await getDocs(
        query(collection(db, CHALLENGES_COL), where('participantId', '==', participantId))
      );
      return snap.docs
        .map((d) => d.data() as QuestionChallenge)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    } catch (error) {
      console.warn('Error fetching participant challenges:', error);
      return [];
    }
  },

  async getChallengesForExam(examId: string): Promise<QuestionChallenge[]> {
    try {
      const snap = await getDocs(
        query(collection(db, CHALLENGES_COL), where('examId', '==', examId))
      );
      return snap.docs
        .map((d) => d.data() as QuestionChallenge)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    } catch (error) {
      console.warn('Error fetching exam challenges:', error);
      return [];
    }
  },

  async getAllChallenges(): Promise<QuestionChallenge[]> {
    try {
      const snap = await getDocs(collection(db, CHALLENGES_COL));
      return snap.docs
        .map((d) => d.data() as QuestionChallenge)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    } catch (error) {
      console.warn('Error fetching all challenges:', error);
      return [];
    }
  },

  async evaluatorReviewChallenge(
    challengeId: string,
    data: {
      evaluatorId: string;
      evaluatorName: string;
      evaluatorDecision: 'recommend_accept' | 'recommend_reject' | 'recommend_skip_question';
      evaluatorRecommendedMarks?: number;
      evaluatorReviewNotes: string;
    }
  ): Promise<void> {
    try {
      const chRef = doc(db, CHALLENGES_COL, challengeId);
      const chSnap = await getDoc(chRef);
      if (!chSnap.exists()) throw new Error('Challenge record not found');
      const challenge = chSnap.data() as QuestionChallenge;

      const updates: Partial<QuestionChallenge> = {
        status: 'forwarded_to_admin',
        evaluatorId: data.evaluatorId,
        evaluatorName: data.evaluatorName,
        evaluatorDecision: data.evaluatorDecision,
        evaluatorRecommendedMarks:
          data.evaluatorDecision === 'recommend_accept' ? Number(data.evaluatorRecommendedMarks ?? challenge.originalMarksAwarded) : challenge.originalMarksAwarded,
        evaluatorReviewNotes: data.evaluatorReviewNotes,
        evaluatorReviewedAt: new Date().toISOString(),
      };

      await updateDoc(chRef, cleanFirestoreData(updates));

      // Update submission answer challengeStatus
      const subRef = doc(db, SUBMISSIONS_COL, challenge.submissionId);
      const subSnap = await getDoc(subRef);
      if (subSnap.exists()) {
        const subData = subSnap.data() as Submission;
        const answers = { ...(subData.answers || {}) };
        if (answers[challenge.questionId]) {
          answers[challenge.questionId] = {
            ...answers[challenge.questionId],
            challengeStatus: 'forwarded_to_admin',
          };
          await updateDoc(subRef, { answers });
        }
      }

      await this.logAction(
        'CHALLENGE_EVALUATOR_REVIEWED',
        `Evaluator ${data.evaluatorName} reviewed challenge for "${challenge.questionTitle}" and recommended ${
          data.evaluatorDecision === 'recommend_accept'
            ? `revision to ${data.evaluatorRecommendedMarks} marks`
            : 'upholding original mark'
        }. Forwarded to Administrator for authorization.`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${CHALLENGES_COL}/${challengeId}`);
      throw error;
    }
  },

  async adminResolveChallenge(
    challengeId: string,
    data: {
      adminId: string;
      adminName: string;
      decision: 'accept_revision' | 'uphold_original';
      finalAwardedMarks?: number;
      adminNotes: string;
    }
  ): Promise<void> {
    try {
      const chRef = doc(db, CHALLENGES_COL, challengeId);
      const chSnap = await getDoc(chRef);
      if (!chSnap.exists()) throw new Error('Challenge record not found');
      const challenge = chSnap.data() as QuestionChallenge;

      const newStatus: ChallengeStatus =
        data.decision === 'accept_revision' ? 'resolved_accepted' : 'resolved_rejected';

      const resolvedMarks =
        data.decision === 'accept_revision' && data.finalAwardedMarks !== undefined
          ? Number(data.finalAwardedMarks)
          : challenge.originalMarksAwarded;

      const updates: Partial<QuestionChallenge> = {
        status: newStatus,
        adminId: data.adminId,
        adminName: data.adminName,
        adminDecision: data.decision,
        finalAwardedMarks: resolvedMarks,
        adminDecisionNotes: data.adminNotes,
        resolvedAt: new Date().toISOString(),
      };

      await updateDoc(chRef, cleanFirestoreData(updates));

      // Update the submission and recalculate scores
      const subRef = doc(db, SUBMISSIONS_COL, challenge.submissionId);
      const subSnap = await getDoc(subRef);
      if (subSnap.exists()) {
        const subData = subSnap.data() as Submission;
        const answers = { ...(subData.answers || {}) };

        const examDoc = await getDoc(doc(db, EXAMS_COL, challenge.examId));
        const exam = examDoc.exists() ? (examDoc.data() as Exam) : null;
        const examTotal = exam ? exam.totalMarks : (subData.maxScore || 100);
        const examPassing = exam ? exam.passingMarks : Math.round(examTotal * 0.4);

        // Snapshot candidate data, marks, scorecard, and answers before resolution
        const beforeSnapshot: CandidateChallengeSnapshot = subData.beforeChallengeSnapshot || {
          capturedAt: new Date().toISOString(),
          actionType: 'challenge_resolution',
          questionId: challenge.questionId,
          questionTitle: challenge.questionTitle,
          reason: data.adminNotes,
          totalMarks: examTotal,
          passingMarks: examPassing,
          totalScore: subData.totalScore ?? 0,
          maxScore: subData.maxScore ?? examTotal,
          percentage: subData.percentage ?? 0,
          passed: subData.passed ?? false,
          answers: JSON.parse(JSON.stringify(subData.answers || {})),
        };

        if (answers[challenge.questionId]) {
          const currentAns = answers[challenge.questionId];
          const rawAns = (currentAns?.answer || '').trim();
          const isAttempted = Boolean(
            rawAns &&
            rawAns !== '(Unattempted)' &&
            rawAns !== '(No response)' &&
            rawAns !== '(None)'
          );

          // Marks only increased if candidate attempted the question
          const finalMarksAwarded = isAttempted ? resolvedMarks : 0;

          answers[challenge.questionId] = {
            ...currentAns,
            marksObtained: finalMarksAwarded,
            challengeStatus: newStatus,
            evaluatorFeedback:
              data.decision === 'accept_revision'
                ? isAttempted
                  ? `${currentAns.evaluatorFeedback || ''} [Marks revised to ${finalMarksAwarded} on Admin challenge authorization: "${data.adminNotes}"]`.trim()
                  : `${currentAns.evaluatorFeedback || ''} [Question was unattempted: No marks awarded]`.trim()
                : `${currentAns.evaluatorFeedback || ''} [Challenge reviewed and original mark upheld by Admin: "${data.adminNotes}"]`.trim(),
          };

          // Recalculate total score and round off to the next nearest integer
          let totalScore = 0;
          Object.values(answers).forEach((ans) => {
            totalScore += Number(ans.marksObtained || 0);
          });

          const roundedScore = Math.ceil(totalScore); // Rounded off to the next nearest integer
          const maxScore = exam ? exam.totalMarks : (subData.maxScore || 100);
          const percentage = maxScore > 0 ? Math.round((roundedScore / maxScore) * 100) : 0;
          const passingMarks = exam ? exam.passingMarks : (maxScore * 0.4);
          const passed = roundedScore >= passingMarks;

          await updateDoc(subRef, {
            answers,
            totalScore: roundedScore,
            percentage,
            passed,
            beforeChallengeSnapshot: beforeSnapshot,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      await this.logAction(
        'CHALLENGE_ADMIN_RESOLVED',
        `Administrator ${data.adminName} resolved challenge for "${challenge.questionTitle}" with decision: ${
          data.decision === 'accept_revision'
            ? `ACCEPTED (Revised to ${resolvedMarks} marks)`
            : 'REJECTED (Original score upheld)'
        }`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${CHALLENGES_COL}/${challengeId}`);
      throw error;
    }
  },

  // ---- Paper Setter Review of Question Challenge ----
  async setterReviewChallenge(
    challengeId: string,
    data: {
      setterId: string;
      setterName: string;
      setterDecision: 'recommend_alter_key' | 'uphold_original' | 'recommend_skip_question';
      setterProposedAnswer?: string;
      setterReviewNotes: string;
    }
  ): Promise<void> {
    try {
      const chRef = doc(db, CHALLENGES_COL, challengeId);
      const chSnap = await getDoc(chRef);
      if (!chSnap.exists()) throw new Error('Challenge record not found');
      const challenge = chSnap.data() as QuestionChallenge;

      const updates: Partial<QuestionChallenge> = {
        status: 'under_evaluator_review',
        setterId: data.setterId,
        setterName: data.setterName,
        setterDecision: data.setterDecision,
        setterProposedAnswer: data.setterProposedAnswer || '',
        setterReviewNotes: data.setterReviewNotes,
        setterReviewedAt: new Date().toISOString(),
      };

      await updateDoc(chRef, cleanFirestoreData(updates));

      await this.logAction(
        'CHALLENGE_SETTER_REVIEWED',
        `Paper Setter ${data.setterName} reviewed challenge for "${challenge.questionTitle}". Recommendation: ${data.setterDecision} ("${data.setterReviewNotes}")`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${CHALLENGES_COL}/${challengeId}`);
      throw error;
    }
  },

  // ---- Batch Challenge Submission (Single-Time Submission per Candidate) ----
  async submitBatchChallenges(
    submissionId: string,
    examId: string,
    examTitle: string,
    participantId: string,
    participantName: string,
    participantEmail: string,
    challenges: Array<{
      questionId: string;
      questionTitle: string;
      questionType?: string;
      questionMarks: number;
      candidateAnswer: string;
      originalMarksAwarded: number;
      originalEvaluatorFeedback?: string;
      challengeReason: ChallengeReason;
      candidateExplanation: string;
      supportingReference?: string;
    }>
  ): Promise<QuestionChallenge[]> {
    try {
      // Check if candidate already submitted challenges for this exam
      const subRef = doc(db, SUBMISSIONS_COL, submissionId);
      const subSnap = await getDoc(subRef);
      if (!subSnap.exists()) throw new Error('Submission not found');
      const subData = subSnap.data() as Submission;

      if (subData.challengeSubmitted) {
        throw new Error('Challenges have already been submitted for this examination. Re-submission is locked.');
      }

      // Check exam challenge deadline
      const examDoc = await getDoc(doc(db, EXAMS_COL, examId));
      if (examDoc.exists()) {
        const examData = examDoc.data() as Exam;
        if (examData.challengeDeadline) {
          const deadlinePassed = new Date() > new Date(examData.challengeDeadline);
          if (deadlinePassed) {
            throw new Error(`The scheduled challenge window for this examination expired on ${new Date(examData.challengeDeadline).toLocaleString()}. No new challenges can be submitted.`);
          }
        }
      }

      const createdList: QuestionChallenge[] = [];
      const updatedAnswers = { ...(subData.answers || {}) };

      for (const item of challenges) {
        const challengeId = 'ch_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
        const newChallenge: QuestionChallenge = {
          ...item,
          id: challengeId,
          examId,
          examTitle,
          submissionId,
          participantId,
          participantName,
          participantEmail,
          status: 'submitted',
          submittedAt: new Date().toISOString(),
        };

        await setDoc(doc(db, CHALLENGES_COL, challengeId), cleanFirestoreData(newChallenge));
        createdList.push(newChallenge);

        if (updatedAnswers[item.questionId]) {
          updatedAnswers[item.questionId] = {
            ...updatedAnswers[item.questionId],
            challengeId,
            challengeStatus: 'submitted',
          };
        }
      }

      // Mark submission as challengeSubmitted to enforce single-time submission
      await updateDoc(subRef, {
        answers: updatedAnswers,
        challengeSubmitted: true,
        challengeSubmittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      await this.logAction(
        'BATCH_CHALLENGES_SUBMITTED',
        `Candidate ${participantName} submitted ${challenges.length} challenge(s) for exam "${examTitle}" at a single time.`
      );

      return createdList;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, CHALLENGES_COL);
      throw error;
    }
  },

  // ---- Administrator Sets Challenge Deadline Window ----
  async setExamChallengeDeadline(
    examId: string,
    deadline: string,
    windowOpen: boolean,
    adminName: string
  ): Promise<void> {
    try {
      await updateDoc(doc(db, EXAMS_COL, examId), {
        challengeDeadline: deadline,
        challengeWindowOpen: windowOpen,
        updatedAt: new Date().toISOString(),
      });

      await this.logAction(
        'CHALLENGE_DEADLINE_SET',
        `Administrator ${adminName} configured challenge deadline for exam ${examId} to ${new Date(deadline).toLocaleString()} (Window open: ${windowOpen})`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
      throw error;
    }
  },

  // ---- Recommend Question Skip (Evaluator or Paper Setter) ----
  async recommendSkipQuestion(
    examId: string,
    questionId: string,
    recommenderId: string,
    recommenderName: string,
    role: 'evaluator' | 'paper_setter',
    reason: string
  ): Promise<void> {
    try {
      const qRef = doc(db, EXAMS_COL, examId, 'questions', questionId);
      await updateDoc(qRef, {
        skipRecommendation: {
          recommendedBy: recommenderName,
          role,
          reason,
          recommendedAt: new Date().toISOString(),
          status: 'pending',
        },
      });

      await this.logAction(
        'QUESTION_SKIP_RECOMMENDED',
        `${role === 'evaluator' ? 'Evaluator' : 'Paper Setter'} ${recommenderName} recommended skipping question ${questionId} in exam ${examId}: "${reason}"`
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}/questions/${questionId}`);
      throw error;
    }
  },

  // ---- Approve Question Skip & Re-score ALL Candidates ----
  async approveSkipQuestionAndReScoreAll(
    examId: string,
    questionId: string,
    adminId: string,
    adminName: string,
    reason: string
  ): Promise<{ affectedCount: number; unattemptedCount: number }> {
    try {
      // 1. Fetch Question details
      const qRef = doc(db, EXAMS_COL, examId, 'questions', questionId);
      const qSnap = await getDoc(qRef);
      if (!qSnap.exists()) throw new Error('Question not found');
      const question = qSnap.data() as Question;

      // 2. Mark Question as skipped
      await updateDoc(qRef, {
        isSkipped: true,
        'skipRecommendation.status': 'approved',
      });

      // 3. Update Exam record:
      // RULE: On Debatable Question Skip, total marks of the exam will decreased. Passing marks also be decreased proportionately and evaluation will be done accordingly.
      const examRef = doc(db, EXAMS_COL, examId);
      const examSnap = await getDoc(examRef);
      if (!examSnap.exists()) throw new Error('Exam not found');
      const examData = examSnap.data() as Exam;

      const originalTotal = examData.originalTotalMarks || examData.totalMarks || 100;
      const originalPassing = examData.originalPassingMarks || examData.passingMarks || Math.round(originalTotal * 0.4);
      const currentTotal = examData.totalMarks || originalTotal;
      const currentPassing = examData.passingMarks || originalPassing;

      const questionMarks = Number(question.marks || 0);
      // Decrease total marks of the exam by the debatable question's marks
      const newTotalMarks = Math.max(1, currentTotal - questionMarks);
      // Passing marks also decreased proportionately
      const proportion = originalTotal > 0 ? (originalPassing / originalTotal) : 0.4;
      const newPassingMarks = Math.max(1, Math.round(proportion * newTotalMarks));

      const currentSkippedIds = examData.skippedQuestionIds || [];
      const updatedSkippedIds = currentSkippedIds.includes(questionId)
        ? currentSkippedIds
        : [...currentSkippedIds, questionId];

      const updatedSkippedInfo = {
        ...(examData.skippedQuestionsInfo || {}),
        [questionId]: {
          reason,
          recommendedBy: question.skipRecommendation?.recommendedBy || 'Evaluator',
          role: question.skipRecommendation?.role || 'evaluator',
          approvedBy: adminName,
          approvedAt: new Date().toISOString(),
          marksCredited: 0,
        },
      };

      await updateDoc(examRef, {
        totalMarks: newTotalMarks,
        passingMarks: newPassingMarks,
        originalTotalMarks: originalTotal,
        originalPassingMarks: originalPassing,
        skippedQuestionIds: updatedSkippedIds,
        skippedQuestionsInfo: updatedSkippedInfo,
        updatedAt: new Date().toISOString(),
      });

      // 4. Recalculate Candidate Submissions for this exam
      // Evaluation is done accordingly: candidate total score is re-evaluated across remaining questions,
      // and Administrator preserves the candidate data, marks, scorecard, answer sheet before and after resolution.
      const allSubmissions = await this.getSubmissionsForExam(examId);
      let affectedCount = 0;
      let unattemptedCount = 0;

      for (const sub of allSubmissions) {
        const answers = { ...(sub.answers || {}) };
        const currentAns = answers[questionId];
        const rawStudentAns = (currentAns?.answer || '').trim();

        // Capture snapshot before challenge resolution so Administrator has full data, marks, scorecard, answer sheet
        const beforeSnapshot: CandidateChallengeSnapshot = sub.beforeChallengeSnapshot || {
          capturedAt: new Date().toISOString(),
          actionType: 'debatable_question_skipped',
          questionId,
          questionTitle: question.title,
          reason,
          totalMarks: currentTotal,
          passingMarks: currentPassing,
          totalScore: sub.totalScore ?? 0,
          maxScore: sub.maxScore ?? currentTotal,
          percentage: sub.percentage ?? (currentTotal > 0 ? Math.round(((sub.totalScore ?? 0) / currentTotal) * 100) : 0),
          passed: sub.passed ?? ((sub.totalScore ?? 0) >= currentPassing),
          answers: JSON.parse(JSON.stringify(sub.answers || {})),
        };

        const isAttempted = Boolean(
          rawStudentAns &&
          rawStudentAns !== '(Unattempted)' &&
          rawStudentAns !== '(No response)' &&
          rawStudentAns !== '(None)'
        );

        if (isAttempted) {
          affectedCount++;
        } else {
          unattemptedCount++;
        }

        // Skipped debatable question is excluded from evaluation
        answers[questionId] = {
          ...(currentAns || { questionId, answer: rawStudentAns || '(Unattempted)' }),
          marksObtained: 0,
          isEvaluated: true,
          isSkipped: true,
          evaluatorFeedback: `[Debatable Question Skipped]: Question withdrawn from evaluation by Administrator (${adminName}). Exam total marks decreased from ${currentTotal} to ${newTotalMarks}, passing marks decreased proportionately from ${currentPassing} to ${newPassingMarks}. Reason: "${reason}".`,
        };

        // Recalculate total score across remaining active (non-skipped) questions
        let rawTotal = 0;
        Object.entries(answers).forEach(([qId, ans]) => {
          if (!updatedSkippedIds.includes(qId)) {
            rawTotal += Number(ans.marksObtained || 0);
          }
        });

        const roundedScore = Math.ceil(rawTotal); // Rounded off to the next nearest integer
        const percentage = newTotalMarks > 0 ? Math.round((roundedScore / newTotalMarks) * 100) : 0;
        const passed = roundedScore >= newPassingMarks;

        await updateDoc(doc(db, SUBMISSIONS_COL, sub.id), {
          answers,
          totalScore: roundedScore,
          maxScore: newTotalMarks,
          percentage,
          passed,
          beforeChallengeSnapshot: beforeSnapshot,
          updatedAt: new Date().toISOString(),
        });
      }

      await this.logAction(
        'QUESTION_SKIPPED_ALL_RESCORED',
        `Administrator ${adminName} approved skipping debatable question "${question.title}" (ID: ${questionId}). Exam total marks decreased from ${currentTotal} to ${newTotalMarks}. Passing marks decreased proportionately from ${currentPassing} to ${newPassingMarks}. Re-evaluated ${allSubmissions.length} candidates (${affectedCount} attempted, ${unattemptedCount} unattempted).`
      );

      return { affectedCount, unattemptedCount };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
      throw error;
    }
  },

  // ---- Alter Answer Key on Challenge & Re-score Candidates (Excluding Descriptive) ----
  // RULE: On challenge of a question, number will be increased/decreased for those candidates who attempted the question.
  async alterAnswerKeyAndReScoreAll(
    examId: string,
    questionId: string,
    newCorrectAnswer: string,
    adminId: string,
    adminName: string,
    notes: string
  ): Promise<{ affectedCount: number; increasedCount: number; decreasedCount: number; unattemptedCount: number }> {
    try {
      // 1. Fetch Question details
      const qRef = doc(db, EXAMS_COL, examId, 'questions', questionId);
      const qSnap = await getDoc(qRef);
      if (!qSnap.exists()) throw new Error('Question not found');
      const question = qSnap.data() as Question;

      // Update question's correct answer
      await updateDoc(qRef, {
        correctAnswer: newCorrectAnswer.trim(),
      });

      // 2. Fetch Exam details
      const examRef = doc(db, EXAMS_COL, examId);
      const examSnap = await getDoc(examRef);
      if (!examSnap.exists()) throw new Error('Exam not found');
      const examData = examSnap.data() as Exam;

      // 3. Recalculate Candidate Submissions for this exam
      // Marks increased or decreased strictly for candidates who ATTEMPTED the question
      const allSubmissions = await this.getSubmissionsForExam(examId);
      let affectedCount = 0;
      let increasedCount = 0;
      let decreasedCount = 0;
      let unattemptedCount = 0;

      for (const sub of allSubmissions) {
        const answers = { ...(sub.answers || {}) };

        // Process only non-descriptive objective questions (MCQ / Boolean)
        if (question.type === 'mcq' || question.type === 'boolean') {
          const currentAnsItem = answers[questionId];
          const rawStudentAns = (currentAnsItem?.answer || '').trim();

          // Capture snapshot before challenge resolution so Administrator has full data, marks, scorecard, answer sheet
          const beforeSnapshot: CandidateChallengeSnapshot = sub.beforeChallengeSnapshot || {
            capturedAt: new Date().toISOString(),
            actionType: 'challenge_answer_key_revision',
            questionId,
            questionTitle: question.title,
            reason: notes,
            totalMarks: examData.totalMarks || sub.maxScore || 100,
            passingMarks: examData.passingMarks || Math.round((examData.totalMarks || 100) * 0.4),
            totalScore: sub.totalScore ?? 0,
            maxScore: sub.maxScore ?? examData.totalMarks ?? 100,
            percentage: sub.percentage ?? 0,
            passed: sub.passed ?? false,
            answers: JSON.parse(JSON.stringify(sub.answers || {})),
          };

          const isAttempted = Boolean(
            rawStudentAns &&
            rawStudentAns !== '(Unattempted)' &&
            rawStudentAns !== '(No response)' &&
            rawStudentAns !== '(None)'
          );

          if (!isAttempted) {
            // Candidate did NOT attempt the question: marks remain 0 without increase or decrease
            unattemptedCount++;
            answers[questionId] = {
              ...(currentAnsItem || { questionId, answer: '(Unattempted)' }),
              marksObtained: 0,
              isEvaluated: true,
              evaluatorFeedback: `[Key Revised on Challenge]: Question was unattempted by candidate. No marks awarded.`,
            };
          } else {
            // Candidate ATTEMPTED the question: marks increase or decrease based on new key
            const previousMarks = Number(currentAnsItem?.marksObtained || 0);
            const isCorrect = rawStudentAns.toLowerCase() === newCorrectAnswer.trim().toLowerCase();
            const newMarks = isCorrect ? question.marks : 0;

            if (newMarks > previousMarks) {
              increasedCount++;
            } else if (newMarks < previousMarks) {
              decreasedCount++;
            }

            answers[questionId] = {
              ...(currentAnsItem || { questionId, answer: rawStudentAns }),
              marksObtained: newMarks,
              isEvaluated: true,
              evaluatorFeedback:
                newMarks > previousMarks
                  ? `[Key Revised on Challenge]: Candidate attempted this question with "${rawStudentAns}". Matches revised key "${newCorrectAnswer}". Marks increased from ${previousMarks} to ${newMarks}/${question.marks}. Note: "${notes}"`
                  : newMarks < previousMarks
                  ? `[Key Revised on Challenge]: Candidate attempted this question with "${rawStudentAns}". Does not match revised key "${newCorrectAnswer}". Marks decreased from ${previousMarks} to ${newMarks}/${question.marks}. Note: "${notes}"`
                  : `[Key Revised on Challenge]: Candidate attempted this question with "${rawStudentAns}". Evaluated with revised key "${newCorrectAnswer}". Awarded: ${newMarks}/${question.marks}. Note: "${notes}"`,
            };

            affectedCount++;
          }

          // Recalculate total score rounded off to the next nearest integer
          let rawTotal = 0;
          Object.values(answers).forEach((ans) => {
            rawTotal += Number(ans.marksObtained || 0);
          });

          const roundedScore = Math.ceil(rawTotal); // Rounded off to the next nearest integer
          const maxScore = examData.totalMarks || sub.maxScore || 100;
          const percentage = maxScore > 0 ? Math.round((roundedScore / maxScore) * 100) : 0;
          const passed = roundedScore >= examData.passingMarks;

          await updateDoc(doc(db, SUBMISSIONS_COL, sub.id), {
            answers,
            totalScore: roundedScore,
            percentage,
            passed,
            beforeChallengeSnapshot: beforeSnapshot,
            updatedAt: new Date().toISOString(),
          });
        }
      }

      await this.logAction(
        'ANSWER_KEY_ALTERED_ALL_RESCORED',
        `Administrator ${adminName} altered answer key for question "${question.title}" to "${newCorrectAnswer}". Re-scored ${affectedCount} candidates who attempted (${increasedCount} marks increased, ${decreasedCount} marks decreased, ${unattemptedCount} unattempted kept at 0 marks).`
      );

      return { affectedCount, increasedCount, decreasedCount, unattemptedCount };
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `${EXAMS_COL}/${examId}`);
      throw error;
    }
  },
};
