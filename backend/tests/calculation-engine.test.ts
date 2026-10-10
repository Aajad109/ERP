import { describe, it, expect } from 'vitest';
import {
  calculateGrade,
  calculateSGPA,
  evaluateCGPA,
  isDirectCorrectionEligible,
  ELIGIBLE_DIRECT_CORRECTION_CATEGORIES,
} from '../src/utils/academic-rules';

describe('Academic Calculation Engine (College-Specific Rules)', () => {
  describe('Theory & Lab Passing & Grade Rules', () => {
    it('awards Grade O for total >= 90 when internal and external meet pass thresholds', () => {
      const res = calculateGrade(38, 56); // 94 total
      expect(res.grade).toBe('O');
      expect(res.gradePoint).toBe(10);
      expect(res.isPassed).toBe(true);
    });

    it('awards Grade A for total = 75', () => {
      const res = calculateGrade(33, 42); // 75 total
      expect(res.grade).toBe('A');
      expect(res.gradePoint).toBe(8);
      expect(res.isPassed).toBe(true);
    });

    it('fails student who scores below 16 in internal marks (threshold 16/40)', () => {
      const res = calculateGrade(15, 50);
      expect(res.isPassed).toBe(false);
      expect(res.grade).toBe('F');
      expect(res.gradePoint).toBe(0);
      expect(res.statusComment).toContain('Internal marks below passing threshold');
    });

    it('fails student who scores below 24 in external marks (threshold 24/60)', () => {
      const res = calculateGrade(35, 20);
      expect(res.isPassed).toBe(false);
      expect(res.grade).toBe('F');
      expect(res.gradePoint).toBe(0);
      expect(res.statusComment).toContain('External marks below passing threshold');
    });

    it('marks student as AB with 0 grade point when absent', () => {
      const res = calculateGrade(0, 0, true);
      expect(res.grade).toBe('AB');
      expect(res.gradePoint).toBe(0);
      expect(res.isPassed).toBe(false);
    });

    it('throws error when internal marks exceed 40', () => {
      expect(() => calculateGrade(41, 50)).toThrow('Internal marks must be between 0 and 40');
    });

    it('throws error when external marks exceed 60', () => {
      expect(() => calculateGrade(30, 65)).toThrow('External marks must be between 0 and 60');
    });
  });

  describe('CGPA Availability Rule', () => {
    it('computes official CGPA when all enrolled subjects are passed', () => {
      const courses = [
        { credits: 4, gradePoint: 9, isPassed: true },
        { credits: 4, gradePoint: 8, isPassed: true },
      ];
      const res = evaluateCGPA(courses);
      expect(res.cgpaStatus).toBe('OFFICIAL');
      expect(res.cgpa).toBe(8.5);
    });

    it('withholds official CGPA when any required subject is failed', () => {
      const courses = [
        { credits: 4, gradePoint: 9, isPassed: true },
        { credits: 4, gradePoint: 0, isPassed: false },
      ];
      const res = evaluateCGPA(courses);
      expect(res.cgpaStatus).toBe('WITHHELD_FAILED_SUBJECTS');
      expect(res.cgpa).toBeNull();
      expect(res.statusMessage).toBe('CGPA withheld — required subject(s) not passed');
    });
  });

  describe('Direct Correction Eligibility', () => {
    it('permits only documented administrative categories', () => {
      expect(isDirectCorrectionEligible('TRANSCRIPTION_ERROR')).toBe(true);
      expect(isDirectCorrectionEligible('IMPORT_MAPPING_ERROR')).toBe(true);
      expect(isDirectCorrectionEligible('APPROVED_CALCULATION_CORRECTION')).toBe(true);

      expect(isDirectCorrectionEligible('ACADEMIC_RE_EVALUATION')).toBe(false);
      expect(isDirectCorrectionEligible('DISPUTED_EVALUATION')).toBe(false);
      expect(isDirectCorrectionEligible('ARBITRARY_OVERRIDE')).toBe(false);
    });
  });
});
