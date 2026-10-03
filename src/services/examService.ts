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
import { Exam, Question, Submission, UserProfile, AuditLog, UserRole, SystemPasscodes, QuestionChallenge, ChallengeStatus, ChallengeReason } from '../types/exam';
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
  async getQuestions(examId: string): Promise<Question[]> {
    const path = `${EXAMS_COL}/${examId}/questions`;
    try {
      const snap = await getDocs(collection(db, EXAMS_COL, examId, 'questions'));
      const questions = snap.docs.map((d) => d.data() as Question);
      return questions.sort((a, b) => a.order - b.order);
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
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

      const updates: Partial<Submission> = {
        answers: scoredAnswers,
        status,
        submittedAt: new Date().toISOString(),
        tabSwitchCount,
        totalScore: autoTotalScore,
        maxScore: exam.totalMarks,
        percentage,
        passed: !hasSubjective ? passed : false,
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
      evaluatorDecision: 'recommend_accept' | 'recommend_reject';
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

        if (answers[challenge.questionId]) {
          answers[challenge.questionId] = {
            ...answers[challenge.questionId],
            marksObtained: resolvedMarks,
            challengeStatus: newStatus,
            evaluatorFeedback:
              data.decision === 'accept_revision'
                ? `${answers[challenge.questionId].evaluatorFeedback || ''} [Marks revised to ${resolvedMarks} by Admin authorization on challenge review: "${data.adminNotes}"]`.trim()
                : `${answers[challenge.questionId].evaluatorFeedback || ''} [Challenge reviewed and original mark upheld by Admin: "${data.adminNotes}"]`.trim(),
          };

          // Recalculate total score
          let totalScore = 0;
          Object.values(answers).forEach((ans) => {
            totalScore += Number(ans.marksObtained || 0);
          });

          // Fetch exam for passingMarks & maxMarks
          const examDoc = await getDoc(doc(db, EXAMS_COL, challenge.examId));
          const exam = examDoc.exists() ? (examDoc.data() as Exam) : null;
          const maxScore = exam ? exam.totalMarks : (subData.maxScore || 100);
          const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
          const passingMarks = exam ? exam.passingMarks : (maxScore * 0.4);
          const passed = totalScore >= passingMarks;

          await updateDoc(subRef, {
            answers,
            totalScore,
            percentage,
            passed,
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
};
