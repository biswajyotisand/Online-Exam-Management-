import { Exam, Question, Submission, UserProfile } from '../types/exam';
import { examService } from './examService';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function seedSampleDatabase(currentUserId?: string, currentUserEmail?: string) {
  try {
    console.log('Starting seedSampleDatabase...');

    const samplePasswordHash = 'ca05f4ad7ea4e897931aef6b843086dfc59f7bb8511e9f458ba566e4aee03dc6'; // password123

    // 0. Seed Staff & Participant Users (No demo admin accounts)
    const sampleUsers: UserProfile[] = [
      {
        uid: 'setter_alan_vance',
        email: 'alan.vance@faculty.edu',
        displayName: 'Prof. Alan Vance',
        employeeId: 'EMP-SETTER01',
        role: 'paper_setter',
        department: 'Department of Computer Science',
        passwordHash: samplePasswordHash,
        createdAt: new Date().toISOString(),
      },
      {
        uid: 'evaluator_sarah_connor',
        email: 'sarah.connor@evaluation.edu',
        displayName: 'Dr. Sarah Connor',
        employeeId: 'EMP-EVAL01',
        role: 'evaluator',
        department: 'Academic Assessment & Review Board',
        passwordHash: samplePasswordHash,
        createdAt: new Date().toISOString(),
      },
      {
        uid: 'student_david_id',
        email: 'david.miller@student.edu',
        displayName: 'David K. Miller',
        employeeId: 'EMP-STUDENT01',
        role: 'participant',
        department: 'School of Software Engineering',
        passwordHash: samplePasswordHash,
        createdAt: new Date().toISOString(),
      },
      {
        uid: 'student_elena_id',
        email: 'elena.rostova@student.edu',
        displayName: 'Elena Rostova',
        employeeId: 'EMP-STUDENT02',
        role: 'participant',
        department: 'Department of Applied Cybernetics',
        passwordHash: samplePasswordHash,
        createdAt: new Date().toISOString(),
      },
    ];

    if (currentUserId && currentUserEmail) {
      sampleUsers.push({
        uid: currentUserId,
        email: currentUserEmail,
        displayName: 'Administrator',
        role: 'admin',
        department: 'Academic Computing & System Security',
        createdAt: new Date().toISOString(),
      });
    }

    for (const u of sampleUsers) {
      await setDoc(doc(db, 'users', u.uid), u);
      if (u.role === 'admin') {
        await setDoc(doc(db, 'admins', u.uid), {
          email: u.email,
          assignedAt: new Date().toISOString(),
        });
      }
    }

    // 1. Seed Exam 1: Cloud & Distributed Systems (Published)
    const exam1: Exam = {
      id: 'exam_cs401_cloud',
      title: 'Cloud Architecture & Distributed Systems (CS-401)',
      description: 'Comprehensive evaluation covering high availability, database partitioning, consensus protocols, and microservice resiliency.',
      subject: 'Computer Science',
      setterId: 'setter_alan_vance',
      setterName: 'Prof. Alan Vance (Paper Setter)',
      evaluatorId: 'evaluator_sarah_connor',
      evaluatorName: 'Dr. Sarah Connor (Senior Evaluator)',
      status: 'published',
      durationMinutes: 45,
      totalMarks: 50,
      passingMarks: 25,
      questionsCount: 4,
      instructions: '1. All questions are compulsory.\n2. Do not switch tabs or leave full-screen mode; violations are logged.\n3. Save answers frequently; final submit lock is permanent.',
      proctoringEnabled: true,
      createdAt: new Date(Date.now() - 3600000 * 24 * 3).toISOString(),
    };

    await setDoc(doc(db, 'exams', exam1.id), exam1);

    const questions1: Question[] = [
      {
        id: 'q1_cs401',
        examId: exam1.id,
        order: 1,
        title: 'Which theorem states that a distributed data store can simultaneously provide at most two out of Consistency, Availability, and Partition Tolerance?',
        type: 'mcq',
        options: ['CAP Theorem', 'PACELC Theorem', 'Amory Law', 'FLP Impossibility Principle'],
        correctAnswer: 'CAP Theorem',
        marks: 10,
        explanation: 'The CAP theorem, also named Brewer\'s theorem, asserts that any distributed data store can only guarantee two of the three properties.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'q2_cs401',
        examId: exam1.id,
        order: 2,
        title: 'In event-driven architecture, idempotency ensures that processing the exact same event multiple times produces the identical side-effect.',
        type: 'boolean',
        options: ['True', 'False'],
        correctAnswer: 'True',
        marks: 10,
        explanation: 'Idempotency is critical in at-least-once message delivery systems to prevent duplicate billing or side-effects.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'q3_cs401',
        examId: exam1.id,
        order: 3,
        title: 'Explain the difference between Optimistic Concurrency Control (OCC) and Pessimistic Locking in database transactions. Discuss when each is preferable.',
        type: 'subjective',
        marks: 15,
        rubric: 'Full Marks (15): Clearly articulates version checking/commit validation vs row/table level write locks. Mentions conflict likelihood (low contention favors OCC, high contention favors Pessimistic).\nPartial (8-12): Good definitions but missing trade-offs.\nBasic (1-7): Shallow explanation.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'q4_cs401',
        examId: exam1.id,
        order: 4,
        title: 'Write a resilient pseudo-code or TypeScript function implementing an Exponential Backoff retry strategy with jitter for transient HTTP 503 errors.',
        type: 'code',
        marks: 15,
        rubric: 'Check for base delay, exponential factor (2^attempt), maximum retry cap, and randomized jitter factor to prevent thundering herd problem.',
        starterCode: `async function fetchWithRetry(url: string, maxRetries = 4): Promise<Response> {\n  // Implement retry with exponential backoff and jitter here\n}`,
        createdAt: new Date().toISOString(),
      }
    ];

    for (const q of questions1) {
      await setDoc(doc(db, 'exams', exam1.id, 'questions', q.id), q);
    }

    // 2. Seed Exam 2: Fullstack Web Engineering & Security (Published)
    const exam2: Exam = {
      id: 'exam_web302_security',
      title: 'Fullstack Web Engineering & Application Security (WEB-302)',
      description: 'Assessment on modern frontend performance, token-based authentication, and Firestore rule security policies.',
      subject: 'Software Engineering',
      setterId: 'setter_alan_vance',
      setterName: 'Prof. Alan Vance (Paper Setter)',
      evaluatorId: 'evaluator_sarah_connor',
      evaluatorName: 'Dr. Sarah Connor (Senior Evaluator)',
      status: 'published',
      durationMinutes: 30,
      totalMarks: 40,
      passingMarks: 20,
      questionsCount: 3,
      instructions: 'Answer all technical security questions with rigor.',
      proctoringEnabled: true,
      evaluationForwardStatus: 'forwarded_to_admin',
      evaluationForwardedAt: new Date(Date.now() - 3600000 * 17).toISOString(),
      evaluationForwardedBy: 'Dr. Sarah Connor (Senior Evaluator)',
      recommendedResultReleaseTime: new Date(Date.now() + 3600000 * 24).toISOString(),
      evaluatorRemarks: 'All student submissions graded and cross-verified. Average score: 95%. Recommended publication tomorrow.',
      createdAt: new Date(Date.now() - 3600000 * 24 * 2).toISOString(),
    };

    await setDoc(doc(db, 'exams', exam2.id), exam2);

    const questions2: Question[] = [
      {
        id: 'q1_web302',
        examId: exam2.id,
        order: 1,
        title: 'Which HTTP response header prevents clickjacking attacks by forbidding the page from being embedded in an iframe?',
        type: 'mcq',
        options: ['X-Frame-Options: DENY', 'Content-Type: text/plain', 'Access-Control-Allow-Origin: *', 'Cache-Control: no-store'],
        correctAnswer: 'X-Frame-Options: DENY',
        marks: 10,
        explanation: 'X-Frame-Options or Content-Security-Policy frame-ancestors prevents iframing on untrusted origins.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'q2_web302',
        examId: exam2.id,
        order: 2,
        title: 'Firestore security rules run client-side in the user\'s browser before sending network packets.',
        type: 'boolean',
        options: ['True', 'False'],
        correctAnswer: 'False',
        marks: 10,
        explanation: 'Firestore security rules execute strictly on Google Cloud backend servers and cannot be tampered with by clients.',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'q3_web302',
        examId: exam2.id,
        order: 3,
        title: 'Describe Cross-Site Request Forgery (CSRF). How do modern SameSite cookie flags and Anti-CSRF tokens neutralize this vulnerability?',
        type: 'subjective',
        marks: 20,
        rubric: 'High Score (18-20): Explains unauthorized command transmission via authenticated user credentials. Details SameSite=Lax/Strict and cryptographically random synchronizer tokens.\nMedium (10-17): Understands CSRF but lacks depth on protection mechanisms.\nLow (1-9): Confuses CSRF with XSS.',
        createdAt: new Date().toISOString(),
      }
    ];

    for (const q of questions2) {
      await setDoc(doc(db, 'exams', exam2.id, 'questions', q.id), q);
    }

    // 3. Seed Exam 3: Draft Exam for Paper Setter testing
    const exam3: Exam = {
      id: 'exam_ai500_draft',
      title: 'Neural Networks & Deep Learning Foundations (AI-500)',
      description: 'Under development: Covers backpropagation, attention mechanisms, loss functions, and tensor algebra.',
      subject: 'Artificial Intelligence',
      setterId: 'setter_alan_vance',
      setterName: 'Prof. Alan Vance (Paper Setter)',
      status: 'draft',
      durationMinutes: 60,
      totalMarks: 30,
      passingMarks: 15,
      questionsCount: 2,
      instructions: 'Draft stage exam. Pending reviewer approval.',
      proctoringEnabled: false,
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, 'exams', exam3.id), exam3);

    const questions3: Question[] = [
      {
        id: 'q1_ai500',
        examId: exam3.id,
        order: 1,
        title: 'What activation function overcomes the vanishing gradient problem in deep feed-forward networks by outputting max(0, x)?',
        type: 'mcq',
        options: ['ReLU (Rectified Linear Unit)', 'Sigmoid', 'Hyperbolic Tangent (Tanh)', 'Softmax'],
        correctAnswer: 'ReLU (Rectified Linear Unit)',
        marks: 15,
        createdAt: new Date().toISOString(),
      },
      {
        id: 'q2_ai500',
        examId: exam3.id,
        order: 2,
        title: 'Contrast batch normalization with layer normalization in transformer models.',
        type: 'subjective',
        marks: 15,
        rubric: 'Expect discussion on batch size dependency and sequence length variance.',
        createdAt: new Date().toISOString(),
      }
    ];
    for (const q of questions3) {
      await setDoc(doc(db, 'exams', exam3.id, 'questions', q.id), q);
    }

    // 4. Seed Submission 1: Pending evaluation (ready for Evaluator portal!)
    const subPending: Submission = {
      id: `sub_${exam1.id}_student_david_id`,
      examId: exam1.id,
      examTitle: exam1.title,
      participantId: 'student_david_id',
      participantName: 'David K. Miller',
      participantEmail: 'david.miller@student.edu',
      status: 'submitted',
      tabSwitchCount: 1,
      startedAt: new Date(Date.now() - 3600000 * 5).toISOString(),
      submittedAt: new Date(Date.now() - 3600000 * 4).toISOString(),
      totalScore: 20, // Auto-graded from MCQ + boolean
      maxScore: 50,
      answers: {
        q1_cs401: {
          questionId: 'q1_cs401',
          answer: 'CAP Theorem',
          marksObtained: 10,
          isEvaluated: true,
          evaluatorFeedback: 'Correct selection.',
        },
        q2_cs401: {
          questionId: 'q2_cs401',
          answer: 'True',
          marksObtained: 10,
          isEvaluated: true,
          evaluatorFeedback: 'Accurate.',
        },
        q3_cs401: {
          questionId: 'q3_cs401',
          answer: 'Optimistic Concurrency Control checks for conflicts before committing by comparing version stamps. It is best suited for low write contention environments like CMS. In contrast, Pessimistic Locking places exclusive locks on database rows at transaction start, which prevents conflicts upfront but can lead to deadlocks and latency under high volume.',
          marksObtained: 0,
          isEvaluated: false, // Pending manual evaluation by Evaluator!
        },
        q4_cs401: {
          questionId: 'q4_cs401',
          answer: `async function fetchWithRetry(url: string, maxRetries = 4): Promise<Response> {\n  for (let attempt = 0; attempt < maxRetries; attempt++) {\n    try {\n      const res = await fetch(url);\n      if (res.ok) return res;\n      if (res.status !== 503) throw new Error(\`Fatal \${res.status}\`);\n    } catch (err) {\n      if (attempt === maxRetries - 1) throw err;\n      const delay = Math.pow(2, attempt) * 500 + Math.random() * 200;\n      await new Promise(r => setTimeout(r, delay));\n    }\n  }\n  throw new Error('Retries exceeded');\n}`,
          marksObtained: 0,
          isEvaluated: false, // Pending manual evaluation by Evaluator!
        }
      }
    };
    await setDoc(doc(db, 'submissions', subPending.id), subPending);

    // 5. Seed Submission 2: Already evaluated submission
    const subEvaluated: Submission = {
      id: `sub_${exam2.id}_student_elena_id`,
      examId: exam2.id,
      examTitle: exam2.title,
      participantId: 'student_elena_id',
      participantName: 'Elena Rostova',
      participantEmail: 'elena.rostova@student.edu',
      status: 'evaluated',
      tabSwitchCount: 0,
      totalScore: 38,
      maxScore: 40,
      percentage: 95,
      passed: true,
      evaluatorId: 'evaluator_sarah_connor',
      evaluatorNotes: 'Outstanding technical precision. Thorough understanding of web security fundamentals.',
      startedAt: new Date(Date.now() - 3600000 * 20).toISOString(),
      submittedAt: new Date(Date.now() - 3600000 * 19).toISOString(),
      evaluatedAt: new Date(Date.now() - 3600000 * 18).toISOString(),
      answers: {
        q1_web302: {
          questionId: 'q1_web302',
          answer: 'X-Frame-Options: DENY',
          marksObtained: 10,
          isEvaluated: true,
          evaluatorFeedback: 'Correct.',
        },
        q2_web302: {
          questionId: 'q2_web302',
          answer: 'False',
          marksObtained: 10,
          isEvaluated: true,
          evaluatorFeedback: 'Correct.',
        },
        q3_web302: {
          questionId: 'q3_web302',
          answer: 'CSRF occurs when an attacker tricks an authenticated browser into issuing unwanted state-changing HTTP requests with valid session cookies. Modern defenses include setting SameSite=Strict or Lax cookies so cross-site requests omit credentials, and implementing unpredictable cryptographically signed anti-CSRF tokens verified in request headers.',
          marksObtained: 18,
          isEvaluated: true,
          evaluatorFeedback: 'Excellent explanation of SameSite semantics and token synchronization.',
        }
      }
    };
    await setDoc(doc(db, 'submissions', subEvaluated.id), subEvaluated);

    // 6. Seed Audit Logs
    const logId1 = 'log_seed_init_' + Date.now();
    const logId2 = 'log_seed_pub_' + (Date.now() + 1);
    const log1 = {
      id: logId1,
      action: 'SYSTEM_BOOTSTRAP',
      userId: currentUserId || 'system',
      userEmail: currentUserEmail || 'biswajyoti.sand@gmail.com',
      details: 'Examination platform bootstrapped with multi-role schemas',
      timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
    };
    const log2 = {
      id: logId2,
      action: 'EXAM_PUBLISHED',
      userId: 'setter_alan_vance',
      userEmail: 'alan.vance@faculty.edu',
      details: 'Published "Cloud Architecture & Distributed Systems (CS-401)" with 4 questions',
      timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    };
    await setDoc(doc(db, 'audit_logs', log1.id), log1);
    await setDoc(doc(db, 'audit_logs', log2.id), log2);

    console.log('Seed completed successfully!');
    return true;
  } catch (error) {
    console.error('Failed to seed database:', error);
    throw error;
  }
}
