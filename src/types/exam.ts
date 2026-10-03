export type UserRole = 'admin' | 'paper_setter' | 'evaluator' | 'participant';

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  employeeId?: string;
  photoURL?: string;
  role: UserRole;
  department?: string;
  assignedExamId?: string;
  assignedExamTitle?: string;
  passwordHash?: string;
  mustChangePassword?: boolean;
  isOperational?: boolean;
  operationalizedAt?: string;
  defaultPasswordAssigned?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface SystemPasscodes {
  paperSetterOperationalPasscode: string;
  evaluatorOperationalPasscode: string;
  roleSwitchPasscode: string;
  participantDefaultPassword?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export type ExamStatus = 'draft' | 'published' | 'in_progress' | 'completed' | 'archived';

export type QuestionType = 'mcq' | 'subjective' | 'boolean' | 'code';

export interface Question {
  id: string;
  examId: string;
  order: number;
  title: string;
  type: QuestionType;
  options?: string[]; // for mcq
  correctAnswer?: string; // used for auto-grading MCQs / booleans
  marks: number;
  rubric?: string; // guidelines for evaluator
  explanation?: string;
  starterCode?: string;
  createdAt: string;
}

export type ExamScheduleStatus = 'unscheduled' | 'schedule_proposed' | 'schedule_authorized' | 'schedule_altered';

export type EvaluationForwardStatus = 'not_forwarded' | 'forwarded_to_admin' | 'results_authorized' | 'results_published';

export interface Exam {
  id: string;
  title: string;
  description: string;
  subject: string;
  setterId: string;
  setterName: string;
  evaluatorId?: string;
  evaluatorName?: string;
  assignedParticipantIds?: string[];
  status: ExamStatus;
  durationMinutes: number;
  totalMarks: number;
  passingMarks: number;
  questionsCount: number;
  instructions?: string;
  proctoringEnabled?: boolean;
  
  // Live Schedule & Authorization Workflow
  scheduledStartTime?: string; // YYYY-MM-DDTHH:mm or ISO
  scheduledEndTime?: string;   // YYYY-MM-DDTHH:mm or ISO
  scheduleStatus?: ExamScheduleStatus;
  scheduleProposedAt?: string;
  scheduleProposedBy?: string;
  scheduleAuthorizedAt?: string;
  scheduleAuthorizedBy?: string;
  scheduleNotes?: string;

  // Evaluator Forwarding & Result Publication Workflow
  evaluationForwardStatus?: EvaluationForwardStatus;
  evaluationForwardedAt?: string;
  evaluationForwardedBy?: string;
  recommendedResultReleaseTime?: string; // Proposed by Evaluator (ISO)
  evaluatorRemarks?: string;

  scheduledResultReleaseTime?: string;   // Authorized / altered by Administrator (ISO)
  resultsAuthorizedAt?: string;
  resultsAuthorizedBy?: string;
  resultsPublished?: boolean;
  resultsPublishedAt?: string;
  adminResultNotes?: string;

  createdAt: string;
  updatedAt?: string;
}

export interface AnswerItem {
  questionId: string;
  answer: string;
  isFlagged?: boolean;
  marksObtained?: number;
  evaluatorFeedback?: string;
  isEvaluated?: boolean;
  // Challenge tracking
  challengeId?: string;
  challengeStatus?: ChallengeStatus;
}

export type ChallengeStatus =
  | 'submitted'
  | 'under_evaluator_review'
  | 'forwarded_to_admin'
  | 'resolved_accepted'
  | 'resolved_rejected';

export type ChallengeReason =
  | 'correct_marked_wrong'
  | 'question_ambiguity'
  | 'marking_calculation_error'
  | 'multiple_correct_options'
  | 'other';

export interface QuestionChallenge {
  id: string;
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
  submittedAt: string;

  status: ChallengeStatus;

  // Evaluator Review Stage
  evaluatorId?: string;
  evaluatorName?: string;
  evaluatorDecision?: 'recommend_accept' | 'recommend_reject';
  evaluatorRecommendedMarks?: number;
  evaluatorReviewNotes?: string;
  evaluatorReviewedAt?: string;

  // Administrator Final Authorization Stage
  adminId?: string;
  adminName?: string;
  adminDecision?: 'accept_revision' | 'uphold_original';
  finalAwardedMarks?: number;
  adminDecisionNotes?: string;
  resolvedAt?: string;
}

export interface Submission {
  id: string;
  examId: string;
  examTitle: string;
  participantId: string;
  participantName: string;
  participantEmail: string;
  status: 'in_progress' | 'submitted' | 'evaluated';
  answers: Record<string, AnswerItem>;
  totalScore?: number;
  maxScore?: number;
  percentage?: number;
  passed?: boolean;
  tabSwitchCount: number;
  evaluatorId?: string;
  evaluatorNotes?: string;
  startedAt: string;
  submittedAt?: string;
  evaluatedAt?: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  userId: string;
  userEmail: string;
  details: string;
  timestamp: string;
}
