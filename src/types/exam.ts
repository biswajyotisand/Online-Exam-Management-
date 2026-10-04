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
  isMandatory?: boolean; // Selective compulsory question: candidate MUST attend
  isSkipped?: boolean; // When question is marked debatable / excluded
  skipRecommendation?: {
    recommendedBy: string;
    role: 'evaluator' | 'paper_setter';
    reason: string;
    recommendedAt: string;
    status: 'pending' | 'approved' | 'rejected';
  };
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
  originalTotalMarks?: number; // Preserved before debatable questions are skipped
  originalPassingMarks?: number; // Preserved before debatable questions are skipped
  questionsCount: number;
  maxQuestionsToAttempt?: number; // e.g. candidate can appear in only 100 out of 110 questions
  instructions?: string;
  proctoringEnabled?: boolean;
  negativeMarkingEnabled?: boolean;
  negativeMarksPerQuestion?: number; // marks deducted per incorrect answer (e.g. 0.25, 0.33, 0.5, 1)
  
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

  // Challenge Window (Scheduled Date & Time set by Administrator)
  challengeDeadline?: string; // ISO string up to which challenges can be submitted
  challengeWindowOpen?: boolean;

  // Question Skipping / Debatable Questions handling
  skippedQuestionIds?: string[];
  skippedQuestionsInfo?: Record<string, {
    reason: string;
    recommendedBy: string;
    role: 'evaluator' | 'paper_setter';
    approvedBy: string;
    approvedAt: string;
    marksCredited: number;
  }>;

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
  isSkipped?: boolean;
  // Challenge tracking
  challengeId?: string;
  challengeStatus?: ChallengeStatus;
}

export type ChallengeStatus =
  | 'submitted'
  | 'under_setter_review'
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

export interface ChallengeAttachment {
  name: string;
  type: string; // 'image/png' | 'image/jpeg' | 'application/pdf' | etc.
  dataUrl: string; // Base64 data URL
  size?: number;
}

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
  candidateAttachment?: ChallengeAttachment;
  submittedAt: string;

  status: ChallengeStatus;

  // Paper Setter Review Stage (Since Paper Setter authored the question and selected the correct answer)
  setterId?: string;
  setterName?: string;
  setterDecision?: 'recommend_alter_key' | 'uphold_original' | 'recommend_skip_question';
  setterProposedAnswer?: string;
  setterReviewNotes?: string;
  setterAttachment?: ChallengeAttachment;
  setterReviewedAt?: string;

  // Evaluator Review Stage
  evaluatorId?: string;
  evaluatorName?: string;
  evaluatorDecision?: 'recommend_accept' | 'recommend_reject' | 'recommend_skip_question';
  evaluatorRecommendedMarks?: number;
  evaluatorReviewNotes?: string;
  evaluatorAttachment?: ChallengeAttachment;
  evaluatorReviewedAt?: string;

  // Administrator Final Authorization Stage
  adminId?: string;
  adminName?: string;
  adminDecision?: 'accept_revision' | 'uphold_original' | 'approve_skip_question';
  finalAwardedMarks?: number;
  adminDecisionNotes?: string;
  resolvedAt?: string;
}

export interface CandidateChallengeSnapshot {
  capturedAt: string;
  actionType: 'challenge_answer_key_revision' | 'debatable_question_skipped' | 'challenge_resolution' | 'initial_evaluation';
  questionId?: string;
  questionTitle?: string;
  reason?: string;
  totalMarks: number;
  passingMarks: number;
  totalScore: number;
  maxScore: number;
  percentage: number;
  passed: boolean;
  answers: Record<string, AnswerItem>;
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
  attemptedQuestionsCount?: number;
  compulsoryAttemptedCount?: number;
  compulsoryTotalCount?: number;
  tabSwitchCount: number;
  violationStrikes?: number;
  challengeSubmitted?: boolean;
  challengeSubmittedAt?: string;
  evaluatorId?: string;
  evaluatorNotes?: string;
  beforeChallengeSnapshot?: CandidateChallengeSnapshot;
  evaluationHistory?: CandidateChallengeSnapshot[];
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
