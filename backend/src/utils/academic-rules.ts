import { config } from '../config';

export interface GradeResult {
  grade: string;
  gradePoint: number;
  isPassed: boolean;
  statusComment?: string;
}

export const ELIGIBLE_DIRECT_CORRECTION_CATEGORIES = [
  'TRANSCRIPTION_ERROR',
  'IMPORT_MAPPING_ERROR',
  'APPROVED_CALCULATION_CORRECTION',
] as const;

export type DirectCorrectionCategory = (typeof ELIGIBLE_DIRECT_CORRECTION_CATEGORIES)[number];

export function isDirectCorrectionEligible(category: string): category is DirectCorrectionCategory {
  return ELIGIBLE_DIRECT_CORRECTION_CATEGORIES.includes(category as DirectCorrectionCategory);
}

/**
 * Calculates grade and grade points based on college-specific policy
 * Fixed limits: Internal Max 40, External Max 60, Total Max 100
 */
export function calculateGrade(internalMarks: number, externalMarks: number, isAbsent: boolean = false): GradeResult {
  if (isAbsent) {
    return {
      grade: 'AB',
      gradePoint: 0,
      isPassed: false,
      statusComment: 'Absent in Examination',
    };
  }

  // Check boundaries
  if (internalMarks < 0 || internalMarks > config.academicRules.maxInternalMarks) {
    throw new Error(`Internal marks must be between 0 and ${config.academicRules.maxInternalMarks}`);
  }
  if (externalMarks < 0 || externalMarks > config.academicRules.maxExternalMarks) {
    throw new Error(`External marks must be between 0 and ${config.academicRules.maxExternalMarks}`);
  }

  const totalMarks = Math.round((internalMarks + externalMarks) * 100) / 100;

  // Passing criteria:
  // Must secure at least 40% in internal (16/40) AND 40% in external (24/60) AND 40% aggregate (40/100)
  const passedInternal = internalMarks >= config.academicRules.minInternalPassMarks;
  const passedExternal = externalMarks >= config.academicRules.minExternalPassMarks;
  const passedTotal = totalMarks >= config.academicRules.minTotalPassMarks;

  if (!passedInternal || !passedExternal || !passedTotal) {
    return {
      grade: 'F',
      gradePoint: 0,
      isPassed: false,
      statusComment: !passedInternal
        ? 'Failed: Internal marks below passing threshold (16/40)'
        : !passedExternal
        ? 'Failed: External marks below passing threshold (24/60)'
        : 'Failed: Total aggregate below passing threshold (40/100)',
    };
  }

  // 10-Point Grade Scale
  if (totalMarks >= 90) return { grade: 'O', gradePoint: 10, isPassed: true };
  if (totalMarks >= 80) return { grade: 'A+', gradePoint: 9, isPassed: true };
  if (totalMarks >= 70) return { grade: 'A', gradePoint: 8, isPassed: true };
  if (totalMarks >= 60) return { grade: 'B+', gradePoint: 7, isPassed: true };
  if (totalMarks >= 55) return { grade: 'B', gradePoint: 6, isPassed: true };
  if (totalMarks >= 50) return { grade: 'C', gradePoint: 5, isPassed: true };
  return { grade: 'P', gradePoint: 4, isPassed: true };
}

/**
 * Calculates SGPA for a semester
 */
export function calculateSGPA(courses: Array<{ credits: number; gradePoint: number; isPassed: boolean }>): number {
  if (courses.length === 0) return 0;
  let totalCredits = 0;
  let totalCreditPoints = 0;

  for (const c of courses) {
    totalCredits += c.credits;
    totalCreditPoints += c.credits * c.gradePoint;
  }

  if (totalCredits === 0) return 0;
  return Math.round((totalCreditPoints / totalCredits) * 100) / 100;
}

export interface CGPAResult {
  cgpa: number | null;
  cgpaStatus: 'OFFICIAL' | 'WITHHELD_FAILED_SUBJECTS';
  statusMessage: string;
}

/**
 * College-specific CGPA availability rule:
 * Official CGPA is computed and displayed ONLY if student has passed every required course.
 * If any subject is failed/incomplete, withhold CGPA with clear status.
 */
export function evaluateCGPA(allSubjects: Array<{ credits: number; gradePoint: number; isPassed: boolean }>): CGPAResult {
  if (allSubjects.length === 0) {
    return {
      cgpa: null,
      cgpaStatus: 'OFFICIAL',
      statusMessage: 'No completed courses',
    };
  }

  const hasFailedSubject = allSubjects.some((s) => !s.isPassed);

  if (hasFailedSubject) {
    return {
      cgpa: null,
      cgpaStatus: 'WITHHELD_FAILED_SUBJECTS',
      statusMessage: 'CGPA withheld — required subject(s) not passed',
    };
  }

  let totalCredits = 0;
  let totalPoints = 0;
  for (const s of allSubjects) {
    totalCredits += s.credits;
    totalPoints += s.credits * s.gradePoint;
  }

  const rawCgpa = totalCredits > 0 ? totalPoints / totalCredits : 0;
  const roundedCgpa = Math.round(rawCgpa * 100) / 100;

  return {
    cgpa: roundedCgpa,
    cgpaStatus: 'OFFICIAL',
    statusMessage: 'Official CGPA available',
  };
}
